import { getSql } from "../../../lib/db";
import { buildSystemPrompt, getAIReply, cleanTextForSpeech, wantsImageGeneration, generateImageGemini, askVision, sanitizeReply, CREATOR_NAME } from "../../../lib/ai";
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

export async function POST(req) {
  const sql = getSql();
  const { message, history, visitorName, sessionId, settings, image } = await req.json();

  if ((!message || !message.trim()) && !image) {
    return Response.json({ error: "Message cannot be empty." }, { status: 400 });
  }
  if (!sessionId) {
    return Response.json({ error: "sessionId is required." }, { status: 400 });
  }

  const isCreator = visitorName?.trim().toLowerCase() === CREATOR_NAME.toLowerCase();

  if (!isCreator) {
    const underLimit = await checkDailyLimit(sql, sessionId);
    if (!underLimit) {
      return Response.json({ reply: `You've hit your daily limit of ${DAILY_LIMIT} messages. Come back tomorrow!` }, { status: 429 });
    }
  }

  await sql`
    INSERT INTO messages (visitor_name, session_id, role, content)
    VALUES (${visitorName || "Guest"}, ${sessionId}, 'user', ${message || "[Sent an image]"})
  `;

  // image understanding branch
  if (image) {
    try {
      const visionReply = await askVision(image.data, image.mimeType, message, settings);
      const cleanReply = sanitizeReply(visionReply);

      await sql`
        INSERT INTO messages (visitor_name, session_id, role, content)
        VALUES (${visitorName || "Guest"}, ${sessionId}, 'assistant', ${cleanReply})
      `;
      return Response.json({ reply: cleanReply, speechText: cleanTextForSpeech(cleanReply) });
    } catch (err) {
      console.log("Vision failed:", err.message);
      return Response.json({ reply: "Sorry, I couldn't read that image just now." });
    }
  }

  // image generation branch
  if (wantsImageGeneration(message)) {
    try {
      const imageBase64 = await generateImageGemini(message);
      const replyText = "Here you go!";
      await sql`
        INSERT INTO messages (visitor_name, session_id, role, content)
        VALUES (${visitorName || "Guest"}, ${sessionId}, 'assistant', ${replyText})
      `;
      return Response.json({
        reply: replyText,
        speechText: replyText,
        generatedImage: `data:image/png;base64,${imageBase64}`,
      });
    } catch (err) {
      console.log("Image gen failed:", err.message);
    }
  }

  const systemPrompt = buildSystemPrompt({ visitorName, isCreator, settings });
  const messages = [
    { role: "system", content: systemPrompt },
    ...(history || []),
    { role: "user", content: message },
  ];

  const replyText = await getAIReply(messages);

  await sql`
    INSERT INTO messages (visitor_name, session_id, role, content)
    VALUES (${visitorName || "Guest"}, ${sessionId}, 'assistant', ${replyText})
  `;

  return Response.json({ reply: replyText, speechText: cleanTextForSpeech(replyText) });
}
