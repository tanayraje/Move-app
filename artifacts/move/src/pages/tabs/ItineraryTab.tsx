import React, { useState, useMemo, useCallback, useRef } from "react";
import { format, addDays, differenceInDays } from "date-fns";
import {
  Plus, GripVertical, MapPin, Trash2, CalendarDays,
  Plane, Train, Bus, Car, Building2, UtensilsCrossed,
  Bike, FileText, Paperclip, Check, Square, Clock, Upload,
  ArrowLeftRight, Pencil, X, ChevronDown, ChevronRight,
  Coffee, Wine, Sun, Sunset
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
import { Button, Input, Label, Select, BottomSheet, FAB } from "@/components/ui";
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
  travel: "from-blue-500 to-blue-600",
  accommodation: "from-violet-500 to-violet-600",
  meal: "from-amber-400 to-amber-500",
  activity: "from-orange-500 to-orange-600",
};
const ELEMENT_BORDER: Record<ElementType, string> = {
  travel: "border-blue-200",
  accommodation: "border-violet-200",
  meal: "border-amber-200",
  activity: "border-orange-200",
};

const ELEMENT_BADGES: Record<ElementType, string> = {
  travel:
    "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",

  accommodation:
    "bg-violet-50 text-violet-700 border border-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",

  meal:
    "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",

  activity:
    "bg-orange-50 text-orange-700 border border-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20",
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
      return "bg-gradient-to-b from-blue-500 to-blue-600";

    case "accommodation":
      return "bg-gradient-to-b from-violet-500 to-violet-600";

    case "meal":
      return "bg-gradient-to-b from-amber-400 to-amber-500";

    default:
      return "bg-gradient-to-b from-orange-500 to-orange-600";
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
      return "bg-orange-50/30";
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

// ─── Main Tab ─────────────────────────────────────────────────────────────────
export default function ItineraryTab({ trip }: { trip: Trip }) {
  const { data: allItems = [] } = useItinerary(trip.id);
  const { mutate: reorder } = useReorderItinerary();
  const { mutate: updateTrip } = useUpdateTrip();
  const { data: documents = [] } = useDocuments(trip.id);

  const status = trip.status || (trip.archived ? 'archived' : 'active');
  const isWishlist = status === 'wishlist';

  const [selectedDate, setSelectedDate] = useState<string>(isWishlist ? 'Day 1' : trip.startDate);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<ItineraryItem | null>(null);
  const [editingCity, setEditingCity] = useState(false);
  const [cityDraft, setCityDraft] = useState('');
  const cityInputRef = useRef<HTMLInputElement>(null);

  const wishlistDays = useMemo(() => {
    const uniqueDays = new Set(allItems.map(i => i.date).filter(Boolean));
    let count = Math.max(uniqueDays.size, 1);
    return Array.from({ length: count }).map((_, i) => `Day ${i + 1}`);
  }, [allItems]);

  const startDateParsed = safeParseDate(trip.startDate);
  const endDateParsed = safeParseDate(trip.endDate);
  const daysCount = isWishlist ? wishlistDays.length
    : startDateParsed && endDateParsed ? differenceInDays(endDateParsed, startDateParsed) + 1 : 0;
  const days = isWishlist ? wishlistDays
    : startDateParsed ? Array.from({ length: daysCount }).map((_, i) =>
      format(addDays(startDateParsed, i), 'yyyy-MM-dd')
    ) : [];

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

  const totalDayCost = useMemo(() =>
    filteredItems.reduce((sum, item) => sum + (item.cost ?? 0), 0), [filteredItems]
  );

  const dayCities = trip.dayCities ?? {};
  const currentCity = dayCities[selectedDate] ?? '';

  const saveCity = (val: string) => {
    const trimmed = val.trim();
    updateTrip({ ...trip, dayCities: { ...dayCities, [selectedDate]: trimmed } });
    setEditingCity(false);
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

  return (
    <div className="flex flex-col h-full relative">
      {/* Day Selector */}
      <div className="sticky top-0 z-20 bg-background pt-3 pb-2 px-4 overflow-x-auto no-scrollbar border-b border-border/50">
        <div className="flex gap-2 min-w-max">
          {days.map((day) => {
            const isSelected = selectedDate === day;
            const hasItems = sortedItems.some(i => i.date === day);
            const hasAccom = allItems.some(i =>
              i.elementType === 'accommodation' && i.date <= day && (i.endDate ?? i.date) >= day
            );
            const city = dayCities[day] ?? '';
            return (
              <button
                key={day}
                onClick={() => setSelectedDate(day)}
                className={cn(
                "flex flex-col items-center justify-center px-3 py-2 rounded-2xl transition-all font-medium border-2 relative",
                city ? "min-w-[68px] h-20" : "min-w-[64px] h-16",
                isSelected
                  ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-card border-border text-foreground/70 hover:border-primary/30"
              )}
              >
                {city && (
                  <span
                    className={cn(
                      "text-[11px] font-bold leading-none mb-0.5 whitespace-nowrap",
                      isSelected ? "text-primary-foreground/80" : "text-primary"
                    )}
                  >
                    {city}
                  </span>
                )}
                <span className="text-xs uppercase opacity-80">
                  {isDayLabel(day) ? day : safeFormatDate(day, d => format(d, 'EEE'), '')}
                </span>
                <span className="text-[19px] font-semibold mt-0.5">
                  {isDayLabel(day) ? day.replace('Day ', 'D') : safeFormatDate(day, d => format(d, 'd'), '')}
                </span>
                {hasAccom && (
                  <span className={cn(
                    "text-[9px] font-bold mt-0.5 leading-none",
                    isSelected ? "text-primary-foreground/60" : "text-violet-400"
                  )}>STAY</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 py-4 pb-32 overflow-y-auto flex-1">
        {/* City + date header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {isDayLabel(selectedDate) ? selectedDate : safeFormatDate(selectedDate, d => format(d, 'EEEE, MMMM d'), selectedDate)}
            </span>
            {editingCity ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  ref={cityInputRef}
                  autoFocus
                  value={cityDraft}
                  onChange={e => setCityDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveCity(cityDraft);
                    if (e.key === 'Escape') setEditingCity(false);
                  }}
                  placeholder="City name…"
                  className="text-base font-bold bg-transparent border-b-2 border-primary outline-none text-foreground placeholder:text-muted-foreground/50 min-w-0 w-40"
                />
                <button onClick={() => saveCity(cityDraft)} className="text-primary"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingCity(false)} className="text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button
                onClick={() => { setCityDraft(currentCity); setEditingCity(true); }}
                className="flex items-center gap-1.5 mt-0.5 group/city"
              >
                {currentCity ? (
                  <span className="text-base font-bold text-foreground">{currentCity}</span>
                ) : (
                  <span className="text-[13px] text-muted-foreground/60 italic">Tap to add city…</span>
                )}
                <Pencil className="w-3.5 h-3.5 text-muted-foreground/40 group-hover/city:text-primary transition-colors" />
              </button>
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
            {totalDayMinutes > 0 && (
              <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                <Clock className="w-3 h-3" />
                {getDuration('00:00', addMinutesToTime('00:00', totalDayMinutes))}
              </div>
            )}
            {totalDayCost > 0 && (
              <div className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                ₹{Math.round(totalDayCost).toLocaleString('en-IN')}
              </div>
            )}
          </div>
        </div>

        {/* Accommodation banners */}
        {activeAccommodations.map(accom => (
          <AccommodationCard
            key={accom.id}
            item={accom}
            trip={trip}
            onEdit={() => setEditItem(accom)}
          />
        ))}

        {/* Regular items */}
        {filteredItems.length === 0 && activeAccommodations.length === 0 ? (
          <div className="text-center text-muted-foreground mt-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-medium">Nothing planned for this day.</p>
            <p className="text-sm mt-1 opacity-70">Tap + to add something.</p>
          </div>
        ) : filteredItems.length === 0 ? null : (
          <div className="space-y-5 mt-5">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {filteredItems.map((item, index) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  documents={documents}
                  trip={trip}
                  onEdit={() => setEditItem(item)}
                  isLast={index === filteredItems.length - 1}
                />
              ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      {getTripStatus(trip) !== 'archived' && <FAB icon={Plus} onClick={() => setIsAddOpen(true)} />}

      <AddEditSheet
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        trip={trip}
        defaultDate={selectedDate}
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
  onEdit,
}: {
  item: ItineraryItem;
  trip: Trip;
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
    alert("Document not available.");
    return;
  }

  window.open(doc.file_url, "_blank");
};

const detachDoc = (docId: string) => {
  if (!confirm("Remove this file from the item?")) return;

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

  const handleDelete = () => {
    if (!confirm("Remove this accommodation?")) return;

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
        "mb-4 overflow-hidden rounded-[28px] border bg-card shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-all duration-300 hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)]",
        ELEMENT_BORDER.accommodation
      )}
    >
      <div className="flex items-stretch">

        {/* Left Strip */}

  <div
    className={cn(
      "flex w-[36px] shrink-0 flex-col",
      panelGradient(item.elementType)
    )}
  >
    <div className="flex h-[96px] items-center justify-center text-white">
      <Building2 className="h-4 w-4 stroke-[1.8]" />
    </div>

    <div className="flex-1" />

  </div>

  {/* Right Side */}

  <div className="min-w-0 w-0 flex-1">

          <button
  type="button"
  onClick={() => setExpanded((v) => !v)}
  className="w-full text-left"
>
  <div className="pl-8 pr-5 py-5">

    {/* Header */}

    <div className="flex min-w-0 items-start justify-between gap-4">

      <div className="min-w-0 flex-1">

        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">
          Stay
        </p>

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

      {/* Nights */}

      <div className="w-[56px] shrink-0 px-1 text-center">

        <div className="mb-1 h-px w-6 bg-border/60" />

        <p className="whitespace-nowrap text-[11px] font-medium italic text-violet-600">
          {nights} night{nights > 1 ? "s" : ""}
        </p>

        <div className="mt-1 h-px w-6 bg-border/60" />

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
        className="h-full rounded-full bg-violet-500 transition-all"
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
            className="rounded-lg p-2 transition-colors hover:bg-red-50 hover:text-red-500"
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
}: {
  item: ItineraryItem;
  documents: TripDocument[];
  trip: Trip;
  onEdit: () => void;
  isLast: boolean;
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
    alert("Document not available.");
    return;
  }

  window.open(doc.file_url, "_blank");
};

  const detachDoc = (docId: string) => {
  if (!confirm("Remove this attachment from this itinerary item?")) return;

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

  const handleDelete = () => {
    if (!confirm("Delete this item?")) return;

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
  <div className="flex items-start gap-3">

   {/* Timeline */}

<div className="relative w-10 shrink-0">
  <div className="h-[152px]" />

  <div
  className={cn(
  "absolute left-1/2 top-[44px] z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-background shadow-sm",
      item.elementType === "travel"
        ? "bg-blue-500"
        : item.elementType === "meal"
        ? "bg-amber-400"
        : "bg-orange-500"
    )}
  >
    <Icon className="h-4 w-4 text-white stroke-[2]" />
  </div>

  <span className="absolute left-1/2 top-[84px] -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground">
    {item.startTime}
  </span>

  {!isLast && (
  <div
    className="absolute left-1/2 top-[112px] -translate-x-1/2 rounded-full bg-border/80"
    style={{
      top: "116px",
      width: "2px",
      height: "110px",
    }}
  />
)}

</div>

{/* Card */}

<div
  className={cn(
    "flex-1 overflow-hidden rounded-[28px] border border-border/20 bg-card shadow-[0_10px_30px_rgba(15,23,42,0.08)] transition-[height] duration-300 hover:shadow-[0_14px_40px_rgba(15,23,42,0.12)]",
    ELEMENT_BORDER[item.elementType]
  )}
>
  <div className="flex items-stretch">

    {/* Thin Accent */}

<div
  className={cn(
    "w-[8px] shrink-0",
    item.elementType === "travel"
      ? "bg-blue-500"
      : item.elementType === "meal"
      ? "bg-amber-400"
      : "bg-orange-500"
  )}
/>

  {/* Right Side */}

  <div className="min-w-0 w-0 flex-1">

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left"
          >
            <div className="px-5 py-5">

      {/* Individual cards go here */}

        {item.elementType === "travel" && (
  <div className="relative flex h-full flex-col">

    {/* Header */}

    <div className="flex items-start gap-2.5">

      <div className="min-w-0 flex-1">

        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600">
          {travelLabel(item.travelType)}
        </p>

        {!expanded ? (

          <div className="mt-1 flex min-w-0 items-center gap-2">

            {/* From */}

            <span
              className="min-w-0 flex-1 truncate text-[17px] font-semibold leading-[1.35]"
              title={item.fromLocation}
            >
              {item.fromLocation || "—"}
            </span>

            {/* Connector */}

            <div className="flex shrink-0 items-center">

              <div className="w-1 border-t border-dashed border-blue-300" />

              <Icon className="mx-1 h-4 w-4 shrink-0 text-blue-500" />

              <div className="w-1 border-t border-dashed border-blue-300" />

            </div>

            {/* To */}

            <span
              className="min-w-0 flex-1 truncate text-right text-[17px] font-semibold leading-[1.35]"
              title={item.toLocation}
            >
              {item.toLocation || "—"}
            </span>

          </div>

        ) : (

          <div className="mt-3">

            <p
              className="break-words text-[18px] font-semibold leading-[1.35]"
              title={item.fromLocation}
            >
              {item.fromLocation || "—"}
            </p>

            <div className="my-4 flex items-center justify-center">

              <div className="h-px w-10 border-t border-dashed border-blue-300" />

              <Icon className="mx-3 h-4 w-4 shrink-0 text-blue-500" />

              <div className="h-px w-10 border-t border-dashed border-blue-300" />

            </div>

            <p
              className="break-words text-[18px] font-semibold leading-[1.35]"
              title={item.toLocation}
            >
              {item.toLocation || "—"}
            </p>

          </div>

        )}

      </div>

      <ChevronDown
        className={cn(
          "mt-6 h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-300",
          expanded && "rotate-180"
        )}
      />

    </div>

    {/* Journey */}

    <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-4">

      {/* Departure */}

      <div className="min-w-0">

        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Departure
        </p>

        <p className="mt-1 text-[15px] font-semibold">
          {item.startTime || "—"}
        </p>

      </div>

      {/* Duration */}

      <div className="px-2">

        <p className="whitespace-nowrap text-[11px] italic text-blue-600">
          {duration || "—"}
        </p>

      </div>

      {/* Arrival */}

      <div className="min-w-0 text-right">

        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Arrival
        </p>

        <p className="mt-1 text-[15px] font-semibold">
          {item.endTime || "—"}
        </p>

      </div>

    </div>

  </div>
)}

        {item.elementType === "meal" && (
  <div className="relative flex h-full flex-col">

    {/* Header */}

    <div className="flex min-w-0 items-start justify-between gap-4">

      <div className="min-w-0 flex-1">

        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500">
          {categoryLabel(item)}
        </p>

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

    {/* Time */}

    <div className="mt-5">

  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
    Time
  </p>

  <p className="mt-1 text-[15px] font-semibold">
    {item.startTime || "—"}
  </p>

</div>

  </div>
)}
        {item.elementType === "activity" && (
  <div className="relative flex h-full flex-col">

    {/* Header */}

    <div className="flex min-w-0 items-start justify-between gap-4">

      <div className="min-w-0 flex-1">

        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-500">
          Activity
        </p>

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

    {/* Activity Timeline */}

<div className="mt-4 flex items-end justify-between gap-6">

  {/* Time */}

  <div className="min-w-0 flex-1">

    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      Time
    </p>

    <p className="mt-1 text-[15px] font-semibold">
      {item.startTime || "—"}
    </p>

  </div>

  {/* Duration */}

  <div className="text-right">

    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      Duration
    </p>

    <p className="mt-1 text-[15px] font-semibold">
      {duration || "—"}
    </p>

  </div>

</div>

  </div>
)}

    </div>

  </button>


{expanded && (
  <div className="border-t border-border/20 bg-background py-2">

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
          "h-full rounded-full transition-all duration-300",
          item.elementType === "travel"
            ? "bg-blue-500"
            : item.elementType === "accommodation"
            ? "bg-violet-500"
            : item.elementType === "meal"
            ? "bg-amber-400"
            : "bg-orange-500"
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
                    : "bg-orange-500"
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
}

function AddEditSheet({ isOpen, onClose, trip, defaultDate, documents, allItems, existingItem }: SheetProps) {
  const { mutateAsync: saveItem, isPending } = useSaveItineraryItem();
  const { mutateAsync: addDocument } = useAddDocument();
  const { mutateAsync: saveExpense } = useSaveExpense();
  const { mutate: deleteExpense } = useDeleteExpense();

  const destCurrency = trip.destinationCurrency || 'INR';
  const showCurrencyToggle = destCurrency !== 'INR';

  const [elementType, setElementType] = useState<ElementType>(existingItem?.elementType || 'activity');
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
            <div className="grid grid-cols-4 gap-2">
              {ELEMENT_TYPES.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setElementType(id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-[15px] font-semibold",
                    elementType === id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                  )}>
                  <Icon className="w-5 h-5" />{label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date */}
        {elementType !== 'accommodation' && (
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" defaultValue={existingItem?.date || defaultDate} required />
          </div>
        )}

        {/* TRAVEL fields */}
        {elementType === 'travel' && (
          <>
            <div>
              <Label>Travel Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {(['flight', 'train', 'bus', 'car'] as TravelType[]).map(t => {
                  const TIcon = TRAVEL_ICONS[t];
                  return (
                    <button key={t} type="button" onClick={() => setTravelType(t)}
                      className={cn("flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all text-xs font-semibold capitalize",
                        travelType === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                      )}>
                      <TIcon className="w-4 h-4" />{t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fromLocation">From</Label>
                <Input id="fromLocation" name="fromLocation" placeholder="Delhi (DEL)" defaultValue={existingItem?.fromLocation} required />
              </div>
              <div>
                <Label htmlFor="toLocation">To</Label>
                <Input id="toLocation" name="toLocation" placeholder="Paris (CDG)" defaultValue={existingItem?.toLocation} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="checkInDate">Check-in Date</Label>
                <Input id="checkInDate" name="date" type="date" defaultValue={existingItem?.date || defaultDate} required />
              </div>
              <div>
                <Label htmlFor="checkInTime">Check-in Time</Label>
                <Input id="checkInTime" name="checkInTime" type="time" defaultValue={existingItem?.startTime || '14:00'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-4 gap-2">
                {MEAL_SUBTYPES.map(({ id, label, icon: MIcon }) => (
                  <button key={id} type="button" onClick={() => handleMealSubTypeChange(id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-semibold",
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
            <div className="grid grid-cols-2 gap-3">
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
            "flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all",
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
              className="flex items-center justify-between w-full h-12 px-4 rounded-xl border-2 border-border bg-card text-base transition-all hover:border-primary/40"
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
                      <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all", isSel ? "bg-primary border-primary" : "border-border")}>
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
