import { getSql } from "../../../lib/db";

const COHERE_URL = "https://api.cohere.com/v2/chat";
const MODEL = "command-r-plus-08-2024";
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

  const messages = [
    { role: "system", content: systemPrompt },
    ...(history || []),
    { role: "user", content: message },
  ];

  const res = await fetch(COHERE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  const data = await res.json();
  console.log("COHERE STATUS:", res.status);
  console.log("COHERE RESPONSE:", JSON.stringify(data));
  const replyText = data?.message?.content?.[0]?.text || "Sorry, I couldn't generate a reply.";

  await sql`
    INSERT INTO messages (visitor_name, session_id, role, content)
    VALUES (${visitorName || "Guest"}, ${sessionId}, 'assistant', ${replyText})
  `;

  return Response.json({ reply: replyText });
    }
