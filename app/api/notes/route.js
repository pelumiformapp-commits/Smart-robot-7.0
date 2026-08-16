import { getSql } from "../../../lib/db";

export async function GET(req) {
  const sql = getSql();
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return Response.json({ error: "sessionId is required." }, { status: 400 });

  try {
    const rows = await sql`
      SELECT id, content, created_at
      FROM notes
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT 200
    `;
    return Response.json({ notes: rows });
  } catch (err) {
    console.log("Notes GET failed:", err.message);
    return Response.json({ error: "Couldn't load notes right now." }, { status: 500 });
  }
}

export async function POST(req) {
  const sql = getSql();
  const { sessionId, content } = await req.json();
  if (!sessionId || !content?.trim()) {
    return Response.json({ error: "sessionId and content are required." }, { status: 400 });
  }

  try {
    const rows = await sql`
      INSERT INTO notes (session_id, content)
      VALUES (${sessionId}, ${content.trim()})
      RETURNING id, content, created_at
    `;
    return Response.json({ note: rows[0] });
  } catch (err) {
    console.log("Notes POST failed:", err.message);
    return Response.json({ error: "Couldn't save that note." }, { status: 500 });
  }
}

export async function DELETE(req) {
  const sql = getSql();
  const { id, sessionId } = await req.json();
  if (!id || !sessionId) {
    return Response.json({ error: "id and sessionId are required." }, { status: 400 });
  }

  try {
    await sql`DELETE FROM notes WHERE id = ${id} AND session_id = ${sessionId}`;
    return Response.json({ success: true });
  } catch (err) {
    console.log("Notes DELETE failed:", err.message);
    return Response.json({ error: "Couldn't delete that note." }, { status: 500 });
  }
}
