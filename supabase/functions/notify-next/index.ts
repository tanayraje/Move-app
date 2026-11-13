// Sends a push notification before each upcoming timeline item.
// Called every minute by pg_cron (see the push_notifications migration).
// Lead times: flights and trains 2 hours before, everything else 15 minutes before.
// Item times are local time at the place, so each item's time zone comes from the
// place it happens in (see zoneCandidates in time.ts), not from the user's phone.
// Deploy:  supabase functions deploy notify-next --no-verify-jwt
//          (it checks its own x-cron-secret header, or a user JWT for the test ping)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { fireInstant, isValidZone, leadFor, zoneCandidates } from "./time.ts";

const CATCH_UP_MIN = 10; // still send if a run was missed by up to this long

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Finds the time zone of a named place (Open-Meteo geocoding, free, no key).
// hint is the trip's state and destination, used to pick between places that share a name.
async function lookupZone(name: string, hint: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const results: any[] = (await res.json())?.results ?? [];
    if (!results.length) return null;
    const h = hint.toLowerCase();
    const match = results.find(r =>
      [r.country, r.admin1].some((part: unknown) => typeof part === "string" && part && h.includes(part.toLowerCase()))
    );
    const tz = (match ?? results[0]).timezone;
    return isValidZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

// Survives between runs while the function instance stays warm. "" means "looked up, nothing found".
const zoneMemory = new Map<string, string>();

function inWords(min: number) {
  if (min >= 60) {
    const h = Math.round(min / 60);
    return `${h} hr`;
  }
  return `${min} min`;
}

// "14:05" -> "2:05 PM"
function to12h(hhmm: string) {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hhmm;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

function messageFor(item: any, tripName: string, lead: number) {
  const when = inWords(lead);
  const time = to12h((item.start_time || "").slice(0, 5));
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

  // Place name -> time zone, kept in public.city_timezones so each place is looked up once.
  // If that table is not there yet, the in-memory copy still avoids repeat lookups.
  const { data: savedZones } = await db.from("city_timezones").select("name, tz");
  for (const row of savedZones ?? []) zoneMemory.set(row.name, row.tz ?? "");

  const zoneOfPlace = async (name: string, hint: string): Promise<string | null> => {
    const key = name.toLowerCase();
    if (zoneMemory.has(key)) return zoneMemory.get(key) || null;
    const tz = await lookupZone(name, hint);
    zoneMemory.set(key, tz ?? "");
    await db.from("city_timezones").upsert({ name: key, tz });
    return tz;
  };

  const zoneOfItem = async (item: any, trip: any, deviceZone: string): Promise<string> => {
    const hint = [trip?.state, trip?.destination].filter(Boolean).join(" ");
    for (const name of zoneCandidates(item, trip ?? {})) {
      const tz = await zoneOfPlace(name, hint);
      if (tz) return tz;
    }
    return deviceZone; // no place could be resolved: fall back to the phone's zone
  };

  // Look a few days either side of today so every time zone is covered.
  const from = new Date(now - 2 * 86400000).toISOString().slice(0, 10);
  const to = new Date(now + 2 * 86400000).toISOString().slice(0, 10);

  for (const [userId, userSubs] of byUser) {
    // Last resort only, for items whose place cannot be resolved.
    const lastZone = userSubs[userSubs.length - 1].tz;
    const deviceZone = isValidZone(lastZone) ? lastZone : "Asia/Kolkata";

    const [{ data: owned }, { data: memberOf }] = await Promise.all([
      db.from("trips").select("id, name, status").eq("owner_id", userId),
      db.from("trip_members").select("trip_id").eq("user_id", userId).eq("status", "active"),
    ]);
    const tripIds = new Set<string>([...(owned ?? []).map(t => t.id), ...(memberOf ?? []).map(m => m.trip_id)]);
    if (!tripIds.size) continue;

    const { data: trips } = await db
      .from("trips")
      .select("id, name, status, destination, state, day_cities")
      .in("id", [...tripIds]);
    const live = (trips ?? []).filter(t => (t.status ?? "active") === "active");
    if (!live.length) continue;
    const tripName = new Map(live.map(t => [t.id, t.name]));
    const tripById = new Map(live.map(t => [t.id, t]));

    const { data: items } = await db
      .from("itinerary_items")
      .select("id, trip_id, element_type, travel_type, title, location, from_location, to_location, date, start_time, meal_sub_type")
      .in("trip_id", live.map(t => t.id))
      .gte("date", from)
      .lte("date", to);

    for (const item of items ?? []) {
      if (!item.start_time) continue;
      const tz = await zoneOfItem(item, tripById.get(item.trip_id), deviceZone);
      const fire = fireInstant(item, tz);
      if (!fire) continue;
      const lead = leadFor(item);
      const fireAt = fire.getTime();
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
