import { useSyncExternalStore } from "react";

export type ThemeMode = "system" | "light" | "dark";

const KEY = "move-theme";
const LIGHT_BAR = "#f8fafc";
const DARK_BAR = "#0b0b0d";

const listeners = new Set<() => void>();
const media =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage unavailable */
  }
  return "system";
}

export function isDark(mode: ThemeMode = getThemeMode()) {
  return mode === "dark" || (mode === "system" && !!media?.matches);
}

/** Puts the class on <html> and keeps the browser bar colour in step. */
export function applyTheme(mode: ThemeMode = getThemeMode()) {
  const dark = isDark(mode);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", dark ? DARK_BAR : LIGHT_BAR);
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
  applyTheme(mode);
  listeners.forEach((fn) => fn());
}

/** Call once at startup. Follows the system setting while mode is "system". */
export function initTheme() {
  applyTheme();
  media?.addEventListener?.("change", () => {
    if (getThemeMode() === "system") {
      applyTheme("system");
      listeners.forEach((fn) => fn());
    }
  });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, getThemeMode, () => "system" as ThemeMode);
}
