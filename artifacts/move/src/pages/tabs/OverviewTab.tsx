import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { useItinerary, useExpenses, useDocuments, usePlaces } from "@/hooks/use-store";
import { Trip } from "@/lib/types";
import { HeroScrim } from "@/components/ui";
import {
  Calendar,
  FileText,
  Receipt,
  MapPin,
  Plane,
  Clock,
  Heart,
  Building2,
  UtensilsCrossed,
  Bike,
  Plus,
} from "lucide-react";
import { useTripWeather } from "@/hooks/use-weather";
import { motion, AnimatePresence, LayoutGroup, MotionConfig } from "framer-motion";
import { formatCurrency } from "@/lib/countries";
import { safeFormatDate, safeParseDate } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import TripMap from "@/components/TripMap";
import "./overview-motion.css";
import {
  widgetSpring,
  card,
  useFirstView,
  useNow,
  useCountUp,
  Rise,
  rangeOf,
  parseRoute,
  travelKind,
  KIND_ICON,
  Stay,
  buildStays,
} from "./overview/shared";
import { CountdownCard, NextUpRow, TicketCard, OngoingCard, RecapCard } from "./overview/trip-cards";
import { StayCard, AddStayCard, TallTile, WeatherWidget, SmallTile } from "./overview/tiles";

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export default function OverviewTab({ trip }: { trip: Trip }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: itinerary = [] } = useItinerary(trip.id);
  const { data: expenses = [] } = useExpenses(trip.id);
  const { data: documents = [] } = useDocuments(trip.id);
  const { data: places = [] } = usePlaces(trip.id);
  const first = useFirstView(trip.id);
  const now = useNow();
  const { stretches } = useTripWeather(trip);
    const [weatherOpen, setWeatherOpen] = useState(false);

  // "Add stay" prompt can be dismissed per trip; remembered on this device
  const stayPromptKey = `move-hide-stay-prompt:${trip.id}`;
  const [stayPromptHidden, setStayPromptHidden] = useState(() => {
    try {
      return localStorage.getItem(stayPromptKey) === "1";
    } catch {
      return false;
    }
  });
  const hideStayPrompt = () => {
    setStayPromptHidden(true);
    try {
      localStorage.setItem(stayPromptKey, "1");
    } catch {
      /* storage blocked: hidden for this visit only */
    }
  };
  const firstStretch = stretches[0];

  const status = trip.status || (trip.archived ? "archived" : "active");
  const isWishlist = status === "wishlist";

  const totalSpent = expenses.filter(e => e.category !== "settlement").reduce((s, e) => s + e.amount, 0);
  const budgetTotal = trip.budget?.total ?? 0;
  const visitedPlaces = places.filter(p => p.visited).length;

  const spentShown = useCountUp(totalSpent, first);
  const timelineShown = Math.round(useCountUp(itinerary.length, first, 700));
  const docsShown = Math.round(useCountUp(documents.length, first, 700));

  const tripStart = isWishlist ? null : safeParseDate(trip.startDate);
  const tripEnd = isWishlist ? null : safeParseDate(trip.endDate);
  const totalDays = tripStart && tripEnd ? Math.max(differenceInCalendarDays(tripEnd, tripStart) + 1, 1) : 0;

  // Next upcoming item (not yet started)
  const nowStr = `${format(now, "yyyy-MM-dd")}T${format(now, "HH:mm")}`;
  const upcomingItems = [...itinerary]
    .filter(i => i.date && `${i.date}T${i.startTime || "00:00"}` >= nowStr)
    .sort((a, b) => `${a.date}T${a.startTime || "00:00"}`.localeCompare(`${b.date}T${b.startTime || "00:00"}`));
  const nextItem: any = isWishlist ? null : upcomingItems[0] ?? null;

  // Travel item happening right now (flight in the air, train on the move)
  const currentTravel: any =
    isWishlist
      ? null
      : itinerary.find(i => {
          if (i.elementType !== "travel" || !i.date) return false;
          const { start, end } = rangeOf(i);
          return start <= now && now < end;
        }) ?? null;

  // Where the trip is in its life. Decides the top card and the stay card.
  type Phase = "wishlist" | "nodates" | "far" | "close" | "ongoing" | "completed";
  let phase: Phase = "nodates";
  let daysUntil = 0;
  if (isWishlist) phase = "wishlist";
  else if (tripStart && tripEnd) {
    daysUntil = differenceInCalendarDays(tripStart, now);
    if (differenceInCalendarDays(now, tripEnd) > 0) phase = "completed";
    else if (daysUntil >= 1) phase = "far";
    else if (daysUntil === 0) {
      // Departure day: the ticket stays big until the first journey of the day is over.
      const today = format(now, "yyyy-MM-dd");
      const firstTravel = itinerary
        .filter(i => i.elementType === "travel" && i.date === today)
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))[0];
      phase = firstTravel && now < rangeOf(firstTravel).end ? "close" : "ongoing";
    } else phase = "ongoing";
  }

  const dayNum = tripStart ? Math.min(Math.max(differenceInCalendarDays(now, tripStart) + 1, 1), totalDays) : 1;

  // Stay card shows from 3 days before check-in until 2 days after check-out.
  // Prefer a stay that hasn't ended yet, otherwise one that just ended.
  const stays = buildStays(itinerary, trip);
  const inWindow = (s: Stay) => differenceInCalendarDays(s.checkIn, now) <= 3 && differenceInCalendarDays(now, s.checkOut) <= 2;
  const liveIndex = stays.findIndex(s => inWindow(s) && now < s.checkOut);
  const activeIndex = liveIndex !== -1 ? liveIndex : stays.findIndex(inWindow);
  const stay: Stay | undefined = activeIndex === -1 ? undefined : stays[activeIndex];

  // Hero location (city if available)
  let heroLocation = trip.state || trip.destination;
  if (!isWishlist) {
    const today = format(new Date(), "yyyy-MM-dd");
    heroLocation = trip.dayCities?.[today] || trip.state || trip.destination;
  }

  useEffect(() => {
    if (!heroLocation) return;
    if (trip.heroLocation === heroLocation) return;
    (async () => {
      try {
        await supabase.functions.invoke("hero-image", {
          body: { trip_id: trip.id, destination: heroLocation },
        });
        queryClient.invalidateQueries({ queryKey: ["trips", trip.id] });
      } catch (err) {
        console.error("Failed to update hero image", err);
      }
    })();
  }, [trip.id, heroLocation, trip.heroLocation, queryClient]);

  const iconFor = (item: any) =>
    item?.elementType === "travel" ? KIND_ICON[travelKind(item)]
    : item?.elementType === "accommodation" ? Building2
    : item?.elementType === "meal" ? UtensilsCrossed
    : item?.elementType === "activity" ? Bike
    : Clock;

  const overBudget = budgetTotal > 0 && totalSpent > budgetTotal;
  const dayCount = new Set(itinerary.map(i => i.date).filter(Boolean)).size;
  const wishlistLabel = `${dayCount} day${dayCount !== 1 ? "s" : ""} planned`;

  // Top card, chosen by phase
  const ticketItem: any = currentTravel ?? nextItem;
  const ticketRoute = ticketItem?.elementType === "travel" ? parseRoute(ticketItem.title ?? "") : null;

  let topCard: React.ReactNode = null;
  if (phase === "far" && tripStart) {
    topCard = (
      <>
        <CountdownCard days={daysUntil} start={tripStart} totalDays={totalDays} cities={trip.dayCities} place={trip.state || trip.destination || ""} first={first} />
        {nextItem && <NextUpRow item={nextItem} Icon={iconFor(nextItem)} />}
      </>
    );
  } else if (phase === "close" || (phase === "ongoing" && currentTravel)) {
    topCard =
      ticketItem && ticketRoute ? (
        <TicketCard item={ticketItem} route={ticketRoute} now={now} />
      ) : nextItem ? (
        <NextUpRow item={nextItem} Icon={iconFor(nextItem)} />
      ) : null;
  } else if (phase === "ongoing") {
    topCard = <OngoingCard dayNum={dayNum} totalDays={totalDays} nextItem={nextItem} Icon={iconFor(nextItem)} />;
  } else if (phase === "completed" && tripStart && tripEnd) {
    topCard = <RecapCard start={tripStart} end={tripEnd} totalDays={totalDays} cities={trip.dayCities} place={trip.state || trip.destination || ""} first={first} />;
  } else if (phase === "nodates" && nextItem) {
    topCard = <NextUpRow item={nextItem} Icon={iconFor(nextItem)} />;
  }

  const goItinerary = () => navigate(`/trip/${trip.id}/itinerary`);

  return (
    <div className="flex flex-col pb-28">
      {/* Photo hero: runs under the floating header */}
      <div
        className="relative h-[300px] shrink-0"
        style={
          trip.heroImage
            ? { backgroundImage: `url(${trip.heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "linear-gradient(135deg,#2563eb 0%,#3b82f6 100%)" }
        }
      >
        {!trip.heroImage && <Plane className="absolute -right-6 bottom-10 h-44 w-44 text-white/10" />}
        <HeroScrim />
        <div className="absolute inset-x-0 bottom-14 z-10 px-6 text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.5)]">
          {isWishlist && (
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-md [text-shadow:none]" style={{ color: "#0f172a" }}>
              <Heart className="h-3.5 w-3.5 text-pink-500" />
              {wishlistLabel}
            </span>
          )}
          <h2 className="font-display text-4xl font-bold leading-[1.05] tracking-tight">{trip.name}</h2>
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
      <div className="relative z-10 -mt-9 flex flex-col gap-2.5 rounded-t-[34px] bg-background px-4 pt-5 shadow-[0_-12px_30px_rgba(10,20,50,0.16)]">
        {/* Top card: changes with the trip's state */}
        {topCard && (
          <Rise i={0} first={first} className="flex flex-col gap-2.5">
            {topCard}
          </Rise>
        )}

                {/* Stay: shows a few days around the stay. Empty prompt only when no stay exists at all and it hasn't been dismissed. */}
        <AnimatePresence mode="popLayout" initial={false}>
          {!isWishlist && (stay || (stays.length === 0 && !stayPromptHidden)) && (
            <motion.div key="stay-slot" exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.22 } }}>
              <Rise i={1} first={first}>
                {stay ? (
                  <StayCard stay={stay} now={now} tripFar={phase === "far" && daysUntil > 1} count={stays.length} index={activeIndex} />
                ) : (
                  <AddStayCard onAdd={goItinerary} onDismiss={hideStayPrompt} />
                )}
              </Rise>
            </motion.div>
          )}
        </AnimatePresence>

                 <MotionConfig transition={widgetSpring} reducedMotion="user">
          <LayoutGroup>
            {/* Bento: weather tile replaces the Timeline tile when there is weather to show.
                Tapping it grows into the full-width panel; the other tiles and everything below glide into place. */}
             <Rise i={2} first={first}>
              <div
                className="grid grid-cols-2 gap-2.5"
                style={
                  weatherOpen && firstStretch
                    ? { gridTemplateAreas: '"weather weather" "spent docs"', gridTemplateRows: "auto 70px" }
                    : { gridTemplateAreas: '"spent weather" "spent docs"', gridTemplateRows: "70px 70px" }
                }
              >
                <TallTile flat={weatherOpen && !!firstStretch} icon={Receipt} label="Total spent" value={formatCurrency(Math.round(spentShown), "INR")} onClick={() => navigate(`/trip/${trip.id}/expenses`)} />
                {firstStretch ? (
                  <WeatherWidget stretches={stretches} open={weatherOpen} onToggle={() => setWeatherOpen(o => !o)} />
                ) : (
                  <SmallTile area="weather" icon={Calendar} tint="bg-blue-500/15 text-blue-500" label="Timeline" value={timelineShown} onClick={goItinerary} />
                )}
                <SmallTile area="docs" icon={FileText} tint="bg-violet-500/15 text-violet-500" label="Documents" value={docsShown} onClick={() => navigate(`/trip/${trip.id}/documents`)} />
              </div>
            </Rise>

            <motion.div layout="position">
              <Rise i={3} first={first}>
                <button
                  onClick={() => navigate(`/trip/${trip.id}/places`)}
                  className={`${card} flex h-[60px] w-full items-center gap-3 px-3.5 text-left transition-transform active:scale-[0.98]`}
                >
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
                    <MapPin className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-foreground">{visitedPlaces}/{places.length} places visited</p>
                    <p className="text-xs text-muted-foreground">{places.length === 0 ? "Nothing saved yet" : `${places.length - visitedPlaces} to go`}</p>
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground">
                    <Plus className="h-4 w-4" />
                  </span>
                </button>
              </Rise>
            </motion.div>

            {budgetTotal > 0 && (
              <motion.div layout="position">
                <Rise i={4} first={first}>
                  <div
                    className={`rounded-[22px] px-[18px] py-4 text-white shadow-[0_12px_28px_rgba(37,99,235,0.3)] ${
                      overBudget ? "bg-gradient-to-br from-red-500 to-red-400 dark:from-red-500/80 dark:to-red-400/60" : "bg-gradient-to-br from-primary to-blue-400 dark:from-primary/80 dark:to-blue-400/60"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-white/90">
                      <span>{formatCurrency(totalSpent, "INR")} of {formatCurrency(budgetTotal, "INR")}</span>
                      <span className="font-semibold">{overBudget ? "Over budget" : formatCurrency(budgetTotal - totalSpent, "INR") + " left"}</span>
                    </div>
                    <div className="mt-2.5 h-[7px] overflow-hidden rounded-full bg-white/30">
                      <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${Math.min((totalSpent / budgetTotal) * 100, 100)}%` }} />
                    </div>
                  </div>
                </Rise>
              </motion.div>
            )}

            <motion.div layout="position">
              <TripMap trip={trip} />
            </motion.div>
          </LayoutGroup>
        </MotionConfig>
      </div>
    </div>
  );
}
