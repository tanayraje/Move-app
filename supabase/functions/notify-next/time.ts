// Pure time and zone helpers for notify-next. No Deno or npm imports here, so
// the app's test suite can run this file as it is.

export const LONG_LEAD_MIN = 120; // flights, trains
export const SHORT_LEAD_MIN = 15; // everything else

export interface ZoneItem {
  element_type?: string | null;
  travel_type?: string | null;
  date: string;
  start_time?: string | null;
  from_location?: string | null;
}

export interface ZoneTrip {
  day_cities?: Record<string, string> | null;
  state?: string | null;
  destination?: string | null;
}

export function isValidZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Offset (ms) of a time zone at a given instant: local wall clock minus UTC.
export function tzOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - at.getTime();
}

// "2026-11-04" + "14:30" read as wall-clock time in tz -> real instant.
export function localToInstant(date: string, time: string | null | undefined, tz: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time || "");
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || "");
  if (!d || !m) return null;
  const guess = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(m[1]), Number(m[2]));
  let ts = guess - tzOffsetMs(tz, new Date(guess));
  ts = guess - tzOffsetMs(tz, new Date(ts)); // second pass settles DST edges
  return new Date(ts);
}

export function leadFor(item: ZoneItem): number {
  if (item.element_type === "travel" && (item.travel_type === "flight" || item.travel_type === "train")) return LONG_LEAD_MIN;
  return SHORT_LEAD_MIN;
}

/** The real-world moment the reminder for this item should go out, or null if it has no usable time. */
export function fireInstant(item: ZoneItem, tz: string): Date | null {
  const start = localToInstant(item.date, item.start_time, tz);
  if (!start) return null;
  return new Date(start.getTime() - leadFor(item) * 60000);
}

/** "Delhi (DEL)" -> "Delhi". Bare codes like "DEL" are kept as they are. */
export function cleanPlaceName(value: string | null | undefined): string {
  return (value || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

function previousDate(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Place names to try, in order, when working out which time zone an item's
 * clock time is in. Item times are entered as local time at the place.
 *
 * - Travel leaves from somewhere: the "from" place first, then the city of the
 *   day before (where you woke up), then the day's own city.
 * - Everything else happens in the day's city.
 * - The trip's state and destination are the last named places tried.
 */
export function zoneCandidates(item: ZoneItem, trip: ZoneTrip): string[] {
  const cities = trip.day_cities || {};
  const names: string[] = [];
  if (item.element_type === "travel") {
    names.push(cleanPlaceName(item.from_location));
    names.push(cleanPlaceName(cities[previousDate(item.date)]));
  }
  names.push(cleanPlaceName(cities[item.date]));
  names.push(cleanPlaceName(trip.state));
  names.push(cleanPlaceName(trip.destination));
  return [...new Set(names.filter(Boolean))];
}
