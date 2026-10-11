import React from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export interface DockItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Small count bubble on the icon (hidden when 0 / undefined) */
  badge?: number;
  href?: string;
  onSelect?: () => void;
}

export const DOCK_CELL = 52;
export const DOCK_PADDING = 12;
export const dockWidth = (count: number, cell: number = DOCK_CELL) => count * cell + DOCK_PADDING;

/**
 * Compact floating glass pill (Instagram / iOS 26 style): icon-first, the selected
 * item sits in a soft bubble with its label. Pair it with <FAB /> for a docked "+".
 */
export function DockBar({
  items,
  activeId,
  cell = DOCK_CELL,
  variant,
  shifted = false,
}: {
  items: DockItem[];
  activeId: string;
  cell?: number;
  /** "trip" bars slide left automatically when a screen mounts a <FAB /> */
  variant?: "trip";
  /** Always slide left (use when a "+" is always docked beside the bar) */
  shifted?: boolean;
}) {
  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4 pb-[calc(18px+env(safe-area-inset-bottom))]"
    >
      <div className="flex justify-center">
        <div
          className={cn(
            "dock-pill glass-light pointer-events-auto flex h-16 items-center rounded-full p-1.5",
            variant === "trip" && "dock-pill-trip",
            shifted && "-translate-x-[38px]"
          )}
          style={{ width: dockWidth(items.length, cell) }}
        >
          {items.map((item) => {
            const active = item.id === activeId;
            const Icon = item.icon;
            const cls = cn(
              "relative flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-200",
              active
                ? "bg-primary/[0.13] text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]"
                : "text-slate-500"
            );
            const inner = (
              <>
                <Icon className="h-6 w-6" strokeWidth={active ? 2.3 : 2} />
                {active && <span className="text-[10px] font-semibold leading-none">{item.label}</span>}
                {item.badge ? (
                  <span
                    className={cn(
                      "absolute right-2 top-0 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2 ring-white",
                      active ? "bg-primary text-primary-foreground" : "bg-slate-300 text-slate-700"
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </>
            );
            return item.href ? (
              <Link
                key={item.id}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cls}
              >
                {inner}
              </Link>
            ) : (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-pressed={active}
                onClick={item.onSelect}
                className={cls}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
