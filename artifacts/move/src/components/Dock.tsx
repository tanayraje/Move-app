import React from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export interface DockItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Count shown next to the label (labels mode); hidden when 0 / undefined */
  badge?: number;
  href?: string;
  onSelect?: () => void;
}

/**
 * Floating glass bar, padded from the screen edges (wide, not full-bleed).
 *  - mode "icons":  icon-only items, the selected one expands into a pill with its label (trip screens)
 *  - mode "labels": text segments with a small count chip (Home filters)
 * Pair it with <FAB />: the bar makes room for the docked "+" automatically.
 */
export function DockBar({
  items,
  activeId,
  mode = "icons",
}: {
  items: DockItem[];
  activeId: string;
  mode?: "icons" | "labels";
}) {
  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-5 pb-[calc(18px+env(safe-area-inset-bottom))]"
    >
      <div className="dock-bar glass-light pointer-events-auto flex h-16 items-center gap-1 rounded-full px-2">
        {items.map((item) => {
          const active = item.id === activeId;
          const Icon = item.icon;

          const cls =
            mode === "labels"
              ? cn(
                  "flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors duration-200",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground"
                )
              : active
              ? "flex h-12 flex-none items-center gap-1.5 rounded-full bg-primary/15 px-3.5 text-primary transition-colors duration-200"
              : "flex h-12 min-w-0 flex-1 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200";

          const inner =
            mode === "labels" ? (
              <>
                <span className="truncate">{item.label}</span>
                {item.badge ? (
                  <span
                    className={cn(
                      "flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold leading-none",
                      active ? "bg-primary text-primary-foreground" : "bg-black/[0.07] text-muted-foreground"
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={active ? 2.3 : 2} />
                {active && <span className="whitespace-nowrap text-[13px] font-semibold">{item.label}</span>}
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
    </nav>
  );
}
