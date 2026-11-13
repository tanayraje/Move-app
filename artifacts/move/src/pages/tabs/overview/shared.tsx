import React, { useEffect, useRef, useState } from "react";
import { differenceInCalendarDays, addDays } from "date-fns";
import { Trip } from "@/lib/types";
import { Plane, Train, Bus, Car } from "lucide-react";
import { safeParseDate } from "@/lib/utils";


// iOS widget feel: unhurried, with a very slight settle at the end
export const widgetSpring = { type: "spring", duration: 0.65, bounce: 0.12 } as const;
/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export const card = "rounded-[22px] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]";

// Trips whose Overview already animated in this session. Coming back to the tab does not replay it.
export const seenTrips = new Set<string>();

export function useFirstView(tripId: string) {
  const first = useRef(!seenTrips.has(tripId)).current;
  useEffect(() => {
    seenTrips.add(tripId);
  }, [tripId]);
  return first;
}

export function useNow(ms = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Counts up from 0 on first open only.
export function useCountUp(target: number, enabled: boolean, duration = 900) {
  const [value, setValue] = useState(enabled && !prefersReducedMotion() ? 0 : target);
  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let raf = 0;
    const startedAt = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, duration]);
  return value;
}

// Eased 0 to 1 over a few seconds on first open. Already 1 on later visits and with reduced motion.
export function useProgress(enabled: boolean, duration = 3200) {
  const [value, setValue] = useState(enabled && !prefersReducedMotion() ? 0 : 1);
  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setValue(1);
      return;
    }
    let raf = 0;
    const startedAt = performance.now();
    const tick = (t: number) => {
      const x = Math.min((t - startedAt) / duration, 1);
      setValue(0.5 - Math.cos(Math.PI * x) / 2);
      if (x < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, duration]);
  return value;
}

export function Rise({ i, first, className = "", children }: { i: number; first: boolean; className?: string; children: React.ReactNode }) {  return (
    <div className={`${first ? "ov-rise" : ""} ${className}`} style={first ? { animationDelay: `${i * 70}ms` } : undefined}>
      {children}
    </div>
  );
}

export function toDate(date: string, time?: string) {
  return new Date(`${date}T${time || "00:00"}`);
}

// An item's start and end. If it ends earlier than it starts (overnight train), it ends the next day.
export function rangeOf(item: any) {
  const start = toDate(item.date, item.startTime);
  let end = toDate(item.date, item.endTime || item.startTime);
  if (end <= start && item.endTime) end = addDays(end, 1);
  return { start, end };
}

export function fmtDuration(mins: number) {
  const m = Math.max(mins, 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${String(r).padStart(2, "0")}m` : `${r}m`;
}

export const CITY_CODES: Record<string, string> = {
  bangalore: "BLR", bengaluru: "BLR", mumbai: "BOM", delhi: "DEL", "new delhi": "DEL", chennai: "MAA",
  kolkata: "CCU", hyderabad: "HYD", pune: "PNQ", goa: "GOI", ahmedabad: "AMD", kochi: "COK", cochin: "COK",
  jaipur: "JAI", lucknow: "LKO", nagpur: "NAG", indore: "IDR", bhopal: "BHO", patna: "PAT", guwahati: "GAU",
  srinagar: "SXR", chandigarh: "IXC", thiruvananthapuram: "TRV", trivandrum: "TRV", coimbatore: "CJB",
  visakhapatnam: "VTZ", bhubaneswar: "BBI", varanasi: "VNS", udaipur: "UDR", aurangabad: "IXU", nashik: "ISK",
  kolhapur: "KLH", mangalore: "IXE", mangaluru: "IXE", madurai: "IXM", ranchi: "IXR", raipur: "RPR",
  dehradun: "DED", leh: "IXL", amritsar: "ATQ", surat: "STV", vadodara: "BDQ", rajkot: "RAJ", jodhpur: "JDH",
  "port blair": "IXZ", dubai: "DXB", singapore: "SIN", bangkok: "BKK", london: "LHR",
};

export function cityCode(city: string) {
  const key = city.trim().toLowerCase();
  return CITY_CODES[key] ?? key.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase();
}

// "Flight: Bangalore → Mumbai" -> { from: "Bangalore", to: "Mumbai" }
export function parseRoute(title: string): { from: string; to: string } | null {
  const body = title.includes(":") ? title.slice(title.indexOf(":") + 1) : title;
  const parts = body.split(/\s*(?:→|->|➔|–>|\bto\b)\s*/i).map(s => s.trim()).filter(Boolean);
  return parts.length === 2 ? { from: parts[0], to: parts[1] } : null;
}

export type TravelKind = "flight" | "train" | "bus" | "car";

export function travelKind(item: any): TravelKind {
  const text = `${item.title ?? ""} ${item.subType ?? ""} ${item.travelType ?? ""} ${item.mode ?? ""}`.toLowerCase();
  if (/train|rail|express/.test(text)) return "train";
  if (/\bbus\b|volvo/.test(text)) return "bus";
  if (/\bcar\b|cab|taxi|drive|road/.test(text)) return "car";
  return "flight";
}

export const KIND_ICON = { flight: Plane, train: Train, bus: Bus, car: Car } as const;

/* ------------------------------------------------------------------ */
/* Stays                                                               */
/* ------------------------------------------------------------------ */

export type Stay = { id: string; name: string; checkIn: Date; checkOut: Date; nights: number };

// One stay per accommodation item. Check-in is the item's date and start time.
// Check-out is the item's own end date if it has one, otherwise the next stay's date, otherwise the trip end.
export function buildStays(itinerary: any[], trip: Trip): Stay[] {
  const acc = itinerary
    .filter(i => i.elementType === "accommodation" && i.date)
    .sort((a, b) => `${a.date}T${a.startTime || "00:00"}`.localeCompare(`${b.date}T${b.startTime || "00:00"}`));

  return acc.map((i, idx) => {
    const checkIn = toDate(i.date, i.startTime || "14:00");
    const explicit = i.endDate ?? i.checkOutDate ?? i.checkoutDate;
    const outDay = safeParseDate(explicit || acc[idx + 1]?.date || trip.endDate) ?? addDays(checkIn, 1);
    let nights = differenceInCalendarDays(outDay, checkIn);
    if (nights < 1) nights = 1;
    const checkOutDay = addDays(new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate()), nights);
    const [h, m] = (i.endTime || "11:00").split(":").map(Number);
    const checkOut = new Date(checkOutDay.getFullYear(), checkOutDay.getMonth(), checkOutDay.getDate(), h || 11, m || 0);
    return { id: String(i.id ?? idx), name: i.title, checkIn, checkOut, nights };
  });
}

export type StayStage = "compact" | "line" | "during" | "checkout" | "done";

export function stayStage(stay: Stay, now: Date, tripFar: boolean): StayStage {
  if (now >= stay.checkOut) return "done";
  if (now >= stay.checkIn) {
    return differenceInCalendarDays(stay.checkOut, now) === 0 ? "checkout" : "during";
  }
  return tripFar ? "compact" : "line";
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

export function Chip({ tone, children }: { tone: "blue" | "green" | "violet" | "amber" | "grey" | "pink"; children: React.ReactNode }) {
  const tones = {
    blue: "bg-blue-500/15 border-blue-500/30 text-foreground",
    green: "bg-emerald-500/15 border-emerald-500/30 text-foreground",
    violet: "bg-violet-500/15 border-violet-500/30 text-foreground",
    amber: "bg-amber-500/15 border-amber-500/30 text-foreground",
    grey: "bg-foreground/5 text-muted-foreground border-foreground/10",
    pink: "bg-pink-500/15 border-pink-500/30 text-foreground",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>
  );
}

export function DayStrip({ totalDays, currentDay, tone, wave = false }: { totalDays: number; currentDay: number; tone: "blue" | "green"; wave?: boolean }) {
  const segs = Math.min(Math.max(totalDays, 1), 14);
  const cur = Math.min(Math.floor((currentDay * segs) / Math.max(totalDays, 1)), segs - 1);
  const on = tone === "green" ? "bg-emerald-500" : "bg-primary";
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${segs}, minmax(0, 1fr))` }}>
      {Array.from({ length: segs }).map((_, i) => {
        const filled = wave || i < cur;
        const isCur = !wave && i === cur;
        return (
          <div
            key={i}
            className={`h-1 rounded-full ${filled || isCur ? on : "bg-foreground/10"} ${isCur ? "ov-glow" : ""} ${wave ? "ov-wave" : ""}`}
            style={wave ? { animationDelay: `${i * 60}ms` } : undefined}
          />
        );
      })}
    </div>
  );
}
