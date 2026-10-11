import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Button({ className, variant = 'primary', size = 'default', isLoading, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'outline'|'ghost'|'danger', size?: 'default'|'sm'|'lg'|'icon', isLoading?: boolean }) {
  return (
    <button 
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
        {
          'bg-primary text-primary-foreground shadow-sm shadow-black/10 hover:bg-primary/90': variant === 'primary',
          'bg-muted text-foreground hover:bg-muted/80': variant === 'secondary',
          'border-2 border-border bg-transparent hover:bg-muted/50 text-foreground': variant === 'outline',
          'bg-transparent hover:bg-muted text-foreground': variant === 'ghost',
          'bg-red-500 text-white shadow-lg shadow-red-500/25 hover:bg-red-600': variant === 'danger',
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
        "flex h-12 w-full rounded-xl border-2 border-border bg-card px-4 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
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
        "flex h-12 w-full rounded-xl border-2 border-border bg-card px-4 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all appearance-none",
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

export function BottomSheet({
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
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-200 bg-foreground/20 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "tween",
              duration: 0.3,
              ease: "easeInOut",
            }}
            className="fixed inset-x-0 bottom-0 z-[201] mx-auto flex w-full max-w-md flex-col rounded-t-[32px] bg-card shadow-2xl"
            style={{
              maxHeight: "85vh",
              minHeight: 0,
          }}
          >
            <div
  className="overflow-y-auto px-6 pb-8 pt-4 no-scrollbar"
  style={{ maxHeight: "calc(85vh - 80px)" }}
>
              <div className="mx-auto mt-2 mb-6 h-1.5 w-12 rounded-full bg-muted-foreground/20" />

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold text-foreground">
                  {title}
                </h2>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -mr-2 rounded-full bg-muted/50"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

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
 * Docked "+" action: the same height as the dock pill, sitting right beside it.
 * Tells trip dock bars to slide left so the pair stays centred.
 * `barWidth` is the width of the bar it sits next to (default: the 5-tab trip bar).
 */
export function FAB({
  onClick,
  icon: Icon,
  label = "Add",
  open = false,
  barWidth = 272,
}: {
  onClick: () => void;
  icon: any;
  label?: string;
  open?: boolean;
  barWidth?: number;
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
        "pointer-events-none fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 px-4 pb-[calc(18px+env(safe-area-inset-bottom))]",
        open ? "z-[70]" : "z-50"
      )}
    >
      <div className="flex justify-center">
        <div style={{ transform: `translateX(${barWidth / 2 + 6}px)` }}>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={onClick}
            aria-label={label}
            className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#4F86F7] to-primary text-primary-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.55),inset_0_-3px_8px_rgba(15,40,120,0.28),0_16px_30px_-6px_rgba(37,99,235,0.55)]"
          >
            <Icon className={cn("h-7 w-7 transition-transform duration-200", open && "rotate-45")} />
          </motion.button>
        </div>
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
