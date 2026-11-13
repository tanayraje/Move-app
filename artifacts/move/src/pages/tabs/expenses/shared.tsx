import React, { useState, useEffect } from "react";
import { Coffee, Car, Home, Camera, ShoppingBag, Handshake } from "lucide-react";
import { ExpenseCategory } from "@/lib/types";

export const EXPENSE_ICONS: Record<ExpenseCategory, React.ElementType> = {
  food: Coffee,
  transport: Car,
  accommodation: Home,
  activities: Camera,
  misc: ShoppingBag,
  settlement: Handshake,
};

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  food: 'Food & Drinks',
  transport: 'Transport',
  accommodation: 'Accommodation',
  activities: 'Activities',
  misc: 'Misc',
  settlement: 'Settlement',
};

export const BUDGET_KEYS: ExpenseCategory[] = ['transport', 'food', 'accommodation', 'activities', 'misc'];
export const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#65a30d'];

export type ExpTab = "expenses" | "balances" | "insights";

// Same colour code as the Timeline and Documents: transport blue, stay violet, food amber, activities teal.
// (full class names on purpose so Tailwind can see them)
export const TONES: Record<ExpenseCategory, { card: string; stub: string; dash: string; label: string; title: string; tile: string; bar: string; chip: string }> = {
  transport: { card: "bg-blue-50", stub: "bg-blue-100/60", dash: "border-blue-300", label: "text-blue-700", title: "text-blue-950", tile: "bg-blue-100 text-blue-700", bar: "bg-blue-500", chip: "bg-blue-100 text-blue-700" },
  accommodation: { card: "bg-violet-50", stub: "bg-violet-100/60", dash: "border-violet-300", label: "text-violet-700", title: "text-violet-950", tile: "bg-violet-100 text-violet-700", bar: "bg-violet-500", chip: "bg-violet-100 text-violet-700" },
  food: { card: "bg-amber-50", stub: "bg-amber-100/60", dash: "border-amber-300", label: "text-amber-700", title: "text-amber-950", tile: "bg-amber-100 text-amber-700", bar: "bg-amber-500", chip: "bg-amber-100 text-amber-700" },
  activities: { card: "bg-teal-50", stub: "bg-teal-100/60", dash: "border-teal-300", label: "text-teal-700", title: "text-teal-950", tile: "bg-teal-100 text-teal-700", bar: "bg-teal-500", chip: "bg-teal-100 text-teal-700" },
  misc: { card: "bg-slate-50", stub: "bg-slate-100/70", dash: "border-slate-300", label: "text-slate-600", title: "text-slate-900", tile: "bg-slate-200 text-slate-600", bar: "bg-slate-400", chip: "bg-slate-200 text-slate-600" },
  settlement: { card: "bg-emerald-50", stub: "bg-emerald-100/60", dash: "border-emerald-300", label: "text-emerald-700", title: "text-emerald-950", tile: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
};

// One quiet container per group: rows with hairlines instead of a card per item
export const LIST_CARD =
  "divide-y divide-border/60 overflow-hidden rounded-[22px] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-10px_rgba(15,23,42,0.14)] ring-1 ring-border";

/** Budget ring: sweeps in, turns amber near the limit and red when over */
export function BudgetRing({ pct, over }: { pct: number; over: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const R = 42;
  const C = 2 * Math.PI * R;
  const stroke = over ? "#FCA5A5" : pct >= 85 ? "#FCD34D" : "#FFFFFF";
  return (
    <div className="relative h-[108px] w-[108px] shrink-0">
      <svg viewBox="0 0 108 108" className="h-full w-full -rotate-90" role="img" aria-label={`${Math.round(pct)} percent of budget used`}>
        <circle cx="54" cy="54" r={R} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="11" />
        <circle
          cx="54"
          cy="54"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="11"
          strokeLinecap={shown > 0 ? "round" : "butt"}
          strokeDasharray={`${(shown / 100) * C} ${C}`}
          style={{
            transition: "stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1), stroke 0.3s",
            filter: "drop-shadow(0 0 6px rgba(255,255,255,0.4))",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[26px] font-extrabold leading-none">{over ? "Over" : `${Math.round(pct)}%`}</span>
        <span className="mt-1 text-[11px] text-primary-foreground/75">{over ? "budget" : "used"}</span>
      </div>
    </div>
  );
}

export const FILTER_LABELS: Record<ExpenseCategory, string> = {
  transport: "Transport",
  food: "Food",
  accommodation: "Stay",
  activities: "Activities",
  misc: "Misc",
  settlement: "Settlements",
};
