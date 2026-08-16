import { getSql } from "../../../lib/db";

export async function GET(req) {
  const sql = getSql();
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return Response.json({ error: "sessionId is required." }, { status: 400 });

  try {
    const rows = await sql`
      SELECT id, content, done, created_at
      FROM todos
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
      LIMIT 200
    `;
    return Response.json({ todos: rows });
  } catch (err) {
    console.log("Todos GET failed:", err.message);
    return Response.json({ error: "Couldn't load to-dos right now." }, { status: 500 });
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
      INSERT INTO todos (session_id, content)
      VALUES (${sessionId}, ${content.trim()})
      RETURNING id, content, done, created_at
    `;
    return Response.json({ todo: rows[0] });
  } catch (err) {
    console.log("Todos POST failed:", err.message);
    return Response.json({ error: "Couldn't save that to-do." }, { status: 500 });
  }
}

export async function PATCH(req) {
  const sql = getSql();
  const { id, sessionId, done } = await req.json();
  if (!id || !sessionId) {
    return Response.json({ error: "id and sessionId are required." }, { status: 400 });
  }

  try {
    const rows = await sql`
      UPDATE todos SET done = ${!!done}
      WHERE id = ${id} AND session_id = ${sessionId}
      RETURNING id, content, done, created_at
    `;
    if (!rows.length) return Response.json({ error: "Not found." }, { status: 404 });
    return Response.json({ todo: rows[0] });
  } catch (err) {
    console.log("Todos PATCH failed:", err.message);
    return Response.json({ error: "Couldn't update that to-do." }, { status: 500 });
  }
}

export async function DELETE(req) {
  const sql = getSql();
  const { id, sessionId } = await req.json();
  if (!id || !sessionId) {
    return Response.json({ error: "id and sessionId are required." }, { status: 400 });
  }

  try {
    await sql`DELETE FROM todos WHERE id = ${id} AND session_id = ${sessionId}`;
    return Response.json({ success: true });
  } catch (err) {
    console.log("Todos DELETE failed:", err.message);
    return Response.json({ error: "Couldn't delete that to-do." }, { status: 500 });
  }
}
