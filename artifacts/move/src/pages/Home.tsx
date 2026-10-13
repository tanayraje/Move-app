import { notify, confirmDialog } from "@/lib/dialogs";
import React, { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { format, differenceInDays, addDays } from "date-fns";
import {
  Plus, MapPin, Calendar, Plane, Trash2, Search, ChevronDown, X,
  Archive, Heart, User, Check, MoreVertical, Users, LogOut, Pencil
} from "lucide-react";
import { useTrips, useCreateTrip, useDeleteTrip, useUpdateTrip } from "@/hooks/use-store";
import { useItinerary, useSaveItineraryItem } from "@/hooks/use-store";
import { cn, generateId, safeFormatDate, safeParseDate, getTripStatus } from "@/lib/utils";
import { Button, Input, Label, BottomSheet, FAB } from "@/components/ui";
import { DockBar, DockItem } from "@/components/Dock";
import { AddMenu } from "@/components/AddMenu";
import { ProfileMenu } from "@/components/ProfileMenu";
import { COUNTRIES, Country } from "@/lib/countries";
import { INDIAN_STATES } from "@/lib/india-states";
import type { Trip, TripStatus } from "@/lib/types";
import { useSupabaseAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import { joinTripByCode } from "@/hooks/use-store";
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getAvatarUrl } from "@/lib/avatar";

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
  const [tab, setTab] = useState<TripStatus>('active');
  
  

  
 // Automatically archive trips once their end date has passed
useEffect(() => {
  const today = new Date();

  allTrips.forEach((trip) => {
    const status = getTripStatus(trip);

    if (status !== "active" || !trip.endDate) return;

    const endDate = safeParseDate(trip.endDate);
    if (!endDate) return;

    const isPast =
      endDate.getFullYear() < today.getFullYear() ||
      (endDate.getFullYear() === today.getFullYear() &&
        endDate.getMonth() < today.getMonth()) ||
      (endDate.getFullYear() === today.getFullYear() &&
        endDate.getMonth() === today.getMonth() &&
        endDate.getDate() < today.getDate());

    if (isPast) {
      updateTrip({
        ...trip,
        status: "archived",
      });
    }
  });
}, [allTrips, updateTrip]);

  const activeTrips = allTrips.filter(t => getTripStatus(t) === 'active');
  const archivedTrips = allTrips.filter(t => getTripStatus(t) === 'archived');
  const wishlistTrips = allTrips.filter(t => getTripStatus(t) === 'wishlist');

  const tripsToShow = [...(tab === 'active' ? activeTrips : tab === 'archived' ? archivedTrips : wishlistTrips)].sort(
    (a, b) => (a.startDate || "9999-12-31").localeCompare(b.startDate || "9999-12-31")
  );
  const hasMultiple = [activeTrips.length, archivedTrips.length, wishlistTrips.length].filter(n => n > 0).length > 1;

  // One live line under the title: what is happening with the trips right now
  const headline = (() => {
    const today = new Date();
    let soonest: { name: string; days: number } | null = null;
    for (const t of activeTrips) {
      const start = safeParseDate(t.startDate);
      const end = safeParseDate(t.endDate);
      if (!start || !end) continue;
      if (differenceInDays(end, today) < 0) continue;
      const toStart = differenceInDays(start, today);
      if (toStart <= 0) return `${t.name} is in progress`;
      if (!soonest || toStart < soonest.days) soonest = { name: t.name, days: toStart };
    }
    return soonest
      ? `${soonest.name} starts in ${soonest.days} day${soonest.days === 1 ? "" : "s"}`
      : "Where to next?";
  })();

  return (
  <div className="flex flex-col min-h-[100dvh] pb-8 relative">
    
      <div className="sticky top-0 z-[100] bg-background/95">
  <header className="px-6 pt-14 pb-3">
    <div className="flex items-center justify-between">
      <h1 className="font-display text-[40px] font-bold leading-none tracking-tight">Trips</h1>
      <button
        onClick={() => setShowUserMenu(true)}
        aria-label="Account menu"
        className="h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-muted shadow-md shadow-black/10 transition-opacity hover:opacity-90"
      >
        <img src={getAvatarUrl(profile?.avatar, 128)} alt="Profile" className="h-full w-full" />
      </button>
    </div>
    <p className="mt-2.5 flex items-center gap-2 text-sm text-muted-foreground">
      <Plane className="h-4 w-4 shrink-0 text-primary" />
      <span className="truncate">{headline}</span>
    </p>
  </header>
</div>

<main className="flex flex-1 flex-col gap-4 px-4 pb-40">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-3xl bg-muted animate-pulse" />)}
          </div>
        ) : (
          <>
 
  {tripsToShow.length === 0 ? (
    <EmptyState tab={tab} />
  ) : (
    tripsToShow.map((trip) => (
      <TripCard key={trip.id} trip={trip} onConvert={setConvertTrip} onEdit={setEditingTrip} />
    ))
  )}
</>
        )}
      </main>

  {!isAddOpen && !isWishlistOpen && !isJoinOpen && (
    <HomeDock
      tab={tab}
      onTab={setTab}
      counts={{ active: activeTrips.length, wishlist: wishlistTrips.length, archived: archivedTrips.length }}
      onNewTrip={() => setIsAddOpen(true)}
      onWishlist={() => setIsWishlistOpen(true)}
      onJoin={() => setIsJoinOpen(true)}
    />
  )}
      <AddTripSheet
  isOpen={isAddOpen}
  onClose={() => setIsAddOpen(false)}
/>

<AddWishlistSheet
  isOpen={isWishlistOpen}
  onClose={() => setIsWishlistOpen(false)}
/>
      <ProfileMenu
        open={showUserMenu}
        onClose={() => setShowUserMenu(false)}
        avatar={profile?.avatar}
        name={profile?.name}
        username={profile?.username}
        onJoin={() => setIsJoinOpen(true)}
        onSignOut={logout}
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

const { data: memberRows = [] } = useQuery({
  queryKey: ["trip-members", trip.id],
  queryFn: async () => {
    const { data } = await supabase.rpc(
      "get_trip_members",
      { p_trip_id: trip.id }
    );

    return data || [];
  },
});

const memberCount = memberRows.length;
const hasMembers = memberCount > 1;

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

  // Status chip: glass tinted by state (green = ongoing, blue = upcoming, pink = wishlist, grey = archived / past)
  const tone = isWishlist
    ? { label: "Wishlist", glass: "bg-pink-400/30", dot: "bg-pink-300" }
    : status === "archived"
    ? { label: "Archived", glass: "bg-slate-400/30", dot: "bg-slate-300" }
    : isPast
    ? { label: "Past", glass: "bg-slate-400/30", dot: "bg-slate-300" }
    : isActiveNow
    ? { label: "In progress", glass: "bg-emerald-400/30", dot: "bg-emerald-300" }
    : { label: `In ${daysUntil}d`, glass: "bg-blue-400/30", dot: "bg-blue-300" };

  const heroStyle = trip.heroImage
    ? { backgroundImage: `url(${trip.heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: "linear-gradient(135deg,#2563eb 0%,#3b82f6 100%)" };
  const place = trip.state || trip.heroLocation || trip.destination;
  const dateText = isWishlist
    ? ""
    : `${safeFormatDate(trip.startDate, d => format(d, "MMM d"), "")} – ${safeFormatDate(trip.endDate, d => format(d, "MMM d"), "")}`;

  return (
    <div className="relative group">
      <Link
        href={`/trip/${trip.id}/overview`}
        className="block overflow-hidden rounded-[32px] shadow-[0_18px_40px_-14px_rgba(30,64,175,0.35)] transition-transform duration-300 active:scale-[0.99]"
      >
        {/* Tall photo; the glass panel is slim so the image stays the hero */}
        <div className="relative h-[300px]" style={heroStyle}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent" />

          <span
            className={cn(
              "glass absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              tone.glass
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
            {tone.label}
          </span>

          <div className="glass absolute inset-x-3 bottom-3 rounded-[24px] px-4 py-3 [text-shadow:0_1px_8px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="truncate font-display text-[22px] font-bold leading-tight">{trip.name}</h3>
              {days !== null && <span className="shrink-0 font-display text-xl font-bold">{days}d</span>}
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-[12.5px] text-white/90">
              <span className="flex min-w-0 items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {place}
                  {dateText ? ` · ${dateText}` : ""}
                </span>
              </span>
              {hasMembers ? (
                <span className="flex shrink-0 items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {memberCount}
                </span>
              ) : (
                <User className="h-3.5 w-3.5 shrink-0 opacity-80" />
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Actions */}
      <div className="absolute right-3.5 top-3.5 z-20 flex gap-2">
        <TripMenu trip={trip} status={status} onConvert={onConvert} onEdit={onEdit} />
        <button
          aria-label="Delete trip"
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const ok = await confirmDialog({
              title: "Delete this trip?",
              message: `${trip.name} and everything in it will be removed for you and every member.`,
              confirmLabel: "Delete",
              destructive: true,
            });
            if (ok) deleteTrip(trip.id);
          }}
          className="glass flex h-9 w-9 items-center justify-center rounded-full transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Home dock: filters (label + count) in the same glass bar as the trip screens, and a docked "+" menu */
function HomeDock({
  tab,
  onTab,
  counts,
  onNewTrip,
  onWishlist,
  onJoin,
}: {
  tab: TripStatus;
  onTab: (t: TripStatus) => void;
  counts: { active: number; wishlist: number; archived: number };
  onNewTrip: () => void;
  onWishlist: () => void;
  onJoin: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const items: DockItem[] = [
    { id: "active", label: "Active", icon: Plane, badge: counts.active, onSelect: () => onTab("active") },
    { id: "wishlist", label: "Wishlist", icon: Heart, badge: counts.wishlist, onSelect: () => onTab("wishlist") },
    { id: "archived", label: "Archived", icon: Archive, badge: counts.archived, onSelect: () => onTab("archived") },
  ];

  return (
    <>
      <AddMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { id: "new", label: "New trip", hint: "Plan dates and an itinerary", icon: Plane, tint: "bg-blue-50 text-primary", onSelect: onNewTrip },
          { id: "wishlist", label: "Save to wishlist", hint: "A destination for later", icon: Heart, tint: "bg-pink-50 text-pink-500", onSelect: onWishlist },
          { id: "join", label: "Join with a code", hint: "Use an invite from a friend", icon: Users, tint: "bg-violet-50 text-violet-600", onSelect: onJoin },
        ]}
      />
      <DockBar mode="labels" items={items} activeId={tab} />
      <FAB icon={Plus} label="Add" open={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
    </>
  );
}

function EmptyState({ tab }: { tab: TripStatus }) {
  const Icon = tab === "wishlist" ? Heart : tab === "archived" ? Archive : Plane;
  const title = tab === "active" ? "No trips yet" : tab === "wishlist" ? "No wishlist trips" : "No archived trips";
  const hint =
    tab === "active"
      ? "Tap + to plan your first trip."
      : tab === "wishlist"
      ? "Tap + to save a destination for later."
      : "Archived trips will appear here.";
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-24 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary/10 text-primary">
        <Icon className="h-9 w-9" />
      </div>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="mt-1.5 max-w-[250px] text-[15px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function TripMenu({
  trip,
  status,
  onConvert,
  onEdit,
  variant = "photo",
}: {
  trip: Trip;
  status: TripStatus;
  onConvert: (trip: Trip) => void;
  onEdit: (trip: Trip) => void;
  variant?: "photo" | "plain";
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
  className={cn(
            "flex items-center justify-center rounded-full transition-all",
            variant === "photo" ? "glass h-9 w-9" : "h-8 w-8 bg-muted text-muted-foreground hover:text-foreground"
          )}
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
     
/** Accepts "AB12", "move-ab12", a pasted "MOVE-AB12", or a full invite link. Returns the 4 character code. */
function normalizeInviteCode(raw: string) {
  const parts = raw.toUpperCase().split("MOVE-");
  const last = parts[parts.length - 1];
  return last.replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function friendlyJoinError(err: any) {
  const msg = String(err?.message ?? "").toLowerCase();
  if (msg.includes("not found") || msg.includes("invalid")) return "That code does not match any trip. Check it and try again.";
  if (msg.includes("already")) return "You are already a member of this trip.";
  if (msg.includes("jwt") || msg.includes("auth")) return "Your session expired. Sign in again and retry.";
  return err?.message ? `Could not join: ${err.message}` : "Could not join this trip. Try again.";
}

function JoinTripSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [joinedId, setJoinedId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isOpen) {
      setCode("");
      setError("");
      setBusy(false);
      setDone(false);
      setJoinedId(null);
    }
  }, [isOpen]);

  const handleJoin = async () => {
    if (code.length < 4) {
      setError("Enter the 4 character code from the invite.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result: any = await joinTripByCode(`MOVE-${code}`);
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      const id = typeof result === "string" ? result : result?.id ?? result?.trip_id ?? null;
      setJoinedId(id);
      setDone(true);
    } catch (err: any) {
      console.error("JOIN ERROR", err);
      setError(friendlyJoinError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={done ? "You are in" : "Join a Trip"}>
      {done ? (
        <div className="flex flex-col items-center gap-4 pb-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="h-8 w-8" />
          </div>
          <p className="text-sm text-muted-foreground">The trip has been added to your list.</p>
          <div className="flex w-full gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Done</Button>
            {joinedId && (
              <Button
                className="flex-1"
                onClick={() => {
                  onClose();
                  setLocation(`/trip/${joinedId}`);
                }}
              >
                Open trip
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Enter the invite code shared by the trip organizer. You can paste the whole code.</p>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold tracking-wider text-muted-foreground">
              MOVE-
            </span>
            <Input
              value={code}
              onChange={(e) => {
                setCode(normalizeInviteCode(e.target.value));
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="XXXX"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="pl-[82px] text-lg font-bold uppercase tracking-wider"
            />
          </div>
          {error && <p className="-mt-2 text-sm font-medium text-red-500">{error}</p>}
          <Button size="lg" onClick={handleJoin} isLoading={busy}>Join Trip</Button>
        </div>
      )}
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

function IndiaStateField({
  country,
  value,
  onChange,
}: {
  country: Country | null;
  value: string;
  onChange: (v: string) => void;
}) {
  if (country?.name !== "India") return null;
  return (
    <div>
      <Label>State (Optional)</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-12 w-full min-w-0 rounded-xl border-2 border-border bg-card px-4 text-base focus:border-primary focus:outline-none"
      >
        <option value="">All of India</option>
        {INDIAN_STATES.map((st) => (
          <option key={st} value={st}>
            {st}
          </option>
        ))}
      </select>
    </div>
  );
}

function AddTripSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { mutateAsync: createTrip, isPending } = useCreateTrip();
  const [country, setCountry] = useState<Country | null>(null);
  const [state, setState] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!country) { notify('Please select a destination country', 'error'); return; }
    const fd = new FormData(e.currentTarget);
    const id = generateId();
    await createTrip({
      id,
      name: fd.get('name') as string,
      destination: country.name,
      destinationCurrency: country.currency,
      state: country.name === "India" ? state || undefined : undefined,
      startDate: fd.get('startDate') as string,
      endDate: fd.get('endDate') as string,
      inviteCode: `MOVE-${id.slice(0, 4).toUpperCase()}`,
      status: 'active',
      createdAt: Date.now()
    });
    setCountry(null);
    setState("");
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
          <CountryPicker
            value={country}
            onChange={(c) => {
              setCountry(c);
              if (c.name !== "India") setState("");
            }}
          />
        </div>
        <IndiaStateField country={country} value={state} onChange={setState} />
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
  const [state, setState] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!country) { notify('Please select a destination country', 'error'); return; }
    const fd = new FormData(e.currentTarget);
    const id = generateId();
    await createTrip({
      id,
      name: fd.get('name') as string,
      destination: country.name,
      destinationCurrency: country.currency,
      state: country.name === "India" ? state || undefined : undefined,
      startDate: '',
      endDate: '',
      inviteCode: `MOVE-${id.slice(0, 4).toUpperCase()}`,
      status: 'wishlist',
      wishlistDayCount: 1,
      createdAt: Date.now()
    });
    setCountry(null);
    setState("");
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
          <CountryPicker
            value={country}
            onChange={(c) => {
              setCountry(c);
              if (c.name !== "India") setState("");
            }}
          />
        </div>
        <IndiaStateField country={country} value={state} onChange={setState} />
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
  const [state, setState] = useState("");

  useEffect(() => {
    if (!trip) return;

    const found =
      COUNTRIES.find(c => c.name === trip.destination) ?? null;

    setCountry(found);
    setState(trip.state ?? "");
  }, [trip]);

  if (!trip) return null;

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!country) {
      notify("Please select a destination country", "error");
      return;
    }

    const fd = new FormData(e.currentTarget);

    updateTrip({
      ...trip,
      name: fd.get("name") as string,
      destination: country.name,
      destinationCurrency: country.currency,
      state: country.name === "India" ? state || undefined : undefined,
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
  <Label>Destination Country</Label>

  <CountryPicker
    value={country}
    onChange={(c) => {
      setCountry(c);

      if (c.name !== "India") {
        setState("");
      }
    }}
  />
</div>

{country?.name === "India" && (
  <div>
    <Label>State (Optional)</Label>

    <select
      value={state}
      onChange={(e) => setState(e.target.value)}
      className="flex h-12 w-full rounded-xl border-2 border-border bg-card px-4 text-base focus:outline-none focus:border-primary"
    >
      <option value="">All of India</option>

      {INDIAN_STATES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  </div>
)}

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
  const { data: items = [] } = useItinerary(trip?.id ?? "");
  const { mutate: saveItem } = useSaveItineraryItem();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const handleConvert = async () => {
  if (!trip) return;

  if (!startDate || !endDate) {
    notify('Select both dates', 'error');
    return;
  }

  const startDt = safeParseDate(startDate);
const endDt = safeParseDate(endDate);

if (!startDt || !endDt) {
  notify("Invalid dates", "error");
  return;
}

const plannedDays = trip.wishlistDayCount ?? 1;
const days = differenceInDays(endDt, startDt) + 1;

if (days < 1) {
  notify("End date must be after start date", "error");
  return;
}

if (days < plannedDays) {
  const proceed = await confirmDialog({
    title: "Some days will not fit",
    message: `This itinerary has ${plannedDays} planned days but you selected ${days} travel days.\n\nDays ${days + 1} to ${plannedDays} will not fit into this trip.`,
    confirmLabel: "Continue anyway",
  });

  if (!proceed) return;
}

    updateTrip({
  ...trip,
  status: "active",
  startDate,
  endDate,
  wishlistDayCount: undefined,
});

    items.forEach((item) => {
  const dayMatch = item.date?.match(/^Day\s+(\d+)$/i);

  if (!dayMatch) return;

  const dayNum = parseInt(dayMatch[1], 10);

  const updatedItem = {
    ...item,
    date: format(addDays(startDt, dayNum - 1), "yyyy-MM-dd"),
  };

  if (
    item.elementType === "accommodation" &&
    item.endDate?.match(/^Day\s+(\d+)$/i)
  ) {
    const endDay = parseInt(
      item.endDate.match(/^Day\s+(\d+)$/i)![1],
      10
    );

    updatedItem.endDate = format(
      addDays(startDt, endDay - 1),
      "yyyy-MM-dd"
    );
  }

  saveItem(updatedItem);
});

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