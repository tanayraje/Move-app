import React, { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { format, differenceInDays, addMonths, addDays } from "date-fns";
import {
  Plus, MapPin, Calendar, Plane, Trash2, Search, ChevronDown, X,
  Archive, Heart, Clock, MoreVertical, Users, LogOut
} from "lucide-react";
import { useTrips, useCreateTrip, useDeleteTrip, useUpdateTrip } from "@/hooks/use-store";
import { useSaveItineraryItem } from "@/hooks/use-store";
import { generateId, safeFormatDate, safeParseDate, getTripStatus } from "@/lib/utils";
import { Button, Input, Label, BottomSheet } from "@/components/ui";
import { COUNTRIES, Country } from "@/lib/countries";
import type { Trip, TripStatus } from "@/lib/types";
import { useSupabaseAuth } from "@/contexts/AuthContext";


export default function Home() {
  const { data: allTrips = [], isLoading } = useTrips();
  const { mutate: updateTrip } = useUpdateTrip();
  const {
  user,
  signOut: logout,
} = useSupabaseAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [convertTrip, setConvertTrip] = useState<Trip | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [tab, setTab] = useState<TripStatus>('active');
  

  
  // Auto-archive trips older than 6 months
  useEffect(() => {
    const sixMonthsAgo = addMonths(new Date(), -6);
    allTrips.forEach(trip => {
      const status = getTripStatus(trip);
      if (status !== 'active' || !trip.endDate) return;
      const d = safeParseDate(trip.endDate);
      if (d && d < sixMonthsAgo) {
        updateTrip({ ...trip, status: 'archived' });
      }
    });
  }, [allTrips]);

  const activeTrips = allTrips.filter(t => getTripStatus(t) === 'active');
  const archivedTrips = allTrips.filter(t => getTripStatus(t) === 'archived');
  const wishlistTrips = allTrips.filter(t => getTripStatus(t) === 'wishlist');

  const tripsToShow = tab === 'active' ? activeTrips : tab === 'archived' ? archivedTrips : wishlistTrips;
  const hasMultiple = [activeTrips.length, archivedTrips.length, wishlistTrips.length].filter(n => n > 0).length > 1;

  return (
  <div className="flex flex-col min-h-[100dvh] pb-8 relative">

    <button
      onClick={signInWithGoogle}
      className="fixed top-4 right-4 z-[9999] bg-black text-white px-4 py-2 rounded"
    >
      Test Google Login
    </button>

      <header className="px-6 pt-12 pb-6 sticky top-0 bg-background/80 backdrop-blur-xl z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-display font-extrabold text-foreground tracking-tight">Move.</h1>
            <p className="text-muted-foreground mt-1 text-lg">Where to next?</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsJoinOpen(true)}
              className="p-2.5 bg-muted rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
              title="Join a trip by code"
            >
              <Users className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold hover:opacity-90 transition-opacity"
              >
                {user?.firstName?.[0] || user?.email?.[0] || '?'}
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-12 bg-card border border-border rounded-2xl shadow-2xl p-2 min-w-[160px] z-50">
                  <div className="px-3 py-2 text-sm font-medium text-foreground border-b border-border mb-1">
                    {user?.firstName || user?.email || 'User'}
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); logout(); }}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-3xl bg-muted animate-pulse" />)}
          </div>
        ) : allTrips.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 mt-16">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Plane className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">No trips planned</h2>
            <p className="text-muted-foreground text-balance">Create your first itinerary or save a trip to your wishlist.</p>
            <div className="flex gap-3 mt-8">
              <Button size="lg" onClick={() => setIsAddOpen(true)}>
                <Plus className="w-5 h-5 mr-2" /> New Trip
              </Button>
              <Button variant="outline" size="lg" onClick={() => setIsWishlistOpen(true)}>
                <Heart className="w-5 h-5 mr-2" /> Wishlist
              </Button>
            </div>
          </div>
        ) : (
          <>
{/* Always show Active, Wishlist and Archived tabs even when count is 0 */}
<div className="flex bg-muted p-1 rounded-xl mb-2">
  <button
    onClick={() => setTab('active')}
    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
      tab === 'active'
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground'
    }`}
  >
    Active ({activeTrips.length})
  </button>

  <button
    onClick={() => setTab('wishlist')}
    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
      tab === 'wishlist'
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground'
    }`}
  >
    <Heart className="w-3.5 h-3.5" />
    Wishlist ({wishlistTrips.length})
  </button>

  <button
    onClick={() => setTab('archived')}
    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
      tab === 'archived'
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground'
    }`}
  >
    <Archive className="w-3.5 h-3.5" />
    Archived ({archivedTrips.length})
  </button>
</div>
{/* Trip list */}
{tripsToShow.length === 0 ? (
  <div className="text-center text-muted-foreground mt-16">
    {tab === 'active' ? (
      <Plane className="w-10 h-10 mx-auto mb-3 opacity-30" />
    ) : tab === 'wishlist' ? (
      <Heart className="w-10 h-10 mx-auto mb-3 opacity-30" />
    ) : (
      <Archive className="w-10 h-10 mx-auto mb-3 opacity-30" />
    )}
    <p className="font-medium">No {tab} trips.</p>
  </div>
) : (
  tripsToShow.map(trip => (
  <TripCard
    key={trip.id}
    trip={trip}
    onConvert={setConvertTrip}
  />
))
)}
          </>
        )}
      </main>

      {allTrips.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-20 max-w-md mx-auto gap-3">
          <Button size="lg" className="rounded-full shadow-xl shadow-primary/30 px-6" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-5 h-5 mr-2" /> New Trip
          </Button>
          <Button variant="outline" size="lg" className="rounded-full px-5" onClick={() => setIsWishlistOpen(true)}>
            <Heart className="w-5 h-5 mr-2" /> Wishlist
          </Button>
        </div>
      )}

      <AddTripSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      <AddWishlistSheet isOpen={isWishlistOpen} onClose={() => setIsWishlistOpen(false)} />
      <JoinTripSheet isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />
        <ConvertTripSheet
  trip={convertTrip}
  isOpen={!!convertTrip}
  onClose={() => setConvertTrip(null)}
/>
    </div>
  );
}

function TripCard({
  trip,
  onConvert,
}: {
  trip: Trip;
  onConvert: (trip: Trip) => void;
}) {
  const { mutate: deleteTrip } = useDeleteTrip();
  const { mutate: updateTrip } = useUpdateTrip();
  const status = getTripStatus(trip);
  const isWishlist = status === 'wishlist';

  const startD = isWishlist ? null : safeParseDate(trip.startDate);
  const endD = isWishlist ? null : safeParseDate(trip.endDate);
  let days: number | null = null;
  let daysUntil: number | null = null;
  let isPast = false;
  let isActiveNow = false;
  if (startD && endD) {
    try { days = differenceInDays(endD, startD) + 1; } catch {}
  }
  if (startD) {
    try { daysUntil = differenceInDays(startD, new Date()); } catch {}
  }
  if (!isWishlist && endD) {
    try { isPast = differenceInDays(endD, new Date()) < 0; } catch {}
  }
  if (!isWishlist && !isPast && startD) {
    try { isActiveNow = differenceInDays(startD, new Date()) <= 0; } catch {}
  }

  const statusBadge = isWishlist ? (
    <span className="inline-flex bg-pink-50 text-pink-500 px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit">Wishlist</span>
  ) : status === 'archived' ? (
    <span className="inline-flex bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit">Archived</span>
  ) : isPast ? (
    <span className="inline-flex bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit">Past</span>
  ) : isActiveNow ? (
    <span className="inline-flex bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit">In Progress</span>
  ) : (
    <span className="inline-flex bg-orange-500/10 text-orange-600 px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit">In {daysUntil}d</span>
  );

  return (
    <div className="relative group">
      <Link href={`/trip/${trip.id}/overview`} className="block bg-card rounded-[2rem] p-5 shadow-lg shadow-black/5 border border-border/50 hover:shadow-xl hover:border-primary/20 transition-all duration-300 active:scale-[0.98]">
        <div className="pr-14">
          <h3 className="text-xl font-bold text-foreground">{trip.name}</h3>
          <div className="flex items-center text-muted-foreground mt-0.5 text-sm">
            <MapPin className="w-3.5 h-3.5 mr-1 shrink-0" />
            <span className="truncate">{trip.destination}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {statusBadge}
            {trip.members && trip.members.length > 1 && (
              <span className="inline-flex bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit">
                {trip.members.length} members
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-5">
          {isWishlist ? (
            <div className="flex items-center text-sm font-medium text-foreground/80 bg-muted/50 px-3 py-1.5 rounded-lg">
              <Heart className="w-4 h-4 mr-2 opacity-70 text-pink-500" />
              Saved for later
            </div>
          ) : (
            <div className="flex items-center text-sm font-medium text-foreground/80 bg-muted/50 px-3 py-1.5 rounded-lg">
              <Calendar className="w-4 h-4 mr-2 opacity-70" />
              {safeFormatDate(trip.startDate, d => format(d, 'MMM d'), '')} – {safeFormatDate(trip.endDate, d => format(d, 'MMM d, yyyy'), '')}
            </div>
          )}
          {days !== null && <div className="text-sm font-semibold text-muted-foreground">{days}d</div>}
        </div>
      </Link>

      {/* Actions */}
      <div className="absolute top-4 right-4 flex gap-1 z-10">
        <TripMenu
  trip={trip}
  status={status}
  onConvert={onConvert}
/>
        <button
          onClick={(e) => { e.preventDefault(); if (confirm('Delete trip?')) deleteTrip(trip.id); }}
          className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function TripMenu({
  trip,
  status,
  onConvert,
}: {
  trip: Trip;
  status: TripStatus;
  onConvert: (trip: Trip) => void;
}) {
  const { mutate: updateTrip } = useUpdateTrip();
  const { mutate: saveItem } = useSaveItineraryItem();
  const [isOpen, setIsOpen] = useState(false);


  const handleArchive = () => {
  if (status === 'archived') {
    if (!trip.startDate || !trip.endDate) {
      onConvert(trip);
      setIsOpen(false);
      return;
    }

    updateTrip({
      ...trip,
      status: 'active',
    });
  } else {
    updateTrip({
      ...trip,
      status: 'archived',
    });
  }

  setIsOpen(false);
};

  /* Move trip to Wishlist */
const handleWishlist = () => {
  updateTrip({
    ...trip,
    status: 'wishlist',
    startDate: '',
    endDate: '',
  });

  setIsOpen(false);
};

   return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); setIsOpen(true); }}
        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
  <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)}>
    <div
      className="absolute right-4 top-20 bg-card border border-border rounded-2xl shadow-2xl p-2 min-w-[160px]"
      onClick={e => e.stopPropagation()}
    >

     {/* Convert wishlist to active trip */}
{status === 'wishlist' && (
  <button
    onClick={() => {
  setIsOpen(false);
  onConvert(trip);
}}
    className="w-full text-left px-3 py-2.5 text-sm font-medium hover:bg-muted rounded-xl flex items-center gap-2"
  >
    <Users className="w-4 h-4" />
    Convert to Trip
  </button>
)}

      {/* Move active trip to wishlist */}
      {status !== 'wishlist' && status !== 'archived' && (
        <button
          onClick={handleWishlist}
          className="w-full text-left px-3 py-2.5 text-sm font-medium hover:bg-muted rounded-xl flex items-center gap-2"
        >
          <Heart className="w-4 h-4" />
          Move to Wishlist
        </button>
      )}

      {/* Archive / Unarchive trip */}
      <button
        onClick={handleArchive}
        className="w-full text-left px-3 py-2.5 text-sm font-medium hover:bg-muted rounded-xl flex items-center gap-2"
      >
        <Archive className="w-4 h-4" />
        {status === 'archived' ? 'Unarchive' : 'Archive'}
      </button>

    </div>
  </div>
)}
    </>
  );
}
     
function JoinTripSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [code, setCode] = useState('');
  const { data: trips = [] } = useTrips();
  const { mutate: updateTrip } = useUpdateTrip();

  const handleJoin = () => {
    const trimmed = code.trim().toUpperCase();
    const trip = trips.find(t => t.inviteCode === trimmed);
    if (!trip) { alert('Trip not found. Check the invite code.'); return; }
    const members = trip.members || [];
    const hasSelf = members.some(m => m.id === 'self');
    if (hasSelf) { alert('You are already a member of this trip.'); return; }
    updateTrip({
      ...trip,
      members: [...members, { id: 'self', name: 'Me', color: '#2563eb' }]
    });
    onClose();
    setCode('');
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Join a Trip">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Enter the invite code shared by the trip organizer.</p>
        <Input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="MOVE-XXXX"
          className="text-lg font-bold tracking-wider uppercase"
        />
        <Button size="lg" onClick={handleJoin}>Join Trip</Button>
      </div>
    </BottomSheet>
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
      <button type="button" onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-between rounded-xl border-2 border-border bg-card px-4 py-2 text-base focus:outline-none focus:border-primary transition-all">
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
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search country..."
                className="flex-1 bg-transparent text-base outline-none text-foreground placeholder:text-muted-foreground" />
              <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 && <div className="p-4 text-center text-muted-foreground text-sm">No results</div>}
              {filtered.map(c => (
                <button key={c.code} type="button" onClick={() => handleSelect(c)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted active:bg-muted/80 text-left border-b border-border/30 last:border-0">
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
    const id = generateId();
    await createTrip({
      id,
      name: fd.get('name') as string,
      destination: country.name,
      destinationCurrency: country.currency,
      startDate: fd.get('startDate') as string,
      endDate: fd.get('endDate') as string,
      inviteCode: `MOVE-${id.slice(0, 4).toUpperCase()}`,
      members: [{ id: 'self', name: 'Me', color: '#2563eb' }],
      status: 'active',
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
          <div><Label htmlFor="startDate">Start Date</Label><Input id="startDate" name="startDate" type="date" required /></div>
          <div><Label htmlFor="endDate">End Date</Label><Input id="endDate" name="endDate" type="date" required /></div>
        </div>
        <Button type="submit" size="lg" className="mt-4" isLoading={isPending}>Create Trip</Button>
      </form>
    </BottomSheet>
  );
}

function AddWishlistSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { mutateAsync: createTrip, isPending } = useCreateTrip();
  const [country, setCountry] = useState<Country | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!country) { alert('Please select a destination country'); return; }
    const fd = new FormData(e.currentTarget);
    const id = generateId();
    await createTrip({
      id,
      name: fd.get('name') as string,
      destination: country.name,
      destinationCurrency: country.currency,
      startDate: '',
      endDate: '',
      inviteCode: `MOVE-${id.slice(0, 4).toUpperCase()}`,
      members: [{ id: 'self', name: 'Me', color: '#2563eb' }],
      status: 'wishlist',
      createdAt: Date.now()
    });
    setCountry(null);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Save to Wishlist">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <Label htmlFor="w-name">Trip Name</Label>
          <Input id="w-name" name="name" placeholder="Dream trip to Japan" required />
        </div>
        <div>
          <Label>Destination Country</Label>
          <CountryPicker value={country} onChange={setCountry} />
        </div>
        <Button type="submit" size="lg" className="mt-4" isLoading={isPending}>
          <Heart className="w-5 h-5 mr-2" /> Save to Wishlist
        </Button>
      </form>
    </BottomSheet>
  );
}

function ConvertTripSheet({
  trip,
  isOpen,
  onClose,
}: {
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { mutate: updateTrip } = useUpdateTrip();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const handleConvert = () => {
  if (!trip) return;

  if (!startDate || !endDate) {
    alert('Select both dates');
    return;
  }

      const startDt = safeParseDate(startDate);
    const endDt = safeParseDate(endDate);

    if (!startDt || !endDt) {
      alert('Invalid dates');
      return;
    }

    const days = differenceInDays(endDt, startDt) + 1;

    if (days < 1) {
      alert('End date must be after start date');
      return;
    }

    updateTrip({
      ...trip,
      status: 'active',
      startDate,
      endDate,
    });

    const items = JSON.parse(
      localStorage.getItem(`move_itinerary_${trip.id}`) || '[]'
    );

    const updatedItems = items.map((item: any) => {
      const dayMatch = item.date?.match(/^Day\s+(\d+)$/i);

      if (dayMatch) {
        const dayNum = parseInt(dayMatch[1], 10);

        const realDate = format(
          addDays(startDt, dayNum - 1),
          'yyyy-MM-dd'
        );

        return {
          ...item,
          date: realDate,
        };
      }

      return item;
    });

    localStorage.setItem(
      `move_itinerary_${trip.id}`,
      JSON.stringify(updatedItems)
    );

    setStartDate('');
    setEndDate('');

    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Convert to Trip"
    >
      <p className="text-sm text-muted-foreground mb-4">
        Set dates to convert your wishlist items.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <Label>Start Date</Label>

          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <Label>End Date</Label>

          <Input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={handleConvert}
      >
        Convert
      </Button>
    </BottomSheet>
  );
}