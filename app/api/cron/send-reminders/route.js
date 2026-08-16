import { getSql } from "../../../../lib/db";

export const maxDuration = 30;

async function sendOneSignalPush(oneSignalId, title, message) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) throw new Error("OneSignal not configured");

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_subscription_ids: [oneSignalId],
      headings: { en: title },
      contents: { en: message },
      priority: 10,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OneSignal ${res.status}: ${errText}`);
  }
  return res.json();
}

// GET so it's easy to trigger from Vercel Cron or an external cron service.
// Protect with a shared secret so nobody else can trigger it.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getSql();
  const now = new Date().toISOString();

  let dueReminders;
  try {
    dueReminders = await sql`
      SELECT r.id, r.session_id, r.content, r.remind_at, d.onesignal_id
      FROM reminders r
      JOIN devices d ON d.session_id = r.session_id
      WHERE r.sent = FALSE AND r.remind_at <= ${now}
      ORDER BY r.remind_at ASC
      LIMIT 50
    `;
  } catch (err) {
    console.log("Fetching due reminders failed:", err.message);
    return Response.json({ error: "Could not fetch reminders." }, { status: 500 });
  }

  let sentCount = 0;
  for (const reminder of dueReminders) {
    try {
      await sendOneSignalPush(reminder.onesignal_id, "⏰ Robert Reminder", reminder.content);
      await sql`UPDATE reminders SET sent = TRUE WHERE id = ${reminder.id}`;
      sentCount++;
    } catch (err) {
      console.log(`Failed to send reminder ${reminder.id}:`, err.message);
    }
  }

  return Response.json({ checked: dueReminders.length, sent: sentCount });
}
