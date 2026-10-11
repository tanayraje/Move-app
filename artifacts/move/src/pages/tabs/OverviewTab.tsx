import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { differenceInDays, format, isBefore, isAfter, addDays } from "date-fns";
import { useItinerary, useExpenses, useDocuments, usePlaces } from "@/hooks/use-store";
import { Trip } from "@/lib/types";
import { Calendar, FileText, Receipt, MapPin, Plane, Clock, Heart, Building2, UtensilsCrossed, Bike } from "lucide-react";
import { formatCurrency } from "@/lib/countries";
import { safeFormatDate, safeParseDate } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import TripMap from "@/components/TripMap";

export default function OverviewTab({ trip }: { trip: Trip }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: itinerary = [] } = useItinerary(trip.id);
  const { data: expenses = [] } = useExpenses(trip.id);
  const { data: documents = [] } = useDocuments(trip.id);
  const { data: places = [] } = usePlaces(trip.id);

  const status = trip.status || (trip.archived ? 'archived' : 'active');
  const isWishlist = status === 'wishlist';

  const totalSpent = expenses.filter(e => e.category !== "settlement").reduce((s, e) => s + e.amount, 0);
  const budgetTotal = trip.budget?.total ?? 0;
  const visitedPlaces = places.filter(p => p.visited).length;

  // For active trips, show next item; for wishlist, show day count
  let nextItem: typeof itinerary[0] | null = null;
  let tripStatusLabel = '';

  if (isWishlist) {
    const dayCount = new Set(itinerary.map(i => i.date).filter(Boolean)).size;
    tripStatusLabel = `${dayCount} day${dayCount !== 1 ? 's' : ''} planned`;
  } else {
    const now = new Date();
    const tripStart = safeParseDate(trip.startDate);
    const tripEnd = safeParseDate(trip.endDate);
    if (!tripStart || !tripEnd) {
      tripStatusLabel = 'Trip';
    } else {
      const daysUntil = differenceInDays(tripStart, now);

    if (isAfter(now, tripEnd)) tripStatusLabel = 'Past Trip';
    else if (isBefore(now, tripStart)) tripStatusLabel = daysUntil === 0 ? 'Starts Today!' : `${daysUntil} day${daysUntil === 1 ? '' : 's'} to go`;
    else {
      const dayNum = differenceInDays(now, tripStart) + 1;
      tripStatusLabel = `Day ${dayNum}`;
    }
    }

    // Next upcoming item
    const nowStr = `${format(now, 'yyyy-MM-dd')}T${format(now, 'HH:mm')}`;
    const upcomingItems = [...itinerary]
      .filter(i => i.date && `${i.date}T${i.startTime}` >= nowStr)
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
    nextItem = upcomingItems[0] ?? null;
  }

// ==========================================
// Hero location (city if available)
// ==========================================

let heroLocation = trip.state || trip.destination;

if (!isWishlist) {
  const today = format(new Date(), "yyyy-MM-dd");

  heroLocation =
    trip.dayCities?.[today] ||
    trip.state ||
    trip.destination;
}

useEffect(() => {
  if (!heroLocation) return;

  if (trip.heroLocation === heroLocation) return;

  (async () => {
    try {
      await supabase.functions.invoke("hero-image", {
        body: {
          trip_id: trip.id,
          destination: heroLocation,
        },
      });

      queryClient.invalidateQueries({
        queryKey: ["trips", trip.id],
      });
    } catch (err) {
      console.error("Failed to update hero image", err);
    }
  })();
}, [
  trip.id,
  heroLocation,
  trip.heroLocation,
  queryClient,
]);

const NextIcon =
  nextItem?.elementType === "travel" ? Plane
  : nextItem?.elementType === "accommodation" ? Building2
  : nextItem?.elementType === "meal" ? UtensilsCrossed
  : nextItem?.elementType === "activity" ? Bike
  : Clock;
const overBudget = budgetTotal > 0 && totalSpent > budgetTotal;
const card = "rounded-[22px] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]";

return (
    <div className="flex flex-col pb-28">
      {/* Photo hero: runs under the floating header */}
      <div
        className="relative h-[340px] shrink-0"
        style={
          trip.heroImage
            ? { backgroundImage: `url(${trip.heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "linear-gradient(135deg,#2563eb 0%,#3b82f6 100%)" }
        }
      >
        {!trip.heroImage && <Plane className="absolute -right-6 bottom-10 h-44 w-44 text-white/10" />}
        {/* Legibility: soften busy photos where the text sits (progressive blur + darkening) */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[58%] backdrop-blur-md"
          style={{
            WebkitMaskImage: "linear-gradient(to top, #000 40%, transparent)",
            maskImage: "linear-gradient(to top, #000 40%, transparent)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-[66%] bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-14 z-10 px-6 text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.5)]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-md [text-shadow:none]">
            {isWishlist ? <Heart className="h-3.5 w-3.5 text-pink-500" /> : <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
            {tripStatusLabel}
          </span>
          <h2 className="mt-3 font-display text-4xl font-bold leading-[1.05] tracking-tight">{trip.name}</h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-white">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {heroLocation}
              {!isWishlist && (
                <>
                  {" "}· {safeFormatDate(trip.startDate, d => format(d, "MMM d"), "")} –{" "}
                  {safeFormatDate(trip.endDate, d => format(d, "MMM d, yyyy"), "")}
                </>
              )}
            </span>
          </p>
        </div>
      </div>

      {/* Content sheet slides over the photo */}
      <div className="relative z-10 -mt-9 flex flex-col gap-3 rounded-t-[34px] bg-background px-4 pt-5 shadow-[0_-12px_30px_rgba(10,20,50,0.16)]">
        {nextItem && !isWishlist && (
          <div className={`${card} flex items-center gap-3.5 p-3.5`}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <NextIcon className="h-[22px] w-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Next up</p>
              <p className="truncate text-[15px] font-semibold text-foreground">{nextItem.title}</p>
              <p className="text-xs text-muted-foreground">
                {safeFormatDate(nextItem.date, d => format(d, "MMM d"), nextItem.date)} · {nextItem.startTime}–{nextItem.endTime}
              </p>
              {nextItem.location && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{nextItem.location}</span>
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Calendar} tint="bg-blue-50 text-primary" label="Timeline items" value={itinerary.length} onClick={() => navigate(`/trip/${trip.id}/itinerary`)} />
          <StatCard icon={Receipt} tint="bg-emerald-50 text-emerald-600" label="Total spent" value={formatCurrency(totalSpent, "INR")} onClick={() => navigate(`/trip/${trip.id}/expenses`)} />
          <StatCard icon={MapPin} tint="bg-orange-50 text-orange-600" label="Places" value={`${visitedPlaces}/${places.length}`} sub="visited" onClick={() => navigate(`/trip/${trip.id}/places`)} />
          <StatCard icon={FileText} tint="bg-violet-50 text-violet-600" label="Documents" value={documents.length} onClick={() => navigate(`/trip/${trip.id}/documents`)} />
        </div>

        {budgetTotal > 0 && (
          <div
            className={`rounded-[22px] px-[18px] py-4 text-white shadow-[0_12px_28px_rgba(37,99,235,0.3)] ${
              overBudget ? "bg-gradient-to-br from-red-500 to-red-400" : "bg-gradient-to-br from-primary to-blue-400"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-white/90">
              <span>{formatCurrency(totalSpent, "INR")} of {formatCurrency(budgetTotal, "INR")}</span>
              <span className="font-semibold">
                {overBudget ? "Over budget" : formatCurrency(budgetTotal - totalSpent, "INR") + " left"}
              </span>
            </div>
            <div className="mt-2.5 h-[7px] overflow-hidden rounded-full bg-white/30">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.min((totalSpent / budgetTotal) * 100, 100)}%` }} />
            </div>
          </div>
        )}

        <TripMap trip={trip} />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tint,
  onClick,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  tint: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-[22px] bg-card p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] transition-transform active:scale-[0.98]"
    >
      <div className={`flex h-[34px] w-[34px] items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-[17px] w-[17px]" />
      </div>
      <p className="mt-2.5 font-display text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}{sub ? ` · ${sub}` : ""}</p>
    </button>
  );
}
