import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, differenceInMinutes, format, addDays } from "date-fns";
import { useItinerary, useExpenses, useDocuments, usePlaces } from "@/hooks/use-store";
import { Trip } from "@/lib/types";
import { HeroScrim } from "@/components/ui";
import {
  Calendar, FileText, Receipt, MapPin, Plane, Clock, Heart, Building2, UtensilsCrossed, Bike,
  Train, Bus, Car, BedDouble, Plus,
} from "lucide-react";
import { formatCurrency } from "@/lib/countries";
import { safeFormatDate, safeParseDate } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import TripMap from "@/components/TripMap";
import "./overview-motion.css";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const card = "rounded-[22px] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]";

// Trips whose Overview already animated in this session. Coming back to the tab does not replay it.
const seenTrips = new Set<string>();

function useFirstView(tripId: string) {
  const first = useRef(!seenTrips.has(tripId)).current;
  useEffect(() => {
    seenTrips.add(tripId);
  }, [tripId]);
  return first;
}

function useNow(ms = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Counts up from 0 on first open only.
function useCountUp(target: number, enabled: boolean, duration = 900) {
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

function Rise({ i, first, className = "", children }: { i: number; first: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={`${first ? "ov-rise" : ""} ${className}`} style={first ? { animationDelay: `${i * 70}ms` } : undefined}>
      {children}
    </div>
  );
}

function toDate(date: string, time?: string) {
  return new Date(`${date}T${time || "00:00"}`);
}

// An item's start and end. If it ends earlier than it starts (overnight train), it ends the next day.
function rangeOf(item: any) {
  const start = toDate(item.date, item.startTime);
  let end = toDate(item.date, item.endTime || item.startTime);
  if (end <= start && item.endTime) end = addDays(end, 1);
  return { start, end };
}

function fmtDuration(mins: number) {
  const m = Math.max(mins, 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${String(r).padStart(2, "0")}m` : `${r}m`;
}

const CITY_CODES: Record<string, string> = {
  bangalore: "BLR", bengaluru: "BLR", mumbai: "BOM", delhi: "DEL", "new delhi": "DEL", chennai: "MAA",
  kolkata: "CCU", hyderabad: "HYD", pune: "PNQ", goa: "GOI", ahmedabad: "AMD", kochi: "COK", cochin: "COK",
  jaipur: "JAI", lucknow: "LKO", nagpur: "NAG", indore: "IDR", bhopal: "BHO", patna: "PAT", guwahati: "GAU",
  srinagar: "SXR", chandigarh: "IXC", thiruvananthapuram: "TRV", trivandrum: "TRV", coimbatore: "CJB",
  visakhapatnam: "VTZ", bhubaneswar: "BBI", varanasi: "VNS", udaipur: "UDR", aurangabad: "IXU", nashik: "ISK",
  kolhapur: "KLH", mangalore: "IXE", mangaluru: "IXE", madurai: "IXM", ranchi: "IXR", raipur: "RPR",
  dehradun: "DED", leh: "IXL", amritsar: "ATQ", surat: "STV", vadodara: "BDQ", rajkot: "RAJ", jodhpur: "JDH",
  "port blair": "IXZ", dubai: "DXB", singapore: "SIN", bangkok: "BKK", london: "LHR",
};

function cityCode(city: string) {
  const key = city.trim().toLowerCase();
  return CITY_CODES[key] ?? key.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase();
}

// "Flight: Bangalore → Mumbai" -> { from: "Bangalore", to: "Mumbai" }
function parseRoute(title: string): { from: string; to: string } | null {
  const body = title.includes(":") ? title.slice(title.indexOf(":") + 1) : title;
  const parts = body.split(/\s*(?:→|->|➔|–>|\bto\b)\s*/i).map(s => s.trim()).filter(Boolean);
  return parts.length === 2 ? { from: parts[0], to: parts[1] } : null;
}

type TravelKind = "flight" | "train" | "bus" | "car";

function travelKind(item: any): TravelKind {
  const text = `${item.title ?? ""} ${item.subType ?? ""} ${item.travelType ?? ""} ${item.mode ?? ""}`.toLowerCase();
  if (/train|rail|express/.test(text)) return "train";
  if (/\bbus\b|volvo/.test(text)) return "bus";
  if (/\bcar\b|cab|taxi|drive|road/.test(text)) return "car";
  return "flight";
}

const KIND_ICON = { flight: Plane, train: Train, bus: Bus, car: Car } as const;

/* ------------------------------------------------------------------ */
/* Stays                                                               */
/* ------------------------------------------------------------------ */

type Stay = { id: string; name: string; checkIn: Date; checkOut: Date; nights: number };

// One stay per accommodation item. Check-in is the item's date and start time.
// Check-out is the item's own end date if it has one, otherwise the next stay's date, otherwise the trip end.
function buildStays(itinerary: any[], trip: Trip): Stay[] {
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

type StayStage = "compact" | "line" | "during" | "checkout" | "done";

function stayStage(stay: Stay, now: Date, tripFar: boolean): StayStage {
  if (now >= stay.checkOut) return "done";
  if (now >= stay.checkIn) {
    return differenceInCalendarDays(stay.checkOut, now) === 0 ? "checkout" : "during";
  }
  return tripFar ? "compact" : "line";
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Chip({ tone, children }: { tone: "blue" | "green" | "teal" | "amber" | "grey" | "pink"; children: React.ReactNode }) {
  const tones = {
    blue: "bg-blue-500/15 border-blue-500/30 text-foreground",
    green: "bg-emerald-500/15 border-emerald-500/30 text-foreground",
    teal: "bg-teal-500/15 border-teal-500/30 text-foreground",
    amber: "bg-amber-500/15 border-amber-500/30 text-foreground",
    grey: "bg-foreground/5 text-muted-foreground border-foreground/10",
    pink: "bg-pink-500/15 border-pink-500/30 text-foreground",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>
  );
}

function DayStrip({ totalDays, currentDay, tone, wave = false }: { totalDays: number; currentDay: number; tone: "blue" | "green"; wave?: boolean }) {
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

function CountdownCard({ days, start, totalDays, first }: { days: number; start: Date; totalDays: number; first: boolean }) {
  const n = Math.round(useCountUp(days, first));
  return (
    <div className="flex flex-col gap-4 rounded-[26px] bg-gradient-to-br from-primary/15 to-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between">
        <Chip tone="blue">Upcoming</Chip>
        <span className="text-xs text-muted-foreground">Trip starts {format(start, "MMM d")}</span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-[72px] font-bold leading-[68px] tracking-[-3px] text-foreground">{n}</span>
        <span className="text-xl font-medium text-muted-foreground">{days === 1 ? "day to go" : "days to go"}</span>
      </div>
      <div className="flex flex-col gap-2">
        <DayStrip totalDays={totalDays} currentDay={0} tone="blue" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{format(start, "MMM d")} · Day 1</span>
          <span>{format(addDays(start, totalDays - 1), "MMM d")} · Day {totalDays}</span>
        </div>
      </div>
    </div>
  );
}

function NextUpRow({ item, Icon }: { item: any; Icon: any }) {
  return (
    <div className={`${card} flex h-[72px] items-center gap-3 px-4`}>
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
          Next up · {safeFormatDate(item.date, (d: Date) => format(d, "MMM d"), item.date)}
        </p>
        <p className="truncate text-[15px] font-semibold text-foreground">{item.title}</p>
      </div>
      {item.startTime && <span className="text-[13px] text-muted-foreground">{item.startTime}</span>}
    </div>
  );
}

function TicketCard({ item, route, now }: { item: any; route: { from: string; to: string }; now: Date }) {
  const { start, end } = rangeOf(item);
  const kind = travelKind(item);
  const KindIcon = KIND_ICON[kind];
  const total = Math.max(differenceInMinutes(end, start), 1);
  const inTransit = now >= start && now < end;
  const progress = inTransit ? Math.min(Math.max(differenceInMinutes(now, start) / total, 0.05), 0.95) : 0;
  const dUntil = differenceInCalendarDays(start, now);
  const minsToGo = differenceInMinutes(start, now);
  const dayLabel = dUntil === 0 ? "Today" : dUntil === 1 ? "Tomorrow" : "";
  const useCodes = kind === "flight";
  const fromBig = useCodes ? cityCode(route.from) : route.from;
  const toBig = useCodes ? cityCode(route.to) : route.to;
  const verb = kind === "flight" ? "Lands" : "Arrives";

  let right = `${dayLabel ? dayLabel + " · " : ""}${format(start, "MMM d")}`;
  if (inTransit) right = `${verb} in ${fmtDuration(differenceInMinutes(end, now))}`;
  else if (dUntil === 0 && minsToGo > 0 && minsToGo <= 720) right = `Departs in ${fmtDuration(minsToGo)}`;

  return (
    <div className={`${card} !rounded-[24px] overflow-hidden`}>
      <div className="flex flex-col gap-3 px-5 pb-3 pt-4">
        <div className="flex items-center justify-between">
          {inTransit ? (
            <Chip tone="green">
              <span className="ov-dot-green h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {kind === "flight" ? "In flight" : "In transit"}
            </Chip>
          ) : dUntil === 0 ? (
            <Chip tone="blue">Today</Chip>
          ) : (
            <span className="text-xs font-medium uppercase tracking-[0.6px] text-muted-foreground">Next up</span>
          )}
          <span className={`text-[13px] font-semibold ${inTransit ? "text-emerald-500" : "text-muted-foreground"}`}>{right}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className={`${useCodes ? "text-[34px] leading-9" : "max-w-[34%] truncate text-xl leading-9"} font-bold tracking-tight text-foreground`}>{fromBig}</div>
          <div className="relative flex h-7 flex-1 items-center text-muted-foreground/40">
            <div className="ov-track w-full" style={inTransit ? { animation: "none" } : undefined} />
            {inTransit && (
              <div className="absolute left-0 top-[13px] h-[2px] rounded-full bg-emerald-500 transition-[width] duration-1000" style={{ width: `${progress * 100}%` }} />
            )}
            <div
              className={`absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card ${inTransit ? "text-emerald-500" : "ov-plane-idle text-primary"}`}
              style={inTransit ? { left: `${progress * 100}%`, transition: "left 1s linear" } : { left: "50%" }}
            >
              <KindIcon className={`h-[21px] w-[21px] ${kind === "flight" ? "rotate-45" : ""}`} />
            </div>
          </div>
          <div className={`${useCodes ? "text-[34px] leading-9" : "max-w-[34%] truncate text-xl leading-9"} font-bold tracking-tight text-foreground`}>{toBig}</div>
        </div>

        {useCodes && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{route.from}</span>
            <span>{route.to}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t-[1.5px] border-dashed border-foreground/10 bg-foreground/[0.025] px-5 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.5px] text-muted-foreground">Departs</p>
          <p className="text-lg font-bold text-foreground">{item.startTime || format(start, "HH:mm")}</p>
        </div>
        <span className="text-xs text-muted-foreground">{fmtDuration(total)}</span>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.5px] text-muted-foreground">Arrives</p>
          <p className="text-lg font-bold text-foreground">{item.endTime || format(end, "HH:mm")}</p>
        </div>
      </div>
    </div>
  );
}

function OngoingCard({ dayNum, totalDays, nextItem, Icon }: { dayNum: number; totalDays: number; nextItem: any | null; Icon: any }) {
  const last = dayNum >= totalDays;
  return (
    <div className={`${card} !rounded-[24px] flex flex-col gap-3.5 px-5 py-4`}>
      <div className="flex items-center justify-between">
        <Chip tone="green">
          <span className="ov-dot-green h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {last ? "Last day" : "Ongoing"}
        </Chip>
        <span className="text-[13px] font-semibold text-foreground">Day {dayNum} of {totalDays}</span>
      </div>
      <DayStrip totalDays={totalDays} currentDay={dayNum - 1} tone="green" />
      {nextItem && (
        <div className="flex items-center gap-3 border-t border-border pt-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">Next up</p>
            <p className="truncate text-[15px] font-semibold text-foreground">{nextItem.title}</p>
          </div>
          <span className="text-xs text-muted-foreground">
            {nextItem.date === format(new Date(), "yyyy-MM-dd") ? "Today" : safeFormatDate(nextItem.date, (d: Date) => format(d, "MMM d"), nextItem.date)} {nextItem.startTime}
          </span>
        </div>
      )}
    </div>
  );
}

function RecapCard({ start, end, totalDays, spent, items }: { start: Date; end: Date; totalDays: number; spent: number; items: number }) {
  return (
    <div className={`${card} !rounded-[24px] flex flex-col gap-3.5 px-5 py-4`}>
      <div className="flex items-center justify-between">
        <Chip tone="grey">Completed</Chip>
        <span className="text-xs text-muted-foreground">{format(start, "MMM d")} – {format(end, "MMM d")}</span>
      </div>
      <DayStrip totalDays={totalDays} currentDay={totalDays} tone="blue" wave />
      <div className="grid grid-cols-3 border-t border-border pt-3.5">
        <div>
          <p className="font-display text-[22px] font-bold text-foreground">{totalDays}</p>
          <p className="text-xs text-muted-foreground">Days</p>
        </div>
        <div>
          <p className="font-display text-[22px] font-bold text-foreground">{formatCurrency(spent, "INR")}</p>
          <p className="text-xs text-muted-foreground">Spent</p>
        </div>
        <div>
          <p className="font-display text-[22px] font-bold text-foreground">{items}</p>
          <p className="text-xs text-muted-foreground">Timeline items</p>
        </div>
      </div>
    </div>
  );
}

function StayIcon({ tone = "teal", twinkle = true }: { tone?: "teal" | "blue" | "amber"; twinkle?: boolean }) {
  const t = {
    teal: "bg-teal-500/15 text-teal-500",
    blue: "bg-blue-500/15 text-blue-500",
    amber: "bg-amber-500/15 text-amber-500",
  }[tone];
  return (
    <div className={`relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl ${t}`}>
      <BedDouble className="h-5 w-5" />
      {twinkle && <span className="ov-twinkle absolute right-[7px] top-[7px] h-1 w-1 rounded-full bg-teal-200" />}
    </div>
  );
}

function NightDots({ nights, current, amberLast = false }: { nights: number; current: number; amberLast?: boolean }) {
  if (nights > 10) {
    return (
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-teal-500 transition-[width]" style={{ width: `${Math.min(current / nights, 1) * 100}%` }} />
      </div>
    );
  }
  return (
    <div className="grid items-center justify-items-center gap-1.5" style={{ gridTemplateColumns: `repeat(${nights}, minmax(0, 1fr))` }}>
      {Array.from({ length: nights }).map((_, i) => {
        const n = i + 1;
        const isCur = n === current;
        const filled = n < current;
        const amber = amberLast && n === nights;
        return (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              amber ? "bg-amber-500 ov-dot-amber" : isCur ? "bg-teal-500 ov-dot-teal" : filled ? "bg-teal-500" : "bg-foreground/10"
            }`}
          />
        );
      })}
    </div>
  );
}

function StayCard({ stay, now, tripFar, count, index }: { stay: Stay; now: Date; tripFar: boolean; count: number; index: number }) {
  const stage = stayStage(stay, now, tripFar);
  const label = count > 1 ? `Stay · ${index + 1} of ${count}` : "Stay";
  const inDay = format(stay.checkIn, "MMM d");
  const outDay = format(stay.checkOut, "MMM d");
  const nightNo = Math.min(Math.max(differenceInCalendarDays(now, stay.checkIn) + 1, 1), stay.nights);
  const nightsLabel = `${stay.nights} night${stay.nights === 1 ? "" : "s"}`;
  const checkInTime = format(stay.checkIn, "HH:mm");
  const checkOutTime = format(stay.checkOut, "HH:mm");

    if (stage === "compact" || stage === "done") {
    return (
      <div className={`${card} flex h-[72px] items-center gap-3 px-4`}>
        <StayIcon twinkle={stage === "compact"} tone={stage === "done" ? "blue" : "teal"} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">{label} · {nightsLabel}</p>
          <p className="truncate text-[15px] font-semibold text-foreground">{stay.name}</p>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-semibold text-foreground">{inDay} – {format(stay.checkOut, "d")}</p>
          <p className="text-[11px] text-muted-foreground">{stage === "done" ? "Stayed" : `from ${checkInTime}`}</p>
        </div>
      </div>
    );
  }

  if (stage === "line") {
    return (
      <div className={`${card} flex flex-col gap-3.5 px-4 pb-4 pt-3.5`}>
        <div className="flex items-center gap-3">
          <StayIcon />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">{label}</p>
            <p className="truncate text-[15px] font-semibold text-foreground">{stay.name}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="relative flex h-2 items-center">
            <div className="absolute inset-x-1 h-[1.5px] bg-foreground/10" />
            <div className="ov-line-draw absolute inset-x-1 h-[1.5px] bg-teal-500" />
            <span className="absolute left-0 h-2 w-2 rounded-full bg-teal-500" />
            <span className="absolute right-0 h-2 w-2 rounded-full bg-teal-500" />
          </div>
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span><b className="text-[13px] font-semibold text-foreground">{inDay}</b> · {checkInTime}</span>
            <span className="font-semibold text-teal-500">{nightsLabel}</span>
            <span><b className="text-[13px] font-semibold text-foreground">{outDay}</b> · {checkOutTime}</span>
          </div>
        </div>
      </div>
    );
  }

  const isCheckout = stage === "checkout";
  const left = stay.nights - nightNo;
  return (
    <div className={`${card} flex flex-col gap-3 px-4 py-3.5`}>
      <div className="flex items-center gap-3">
        <StayIcon tone={isCheckout ? "amber" : "teal"} twinkle={!isCheckout} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">{label}</p>
          <p className="truncate text-[15px] font-semibold text-foreground">{stay.name}</p>
        </div>
        {isCheckout ? <Chip tone="amber">Check out by {checkOutTime}</Chip> : <Chip tone="teal">Night {nightNo} of {stay.nights}</Chip>}
      </div>
      <div className="flex flex-col gap-2">
        <NightDots nights={stay.nights} current={isCheckout ? stay.nights : nightNo} amberLast={isCheckout} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{isCheckout ? "Last night done" : `${left} night${left === 1 ? "" : "s"} left`}</span>
          <span>{isCheckout ? `Today · ${outDay}` : `Check-out ${outDay} · ${checkOutTime}`}</span>
        </div>
      </div>
    </div>
  );
}

function AddStayCard({ onAdd }: { onAdd: () => void }) {
  return (
    <button onClick={onAdd} className="flex h-[72px] w-full items-center gap-3 rounded-[22px] border border-dashed border-foreground/20 px-4 text-left transition-transform active:scale-[0.98]">
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-foreground/5 text-muted-foreground">
        <BedDouble className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-foreground">Add where you're staying</p>
        <p className="text-xs text-muted-foreground">Hotel, homestay or a friend's place</p>
      </div>
      <span className="flex h-8 items-center rounded-full border border-foreground/15 bg-foreground/5 px-3.5 text-[13px] font-semibold text-foreground">Add stay</span>
    </button>
  );
}

function TallTile({ icon: Icon, label, value, onClick }: { icon: any; label: string; value: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="row-span-2 flex flex-col justify-between rounded-[22px] bg-gradient-to-br from-emerald-500/10 to-card p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] transition-transform active:scale-[0.98]"
    >
      <div className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-card text-emerald-500 shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div>
        <p className="font-display text-[25px] font-bold leading-7 tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </button>
  );
}

function SmallTile({ icon: Icon, tint, label, value, onClick }: { icon: any; tint: string; label: string; value: string | number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`${card} flex items-center gap-3 px-3.5 text-left transition-transform active:scale-[0.98]`}>
      <div className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div>
        <p className="font-display text-xl font-bold leading-[22px] text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export default function OverviewTab({ trip }: { trip: Trip }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: itinerary = [] } = useItinerary(trip.id);
  const { data: expenses = [] } = useExpenses(trip.id);
  const { data: documents = [] } = useDocuments(trip.id);
  const { data: places = [] } = usePlaces(trip.id);
  const first = useFirstView(trip.id);
  const now = useNow();

  const status = trip.status || (trip.archived ? "archived" : "active");
  const isWishlist = status === "wishlist";

  const totalSpent = expenses.filter(e => e.category !== "settlement").reduce((s, e) => s + e.amount, 0);
  const budgetTotal = trip.budget?.total ?? 0;
  const visitedPlaces = places.filter(p => p.visited).length;

  const spentShown = useCountUp(totalSpent, first);
  const timelineShown = Math.round(useCountUp(itinerary.length, first, 700));
  const docsShown = Math.round(useCountUp(documents.length, first, 700));

  const tripStart = isWishlist ? null : safeParseDate(trip.startDate);
  const tripEnd = isWishlist ? null : safeParseDate(trip.endDate);
  const totalDays = tripStart && tripEnd ? Math.max(differenceInCalendarDays(tripEnd, tripStart) + 1, 1) : 0;

  // Next upcoming item (not yet started)
  const nowStr = `${format(now, "yyyy-MM-dd")}T${format(now, "HH:mm")}`;
  const upcomingItems = [...itinerary]
    .filter(i => i.date && `${i.date}T${i.startTime || "00:00"}` >= nowStr)
    .sort((a, b) => `${a.date}T${a.startTime || "00:00"}`.localeCompare(`${b.date}T${b.startTime || "00:00"}`));
  const nextItem: any = isWishlist ? null : upcomingItems[0] ?? null;

  // Travel item happening right now (flight in the air, train on the move)
  const currentTravel: any =
    isWishlist
      ? null
      : itinerary.find(i => {
          if (i.elementType !== "travel" || !i.date) return false;
          const { start, end } = rangeOf(i);
          return start <= now && now < end;
        }) ?? null;

  // Where the trip is in its life. Decides the top card and the stay card.
  type Phase = "wishlist" | "nodates" | "far" | "close" | "ongoing" | "completed";
  let phase: Phase = "nodates";
  let daysUntil = 0;
  if (isWishlist) phase = "wishlist";
  else if (tripStart && tripEnd) {
    daysUntil = differenceInCalendarDays(tripStart, now);
    if (differenceInCalendarDays(now, tripEnd) > 0) phase = "completed";
    else if (daysUntil > 1) phase = "far";
    else if (daysUntil === 1) phase = "close";
    else if (daysUntil === 0) {
      // Departure day: the ticket stays big until the first journey of the day is over.
      const today = format(now, "yyyy-MM-dd");
      const firstTravel = itinerary
        .filter(i => i.elementType === "travel" && i.date === today)
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))[0];
      phase = firstTravel && now < rangeOf(firstTravel).end ? "close" : "ongoing";
    } else phase = "ongoing";
  }

  const dayNum = tripStart ? Math.min(Math.max(differenceInCalendarDays(now, tripStart) + 1, 1), totalDays) : 1;

  // Stay: the one happening now, otherwise the next one, otherwise the last one
  const stays = buildStays(itinerary, trip);
  const upcomingStay = stays.findIndex(s => now < s.checkOut);
  const activeIndex = upcomingStay === -1 ? stays.length - 1 : upcomingStay;
  const stay: Stay | undefined = stays[activeIndex];

  // Hero location (city if available)
  let heroLocation = trip.state || trip.destination;
  if (!isWishlist) {
    const today = format(new Date(), "yyyy-MM-dd");
    heroLocation = trip.dayCities?.[today] || trip.state || trip.destination;
  }

  useEffect(() => {
    if (!heroLocation) return;
    if (trip.heroLocation === heroLocation) return;
    (async () => {
      try {
        await supabase.functions.invoke("hero-image", {
          body: { trip_id: trip.id, destination: heroLocation },
        });
        queryClient.invalidateQueries({ queryKey: ["trips", trip.id] });
      } catch (err) {
        console.error("Failed to update hero image", err);
      }
    })();
  }, [trip.id, heroLocation, trip.heroLocation, queryClient]);

  const iconFor = (item: any) =>
    item?.elementType === "travel" ? KIND_ICON[travelKind(item)]
    : item?.elementType === "accommodation" ? Building2
    : item?.elementType === "meal" ? UtensilsCrossed
    : item?.elementType === "activity" ? Bike
    : Clock;

  const overBudget = budgetTotal > 0 && totalSpent > budgetTotal;
  const dayCount = new Set(itinerary.map(i => i.date).filter(Boolean)).size;
  const wishlistLabel = `${dayCount} day${dayCount !== 1 ? "s" : ""} planned`;

  // Top card, chosen by phase
  const ticketItem: any = currentTravel ?? nextItem;
  const ticketRoute = ticketItem?.elementType === "travel" ? parseRoute(ticketItem.title ?? "") : null;

  let topCard: React.ReactNode = null;
  if (phase === "far" && tripStart) {
    topCard = (
      <>
        <CountdownCard days={daysUntil} start={tripStart} totalDays={totalDays} first={first} />
        {nextItem && <NextUpRow item={nextItem} Icon={iconFor(nextItem)} />}
      </>
    );
  } else if (phase === "close" || (phase === "ongoing" && currentTravel)) {
    topCard =
      ticketItem && ticketRoute ? (
        <TicketCard item={ticketItem} route={ticketRoute} now={now} />
      ) : nextItem ? (
        <NextUpRow item={nextItem} Icon={iconFor(nextItem)} />
      ) : null;
  } else if (phase === "ongoing") {
    topCard = <OngoingCard dayNum={dayNum} totalDays={totalDays} nextItem={nextItem} Icon={iconFor(nextItem)} />;
  } else if (phase === "completed" && tripStart && tripEnd) {
    topCard = <RecapCard start={tripStart} end={tripEnd} totalDays={totalDays} spent={totalSpent} items={itinerary.length} />;
  } else if (phase === "nodates" && nextItem) {
    topCard = <NextUpRow item={nextItem} Icon={iconFor(nextItem)} />;
  }

  const goItinerary = () => navigate(`/trip/${trip.id}/itinerary`);

  return (
    <div className="flex flex-col pb-28">
      {/* Photo hero: runs under the floating header */}
      <div
        className="relative h-[300px] shrink-0"
        style={
          trip.heroImage
            ? { backgroundImage: `url(${trip.heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "linear-gradient(135deg,#2563eb 0%,#3b82f6 100%)" }
        }
      >
        {!trip.heroImage && <Plane className="absolute -right-6 bottom-10 h-44 w-44 text-white/10" />}
        <HeroScrim />
        <div className="absolute inset-x-0 bottom-14 z-10 px-6 text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.5)]">
          {isWishlist && (
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-md [text-shadow:none]" style={{ color: "#0f172a" }}>
              <Heart className="h-3.5 w-3.5 text-pink-500" />
              {wishlistLabel}
            </span>
          )}
          <h2 className="font-display text-4xl font-bold leading-[1.05] tracking-tight">{trip.name}</h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-white">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {heroLocation}
              {!isWishlist && (
                <>
                  {" "}· {safeFormatDate(trip.startDate, d => format(d, "MMM d"), "")} –{" "}
                  {safeFormatDate(trip.endDate, d => format(d, "MMM d, yyyy"), "")}
                </>
              )}
            </span>
          </p>
        </div>
      </div>

      {/* Content sheet slides over the photo */}
      <div className="relative z-10 -mt-9 flex flex-col gap-2.5 rounded-t-[34px] bg-background px-4 pt-5 shadow-[0_-12px_30px_rgba(10,20,50,0.16)]">
        {/* Top card: changes with the trip's state */}
        {topCard && (
          <Rise i={0} first={first} className="flex flex-col gap-2.5">
            {topCard}
          </Rise>
        )}

        {/* Stay: always here once added */}
        {!isWishlist && (
          <Rise i={1} first={first}>
            {stay ? (
              <StayCard stay={stay} now={now} tripFar={phase === "far"} count={stays.length} index={activeIndex} />
            ) : (
              <AddStayCard onAdd={goItinerary} />
            )}
          </Rise>
        )}

        {/* Bento */}
        <Rise i={2} first={first}>
          <div className="grid grid-cols-2 grid-rows-[70px_70px] gap-2.5">
            <TallTile icon={Receipt} label="Total spent" value={formatCurrency(Math.round(spentShown), "INR")} onClick={() => navigate(`/trip/${trip.id}/expenses`)} />
            <SmallTile icon={Calendar} tint="bg-blue-500/15 text-blue-500" label="Timeline" value={timelineShown} onClick={goItinerary} />
            <SmallTile icon={FileText} tint="bg-violet-500/15 text-violet-500" label="Documents" value={docsShown} onClick={() => navigate(`/trip/${trip.id}/documents`)} />
          </div>
        </Rise>

        <Rise i={3} first={first}>
          <button
            onClick={() => navigate(`/trip/${trip.id}/places`)}
            className={`${card} flex h-[60px] w-full items-center gap-3 px-3.5 text-left transition-transform active:scale-[0.98]`}
          >
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
              <MapPin className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-foreground">{visitedPlaces}/{places.length} places visited</p>
              <p className="text-xs text-muted-foreground">{places.length === 0 ? "Nothing saved yet" : `${places.length - visitedPlaces} to go`}</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground">
              <Plus className="h-4 w-4" />
            </span>
          </button>
        </Rise>

        {budgetTotal > 0 && (
          <Rise i={4} first={first}>
            <div
              className={`rounded-[22px] px-[18px] py-4 text-white shadow-[0_12px_28px_rgba(37,99,235,0.3)] ${
                overBudget ? "bg-gradient-to-br from-red-500 to-red-400 dark:from-red-500/80 dark:to-red-400/60" : "bg-gradient-to-br from-primary to-blue-400 dark:from-primary/80 dark:to-blue-400/60"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-white/90">
                <span>{formatCurrency(totalSpent, "INR")} of {formatCurrency(budgetTotal, "INR")}</span>
                <span className="font-semibold">{overBudget ? "Over budget" : formatCurrency(budgetTotal - totalSpent, "INR") + " left"}</span>
              </div>
              <div className="mt-2.5 h-[7px] overflow-hidden rounded-full bg-white/30">
                <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${Math.min((totalSpent / budgetTotal) * 100, 100)}%` }} />
              </div>
            </div>
          </Rise>
        )}

        <TripMap trip={trip} />
      </div>
    </div>
  );
}
