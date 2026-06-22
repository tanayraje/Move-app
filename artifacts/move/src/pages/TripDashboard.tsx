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

export default function TripDashboard({ params }: { params: { id: string, tab?: string } }) {
  const tripId = params.id;
  const { data: trip, isLoading } = useTrip(tripId);
  const [, paramsActive] = useRoute("/trip/:id/:tab");
  const activeTab = paramsActive?.tab || 'overview';

  if (isLoading) return <div className="p-8 text-center">Loading trip...</div>;
  if (!trip) return <div className="p-8 text-center text-muted-foreground">Trip not found. <Link href="/" className="text-primary ml-2">Go back</Link></div>;

  const status = (trip.status || (trip.archived ? 'archived' : 'active')) as TripStatus;
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
  <>
    <button
      onClick={() => setIsOpen(true)}
      className={cn(
        "flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-full text-xs font-bold transition-colors",
        isSolo ? "bg-muted text-muted-foreground" : "bg-blue-50 text-blue-600"
      )}
    >
      <Users className="w-3.5 h-3.5" />
      {members.length}
    </button>

    <BottomSheet
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Members"
    >
      <div className="space-y-4 p-4">
        {trip.inviteCode && (
          <div className="bg-muted/50 rounded-xl p-3 border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Invite Code
            </p>

            <div className="flex items-center gap-2">
              <code className="flex-1 text-lg font-bold text-foreground bg-card border border-border rounded-lg px-3 py-2 tracking-wider">
                {trip.inviteCode}
              </code>

              <button
                onClick={() => {
                  navigator.clipboard?.writeText(trip.inviteCode!);
                  alert("Copied to clipboard!");
                }}
                className="text-xs font-bold bg-primary text-primary-foreground px-3 py-2.5 rounded-lg shrink-0"
              >
                Copy
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              Share this code to invite others.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Members
          </p>

          {members.map((member: any) => (
            <div
              key={member.id}
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: member.color || "#2563eb" }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>

              <span className="flex-1 font-medium text-sm text-foreground">
                {member.name}
              </span>

              {member.id !== "self" && (
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

        <div className="pt-2 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Add Member
          </p>

          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMember();
                }
              }}
            />

            <Button onClick={addMember} className="shrink-0 px-4">
              Add
            </Button>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Join by Code
          </p>

          <div className="flex gap-2">
            <Input
              value={inviteCode}
              onChange={(e) =>
                setInviteCode(e.target.value.toUpperCase())
              }
              placeholder="Enter code"
              className="uppercase tracking-wider"
            />

            <Button
              variant="outline"
              onClick={joinByCode}
              className="shrink-0 px-4"
            >
              Join
            </Button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          <strong>Note:</strong> All data is stored on this device only. For
          true sharing across devices, each person needs to log in to the same
          account or use the same device.
        </div>
      </div>
    </BottomSheet>
  </>
);
}
