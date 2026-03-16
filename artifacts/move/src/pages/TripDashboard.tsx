import React from "react";
import { useRoute, Link, Route, Switch } from "wouter";
import { format } from "date-fns";
import { useTrip } from "@/hooks/use-store";
import { CalendarDays, FileText, Receipt, MapPin, LayoutDashboard, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

import ItineraryTab from "./tabs/ItineraryTab";
import DocumentsTab from "./tabs/DocumentsTab";
import ExpensesTab from "./tabs/ExpensesTab";
import PlacesTab from "./tabs/PlacesTab";
import OverviewTab from "./tabs/OverviewTab";

export default function TripDashboard({ params }: { params: { id: string, tab?: string } }) {
  const tripId = params.id;
  const { data: trip, isLoading } = useTrip(tripId);
  const [, paramsActive] = useRoute("/trip/:id/:tab");
  const activeTab = paramsActive?.tab || 'overview';

  if (isLoading) return <div className="p-8 text-center">Loading trip...</div>;
  if (!trip) return <div className="p-8 text-center text-muted-foreground">Trip not found. <Link href="/" className="text-primary ml-2">Go back</Link></div>;

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
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-4 flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-muted text-foreground">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div className="flex-1 truncate">
          <h1 className="text-xl font-display font-bold text-foreground truncate">{trip.name}</h1>
          <p className="text-xs text-muted-foreground font-medium truncate">
            {trip.destination} · {format(new Date(trip.startDate), 'MMM d')} – {format(new Date(trip.endDate), 'MMM d')}
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative pb-[env(safe-area-inset-bottom,20px)] mb-20 overflow-x-hidden">
        <Switch>
          <Route path="/trip/:id/overview"><OverviewTab trip={trip} /></Route>
          <Route path="/trip/:id/itinerary"><ItineraryTab trip={trip} /></Route>
          <Route path="/trip/:id/documents"><DocumentsTab trip={trip} /></Route>
          <Route path="/trip/:id/expenses"><ExpensesTab trip={trip} /></Route>
          <Route path="/trip/:id/places"><PlacesTab trip={trip} /></Route>
          {/* Default — overview */}
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
