import { getSql } from "../../../lib/db";

export async function GET(req) {
  const sql = getSql();
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return Response.json({ error: "sessionId is required." }, { status: 400 });
  }

  try {
    const rows = await sql`
      SELECT id, role, content, created_at
      FROM messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
      LIMIT 500
    `;

    const messages = rows.map((r) => ({
      id: "db" + r.id,
      role: r.role,
      content: r.content,
      time: r.created_at,
      status: r.role === "user" ? "seen" : undefined,
    }));

    return Response.json({ messages });
  } catch (err) {
    console.log("Messages GET failed:", err.message);
    return Response.json({ error: "Couldn't load chat history." }, { status: 500 });
  }
}

export async function DELETE(req) {
  const sql = getSql();
  const { sessionId } = await req.json();

  if (!sessionId) {
    return Response.json({ error: "sessionId is required." }, { status: 400 });
  }

  try {
    await sql`DELETE FROM messages WHERE session_id = ${sessionId}`;
    return Response.json({ success: true });
  } catch (err) {
    console.log("Messages DELETE failed:", err.message);
    return Response.json({ error: "Couldn't delete chat history." }, { status: 500 });
  }
}
