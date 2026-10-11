import React, { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { format, differenceInDays, addDays } from "date-fns";
import {
  Plus, MapPin, Calendar, Plane, Trash2, Search, ChevronDown, X,
  Archive, Heart, User, MoreVertical, Users, LogOut, Pencil
} from "lucide-react";
import { useTrips, useCreateTrip, useDeleteTrip, useUpdateTrip } from "@/hooks/use-store";
import { useItinerary, useSaveItineraryItem } from "@/hooks/use-store";
import { cn, generateId, safeFormatDate, safeParseDate, getTripStatus } from "@/lib/utils";
import { Button, Input, Label, BottomSheet, FAB, HeroScrim } from "@/components/ui";
import { DockBar, dockWidth, DockItem } from "@/components/Dock";
import { AddMenu } from "@/components/AddMenu";
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

  const tripsToShow = tab === 'active' ? activeTrips : tab === 'archived' ? archivedTrips : wishlistTrips;
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
      <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowUserMenu(!showUserMenu);
            }}
            className="w-11 h-11 rounded-full overflow-hidden bg-muted border-2 border-white shadow-md shadow-black/10 hover:opacity-90 transition-opacity"
          >
            <img
            src={getAvatarUrl(profile?.avatar, 128)}
            alt="Profile"
            className="w-full h-full"
          />
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
    <p className="mt-2.5 flex items-center gap-2 text-sm text-muted-foreground">
      <Plane className="h-4 w-4 shrink-0 text-primary" />
      <span className="truncate">{headline}</span>
    </p>
  </header>
</div>

<main className="flex flex-1 flex-col gap-3 px-4 pb-40">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-3xl bg-muted animate-pulse" />)}
          </div>
        ) : (
          <>
 
  {tripsToShow.length === 0 ? (
    <EmptyState
      tab={tab}
      onNewTrip={() => setIsAddOpen(true)}
      onWishlist={() => setIsWishlistOpen(true)}
      onJoin={() => setIsJoinOpen(true)}
    />
  ) : (
    <>
      <TripCard featured trip={tripsToShow[0]} onConvert={setConvertTrip} onEdit={setEditingTrip} />
      {tripsToShow.length > 1 && (
        <p className="mb-0.5 mt-3 px-2 text-[13px] font-semibold text-muted-foreground">Also on your list</p>
      )}
      {tripsToShow.slice(1).map((trip) => (
        <TripCard key={trip.id} trip={trip} onConvert={setConvertTrip} onEdit={setEditingTrip} />
      ))}
    </>
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
  featured = false,
  onConvert,
  onEdit,
}: {
  trip: Trip;
  featured?: boolean;
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

  const badge = isWishlist
    ? { label: "Wishlist", dot: "bg-pink-500", tone: "bg-pink-50 text-pink-600" }
    : status === "archived"
    ? { label: "Archived", dot: "bg-slate-400", tone: "bg-slate-100 text-slate-500" }
    : isPast
    ? { label: "Past", dot: "bg-slate-400", tone: "bg-slate-100 text-slate-500" }
    : isActiveNow
    ? { label: "In progress", dot: "bg-blue-500", tone: "bg-blue-50 text-primary" }
    : { label: `In ${daysUntil}d`, dot: "bg-orange-500", tone: "bg-orange-50 text-orange-600" };

  const heroStyle = trip.heroImage
    ? { backgroundImage: `url(${trip.heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: "linear-gradient(135deg,#2563eb 0%,#3b82f6 100%)" };
  const place = trip.state || trip.heroLocation || trip.destination;

  const confirmDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Delete trip?")) deleteTrip(trip.id);
  };

  // ---- Featured: photo first, info on a clean white strip (no glass on the content)
  if (featured) {
    return (
      <div className="relative">
        <Link
          href={`/trip/${trip.id}/overview`}
          className="block overflow-hidden rounded-[32px] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.05),0_22px_40px_-14px_rgba(30,64,175,0.32)] transition-transform active:scale-[0.99]"
        >
          <div className="relative h-[240px]" style={heroStyle}>
            <HeroScrim />
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-md">
              <span className={cn("h-1.5 w-1.5 rounded-full", badge.dot)} />
              {badge.label}
            </span>
            <div className="absolute inset-x-5 bottom-4 text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.5)]">
              <h3 className="font-display text-[30px] font-bold leading-[1.05] tracking-tight">{trip.name}</h3>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px]">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{place}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between px-[18px] py-3.5">
            <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-muted-foreground">
              {isWishlist ? (
                <>
                  <Heart className="h-4 w-4 shrink-0" />
                  Saved for later
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {safeFormatDate(trip.startDate, d => format(d, "MMM d"), "")} –{" "}
                    {safeFormatDate(trip.endDate, d => format(d, "MMM d, yyyy"), "")}
                  </span>
                  {days !== null && <b className="shrink-0 font-semibold text-foreground">{days} days</b>}
                </>
              )}
            </span>
            {hasMembers ? (
              <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                {memberCount}
              </span>
            ) : (
              <User className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            )}
          </div>
        </Link>
        {/* Actions: glass over the photo */}
        <div className="absolute right-3.5 top-3.5 z-20 flex gap-2">
          <TripMenu trip={trip} status={status} onConvert={onConvert} onEdit={onEdit} variant="photo" />
          <button
            aria-label="Delete trip"
            onClick={confirmDelete}
            className="glass flex h-9 w-9 items-center justify-center rounded-full"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ---- Compact row: thumbnail, name, place and dates, status
  return (
    <div className="relative">
      <Link
        href={`/trip/${trip.id}/overview`}
        className="flex items-center gap-3.5 rounded-[26px] bg-card p-2.5 pr-14 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] transition-transform active:scale-[0.99]"
      >
        <div className="h-[76px] w-[76px] shrink-0 rounded-[20px]" style={heroStyle} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold">{trip.name}</h3>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            {place}
            {!isWishlist && (
              <>
                {", "}
                {safeFormatDate(trip.startDate, d => format(d, "MMM d"), "")} –{" "}
                {safeFormatDate(trip.endDate, d => format(d, "MMM d"), "")}
              </>
            )}
          </p>
          <span className={cn("mt-1.5 inline-block rounded-[10px] px-2.5 py-0.5 text-[11px] font-semibold", badge.tone)}>
            {badge.label}
          </span>
        </div>
      </Link>
      <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1.5">
        <TripMenu trip={trip} status={status} onConvert={onConvert} onEdit={onEdit} variant="plain" />
        <button
          aria-label="Delete trip"
          onClick={confirmDelete}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Home dock: the same compact glass pill as the trip screens (filters) + a docked "+" menu */
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
  const CELL = 72;
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
      <DockBar items={items} activeId={tab} cell={CELL} shifted />
      <FAB
        icon={Plus}
        label="Add"
        open={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        barWidth={dockWidth(items.length, CELL)}
      />
    </>
  );
}

/** Empty states: friendly, with the next step one tap away */
function EmptyState({
  tab,
  onNewTrip,
  onWishlist,
  onJoin,
}: {
  tab: TripStatus;
  onNewTrip: () => void;
  onWishlist: () => void;
  onJoin: () => void;
}) {
  const primary =
    "flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[#4F86F7] to-primary text-base font-semibold text-primary-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_16px_28px_-8px_rgba(37,99,235,0.55)] active:scale-[0.98] transition-transform";

  if (tab === "active") {
    return (
      <div className="flex flex-1 flex-col items-center px-4 pt-6 text-center">
        <svg
          width="300"
          height="236"
          viewBox="0 0 300 236"
          aria-hidden="true"
          style={{ filter: "drop-shadow(0 22px 26px rgba(37,99,235,0.22))" }}
        >
          <defs>
            <linearGradient id="empty-card" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4F86F7" />
              <stop offset="1" stopColor="#2563EB" />
            </linearGradient>
          </defs>
          <g transform="rotate(-9 110 120)">
            <rect x="34" y="36" width="150" height="176" rx="28" fill="#DCE8FE" />
          </g>
          <g transform="rotate(8 190 120)">
            <rect x="112" y="26" width="150" height="176" rx="28" fill="#BFD4FB" />
            <circle cx="222" cy="76" r="14" fill="#FFF3D6" />
            <path d="M112 176l40-46 30 30 25-20 55 56v8H112z" fill="#6D93D9" opacity="0.85" />
          </g>
          <rect x="72" y="44" width="156" height="184" rx="30" fill="url(#empty-card)" />
          <path d="M104 190c26-34 62-34 92-96" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" strokeDasharray="3 7" strokeLinecap="round" />
          <g transform="translate(150 118) scale(3.1) translate(-12 -12)" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
          </g>
          <circle cx="104" cy="190" r="6" fill="#fff" />
        </svg>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">Where to next?</h2>
        <p className="mt-2.5 max-w-[290px] text-[15px] leading-relaxed text-muted-foreground">
          Plan a trip, save a dream destination, or join friends with an invite code.
        </p>
        <div className="mt-7 w-full space-y-3">
          <button onClick={onNewTrip} className={primary}>
            <Plus className="h-5 w-5" />
            Plan a trip
          </button>
          <button
            onClick={onJoin}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-card text-[15px] font-semibold shadow-[inset_0_0_0_1px_hsl(var(--border))] active:scale-[0.98] transition-transform"
          >
            <Users className="h-[18px] w-[18px]" />
            Join with a code
          </button>
        </div>
      </div>
    );
  }

  const isWishlist = tab === "wishlist";
  return (
    <div className="flex flex-1 flex-col items-center px-4 pt-20 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-[32px] bg-primary/10 text-primary">
        {isWishlist ? <Heart className="h-10 w-10" /> : <Archive className="h-10 w-10" />}
      </div>
      <h2 className="mt-6 font-display text-2xl font-bold tracking-tight">
        {isWishlist ? "Nothing saved yet" : "No archived trips"}
      </h2>
      <p className="mt-2 max-w-[260px] text-[15px] leading-relaxed text-muted-foreground">
        {isWishlist
          ? "Keep the destinations you dream about here until you are ready to plan them."
          : "Trips you archive after you travel will live here."}
      </p>
      {isWishlist && (
        <button onClick={onWishlist} className={cn(primary, "mt-7 max-w-[260px]")}>
          <Heart className="h-5 w-5" />
          Save a destination
        </button>
      )}
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
  const [state, setState] = useState("");

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
  const [state, setState] = useState("");

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
      wishlistDayCount: 1,
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
      alert("Please select a destination country");
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
  const handleConvert = () => {
  if (!trip) return;

  if (!startDate || !endDate) {
    alert('Select both dates');
    return;
  }

  const startDt = safeParseDate(startDate);
const endDt = safeParseDate(endDate);

if (!startDt || !endDt) {
  alert("Invalid dates");
  return;
}

const plannedDays = trip.wishlistDayCount ?? 1;
const days = differenceInDays(endDt, startDt) + 1;

if (days < 1) {
  alert("End date must be after start date");
  return;
}

if (days < plannedDays) {
  const proceed = confirm(
    `This itinerary contains ${plannedDays} planned days but you selected only ${days} travel days.\n\nDays ${days + 1}-${plannedDays} won't fit into this trip.\n\nContinue anyway?`
  );

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