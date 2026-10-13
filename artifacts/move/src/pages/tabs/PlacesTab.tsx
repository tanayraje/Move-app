import React, { useState } from "react";
import {
  Plus,
  MapPin,
  CheckCircle2,
  Circle,
  Trash2,
  Calendar,
  Link2,
  Pencil,
  ChevronDown,
  Navigation,
  X,
} from "lucide-react";
import { usePlaces, useSavePlace, useDeletePlace, useSaveItineraryItem } from "@/hooks/use-store";
import { Trip, Place, ItineraryItem, ChecklistItem } from "@/lib/types";
import { generateId, cn, safeFormatDate, getTripStatus } from "@/lib/utils";
import { Button, Input, Label, BottomSheet, FAB } from "@/components/ui";
import { format } from "date-fns";

type Filter = "all" | "unvisited" | "visited";

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-10px_rgba(15,23,42,0.14)]";
const PILL =
  "inline-flex h-10 items-center gap-1.5 rounded-full bg-card px-4 text-[13px] font-semibold ring-1 ring-border active:scale-[0.98] transition-transform";

export default function PlacesTab({ trip }: { trip: Trip }) {
  const { data: places = [] } = usePlaces(trip.id);
  const { mutate: savePlace } = useSavePlace();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const visitedCount = places.filter(p => p.visited).length;
  const pct = places.length ? (visitedCount / places.length) * 100 : 0;

  // To visit first (by date, undated last), visited at the bottom
  const sorted = [...places].sort(
    (a, b) =>
      Number(!!a.visited) - Number(!!b.visited) ||
      (a.date || "9999-12-31").localeCompare(b.date || "9999-12-31") ||
      (a.createdAt ?? 0) - (b.createdAt ?? 0)
  );
  const filtered = sorted.filter(p => (filter === "visited" ? p.visited : filter === "unvisited" ? !p.visited : true));
  const chips: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "All", n: places.length },
    { id: "unvisited", label: "To visit", n: places.length - visitedCount },
    { id: "visited", label: "Visited", n: visitedCount },
  ];

  const toggleVisit = (place: Place) => savePlace({ ...place, visited: !place.visited });

  return (
    <div className="relative px-4 pb-40 pt-2">
      <div className="mb-4 flex items-end justify-between px-1">
        <h2 className="font-display text-[28px] font-bold leading-none tracking-tight">Places</h2>
        {places.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {visitedCount} of {places.length} visited
          </span>
        )}
      </div>

      {places.length > 0 && (
        <>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-orange-400 dark:bg-orange-400/80 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-2">
            {chips.map(c => {
              const active = filter === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setFilter(c.id)}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold outline-none transition-colors focus:outline-none",
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_8px_16px_-6px_hsl(var(--primary)/0.55)] dark:shadow-none"
                      : "bg-card text-foreground/80 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_10px_-4px_rgba(15,23,42,0.1)]"
                  )}
                >
                  {c.label}
                  <span className={cn("text-[12px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{c.n}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-5 space-y-4">
        {places.length === 0 ? (
          <div className="mt-12 flex flex-col items-center px-8 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-orange-50 text-orange-600">
              <MapPin className="h-9 w-9" />
            </div>
            <h3 className="font-display text-xl font-bold">No places yet</h3>
            <p className="mt-1.5 max-w-[260px] text-[15px] text-muted-foreground">
              Save restaurants, sights and ideas you want to visit. Tap + to add the first one.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 text-center text-muted-foreground">
            <p className="font-medium text-foreground">{filter === "visited" ? "Nothing visited yet" : "Everything is visited"}</p>
            <p className="mt-1 text-sm">{filter === "visited" ? "Tick a place when you have been." : "Nice work."}</p>
          </div>
        ) : (
          filtered.map(place => (
            <PlaceCard
              key={place.id}
              place={place}
              onToggle={() => toggleVisit(place)}
              onEdit={() => setEditingPlace(place)}
            />
          ))
        )}
      </div>

      {getTripStatus(trip) !== "archived" && <FAB icon={Plus} label="Add place" onClick={() => setIsAddOpen(true)} />}
      <AddPlaceSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} tripId={trip.id} />
      <AddPlaceSheet isOpen={!!editingPlace} onClose={() => setEditingPlace(null)} tripId={trip.id} place={editingPlace} />
    </div>
  );
}

// ─── Place card: tap to open the checklist, notes and actions ─────────────────────────────────────

function PlaceCard({ place, onToggle, onEdit }: { place: Place; onToggle: () => void; onEdit: () => void }) {
  const { mutate: deletePlace, isPending: deleting } = useDeletePlace();
  const { mutate: savePlace } = useSavePlace();
  const { mutate: saveItinerary } = useSaveItineraryItem();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [newItem, setNewItem] = useState("");

  const doneCount = place.checklist?.filter(c => c.done).length ?? 0;
  const totalCount = place.checklist?.length ?? 0;
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [place.name, place.location].filter(Boolean).join(" ")
  )}`;

  const toggleChecklistItem = (id: string) =>
    savePlace({ ...place, checklist: place.checklist?.map(c => (c.id === id ? { ...c, done: !c.done } : c)) });

  const addChecklistItem = () => {
    if (!newItem.trim()) return;
    const item: ChecklistItem = { id: generateId(), text: newItem.trim(), done: false };
    savePlace({ ...place, checklist: [...(place.checklist || []), item] });
    setNewItem("");
  };

  const removeChecklistItem = (id: string) => savePlace({ ...place, checklist: place.checklist?.filter(c => c.id !== id) });

  const linkToTimeline = () => {
    if (!place.date) return;
    const itineraryItem: ItineraryItem = {
      id: generateId(),
      tripId: place.tripId,
      elementType: "activity",
      title: place.name,
      location: place.location,
      date: place.date,
      startTime: "10:00",
      endTime: "12:00",
      notes: place.notes,
      category: "activity",
      order: 0,
      fromPlaceId: place.id,
      checklist: place.checklist,
    };
    saveItinerary(itineraryItem);
    savePlace({ ...place, linkedToTimeline: true });
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[24px] bg-card ring-1 transition-colors",
        CARD_SHADOW,
        place.visited ? "ring-emerald-200/70" : "ring-border"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          aria-label={place.visited ? "Mark as not visited" : "Mark as visited"}
          onClick={onToggle}
          className="-m-1 mt-0 shrink-0 p-1 transition-transform active:scale-90"
        >
          {place.visited ? <CheckCircle2 className="h-7 w-7 text-emerald-500" /> : <Circle className="h-7 w-7 text-orange-300" />}
        </button>

        <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <h4 className={cn("break-words text-[16px] font-semibold leading-snug", place.visited && "text-muted-foreground")}>
            {place.name}
          </h4>
          {place.location && (
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-orange-500" />
              <span className="truncate">{place.location}</span>
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {place.date && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11.5px] font-semibold text-orange-700">
                <Calendar className="h-3 w-3" />
                {safeFormatDate(place.date, d => format(d, "MMM d"), place.date || "")}
              </span>
            )}
            {place.linkedToTimeline && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11.5px] font-semibold text-teal-700">
                <Link2 className="h-3 w-3" />
                On timeline
              </span>
            )}
            {totalCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
                  <i className="block h-full rounded-full bg-orange-400" style={{ width: `${(doneCount / totalCount) * 100}%` }} />
                </span>
                {doneCount} of {totalCount}
              </span>
            )}
          </div>
        </button>

        <button aria-label={open ? "Close details" : "Open details"} onClick={() => setOpen(v => !v)} className="-m-1 mt-0.5 shrink-0 p-1">
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground/60 transition-transform duration-300", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-dashed border-orange-200 bg-orange-50/50 px-4 py-4">
          {place.notes && <p className="text-[14px] leading-relaxed text-foreground/80">{place.notes}</p>}

          <div>
            <p className="mb-2 flex items-center justify-between text-[12px] font-semibold text-orange-800">
              <span>Checklist</span>
              {totalCount > 0 && (
                <span className="font-normal text-muted-foreground">
                  {doneCount} of {totalCount} done
                </span>
              )}
            </p>
            {totalCount > 0 && (
              <div className="space-y-2">
                {place.checklist?.map(ci => (
                  <div key={ci.id} className="flex items-center gap-2.5">
                    <button aria-label="Toggle item" onClick={() => toggleChecklistItem(ci.id)} className="shrink-0">
                      {ci.done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-orange-300" />}
                    </button>
                    <span className={cn("min-w-0 flex-1 break-words text-[14px]", ci.done && "text-muted-foreground line-through")}>{ci.text}</span>
                    <button aria-label="Remove item" onClick={() => removeChecklistItem(ci.id)} className="shrink-0 text-muted-foreground hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Input
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                placeholder="Add an item"
                className="h-10 flex-1 text-sm"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addChecklistItem} className="h-10 shrink-0 px-4">
                Add
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={directions} target="_blank" rel="noreferrer" className={PILL}>
              <Navigation className="h-4 w-4 text-primary" />
              Directions
            </a>
            {place.date && !place.linkedToTimeline && (
              <button onClick={linkToTimeline} className={cn(PILL, "bg-primary text-primary-foreground ring-0")}>
                <Link2 className="h-4 w-4" />
                Add to timeline
              </button>
            )}
            <button onClick={onEdit} className={PILL}>
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button onClick={() => setConfirming(true)} className={cn(PILL, "text-red-600")}>
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          </div>

          {confirming && (
            <div className="rounded-2xl bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">Remove this place for everyone on the trip?</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setConfirming(false)} className="h-11 flex-1 rounded-xl bg-card text-sm font-semibold ring-1 ring-border">
                  Cancel
                </button>
                <button
                  disabled={deleting}
                  onClick={() => deletePlace({ tripId: place.tripId, id: place.id })}
                  className="h-11 flex-1 rounded-xl bg-[#dc2626] dark:bg-[#dc2626]/85 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {deleting ? "Removing" : "Remove"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddPlaceSheet({
  isOpen,
  onClose,
  tripId,
  place,
}: {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  place?: Place | null;
}) {
  const { mutateAsync: savePlace, isPending } = useSavePlace();
  const [checklistText, setChecklistText] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  React.useEffect(() => {
  if (place) {
    setChecklist(place.checklist ?? []);
  } else {
    setChecklist([]);
  }
}, [place, isOpen]);

  const addChecklistItem = () => {
    if (!checklistText.trim()) return;
    setChecklist(prev => [...prev, { id: generateId(), text: checklistText.trim(), done: false }]);
    setChecklistText('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const dateVal = fd.get('date') as string;
    await savePlace({
      id: place?.id ?? generateId(),
      tripId,
      name: fd.get("name") as string,
      location: fd.get("location") as string,
      notes: fd.get("notes") as string,
      visited: place?.visited ?? false,
      linkedToTimeline: place?.linkedToTimeline ?? false,
      date: dateVal || undefined,
      checklist: checklist.length > 0 ? checklist : undefined,
      createdAt: place?.createdAt ?? Date.now(),
    });
    setChecklist([]);
    setChecklistText('');
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={place ? "Edit Place" : "Save a Place"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 [&>*]:min-w-0">
        <div>
          <Label htmlFor="name">Place Name</Label>
          <Input
          id="name"
          name="name"
          placeholder="Louvre Museum"
          defaultValue={place?.name}
          required
        />
        </div>
        <div>
          <Label htmlFor="location">Address / Location</Label>
          <Input
          id="location"
          name="location"
          placeholder="Paris, France"
          defaultValue={place?.location}
        />
        </div>
        <div>
          <Label htmlFor="date">Link to Date (optional)</Label>
          <Input
          id="date"
          name="date"
          type="date"
          defaultValue={place?.date}
        />
          <p className="text-xs text-muted-foreground mt-1 ml-1">Setting a date lets you add this to the timeline</p>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input
          id="notes"
          name="notes"
          placeholder="Buy tickets online beforehand"
          defaultValue={place?.notes}
        />
        </div>
        <div>
          <Label>Checklist (optional)</Label>
          <div className="flex gap-2 mb-2">
            <Input
              value={checklistText}
              onChange={e => setChecklistText(e.target.value)}
              placeholder="e.g. Buy tickets"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addChecklistItem} className="shrink-0 h-12 px-3">Add</Button>
          </div>
          {checklist.length > 0 && (
            <div className="space-y-1.5 bg-muted/30 rounded-xl p-3 border border-border/40">
              {checklist.map((ci, idx) => (
                <div key={ci.id} className="flex items-center gap-2">
                  <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1">{ci.text}</span>
                  <button type="button" onClick={() => setChecklist(prev => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button type="submit" size="lg" className="mt-4" isLoading={isPending}>{place ? "Save Changes" : "Add Place"}</Button>
      </form>
    </BottomSheet>
  );
}
