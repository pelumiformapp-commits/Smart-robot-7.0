import { getSql } from "../../../lib/db";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const CREATOR_NAME = "Pelumi";

export async function POST(req) {
  const sql = getSql();
  const { message, history, visitorName, sessionId } = await req.json();

  if (!message || !message.trim()) {
    return Response.json({ error: "Message cannot be empty." }, { status: 400 });
  }

  const isCreator = visitorName?.trim().toLowerCase() === CREATOR_NAME.toLowerCase();

  const systemPrompt = isCreator
    ? `You are Robert, a friendly, warm, slightly playful AI assistant. You are talking to
Pelumi — a Computer Engineer student, and the person who built you. Greet that fact naturally
sometimes, with genuine warmth, and always address them by name. Keep replies clear and
concise unless asked for depth.`
    : `You are Robert, a friendly, warm, slightly playful AI assistant built by Pelumi, a
Computer Engineer student. You are talking to ${visitorName || "a guest"}. Address them by
name naturally. Keep replies clear and concise unless asked for depth.`;

  await sql`
    INSERT INTO messages (visitor_name, session_id, role, content)
    VALUES (${visitorName || "Guest"}, ${sessionId}, 'user', ${message})
  `;

  const contents = [
    ...(history || []).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
    }),
  });

  const data = await res.json();
  const replyText =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ||
    "Sorry, I couldn't generate a reply.";

  await sql`
    INSERT INTO messages (visitor_name, session_id, role, content)
    VALUES (${visitorName || "Guest"}, ${sessionId}, 'assistant', ${replyText})
  `;

  return Response.json({ reply: replyText });
    }
