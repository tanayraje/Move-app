import React from "react";
import { differenceInDays, format } from "date-fns";
import { useItinerary, useExpenses, useDocuments, usePlaces } from "@/hooks/use-store";
import { Trip } from "@/lib/types";
import { Calendar, FileText, Receipt, MapPin, Plane } from "lucide-react";

export default function OverviewTab({ trip }: { trip: Trip }) {
  const { data: itinerary = [] } = useItinerary(trip.id);
  const { data: expenses = [] } = useExpenses(trip.id);
  const { data: documents = [] } = useDocuments(trip.id);
  const { data: places = [] } = usePlaces(trip.id);

  const daysUntil = differenceInDays(new Date(trip.startDate), new Date());
  const totalCost = expenses.reduce((sum, e) => sum + e.amount, 0);
  const visitedPlaces = places.filter(p => p.visited).length;

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      
      <div className="bg-primary text-primary-foreground rounded-[2rem] p-6 shadow-xl shadow-primary/20 relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-10">
          <Plane className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <p className="text-primary-foreground/80 font-medium mb-1">Status</p>
          <h2 className="text-4xl font-display font-extrabold mb-4">
            {daysUntil > 0 ? `${daysUntil} days left` : daysUntil === 0 ? "Starts Today!" : "In Progress or Past"}
          </h2>
          <div className="inline-flex items-center bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl text-sm font-semibold">
            {format(new Date(trip.startDate), 'MMM d')} - {format(new Date(trip.endDate), 'MMM d, yyyy')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-2">
        <StatCard icon={Calendar} label="Timeline Items" value={itinerary.length} />
        <StatCard icon={Receipt} label="Total Spent" value={`$${totalCost.toFixed(0)}`} />
        <StatCard icon={MapPin} label="Places Saved" value={`${visitedPlaces}/${places.length} visited`} />
        <StatCard icon={FileText} label="Documents" value={documents.length} />
      </div>

      <div className="mt-6 bg-card border border-border p-5 rounded-3xl shadow-sm">
        <h3 className="font-bold text-foreground mb-4">Trip Destination</h3>
        <div className="aspect-[2/1] bg-muted rounded-2xl flex items-center justify-center overflow-hidden relative">
           {/* Placeholder for map - purely decorative for now since no map API */}
           <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&auto=format&fit=crop&q=60')] bg-cover bg-center opacity-40 mix-blend-luminosity grayscale"></div>
           <MapPin className="w-8 h-8 text-foreground/50 z-10" />
           <span className="z-10 font-display font-bold text-xl ml-2">{trip.destination}</span>
        </div>
      </div>

    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) {
  return (
    <div className="bg-card border border-border/60 p-5 rounded-3xl shadow-sm flex flex-col">
      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
    </div>
  );
}
