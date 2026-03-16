import React, { useState } from "react";
import { Plus, MapPin, CheckCircle2, Circle, Trash2 } from "lucide-react";
import { usePlaces, useSavePlace, useDeletePlace } from "@/hooks/use-store";
import { Trip, Place } from "@/lib/types";
import { generateId, cn } from "@/lib/utils";
import { Button, Input, Label, BottomSheet, FAB } from "@/components/ui";

export default function PlacesTab({ trip }: { trip: Trip }) {
  const { data: places = [] } = usePlaces(trip.id);
  const { mutate: savePlace } = useSavePlace();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filter, setFilter] = useState<'all'|'visited'|'unvisited'>('all');

  const filtered = places.filter(p => {
    if (filter === 'visited') return p.visited;
    if (filter === 'unvisited') return !p.visited;
    return true;
  });

  const toggleVisit = (place: Place) => {
    savePlace({ ...place, visited: !place.visited });
  };

  return (
    <div className="p-6 h-full relative">
      <div className="flex bg-muted p-1 rounded-xl mb-6">
        {['all', 'unvisited', 'visited'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={cn(
              "flex-1 py-1.5 text-sm font-semibold capitalize rounded-lg transition-all",
              filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3 pb-20">
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground mt-12">
            <p>No places found.</p>
          </div>
        ) : (
          filtered.map(place => (
            <PlaceCard key={place.id} place={place} onToggle={() => toggleVisit(place)} />
          ))
        )}
      </div>

      <FAB icon={Plus} onClick={() => setIsAddOpen(true)} />
      <AddPlaceSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} tripId={trip.id} />
    </div>
  );
}

function PlaceCard({ place, onToggle }: { place: Place, onToggle: () => void }) {
  const { mutate: deletePlace } = useDeletePlace();

  return (
    <div className={cn(
      "bg-card p-4 rounded-2xl border transition-all flex gap-4 items-start",
      place.visited ? "border-primary/30 bg-primary/5" : "border-border shadow-sm"
    )}>
      <button onClick={onToggle} className="mt-1 shrink-0 text-primary transition-transform active:scale-90">
        {place.visited ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6 text-muted-foreground" />}
      </button>
      
      <div className="flex-1 min-w-0">
        <h4 className={cn("font-bold text-foreground text-lg", place.visited && "line-through text-foreground/60")}>{place.name}</h4>
        {place.location && (
          <div className="flex items-center text-sm text-muted-foreground mt-1">
            <MapPin className="w-3.5 h-3.5 mr-1" />
            <span className="truncate">{place.location}</span>
          </div>
        )}
        {place.notes && (
          <p className="text-sm mt-2 text-foreground/70 bg-background p-2 rounded-lg border border-border/50">{place.notes}</p>
        )}
      </div>

      <button onClick={() => { if(confirm('Remove place?')) deletePlace({ tripId: place.tripId, id: place.id }) }} className="text-muted-foreground hover:text-red-500 p-1">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function AddPlaceSheet({ isOpen, onClose, tripId }: { isOpen: boolean, onClose: () => void, tripId: string }) {
  const { mutateAsync: savePlace, isPending } = useSavePlace();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await savePlace({
      id: generateId(),
      tripId,
      name: fd.get('name') as string,
      location: fd.get('location') as string,
      notes: fd.get('notes') as string,
      visited: false,
      createdAt: Date.now()
    });
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Save a Place">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="name">Place Name</Label>
          <Input id="name" name="name" placeholder="Louvre Museum" required />
        </div>
        <div>
          <Label htmlFor="location">Address / Location</Label>
          <Input id="location" name="location" placeholder="Paris, France" />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" name="notes" placeholder="Buy tickets online beforehand" />
        </div>
        <Button type="submit" size="lg" className="mt-4" isLoading={isPending}>
          Add Place
        </Button>
      </form>
    </BottomSheet>
  );
}
