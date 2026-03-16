import React, { useState, useMemo } from "react";
import { format, addDays, differenceInDays } from "date-fns";
import { Plus, GripVertical, Clock, MapPin, Trash2, Tag, CalendarDays } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useItinerary, useSaveItineraryItem, useDeleteItineraryItem, useReorderItinerary } from "@/hooks/use-store";
import { Trip, ItineraryItem, ItineraryCategory } from "@/lib/types";
import { generateId, cn } from "@/lib/utils";
import { Button, Input, Label, Select, BottomSheet, FAB } from "@/components/ui";

const CATEGORY_COLORS: Record<ItineraryCategory, string> = {
  flight: "bg-[var(--color-cat-flight)]",
  train: "bg-[var(--color-cat-train)]",
  hotel: "bg-[var(--color-cat-hotel)]",
  activity: "bg-[var(--color-cat-activity)]",
  food: "bg-[var(--color-cat-food)]",
  travel: "bg-[var(--color-cat-travel)]",
  other: "bg-[var(--color-cat-other)]",
};

export default function ItineraryTab({ trip }: { trip: Trip }) {
  const { data: items = [] } = useItinerary(trip.id);
  const { mutate: reorder } = useReorderItinerary();
  
  const [selectedDate, setSelectedDate] = useState<string>(trip.startDate);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const daysCount = differenceInDays(new Date(trip.endDate), new Date(trip.startDate)) + 1;
  const days = Array.from({ length: daysCount }).map((_, i) => format(addDays(new Date(trip.startDate), i), 'yyyy-MM-dd'));

  const filteredItems = useMemo(() => {
    return items.filter(i => i.date === selectedDate).sort((a, b) => {
      // Sort by time first, then order
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
      return a.order - b.order;
    });
  }, [items, selectedDate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = filteredItems.findIndex(i => i.id === active.id);
      const newIndex = filteredItems.findIndex(i => i.id === over.id);
      const newArray = arrayMove(filteredItems, oldIndex, newIndex).map((item, index) => ({ ...item, order: index }));
      
      const allOtherItems = items.filter(i => i.date !== selectedDate);
      reorder({ tripId: trip.id, items: [...allOtherItems, ...newArray] });
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Day Selector */}
      <div className="sticky top-0 z-20 bg-background pt-2 pb-4 px-4 overflow-x-auto no-scrollbar border-b border-border/50">
        <div className="flex gap-2 min-w-max">
          {days.map((day, idx) => {
            const isSelected = selectedDate === day;
            return (
              <button
                key={day}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex flex-col items-center justify-center w-14 h-16 rounded-2xl transition-all font-medium border-2",
                  isSelected 
                    ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "bg-card border-border text-foreground/70 hover:border-primary/30"
                )}
              >
                <span className="text-xs uppercase opacity-80">{format(new Date(day), 'EEE')}</span>
                <span className="text-lg font-bold mt-0.5">{format(new Date(day), 'd')}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6 relative min-h-[50vh]">
        {filteredItems.length === 0 ? (
          <div className="text-center text-muted-foreground mt-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-8 h-8 opacity-50" />
            </div>
            <p>No plans for this day yet.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-border/50 ml-4 pl-6 space-y-6">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {filteredItems.map(item => (
                  <SortableItem key={item.id} item={item} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      <FAB icon={Plus} onClick={() => setIsAddOpen(true)} />
      
      <AddItinerarySheet 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        tripId={trip.id} 
        defaultDate={selectedDate}
        orderCount={filteredItems.length}
      />
    </div>
  );
}

function SortableItem({ item }: { item: ItineraryItem }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const { mutate: deleteItem } = useDeleteItineraryItem();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isMajor = item.category === 'flight' || item.category === 'train' || item.category === 'hotel';

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Timeline dot */}
      <div className={cn(
        "absolute -left-[31px] w-4 h-4 rounded-full border-4 border-background z-10",
        CATEGORY_COLORS[item.category]
      )} />

      <div className={cn(
        "bg-card rounded-2xl p-4 shadow-sm border border-border flex gap-3",
        isMajor ? "border-l-4" : "",
        isMajor ? CATEGORY_COLORS[item.category].replace('bg-', 'border-l-') : ""
      )}>
        <div className="flex-1">
          <div className="flex justify-between items-start mb-1">
            <h4 className="font-bold text-foreground text-lg leading-tight">{item.title}</h4>
            <div className="flex items-center text-xs font-bold text-foreground/60 bg-muted px-2 py-1 rounded-md whitespace-nowrap ml-2">
              {item.startTime} - {item.endTime}
            </div>
          </div>
          
          {item.location && (
            <div className="flex items-start text-sm text-muted-foreground mt-2">
              <MapPin className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0" />
              <span>{item.location}</span>
            </div>
          )}
          
          {item.notes && (
            <div className="mt-3 text-sm text-foreground/80 bg-muted/30 p-3 rounded-xl border border-border/50">
              {item.notes}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-between border-l border-border pl-2 -mr-1">
          <button 
            {...attributes} {...listeners}
            className="p-2 text-muted-foreground hover:text-foreground touch-none"
          >
            <GripVertical className="w-5 h-5" />
          </button>
          <button 
            onClick={() => { if(confirm('Delete item?')) deleteItem({ tripId: item.tripId, id: item.id }) }}
            className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddItinerarySheet({ isOpen, onClose, tripId, defaultDate, orderCount }: { isOpen: boolean, onClose: () => void, tripId: string, defaultDate: string, orderCount: number }) {
  const { mutateAsync: saveItem, isPending } = useSaveItineraryItem();
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await saveItem({
      id: generateId(),
      tripId,
      title: fd.get('title') as string,
      location: fd.get('location') as string,
      date: defaultDate,
      startTime: fd.get('startTime') as string,
      endTime: fd.get('endTime') as string,
      notes: fd.get('notes') as string,
      category: fd.get('category') as ItineraryCategory,
      order: orderCount,
    });
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add to Timeline">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" placeholder="Flight to Paris" required />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" required defaultValue="flight">
            <option value="flight">Flight</option>
            <option value="train">Train</option>
            <option value="hotel">Accommodation</option>
            <option value="activity">Activity</option>
            <option value="food">Food & Drink</option>
            <option value="travel">Transit</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startTime">Start Time</Label>
            <Input id="startTime" name="startTime" type="time" required />
          </div>
          <div>
            <Label htmlFor="endTime">End Time</Label>
            <Input id="endTime" name="endTime" type="time" required />
          </div>
        </div>
        <div>
          <Label htmlFor="location">Location (Optional)</Label>
          <Input id="location" name="location" placeholder="CDG Airport" />
        </div>
        <div>
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Input id="notes" name="notes" placeholder="Confirmation: XYZ123" />
        </div>
        <Button type="submit" size="lg" className="mt-4" isLoading={isPending}>
          Save Item
        </Button>
      </form>
    </BottomSheet>
  );
}
