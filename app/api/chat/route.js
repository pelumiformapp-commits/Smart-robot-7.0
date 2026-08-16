import { getSql } from "../../../lib/db";
import { buildSystemPrompt, getAIReply, cleanTextForSpeech, wantsImageGeneration, generateImageGemini, askVision, sanitizeReply } from "../../../lib/ai";
import { detectCalculation, runCalculation, detectSummarize, detectTranslate, extractFacts, mergeFacts } from "../../../lib/tools";

export const maxDuration = 60;

const DAILY_LIMIT = 30;

async function checkDailyLimit(sql, sessionId) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await sql`
    INSERT INTO usage_limits (session_id, usage_date, count)
    VALUES (${sessionId}, ${today}, 1)
    ON CONFLICT (session_id, usage_date)
    DO UPDATE SET count = usage_limits.count + 1
    RETURNING count
  `;
  return rows[0].count <= DAILY_LIMIT;
}

async function safeInsertMessage(sql, visitorName, sessionId, role, content) {
  try {
    await sql`
      INSERT INTO messages (visitor_name, session_id, role, content)
      VALUES (${visitorName || "Guest"}, ${sessionId}, ${role}, ${content})
    `;
  } catch (err) {
    console.log("Message log failed (non-fatal):", err.message);
  }
}

// Tracks last-active + accumulates lightweight facts per visitor name, so Robert
// recognizes the same person across different apps/browsers (name-based, not a
// secure identity — fine for a personal assistant, not for anything sensitive).
async function updateVisitorProfile(sql, visitorName, latestMessage) {
  const visitorKey = (visitorName || "").trim().toLowerCase();
  if (!visitorKey || visitorKey === "guest") return "";

  try {
    const rows = await sql`SELECT facts FROM user_profiles WHERE visitor_key = ${visitorKey}`;
    const existingFacts = rows[0]?.facts || "";
    const newFacts = extractFacts(latestMessage || "");
    const mergedFacts = mergeFacts(existingFacts, newFacts);

    await sql`
      INSERT INTO user_profiles (visitor_key, display_name, facts, last_active)
      VALUES (${visitorKey}, ${visitorName.trim()}, ${mergedFacts}, now())
      ON CONFLICT (visitor_key)
      DO UPDATE SET display_name = ${visitorName.trim()}, facts = ${mergedFacts}, last_active = now()
    `;
    return mergedFacts;
  } catch (err) {
    console.log("Profile update failed (non-fatal):", err.message);
    return "";
  }
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch (err) {
    return Response.json({ reply: "That message didn't come through right — please try again." }, { status: 400 });
  }

  const { message, history, visitorName, sessionId, settings, image, adminPassword } = body || {};

  if ((!message || !message.trim()) && !image) {
    return Response.json({ error: "Message cannot be empty." }, { status: 400 });
  }
  if (!sessionId) {
    return Response.json({ error: "sessionId is required." }, { status: 400 });
  }

  const sql = getSql();

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const isCreator = !!ADMIN_PASSWORD && !!adminPassword && adminPassword === ADMIN_PASSWORD;

  try {
    if (!isCreator) {
      const underLimit = await checkDailyLimit(sql, sessionId);
      if (!underLimit) {
        return Response.json({ reply: `You've hit your daily limit of ${DAILY_LIMIT} messages. Come back tomorrow!` }, { status: 429 });
      }
    }
  } catch (err) {
    console.log("Usage limit check failed (failing open):", err.message);
  }

  await safeInsertMessage(sql, visitorName, sessionId, "user", message || "[Sent an image]");
  const knownFacts = await updateVisitorProfile(sql, visitorName, message);

  // ---- image understanding branch ----
  if (image) {
    try {
      const visionReply = await askVision(image.data, image.mimeType, message, settings);
      const cleanReply = sanitizeReply(visionReply);
      await safeInsertMessage(sql, visitorName, sessionId, "assistant", cleanReply);
      return Response.json({ reply: cleanReply, speechText: cleanTextForSpeech(cleanReply) });
    } catch (err) {
      console.log("Vision failed:", err.message);
      const fallback = "Sorry, I couldn't read that image just now — try a clearer or better-lit photo.";
      await safeInsertMessage(sql, visitorName, sessionId, "assistant", fallback);
      return Response.json({ reply: fallback });
    }
  }

  const trimmedMessage = message.trim();

  // ---- smart tools: calculator ----
  const calcExpr = detectCalculation(trimmedMessage);
  if (calcExpr) {
    const result = runCalculation(calcExpr);
    if (result !== null) {
      const replyText = `**${calcExpr.trim()} = ${result}**`;
      await safeInsertMessage(sql, visitorName, sessionId, "assistant", replyText);
      return Response.json({ reply: replyText, speechText: `That equals ${result}` });
    }
  }

  // ---- smart tools: summarize ----
  const toSummarize = detectSummarize(trimmedMessage);
  if (toSummarize) {
    try {
      const systemPrompt = "You are Robert. Summarize the given text in 3-5 concise sentences. Output only the summary, no preamble.";
      const summary = await getAIReply([
        { role: "system", content: systemPrompt },
        { role: "user", content: toSummarize },
      ]);
      await safeInsertMessage(sql, visitorName, sessionId, "assistant", summary);
      return Response.json({ reply: summary, speechText: cleanTextForSpeech(summary) });
    } catch (err) {
      console.log("Summarize failed:", err.message);
    }
  }

  // ---- smart tools: translate ----
  const translateReq = detectTranslate(trimmedMessage);
  if (translateReq) {
    try {
      const systemPrompt = `You are Robert. Translate the given text into ${translateReq.targetLanguage}. Output only the translation, nothing else.`;
      const translated = await getAIReply([
        { role: "system", content: systemPrompt },
        { role: "user", content: translateReq.text },
      ]);
      await safeInsertMessage(sql, visitorName, sessionId, "assistant", translated);
      return Response.json({ reply: translated, speechText: cleanTextForSpeech(translated) });
    } catch (err) {
      console.log("Translate failed:", err.message);
    }
  }

  // ---- handle "yes" confirming a previous image transcription ----
  const lastAssistantMsg = (history || []).slice().reverse().find((m) => m.role === "assistant");
  const isConfirmingImage = lastAssistantMsg?.content?.includes("I read this as:") && /^\s*(yes|yeah|yep|correct|that's right)\s*$/i.test(trimmedMessage);

  if (isConfirmingImage) {
    try {
      const solvePrompt = `Solve this fully now, step by step, ending with a clear "Answer:" line: ${lastAssistantMsg.content}`;
      const systemPromptConfirm = buildSystemPrompt({ visitorName, isCreator, settings, knownFacts });
      const solvedReply = await getAIReply([
        { role: "system", content: systemPromptConfirm },
        { role: "user", content: solvePrompt },
      ]);
      await safeInsertMessage(sql, visitorName, sessionId, "assistant", solvedReply);
      return Response.json({ reply: solvedReply, speechText: cleanTextForSpeech(solvedReply) });
    } catch (err) {
      console.log("Confirm-solve failed:", err.message);
    }
  }

  // ---- image generation branch ----
  if (wantsImageGeneration(trimmedMessage)) {
    try {
      const imageBase64 = await generateImageGemini(trimmedMessage);
      const replyText = "Here you go!";
      await safeInsertMessage(sql, visitorName, sessionId, "assistant", replyText);
      return Response.json({
        reply: replyText,
        speechText: replyText,
        generatedImage: `data:image/png;base64,${imageBase64}`,
      });
    } catch (err) {
      console.log("Image gen failed:", err.message);
    }
  }

  // ---- normal chat ----
  try {
    const systemPrompt = buildSystemPrompt({ visitorName, isCreator, settings, knownFacts });
    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []),
      { role: "user", content: trimmedMessage },
    ];

    const replyText = await getAIReply(messages);
    await safeInsertMessage(sql, visitorName, sessionId, "assistant", replyText);
    return Response.json({ reply: replyText, speechText: cleanTextForSpeech(replyText) });
  } catch (err) {
    console.log("Chat reply failed entirely:", err.message);
    const fallback = "Sorry, something went wrong on my end — please try again.";
    await safeInsertMessage(sql, visitorName, sessionId, "assistant", fallback);
    return Response.json({ reply: fallback }, { status: 200 });
  }
}
