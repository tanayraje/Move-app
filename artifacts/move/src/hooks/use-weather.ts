import { useQueries } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudLightning, Snowflake } from "lucide-react";
import { Trip } from "@/lib/types";
import { safeParseDate } from "@/lib/utils";

// Weather for a trip, from Open-Meteo (free, no API key, no signup).
// Dates within FORECAST_WINDOW days use the real forecast. Later dates use "typical" weather:
// the average of the same calendar days over the last CLIMATE_YEARS years.

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "storm" | "snow";
export type WeatherSource = "forecast" | "typical";

export type DayWeather = {
  date: string;
  city: string;
  high: number;
  low: number;
  kind: WeatherKind;
  source: WeatherSource;
  rainFrom?: string; // "2 pm", forecast only
};

// Consecutive days in the same city, summarised
export type CityStretch = {
  city: string;
  from: string;
  to: string;
  high: number;
  low: number;
  kind: WeatherKind;
  source: WeatherSource;
};

const FORECAST_WINDOW = 14;
const CLIMATE_YEARS = 5;
const FORECAST_TTL = 3 * 60 * 60 * 1000;

export const WEATHER_ICONS: Record<WeatherKind, React.ElementType> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  storm: CloudLightning,
  snow: Snowflake,
};

// WMO weather codes, as used by Open-Meteo
function kindFromCode(code: number): WeatherKind {
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

const WET: WeatherKind[] = ["drizzle", "rain", "storm"];

function avg(list: number[]) {
  return list.length ? list.reduce((s, n) => s + n, 0) / list.length : 0;
}

function mode<T>(list: T[], fallback: T): T {
  const counts = new Map<T, number>();
  list.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1));
  let best = fallback;
  let top = 0;
  counts.forEach((n, v) => {
    if (n > top) {
      top = n;
      best = v;
    }
  });
  return best;
}

function hourLabel(h: number) {
  return `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
}

// Browser storage for things that never change (city coordinates, typical weather).
// Wrapped so private windows or blocked storage never break the app.
function readStore<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: skip caching */
  }
}

type Place = { lat: number; lon: number };
type Climate = Record<string, { high: number; low: number; kind: WeatherKind }>; // keyed by "MM-dd"
type Forecast = Record<string, { high: number; low: number; kind: WeatherKind; rainFrom?: string }>; // keyed by "yyyy-MM-dd"

// City name to coordinates. The hint (trip state or country) picks the right Mumbai.
async function geocode(city: string, hint: string): Promise<Place | null> {
  const key = `move-geo:${city.toLowerCase()}|${hint.toLowerCase()}`;
  const cached = readStore<Place>(key);
  if (cached) return cached;

  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`
  );
  if (!res.ok) return null;
  const results: any[] = (await res.json()).results ?? [];
  if (!results.length) return null;

  const h = hint.toLowerCase();
  const best =
    (h && results.find(r => [r.admin1, r.country].some((v?: string) => v?.toLowerCase() === h))) || results[0];
  const place = { lat: best.latitude, lon: best.longitude };
  writeStore(key, place);
  return place;
}

// Typical weather for every day of the year at this place. Fetched once, kept forever.
async function climate(p: Place): Promise<Climate | null> {
  const lastYear = new Date().getFullYear() - 1;
  const key = `move-climate:${p.lat.toFixed(2)},${p.lon.toFixed(2)}|${lastYear}`;
  const cached = readStore<Climate>(key);
  if (cached) return cached;

  const res = await fetch(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${p.lat}&longitude=${p.lon}` +
      `&start_date=${lastYear - CLIMATE_YEARS + 1}-01-01&end_date=${lastYear}-12-31` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`
  );
  if (!res.ok) return null;
  const d = (await res.json()).daily;
  if (!d?.time) return null;

  const byDay: Record<string, { hi: number[]; lo: number[]; kinds: WeatherKind[] }> = {};
  d.time.forEach((t: string, i: number) => {
    const hi = d.temperature_2m_max[i];
    const lo = d.temperature_2m_min[i];
    const code = d.weather_code[i];
    if (hi == null || lo == null) return;
    const md = t.slice(5);
    if (!byDay[md]) byDay[md] = { hi: [], lo: [], kinds: [] };
    byDay[md].hi.push(hi);
    byDay[md].lo.push(lo);
    if (code != null) byDay[md].kinds.push(kindFromCode(code));
  });

  // Smooth each day with the 3 days either side so one odd year doesn't skew it
  const keys = Object.keys(byDay).sort();
  const table: Climate = {};
  keys.forEach((md, idx) => {
    const win = [-3, -2, -1, 0, 1, 2, 3].map(o => byDay[keys[(idx + o + keys.length) % keys.length]]);
    table[md] = {
      high: Math.round(avg(win.flatMap(w => w.hi))),
      low: Math.round(avg(win.flatMap(w => w.lo))),
      kind: mode(win.flatMap(w => w.kinds), "clear" as WeatherKind),
    };
  });
  writeStore(key, table);
  return table;
}

// Real forecast for the next 16 days, plus the first rainy hour of each day
async function forecast(p: Place): Promise<Forecast | null> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code&hourly=precipitation_probability` +
      `&forecast_days=16&timezone=auto`
  );
  if (!res.ok) return null;
  const json = await res.json();
  const d = json.daily;
  const h = json.hourly;
  if (!d?.time) return null;

  const out: Forecast = {};
  d.time.forEach((t: string, i: number) => {
    if (d.temperature_2m_max[i] == null || d.temperature_2m_min[i] == null) return;
    out[t] = {
      high: Math.round(d.temperature_2m_max[i]),
      low: Math.round(d.temperature_2m_min[i]),
      kind: kindFromCode(d.weather_code[i] ?? 3),
    };
  });

  // First hour between 6 am and 10 pm with a 50% or higher chance of rain
  h?.time?.forEach((t: string, i: number) => {
    const day = out[t.slice(0, 10)];
    const hour = Number(t.slice(11, 13));
    if (!day || day.rainFrom || hour < 6 || hour > 22) return;
    if ((h.precipitation_probability[i] ?? 0) >= 50) {
      day.rainFrom = hourLabel(hour);
      if (!WET.includes(day.kind)) day.kind = "rain";
    }
  });
  return out;
}

async function loadCity(city: string, hint: string, needForecast: boolean, needClimate: boolean) {
  const place = await geocode(city, hint);
  if (!place) return null;
  const [f, c] = await Promise.all([
    needForecast ? forecast(place).catch(() => null) : Promise.resolve(null),
    needClimate ? climate(place).catch(() => null) : Promise.resolve(null),
  ]);
  return { forecast: f, climate: c };
}

/**
 * Weather for every remaining day of a trip.
 * byDate: one entry per date (used by the Timeline header).
 * stretches: one entry per city visit, in trip order (used by the Overview tile).
 * Days without a city use the previous day's city. Past days, wishlist trips and
 * failed lookups simply have no entry, so the UI hides weather for them.
 */
export function useTripWeather(trip: Trip) {
  const now = new Date();
  const hint = trip.state || trip.destination || "";
  const isWishlist = trip.status === "wishlist";
  const start = safeParseDate(trip.startDate);
  const end = safeParseDate(trip.endDate);

  const days: { date: string; city: string; forecast: boolean }[] = [];
  if (!isWishlist && start && end) {
    let lastCity = "";
    const total = differenceInCalendarDays(end, start);
    for (let i = 0; i <= total; i++) {
      const day = addDays(start, i);
      const date = format(day, "yyyy-MM-dd");
      lastCity = (trip.dayCities?.[date] || lastCity).trim();
      const ahead = differenceInCalendarDays(day, now);
      if (ahead < 0 || !lastCity) continue;
      days.push({ date, city: lastCity, forecast: ahead <= FORECAST_WINDOW });
    }
  }

  const cities = Array.from(new Set(days.map(d => d.city)));
  const results = useQueries({
    queries: cities.map(city => {
      const needForecast = days.some(d => d.city === city && d.forecast);
      const needClimate = days.some(d => d.city === city && !d.forecast);
      return {
        queryKey: ["weather", city.toLowerCase(), hint.toLowerCase(), needForecast, needClimate],
        queryFn: () => loadCity(city, hint, needForecast, needClimate),
        staleTime: FORECAST_TTL,
        retry: 1,
      };
    }),
  });

  const byDate: Record<string, DayWeather> = {};
  days.forEach(d => {
    const data = results[cities.indexOf(d.city)]?.data;
    if (!data) return;
    const f = d.forecast ? data.forecast?.[d.date] : undefined;
    if (f) {
      byDate[d.date] = { date: d.date, city: d.city, ...f, source: "forecast" };
      return;
    }
    const c = data.climate?.[d.date.slice(5)];
    if (c) byDate[d.date] = { date: d.date, city: d.city, ...c, source: "typical" };
  });

  const stretches: CityStretch[] = [];
  let run: DayWeather[] = [];
  const flush = () => {
    if (!run.length) return;
    stretches.push({
      city: run[0].city,
      from: run[0].date,
      to: run[run.length - 1].date,
      high: Math.round(avg(run.map(r => r.high))),
      low: Math.round(avg(run.map(r => r.low))),
      kind: mode(run.map(r => r.kind), run[0].kind),
      source: run.some(r => r.source === "typical") ? "typical" : "forecast",
    });
    run = [];
  };
  days.forEach(d => {
    const w = byDate[d.date];
    if (!w) return;
    if (run.length && run[0].city !== w.city) flush();
    run.push(w);
  });
  flush();

  return { byDate, stretches };
}