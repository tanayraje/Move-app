import { notify, confirmDialog } from "@/lib/dialogs";
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCityImage } from "@/lib/city-image";
import { format, addDays, differenceInDays } from "date-fns";
import {
  Plus,
  Trash2,
  CalendarDays,
  Plane,
  Building2,
  UtensilsCrossed,
  Bike,
  Check,
  Clock,
  Pencil,
  Route,
  Wallet,
} from "lucide-react";
import {
  useItinerary,
  useSaveItineraryItem,
  useDeleteItineraryItem,
  useReorderItinerary,
  useDocuments,
  useUpdateTrip,
} from "@/hooks/use-store";
import { Trip, ItineraryItem, ElementType } from "@/lib/types";
import { cn, safeFormatDate, safeParseDate, isDayLabel, getTripStatus } from "@/lib/utils";
import { FAB, HeroScrim } from "@/components/ui";
import { AddMenu } from "@/components/AddMenu";
import { useTripWeather, WEATHER_ICONS } from "@/hooks/use-weather";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { parseTime, addMinutesToTime, getDuration, sortItems, NowMarker, GapLabel } from "./itinerary/shared";
import { AccommodationCard } from "./itinerary/AccommodationCard";
import { SortableItem } from "./itinerary/TimelineItemCard";
import { AddEditSheet } from "./itinerary/AddEditSheet";

// ─── Main Tab ─────────────────────────────────────────────────────────────────
export default function ItineraryTab({ trip }: { trip: Trip }) {
  const { data: allItems = [] } = useItinerary(trip.id);
  const { mutate: reorder } = useReorderItinerary();
const { mutate: updateTrip } = useUpdateTrip();
const queryClient = useQueryClient();
const { mutate: deleteItem } = useDeleteItineraryItem();
const { mutate: saveItem } = useSaveItineraryItem();
const { data: documents = [] } = useDocuments(trip.id);

  const status = trip.status || (trip.archived ? 'archived' : 'active');
  const isWishlist = status === 'wishlist';

  const [selectedDate, setSelectedDate] = useState<string>(isWishlist ? 'Day 1' : trip.startDate);
  const touchStartX = useRef(0);
const touchStartY = useRef(0);
  const swipeIgnored = useRef(false);
const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);


  const [isAddOpen, setIsAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addType, setAddType] = useState<ElementType | undefined>(undefined);
  const [addKey, setAddKey] = useState(0);
  const [editItem, setEditItem] = useState<ItineraryItem | null>(null);
  const [editingCity, setEditingCity] = useState(false);
  const [cityDraft, setCityDraft] = useState('');
  const cityInputRef = useRef<HTMLInputElement>(null);
const dayScrollerRef = useRef<HTMLDivElement>(null);

  const wishlistDays = useMemo(() => {
  const count = Math.max(trip.wishlistDayCount ?? 1, 1);

  return Array.from(
    { length: count },
    (_, i) => `Day ${i + 1}`
  );
}, [trip.wishlistDayCount]);

  const startDateParsed = safeParseDate(trip.startDate);
  const endDateParsed = safeParseDate(trip.endDate);
  const daysCount = isWishlist ? wishlistDays.length
    : startDateParsed && endDateParsed ? differenceInDays(endDateParsed, startDateParsed) + 1 : 0;
  const days = isWishlist ? wishlistDays
  : startDateParsed ? Array.from({ length: daysCount }).map((_, i) =>
      format(addDays(startDateParsed, i), 'yyyy-MM-dd')
    ) : [];

useEffect(() => {
  if (isWishlist || days.length === 0) return;

  const today = format(new Date(), "yyyy-MM-dd");

  if (today < days[0]) {
    setSelectedDate(days[0]);
  } else if (today > days[days.length - 1]) {
    setSelectedDate(days[0]);
  } else if (days.includes(today)) {
    setSelectedDate(today);
  }
}, [trip.id]);

const currentDayIndex = days.indexOf(selectedDate);

const goToNextDay = useCallback(() => {
  if (currentDayIndex < days.length - 1) {
    setSwipeDirection(1);
    setSelectedDate(days[currentDayIndex + 1]);
  }
}, [currentDayIndex, days]);

const goToPreviousDay = useCallback(() => {
  if (currentDayIndex > 0) {
    setSwipeDirection(-1);
    setSelectedDate(days[currentDayIndex - 1]);
  }
}, [currentDayIndex, days]);

const handleTouchStart = (e: React.TouchEvent) => {
  touchStartX.current = e.touches[0].clientX;
  touchStartY.current = e.touches[0].clientY;
  // Scrolling the day chips sideways must not count as "swipe to the next day"
  swipeIgnored.current = !!(e.target as HTMLElement).closest("[data-no-swipe]");
};

const handleTouchEnd = (e: React.TouchEvent) => {
  if (swipeIgnored.current) return;
  const dx = e.changedTouches[0].clientX - touchStartX.current;
  const dy = e.changedTouches[0].clientY - touchStartY.current;

  if (Math.abs(dx) < 60) return;
  if (Math.abs(dx) < Math.abs(dy)) return;

  if (dx < 0) {
    goToNextDay();
  } else {
    goToPreviousDay();
  }
};

  const sortedItems = useMemo(() => sortItems(allItems), [allItems]);
  const filteredItems = useMemo(() =>
    sortedItems.filter(i => i.date === selectedDate && i.elementType !== 'accommodation'),
    [sortedItems, selectedDate]
  );

  const activeAccommodations = useMemo(() =>
    allItems.filter(i =>
      i.elementType === 'accommodation' &&
      i.date <= selectedDate &&
      (i.endDate ?? i.date) >= selectedDate
    ),
    [allItems, selectedDate]
  );

  const totalDayMinutes = useMemo(() =>
    filteredItems.reduce((sum, item) => {
      const s = parseTime(item.startTime);
      const e = parseTime(item.endTime);
      return sum + (e >= s ? e - s : 0);
    }, 0), [filteredItems]
  );

  const travelMinutes = useMemo(() =>
    filteredItems
      .filter(item => item.elementType === 'travel')
      .reduce((sum, item) => {
        const st = parseTime(item.startTime);
        const en = parseTime(item.endTime);
        return sum + (en >= st ? en - st : 0);
      }, 0), [filteredItems]
  );

  const totalDayCost = useMemo(() =>
    filteredItems.reduce((sum, item) => sum + (item.cost ?? 0), 0), [filteredItems]
  );

  const dayCities = trip.dayCities ?? {};
  const currentCity = dayCities[selectedDate] ?? '';
  const { byDate: weatherByDate } = useTripWeather(trip);
  const dayWeather = weatherByDate[selectedDate];
  const DayWeatherIcon = dayWeather ? WEATHER_ICONS[dayWeather.kind] : null;

  // Timeline header photo follows the city of the selected day (everywhere else uses the trip photo)
  const cityHint = trip.state || trip.destination;
  const cityKey = currentCity.trim().toLowerCase();
  const { data: cityImage, isLoading: cityImageLoading } = useQuery({
    queryKey: ["city-image", cityKey, (cityHint ?? "").toLowerCase()],
    queryFn: () => fetchCityImage(currentCity, cityHint),
    enabled: !!cityKey,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  // Warm the cache for the other days' cities so switching days is instant
  const allCitiesKey = Object.values(dayCities).map(c => String(c).trim().toLowerCase()).filter(Boolean).join("|");
  useEffect(() => {
    const unique = Array.from(new Set(allCitiesKey.split("|").filter(Boolean)));
    unique.forEach(name => {
      queryClient.prefetchQuery({
        queryKey: ["city-image", name, (cityHint ?? "").toLowerCase()],
        queryFn: () => fetchCityImage(name, cityHint),
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
      });
    });
  }, [allCitiesKey, cityHint, queryClient]);

  const saveCity = (val: string) => {
  const trimmed = val.trim();

  const updatedDayCities = { ...dayCities };

  if (trimmed) {
    updatedDayCities[selectedDate] = trimmed;
  } else {
    delete updatedDayCities[selectedDate];
  }

  const updatedTrip = {
  ...trip,
  dayCities: updatedDayCities,
};

queryClient.setQueryData(
  ["trips", trip.id],
  updatedTrip
);

queryClient.setQueryData(
  ["trips"],
  (trips: Trip[] | undefined) =>
    trips?.map((t) =>
      t.id === trip.id ? updatedTrip : t
    ) ?? []
);

updateTrip(updatedTrip);

  setEditingCity(false);
};

  const deleteWishlistDay = async (day: string) => {
  if (!isWishlist) return;

  const currentDayCount = trip.wishlistDayCount ?? 1;

  if (currentDayCount <= 1) {
    notify("You must keep at least one day.", "error");
    return;
  }

  const hasAccommodation = allItems.some(
    (item) =>
      item.elementType === "accommodation" &&
      item.date === day
  );

  if (hasAccommodation) {
    notify(
      "Delete or edit the accommodation for this day before deleting the day.",
      "error"
    );
    return;
  }

  const ok = await confirmDialog({
    title: `Delete ${day}?`,
    message: "This permanently deletes every itinerary item scheduled for this day. It cannot be undone.",
    confirmLabel: "Delete day",
    destructive: true,
  });
  if (!ok) return;

  const deletedDay = parseInt(day.replace("Day ", ""), 10);

  // Rebuild dayCities without the deleted day.
  // Days after the deleted day shift down by one.
  const updatedDayCities: Record<string, string> = {};

  Object.entries(dayCities).forEach(([date, city]) => {
    const match = date.match(/^Day\s+(\d+)$/i);

    if (!match) {
      updatedDayCities[date] = city;
      return;
    }

    const cityDay = parseInt(match[1], 10);

    // Completely remove the deleted day's city.
    if (cityDay === deletedDay) {
      return;
    }

    // Shift later days down.
    if (cityDay > deletedDay) {
      updatedDayCities[`Day ${cityDay - 1}`] = city;
    } else {
      updatedDayCities[date] = city;
    }
  });

  // Update / delete itinerary items.
  allItems.forEach((item) => {
    const dayMatch = item.date.match(/^Day\s+(\d+)$/i);

    if (!dayMatch) return;

    const itemDay = parseInt(dayMatch[1], 10);

    // Delete everything belonging to the deleted day.
    if (itemDay === deletedDay) {
      deleteItem({
        tripId: trip.id,
        id: item.id,
      });
      return;
    }

    // Shift later itinerary items down by one day.
    if (itemDay > deletedDay) {
      const updated = {
        ...item,
        date: `Day ${itemDay - 1}`,
      };

      // Shift accommodation checkout day as well.
      if (updated.endDate) {
        const endMatch = updated.endDate.match(/^Day\s+(\d+)$/i);

        if (endMatch) {
          const endDay = parseInt(endMatch[1], 10);

          if (endDay > deletedDay) {
            updated.endDate = `Day ${endDay - 1}`;
          }
        }
      }

      saveItem(updated);
    }
  });

  // Save the cleaned city map and new day count.
  updateTrip({
    ...trip,
    dayCities: updatedDayCities,
    wishlistDayCount: currentDayCount - 1,
  });

  // Move selection to a valid remaining day.
  if (selectedDate === day) {
    const newDay = Math.min(
      deletedDay,
      currentDayCount - 1
    );

    setSelectedDate(`Day ${Math.max(newDay, 1)}`);
  }
};

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filteredItems.findIndex(i => i.id === active.id);
    const newIndex = filteredItems.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filteredItems, oldIndex, newIndex);
    const repositioned = reordered.map((item, idx) => {
      if (idx === 0) return item;
      const prev = reordered[idx - 1];
      const start = parseTime(item.startTime);
const end = parseTime(item.endTime);

const dur = Math.max(
  end >= start ? end - start : 24 * 60 - start + end,
  30
);
      const newStart = prev.endTime;
      return { ...item, startTime: newStart, endTime: addMinutesToTime(newStart, dur) };
    });

    reorder({ tripId: trip.id, items: [...allItems.filter(i => i.date !== selectedDate || i.elementType === 'accommodation'), ...repositioned] });
  }, [filteredItems, allItems, selectedDate, trip.id, reorder]);

  // Centre the selected day chip. Scrolls the chip row sideways only (scrollIntoView also scrolled the
// page, and `days` is a new array every render, so it kept dragging the page back up).
  const daysKey = days.join(",");
  useEffect(() => {
    const track = dayScrollerRef.current;
    const row = track?.parentElement;
    const chip = track?.children[days.indexOf(selectedDate)] as HTMLElement | undefined;
    if (!row || !chip) return;
    row.scrollTo({
      left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2,
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, daysKey]);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const nowTime = format(new Date(), "HH:mm");
  const nowIndex =
    !isWishlist && selectedDate === todayStr
      ? (() => {
          const idx = filteredItems.findIndex(i => (i.startTime || "") > nowTime);
          return idx === -1 ? filteredItems.length : idx;
        })()
      : -1;
  const isDone = (i: ItineraryItem) =>
    !isWishlist &&
    (selectedDate < todayStr || (selectedDate === todayStr && (i.endTime || i.startTime || "") <= nowTime));
  const toMinutes = (t?: string) => {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
  };
  const gapAfter = (a: ItineraryItem, b?: ItineraryItem) => {
    if (!b) return "";
    const end = toMinutes(a.endTime || a.startTime);
    const start = toMinutes(b.startTime);
    if (end === null || start === null) return "";
    const g = start - end;
    if (g < 20) return "";
    const h = Math.floor(g / 60);
    const m = g % 60;
    return `${h ? `${h}h ` : ""}${m ? `${m}m` : ""}`.trim() + " free";
  };
  const dayIndex = days.indexOf(selectedDate);
  const startCityEdit = () => {
    setCityDraft(currentCity);
    setEditingCity(true);
  };
  // City photo when the day has a city; the trip photo only when it has none or no city photo exists.
  // While a city photo loads we show the neutral gradient, never another city's picture.
  const heroImage = cityKey ? cityImage ?? (cityImageLoading ? null : trip.heroImage) : trip.heroImage;
  const heroStyle = heroImage
    ? { backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: "linear-gradient(135deg,#2563eb 0%,#3b82f6 100%)" };
  const chipShadow = "shadow-[0_1px_2px_rgba(15,23,42,0.05),0_6px_14px_-4px_rgba(15,23,42,0.1)]";

  return (
    <div className="relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Photo header: city + date only (day strip lives below, no overlap) */}
      <div
        className="relative flex min-h-[262px] flex-col justify-end px-6 pb-12 pt-[calc(76px+env(safe-area-inset-top))] text-white"
        style={heroStyle}
      >
        <HeroScrim />
        <div className="relative flex items-end justify-between gap-3 [text-shadow:0_1px_14px_rgba(0,0,0,0.5)]">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-white/90">
              {isDayLabel(selectedDate)
                ? selectedDate
                : safeFormatDate(selectedDate, d => format(d, "EEEE, MMMM d"), selectedDate)}
            </p>
            {editingCity ? (
              <div className="mt-1 flex items-center gap-2 [text-shadow:none]">
                <input
                  ref={cityInputRef}
                  autoFocus
                  value={cityDraft}
                  onChange={e => setCityDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") saveCity(cityDraft);
                    if (e.key === "Escape") setEditingCity(false);
                  }}
                  placeholder="City name…"
                  className="w-48 min-w-0 border-b-2 border-white bg-transparent font-display text-3xl font-bold text-white outline-none placeholder:text-white/60"
                />
                <button aria-label="Save city" onClick={() => saveCity(cityDraft)}>
                  <Check className="h-6 w-6 text-white" />
                </button>
              </div>
            ) : currentCity ? (
              <button onClick={startCityEdit} aria-label="Edit city" className="flex items-center gap-2 text-left">
                <h2 className="font-display text-[38px] font-bold leading-[1.1] tracking-tight">{currentCity}</h2>
                <Pencil className="h-4 w-4 shrink-0 text-white/70" />
              </button>
            ) : (
              <button onClick={startCityEdit} className="text-left text-base italic text-white/85">
                Tap to add city…
              </button>
            )}
          </div>
                    {dayIndex >= 0 && (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {dayWeather && DayWeatherIcon && (
                <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur-md [text-shadow:none]">
                  <DayWeatherIcon className="h-3.5 w-3.5" />
                  {dayWeather.rainFrom ? `${dayWeather.high}° · rain ${dayWeather.rainFrom}` : `${dayWeather.high}° / ${dayWeather.low}°`}
                </span>
              )}
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-md [text-shadow:none]" style={{ color: "#0f172a" }}>
                {isWishlist ? selectedDate : `Day ${dayIndex + 1} of ${days.length}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content sheet slides over the photo */}
      <div className="relative z-10 -mt-7 min-h-[60dvh] rounded-t-[34px] bg-background px-4 pb-40 pt-5 shadow-[0_-12px_30px_rgba(10,20,50,0.16)]">
        {/* Day strip (solid chips, not glass) */}
        <div data-no-swipe className="relative -mx-4 -mb-3 overflow-x-auto px-4 pb-6 no-scrollbar">
          <div ref={dayScrollerRef} className="flex min-w-max gap-2 pt-1">
            {days.map(day => {
              const isSelected = selectedDate === day;
              const hasItems = allItems.some(i => i.date === day && i.elementType !== "accommodation");
              const hasAccom = allItems.some(
                i => i.elementType === "accommodation" && i.date <= day && (i.endDate ?? i.date) >= day
              );
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "flex h-[76px] w-[58px] shrink-0 flex-col items-center justify-center rounded-[22px] transition",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-[0_10px_18px_-6px_hsl(var(--primary)/0.55)] dark:shadow-none"
                      : `bg-card text-foreground ${chipShadow}`
                  )}
                >
                  <span className="text-[10.5px] opacity-75">
                    {isDayLabel(day) ? "Day" : safeFormatDate(day, d => format(d, "EEE"), "")}
                  </span>
                  <span className="font-display text-lg font-bold leading-tight">
                    {isDayLabel(day) ? day.replace("Day ", "") : safeFormatDate(day, d => format(d, "d"), "")}
                  </span>
                  <span className="mt-1 flex h-1 items-center gap-0.5">
                    {hasItems && <i className={cn("h-1 w-1 rounded-full", isSelected ? "bg-white" : "bg-primary")} />}
                    {hasAccom && <i className={cn("h-1 w-1 rounded-full", isSelected ? "bg-white/70" : "bg-violet-500")} />}
                  </span>
                </button>
              );
            })}
            {isWishlist && (
              <button
                aria-label="Add day"
                onClick={() => {
                  const newCount = (trip.wishlistDayCount ?? 1) + 1;
                  updateTrip({ ...trip, wishlistDayCount: newCount });
                  setSelectedDate(`Day ${newCount}`);
                }}
                className="flex h-[76px] w-[58px] shrink-0 items-center justify-center rounded-[22px] border-2 border-dashed border-border text-muted-foreground"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Day summary */}
        <div className="mb-5 mt-2 flex items-center justify-between px-0.5 text-[13px]">
          <div className="flex items-center gap-4 text-muted-foreground">
            {totalDayMinutes > 0 && (
              <span className="flex items-center gap-1.5" title="Planned time">
                <Clock className="h-4 w-4" />
                {getDuration("00:00", addMinutesToTime("00:00", totalDayMinutes))}
              </span>
            )}
            {travelMinutes > 0 && (
              <span className="flex items-center gap-1.5" title="Travel time">
                <Route className="h-4 w-4 text-blue-500" />
                {getDuration("00:00", addMinutesToTime("00:00", travelMinutes))}
              </span>
            )}
            {totalDayCost > 0 && (
              <span className="flex items-center gap-1.5" title="Planned spend">
                <Wallet className="h-4 w-4" />₹{Math.round(totalDayCost).toLocaleString("en-IN")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isWishlist && (trip.wishlistDayCount ?? 1) > 1 && (
              <button
                type="button"
                aria-label="Delete day"
                onClick={() => deleteWishlistDay(selectedDate)}
                className={`flex h-[34px] w-[34px] items-center justify-center rounded-full bg-card text-destructive ${chipShadow}`}
              >
                <Trash2 className="h-[15px] w-[15px]" />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait" custom={swipeDirection}>
          <motion.div
            key={selectedDate}
            custom={swipeDirection}
            initial={{ x: swipeDirection > 0 ? 16 : -16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: swipeDirection > 0 ? -16 : 16, opacity: 0 }}
            transition={{
              x: { duration: 0.22, ease: "easeInOut" },
              opacity: { duration: 0.18 },
            }}
          >
            {/* Stays */}
            {activeAccommodations.map(accom => (
              <AccommodationCard
                key={accom.id}
                item={accom}
                trip={trip}
                currentDay={selectedDate}
                onEdit={() => setEditItem(accom)}
              />
            ))}

            {/* Everything else */}
            {filteredItems.length === 0 && activeAccommodations.length === 0 ? (
              <div className="mt-8 text-center text-muted-foreground">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <CalendarDays className="h-8 w-8 opacity-40" />
                </div>
                <p className="font-medium">Nothing planned for this day.</p>
                <p className="mt-1 text-sm opacity-70">Tap + to add something.</p>
              </div>
            ) : filteredItems.length === 0 ? null : (
              <div className="space-y-5">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {filteredItems.map((item, index) => {
                      const gap = gapAfter(item, filteredItems[index + 1]);
                      return (
                        <React.Fragment key={item.id}>
                          {index === nowIndex && <NowMarker time={nowTime} />}
                          <SortableItem
                            item={item}
                            documents={documents}
                            trip={trip}
                            onEdit={() => setEditItem(item)}
                            isLast={index === filteredItems.length - 1}
                            done={isDone(item)}
                          />
                          {gap && <GapLabel text={gap} />}
                        </React.Fragment>
                      );
                    })}
                    {nowIndex === filteredItems.length && <NowMarker time={nowTime} />}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {getTripStatus(trip) !== "archived" && (
        <FAB icon={Plus} label="Add to timeline" open={menuOpen} onClick={() => setMenuOpen(o => !o)} />
      )}
      <AddMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { id: "travel", label: "Travel", hint: "Flight, train, bus or car", icon: Plane, tint: "bg-blue-50 text-blue-600" },
          { id: "accommodation", label: "Stay", hint: "Hotel or rental", icon: Building2, tint: "bg-violet-50 text-violet-600" },
          { id: "meal", label: "Meal", hint: "Breakfast to drinks", icon: UtensilsCrossed, tint: "bg-amber-50 text-amber-600" },
          { id: "activity", label: "Activity", hint: "Sights and plans", icon: Bike, tint: "bg-teal-50 text-teal-600" },
        ].map(o => ({
          ...o,
          onSelect: () => {
            setAddType(o.id as ElementType);
            setAddKey(k => k + 1);
            setIsAddOpen(true);
          },
        }))}
      />
      <AddEditSheet
        key={`add-${addKey}`}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        trip={trip}
        defaultDate={selectedDate}
        defaultElementType={addType}
        documents={documents}
        allItems={allItems}
      />
      {editItem && (
        <AddEditSheet
          isOpen={!!editItem}
          onClose={() => setEditItem(null)}
          trip={trip}
          defaultDate={editItem.date}
          documents={documents}
          allItems={allItems}
          existingItem={editItem}
        />
      )}
    </div>
  );
}
