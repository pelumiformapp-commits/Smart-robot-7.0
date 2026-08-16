import { getSql } from "../../../lib/db";

export async function GET(req) {
  const sql = getSql();
  const name = new URL(req.url).searchParams.get("name");
  const visitorKey = (name || "").trim().toLowerCase();

  if (!visitorKey || visitorKey === "guest") {
    return Response.json({ hasProfile: false });
  }

  try {
    const rows = await sql`SELECT last_active FROM user_profiles WHERE visitor_key = ${visitorKey}`;
    if (!rows.length) return Response.json({ hasProfile: false });
    return Response.json({ hasProfile: true, lastActive: rows[0].last_active });
  } catch (err) {
    console.log("Profile GET failed:", err.message);
    return Response.json({ hasProfile: false });
  }
}
