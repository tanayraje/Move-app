import React from "react";
import { useLocation } from "wouter";
import { differenceInDays, format, isBefore, isAfter, addDays } from "date-fns";
import { useItinerary, useExpenses, useDocuments, usePlaces } from "@/hooks/use-store";
import { Trip } from "@/lib/types";
import { Calendar, FileText, Receipt, MapPin, Plane, Clock, Heart } from "lucide-react";
import { formatCurrency } from "@/lib/countries";
import { safeFormatDate, safeParseDate } from "@/lib/utils";

export default function OverviewTab({ trip }: { trip: Trip }) {
  const [, navigate] = useLocation();
  const { data: itinerary = [] } = useItinerary(trip.id);
  const { data: expenses = [] } = useExpenses(trip.id);
  const { data: documents = [] } = useDocuments(trip.id);
  const { data: places = [] } = usePlaces(trip.id);

  const status = trip.status || (trip.archived ? 'archived' : 'active');
  const isWishlist = status === 'wishlist';

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
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

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Hero card */}
      <div className="bg-primary text-primary-foreground rounded-[2rem] p-6 shadow-xl shadow-primary/20 relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 opacity-10">
          <Plane className="w-44 h-44" />
        </div>
        <div className="relative z-10">
          <p className="text-primary-foreground/70 font-medium text-sm mb-0.5">{trip.destination}</p>
          <h2 className="text-3xl font-display font-extrabold mb-3">{tripStatusLabel}</h2>
          <div className="flex items-center gap-2 text-sm font-medium bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl w-fit">
            {isWishlist ? (
              <>
                <Heart className="w-4 h-4 text-pink-300" /> Saved to Wishlist
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                {safeFormatDate(trip.startDate, d => format(d, 'MMM d'), '')} – {safeFormatDate(trip.endDate, d => format(d, 'MMM d, yyyy'), '')}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Next item */}
      {nextItem && !isWishlist && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Next Up</p>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-foreground">{nextItem.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {safeFormatDate(nextItem.date, d => format(d, 'MMM d'), nextItem.date)} · {nextItem.startTime}–{nextItem.endTime}
              </p>
              {nextItem.location && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{nextItem.location}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
  <StatCard
    icon={Calendar}
    label="Timeline Items"
    value={itinerary.length}
    onClick={() => navigate(`/trip/${trip.id}/itinerary`)}
  />

  <StatCard
    icon={Receipt}
    label="Total Spent"
    value={formatCurrency(totalSpent, 'INR')}
    onClick={() => navigate(`/trip/${trip.id}/expenses`)}
  />

  <StatCard
    icon={MapPin}
    label="Places"
    value={`${visitedPlaces}/${places.length}`}
    sub="visited"
    onClick={() => navigate(`/trip/${trip.id}/places`)}
  />

  <StatCard
    icon={FileText}
    label="Documents"
    value={documents.length}
    onClick={() => navigate(`/trip/${trip.id}/documents`)}
  />
</div>

      {/* Budget summary */}
      {budgetTotal > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Budget</p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-foreground font-medium">
              {formatCurrency(totalSpent, 'INR')} spent of {formatCurrency(budgetTotal, 'INR')}
            </span>
            <span className={`text-xs font-bold ${totalSpent > budgetTotal ? 'text-red-500' : 'text-primary'}`}>
              {totalSpent > budgetTotal ? 'Over budget' : formatCurrency(budgetTotal - totalSpent, 'INR') + ' left'}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${totalSpent > budgetTotal ? 'bg-red-500' : 'bg-primary'}`}
              style={{ width: `${Math.min((totalSpent / budgetTotal) * 100, 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  onClick,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <button
  onClick={onClick}
  className="bg-card border border-border/60 p-4 rounded-2xl shadow-sm flex flex-col text-left transition-transform active:scale-[0.98]"
>
      <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </button>
  );
}
