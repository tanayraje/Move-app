import { supabase } from "@/lib/supabase";

/**
 * Photo for a city (used only by the Timeline header, so each day shows its own city).
 * Resolved by the `city-image` edge function; cached in memory and localStorage per city.
 * Returns null when nothing is found or the function is not deployed, so callers can fall back.
 */
const memory = new Map<string, string>();
const keyFor = (city: string, hint?: string) =>
  `move-city-img:${city.trim().toLowerCase()}|${(hint ?? "").trim().toLowerCase()}`;

export async function fetchCityImage(city: string, hint?: string): Promise<string | null> {
  const key = keyFor(city, hint);
  const hit = memory.get(key);
  if (hit) return hit;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      memory.set(key, stored);
      return stored;
    }
  } catch {
    /* storage unavailable */
  }

  const { data, error } = await supabase.functions.invoke("city-image", {
    body: { city: city.trim(), hint },
  });
  const url = !error && data && typeof data.image === "string" ? data.image : null;
  if (url) {
    memory.set(key, url);
    try {
      localStorage.setItem(key, url);
    } catch {
      /* ignore */
    }
  }
  return url;
}
