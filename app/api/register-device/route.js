import { getSql } from "../../../lib/db";

export async function POST(req) {
  const sql = getSql();
  const { sessionId, oneSignalId } = await req.json();

  if (!sessionId || !oneSignalId) {
    return Response.json({ error: "sessionId and oneSignalId are required." }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO devices (session_id, onesignal_id, updated_at)
      VALUES (${sessionId}, ${oneSignalId}, now())
      ON CONFLICT (session_id)
      DO UPDATE SET onesignal_id = ${oneSignalId}, updated_at = now()
    `;
    return Response.json({ success: true });
  } catch (err) {
    console.log("Device registration failed:", err.message);
    return Response.json({ error: "Couldn't register this device." }, { status: 500 });
  }
}
