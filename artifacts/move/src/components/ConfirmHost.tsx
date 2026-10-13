import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { getPendingConfirm, settleConfirm, subscribeConfirm } from "@/lib/dialogs";
import { cn } from "@/lib/utils";

/** Mount once near the app root. Renders dialogs requested through confirmDialog(). */
export function ConfirmHost() {
  const pending = useSyncExternalStore(subscribeConfirm, getPendingConfirm, getPendingConfirm);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && settleConfirm(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {pending && (
        <motion.div
          key="confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/30 px-6 backdrop-blur-[6px]"
          onClick={() => settleConfirm(false)}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-light w-full max-w-[340px] rounded-[28px] p-5"
          >
            <h2 className="font-display text-xl font-bold text-foreground">{pending.title}</h2>
            {pending.message && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {pending.message}
              </p>
            )}
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => settleConfirm(false)}
                className="h-12 flex-1 rounded-2xl bg-black/[0.05] text-[15px] font-semibold text-foreground active:scale-[0.98]"
              >
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => settleConfirm(true)}
                className={cn(
                  "h-12 flex-1 rounded-2xl text-[15px] font-semibold text-white active:scale-[0.98]",
                  pending.destructive ? "bg-red-500" : "bg-primary"
                )}
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
