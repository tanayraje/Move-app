import React from "react";
import { Link } from "wouter";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
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
  const reduce = useReducedMotion();
  // One shared pill slides (and resizes) between items. Spring tuned to be quick and settle without wobble.
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 520, damping: 40, mass: 0.9 };

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-5 pb-[calc(18px+env(safe-area-inset-bottom))]"
    >
      <LayoutGroup id={`dock-${mode}`}>
        <div className="dock-bar glass-light pointer-events-auto flex h-16 items-center gap-1 rounded-full px-2">
          {items.map((item) => {
            const active = item.id === activeId;
            const Icon = item.icon;

            const wrap = mode === "labels" || !active ? "min-w-0 flex-1" : "flex-none";

            const cls = cn(
              "relative z-10 flex h-12 w-full items-center justify-center gap-1.5 rounded-full transition-colors duration-200",
              mode === "labels" ? "text-[13px] font-semibold" : active ? "px-3.5" : "",
              active ? "text-primary dark:text-white" : "text-muted-foreground dark:text-white/70"
            );

            const inner =
              mode === "labels" ? (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={cn(
                        "flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold leading-none",
                        active ? "bg-primary text-primary-foreground" : "bg-foreground/[0.1] text-muted-foreground"
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={active ? 2.3 : 2} />
                  {active && (
                    <motion.span
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.18, delay: reduce ? 0 : 0.06 }}
                      className="whitespace-nowrap text-[13px] font-semibold"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </>
              );

            return (
              <motion.div key={item.id} layout transition={spring} className={cn("relative", wrap)}>
                {active && (
                  <motion.span
                    layoutId="dock-pill"
                    transition={spring}
                    style={{ borderRadius: 9999 }}
                    className="absolute inset-0 bg-primary/15 dark:bg-white/[0.16] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]"
                  />
                )}
                {item.href ? (
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cls}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-label={item.label}
                    aria-pressed={active}
                    onClick={item.onSelect}
                    className={cls}
                  >
                    {inner}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </LayoutGroup>
    </nav>
  );
}
