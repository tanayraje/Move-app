import React, { useState, useMemo, useCallback, useRef } from "react";
import { format, addDays, differenceInDays } from "date-fns";
import {
  Plus, GripVertical, MapPin, Trash2, CalendarDays,
  Plane, Train, Bus, Car, Building2, UtensilsCrossed,
  Bike, FileText, Paperclip, Check, Square, Clock, Upload,
  ArrowLeftRight, Pencil, X, ChevronDown, ChevronRight,
  Coffee, Wine, Sun, Sunset
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

// ─── Constants ────────────────────────────────────────────────────────────────
type MealSubType = 'breakfast' | 'lunch' | 'dinner' | 'drinks';

const MEAL_SUBTYPES: { id: MealSubType; label: string; icon: React.ElementType; defaultTime: string }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: Coffee,      defaultTime: '08:00' },
  { id: 'lunch',     label: 'Lunch',     icon: Sun,         defaultTime: '13:00' },
  { id: 'dinner',    label: 'Dinner',    icon: Sunset,      defaultTime: '20:00' },
  { id: 'drinks',    label: 'Drinks',    icon: Wine,        defaultTime: '21:00' },
];

const ELEMENT_COLORS: Record<ElementType, string> = {
  travel: 'bg-blue-500',
  accommodation: 'bg-violet-500',
  meal: 'bg-amber-400',
  activity: 'bg-orange-500',
};

const ELEMENT_BORDER: Record<ElementType, string> = {
  travel: 'border-l-blue-500',
  accommodation: 'border-l-violet-500',
  meal: 'border-l-amber-400',
  activity: 'border-l-orange-500',
};

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
      const dur = Math.max(parseTime(item.endTime) - parseTime(item.startTime), 30);
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
                  "flex flex-col items-center justify-center px-2 py-2 min-w-[56px] rounded-2xl transition-all font-medium border-2 relative",
                  city ? "h-20" : "h-16",
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-card border-border text-foreground/70 hover:border-primary/30"
                )}
              >
                {city && (
                  <span className={cn(
                    "text-[10px] font-bold truncate max-w-[52px] leading-none mb-0.5",
                    isSelected ? "text-primary-foreground/80" : "text-primary"
                  )}>{city}</span>
                )}
                <span className="text-xs uppercase opacity-80">
                  {isDayLabel(day) ? day : safeFormatDate(day, d => format(d, 'EEE'), '')}
                </span>
                <span className="text-lg font-bold mt-0.5">
                  {isDayLabel(day) ? day.replace('Day ', 'D') : safeFormatDate(day, d => format(d, 'd'), '')}
                </span>
                {hasAccom && (
                  <span className={cn(
                    "text-[9px] font-bold mt-0.5 leading-none",
                    isSelected ? "text-primary-foreground/60" : "text-violet-400"
                  )}>STAY</span>
                )}
                {hasItems && !isSelected && !hasAccom && (
                  <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-primary/60" />
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
                  <span className="text-sm text-muted-foreground/60 italic">Tap to add city…</span>
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
          <AccommodationBanner
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
          <div className="relative border-l-2 border-border/40 ml-5 pl-6 space-y-3 mt-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {filteredItems.map(item => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    documents={documents}
                    trip={trip}
                    onEdit={() => setEditItem(item)}
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

// ─── Accommodation Banner ─────────────────────────────────────────────────────
function AccommodationBanner({ item, trip, onEdit }: { item: ItineraryItem; trip: Trip; onEdit: () => void }) {
  const { mutate: deleteItem } = useDeleteItineraryItem();
  const { mutate: deleteExpense } = useDeleteExpense();
  const [expanded, setExpanded] = useState(false);
  const nights = item.endDate ? stayNights(item.date, item.endDate) : 1;
  const destCurrency = trip.destinationCurrency || 'INR';

  const handleDelete = () => {
    if (!confirm('Remove this accommodation?')) return;
    if (item.expenseId) deleteExpense({ id: item.expenseId, tripId: item.tripId });
    deleteItem({ tripId: item.tripId, id: item.id });
  };

  return (
    <div className="bg-card border-2 border-violet-200 dark:border-violet-800 rounded-2xl mb-3 overflow-hidden shadow-sm">
      {/* Always-visible header — click to expand */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-8 h-8 rounded-xl bg-violet-500 text-white flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider leading-none mb-0.5">Staying At</p>
          <h4 className="font-bold text-foreground text-base leading-tight truncate">{item.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {safeFormatDate(item.date, d => format(d, 'MMM d'), item.date)}
            {item.startTime && ` ${item.startTime}`}
            {' – '}
            {item.endDate ? safeFormatDate(item.endDate, d => format(d, 'MMM d'), item.endDate) : '—'}
            {item.endTime && ` ${item.endTime}`}
            {' · '}{nights} night{nights !== 1 ? 's' : ''}
          </p>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-2">
          {item.location && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{item.location}</span>
            </div>
          )}
          {item.cost != null && item.cost > 0 && (
            <div className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              <span>₹{Math.round(item.cost).toLocaleString('en-IN')}</span>
              {destCurrency !== 'INR' && (
                <span className="text-primary/60 font-normal">
                  · {formatCurrency(convertFromINR(item.cost, destCurrency), destCurrency)}
                </span>
              )}
            </div>
          )}
          {item.notes && (
            <p className="text-sm text-foreground/70 bg-muted/40 px-3 py-2 rounded-xl border border-border/40">
              {item.notes}
            </p>
          )}
          <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
            <button onClick={onEdit} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={handleDelete} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sortable Item ────────────────────────────────────────────────────────────
function SortableItem({
  item, documents, trip, onEdit
}: { item: ItineraryItem; documents: TripDocument[]; trip: Trip; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const { mutate: deleteItem } = useDeleteItineraryItem();
  const { mutate: deleteExpense } = useDeleteExpense();
  const { mutate: saveItem } = useSaveItineraryItem();
  const { mutate: deleteDoc } = useDeleteDocument();

  const [expanded, setExpanded] = useState(false);

  const style = { transform: CSS.Transform.toString(transform), transition };
  const Icon = item.elementType ? ELEMENT_ICONS[item.elementType] : Plane;
  const isMajor = item.elementType === 'travel';
  const attachedDocs = documents.filter(d => (item.attachedDocIds || []).includes(d.id));
  const duration = getDuration(item.startTime, item.endTime);
  const destCurrency = trip.destinationCurrency || 'INR';

  const totalChecklist = item.checklist?.length ?? 0;
  const doneChecklist = item.checklist?.filter(c => c.done).length ?? 0;
  const mealInfo = item.mealSubType
    ? MEAL_SUBTYPES.find(m => m.id === item.mealSubType)
    : null;
  const MealIcon = mealInfo?.icon ?? UtensilsCrossed;

  const openDoc = (doc: TripDocument) => {
    const url = URL.createObjectURL(doc.blob);
    window.open(url, '_blank');
  };

  const detachDoc = (docId: string) => {
    if (!confirm('Remove this file from the item?')) return;
    // Detach from item
    saveItem({ ...item, attachedDocIds: (item.attachedDocIds || []).filter(id => id !== docId) });
    // Delete from IndexedDB
    deleteDoc({ id: docId, tripId: item.tripId });
  };

  const toggleChecklistItem = (checkId: string) => {
    if (!item.checklist) return;
    saveItem({ ...item, checklist: item.checklist.map(c => c.id === checkId ? { ...c, done: !c.done } : c) });
  };

  const handleDelete = () => {
    if (!confirm('Delete this item?')) return;
    if (item.expenseId) deleteExpense({ id: item.expenseId, tripId: item.tripId });
    deleteItem({ tripId: item.tripId, id: item.id });
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative transition-opacity", isDragging && "opacity-50")}>
      {/* Timeline dot */}
      <div className={cn(
        "absolute -left-[31px] top-4 w-4 h-4 rounded-full border-4 border-background z-10",
        item.elementType ? ELEMENT_COLORS[item.elementType] : 'bg-primary'
      )} />

      <div className={cn(
        "bg-card rounded-2xl shadow-sm border border-border overflow-hidden",
        isMajor ? `border-l-4 ${ELEMENT_BORDER[item.elementType]}` : ""
      )}>
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-full h-6 bg-muted/30 border-b border-border/30 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/40 rotate-90" />
        </div>

        {/* Collapsed header — always visible, tap to expand */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", item.elementType ? ELEMENT_COLORS[item.elementType] : 'bg-primary')}>
            {item.elementType === 'meal' && mealInfo
              ? <MealIcon className="w-3.5 h-3.5 text-white" />
              : <Icon className="w-3.5 h-3.5 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-foreground text-sm leading-tight truncate">{item.title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.startTime}–{item.endTime}
              {duration && ` · ${duration}`}
            </p>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-2">
            {/* Meal sub-type tag */}
            {mealInfo && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <MealIcon className="w-3 h-3" />{mealInfo.label}
              </span>
            )}

            {/* Travel from→to */}
            {item.fromLocation && item.toLocation && (
              <div className="flex items-center text-sm text-muted-foreground gap-1 bg-muted/40 px-3 py-1.5 rounded-xl">
                <span className="truncate font-medium">{item.fromLocation}</span>
                <span className="font-bold text-foreground/40 shrink-0">→</span>
                <span className="truncate font-medium">{item.toLocation}</span>
              </div>
            )}

            {/* Location */}
            {item.location && !item.fromLocation && (
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span className="truncate">{item.location}</span>
              </div>
            )}

            {/* Cost */}
            {item.cost != null && item.cost > 0 && (
              <div className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                <span>₹{Math.round(item.cost).toLocaleString('en-IN')}</span>
                {destCurrency !== 'INR' && (
                  <span className="text-primary/60 font-normal">
                    · {formatCurrency(convertFromINR(item.cost, destCurrency), destCurrency)}
                  </span>
                )}
              </div>
            )}

            {/* Notes */}
            {item.notes && (
              <p className="text-sm text-foreground/70 bg-muted/40 px-3 py-2 rounded-xl border border-border/40">
                {item.notes}
              </p>
            )}

            {/* Checklist */}
            {item.checklist && item.checklist.length > 0 && (
              <div className="bg-muted/30 rounded-xl p-3 border border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Checklist</span>
                  <span className="text-xs text-muted-foreground">{doneChecklist}/{totalChecklist}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: totalChecklist ? `${(doneChecklist / totalChecklist) * 100}%` : '0%' }}
                  />
                </div>
                {item.checklist.map(ci => (
                  <button key={ci.id} onClick={() => toggleChecklistItem(ci.id)} className="flex items-center gap-2 w-full text-left py-1">
                    {ci.done
                      ? <Check className="w-4 h-4 text-primary shrink-0" />
                      : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className={cn("text-sm", ci.done ? "line-through text-muted-foreground" : "text-foreground")}>{ci.text}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Attached docs — with delete button */}
            {attachedDocs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Files</p>
                {attachedDocs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 border border-border/40">
                    <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                    <button
                      onClick={() => openDoc(doc)}
                      className="flex-1 text-xs font-medium text-primary truncate text-left"
                    >
                      {doc.name}
                    </button>
                    <button
                      onClick={() => detachDoc(doc.id)}
                      className="p-1 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/5"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        )}
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
  const [duration, setDuration] = useState(60);
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
                    "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-sm font-semibold",
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
              className="pl-10 text-lg font-bold h-14"
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
