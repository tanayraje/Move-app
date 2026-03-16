import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { format, differenceInDays } from "date-fns";
import { Plus, MapPin, Calendar, Plane, Trash2, Search, ChevronDown, X } from "lucide-react";
import { useTrips, useCreateTrip, useDeleteTrip } from "@/hooks/use-store";
import { generateId } from "@/lib/utils";
import { Button, Input, Label, BottomSheet } from "@/components/ui";
import { COUNTRIES, Country } from "@/lib/countries";

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
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 mt-16">
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
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-20 max-w-md mx-auto">
          <Button size="lg" className="rounded-full shadow-xl shadow-primary/30 px-8" onClick={() => setIsAddOpen(true)}>
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
      <Link href={`/trip/${trip.id}/overview`} className="block bg-card rounded-[2rem] p-5 shadow-lg shadow-black/5 border border-border/50 hover:shadow-xl hover:border-primary/20 transition-all duration-300 active:scale-[0.98]">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h3 className="text-xl font-bold text-foreground">{trip.name}</h3>
            <div className="flex items-center text-muted-foreground mt-1 text-sm">
              <MapPin className="w-3.5 h-3.5 mr-1" />
              {trip.destination}
              {trip.destinationCurrency && trip.destinationCurrency !== 'INR' && (
                <span className="ml-2 bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs font-medium">{trip.destinationCurrency}</span>
              )}
            </div>
          </div>
          {isPast ? (
            <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs font-semibold">Past</span>
          ) : daysUntil <= 0 ? (
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold">In Progress</span>
          ) : (
            <span className="bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-xs font-semibold">In {daysUntil}d</span>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center text-sm font-medium text-foreground/80 bg-muted/50 px-3 py-1.5 rounded-lg">
            <Calendar className="w-4 h-4 mr-2 opacity-70" />
            {format(new Date(trip.startDate), 'MMM d')} – {format(new Date(trip.endDate), 'MMM d, yyyy')}
          </div>
          <div className="text-sm font-semibold text-muted-foreground">{days}d</div>
        </div>
      </Link>

      <button
        onClick={(e) => { e.preventDefault(); if (confirm('Delete trip?')) deleteTrip(trip.id); }}
        className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function CountryPicker({ value, onChange }: { value: Country | null; onChange: (c: Country) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() =>
    COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 30),
    [query]
  );

  const handleSelect = (c: Country) => {
    onChange(c);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-between rounded-xl border-2 border-border bg-card px-4 py-2 text-base focus:outline-none focus:border-primary transition-all"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value ? `${value.name} (${value.currency})` : 'Select destination country'}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex flex-col" onClick={() => setOpen(false)}>
          <div className="absolute inset-x-4 top-1/4 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 p-3 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search country..."
                className="flex-1 bg-transparent text-base outline-none text-foreground placeholder:text-muted-foreground"
              />
              <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="p-4 text-center text-muted-foreground text-sm">No results</div>
              )}
              {filtered.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted active:bg-muted/80 text-left border-b border-border/30 last:border-0"
                >
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{c.currency}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddTripSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { mutateAsync: createTrip, isPending } = useCreateTrip();
  const [country, setCountry] = useState<Country | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!country) { alert('Please select a destination country'); return; }
    const fd = new FormData(e.currentTarget);
    await createTrip({
      id: generateId(),
      name: fd.get('name') as string,
      destination: country.name,
      destinationCurrency: country.currency,
      startDate: fd.get('startDate') as string,
      endDate: fd.get('endDate') as string,
      createdAt: Date.now()
    });
    setCountry(null);
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
          <Label>Destination Country</Label>
          <CountryPicker value={country} onChange={setCountry} />
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
