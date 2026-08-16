import { getSql } from "../../../lib/db";

export async function GET(req) {
  const sql = getSql();
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return Response.json({ error: "sessionId is required." }, { status: 400 });

  try {
    const rows = await sql`
      SELECT id, content, remind_at, sent, created_at
      FROM reminders
      WHERE session_id = ${sessionId}
      ORDER BY remind_at ASC
      LIMIT 200
    `;
    return Response.json({ reminders: rows });
  } catch (err) {
    console.log("Reminders GET failed:", err.message);
    return Response.json({ error: "Couldn't load reminders right now." }, { status: 500 });
  }
}

export async function POST(req) {
  const sql = getSql();
  const { sessionId, content, remindAt } = await req.json();
  if (!sessionId || !content?.trim() || !remindAt) {
    return Response.json({ error: "sessionId, content, and remindAt are required." }, { status: 400 });
  }

  const remindDate = new Date(remindAt);
  if (isNaN(remindDate.getTime())) {
    return Response.json({ error: "remindAt must be a valid date/time." }, { status: 400 });
  }

  try {
    const rows = await sql`
      INSERT INTO reminders (session_id, content, remind_at)
      VALUES (${sessionId}, ${content.trim()}, ${remindDate.toISOString()})
      RETURNING id, content, remind_at, sent, created_at
    `;
    return Response.json({ reminder: rows[0] });
  } catch (err) {
    console.log("Reminders POST failed:", err.message);
    return Response.json({ error: "Couldn't save that reminder." }, { status: 500 });
  }
}

export async function DELETE(req) {
  const sql = getSql();
  const { id, sessionId } = await req.json();
  if (!id || !sessionId) {
    return Response.json({ error: "id and sessionId are required." }, { status: 400 });
  }

  try {
    await sql`DELETE FROM reminders WHERE id = ${id} AND session_id = ${sessionId}`;
    return Response.json({ success: true });
  } catch (err) {
    console.log("Reminders DELETE failed:", err.message);
    return Response.json({ error: "Couldn't delete that reminder." }, { status: 500 });
  }
}
