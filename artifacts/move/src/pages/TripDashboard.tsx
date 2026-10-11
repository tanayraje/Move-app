import React, { useState, useEffect } from "react";
import { useRoute, Link, Route, Switch } from "wouter";
import { format } from "date-fns";
import { useTrip, useUpdateTrip } from "@/hooks/use-store";
import {
  CalendarDays, FileText, Receipt, MapPin, LayoutDashboard,
  ChevronLeft, Users, Settings, ArrowRight, Heart, Copy
} from "lucide-react";
import { cn, generateId, safeFormatDate } from "@/lib/utils";
import type { Trip, TripStatus } from "@/lib/types";

import ItineraryTab from "./tabs/ItineraryTab";
import DocumentsTab from "./tabs/DocumentsTab";
import ExpensesTab from "./tabs/ExpensesTab";
import PlacesTab from "./tabs/PlacesTab";
import OverviewTab from "./tabs/OverviewTab";
import { BottomSheet, Button, Input, Label } from "@/components/ui";
import { DockBar } from "@/components/Dock";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getAvatarUrl } from "@/lib/avatar";

export default function TripDashboard({ params }: { params: { id: string, tab?: string } }) {
  const tripId = params.id;
  const { data: trip, isLoading } = useTrip(tripId);
  const [, paramsActive] = useRoute("/trip/:id/:tab");
  const activeTab = paramsActive?.tab || 'overview';

  // Tabs that open with a photo behind the header get a transparent, floating header
  const heroTab = activeTab === 'overview' || activeTab === 'itinerary';
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const onPhoto = heroTab && !scrolled;

  if (isLoading) return <div className="p-8 text-center">Loading trip...</div>;
  if (!trip) return <div className="p-8 text-center text-muted-foreground">Trip not found. <Link href="/" className="text-primary ml-2">Go back</Link></div>;

  const status = (trip.status || 'active') as TripStatus;
  const isWishlist = status === 'wishlist';
  const isArchived = status === 'archived';

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'itinerary', label: 'Timeline', icon: CalendarDays },
    { id: 'documents', label: 'Docs', icon: FileText },
    { id: 'expenses', label: 'Costs', icon: Receipt },
    { id: 'places', label: 'Places', icon: MapPin },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      {/* Floating header: transparent over photos, glass once scrolled / on plain tabs */}
      <header
        className={cn(
          "fixed left-1/2 top-0 z-40 w-full max-w-md -translate-x-1/2 px-4 pb-2.5 pt-[calc(12px+env(safe-area-inset-top))] transition-all duration-300",
          !onPhoto && "glass-light rounded-b-[26px] border-t-0"
        )}
      >
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            aria-label="Back to trips"
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all",
              onPhoto ? "glass" : "bg-black/[0.05] text-foreground"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className={cn("min-w-0 flex-1 transition-opacity duration-300", onPhoto && "pointer-events-none opacity-0")}>
            <h1 className="truncate font-display text-lg font-bold text-foreground">{trip.name}</h1>
            <p className="truncate text-xs font-medium text-muted-foreground">
              {trip.destination}
              {isWishlist ? ' · Wishlist' : ` · ${safeFormatDate(trip.startDate, d => format(d, 'MMM d'), '')} – ${safeFormatDate(trip.endDate, d => format(d, 'MMM d'), '')}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <MembersButton trip={trip} onPhoto={onPhoto} />
          </div>
        </div>
        {isArchived && (
          <p
            className={cn(
              "mt-2 text-center text-[11px] font-medium",
              onPhoto ? "glass mx-auto w-fit rounded-full px-3 py-1" : "text-muted-foreground"
            )}
          >
            This trip is archived. View-only mode.
          </p>
        )}
      </header>

      {/* Main Content Area */}
     <main
  className="relative flex-auto overflow-x-clip pb-28"
  style={{
    paddingBottom: "calc(104px + env(safe-area-inset-bottom))",
    paddingTop: heroTab ? 0 : `calc(${isArchived ? 100 : 76}px + env(safe-area-inset-top))`,
  }}
>
        <Switch>
          <Route path="/trip/:id/overview"><OverviewTab trip={trip} /></Route>
          <Route path="/trip/:id/itinerary"><ItineraryTab trip={trip} /></Route>
          <Route path="/trip/:id/documents"><DocumentsTab trip={trip} /></Route>
          <Route path="/trip/:id/expenses"><ExpensesTab trip={trip} /></Route>
          <Route path="/trip/:id/places"><PlacesTab trip={trip} /></Route>
          <Route path="/trip/:id"><OverviewTab trip={trip} /></Route>
        </Switch>
      </main>

      {/* Bottom Navigation: compact floating glass pill */}
      <DockBar
        activeId={activeTab}
        items={tabs.map(t => ({ id: t.id, label: t.label, icon: t.icon, href: `/trip/${trip.id}/${t.id}` }))}
      />
    </div>
  );
}

// Avatar colours for members
const avatarColours = [
  "#16a34a", // green
  "#ea580c", // orange
  "#7c3aed", // purple
  "#0891b2", // cyan
  "#dc2626", // red
  "#FFAA01", // yellow
  "#db2777", // pink
  "#4f46e5", // indigo
  "#0f766e", // teal
];

function getAvatarColour(userId: string) {
  let hash = 0;

  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return avatarColours[Math.abs(hash) % avatarColours.length];
}

function MembersButton({ trip, onPhoto = false }: { trip: Trip; onPhoto?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

const queryClient = useQueryClient();

React.useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setCurrentUserId(data.user?.id ?? null);
  });
}, []);
  const { data: memberRows = [] } = useQuery({
  queryKey: ['trip-members', trip.id],
  queryFn: async () => {
    
    const { data, error } = await supabase.rpc(
  'get_trip_members',
  { p_trip_id: trip.id }
);

console.log("TRIP ID", trip.id);
console.log("RPC DATA", data);

if (data?.length) {

}
console.log("RPC ERROR FULL", JSON.stringify(error, null, 2));

    return data || [];
  },
});

const memberCount = memberRows.length;
const isSolo = memberCount <= 1;


const removeMember = async (
  memberId: string,
  memberName: string
) => {
  const confirmed = window.confirm(
    `Remove ${memberName} from this trip?\n\nThey will lose access to the trip.\nExisting expenses and splits will remain unchanged.`
  );

  if (!confirmed) return;

  const { error } = await supabase.rpc(
  "remove_trip_member",
  {
    p_trip_id: trip.id,
    p_user_id: memberId,
  }
);

if (error) {
  alert(error.message);
  return;
}

await queryClient.invalidateQueries({
  queryKey: ["trip-members", trip.id],
});

alert("Member removed");
};

const leaveTrip = async () => {
  const confirmed = window.confirm(
    `Leave this trip?\n\nYou will lose access to the trip.\nYour expenses and splits will remain in the trip history.`
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("trip_members")
    .delete()
    .eq("trip_id", trip.id)
    .eq("user_id", currentUserId);

  if (error) {
    alert(error.message);
    return;
  }

  window.location.href = "/";
};

   
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full text-xs font-bold transition-colors",
          onPhoto
            ? "glass h-10 px-3.5"
            : cn("px-2.5 py-1.5", isSolo ? "bg-muted text-muted-foreground" : "bg-blue-50 text-blue-600")
        )}
      >
        <Users className="w-3.5 h-3.5" />
        {memberCount}
      </button>

      <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="Trip Members">
  <div className="flex flex-col gap-4 pr-1">
          {/* Invite Code */}
          {trip.inviteCode && (
            <div className="bg-muted/50 rounded-xl p-3 border border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Invite Code</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-lg font-bold text-foreground bg-card border border-border rounded-lg px-3 py-2 tracking-wider">
                  {trip.inviteCode}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(
  trip.inviteCode!.replace('MOVE-', '')
);
                    alert('Copied to clipboard!');
                  }}
                  className="text-xs font-bold bg-primary text-primary-foreground px-3 py-2.5 rounded-lg shrink-0"
                >
                  Copy
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
  <p className="text-xs text-muted-foreground">
    Share this code to invite others.
  </p>

  <button
    onClick={async () => {
      const inviteText = `Join my trip on Move ✈️
Let's Plan it Better!

Trip: ${trip.name}

Code: ${trip.inviteCode}

Open Move:
https://move-app-theta.vercel.app

Or join directly:
https://move-app-theta.vercel.app/join/${trip.inviteCode}`;

      if (navigator.share) {
        await navigator.share({
          title: `Join ${trip.name}`,
          text: inviteText,
        });
      } else {
        await navigator.clipboard.writeText(inviteText);
        alert('Invite copied to clipboard!');
      }
    }}
    className="text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-lg shrink-0"
  >
    Share Invite
  </button>
</div>
            </div>
          )}

          {/* Member List */}
<div className="space-y-2">
  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
    Members
  </p>

  {memberRows.map((member: any) => {
  const owner = memberRows.find(
    (m: any) => m.role === "owner"
  );

  const isOwner =
    owner?.user_id === currentUserId;

  const isCurrentUser =
    member.user_id === currentUserId;

  return (
    <div
      key={member.user_id}
      className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5"
    >
      <div className="w-8 h-8 rounded-full overflow-hidden bg-muted shrink-0">
        <img
          src={getAvatarUrl(member.avatar, 64)}
          alt=""
          className="w-full h-full"
        />
      </div>

            <div className="flex-1">
        <div className="font-medium text-sm text-foreground">
          {member.name || member.username || "Unknown User"}
        </div>

        {member.username && (
          <div className="text-xs text-muted-foreground">
            @{member.username}
          </div>
        )}

        {member.role === "owner" && (
          <div className="text-xs text-primary font-medium mt-0.5">
            Owner
          </div>
        )}
      </div>
            {isOwner &&
        member.role !== "owner" && (
          <button
            onClick={() =>
              removeMember(
                member.user_id,
                member.name || member.username
              )
            }
            className="text-red-600 text-xs font-semibold px-2"
          >
            Remove
          </button>
        )}

      {!isOwner &&
        isCurrentUser && (
          <button
            onClick={leaveTrip}
            className="text-red-600 text-xs font-semibold px-2"
          >
            Leave
          </button>
        )}
    </div>
    );
})}
</div>
         
          </div>
      </BottomSheet>
    </>
  );
}
