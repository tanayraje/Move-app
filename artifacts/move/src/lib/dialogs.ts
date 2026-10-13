import { toast } from "@/hooks/use-toast";

/**
 * Replacement for window.alert: a non-blocking toast.
 * tone "error" uses the destructive style; everything else is neutral.
 */
export function notify(message: string, tone: "info" | "error" = "info") {
  toast({
    description: message,
    variant: tone === "error" ? "destructive" : "default",
    duration: 3500,
  });
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let current: Pending | null = null;
const listeners = new Set<() => void>();

export function subscribeConfirm(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getPendingConfirm() {
  return current;
}

function emit() {
  listeners.forEach((fn) => fn());
}

/** Replacement for window.confirm. Resolves true when the person confirms. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // A second request while one is open cancels the first.
  current?.resolve(false);
  return new Promise<boolean>((resolve) => {
    current = { ...options, resolve };
    emit();
  });
}

export function settleConfirm(ok: boolean) {
  const p = current;
  current = null;
  emit();
  p?.resolve(ok);
}
