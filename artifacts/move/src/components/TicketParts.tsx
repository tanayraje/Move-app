import React from "react";
import { Plane, Train, Bus, Car } from "lucide-react";
import { TravelType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Pieces shared by the Timeline travel card and the Documents cards, so a boarding pass looks
 * the same everywhere. Colour code used across the app:
 *   travel = blue, stay = violet, meal = amber, activity / tickets = teal.
 */

/** Notches at the perforation (68% across), top and bottom */
export const TICKET_MASK =
  "radial-gradient(circle 9px at 68% 0, #0000 97%, #000) top / 100% 51% no-repeat, radial-gradient(circle 9px at 68% 100%, #0000 97%, #000) bottom / 100% 51% no-repeat";

export const TICKET_SHADOW = "drop-shadow(0 8px 14px rgba(15,23,42,0.12))";

export const TRAVEL_META: Record<TravelType, { label: string; icon: React.ElementType }> = {
  flight: { label: "Flight", icon: Plane },
  train: { label: "Train", icon: Train },
  bus: { label: "Bus", icon: Bus },
  car: { label: "Car", icon: Car },
};

/** Splits "Delhi (DEL)" / "DEL" into a big airport-style code and a small city name. */
export function splitPlace(place?: string): { big: string; small: string; isCode: boolean } {
  const p = (place ?? "").trim();
  if (!p) return { big: "—", small: "", isCode: false };
  const m = p.match(/\(([A-Za-z]{3})\)|\b([A-Z]{3})\b/);
  const code = m ? (m[1] ?? m[2] ?? "").toUpperCase() : "";
  if (m && code) {
    const name = p.replace(m[0], " ").replace(/[(),-]+/g, " ").replace(/\s+/g, " ").trim();
    return { big: code, small: name, isCode: true };
  }
  return { big: p, small: "", isCode: false };
}

export function PlaceCode({ place, right }: { place?: string; right?: boolean }) {
  const { big, small, isCode } = splitPlace(place);
  return (
    <div className={cn("min-w-0 max-w-[42%] shrink", right && "text-right")}>
      <p
        title={place}
        className={cn(
          "truncate font-display font-bold",
          isCode ? "text-[22px] leading-none" : "text-[16px] leading-tight"
        )}
      >
        {big}
      </p>
      {small && <p className="mt-1 truncate text-[11px] text-muted-foreground">{small}</p>}
    </div>
  );
}
