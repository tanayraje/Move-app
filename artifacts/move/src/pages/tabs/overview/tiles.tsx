import { differenceInCalendarDays, format } from "date-fns";
import { formatDateTime12 } from "@/lib/time";
import { BedDouble, ChevronUp, X, Maximize2 } from "lucide-react";
import { WEATHER_ICONS, CityStretch } from "@/hooks/use-weather";
import { motion, AnimatePresence } from "framer-motion";
import { safeParseDate } from "@/lib/utils";
import { card, Stay, stayStage, Chip } from "./shared";

export function StayIcon({ tone = "violet", twinkle = true }: { tone?: "violet" | "blue" | "amber"; twinkle?: boolean }) {
  const t = {
    violet: "bg-violet-500/15 text-violet-500",
    blue: "bg-blue-500/15 text-blue-500",
    amber: "bg-amber-500/15 text-amber-500",
  }[tone];
  return (
    <div className={`relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl ${t}`}>
      <BedDouble className="h-5 w-5" />
      {twinkle && <span className="ov-twinkle absolute right-[7px] top-[7px] h-1 w-1 rounded-full bg-violet-200" />}
    </div>
  );
}

export function NightDots({ nights, current, amberLast = false }: { nights: number; current: number; amberLast?: boolean }) {
  if (nights > 10) {
    return (
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-violet-500 transition-[width]" style={{ width: `${Math.min(current / nights, 1) * 100}%` }} />
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
              amber ? "bg-amber-500 ov-dot-amber" : isCur ? "bg-violet-500 ov-dot-violet" : filled ? "bg-violet-500" : "bg-foreground/10"
            }`}
          />
        );
      })}
    </div>
  );
}

export function StayCard({ stay, now, tripFar, count, index }: { stay: Stay; now: Date; tripFar: boolean; count: number; index: number }) {
  const stage = stayStage(stay, now, tripFar);
  const label = count > 1 ? `Stay · ${index + 1} of ${count}` : "Stay";
  const inDay = format(stay.checkIn, "MMM d");
  const outDay = format(stay.checkOut, "MMM d");
  const nightNo = Math.min(Math.max(differenceInCalendarDays(now, stay.checkIn) + 1, 1), stay.nights);
  const nightsLabel = `${stay.nights} night${stay.nights === 1 ? "" : "s"}`;
  const checkInTime = formatDateTime12(stay.checkIn);
  const checkOutTime = formatDateTime12(stay.checkOut);

  if (stage === "compact" || stage === "done") {
    return (
      <div className={`rounded-[22px] bg-violet-500/[0.12] ring-1 ring-inset ring-violet-500/25 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] flex h-[72px] items-center gap-3 px-4`}>
        <StayIcon twinkle={stage === "compact"} />
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
      <div className={`rounded-[22px] bg-violet-500/[0.12] ring-1 ring-inset ring-violet-500/25 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] flex flex-col gap-3.5 px-4 pb-4 pt-3.5`}>
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
            <div className="ov-line-draw absolute inset-x-1 h-[1.5px] bg-violet-500" />
            <span className="absolute left-0 h-2 w-2 rounded-full bg-violet-500" />
            <span className="absolute right-0 h-2 w-2 rounded-full bg-violet-500" />
          </div>
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span><b className="text-[13px] font-semibold text-foreground">{inDay}</b> · {checkInTime}</span>
            <span className="font-semibold text-violet-500">{nightsLabel}</span>
            <span><b className="text-[13px] font-semibold text-foreground">{outDay}</b> · {checkOutTime}</span>
          </div>
        </div>
      </div>
    );
  }

  const isCheckout = stage === "checkout";
  const left = stay.nights - nightNo;
  return (
    <div className={`rounded-[22px] bg-violet-500/[0.12] ring-1 ring-inset ring-violet-500/25 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] flex flex-col gap-3 px-4 py-3.5`}>
      <div className="flex items-center gap-3">
        <StayIcon tone={isCheckout ? "amber" : "violet"} twinkle={!isCheckout} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">{label}</p>
          <p className="truncate text-[15px] font-semibold text-foreground">{stay.name}</p>
        </div>
        {isCheckout ? <Chip tone="amber">Check out by {checkOutTime}</Chip> : <Chip tone="violet">Night {nightNo} of {stay.nights}</Chip>}
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

export function AddStayCard({ onAdd, onDismiss }: { onAdd: () => void; onDismiss: () => void }) {
  return (
    <div className="flex h-[72px] w-full items-center gap-1.5 rounded-[22px] border border-dashed border-violet-500/50 bg-violet-500/[0.04] pl-4 pr-2">
      <button onClick={onAdd} className="flex min-w-0 flex-1 items-center gap-3 text-left transition-transform active:scale-[0.98]">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
          <BedDouble className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">Add where you're staying</p>
          <p className="truncate text-xs text-muted-foreground">Hotel, homestay or a friend's place</p>
        </div>
        <span className="flex h-8 shrink-0 items-center rounded-full border border-violet-500/40 bg-violet-500/10 px-3.5 text-[13px] font-semibold text-foreground">Add stay</span>
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 active:scale-95"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function TallTile({ icon: Icon, label, value, onClick, flat = false }: { icon: any; label: string; value: string; onClick: () => void; flat?: boolean }) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      style={{ gridArea: "spent", borderRadius: 22 }}
      className={`${flat ? "flex items-center gap-3 px-3.5" : "flex flex-col justify-between p-4"} bg-emerald-500/[0.12] text-left ring-1 ring-inset ring-emerald-500/25 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]`}
    >
      <motion.div layout="position" className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-card text-emerald-500 shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
        <Icon className="h-[18px] w-[18px]" />
      </motion.div>
      <motion.div layout="position">
        <p className={`font-display font-bold tracking-tight text-foreground ${flat ? "text-xl leading-[22px]" : "text-[25px] leading-7"}`}>{value}</p>
        <p className={`text-xs text-muted-foreground ${flat ? "" : "mt-1"}`}>{label}</p>
      </motion.div>
    </motion.button>
  );
}

export function stretchDates(s: CityStretch) {
  const from = safeParseDate(s.from);
  const to = safeParseDate(s.to);
  if (!from || !to) return "";
  if (s.from === s.to) return format(from, "MMM d");
  return from.getMonth() === to.getMonth()
    ? `${format(from, "MMM d")} – ${format(to, "d")}`
    : `${format(from, "MMM d")} – ${format(to, "MMM d")}`;
}

// One card that grows in place: the small content fades out, the city list fades in as the edges reveal it
export const widgetFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.26, delay: 0.14 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export function WeatherWidget({ stretches, open, onToggle }: { stretches: CityStretch[]; open: boolean; onToggle: () => void }) {
  const lead = stretches[0];
  const LeadIcon = WEATHER_ICONS[lead.kind];
  // Only expandable when there is more than the first city to show
  const expandable = stretches.length > 1;
  const otherCities = new Set(stretches.slice(1).map(s => s.city.toLowerCase()).filter(c => c !== lead.city.toLowerCase())).size;
  const subline = otherCities > 0 ? `+${otherCities} ${otherCities === 1 ? "city" : "cities"}` : lead.source === "typical" ? "typical" : "";

  return (
    <motion.button
      layout
      onClick={expandable ? onToggle : undefined}
      whileTap={expandable ? { scale: 0.98 } : undefined}
      aria-expanded={expandable ? open : undefined}
      style={{ gridArea: "weather", borderRadius: 22 }}
      className={`${card} relative overflow-hidden text-left ${expandable ? "" : "cursor-default"}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {open ? (
          <motion.div key="expanded" layout="position" {...widgetFade} className="flex w-full flex-col px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">Weather</p>
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            </div>
            {stretches.map((s, i) => {
              const Icon = WEATHER_ICONS[s.kind];
              return (
                <div key={`${s.city}-${s.from}`} className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}>
                  <Icon className="h-5 w-5 shrink-0 text-foreground/70" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-foreground">{s.city}</p>
                    <p className="text-xs text-muted-foreground">
                      {stretchDates(s)}
                      {s.source === "typical" ? " · typical" : ""}
                    </p>
                  </div>
                  <p className="text-[15px] font-semibold text-foreground">
                    {s.high}° <span className="font-medium text-muted-foreground">/ {s.low}°</span>
                  </p>
                </div>
              );
            })}
            <p className="mt-1 text-[11px] text-muted-foreground/70">Weather data by Open-Meteo.com</p>
          </motion.div>
        ) : (
          <motion.div key="compact" layout="position" {...widgetFade} className="flex h-full min-w-0 items-center gap-3 px-3.5">
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-foreground/5 text-foreground/70">
              <LeadIcon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-xl font-bold leading-[22px] text-foreground">
                {lead.high}° <span className="text-sm font-medium text-muted-foreground">/ {lead.low}°</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {lead.city}
                {subline && (
                  <>
                    {" · "}
                    <span className={otherCities > 0 ? "text-foreground/80" : ""}>{subline}</span>
                  </>
                )}
              </p>
            </div>
            {expandable && (
              <Maximize2 aria-hidden className="absolute right-2.5 top-2.5 h-3 w-3 text-muted-foreground/60" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function SmallTile({ icon: Icon, tint, label, value, onClick, area }: { icon: any; tint: string; label: string; value: string | number; onClick: () => void; area: string }) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      style={{ gridArea: area, borderRadius: 22 }}
      className={`${card} flex items-center gap-3 px-3.5 text-left`}
    >
      <motion.div layout="position" className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-[18px] w-[18px]" />
      </motion.div>
      <motion.div layout="position">
        <p className="font-display text-xl font-bold leading-[22px] text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </motion.div>
    </motion.button>
  );
}
