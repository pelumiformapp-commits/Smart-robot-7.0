import { sql } from "../../../lib/db";

export async function GET(req) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await sql`
    SELECT visitor_name, session_id, role, content, created_at
    FROM messages
    ORDER BY session_id, created_at ASC
  `;
  return Response.json({ messages: rows });
}
