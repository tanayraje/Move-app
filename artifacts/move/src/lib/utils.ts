import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Trip, TripStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTripStatus(trip: Trip): TripStatus {
  if (trip.status) return trip.status;
  return trip.archived ? 'archived' : 'active';
}

export const generateId = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

/**
 * Safely parse a date string (YYYY-MM-DD or ISO format) to a Date object.
 * Returns null if the string is invalid or unparseable.
 */
export function safeParseDate(str: string | undefined | null): Date | null {
  if (!str || typeof str !== 'string') return null;
  // Extract YYYY-MM-DD if present
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    const d = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
    if (isNaN(d.getTime())) return null;
    return d;
  }
  // Try full ISO parse as fallback
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Format a date string safely using date-fns. Returns the fallback string if invalid.
 */
export function safeFormatDate(
  str: string | undefined | null,
  formatFn: (d: Date) => string,
  fallback: string = ''
): string {
  const d = safeParseDate(str);
  if (!d) return fallback;
  try {
    return formatFn(d);
  } catch {
    return fallback;
  }
}

/**
 * Check if a string is a "Day N" wishlist label (e.g. "Day 1", "Day 2").
 */
export function isDayLabel(str: string): boolean {
  return /^Day\s+\d+$/i.test(str);
}

/**
 * Extract day number from a "Day N" label. Returns null if not a day label.
 */
export function getDayNumber(str: string): number | null {
  const match = str.match(/^Day\s+(\d+)$/i);
  return match ? Number(match[1]) : null;
}
