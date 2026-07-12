import React, { useState } from "react";
import { Plus, MapPin, CheckCircle2, Circle, Trash2, Calendar, Link2, Pencil } from "lucide-react";
import { usePlaces, useSavePlace, useDeletePlace, useSaveItineraryItem } from "@/hooks/use-store";
import { Trip, Place, ItineraryItem, ChecklistItem } from "@/lib/types";
import { generateId, cn, safeFormatDate, getTripStatus } from "@/lib/utils";
import { Button, Input, Label, BottomSheet, FAB } from "@/components/ui";
import { format } from "date-fns";

export default function PlacesTab({ trip }: { trip: Trip }) {
  const { data: places = [] } = usePlaces(trip.id);
  const { mutate: savePlace } = useSavePlace();
  const [isAddOpen, setIsAddOpen] = useState(false);
const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [filter, setFilter] = useState<'all' | 'visited' | 'unvisited'>('all');

  const filtered = places.filter(p => {
    if (filter === 'visited') return p.visited;
    if (filter === 'unvisited') return !p.visited;
    return true;
  });

  const toggleVisit = (place: Place) => savePlace({ ...place, visited: !place.visited });

  return (
    <div className="p-5 h-full relative pb-32">
      <div className="flex bg-muted p-1 rounded-xl mb-5">
        {(['all', 'unvisited', 'visited'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "flex-1 py-1.5 text-sm font-semibold capitalize rounded-lg transition-all",
              filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground mt-16">
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No places found.</p>
          </div>
        ) : (
          filtered.map(place => (
            <PlaceCard
            key={place.id}
            place={place}
            trip={trip}
            onToggle={() => toggleVisit(place)}
            onEdit={() => setEditingPlace(place)}
          />
          ))
        )}
      </div>

      {getTripStatus(trip) !== 'archived' && <FAB icon={Plus} onClick={() => setIsAddOpen(true)} />}
      <>
  <AddPlaceSheet
    isOpen={isAddOpen}
    onClose={() => setIsAddOpen(false)}
    tripId={trip.id}
  />

  <AddPlaceSheet
    isOpen={!!editingPlace}
    onClose={() => setEditingPlace(null)}
    tripId={trip.id}
    place={editingPlace}
  />
</>
    </div>
  );
}

function PlaceCard({
  place,
  trip,
  onToggle,
  onEdit,
}: {
  place: Place;
  trip: Trip;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { mutate: deletePlace } = useDeletePlace();
  const { mutate: savePlace } = useSavePlace();
  const { mutate: saveItinerary } = useSaveItineraryItem();
  const [showChecklist, setShowChecklist] = useState(false);
  const [newItem, setNewItem] = useState('');

  const doneCount = place.checklist?.filter(c => c.done).length ?? 0;
  const totalCount = place.checklist?.length ?? 0;

  const toggleChecklistItem = (id: string) => {
    savePlace({
      ...place,
      checklist: place.checklist?.map(c => c.id === id ? { ...c, done: !c.done } : c)
    });
  };

  const addChecklistItem = () => {
    if (!newItem.trim()) return;
    const item: ChecklistItem = { id: generateId(), text: newItem.trim(), done: false };
    savePlace({ ...place, checklist: [...(place.checklist || []), item] });
    setNewItem('');
  };

  const removeChecklistItem = (id: string) => {
    savePlace({ ...place, checklist: place.checklist?.filter(c => c.id !== id) });
  };

  const linkToTimeline = () => {
    if (!place.date) return;
    const itineraryItem: ItineraryItem = {
      id: generateId(),
      tripId: place.tripId,
      elementType: 'activity',
      title: place.name,
      location: place.location,
      date: place.date,
      startTime: '10:00',
      endTime: '12:00',
      notes: place.notes,
      category: 'activity',
      order: 0,
      fromPlaceId: place.id,
      checklist: place.checklist,
    };
    saveItinerary(itineraryItem);
    savePlace({ ...place, linkedToTimeline: true });
  };

  return (
    <div className={cn(
      "bg-card rounded-2xl border transition-all overflow-hidden",
      place.visited ? "border-primary/30 bg-primary/5" : "border-border shadow-sm"
    )}>
      <div className="p-4 flex gap-3 items-center">
        <button onClick={onToggle} className="mt-0.5 shrink-0 text-primary transition-transform active:scale-90">
          {place.visited
            ? <CheckCircle2 className="w-6 h-6" />
            : <Circle className="w-6 h-6 text-muted-foreground" />}
        </button>

        <div className="flex-1 min-w-0 self-center">
          <h4
            className={cn(
              "font-bold text-foreground text-base leading-5 break-words max-w-full",
              place.visited && "line-through text-foreground/60"
            )}
          >
            {place.name}
          </h4>
          {place.location && (
            <div className="flex items-center text-sm text-muted-foreground mt-0.5">
              <MapPin className="w-3.5 h-3.5 mr-1 shrink-0" />
              <span className="truncate">{place.location}</span>
            </div>
          )}
          {place.date && (
            <div className="flex items-center text-xs text-primary/80 mt-1 font-medium gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {safeFormatDate(place.date, d => format(d, 'MMM d, yyyy'), place.date || '')}
            </div>
          )}
          {place.notes && (
            <p className="text-sm mt-2 text-foreground/70 bg-background/60 p-2 rounded-lg border border-border/50">{place.notes}</p>
          )}

          {/* Checklist preview */}
          {totalCount > 0 && (
            <button
              onClick={() => setShowChecklist(v => !v)}
              className="flex items-center gap-2 mt-2 text-xs font-medium text-muted-foreground"
            >
              <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%` }} />
              </div>
              {doneCount}/{totalCount} done
            </button>
          )}

          {/* Expanded checklist */}
          {showChecklist && (
            <div className="mt-3 space-y-1.5 bg-muted/30 rounded-xl p-3 border border-border/40">
              {place.checklist?.map(ci => (
                <div key={ci.id} className="flex items-center gap-2">
                  <button onClick={() => toggleChecklistItem(ci.id)} className="shrink-0">
                    {ci.done
                      ? <CheckCircle2 className="w-4 h-4 text-primary" />
                      : <Circle className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <span className={cn("text-sm flex-1", ci.done && "line-through text-muted-foreground")}>{ci.text}</span>
                  <button onClick={() => removeChecklistItem(ci.id)} className="text-muted-foreground hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-2 pt-2 border-t border-border/40">
                <Input
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  placeholder="Add item…"
                  className="h-9 text-sm"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addChecklistItem} className="h-9 px-3 shrink-0">Add</Button>
              </div>
            </div>
          )}

          {/* Link to timeline — shows icon-only once linked */}
          {place.date && (
            place.linkedToTimeline ? (
              <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-primary/60">
                <Link2 className="w-3.5 h-3.5" />
                <span>Linked to timeline</span>
              </div>
            ) : (
              <button
                onClick={linkToTimeline}
                className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full"
              >
                <Link2 className="w-3.5 h-3.5" />
                Add to Timeline
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2 self-center">
  <button
    onClick={onEdit}
    className="text-muted-foreground hover:text-primary p-1"
  >
    <Pencil className="w-4 h-4" />
  </button>

  <button
    onClick={() => {
      if (confirm("Remove place?")) {
        deletePlace({ tripId: place.tripId, id: place.id });
      }
    }}
    className="text-muted-foreground hover:text-red-500 p-1"
  >
    <Trash2 className="w-4 h-4" />
  </button>
</div>
      </div>
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
      id: generateId(),
      tripId,
      name: fd.get('name') as string,
      location: fd.get('location') as string,
      notes: fd.get('notes') as string,
      visited: false,
      date: dateVal || undefined,
      checklist: checklist.length > 0 ? checklist : undefined,
      createdAt: Date.now()
    });
    setChecklist([]);
    setChecklistText('');
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={place ? "Edit Place" : "Save a Place"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
