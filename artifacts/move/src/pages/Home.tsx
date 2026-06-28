import React, { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { format, differenceInDays, addMonths, addDays } from "date-fns";
import {
  Plus, MapPin, Calendar, Plane, Trash2, Search, ChevronDown, X,
  Archive, Heart, User, MoreVertical, Users, LogOut, Pencil
} from "lucide-react";
import { useTrips, useCreateTrip, useDeleteTrip, useUpdateTrip } from "@/hooks/use-store";
import { useSaveItineraryItem } from "@/hooks/use-store";
import { generateId, safeFormatDate, safeParseDate, getTripStatus } from "@/lib/utils";
import { Button, Input, Label, BottomSheet } from "@/components/ui";
import { COUNTRIES, Country } from "@/lib/countries";
import type { Trip, TripStatus } from "@/lib/types";
import { useSupabaseAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import { joinTripByCode } from "@/hooks/use-store";
import { useQueryClient } from '@tanstack/react-query';


export default function Home() {
  const { data: allTrips = [], isLoading } = useTrips();
  const { mutate: updateTrip } = useUpdateTrip();
  const {
  user,
  signOut: logout,
} = useSupabaseAuth();

const { data: profile } = useProfile(user?.id);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [convertTrip, setConvertTrip] = useState<Trip | null>(null);
const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  useEffect(() => {
  if (!showUserMenu) return;

  const handleClickOutside = () => {
    setShowUserMenu(false);
  };

  window.addEventListener("click", handleClickOutside);

  return () => {
    window.removeEventListener("click", handleClickOutside);
  };
}, [showUserMenu]);
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
    
      <header className="px-6 pt-12 pb-8 sticky top-0 bg-background/90 backdrop-blur-xl z-[100]">
        <div className="flex items-start justify-between gap-8">
          <div>
            <h1 className="text-4xl font-display font-extrabold text-foreground tracking-tight">Move.</h1>
            <p className="text-muted-foreground mt-1 text-lg">Where to next?</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsJoinOpen(true)}
              className="p-2.5 bg-muted rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
              title="Join a trip by code"
            >
              <Users className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
  onClick={(e) => {
    e.stopPropagation();
    setShowUserMenu(!showUserMenu);
  }}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold hover:opacity-90 transition-opacity"
              >
                {profile?.username?.[0]?.toUpperCase() || '?'}
              </button>
              {showUserMenu && (
  <div
  className="absolute right-0 top-12 bg-card border border-border rounded-2xl shadow-2xl p-2 min-w-[220px] z-[9999]"
  onClick={(e) => e.stopPropagation()}
>

    <div className="px-3 py-1 border-b border-border mb-1">
  <p className="text-sm font-semibold text-foreground">
    {profile?.username || "User"}
  </p>

  {profile?.name && (
    <p className="text-xs text-muted-foreground mt-1">
      {profile.name}
    </p>
  )}
</div>

    <Link href="/profile">
      <button
        onClick={() => setShowUserMenu(false)}
        className="w-full text-left px-3 py-1.5 text-sm font-medium hover:bg-muted rounded-xl"
      >
        Profile
      </button>
    </Link>

    <button
      onClick={() => {
        setShowUserMenu(false);
        logout();
      }}
      className="w-full text-left px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl flex items-center gap-2"
    >
      <LogOut className="w-4 h-4" />
      Log out
    </button>

  </div>
)}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 pb-28 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-3xl bg-muted animate-pulse" />)}
          </div>
        ) : (
          <>
  {/* Always show Active, Wishlist and Archived tabs even when count is 0 */}
  <div className="flex bg-muted p-1.5 rounded-xl mb-3">
    <button
      onClick={() => setTab("active")}
      className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg transition-all ${
        tab === "active"
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground"
      }`}
    >
      Active ({activeTrips.length})
    </button>

    <button
      onClick={() => setTab("wishlist")}
      className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg transition-all ${
        tab === "wishlist"
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground"
      }`}
    >
      Wishlist ({wishlistTrips.length})
    </button>

    <button
      onClick={() => setTab("archived")}
      className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg transition-all ${
        tab === "archived"
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground"
      }`}
    >
      Archived ({archivedTrips.length})
    </button>
  </div>

  {tripsToShow.length === 0 ? (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      {tab === "active" && (
        <Plane className="w-12 h-12 mx-auto mb-4 opacity-30" />
      )}

      {tab === "wishlist" && (
        <Heart className="w-12 h-12 mx-auto mb-4 opacity-30" />
      )}

      {tab === "archived" && (
        <Archive className="w-12 h-12 mx-auto mb-4 opacity-30" />
      )}

      <h2 className="text-xl font-semibold mb-2">
        {tab === "active"
          ? "No trips yet"
          : tab === "wishlist"
          ? "No wishlist trips"
          : "No archived trips"}
      </h2>

      <p className="text-muted-foreground">
        {tab === "active"
          ? "Create your first trip."
          : tab === "wishlist"
          ? "Save destinations for later."
          : "Archived trips will appear here."}
      </p>
    </div>
  </div>
) : (
    tripsToShow.map((trip) => (
      <TripCard
  key={trip.id}
  trip={trip}
  onConvert={setConvertTrip}
  onEdit={setEditingTrip}
/>
    ))
  )}
</>
        )}
      </main>

  {!isAddOpen &&
 !isWishlistOpen &&
 !isJoinOpen && (
  <div className="fixed bottom-6 left-0 right-0 flex justify-center z-20 max-w-md mx-auto gap-3">
    <Button
      size="lg"
      className="rounded-full px-7"
      onClick={() => setIsAddOpen(true)}
    >
      <Plus className="w-5 h-5 mr-2" />
      New Trip
    </Button>

    <Button
      size="lg"
      variant="outline"
      className="rounded-full px-7"
      onClick={() => setIsWishlistOpen(true)}
    >
      <Heart className="w-5 h-5 mr-2" />
      Wishlist
    </Button>
  </div>
)}
      <AddTripSheet
  isOpen={isAddOpen}
  onClose={() => setIsAddOpen(false)}
/>

<AddWishlistSheet
  isOpen={isWishlistOpen}
  onClose={() => setIsWishlistOpen(false)}
/>
      <JoinTripSheet isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />
        <EditTripSheet
  trip={editingTrip}
  isOpen={!!editingTrip}
  onClose={() => setEditingTrip(null)}
/>

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
  onEdit,
}: {
  trip: Trip;
  onConvert: (trip: Trip) => void;
  onEdit: (trip: Trip) => void;
}) {
  const { mutate: deleteTrip } = useDeleteTrip();
  const { mutate: updateTrip } = useUpdateTrip();
  const status = getTripStatus(trip);
  const isWishlist = status === "wishlist";
  const hasMembers = (trip.guests?.length ?? 0) > 1;

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
  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-pink-500/20 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-black/10">
    <span className="w-1.5 h-1.5 rounded-full bg-pink-300" />
    Wishlist
  </span>
) : status === "archived" ? (
  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 backdrop-blur-md px-2.5 py-1 gap-1.5 text-[11px] font-semibold text-white shadow-lg shadow-black/10">
    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
    Archived
  </span>
) : isPast ? (
  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 backdrop-blur-md px-2.5 py-1 gap-1.5 text-[11px] font-semibold text-white shadow-lg shadow-black/10">
    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
    Past
  </span>
) : isActiveNow ? (
  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-blue-500/20 backdrop-blur-md px-2.5 py-1 gap-1.5 text-[11px] font-semibold text-white shadow-lg shadow-black/10">
    <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />
    In Progress
  </span>
) : (
  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-orange-500/20 backdrop-blur-md px-2.5 py-1 gap-1.5 text-[11px] font-semibold text-white shadow-lg shadow-black/10">
    <span className="w-1.5 h-1.5 rounded-full bg-orange-300" />
    In {daysUntil}d
  </span>
);

  return (
    <div className="relative group">
      <Link
  href={`/trip/${trip.id}/overview`}
  className="block overflow-hidden rounded-[2rem] bg-card shadow-lg shadow-black/5 border border-border/50 hover:shadow-xl hover:border-primary/20 transition-all duration-300 active:scale-[0.98]"
>
  {/* Hero image */}
  <div
    className="relative h-24"
    style={
      trip.heroImage
        ? {
            backgroundImage: `url(${trip.heroImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }
        : {
            background:
              "linear-gradient(135deg,#2563eb 0%,#3b82f6 100%)",
          }
    }
  >
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
    <div className="absolute top-4 left-4">
  {statusBadge}
</div>

    <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-16">
      <h3 className="text-2xl font-bold text-white leading-tight">
        {trip.name}
      </h3>

      <div className="flex items-center text-white/90 text-sm mt-1">
        <MapPin className="w-3.5 h-3.5 mr-1 shrink-0" />
        <span className="truncate">
          {trip.heroLocation || trip.destination}
        </span>
      </div>
    </div>
  </div>

  {/* Content */}
  <div className="px-5 py-2 bg-card">
    
    <div className="flex items-center justify-between">
      {isWishlist ? (
        <div className="flex items-center text-sm font-medium text-foreground/80 bg-muted/50 px-3 py-1 rounded-xl">
          <Heart className="w-4 h-4 mr-2 text-pink-500" />
          Saved for later
        </div>
      ) : (
        <div className="flex items-center text-sm font-medium text-foreground/80 bg-muted/50 px-3 py-1 rounded-xl">
          <Calendar className="w-4 h-4 mr-2 opacity-70" />
          {safeFormatDate(trip.startDate, d => format(d, "MMM d"), "")} –{" "}
          {safeFormatDate(trip.endDate, d => format(d, "MMM d, yyyy"), "")}
        </div>
      )}

      {days !== null && (
  <div className="flex items-center">
  {hasMembers ? (
    <Users className="w-4 h-4 text-primary" />
  ) : (
    <User className="w-4 h-4 text-muted-foreground" />
  )}

  <div className="mx-3 h-5 w-px bg-border/70" />

  <span className="text-primary text-xl font-bold leading-none">
    {days}d
  </span>
</div>
)}
    </div>
  </div>
  </Link>

      {/* Actions */}
      <div className="absolute top-3 right-3 z-20 flex gap-1.5">
        <TripMenu
  trip={trip}
  status={status}
  onConvert={onConvert}
  onEdit={onEdit}
/>
        <button
          onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();

  if (confirm("Delete trip?")) {
    deleteTrip(trip.id);
  }
}}
          className="w-9 h-9 rounded-full border border-white/20 bg-white/15 backdrop-blur-xl flex items-center justify-center text-white shadow-lg shadow-black/10 hover:bg-white/25 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function TripMenu({
  trip,
  status,
  onConvert,
  onEdit,
}: {
  trip: Trip;
  status: TripStatus;
  onConvert: (trip: Trip) => void;
  onEdit: (trip: Trip) => void;
}) {
  const { mutate: updateTrip } = useUpdateTrip();
  const { mutate: saveItem } = useSaveItineraryItem();
  const [isOpen, setIsOpen] = useState(false);
const [menuPosition, setMenuPosition] = useState({
  top: 0,
  left: 0,
});


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
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();

    setMenuPosition({
      top: rect.bottom + 8,
      left: Math.min(
        rect.right - 160,
        window.innerWidth - 176
      ),
    });

    setIsOpen(true);
  }}
  className="w-9 h-9 rounded-full border border-white/20 bg-white/15 backdrop-blur-xl flex items-center justify-center text-white shadow-lg shadow-black/10 hover:bg-white/25 transition-all"
>
  <MoreVertical className="w-4 h-4" />
</button>

      {isOpen && (
  <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)}>
    <div
  className="fixed bg-card border border-border rounded-2xl shadow-2xl p-2 min-w-[160px] z-[9999]"
  style={{
    top: menuPosition.top,
    left: menuPosition.left,
  }}
  onClick={e => e.stopPropagation()}
>
<button
  onClick={() => {
    setIsOpen(false);
    onEdit(trip);
  }}
  className="w-full text-left px-3 py-1.5 text-sm font-medium hover:bg-muted rounded-xl flex items-center gap-2"
>
  <Pencil className="w-4 h-4" />
  Edit Trip
</button>
     {/* Convert wishlist to active trip */}
{status === 'wishlist' && (
  <button
    onClick={() => {
  setIsOpen(false);
  onConvert(trip);
}}
    className="w-full text-left px-3 py-1.5 text-sm font-medium hover:bg-muted rounded-xl flex items-center gap-2"
  >
    <Users className="w-4 h-4" />
    Convert to Trip
  </button>
)}

      {/* Move active trip to wishlist */}
      {status !== 'wishlist' && status !== 'archived' && (
        <button
          onClick={handleWishlist}
          className="w-full text-left px-3 py-1.5 text-sm font-medium hover:bg-muted rounded-xl flex items-center gap-2"
        >
          <Heart className="w-4 h-4" />
          Move to Wishlist
        </button>
      )}

      {/* Archive / Unarchive trip */}
      <button
        onClick={handleArchive}
        className="w-full text-left px-3 py-1.5 text-sm font-medium hover:bg-muted rounded-xl flex items-center gap-2"
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
const FULL_PREFIX = 'MOVE-';
  const queryClient = useQueryClient();
  
  const handleJoin = async () => {
  try {
    const trimmed = `${FULL_PREFIX}${code.trim().toUpperCase()}`;

    if (!trimmed) {
      alert("Enter an invite code");
      return;
    }

    await joinTripByCode(trimmed);
    queryClient.invalidateQueries({ queryKey: ['trips'] });

    alert("Trip joined successfully!");

    onClose();
    setCode('');
  } catch (err: any) {
  console.error("JOIN ERROR", err);
  alert(err?.message ?? "Unable to join trip.");
}
};

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Join a Trip">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Enter the invite code shared by the trip organizer.</p>
        <div className="relative">
  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold tracking-wider text-muted-foreground pointer-events-none">
    MOVE-
  </span>

  <Input
    value={code}
    onChange={e =>
      setCode(
        e.target.value
          .replace(/MOVE-/gi, '')
          .toUpperCase()
      )
    }
    placeholder="XXXX"
    maxLength={4}
    className="pl-[82px] text-lg font-bold tracking-wider uppercase"
  />
</div>
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

function EditTripSheet({
  trip,
  isOpen,
  onClose,
}: {
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { mutate: updateTrip, isPending } = useUpdateTrip();

  const [country, setCountry] = useState<Country | null>(null);

  useEffect(() => {
    if (!trip) return;

    const found =
      COUNTRIES.find(c => c.name === trip.destination) ?? null;

    setCountry(found);
  }, [trip]);

  if (!trip) return null;

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!country) {
      alert("Please select a destination country");
      return;
    }

    const fd = new FormData(e.currentTarget);

    updateTrip({
      ...trip,
      name: fd.get("name") as string,
      destination: country.name,
      destinationCurrency: country.currency,
      startDate:
        trip.status === "wishlist"
          ? ""
          : (fd.get("startDate") as string),
      endDate:
        trip.status === "wishlist"
          ? ""
          : (fd.get("endDate") as string),
    });

    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Trip"
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <div>
          <Label htmlFor="edit-name">
            Trip Name
          </Label>

          <Input
            id="edit-name"
            name="name"
            defaultValue={trip.name}
            required
          />
        </div>

        <div>
          <Label>
            Destination Country
          </Label>

          <CountryPicker
            value={country}
            onChange={setCountry}
          />
        </div>

        {trip.status !== "wishlist" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-start">
                Start Date
              </Label>

              <Input
                id="edit-start"
                name="startDate"
                type="date"
                defaultValue={trip.startDate}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-end">
                End Date
              </Label>

              <Input
                id="edit-end"
                name="endDate"
                type="date"
                defaultValue={trip.endDate}
                required
              />
            </div>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="mt-4"
          isLoading={isPending}
        >
          Save Changes
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