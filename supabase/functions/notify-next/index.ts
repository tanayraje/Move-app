// Sends a push notification before each upcoming timeline item.
// Called every minute by pg_cron (see the push_notifications migration).
// Lead times: flights and trains 2 hours before, everything else 15 minutes before.
// Deploy:  supabase functions deploy notify-next --no-verify-jwt
//          (it checks its own x-cron-secret header, or a user JWT for the test ping)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const LONG_LEAD_MIN = 120; // flights, trains
const SHORT_LEAD_MIN = 15; // everything else
const CATCH_UP_MIN = 10; // still send if a run was missed by up to this long

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Offset (ms) of a time zone at a given instant: local wall clock minus UTC.
function tzOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - at.getTime();
}

// "2026-11-04" + "14:30" read as wall-clock time in tz -> real instant.
function localToInstant(date: string, time: string, tz: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time || "");
  if (!date || !m) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, Number(m[1]), Number(m[2]));
  let ts = guess - tzOffsetMs(tz, new Date(guess));
  ts = guess - tzOffsetMs(tz, new Date(ts)); // second pass settles DST edges
  return new Date(ts);
}

function leadFor(item: any): number {
  if (item.element_type === "travel" && (item.travel_type === "flight" || item.travel_type === "train")) return LONG_LEAD_MIN;
  return SHORT_LEAD_MIN;
}

function inWords(min: number) {
  if (min >= 60) {
    const h = Math.round(min / 60);
    return `${h} hr`;
  }
  return `${min} min`;
}

function messageFor(item: any, tripName: string, lead: number) {
  const when = inWords(lead);
  const time = (item.start_time || "").slice(0, 5);
  const route = item.from_location && item.to_location ? `${item.from_location} → ${item.to_location}` : "";
  let title: string;
  let detail: string;
  switch (item.element_type) {
    case "travel": {
      const mode = item.travel_type ? item.travel_type[0].toUpperCase() + item.travel_type.slice(1) : "Travel";
      title = item.to_location ? `${mode} to ${item.to_location} in ${when}` : `${item.title || mode} in ${when}`;
      detail = [route, `departs ${time}`].filter(Boolean).join(" · ");
      break;
    }
    case "accommodation":
      title = `Check-in at ${item.title || item.location || "your stay"} in ${when}`;
      detail = [item.location, time].filter(Boolean).join(" · ");
      break;
    case "meal": {
      const meal = item.meal_sub_type ? item.meal_sub_type[0].toUpperCase() + item.meal_sub_type.slice(1) : "Meal";
      title = `${meal} in ${when}`;
      detail = [item.title, item.location, time].filter(Boolean).join(" · ");
      break;
    }
    default:
      title = `${item.title || "Next up"} in ${when}`;
      detail = [item.location, time].filter(Boolean).join(" · ");
  }
  return { title, body: [detail, tripName].filter(Boolean).join("\n") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: secrets, error: secErr } = await db.from("app_secrets").select("name, value");
  if (secErr) return json({ error: secErr.message }, 500);
  const secret = (n: string) => secrets?.find(s => s.name === n)?.value ?? "";
  const body = await req.json().catch(() => ({}));
  const fromCron = !!req.headers.get("x-cron-secret") && req.headers.get("x-cron-secret") === secret("cron_secret");

  // Test mode: a signed-in user can send one sample notification to their own devices.
  let testUserId: string | null = null;
  if (!fromCron && body?.test) {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = await db.auth.getUser(token);
    testUserId = data?.user?.id ?? null;
  }
  if (!fromCron && !testUserId) return json({ error: "unauthorized" }, 401);
  if (testUserId) body.user_id = testUserId;

  webpush.setVapidDetails("mailto:hello@move-itenerary.vercel.app", secret("vapid_public"), secret("vapid_private"));

  const { data: subs, error: subErr } = await db.from("push_subscriptions").select("*").order("created_at");
  if (subErr) return json({ error: subErr.message }, 500);
  if (!subs?.length) return json({ sent: 0, reason: "no subscriptions" });

  const byUser = new Map<string, any[]>();
  for (const s of subs) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  const now = Date.now();
  let sent = 0;
  const removed: string[] = [];

  const push = async (s: any, payload: unknown) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 30, urgency: "high" },
      );
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        removed.push(s.endpoint);
        await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      } else {
        console.error("push failed", e?.statusCode, e?.body ?? String(e));
      }
    }
  };

  if (body?.test && body?.user_id) {
    for (const s of byUser.get(body.user_id) ?? []) {
      await push(s, { title: "Notifications are on", body: "Move will remind you before each item on your timeline.", url: "/" });
    }
    return json({ sent, removed });
  }

  // Look a few days either side of today so every time zone is covered.
  const from = new Date(now - 2 * 86400000).toISOString().slice(0, 10);
  const to = new Date(now + 2 * 86400000).toISOString().slice(0, 10);

  for (const [userId, userSubs] of byUser) {
    const tz = userSubs[userSubs.length - 1].tz || "Asia/Kolkata"; // most recent device's zone

    const [{ data: owned }, { data: memberOf }] = await Promise.all([
      db.from("trips").select("id, name, status").eq("owner_id", userId),
      db.from("trip_members").select("trip_id").eq("user_id", userId).eq("status", "active"),
    ]);
    const tripIds = new Set<string>([...(owned ?? []).map(t => t.id), ...(memberOf ?? []).map(m => m.trip_id)]);
    if (!tripIds.size) continue;

    const { data: trips } = await db.from("trips").select("id, name, status").in("id", [...tripIds]);
    const live = (trips ?? []).filter(t => (t.status ?? "active") === "active");
    if (!live.length) continue;
    const tripName = new Map(live.map(t => [t.id, t.name]));

    const { data: items } = await db
      .from("itinerary_items")
      .select("id, trip_id, element_type, travel_type, title, location, from_location, to_location, date, start_time, meal_sub_type")
      .in("trip_id", live.map(t => t.id))
      .gte("date", from)
      .lte("date", to);

    for (const item of items ?? []) {
      const start = localToInstant(item.date, item.start_time, tz);
      if (!start) continue;
      const lead = leadFor(item);
      const fireAt = start.getTime() - lead * 60000;
      if (fireAt > now || now - fireAt > CATCH_UP_MIN * 60000) continue;

      // Claim it first so overlapping runs never double-send.
      const { error: claimErr } = await db
        .from("push_sent")
        .insert({ item_id: item.id, user_id: userId, fire_at: new Date(fireAt).toISOString() });
      if (claimErr) continue; // already sent (primary key conflict)

      const msg = messageFor(item, tripName.get(item.trip_id) ?? "", lead);
      for (const s of userSubs) {
        await push(s, { ...msg, url: `/trip/${item.trip_id}/itinerary`, tag: `item-${item.id}` });
      }
    }
  }

  // Keep the sent log small.
  await db.from("push_sent").delete().lt("sent_at", new Date(now - 7 * 86400000).toISOString());

  return json({ sent, removed });
});
