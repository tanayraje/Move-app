import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Button({ className, variant = 'primary', size = 'default', isLoading, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'outline'|'ghost'|'danger', size?: 'default'|'sm'|'lg'|'icon', isLoading?: boolean }) {
  return (
    <button 
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
        {
          'bg-primary text-primary-foreground shadow-sm shadow-black/10 hover:bg-primary/90': variant === 'primary',
          'bg-muted text-foreground hover:bg-muted/80': variant === 'secondary',
          'border-2 border-border bg-transparent hover:bg-muted/50 text-foreground': variant === 'outline',
          'bg-transparent hover:bg-muted text-foreground': variant === 'ghost',
          'bg-red-500 text-white shadow-lg shadow-red-500/25 hover:bg-[#dc2626] dark:shadow-none': variant === 'danger',
          'h-12 px-6 py-3': size === 'default',
          'h-9 px-4 text-sm': size === 'sm',
          'h-14 px-8 text-lg rounded-2xl': size === 'lg',
          'h-12 w-12': size === 'icon',
        },
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" /> : null}
      {children}
    </button>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input 
      className={cn(
        "flex h-12 w-full rounded-xl border-2 border-border bg-card px-4 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select 
      className={cn(
        "flex h-12 w-full rounded-xl border-2 border-border bg-card px-4 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition appearance-none",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block text-foreground/80", className)} {...props}>
      {children}
    </label>
  );
}

export function BottomSheet(props: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // Rendered into document.body so a transformed ancestor can never
  // re-anchor the fixed sheet (this is what threw the members sheet off-screen).
  if (typeof document === "undefined") return null;
  return createPortal(<BottomSheetInner {...props} />, document.body);
}

function BottomSheetInner({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const controls = useDragControls();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-200 bg-black/35 backdrop-blur-[3px] dark:bg-black/60"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: { duration: 0.34, ease: [0.32, 0.72, 0, 1] } }}
            exit={{ y: "100%", transition: { duration: 0.26, ease: [0.32, 0.72, 0, 1] } }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              // A quick flick is enough; so is a long pull.
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
            className="fixed inset-x-0 bottom-0 z-[201] mx-auto flex w-full max-w-md flex-col rounded-t-[32px] bg-card shadow-2xl"
            style={{ maxHeight: "85dvh" }}
          >
            {/* Grab zone: dragging the handle or title pulls the sheet down */}
            <div
              className="shrink-0 cursor-grab touch-none px-6 pt-4"
              onPointerDown={(e) => controls.start(e)}
            >
              <div className="mx-auto mt-2 mb-6 h-1.5 w-12 rounded-full bg-muted-foreground/25" />

              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-2xl font-display font-bold tracking-[-0.02em] text-foreground">
                  {title}
                </h2>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close"
                  className="-mr-2 h-9 w-9 rounded-full bg-muted/60"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] no-scrollbar">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


let dockActionCount = 0;

/**
 * Docked "+" action: same height as the dock bar, at the right edge beside it.
 * Tells the dock bar to make room (body.has-dock-action).
 */
export function FAB({
  onClick,
  icon: Icon,
  label = "Add",
  open = false,
}: {
  onClick: () => void;
  icon: any;
  label?: string;
  open?: boolean;
}) {
  useEffect(() => {
    dockActionCount += 1;
    document.body.classList.add("has-dock-action");
    return () => {
      dockActionCount -= 1;
      if (dockActionCount <= 0) {
        dockActionCount = 0;
        document.body.classList.remove("has-dock-action");
      }
    };
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 px-5 pb-[calc(18px+env(safe-area-inset-bottom))]",
        open ? "z-[120]" : "z-50"
      )}
    >
      <div className="flex justify-end">
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={onClick}
          aria-label={label}
          className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_28px_rgba(37,99,235,0.35)]"
        >
          <Icon className={cn("h-7 w-7 transition-transform duration-200", open && "rotate-45")} />
        </motion.button>
      </div>
    </div>
  );
}

/**
 * Gradient that keeps white text readable on any photo. Used by every photo hero
 * (Overview, Timeline, trip cards) so they all look and read the same.
 * Place inside a `relative` photo container.
 */
export function HeroScrim() {
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/80 via-black/45 to-transparent" />
    </>
  );
}
