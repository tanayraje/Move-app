/**
 * Times are stored as 24-hour "HH:mm" strings (database + sorting), but always
 * shown and entered as 12-hour time with AM / PM.
 */

export type Period = "AM" | "PM";

/** "14:05" -> { hour: 2, minute: 5, period: "PM" }. Returns null for empty/invalid input. */
export function splitTime(hhmm: string | undefined | null): { hour: number; minute: number; period: Period } | null {
  if (!hhmm) return null;
  const match = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { hour: h % 12 === 0 ? 12 : h % 12, minute: m, period: h >= 12 ? "PM" : "AM" };
}

/** (2, 5, "PM") -> "14:05" */
export function joinTime(hour: number, minute: number, period: Period): string {
  let h = hour % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "14:05" -> "2:05 PM". Empty or invalid input returns the fallback. */
export function formatTime12(hhmm: string | undefined | null, fallback = ""): string {
  const t = splitTime(hhmm);
  if (!t) return fallback;
  return `${t.hour}:${String(t.minute).padStart(2, "0")} ${t.period}`;
}

/** Date -> "2:05 PM" */
export function formatDateTime12(d: Date): string {
  return formatTime12(`${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
}
