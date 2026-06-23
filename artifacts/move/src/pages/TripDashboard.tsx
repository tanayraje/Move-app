import React, { useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export default function TripDashboard({ params }: { params: { id: string, tab?: string } }) {
  const tripId = params.id;
  const { data: trip, isLoading } = useTrip(tripId);
  const [, paramsActive] = useRoute("/trip/:id/:tab");
  const activeTab = paramsActive?.tab || 'overview';

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
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-background/90 border-b border-border/50 px-4 py-4 flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-muted text-foreground">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div className="flex-1 truncate">
          <h1 className="text-xl font-display font-bold text-foreground truncate">{trip.name}</h1>
          <p className="text-xs text-muted-foreground font-medium truncate">
            {trip.destination}
            {isWishlist ? ' · Wishlist' : ` · ${safeFormatDate(trip.startDate, d => format(d, 'MMM d'), '')} – ${safeFormatDate(trip.endDate, d => format(d, 'MMM d'), '')}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <MembersButton trip={trip} />
        
        </div>
      </header>

      {/* Archived banner */}
      {isArchived && (
        <div className="bg-muted border-y border-border px-4 py-2 text-center text-xs font-medium text-muted-foreground">
          This trip is archived. View-only mode.
        </div>
      )}

      {/* Main Content Area */}
     <main className="relative flex-1 overflow-x-hidden">
        <Switch>
          <Route path="/trip/:id/overview"><OverviewTab trip={trip} /></Route>
          <Route path="/trip/:id/itinerary"><ItineraryTab trip={trip} /></Route>
          <Route path="/trip/:id/documents"><DocumentsTab trip={trip} /></Route>
          <Route path="/trip/:id/expenses"><ExpensesTab trip={trip} /></Route>
          <Route path="/trip/:id/places"><PlacesTab trip={trip} /></Route>
          <Route path="/trip/:id"><OverviewTab trip={trip} /></Route>
        </Switch>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full max-w-md bg-card/90 backdrop-blur-xl border-t border-border/50 pb-[env(safe-area-inset-bottom)] z-40 px-2 pt-2">
        <div className="flex justify-between items-center px-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Link key={tab.id} href={`/trip/${trip.id}/${tab.id}`} className="relative flex flex-col items-center justify-center w-full py-2 group">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110"
                    : "text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                )}>
                  <Icon className={cn("w-5 h-5", isActive ? "stroke-[2.5]" : "stroke-2")} />
                </div>
                <span className={cn(
                  "text-[10px] font-semibold mt-1 transition-colors duration-300",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function MembersButton({ trip }: { trip: Trip }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const { mutate: updateTrip } = useUpdateTrip();

  const { data: memberRows = [] } = useQuery({
  queryKey: ['trip-members', trip.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('trip_members')
      .select('*')
      .eq('trip_id', trip.id);

    return data || [];
  },
});

const memberCount = memberRows.length + 1;
const isSolo = memberCount <= 1;
const members = trip.members || [];

  const addMember = () => {
    if (!name.trim()) return;
    const colors = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#65a30d'];
    const color = colors[members.length % colors.length];
    updateTrip({
      ...trip,
      members: [...members, { id: generateId(), name: name.trim(), color }]
    });
    setName('');
  };

  const removeMember = (id: string) => {
    if (!confirm('Remove this member?')) return;
    updateTrip({
      ...trip,
      members: members.filter((m: any) => m.id !== id)
    });
  };

  const joinByCode = () => {
    const trimmed = inviteCode.trim().toUpperCase();
    if (trimmed !== trip.inviteCode) { alert('Invalid code for this trip.'); return; }
    const hasSelf = members.some((m: any) => m.id === 'self');
    if (hasSelf) { alert('You are already in this trip.'); return; }
    updateTrip({
      ...trip,
      members: [...members, { id: 'self', name: 'Me', color: '#2563eb' }]
    });
    setInviteCode('');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-full text-xs font-bold transition-colors",
          isSolo ? "bg-muted text-muted-foreground" : "bg-blue-50 text-blue-600"
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
                    navigator.clipboard?.writeText(trip.inviteCode!);
                    alert('Copied to clipboard!');
                  }}
                  className="text-xs font-bold bg-primary text-primary-foreground px-3 py-2.5 rounded-lg shrink-0"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Share this code to invite others.</p>
            </div>
          )}

          {/* Member List */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Members</p>
            {members.map((member: any) => (
              <div key={member.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: member.color || '#2563eb' }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 font-medium text-sm text-foreground">{member.name}</span>
                {member.id !== 'self' && (
                  <button
                    onClick={() => removeMember(member.id)}
                    className="text-xs text-muted-foreground hover:text-red-500 px-2 py-1"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add member */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Add Member</p>
            <div className="flex gap-2">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } }} />
              <Button onClick={addMember} className="shrink-0 px-4">Add</Button>
            </div>
          </div>

          {/* Join by code */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Join by Code</p>
            <div className="flex gap-2">
              <Input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter code" className="uppercase tracking-wider" />
              <Button variant="outline" onClick={joinByCode} className="shrink-0 px-4">Join</Button>
            </div>
          </div>

          </div>
      </BottomSheet>
    </>
  );
}
