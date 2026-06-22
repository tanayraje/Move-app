import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Button({ className, variant = 'primary', size = 'default', isLoading, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'outline'|'ghost'|'danger', size?: 'default'|'sm'|'lg'|'icon', isLoading?: boolean }) {
  return (
    <button 
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
        {
          'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90': variant === 'primary',
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

export function BottomSheet({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
          />
         <div
  className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-[32px] bg-card shadow-2xl"
  style={{
    maxHeight: "85vh",
  }}
>
            <div className="flex-1 overflow-y-auto px-6 pb-8 pt-4 no-scrollbar min-h-0">
              <div className="mx-auto mt-2 mb-6 h-1.5 w-12 rounded-full bg-muted-foreground/20" />
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold text-foreground">{title}</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 rounded-full bg-muted/50" onClick={onClose}>
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

export function FAB({ onClick, icon: Icon }: { onClick: () => void, icon: any }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30"
    >
      <Icon className="h-6 w-6" />
    </motion.button>
  );
}
