import { notify, confirmDialog } from "@/lib/dialogs";
import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCityImage } from "@/lib/city-image";
import { PlaceCode } from "@/components/TicketParts";
import { format, addDays, differenceInDays } from "date-fns";
import {
  Plus, GripVertical, MapPin, Trash2, CalendarDays,
  Plane, Train, Bus, Car, Building2, UtensilsCrossed,
  Bike, FileText, Paperclip, Check, Square, Clock, Upload,
  ArrowLeftRight, Pencil, X, ChevronDown, ChevronRight,
  Coffee, Wine, Sun, Sunset, Route, Wallet
} from "lucide-react";

import {
  useItinerary, useSaveItineraryItem, useDeleteItineraryItem,
  useReorderItinerary, useDocuments, useAddDocument,
  useSaveExpense, useDeleteExpense, useUpdateTrip, useDeleteDocument
} from "@/hooks/use-store";
import {
  Trip, ItineraryItem, ElementType, TravelType, ItineraryCategory,
  TripDocument, ChecklistItem, ExpenseCategory
} from "@/lib/types";
import { generateId, cn, safeFormatDate, safeParseDate, isDayLabel, getTripStatus } from "@/lib/utils";
import { Button, Input, Label, Select, BottomSheet, FAB, HeroScrim } from "@/components/ui";
import { AddMenu } from "@/components/AddMenu";
import { formatCurrency, convertFromINR, RATES_PER_INR } from "@/lib/countries";

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

// ─── Constants ────────────────────────────────────────────────────────────────
type MealSubType = 'breakfast' | 'lunch' | 'dinner' | 'drinks';

const MEAL_SUBTYPES: { id: MealSubType; label: string; icon: React.ElementType; defaultTime: string }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: Coffee,      defaultTime: '08:00' },
  { id: 'lunch',     label: 'Lunch',     icon: Sun,         defaultTime: '13:00' },
  { id: 'dinner',    label: 'Dinner',    icon: Sunset,      defaultTime: '20:00' },
  { id: 'drinks',    label: 'Drinks',    icon: Wine,        defaultTime: '21:00' },
];

const ELEMENT_COLORS: Record<ElementType, string> = {
  travel: "from-[#3b82f6] to-[#2563eb] dark:from-[#1f3d6f] dark:to-[#1f3d6f]",
  accommodation: "from-[#8b5cf6] to-[#7c3aed] dark:from-[#4f3a78] dark:to-[#4f3a78]",
  meal: "from-[#fbbf24] to-[#f59e0b] dark:from-[#8b6b13] dark:to-[#8b6b13]",
  activity: "from-[#0d9488] to-[#059669] dark:from-[#0d453a] dark:to-[#0d453a]",
};
const ELEMENT_BORDER: Record<ElementType, string> = {
  travel: "border-blue-200",
  accommodation: "border-violet-200",
  meal: "border-amber-200",
  activity: "border-teal-200",
};

const ELEMENT_BADGES: Record<ElementType, string> = {
  travel:
    "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",

  accommodation:
    "bg-violet-50 text-violet-700 border border-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",

  meal:
    "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",

  activity:
    "bg-teal-50 text-teal-700 border border-teal-100 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20",
};

const ELEMENT_LABELS: Record<ElementType, string> = {
  travel: "TRAVEL",
  accommodation: "STAY",
  meal: "MEAL",
  activity: "ACTIVITY",
};

function categoryLabel(item: ItineraryItem) {
  if (item.elementType !== "meal") {
    return ELEMENT_LABELS[item.elementType];
  }

  switch (item.mealSubType) {
    case "breakfast":
      return "BREAKFAST";

    case "lunch":
      return "LUNCH";

    case "dinner":
      return "DINNER";

    case "drinks":
      return "DRINKS";

    default:
      return "MEAL";
  }
}

function panelGradient(type: ElementType) {
  switch (type) {
    case "travel":
      return "bg-gradient-to-b from-[#3b82f6] to-[#2563eb] dark:from-[#1f3d6f] dark:to-[#1f3d6f]";

    case "accommodation":
      return "bg-gradient-to-b from-[#8b5cf6] to-[#7c3aed] dark:from-[#4f3a78] dark:to-[#4f3a78]";

    case "meal":
      return "bg-gradient-to-b from-[#fbbf24] to-[#f59e0b] dark:from-[#8b6b13] dark:to-[#8b6b13]";

    default:
      return "bg-gradient-to-b from-[#14b8a6] to-[#0d9488] dark:from-[#0d453a] dark:to-[#0d453a]";
  }
}

function tintSurface(type: ElementType) {
  switch (type) {
    case "travel":
      return "bg-blue-50/30";

    case "accommodation":
      return "bg-violet-50/30";

    case "meal":
      return "bg-amber-50/30";

    default:
      return "bg-teal-50/30";
  }
}

function travelIcon(type?: TravelType) {
  switch (type) {
    case "train":
      return Train;

    case "bus":
      return Bus;

    case "car":
      return Car;

    default:
      return Plane;
  }
}

function travelLabel(type?: TravelType) {
  switch (type) {
    case "train":
      return "TRAIN";

    case "bus":
      return "BUS";

    case "car":
      return "CAR";

    default:
      return "FLIGHT";
  }
}

const ELEMENT_ICONS: Record<ElementType, React.ElementType> = {
  travel: Plane,
  accommodation: Building2,
  meal: UtensilsCrossed,
  activity: Bike,
};

const TRAVEL_ICONS: Record<TravelType, React.ElementType> = {
  flight: Plane,
  train: Train,
  bus: Bus,
  car: Car,
};

const ELEMENT_TO_EXPENSE_CAT: Record<ElementType, ExpenseCategory> = {
  travel: 'transport',
  accommodation: 'accommodation',
  meal: 'food',
  activity: 'activities',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function elementTypeToCategory(t: ElementType, travelType?: TravelType): ItineraryCategory {
  if (t === 'travel') return (travelType as ItineraryCategory) || 'flight';
  if (t === 'accommodation') return 'hotel';
  if (t === 'meal') return 'food';
  return 'activity';
}

function parseTime(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function addMinutesToTime(time: string, minutes: number): string {
  const total = parseTime(time) + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getDuration(start: string, end: string): string {
  if (!start || !end) return '';
  const s = parseTime(start);
  const e = parseTime(end);
  const diff = e >= s ? e - s : 24 * 60 - s + e;
  if (diff <= 0) return '';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function sortItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime);
  });
}

function stayNights(checkIn: string, checkOut: string): number {
  const d1 = safeParseDate(checkIn);
  const d2 = safeParseDate(checkOut);
  if (!d1 || !d2) return 1;
  return Math.max(differenceInDays(d2, d1), 1);
}

// ─── Card helpers ─────────────────────────────────────────────────────────────

/** Live state for a travel leg: departs in..., in transit, landed/arrived. */
function legStatus(item: ItineraryItem): { label: string; tone: string } | null {
  const start = new Date(`${item.date}T${item.startTime}`);
  const end = new Date(`${item.date}T${item.endTime || item.startTime}`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  if (end < start) end.setDate(end.getDate() + 1);
  const now = new Date();
  if (now >= end) {
    return { label: item.travelType === "flight" ? "Landed" : "Arrived", tone: "bg-emerald-50 text-emerald-600" };
  }
  if (now >= start) return { label: "In transit", tone: "bg-blue-50 text-blue-600 dark:bg-[#3a6bb0] dark:text-[#e8f1ff]" };
  const mins = Math.round((start.getTime() - now.getTime()) / 60000);
  if (mins <= 24 * 60) {
    return {
      label: mins >= 60 ? `Departs in ${Math.round(mins / 60)}h` : `Departs in ${mins}m`,
      tone: "bg-amber-50 text-amber-600 dark:bg-[#1d859f] dark:text-[#ffda24]",
    };
  }
  return { label: "Upcoming", tone: "bg-blue-50 text-blue-600 dark:bg-[#3a6bb0] dark:text-[#e8f1ff]" };
}

function NowMarker({ time }: { time: string }) {
  return (
    <div className="relative flex h-5 items-center">
      <span className="absolute -bottom-5 -top-5 left-[57px] w-0.5 bg-primary/30" />
      <div className="w-11 shrink-0" />
      <div className="relative flex w-7 shrink-0 justify-center">
        <span className="relative z-10 h-[18px] w-[18px] rounded-full bg-primary shadow-[0_0_0_6px_hsl(var(--primary)/0.18)]" />
      </div>
      <span className="ml-3 text-xs font-semibold text-primary">Now, {time}</span>
    </div>
  );
}

/** Quiet "1h 30m free" note between two items, sitting on the rail */
function GapLabel({ text }: { text: string }) {
  return (
    <div className="relative pl-[72px] text-[11px] text-muted-foreground/70">
      <span className="absolute -bottom-5 -top-5 left-[57px] w-0.5 bg-border" />
      {text}
    </div>
  );
}

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
            <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-md [text-shadow:none]" style={{ color: "#0f172a" }}>
              {isWishlist ? selectedDate : `Day ${dayIndex + 1} of ${days.length}`}
            </span>
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

// ─── Accommodation Card ─────────────────────────────────────────────────────
function AccommodationCard({
  item,
  trip,
  currentDay,
  onEdit,
}: {
  item: ItineraryItem;
  trip: Trip;
  currentDay: string;
  onEdit: () => void;
}) {
  const { mutate: deleteItem } = useDeleteItineraryItem();
  const { mutate: deleteExpense } = useDeleteExpense();
  const { mutate: saveItem } = useSaveItineraryItem();

  const [expanded, setExpanded] = useState(false);

  const documents = useDocuments(item.tripId).data || [];

const attachedDocs = documents.filter((d) =>
  (item.attachedDocIds || []).includes(d.id)
);

const totalChecklist = item.checklist?.length ?? 0;

const doneChecklist =
  item.checklist?.filter((c) => c.done).length ?? 0;

  const nights = item.endDate ? stayNights(item.date, item.endDate) : 1;
  const destCurrency = trip.destinationCurrency || "INR";

  const openDoc = (doc: TripDocument) => {
  if (!doc.file_url) {
    notify("Document not available.", "error");
    return;
  }

  window.open(doc.file_url, "_blank");
};

const detachDoc = async (docId: string) => {
  if (!(await confirmDialog({ title: "Remove this file?", message: "It stays in Documents; only the link to this item is removed.", confirmLabel: "Remove", destructive: true }))) return;

  saveItem({
    ...item,
    attachedDocIds: (item.attachedDocIds || []).filter(
      (id) => id !== docId
    ),
  });

};

const toggleChecklistItem = (checkId: string) => {
  if (!item.checklist) return;

  saveItem({
    ...item,
    checklist: item.checklist.map((c) =>
      c.id === checkId
        ? { ...c, done: !c.done }
        : c
    ),
  });
};

  const handleDelete = async () => {
    if (!(await confirmDialog({ title: "Remove this stay?", confirmLabel: "Remove", destructive: true }))) return;

    if (item.expenseId) {
      deleteExpense({
        id: item.expenseId,
        tripId: item.tripId,
      });
    }

    deleteItem({
      tripId: item.tripId,
      id: item.id,
    });
  };

  return (
    <div
      className={cn(
        "mb-6 overflow-hidden rounded-[26px] border bg-violet-50/70 dark:bg-violet-50 shadow-[0_5px_0_-1px_#E9E3FD,0_10px_0_-2px_#F2EEFE] dark:shadow-[0_5px_0_-1px_#362d58,0_10px_0_-2px_#202431] transition duration-300",
        ELEMENT_BORDER.accommodation
      )}
    >
      <div className="flex items-stretch">

        {/* Left Strip */}

  <div className="w-[6px] shrink-0 bg-violet-500" />

  {/* Right Side */}

  <div className="min-w-0 w-0 flex-1">

          <button
  type="button"
  onClick={() => setExpanded((v) => !v)}
  className="w-full text-left"
>
  <div className="pl-6 pr-5 py-5">

    {/* Header */}

    <div className="flex min-w-0 items-start justify-between gap-4">

      <div className="min-w-0 flex-1">

        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-violet-600"><Building2 className="h-3.5 w-3.5" />Stay</p>

        <h3 className="min-w-0 break-words line-clamp-2 text-[18px] font-semibold leading-[1.35]">
          {item.title}
        </h3>

      </div>

      <ChevronDown
        className={cn(
           "mt-6 h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-300",
          expanded && "rotate-180"
        )}
      />

    </div>

    {/* Stay Timeline */}

    <div className="mt-4 flex items-end justify-between gap-4">

      {/* Check In */}

      <div className="min-w-0 flex-1">

        <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Check-in
        </p>

        <p className="mt-0.5 text-[15px] font-semibold">
          {safeFormatDate(
            item.date,
            d => format(d, "MMM d"),
            item.date
          )}
        </p>

        <p className="mt-0.5 text-[12px] italic text-muted-foreground">
          {item.startTime || "—"}
        </p>

      </div>

      {/* Stay Progress */}

<div className="flex w-[72px] shrink-0 flex-col items-center justify-center">

  <div className="mb-2 h-px w-8 bg-border/60" />

  <p className="whitespace-nowrap text-[11px] font-medium italic text-violet-600">
    {item.endDate === currentDay
  ? "Check-out"
  : (() => {
      const night = Math.max(
        differenceInDays(
          safeParseDate(currentDay)!,
          safeParseDate(item.date)!
        ) + 1,
        1
      );

      const suffix =
        night % 10 === 1 && night % 100 !== 11
          ? "st"
          : night % 10 === 2 && night % 100 !== 12
          ? "nd"
          : night % 10 === 3 && night % 100 !== 13
          ? "rd"
          : "th";

      return `${night}${suffix} night`;
    })()}
  </p>

  {(() => {
                  const cd = safeParseDate(currentDay);
                  const sd = safeParseDate(item.date);
                  const total = stayNights(item.date, item.endDate ?? item.date);
                  if (!cd || !sd) return null;
                  const night = Math.min(Math.max(differenceInDays(cd, sd) + 1, 1), total);
                  return (
                    <div className="mt-2 flex items-center gap-1">
                      {Array.from({ length: Math.min(total, 7) }).map((_, n) => (
                        <span key={n} className={cn("h-1.5 w-1.5 rounded-full", n < night ? "bg-violet-500" : "bg-violet-200")} />
                      ))}
                    </div>
                  );
                })()}

</div>

      {/* Check Out */}

      <div className="min-w-0 flex-1 text-right">

        <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Check-out
        </p>

        <p className="mt-1 text-[15px] font-semibold">
          {item.endDate
            ? safeFormatDate(
                item.endDate,
                d => format(d, "MMM d"),
                item.endDate
              )
            : "—"}
        </p>

        <p className="mt-1 text-[12px] italic text-muted-foreground">
          {item.endTime || "—"}
        </p>

      </div>

    </div>

  </div>
</button>

{expanded && (
  <div className="border-t border-border/20">

    {/* Location */}

    {item.location && (
      <div className="border-b border-border/20 px-4 py-5">

        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Location
        </p>

        <div className="flex min-w-0 items-start gap-3">

          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

          <p className="min-w-0 break-words text-[14px] leading-6 text-foreground/90">
            {item.location}
          </p>

        </div>

      </div>
    )}

    {/* Cost */}

    {item.cost != null && item.cost > 0 && (
      <div className="border-b border-border/20 px-4 py-5">

        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Cost
        </p>

        <div className="w-full rounded-3xl border border-border/60 bg-muted/20 px-6 py-5">

          <p className="text-[24px] font-semibold tracking-[-0.02em]">
            ₹{Math.round(item.cost).toLocaleString("en-IN")}
          </p>

          {destCurrency !== "INR" && (
            <p className="mt-1 text-sm text-muted-foreground">
              ≈{" "}
              {formatCurrency(
                convertFromINR(item.cost, destCurrency),
                destCurrency
              )}
            </p>
          )}

        </div>

      </div>
    )}

    {/* Notes */}

    {item.notes && (
      <div className="border-b border-border/20 px-4 py-5">

        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Notes
        </p>

        <div className="w-full rounded-3xl border border-border/60 bg-muted/20 px-6 py-4">

          <p className="text-[14px] leading-6 text-foreground/80">
            {item.notes}
          </p>

        </div>

      </div>
    )}

    {/* Checklist */}

{item.checklist && item.checklist.length > 0 && (
  <div className="border-b border-border/20 px-4 py-5">

    <div className="mb-4 flex items-center justify-between">

      <div>

        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Checklist
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {doneChecklist} of {totalChecklist} completed
        </p>

      </div>

      <span
        className={cn(
          "rounded-full px-3 py-1 text-xs font-semibold",
          ELEMENT_BADGES.accommodation
        )}
      >
        {totalChecklist
          ? Math.round((doneChecklist / totalChecklist) * 100)
          : 0}
        %
      </span>

    </div>

    <div className="mb-5 h-2 overflow-hidden rounded-full bg-muted">

      <div
        className="h-full rounded-full bg-violet-500 transition"
        style={{
          width: `${
            totalChecklist
              ? (doneChecklist / totalChecklist) * 100
              : 0
          }%`,
        }}
      />

    </div>

    <div className="w-full space-y-2 rounded-3xl border border-border/60 bg-muted/20 p-5">

      {item.checklist.map((ci) => (

        <button
          key={ci.id}
          type="button"
          onClick={() => toggleChecklistItem(ci.id)}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/40"
        >

          {ci.done ? (

            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500">

              <Check className="h-3 w-3 text-white" />

            </div>

          ) : (

            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />

          )}

          <span
            className={cn(
              "text-[14px]",
              ci.done
                ? "text-muted-foreground line-through"
                : "text-foreground"
            )}
          >
            {ci.text}
          </span>

        </button>

      ))}

    </div>

  </div>
)}

{/* Attachments */}

{attachedDocs.length > 0 && (

  <div className="border-b border-border/20 px-4 py-5">

    <div className="mb-4 flex items-center justify-between">

      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Attachments
      </p>

      <span className="text-xs text-muted-foreground">
        {attachedDocs.length} file
        {attachedDocs.length !== 1 ? "s" : ""}
      </span>

    </div>

    <div className="space-y-5">

      {attachedDocs.map((doc) => (

        <div
          key={doc.id}
          className="flex w-full min-w-0 items-center gap-4 rounded-3xl border border-border bg-muted/20 px-6 py-4"
        >

          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              tintSurface(item.elementType)
            )}
          >
            <Paperclip className="h-4 w-4" />
          </div>

          <button
            type="button"
            onClick={() => openDoc(doc)}
            className="min-w-0 flex-1 text-left"
          >

            <p className="truncate text-[14px] font-medium">
              {doc.name}
            </p>

            <p className="mt-1 text-[11px] text-muted-foreground">
              Tap to open
            </p>

          </button>

          <button
            type="button"
            onClick={() => detachDoc(doc.id)}
            className="p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>

        </div>

      ))}

    </div>

  </div>

)}

{/* Actions */}

<div className="border-t border-border/20 px-5 py-5">

  <div className="flex justify-end gap-3">

    <button
      type="button"
      onClick={onEdit}
      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted [&>svg]:shrink-0"
    >
      <Pencil className="h-4 w-4 shrink-0" />
      Edit
    </button>

    <button
      type="button"
      onClick={handleDelete}
      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 [&>svg]:shrink-0"
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </button>

  </div>

</div>

  </div>
)}

        </div>
      </div>
    </div>
  );
}


// ─── Sortable Item ────────────────────────────────────────────────────────────
function SortableItem({
  item,
  documents,
  trip,
  onEdit,
  isLast,
  done = false,
}: {
  item: ItineraryItem;
  documents: TripDocument[];
  trip: Trip;
  onEdit: () => void;
  isLast: boolean;
  done?: boolean;
}) {

  const { mutate: deleteItem } = useDeleteItineraryItem();
  const { mutate: deleteExpense } = useDeleteExpense();
  const { mutate: saveItem } = useSaveItineraryItem();
  const { mutate: deleteDoc } = useDeleteDocument();

  const [expanded, setExpanded] = useState(false);


  const attachedDocs = documents.filter((d) =>
    (item.attachedDocIds || []).includes(d.id)
  );

  const duration = getDuration(item.startTime, item.endTime);
  const destCurrency = trip.destinationCurrency || "INR";

  const totalChecklist = item.checklist?.length ?? 0;
  const doneChecklist =
    item.checklist?.filter((c) => c.done).length ?? 0;

  const mealInfo =
    item.elementType === "meal"
      ? MEAL_SUBTYPES.find((m) => m.id === item.mealSubType)
      : null;

  const MealIcon = UtensilsCrossed;

  const Icon =
    item.elementType === "travel"
      ? travelIcon(item.travelType)
      : item.elementType === "meal"
      ? MealIcon
      : ELEMENT_ICONS[item.elementType];

  const openDoc = (doc: TripDocument) => {
  if (!doc.file_url) {
    notify("Document not available.", "error");
    return;
  }

  window.open(doc.file_url, "_blank");
};

  const detachDoc = async (docId: string) => {
  if (!(await confirmDialog({ title: "Remove this attachment?", message: "It stays in Documents; only the link to this item is removed.", confirmLabel: "Remove", destructive: true }))) return;

  saveItem({
    ...item,
    attachedDocIds: (item.attachedDocIds || []).filter(
      id => id !== docId
    ),
  });
};

  const toggleChecklistItem = (checkId: string) => {
    if (!item.checklist) return;

    saveItem({
      ...item,
      checklist: item.checklist.map((c) =>
        c.id === checkId
          ? { ...c, done: !c.done }
          : c
      ),
    });
  };

  const handleDelete = async () => {
    if (!(await confirmDialog({ title: "Delete this item?", confirmLabel: "Delete", destructive: true }))) return;

    if (item.expenseId) {
      deleteExpense({
        id: item.expenseId,
        tripId: item.tripId,
      });
    }

    deleteItem({
      tripId: item.tripId,
      id: item.id,
    });
  };

  const isTravel = item.elementType === "travel";
  const isMeal = item.elementType === "meal";
  const accentBg = isTravel ? "bg-blue-500" : isMeal ? "bg-amber-500" : "bg-teal-500";
  const leg = isTravel ? legStatus(item) : null;
  // Ticket notches at the perforation (68% across). When expanded, only the top notch is cut.
  const notchTop = "radial-gradient(circle 9px at 68% 0, #0000 97%, #000) top / 100% 51% no-repeat";
  const notchBottom = "radial-gradient(circle 9px at 68% 100%, #0000 97%, #000) bottom / 100% 51% no-repeat";
  const ticketMask = expanded
    ? `${notchTop}, linear-gradient(#000, #000) bottom / 100% 49% no-repeat`
    : `${notchTop}, ${notchBottom}`;

  const dotColor = isTravel ? "bg-blue-500" : isMeal ? "bg-amber-500" : "bg-teal-500";
  const panelTone = isTravel
    ? "border-blue-200 bg-card/70"
    : isMeal
    ? "border-amber-300/70 bg-card/60"
    : "border-teal-200 bg-card/70";
  // Receipt edge for meals: the bottom 8px is cut into a zig-zag
  const zigzag = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='8' viewBox='0 0 16 8'%3E%3Cpath d='M0 0h16L8 8z'/%3E%3C/svg%3E")`;
  const receiptMask = `linear-gradient(#000, #000) top / 100% calc(100% - 7px) no-repeat, ${zigzag} bottom / 16px 8px repeat-x`;

  return (
    <div className="flex">
      {/* Time */}
      <div className="w-11 shrink-0 pt-3.5 text-right">
        <p className="text-[13px] font-bold leading-none tabular-nums">{item.startTime}</p>
        {duration && <p className="mt-1 text-[10.5px] text-muted-foreground">{duration}</p>}
      </div>

      {/* Rail: line turns blue once the item is done */}
      <div className="relative w-7 shrink-0">
        {!isLast && (
          <span className={cn("absolute -bottom-5 left-[13px] top-0 w-0.5", done ? "bg-primary dark:bg-primary/60" : "bg-border")} />
        )}
        <span className={cn("absolute left-2 top-[18px] h-3 w-3 rounded-full ring-4 ring-background", dotColor)} />
      </div>

      {/* Card: boarding pass (travel), receipt (meal), entry pass (activity) */}
      <div
        className={cn(
          "min-w-0 flex-1 self-start",
          !isTravel && !isMeal && "rounded-[28px] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_26px_-6px_rgba(13,148,136,0.28)]"
        )}
        style={isTravel || isMeal ? { filter: "drop-shadow(0 8px 14px rgba(15,23,42,0.12))" } : undefined}
      >
        <div
          className={cn(
            "relative overflow-hidden",
            isTravel && "rounded-[22px] bg-blue-50",
            isMeal && "rounded-t-[26px] bg-amber-50 pb-2",
            !isTravel && !isMeal && "rounded-[28px] bg-teal-50 ring-1 ring-teal-200/80"
          )}
          style={
            isTravel
              ? { WebkitMask: ticketMask, mask: ticketMask }
              : isMeal
              ? { WebkitMask: receiptMask, mask: receiptMask }
              : undefined
          }
        >
          <div className="min-w-0">
            <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full text-left">
              {isTravel && (
                <div className="relative">
                  <span
                    aria-hidden
                    className="absolute bottom-4 left-[68%] top-4 border-l-[1.5px] border-dashed border-blue-300"
                  />
                  <div className="grid grid-cols-[68%_32%]">
                    <div className="min-w-0 px-4 py-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="truncate">{travelLabel(item.travelType)}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <PlaceCode place={item.fromLocation} />
                        <div className="flex min-w-[20px] flex-1 items-center">
                          <div className="flex-1 border-t-[1.5px] border-dashed border-blue-300" />
                          <Icon className="mx-1.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                          <div className="flex-1 border-t-[1.5px] border-dashed border-blue-300" />
                        </div>
                        <PlaceCode place={item.toLocation} right />
                      </div>
                      <p className="mt-3 text-[12.5px] font-medium text-blue-900/70">
                        {item.startTime || "—"} to {item.endTime || "—"}
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-col items-center justify-center gap-2 bg-blue-100/60 dark:bg-blue-100 px-2 py-4 text-center">
                      {leg && (
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", leg.tone)}>
                          {leg.label}
                        </span>
                      )}
                      <span className="font-display text-[18px] font-bold leading-none text-blue-950">{duration || "—"}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-blue-900/40 transition-transform duration-300",
                          expanded && "rotate-180"
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              {isMeal && (
                <div className="px-4 pb-2 pt-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-amber-700">{categoryLabel(item)}</p>
                      <h3 className="truncate text-base font-semibold leading-snug">{item.title}</h3>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-amber-900/40 transition-transform duration-300",
                        expanded && "rotate-180"
                      )}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-dashed border-amber-300/80 pt-2.5 text-[12.5px]">
                    <span className="text-amber-900/70">
                      {item.startTime || "—"}
                      {duration ? ` · ${duration}` : ""}
                    </span>
                    {item.cost ? (
                      <span>
                        <span className="mr-1.5 text-amber-900/60">Total</span>
                        <b className="font-display text-amber-950">₹{Math.round(item.cost).toLocaleString("en-IN")}</b>
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              {item.elementType === "activity" && (
                <div>
                  <div className="relative bg-gradient-to-r from-[#0d9488] to-[#059669] dark:from-[#0d453a] dark:to-[#0d453a] px-4 pb-2.5 pt-4 text-white">
                    <span aria-hidden className="absolute left-1/2 top-1.5 h-1.5 w-10 -translate-x-1/2 rounded-full bg-black/25" />
                    <div className="flex items-center justify-between text-[12px] font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        Activity
                      </span>
                      <span>
                        {item.startTime || "—"}
                        {item.endTime ? ` – ${item.endTime}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <h3 className="line-clamp-2 min-w-0 flex-1 break-words text-[17px] font-semibold leading-snug text-teal-950">
                        {item.title}
                      </h3>
                      <ChevronDown
                        className={cn(
                          "mt-1 h-4 w-4 shrink-0 text-teal-900/40 transition-transform duration-300",
                          expanded && "rotate-180"
                        )}
                      />
                    </div>
                    <div className="mt-2.5 flex items-center gap-3 text-[12px] text-teal-900/70">
                      {duration && (
                        <span className="flex shrink-0 items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {duration}
                        </span>
                      )}
                      {totalChecklist > 0 && (
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-teal-100">
                            <div
                              className="h-full rounded-full bg-teal-500"
                              style={{ width: `${(doneChecklist / totalChecklist) * 100}%` }}
                            />
                          </div>
                          <span className="shrink-0">
                            {doneChecklist} of {totalChecklist}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </button>


{expanded && (
  <div className={cn("border-t border-dashed py-2", panelTone)}>

  {/* Location */}

{item.location && (
  <div className="border-b border-border/20 px-4 py-5">

    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      Location
    </p>

    <div className="-mx-1 rounded-3xl border border-border/60 bg-muted/20 px-6 py-5">

      <div className="flex items-start gap-3">

        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

        <p className="break-words text-[14px] leading-6 text-foreground/90">
          {item.location}
        </p>

      </div>

    </div>

  </div>
)}

{/* Cost */}

{item.cost != null && item.cost > 0 && (
  <div className="border-b border-border/20 px-4 py-5">

    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      Cost
    </p>

    <div className="w-full rounded-3xl border border-border/60 bg-muted/20 px-6 py-6">

      <p className="text-[24px] font-semibold tracking-[-0.02em]">
        ₹{Math.round(item.cost).toLocaleString("en-IN")}
      </p>

      {destCurrency !== "INR" && (
        <p className="mt-1 text-sm text-muted-foreground">
          ≈{" "}
          {formatCurrency(
            convertFromINR(item.cost, destCurrency),
            destCurrency
          )}
        </p>
      )}

    </div>

  </div>
)}

{/* Notes */}

{item.notes && (
  <div className="border-b border-border/20 px-4 py-5">

    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      Notes
    </p>

    <div className="-mx-1 rounded-3xl border border-border/60 bg-muted/20 px-6 py-5">

      <p className="text-[14px] leading-6 text-foreground/80">
        {item.notes}
      </p>

    </div>

  </div>
)}
  {/* Checklist */}

{item.checklist && item.checklist.length > 0 && (
  <div className="border-b border-border/20 px-4 py-5">

    <div className="mb-4 flex items-center justify-between">

      <div>

        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Checklist
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {doneChecklist} of {totalChecklist} completed
        </p>

      </div>

      <span
        className={cn(
          "rounded-full px-3.5 py-1.5 text-xs font-semibold",
          ELEMENT_BADGES[item.elementType]
        )}
      >
        {totalChecklist
          ? Math.round((doneChecklist / totalChecklist) * 100)
          : 0}
        %
      </span>

    </div>

    <div className="mb-5 h-2 overflow-hidden rounded-full bg-muted">

      <div
        className={cn(
          "h-full rounded-full transition duration-300",
          item.elementType === "travel"
            ? "bg-blue-500"
            : item.elementType === "accommodation"
            ? "bg-violet-500"
            : item.elementType === "meal"
            ? "bg-amber-400"
            : "bg-teal-500"
        )}
        style={{
          width: `${
            totalChecklist
              ? (doneChecklist / totalChecklist) * 100
              : 0
          }%`,
        }}
      />

    </div>

    <div className="w-full rounded-3xl border border-border/60 bg-muted/20 p-6">

      <div className="space-y-2">

        {item.checklist.map((ci) => (

          <button
            key={ci.id}
            type="button"
            onClick={() => toggleChecklistItem(ci.id)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-background"
          >

            {ci.done ? (

              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  item.elementType === "travel"
                    ? "bg-blue-500"
                    : item.elementType === "accommodation"
                    ? "bg-violet-500"
                    : item.elementType === "meal"
                    ? "bg-amber-400"
                    : "bg-teal-500"
                )}
              >
                <Check className="h-3 w-3 text-white" />
              </div>

            ) : (

              <div className="h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/30" />

            )}

            <span
              className={cn(
                "text-[14px]",
                ci.done
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              )}
            >
              {ci.text}
            </span>

          </button>

        ))}

      </div>

    </div>

  </div>
)}

{/* Attachments */}

{attachedDocs.length > 0 && (
  <div className="border-b border-border/20 px-4 py-5">

    <div className="mb-4 flex items-center justify-between">

      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Attachments
      </p>

      <span className="text-xs text-muted-foreground">
        {attachedDocs.length} file
        {attachedDocs.length !== 1 ? "s" : ""}
      </span>

    </div>

    <div className="space-y-6">

      {attachedDocs.map((doc) => (

        <div
  key={doc.id}
  className="w-full rounded-3xl border border-border/60 bg-muted/20 px-6 py-5"
>

  <div className="flex items-start gap-3">

    <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

    <button
      type="button"
      onClick={() => openDoc(doc)}
      className="min-w-0 flex-1 text-left"
    >
      <p className="break-words text-[14px] font-medium leading-5">
        {doc.name}
      </p>

      <p className="mt-1 text-[11px] text-muted-foreground">
        Tap to open
      </p>
    </button>

    <button
      type="button"
      onClick={() => detachDoc(doc.id)}
      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
      aria-label="Remove attachment"
    >
      <X className="h-4 w-4" />
    </button>

  </div>

</div>

      ))}

    </div>

  </div>
)}

{/* Actions */}

<div className="border-t border-border/20 px-5 py-5">

  <div className="flex w-full">

  <div className="w-12 shrink-0" />

  <div className="ml-auto flex min-w-0 flex-1 justify-end gap-3">

      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted [&>svg]:shrink-0"
      >
        <Pencil className="h-4 w-4 shrink-0" />
        Edit
      </button>

      <button
        type="button"
        onClick={handleDelete}
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 [&>svg]:shrink-0"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>

    </div>

  </div>

</div>

  </div>
)}

            </div>
    </div>

  </div>

</div>
);
}

// ─── Add / Edit Sheet ─────────────────────────────────────────────────────────
interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  defaultDate: string;
  documents: TripDocument[];
  allItems: ItineraryItem[];
  existingItem?: ItineraryItem;
  defaultElementType?: ElementType;
}

function AddEditSheet({ isOpen, onClose, trip, defaultDate, documents, allItems, existingItem, defaultElementType }: SheetProps) {
  const { mutateAsync: saveItem, isPending } = useSaveItineraryItem();
  const { mutateAsync: addDocument } = useAddDocument();
  const { mutateAsync: saveExpense } = useSaveExpense();
  const { mutate: deleteExpense } = useDeleteExpense();

  const destCurrency = trip.destinationCurrency || 'INR';
  const showCurrencyToggle = destCurrency !== 'INR';

  const [elementType, setElementType] = useState<ElementType>(existingItem?.elementType || defaultElementType || 'activity');
  const [travelType, setTravelType] = useState<TravelType>(existingItem?.travelType || 'flight');
  const [mealSubType, setMealSubType] = useState<MealSubType>(existingItem?.mealSubType || 'lunch');
  const [mealTime, setMealTime] = useState(existingItem?.startTime || '13:00');
  const [duration, setDuration] = useState(
  existingItem
    ? Math.max(parseTime(existingItem.endTime) - parseTime(existingItem.startTime), 30)
    : 60
);
  const [startTime, setStartTime] = useState(existingItem?.startTime || '09:00');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(existingItem?.attachedDocIds || []);
  const [checklistText, setChecklistText] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(existingItem?.checklist || []);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [costInput, setCostInput] = useState<string>(
    existingItem?.cost ? String(Math.round(existingItem.cost)) : ''
  );
  const [costInDest, setCostInDest] = useState(false);

  const isEditing = !!existingItem;

  // When meal subtype changes, auto-update the time
  const handleMealSubTypeChange = (sub: MealSubType) => {
    setMealSubType(sub);
    if (!existingItem) {
      const info = MEAL_SUBTYPES.find(m => m.id === sub);
      if (info) setMealTime(info.defaultTime);
    }
  };

  const getCostInINR = (): number => {
    const val = parseFloat(costInput);
    if (!val || isNaN(val)) return 0;
    if (costInDest && destCurrency !== 'INR') {
      const rate = RATES_PER_INR[destCurrency] ?? 1;
      return val / rate;
    }
    return val;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = (fd.get('date') as string) || defaultDate;
    let st = startTime;
    let et = '';
    let title = '';
    let location = '';
    let fromLocation = '';
    let toLocation = '';
    let endDate: string | undefined;

    if (elementType === 'travel') {
      fromLocation = fd.get('fromLocation') as string;
      toLocation = fd.get('toLocation') as string;
      title = `${travelType.charAt(0).toUpperCase() + travelType.slice(1)}: ${fromLocation} → ${toLocation}`;
      st = fd.get('departureTime') as string;
      et = fd.get('arrivalTime') as string;
    } else if (elementType === 'accommodation') {
      title = fd.get('accommodationName') as string;
      location = fd.get('address') as string;
      st = fd.get('checkInTime') as string || '14:00';
      et = fd.get('checkOutTime') as string || '11:00';
      endDate = (fd.get('checkOutDate') as string) || date;
    } else if (elementType === 'meal') {
      title = fd.get('restaurantName') as string;
      location = fd.get('mealLocation') as string;
      st = mealTime;
      et = addMinutesToTime(st, 60);
    } else if (elementType === 'activity') {
      title = fd.get('activityName') as string;
      location = fd.get('activityLocation') as string;
      st = fd.get('startTime') as string;
      et = addMinutesToTime(st, duration);
    }

    let finalDocIds = [...selectedDocIds];
    if (uploadFile) {
      const catMap: Record<ElementType, string> = {
        travel: 'ticket', accommodation: 'hotel', meal: 'other', activity: 'ticket'
      };
      const newDoc = {
        id: generateId(),
        tripId: trip.id,
        name: (fd.get('uploadName') as string) || uploadFile.name,
        category: catMap[elementType] as any,
        notes: '',
        fileName: uploadFile.name,
        fileType: uploadFile.type,
        fileSize: uploadFile.size,
        blob: uploadFile,
        createdAt: Date.now(),
      };
      await addDocument(newDoc);
      finalDocIds = [...finalDocIds, newDoc.id];
    }

    const costINR = getCostInINR();
    let expenseId = existingItem?.expenseId;

    if (costINR > 0) {
      const expCat = ELEMENT_TO_EXPENSE_CAT[elementType];
      const expEntry = {
        id: expenseId || generateId(),
        tripId: trip.id,
        title,
        amount: costINR,
        category: expCat,
        date: safeFormatDate(date, d => d.toISOString(), date),
        createdAt: Date.now(),
      };
      await saveExpense(expEntry);
      expenseId = expEntry.id;
    } else if (expenseId && costINR === 0) {
      deleteExpense({ id: expenseId, tripId: trip.id });
      expenseId = undefined;
    }

    await saveItem({
      id: existingItem?.id || generateId(),
      tripId: trip.id,
      elementType,
      travelType: elementType === 'travel' ? travelType : undefined,
      mealSubType: elementType === 'meal' ? mealSubType : undefined,
      title,
      location,
      fromLocation: fromLocation || undefined,
      toLocation: toLocation || undefined,
      date,
      startTime: st,
      endTime: et,
      endDate,
      notes: fd.get('notes') as string || '',
      category: elementTypeToCategory(elementType, travelType),
      order: 0,
      attachedDocIds: finalDocIds,
      checklist: checklist.length > 0 ? checklist : undefined,
      cost: costINR > 0 ? costINR : undefined,
      expenseId,
    });
    onClose();
  };

  const addChecklistItem = () => {
    if (!checklistText.trim()) return;
    setChecklist(prev => [...prev, { id: generateId(), text: checklistText.trim(), done: false }]);
    setChecklistText('');
  };

  const ELEMENT_TYPES: { id: ElementType; label: string; icon: React.ElementType }[] = [
    { id: 'travel', label: 'Travel', icon: Plane },
    { id: 'accommodation', label: 'Stay', icon: Building2 },
    { id: 'meal', label: 'Meal', icon: UtensilsCrossed },
    { id: 'activity', label: 'Activity', icon: Bike },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit Item" : "Add to Timeline"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Element type selector */}
        {!isEditing && (
          <div>
            <Label>Type</Label>
            <div className="grid grid-cols-4 gap-2 [&>*]:min-w-0">
              {ELEMENT_TYPES.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setElementType(id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition text-[15px] font-semibold",
                    elementType === id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                  )}>
                  <Icon className="w-5 h-5" />{label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date */}
        {elementType !== "accommodation" && (
  <div>
    <Label htmlFor="date">Day</Label>

    {trip.status === "wishlist" ? (
      <Select
        id="date"
        name="date"
        defaultValue={existingItem?.date || defaultDate}
      >
        {Array.from(
          { length: trip.wishlistDayCount ?? 1 },
          (_, i) => (
            <option
              key={i}
              value={`Day ${i + 1}`}
            >
              Day {i + 1}
            </option>
          )
        )}
      </Select>
    ) : (
      <Input
        id="date"
        name="date"
        type="date"
        defaultValue={existingItem?.date || defaultDate}
        required
      />
    )}
  </div>
)}

        {/* TRAVEL fields */}
        {elementType === 'travel' && (
          <>
            <div>
              <Label>Travel Type</Label>
              <div className="grid grid-cols-4 gap-2 [&>*]:min-w-0">
                {(['flight', 'train', 'bus', 'car'] as TravelType[]).map(t => {
                  const TIcon = TRAVEL_ICONS[t];
                  return (
                    <button key={t} type="button" onClick={() => setTravelType(t)}
                      className={cn("flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition text-xs font-semibold capitalize",
                        travelType === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                      )}>
                      <TIcon className="w-4 h-4" />{t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div>
                <Label htmlFor="fromLocation">From</Label>
                <Input id="fromLocation" name="fromLocation" placeholder="Delhi (DEL)" defaultValue={existingItem?.fromLocation} required />
              </div>
              <div>
                <Label htmlFor="toLocation">To</Label>
                <Input id="toLocation" name="toLocation" placeholder="Paris (CDG)" defaultValue={existingItem?.toLocation} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div>
                <Label htmlFor="departureTime">Departure</Label>
                <Input id="departureTime" name="departureTime" type="time" defaultValue={existingItem?.startTime || '10:00'} required />
              </div>
              <div>
                <Label htmlFor="arrivalTime">Arrival</Label>
                <Input id="arrivalTime" name="arrivalTime" type="time" defaultValue={existingItem?.endTime || '13:00'} required />
              </div>
            </div>
          </>
        )}

        {/* ACCOMMODATION fields */}
        {elementType === 'accommodation' && (
          <>
            <div>
              <Label htmlFor="accommodationName">Property Name</Label>
              <Input id="accommodationName" name="accommodationName" placeholder="Hotel Le Meurice" defaultValue={existingItem?.title} required />
            </div>
            <div>
              <Label htmlFor="address">Address / Location</Label>
              <Input id="address" name="address" placeholder="228 Rue de Rivoli, Paris" defaultValue={existingItem?.location} />
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div>
                <Label htmlFor="checkInDate">Check-in Date</Label>
                <Input id="checkInDate" name="date" type="date" defaultValue={existingItem?.date || defaultDate} required />
              </div>
              <div>
                <Label htmlFor="checkInTime">Check-in Time</Label>
                <Input id="checkInTime" name="checkInTime" type="time" defaultValue={existingItem?.startTime || '14:00'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div>
                <Label htmlFor="checkOutDate">Check-out Date</Label>
                <Input id="checkOutDate" name="checkOutDate" type="date" defaultValue={existingItem?.endDate || defaultDate} required />
              </div>
              <div>
                <Label htmlFor="checkOutTime">Check-out Time</Label>
                <Input id="checkOutTime" name="checkOutTime" type="time" defaultValue={existingItem?.endTime || '11:00'} />
              </div>
            </div>
          </>
        )}

        {/* MEAL fields */}
        {elementType === 'meal' && (
          <>
            {/* Meal sub-type picker */}
            <div>
              <Label>Meal Type</Label>
              <div className="grid grid-cols-4 gap-2 [&>*]:min-w-0">
                {MEAL_SUBTYPES.map(({ id, label, icon: MIcon }) => (
                  <button key={id} type="button" onClick={() => handleMealSubTypeChange(id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition text-xs font-semibold",
                      mealSubType === id ? "border-amber-400 bg-amber-50 text-amber-700" : "border-border bg-card text-muted-foreground"
                    )}>
                    <MIcon className="w-4 h-4" />{label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="restaurantName">Restaurant / Place</Label>
              <Input id="restaurantName" name="restaurantName" placeholder="Café de Flore" defaultValue={existingItem?.title} required />
            </div>
            <div>
              <Label htmlFor="mealLocation">Location</Label>
              <Input id="mealLocation" name="mealLocation" placeholder="Saint-Germain-des-Prés" defaultValue={existingItem?.location} />
            </div>
            <div>
              <Label htmlFor="mealTime">Time</Label>
              <Input
                id="mealTime"
                name="mealTime"
                type="time"
                value={mealTime}
                onChange={e => setMealTime(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground mt-1 ml-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Ends at {addMinutesToTime(mealTime, 60)} (1 hour)
              </p>
            </div>
          </>
        )}

        {/* ACTIVITY fields */}
        {elementType === 'activity' && (
          <>
            <div>
              <Label htmlFor="activityName">Activity Name</Label>
              <Input id="activityName" name="activityName" placeholder="Louvre Museum" defaultValue={existingItem?.title} required />
            </div>
            <div>
              <Label htmlFor="activityLocation">Location</Label>
              <Input id="activityLocation" name="activityLocation" placeholder="Paris, France" defaultValue={existingItem?.location} />
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input id="startTime" name="startTime" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
              </div>
              <div>
                <Label>Duration</Label>
                <Select value={String(duration)} onChange={e => setDuration(Number(e.target.value))}>
                  <option value="30">30 min</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                  <option value="180">3 hours</option>
                  <option value="240">4 hours</option>
                  <option value="360">6 hours</option>
                  <option value="480">8 hours</option>
                </Select>
              </div>
            </div>
            {startTime && (
              <p className="text-xs text-muted-foreground -mt-3 ml-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Ends at {addMinutesToTime(startTime, duration)}
              </p>
            )}
          </>
        )}

        {/* ── COST FIELD ── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="mb-0">Cost (optional)</Label>
            {showCurrencyToggle && (
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(costInput);
                  if (val && !isNaN(val)) {
                    const rate = RATES_PER_INR[destCurrency] ?? 1;
                    if (costInDest) {
                      setCostInput(String(Math.round(val / rate)));
                    } else {
                      setCostInput(String(Math.round(val * rate)));
                    }
                  }
                  setCostInDest(v => !v);
                }}
                className="flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full"
              >
                <ArrowLeftRight className="w-3 h-3" />
                {costInDest ? destCurrency : 'INR'} ↔ {costInDest ? 'INR' : destCurrency}
              </button>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold pointer-events-none">
              {costInDest ? destCurrency : '₹'}
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={costInput}
              onChange={e => setCostInput(e.target.value)}
              placeholder="0"
              className="pl-10 text-[19px] font-semibold h-14"
            />
          </div>
          {costInput && parseFloat(costInput) > 0 && (
            <p className="text-xs text-muted-foreground mt-1 ml-1">
              {showCurrencyToggle && (costInDest
                ? `≈ ${formatCurrency(getCostInINR(), 'INR')} · `
                : `≈ ${formatCurrency(convertFromINR(parseFloat(costInput), destCurrency), destCurrency)} · `
              )}
              Auto-logged to <span className="font-semibold capitalize">{ELEMENT_TO_EXPENSE_CAT[elementType]}</span> budget
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input id="notes" name="notes" placeholder="Confirmation, tips, reminders…" defaultValue={existingItem?.notes} />
        </div>

        {/* Checklist */}
        <div>
          <Label>Checklist (optional)</Label>
          <div className="flex gap-2 mb-2">
            <Input
              value={checklistText}
              onChange={e => setChecklistText(e.target.value)}
              placeholder="Add checklist item…"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addChecklistItem} className="shrink-0 h-12 px-3">Add</Button>
          </div>
          {checklist.length > 0 && (
            <div className="space-y-1.5 mt-1 bg-muted/30 rounded-xl p-3 border border-border/50">
              {checklist.map((ci, idx) => (
                <div key={ci.id} className="flex items-center gap-2">
                  <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm text-foreground">{ci.text}</span>
                  <button type="button" onClick={() => setChecklist(prev => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload document */}
        <div>
          <Label>Upload Document (optional)</Label>
          <label className={cn(
            "flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition",
            uploadFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
          )}>
            <Upload className={cn("w-5 h-5 shrink-0", uploadFile ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-sm flex-1 truncate", uploadFile ? "text-foreground font-medium" : "text-muted-foreground")}>
              {uploadFile ? uploadFile.name : "Tap to upload a file…"}
            </span>
            <input type="file" className="hidden" accept="application/pdf,image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
          </label>
          {uploadFile && (
            <div className="mt-2">
              <Label htmlFor="uploadName">Document Name</Label>
              <Input id="uploadName" name="uploadName" defaultValue={uploadFile.name} placeholder="e.g. Return Ticket" />
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1 ml-1">Saved to Documents tab and attached here</p>
        </div>

        {/* Attach existing documents */}
        {documents.length > 0 && (
          <div>
            <Label>Attach Existing Documents</Label>
            <button
              type="button"
              onClick={() => setShowDocPicker(!showDocPicker)}
              className="flex items-center justify-between w-full h-12 px-4 rounded-xl border-2 border-border bg-card text-base transition hover:border-primary/40"
            >
              <span className="text-muted-foreground text-sm">
                {selectedDocIds.length > 0 ? `${selectedDocIds.length} selected` : 'Select from saved documents'}
              </span>
              <Paperclip className="w-4 h-4 text-muted-foreground" />
            </button>
            {showDocPicker && (
              <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden">
                {documents.map(doc => {
                  const isSel = selectedDocIds.includes(doc.id);
                  return (
                    <button key={doc.id} type="button"
                      onClick={() => setSelectedDocIds(prev => isSel ? prev.filter(id => id !== doc.id) : [...prev, doc.id])}
                      className="flex items-center gap-3 w-full px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/40"
                    >
                      <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition", isSel ? "bg-primary border-primary" : "border-border")}>
                        {isSel && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm text-foreground truncate text-left">{doc.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{doc.category}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <Button type="submit" size="lg" className="mt-2" isLoading={isPending}>
          {isEditing ? 'Save Changes' : 'Add to Timeline'}
        </Button>
      </form>
    </BottomSheet>
  );
}
