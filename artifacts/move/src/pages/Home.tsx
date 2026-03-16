import React, { useState } from "react";
import { Link } from "wouter";
import { format, differenceInDays } from "date-fns";
import { Plus, MapPin, Calendar, Plane, Trash2 } from "lucide-react";
import { useTrips, useCreateTrip, useDeleteTrip } from "@/hooks/use-store";
import { generateId } from "@/lib/utils";
import { Button, Input, Label, BottomSheet } from "@/components/ui";

export default function Home() {
  const { data: trips = [], isLoading } = useTrips();
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-[100dvh] pb-8 relative">
      <header className="px-6 pt-12 pb-6 sticky top-0 bg-background/80 backdrop-blur-xl z-10">
        <h1 className="text-4xl font-display font-extrabold text-foreground tracking-tight">Move.</h1>
        <p className="text-muted-foreground mt-1 text-lg">Where to next?</p>
      </header>

      <main className="flex-1 px-6 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-3xl bg-muted animate-pulse" />)}
          </div>
        ) : trips.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Plane className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">No trips planned</h2>
            <p className="text-muted-foreground text-balance">Create your first itinerary to start planning your next adventure.</p>
            <Button className="mt-8 px-8" size="lg" onClick={() => setIsAddOpen(true)}>
              <Plus className="w-5 h-5 mr-2" /> Start Planning
            </Button>
          </div>
        ) : (
          trips.map(trip => <TripCard key={trip.id} trip={trip} />)
        )}
      </main>

      {trips.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-20">
          <Button size="lg" className="rounded-full shadow-xl shadow-primary/30" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-5 h-5 mr-2" /> New Trip
          </Button>
        </div>
      )}

      <AddTripSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}

function TripCard({ trip }: { trip: any }) {
  const { mutate: deleteTrip } = useDeleteTrip();
  const days = differenceInDays(new Date(trip.endDate), new Date(trip.startDate)) + 1;
  const daysUntil = differenceInDays(new Date(trip.startDate), new Date());
  
  const isPast = daysUntil < 0 && differenceInDays(new Date(trip.endDate), new Date()) < 0;

  return (
    <div className="relative group">
      <Link href={`/trip/${trip.id}/itinerary`} className="block bg-card rounded-[2rem] p-5 shadow-lg shadow-black/5 border border-border/50 hover:shadow-xl hover:border-primary/20 transition-all duration-300 active:scale-[0.98]">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h3 className="text-xl font-bold text-foreground">{trip.name}</h3>
            <div className="flex items-center text-muted-foreground mt-1 text-sm">
              <MapPin className="w-3.5 h-3.5 mr-1" />
              {trip.destination}
            </div>
          </div>
          {isPast ? (
            <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs font-semibold">Past</span>
          ) : daysUntil <= 0 ? (
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold">In Progress</span>
          ) : (
            <span className="bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-xs font-semibold">In {daysUntil} days</span>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center text-sm font-medium text-foreground/80 bg-muted/50 px-3 py-1.5 rounded-lg">
            <Calendar className="w-4 h-4 mr-2 opacity-70" />
            {format(new Date(trip.startDate), 'MMM d')} - {format(new Date(trip.endDate), 'MMM d, yyyy')}
          </div>
          <div className="text-sm font-semibold text-muted-foreground">
            {days} {days === 1 ? 'day' : 'days'}
          </div>
        </div>
      </Link>
      
      <button 
        onClick={(e) => { e.preventDefault(); if(confirm('Delete trip?')) deleteTrip(trip.id); }}
        className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function AddTripSheet({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { mutateAsync: createTrip, isPending } = useCreateTrip();
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await createTrip({
      id: generateId(),
      name: fd.get('name') as string,
      destination: fd.get('destination') as string,
      startDate: fd.get('startDate') as string,
      endDate: fd.get('endDate') as string,
      createdAt: Date.now()
    });
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Plan a new trip">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <Label htmlFor="name">Trip Name</Label>
          <Input id="name" name="name" placeholder="Summer in Europe" required />
        </div>
        <div>
          <Label htmlFor="destination">Primary Destination</Label>
          <Input id="destination" name="destination" placeholder="Paris, France" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input id="startDate" name="startDate" type="date" required />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input id="endDate" name="endDate" type="date" required />
          </div>
        </div>
        <Button type="submit" size="lg" className="mt-4" isLoading={isPending}>
          Create Trip
        </Button>
      </form>
    </BottomSheet>
  );
}
