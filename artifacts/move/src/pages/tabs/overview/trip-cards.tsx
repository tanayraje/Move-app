import React from "react";
import { differenceInCalendarDays, differenceInMinutes, format, addDays } from "date-fns";
import { formatTime12, formatDateTime12 } from "@/lib/time";
import { Check } from "lucide-react";
import { safeFormatDate, safeParseDate } from "@/lib/utils";
import {
  card,
  useCountUp,
  useProgress,
  rangeOf,
  fmtDuration,
  cityCode,
  travelKind,
  KIND_ICON,
  Chip,
  DayStrip,
} from "./shared";

export function CountdownCard({ days, start, totalDays, cities, place, first }: { days: number; start: Date; totalDays: number; cities?: Record<string, string>; place: string; first: boolean }) {
  const n = Math.round(useCountUp(days, first));
  const tomorrow = days === 1;
  const end = addDays(start, totalDays - 1);
  const hasRoute = new Set(Object.values(cities ?? {}).filter(Boolean)).size >= 2;
  const { stops } = buildRoute(cities, start, end, place);
  const last = stops.length - 1;
  const at = (pct: number) => `calc(${pct}% - ${(pct / 100) * 10}px)`;

  return (
    <div className="flex flex-col gap-4 rounded-[26px] bg-blue-500/[0.12] p-5 ring-1 ring-inset ring-blue-500/25 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between">
        <Chip tone="blue">Upcoming</Chip>
        <span className="text-xs text-muted-foreground">Trip starts {format(start, "MMM d")}</span>
      </div>
      {tomorrow ? (
        <div className="flex items-baseline">
          <span className="font-display text-[56px] font-bold leading-[68px] tracking-[-2px] text-primary">Tomorrow</span>
        </div>
      ) : (
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[72px] font-bold leading-[68px] tracking-[-3px] text-primary">{n}</span>
          <span className="text-xl font-medium text-muted-foreground">days to go</span>
        </div>
      )}
      {hasRoute ? (
        <div>
          <div className="relative h-2.5">
            {stops.slice(1).map((st, i) => {
              const from = stops[i].pct;
              const gap = st.pct - from;
              return (
                <span
                  key={i}
                  className="absolute top-[4px] h-0 border-t-2 border-dashed border-blue-500/45"
                  style={{ left: `calc(${from}% - ${(from / 100) * 10}px + 13px)`, width: `max(0px, calc(${gap}% - ${(gap / 100) * 10}px - 16px))` }}
                />
              );
            })}
            {stops.map((st, i) => (
              <span key={i} className="absolute top-0 h-2.5 w-2.5 rounded-full border-2 border-blue-500" style={{ left: at(st.pct) }} />
            ))}
          </div>
          <div className="relative mt-2 h-5 text-xs text-muted-foreground">
            {stops.map((st, i) =>
              st.label ? (
                <div
                  key={i}
                  className="absolute"
                  style={i === 0 ? { left: 0 } : i === last ? { right: 0, textAlign: "right" } : { left: `${st.pct}%`, transform: "translateX(-50%)", textAlign: "center" }}
                >
                  <p className="text-[13px] font-semibold text-foreground">{st.name}</p>
                </div>
              ) : null
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="relative flex h-2.5 items-center">
            <div className="absolute inset-x-[5px] h-[2px] bg-blue-500/35" />
            <span className="absolute left-0 h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="absolute right-0 h-2.5 w-2.5 rounded-full bg-blue-500" />
          </div>
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <b className="text-[13px] font-semibold text-foreground">{format(start, "MMM d")}</b>
            <span className="font-semibold text-blue-500">{totalDays} day{totalDays === 1 ? "" : "s"}</span>
            <b className="text-[13px] font-semibold text-foreground">{format(end, "MMM d")}</b>
          </div>
        </div>
      )}
    </div>
  );
}

export function NextUpRow({ item, Icon }: { item: any; Icon: any }) {
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
      {item.startTime && <span className="text-[13px] text-muted-foreground">{formatTime12(item.startTime)}</span>}
    </div>
  );
}

export function TicketCard({ item, route, now }: { item: any; route: { from: string; to: string }; now: Date }) {
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
          <p className="text-lg font-bold text-foreground">{item.startTime ? formatTime12(item.startTime) : formatDateTime12(start)}</p>
        </div>
        <span className="text-xs text-muted-foreground">{fmtDuration(total)}</span>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.5px] text-muted-foreground">Arrives</p>
          <p className="text-lg font-bold text-foreground">{item.endTime ? formatTime12(item.endTime) : formatDateTime12(end)}</p>
        </div>
      </div>
    </div>
  );
}

export function OngoingCard({ dayNum, totalDays, nextItem, Icon }: { dayNum: number; totalDays: number; nextItem: any | null; Icon: any }) {
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
            {nextItem.date === format(new Date(), "yyyy-MM-dd") ? "Today" : safeFormatDate(nextItem.date, (d: Date) => format(d, "MMM d"), nextItem.date)} {formatTime12(nextItem.startTime)}
          </span>
        </div>
      )}
    </div>
  );
}

export type RouteStop = { name: string; date: Date; pct: number; label: boolean };

// Consecutive days in the same city collapse into one stop. Dots are spaced by date between the
// first and last stop. legs[i] is the number of nights between stop i and stop i + 1.
export function buildRoute(cities: Record<string, string> | undefined, start: Date, end: Date, place: string): { stops: RouteStop[]; legs: number[] } {
  const raw: { name: string; date: Date }[] = [];
  Object.keys(cities ?? {})
    .sort()
    .forEach(key => {
      const d = safeParseDate(key);
      const name = (cities ?? {})[key];
      if (!d || !name) return;
      if (raw.length && raw[raw.length - 1].name === name) return;
      raw.push({ name, date: d });
    });
  let picked = raw.length > 5 ? [0, 1, 2, 3, 4].map(i => raw[Math.round((i * (raw.length - 1)) / 4)]) : raw;
  if (picked.length < 2) picked = [{ name: place || "Start", date: start }, { name: "End", date: end }];

  const origin = picked[0].date;
  const span = Math.max(differenceInCalendarDays(picked[picked.length - 1].date, origin), 1);
  const stops: RouteStop[] = picked.map((p, i) => ({
    ...p,
    pct: i === 0 ? 0 : i === picked.length - 1 ? 100 : Math.min((differenceInCalendarDays(p.date, origin) / span) * 100, 100),
    label: true,
  }));
  // A middle label that would sit on top of the next one is dropped. Its dot and leg still show.
  stops.forEach((st, i) => {
    if (i > 0 && i < stops.length - 1 && stops[i + 1].pct - st.pct < 16) st.label = false;
  });
  const legs = stops.slice(1).map((st, i) => Math.max(differenceInCalendarDays(st.date, stops[i].date), 0));
  return { stops, legs };
}

export function RecapCard({ start, end, totalDays, cities, place, first }: { start: Date; end: Date; totalDays: number; cities?: Record<string, string>; place: string; first: boolean }) {
  const { stops, legs } = buildRoute(cities, start, end, place);
  const p = useProgress(first);
  const reached = (pct: number) => p * 100 >= pct - 0.01;
  const done = p >= 1;
  const last = stops.length - 1;
  const at = (pct: number) => `calc(${pct}% - ${(pct / 100) * 10}px)`;

  return (
    <div className={`${card} !rounded-[24px] flex flex-col gap-3 px-5 py-4`}>
      <div className="flex items-center justify-between">
        <Chip tone="green">
          Completed
          <Check className={`h-3.5 w-3.5 text-emerald-500 transition-transform duration-300 ${done ? "scale-100" : "scale-0"}`} strokeWidth={2.5} />
        </Chip>
        <span className="text-xs tabular-nums text-muted-foreground">{Math.round(p * totalDays)} days</span>
      </div>

      <div>
        <div className="relative h-9">
          <div className="absolute inset-x-[5px] top-[24px] h-[2px] bg-blue-500/20" />
          <div className="absolute inset-x-[5px] top-[24px] h-[2px]">
            <div className="h-full bg-blue-500" style={{ width: `${p * 100}%` }} />
          </div>
          {legs.map((n, i) => {
            const mid = (stops[i].pct + stops[i + 1].pct) / 2;
            return n > 0 ? (
              <span
                key={i}
                className={`absolute top-0.5 -translate-x-1/2 text-[11px] font-semibold text-blue-500 transition-opacity duration-500 ${reached(mid) ? "opacity-100" : "opacity-0"}`}
                style={{ left: `${mid}%` }}
              >
                {n}N
              </span>
            ) : null;
          })}
          {stops.map((st, i) => {
            const on = reached(st.pct);
            return (
              <React.Fragment key={i}>
                {on && first && !done && <span className="ov-ripple absolute top-5 h-2.5 w-2.5 rounded-full border-2 border-blue-500" style={{ left: at(st.pct) }} />}
                <span
                  className={`absolute top-5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-[3px] ring-card transition-transform duration-300 ${on ? "scale-100" : "scale-0"}`}
                  style={{ left: at(st.pct) }}
                />
              </React.Fragment>
            );
          })}
          <span
            className={`absolute top-5 h-2.5 w-2.5 rounded-full bg-blue-300 ring-4 ring-blue-500/30 transition-opacity duration-300 ${p > 0 && !done ? "opacity-100" : "opacity-0"}`}
            style={{ left: at(p * 100) }}
          />
        </div>

        <div className="relative mt-1 h-9 text-xs text-muted-foreground">
          {stops.map((st, i) =>
            st.label ? (
              <div
                key={i}
                className={`absolute transition-all duration-500 ${reached(st.pct) ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
                style={i === 0 ? { left: 0 } : i === last ? { right: 0, textAlign: "right" } : { left: `${st.pct}%`, transform: "translateX(-50%)", textAlign: "center" }}
              >
                <p className="text-[13px] font-semibold text-foreground">{st.name}</p>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
