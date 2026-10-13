import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import { User, KeyRound, LogOut, ChevronRight } from "lucide-react";
import { getAvatarUrl } from "@/lib/avatar";

/**
 * Light-glass menu anchored under the header avatar.
 * Portalled to document.body so no ancestor can clip or re-anchor it.
 */
export function ProfileMenu({
  open,
  onClose,
  avatar,
  name,
  username,
  onJoin,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  avatar?: string;
  name?: string | null;
  username?: string | null;
  onJoin: () => void;
  onSignOut: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const row =
    "flex w-full items-center gap-3 rounded-[18px] p-2.5 text-left transition-colors hover:bg-black/[0.04] active:bg-black/[0.06]";
  const tile = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[110] bg-slate-900/25 backdrop-blur-[6px]"
          />
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[115] mx-auto w-full max-w-md px-4 pt-[calc(68px+env(safe-area-inset-top))]">
            <motion.div
              key="menu"
              role="menu"
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              style={{ transformOrigin: "top right" }}
              className="glass-light pointer-events-auto ml-auto w-[288px] rounded-[28px] p-2"
            >
              <div className="flex items-center gap-3 p-2.5 pb-3">
                <img
                  src={getAvatarUrl(avatar, 128)}
                  alt=""
                  className="h-12 w-12 rounded-full bg-muted object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-foreground">
                    {name || username || "Traveller"}
                  </p>
                  {username && (
                    <p className="truncate text-xs text-muted-foreground">@{username}</p>
                  )}
                </div>
              </div>
              <div className="mx-2.5 mb-1 h-px bg-black/[0.06]" />

              <Link href="/profile">
                <button role="menuitem" onClick={onClose} className={row}>
                  <span className={`${tile} bg-blue-50 text-primary`}>
                    <User className="h-[18px] w-[18px]" />
                  </span>
                  <span className="flex-1 text-[15px] font-semibold text-foreground">Profile</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </Link>

              <button
                role="menuitem"
                onClick={() => {
                  onClose();
                  onJoin();
                }}
                className={row}
              >
                <span className={`${tile} bg-teal-50 text-teal-600`}>
                  <KeyRound className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-[15px] font-semibold text-foreground">Join with a code</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <button
                role="menuitem"
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                className={row}
              >
                <span className={`${tile} bg-red-50 text-red-500`}>
                  <LogOut className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-[15px] font-semibold text-red-500">Sign out</span>
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
