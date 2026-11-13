import React from "react";
import { differenceInDays } from "date-fns";
import {
  Plane,
  Train,
  Bus,
  Car,
  Building2,
  UtensilsCrossed,
  Bike,
  Coffee,
  Wine,
  Sun,
  Sunset,
} from "lucide-react";
import { ItineraryItem, ElementType, TravelType, ItineraryCategory, ExpenseCategory } from "@/lib/types";
import { safeParseDate } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────
export type MealSubType = 'breakfast' | 'lunch' | 'dinner' | 'drinks';

export const MEAL_SUBTYPES: { id: MealSubType; label: string; icon: React.ElementType; defaultTime: string }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: Coffee,      defaultTime: '08:00' },
  { id: 'lunch',     label: 'Lunch',     icon: Sun,         defaultTime: '13:00' },
  { id: 'dinner',    label: 'Dinner',    icon: Sunset,      defaultTime: '20:00' },
  { id: 'drinks',    label: 'Drinks',    icon: Wine,        defaultTime: '21:00' },
];

export const ELEMENT_COLORS: Record<ElementType, string> = {
  travel: "from-[#3b82f6] to-[#2563eb] dark:from-[#1f3d6f] dark:to-[#1f3d6f]",
  accommodation: "from-[#8b5cf6] to-[#7c3aed] dark:from-[#4f3a78] dark:to-[#4f3a78]",
  meal: "from-[#fbbf24] to-[#f59e0b] dark:from-[#8b6b13] dark:to-[#8b6b13]",
  activity: "from-[#0d9488] to-[#059669] dark:from-[#0d453a] dark:to-[#0d453a]",
};
export const ELEMENT_BORDER: Record<ElementType, string> = {
  travel: "border-blue-200",
  accommodation: "border-violet-200",
  meal: "border-amber-200",
  activity: "border-teal-200",
};

export const ELEMENT_BADGES: Record<ElementType, string> = {
  travel:
    "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",

  accommodation:
    "bg-violet-50 text-violet-700 border border-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",

  meal:
    "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",

  activity:
    "bg-teal-50 text-teal-700 border border-teal-100 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20",
};

export const ELEMENT_LABELS: Record<ElementType, string> = {
  travel: "TRAVEL",
  accommodation: "STAY",
  meal: "MEAL",
  activity: "ACTIVITY",
};

export function categoryLabel(item: ItineraryItem) {
  if (item.elementType !== "meal") {
    return ELEMENT_LABELS[item.elementType];
  }

  switch (item.mealSubType) {
    case "breakfast":
      return "BREAKFAST";

    case "lunch":
      return "LUNCH";

    case "dinner":
      return "DINNER";

    case "drinks":
      return "DRINKS";

    default:
      return "MEAL";
  }
}

export function panelGradient(type: ElementType) {
  switch (type) {
    case "travel":
      return "bg-gradient-to-b from-[#3b82f6] to-[#2563eb] dark:from-[#1f3d6f] dark:to-[#1f3d6f]";

    case "accommodation":
      return "bg-gradient-to-b from-[#8b5cf6] to-[#7c3aed] dark:from-[#4f3a78] dark:to-[#4f3a78]";

    case "meal":
      return "bg-gradient-to-b from-[#fbbf24] to-[#f59e0b] dark:from-[#8b6b13] dark:to-[#8b6b13]";

    default:
      return "bg-gradient-to-b from-[#14b8a6] to-[#0d9488] dark:from-[#0d453a] dark:to-[#0d453a]";
  }
}

export function tintSurface(type: ElementType) {
  switch (type) {
    case "travel":
      return "bg-blue-50/30";

    case "accommodation":
      return "bg-violet-50/30";

    case "meal":
      return "bg-amber-50/30";

    default:
      return "bg-teal-50/30";
  }
}

export function travelIcon(type?: TravelType) {
  switch (type) {
    case "train":
      return Train;

    case "bus":
      return Bus;

    case "car":
      return Car;

    default:
      return Plane;
  }
}

export function travelLabel(type?: TravelType) {
  switch (type) {
    case "train":
      return "TRAIN";

    case "bus":
      return "BUS";

    case "car":
      return "CAR";

    default:
      return "FLIGHT";
  }
}

export const ELEMENT_ICONS: Record<ElementType, React.ElementType> = {
  travel: Plane,
  accommodation: Building2,
  meal: UtensilsCrossed,
  activity: Bike,
};

export const TRAVEL_ICONS: Record<TravelType, React.ElementType> = {
  flight: Plane,
  train: Train,
  bus: Bus,
  car: Car,
};

export const ELEMENT_TO_EXPENSE_CAT: Record<ElementType, ExpenseCategory> = {
  travel: 'transport',
  accommodation: 'accommodation',
  meal: 'food',
  activity: 'activities',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function elementTypeToCategory(t: ElementType, travelType?: TravelType): ItineraryCategory {
  if (t === 'travel') return (travelType as ItineraryCategory) || 'flight';
  if (t === 'accommodation') return 'hotel';
  if (t === 'meal') return 'food';
  return 'activity';
}

export function parseTime(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const total = parseTime(time) + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getDuration(start: string, end: string): string {
  if (!start || !end) return '';
  const s = parseTime(start);
  const e = parseTime(end);
  const diff = e >= s ? e - s : 24 * 60 - s + e;
  if (diff <= 0) return '';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function sortItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime);
  });
}

export function stayNights(checkIn: string, checkOut: string): number {
  const d1 = safeParseDate(checkIn);
  const d2 = safeParseDate(checkOut);
  if (!d1 || !d2) return 1;
  return Math.max(differenceInDays(d2, d1), 1);
}

// ─── Card helpers ─────────────────────────────────────────────────────────────

/** Live state for a travel leg: departs in..., in transit, landed/arrived. */
export function legStatus(item: ItineraryItem): { label: string; tone: string } | null {
  const start = new Date(`${item.date}T${item.startTime}`);
  const end = new Date(`${item.date}T${item.endTime || item.startTime}`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  if (end < start) end.setDate(end.getDate() + 1);
  const now = new Date();
  if (now >= end) {
    return { label: item.travelType === "flight" ? "Landed" : "Arrived", tone: "bg-emerald-50 text-emerald-600" };
  }
  if (now >= start) return { label: "In transit", tone: "bg-blue-50 text-blue-600 dark:bg-[#3a6bb0] dark:text-[#e8f1ff]" };
  const mins = Math.round((start.getTime() - now.getTime()) / 60000);
  if (mins <= 24 * 60) {
    return {
      label: mins >= 60 ? `Departs in ${Math.round(mins / 60)}h` : `Departs in ${mins}m`,
      tone: "bg-amber-50 text-amber-600 dark:bg-[#1d859f] dark:text-[#ffda24]",
    };
  }
  return { label: "Upcoming", tone: "bg-blue-50 text-blue-600 dark:bg-[#3a6bb0] dark:text-[#e8f1ff]" };
}

export function NowMarker({ time }: { time: string }) {
  return (
    <div className="relative flex h-5 items-center">
      <span className="absolute -bottom-5 -top-5 left-[57px] w-0.5 bg-primary/30" />
      <div className="w-11 shrink-0" />
      <div className="relative flex w-7 shrink-0 justify-center">
        <span className="relative z-10 h-[18px] w-[18px] rounded-full bg-primary shadow-[0_0_0_6px_hsl(var(--primary)/0.18)]" />
      </div>
      <span className="ml-3 text-xs font-semibold text-primary">Now, {time}</span>
    </div>
  );
}

/** Quiet "1h 30m free" note between two items, sitting on the rail */
export function GapLabel({ text }: { text: string }) {
  return (
    <div className="relative pl-[72px] text-[11px] text-muted-foreground/70">
      <span className="absolute -bottom-5 -top-5 left-[57px] w-0.5 bg-border" />
      {text}
    </div>
  );
}
