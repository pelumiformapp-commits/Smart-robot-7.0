import { getSql } from "../../../lib/db";

// Direct official OpenAPI-compatible v1 chat completion endpoint
const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";
const MODEL = "llama-3.3-70b"; 
const CREATOR_NAME = "Pelumi";

export async function POST(req) {
  const sql = getSql();
  
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return Response.json({ error: "Invalid JSON body provided." }, { status: 400 });
  }

  const { message, history, visitorName, sessionId } = body;

  if (!message || !message.trim()) {
    return Response.json({ error: "Message cannot be empty." }, { status: 400 });
  }

  const isCreator = visitorName?.trim().toLowerCase() === CREATOR_NAME.toLowerCase();

  const systemPrompt = isCreator
    ? `You are Robert, a friendly, warm, slightly playful AI assistant. You are talking to Pelumi — a Computer Engineer student, and the person who built you. Greet that fact naturally sometimes, with genuine warmth, and always address them by name. Keep replies clear and concise unless asked for depth.`
    : `You are Robert, a friendly, warm, slightly playful AI assistant built by Pelumi, a Computer Engineer student. You are talking to ${visitorName || "a guest"}. Address them by name naturally. Keep replies clear and concise unless asked for depth.`;

  // Log user message to the database
  try {
    await sql`
      INSERT INTO messages (visitor_name, session_id, role, content)
      VALUES (${visitorName || "Guest"}, ${sessionId}, 'user', ${message})
    `;
  } catch (dbError) {
    console.error("Database Save User Message Error:", dbError);
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...(history || []),
    { role: "user", content: message },
  ];

  try {
    const res = await fetch(CEREBRAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, messages, stream: false }),
    });

    console.log("CEREBRAS STATUS:", res.status);
    
    // Check if upstream endpoint broke before parsing JSON
    if (!res.ok) {
      const errText = await res.text();
      console.error("Cerebras API Error Context:", errText);
      return Response.json(
        { error: `Upstream service returned status ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    console.log("CEREBRAS RESPONSE:", JSON.stringify(data));
    
    // TYPO FIXED: Removed the invalid duplicate "?.?." chaining token
    const replyText = data?.choices?.[0]?.message?.content || "Sorry, I couldn't generate a reply.";

    // Log assistant response to the database
    try {
      await sql`
        INSERT INTO messages (visitor_name, session_id, role, content)
        VALUES (${visitorName || "Guest"}, ${sessionId}, 'assistant', ${replyText})
      `;
    } catch (dbError) {
      console.error("Database Save Assistant Message Error:", dbError);
    }

    return Response.json({ reply: replyText });

  } catch (error) {
    console.error("API ROUTE FAILURE:", error);
    return Response.json(
      { error: "Robert ran into an upstream connection issue. Please try again." },
      { status: 502 }
    );
  }
                                                                 }
  
