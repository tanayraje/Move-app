import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AddMenuItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind classes for the icon tile, e.g. "bg-blue-50 text-primary" */
  tint: string;
  onSelect: () => void;
}

/**
 * Glass popover that opens from the docked "+" button.
 * The "+" itself must sit above this (z-[70]) so it can rotate into a close button.
 */
export function AddMenu({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: AddMenuItem[];
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-[6px]"
          />
          <div className="pointer-events-none fixed bottom-0 left-1/2 z-[65] w-full max-w-md -translate-x-1/2 px-4 pb-[calc(96px+env(safe-area-inset-bottom))]">
            <motion.div
              key="menu"
              role="menu"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              style={{ transformOrigin: "bottom right" }}
              className="glass-light pointer-events-auto ml-auto w-[268px] rounded-[28px] p-2"
            >
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    role="menuitem"
                    onClick={() => {
                      onClose();
                      item.onSelect();
                    }}
                    className="flex w-full items-center gap-3 rounded-[18px] p-2.5 text-left transition-colors hover:bg-black/[0.04] active:bg-black/[0.06]"
                  >
                    <span
                      className={cn(
                        "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px]",
                        item.tint
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold text-foreground">
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="block text-xs text-muted-foreground">{item.hint}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
