import webpush from "web-push";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error("Push worker secrets are not configured");
webpush.setVapidDetails("mailto:admin@strangerchat.world", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };
const response = await fetch(`${SUPABASE_URL}/rest/v1/chat_open_reminders?select=id,endpoint,p256dh,auth&channel=eq.browser&endpoint=not.is.null&limit=1000`, { headers });
if (!response.ok) throw new Error(`Could not read push subscriptions: ${response.status} ${await response.text()}`);
const subscriptions = await response.json();
const payload = JSON.stringify({ title: "Stranger Chat", body: "Phòng chat đã mở cửa. Vào trò chuyện ngay!", url: "https://strangerchat.world/" });
let sent = 0;
for (const row of subscriptions) {
  try { await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload); sent += 1; }
  catch (error) {
    const status = error?.statusCode;
    if (status === 404 || status === 410) await fetch(`${SUPABASE_URL}/rest/v1/chat_open_reminders?id=eq.${row.id}`, { method: "DELETE", headers });
    console.warn(`Push failed for ${row.id}: ${status || error.message}`);
  }
}
console.log(`Push delivery complete: ${sent}/${subscriptions.length}`);
