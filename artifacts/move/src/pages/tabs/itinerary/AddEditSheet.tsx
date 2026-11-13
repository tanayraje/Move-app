import React, { useState } from "react";
import {
  Trash2,
  Plane,
  Building2,
  UtensilsCrossed,
  Bike,
  FileText,
  Paperclip,
  Check,
  Square,
  Clock,
  Upload,
  ArrowLeftRight,
} from "lucide-react";
import { useSaveItineraryItem, useAddDocument, useSaveExpense, useDeleteExpense } from "@/hooks/use-store";
import { Trip, ItineraryItem, ElementType, TravelType, TripDocument, ChecklistItem } from "@/lib/types";
import { generateId, cn, safeFormatDate } from "@/lib/utils";
import { Button, Input, Label, Select, TimeInput, BottomSheet } from "@/components/ui";
import { formatTime12 } from "@/lib/time";
import { formatCurrency, convertFromINR, RATES_PER_INR } from "@/lib/countries";
import {
  MealSubType,
  MEAL_SUBTYPES,
  TRAVEL_ICONS,
  ELEMENT_TO_EXPENSE_CAT,
  elementTypeToCategory,
  parseTime,
  addMinutesToTime,
} from "./shared";

// ─── Add / Edit Sheet ─────────────────────────────────────────────────────────
export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  defaultDate: string;
  documents: TripDocument[];
  allItems: ItineraryItem[];
  existingItem?: ItineraryItem;
  defaultElementType?: ElementType;
}

export function AddEditSheet({ isOpen, onClose, trip, defaultDate, documents, allItems, existingItem, defaultElementType }: SheetProps) {
  const { mutateAsync: saveItem, isPending } = useSaveItineraryItem();
  const { mutateAsync: addDocument } = useAddDocument();
  const { mutateAsync: saveExpense } = useSaveExpense();
  const { mutate: deleteExpense } = useDeleteExpense();

  const destCurrency = trip.destinationCurrency || 'INR';
  const showCurrencyToggle = destCurrency !== 'INR';

  const [elementType, setElementType] = useState<ElementType>(existingItem?.elementType || defaultElementType || 'activity');
  const [travelType, setTravelType] = useState<TravelType>(existingItem?.travelType || 'flight');
  const [mealSubType, setMealSubType] = useState<MealSubType>(existingItem?.mealSubType || 'lunch');
  const [mealTime, setMealTime] = useState(existingItem?.startTime || '13:00');
  const [duration, setDuration] = useState(
  existingItem
    ? Math.max(parseTime(existingItem.endTime) - parseTime(existingItem.startTime), 30)
    : 60
);
  const [startTime, setStartTime] = useState(existingItem?.startTime || '09:00');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(existingItem?.attachedDocIds || []);
  const [checklistText, setChecklistText] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(existingItem?.checklist || []);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [costInput, setCostInput] = useState<string>(
    existingItem?.cost ? String(Math.round(existingItem.cost)) : ''
  );
  const [costInDest, setCostInDest] = useState(false);

  const isEditing = !!existingItem;

  // When meal subtype changes, auto-update the time
  const handleMealSubTypeChange = (sub: MealSubType) => {
    setMealSubType(sub);
    if (!existingItem) {
      const info = MEAL_SUBTYPES.find(m => m.id === sub);
      if (info) setMealTime(info.defaultTime);
    }
  };

  const getCostInINR = (): number => {
    const val = parseFloat(costInput);
    if (!val || isNaN(val)) return 0;
    if (costInDest && destCurrency !== 'INR') {
      const rate = RATES_PER_INR[destCurrency] ?? 1;
      return val / rate;
    }
    return val;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = (fd.get('date') as string) || defaultDate;
    let st = startTime;
    let et = '';
    let title = '';
    let location = '';
    let fromLocation = '';
    let toLocation = '';
    let endDate: string | undefined;

    if (elementType === 'travel') {
      fromLocation = fd.get('fromLocation') as string;
      toLocation = fd.get('toLocation') as string;
      title = `${travelType.charAt(0).toUpperCase() + travelType.slice(1)}: ${fromLocation} → ${toLocation}`;
      st = fd.get('departureTime') as string;
      et = fd.get('arrivalTime') as string;
    } else if (elementType === 'accommodation') {
      title = fd.get('accommodationName') as string;
      location = fd.get('address') as string;
      st = fd.get('checkInTime') as string || '14:00';
      et = fd.get('checkOutTime') as string || '11:00';
      endDate = (fd.get('checkOutDate') as string) || date;
    } else if (elementType === 'meal') {
      title = fd.get('restaurantName') as string;
      location = fd.get('mealLocation') as string;
      st = mealTime;
      et = addMinutesToTime(st, 60);
    } else if (elementType === 'activity') {
      title = fd.get('activityName') as string;
      location = fd.get('activityLocation') as string;
      st = fd.get('startTime') as string;
      et = addMinutesToTime(st, duration);
    }

    let finalDocIds = [...selectedDocIds];
    if (uploadFile) {
      const catMap: Record<ElementType, string> = {
        travel: 'ticket', accommodation: 'hotel', meal: 'other', activity: 'ticket'
      };
      const newDoc = {
        id: generateId(),
        tripId: trip.id,
        name: (fd.get('uploadName') as string) || uploadFile.name,
        category: catMap[elementType] as any,
        notes: '',
        fileName: uploadFile.name,
        fileType: uploadFile.type,
        fileSize: uploadFile.size,
        blob: uploadFile,
        createdAt: Date.now(),
      };
      await addDocument(newDoc);
      finalDocIds = [...finalDocIds, newDoc.id];
    }

    const costINR = getCostInINR();
    let expenseId = existingItem?.expenseId;

    if (costINR > 0) {
      const expCat = ELEMENT_TO_EXPENSE_CAT[elementType];
      const expEntry = {
        id: expenseId || generateId(),
        tripId: trip.id,
        title,
        amount: costINR,
        category: expCat,
        date: safeFormatDate(date, d => d.toISOString(), date),
        createdAt: Date.now(),
      };
      await saveExpense(expEntry);
      expenseId = expEntry.id;
    } else if (expenseId && costINR === 0) {
      deleteExpense({ id: expenseId, tripId: trip.id });
      expenseId = undefined;
    }

    await saveItem({
      id: existingItem?.id || generateId(),
      tripId: trip.id,
      elementType,
      travelType: elementType === 'travel' ? travelType : undefined,
      mealSubType: elementType === 'meal' ? mealSubType : undefined,
      title,
      location,
      fromLocation: fromLocation || undefined,
      toLocation: toLocation || undefined,
      date,
      startTime: st,
      endTime: et,
      endDate,
      notes: fd.get('notes') as string || '',
      category: elementTypeToCategory(elementType, travelType),
      order: 0,
      attachedDocIds: finalDocIds,
      checklist: checklist.length > 0 ? checklist : undefined,
      cost: costINR > 0 ? costINR : undefined,
      expenseId,
    });
    onClose();
  };

  const addChecklistItem = () => {
    if (!checklistText.trim()) return;
    setChecklist(prev => [...prev, { id: generateId(), text: checklistText.trim(), done: false }]);
    setChecklistText('');
  };

  const ELEMENT_TYPES: { id: ElementType; label: string; icon: React.ElementType }[] = [
    { id: 'travel', label: 'Travel', icon: Plane },
    { id: 'accommodation', label: 'Stay', icon: Building2 },
    { id: 'meal', label: 'Meal', icon: UtensilsCrossed },
    { id: 'activity', label: 'Activity', icon: Bike },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit Item" : "Add to Timeline"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Element type selector */}
        {!isEditing && (
          <div>
            <Label>Type</Label>
            <div className="grid grid-cols-4 gap-2 [&>*]:min-w-0">
              {ELEMENT_TYPES.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setElementType(id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition text-[15px] font-semibold",
                    elementType === id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                  )}>
                  <Icon className="w-5 h-5" />{label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date */}
        {elementType !== "accommodation" && (
  <div>
    <Label htmlFor="date">Day</Label>

    {trip.status === "wishlist" ? (
      <Select
        id="date"
        name="date"
        defaultValue={existingItem?.date || defaultDate}
      >
        {Array.from(
          { length: trip.wishlistDayCount ?? 1 },
          (_, i) => (
            <option
              key={i}
              value={`Day ${i + 1}`}
            >
              Day {i + 1}
            </option>
          )
        )}
      </Select>
    ) : (
      <Input
        id="date"
        name="date"
        type="date"
        defaultValue={existingItem?.date || defaultDate}
        required
      />
    )}
  </div>
)}

        {/* TRAVEL fields */}
        {elementType === 'travel' && (
          <>
            <div>
              <Label>Travel Type</Label>
              <div className="grid grid-cols-4 gap-2 [&>*]:min-w-0">
                {(['flight', 'train', 'bus', 'car'] as TravelType[]).map(t => {
                  const TIcon = TRAVEL_ICONS[t];
                  return (
                    <button key={t} type="button" onClick={() => setTravelType(t)}
                      className={cn("flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition text-xs font-semibold capitalize",
                        travelType === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                      )}>
                      <TIcon className="w-4 h-4" />{t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div>
                <Label htmlFor="fromLocation">From</Label>
                <Input id="fromLocation" name="fromLocation" placeholder="Delhi (DEL)" defaultValue={existingItem?.fromLocation} required />
              </div>
              <div>
                <Label htmlFor="toLocation">To</Label>
                <Input id="toLocation" name="toLocation" placeholder="Paris (CDG)" defaultValue={existingItem?.toLocation} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div>
                <Label htmlFor="departureTime">Departure</Label>
                <TimeInput id="departureTime" name="departureTime" defaultValue={existingItem?.startTime || '10:00'} required />
              </div>
              <div>
                <Label htmlFor="arrivalTime">Arrival</Label>
                <TimeInput id="arrivalTime" name="arrivalTime" defaultValue={existingItem?.endTime || '13:00'} required />
              </div>
            </div>
          </>
        )}

        {/* ACCOMMODATION fields */}
        {elementType === 'accommodation' && (
          <>
            <div>
              <Label htmlFor="accommodationName">Property Name</Label>
              <Input id="accommodationName" name="accommodationName" placeholder="Hotel Le Meurice" defaultValue={existingItem?.title} required />
            </div>
            <div>
              <Label htmlFor="address">Address / Location</Label>
              <Input id="address" name="address" placeholder="228 Rue de Rivoli, Paris" defaultValue={existingItem?.location} />
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div>
                <Label htmlFor="checkInDate">Check-in Date</Label>
                <Input id="checkInDate" name="date" type="date" defaultValue={existingItem?.date || defaultDate} required />
              </div>
              <div>
                <Label htmlFor="checkInTime">Check-in Time</Label>
                <TimeInput id="checkInTime" name="checkInTime" defaultValue={existingItem?.startTime || '14:00'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div>
                <Label htmlFor="checkOutDate">Check-out Date</Label>
                <Input id="checkOutDate" name="checkOutDate" type="date" defaultValue={existingItem?.endDate || defaultDate} required />
              </div>
              <div>
                <Label htmlFor="checkOutTime">Check-out Time</Label>
                <TimeInput id="checkOutTime" name="checkOutTime" defaultValue={existingItem?.endTime || '11:00'} />
              </div>
            </div>
          </>
        )}

        {/* MEAL fields */}
        {elementType === 'meal' && (
          <>
            {/* Meal sub-type picker */}
            <div>
              <Label>Meal Type</Label>
              <div className="grid grid-cols-4 gap-2 [&>*]:min-w-0">
                {MEAL_SUBTYPES.map(({ id, label, icon: MIcon }) => (
                  <button key={id} type="button" onClick={() => handleMealSubTypeChange(id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition text-xs font-semibold",
                      mealSubType === id ? "border-amber-400 bg-amber-50 text-amber-700" : "border-border bg-card text-muted-foreground"
                    )}>
                    <MIcon className="w-4 h-4" />{label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="restaurantName">Restaurant / Place</Label>
              <Input id="restaurantName" name="restaurantName" placeholder="Café de Flore" defaultValue={existingItem?.title} required />
            </div>
            <div>
              <Label htmlFor="mealLocation">Location</Label>
              <Input id="mealLocation" name="mealLocation" placeholder="Saint-Germain-des-Prés" defaultValue={existingItem?.location} />
            </div>
            <div>
              <Label htmlFor="mealTime">Time</Label>
              <TimeInput
                id="mealTime"
                name="mealTime"
                value={mealTime}
                onChange={setMealTime}
                required
              />
              <p className="text-xs text-muted-foreground mt-1 ml-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Ends at {formatTime12(addMinutesToTime(mealTime, 60))} (1 hour)
              </p>
            </div>
          </>
        )}

        {/* ACTIVITY fields */}
        {elementType === 'activity' && (
          <>
            <div>
              <Label htmlFor="activityName">Activity Name</Label>
              <Input id="activityName" name="activityName" placeholder="Louvre Museum" defaultValue={existingItem?.title} required />
            </div>
            <div>
              <Label htmlFor="activityLocation">Location</Label>
              <Input id="activityLocation" name="activityLocation" placeholder="Paris, France" defaultValue={existingItem?.location} />
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <TimeInput id="startTime" name="startTime" value={startTime} onChange={setStartTime} required />
              </div>
              <div>
                <Label>Duration</Label>
                <Select value={String(duration)} onChange={e => setDuration(Number(e.target.value))}>
                  <option value="30">30 min</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                  <option value="180">3 hours</option>
                  <option value="240">4 hours</option>
                  <option value="360">6 hours</option>
                  <option value="480">8 hours</option>
                </Select>
              </div>
            </div>
            {startTime && (
              <p className="text-xs text-muted-foreground -mt-3 ml-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Ends at {formatTime12(addMinutesToTime(startTime, duration))}
              </p>
            )}
          </>
        )}

        {/* ── COST FIELD ── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="mb-0">Cost (optional)</Label>
            {showCurrencyToggle && (
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(costInput);
                  if (val && !isNaN(val)) {
                    const rate = RATES_PER_INR[destCurrency] ?? 1;
                    if (costInDest) {
                      setCostInput(String(Math.round(val / rate)));
                    } else {
                      setCostInput(String(Math.round(val * rate)));
                    }
                  }
                  setCostInDest(v => !v);
                }}
                className="flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full"
              >
                <ArrowLeftRight className="w-3 h-3" />
                {costInDest ? destCurrency : 'INR'} ↔ {costInDest ? 'INR' : destCurrency}
              </button>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold pointer-events-none">
              {costInDest ? destCurrency : '₹'}
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={costInput}
              onChange={e => setCostInput(e.target.value)}
              placeholder="0"
              className="pl-10 text-[19px] font-semibold h-14"
            />
          </div>
          {costInput && parseFloat(costInput) > 0 && (
            <p className="text-xs text-muted-foreground mt-1 ml-1">
              {showCurrencyToggle && (costInDest
                ? `≈ ${formatCurrency(getCostInINR(), 'INR')} · `
                : `≈ ${formatCurrency(convertFromINR(parseFloat(costInput), destCurrency), destCurrency)} · `
              )}
              Auto-logged to <span className="font-semibold capitalize">{ELEMENT_TO_EXPENSE_CAT[elementType]}</span> budget
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input id="notes" name="notes" placeholder="Confirmation, tips, reminders…" defaultValue={existingItem?.notes} />
        </div>

        {/* Checklist */}
        <div>
          <Label>Checklist (optional)</Label>
          <div className="flex gap-2 mb-2">
            <Input
              value={checklistText}
              onChange={e => setChecklistText(e.target.value)}
              placeholder="Add checklist item…"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addChecklistItem} className="shrink-0 h-12 px-3">Add</Button>
          </div>
          {checklist.length > 0 && (
            <div className="space-y-1.5 mt-1 bg-muted/30 rounded-xl p-3 border border-border/50">
              {checklist.map((ci, idx) => (
                <div key={ci.id} className="flex items-center gap-2">
                  <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm text-foreground">{ci.text}</span>
                  <button aria-label="Remove checklist item" type="button" onClick={() => setChecklist(prev => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload document */}
        <div>
          <Label>Upload Document (optional)</Label>
          <label className={cn(
            "flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition",
            uploadFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
          )}>
            <Upload className={cn("w-5 h-5 shrink-0", uploadFile ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-sm flex-1 truncate", uploadFile ? "text-foreground font-medium" : "text-muted-foreground")}>
              {uploadFile ? uploadFile.name : "Tap to upload a file…"}
            </span>
            <input type="file" className="hidden" accept="application/pdf,image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
          </label>
          {uploadFile && (
            <div className="mt-2">
              <Label htmlFor="uploadName">Document Name</Label>
              <Input id="uploadName" name="uploadName" defaultValue={uploadFile.name} placeholder="e.g. Return Ticket" />
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1 ml-1">Saved to Documents tab and attached here</p>
        </div>

        {/* Attach existing documents */}
        {documents.length > 0 && (
          <div>
            <Label>Attach Existing Documents</Label>
            <button
              type="button"
              onClick={() => setShowDocPicker(!showDocPicker)}
              className="flex items-center justify-between w-full h-12 px-4 rounded-xl border-2 border-border bg-card text-base transition hover:border-primary/40"
            >
              <span className="text-muted-foreground text-sm">
                {selectedDocIds.length > 0 ? `${selectedDocIds.length} selected` : 'Select from saved documents'}
              </span>
              <Paperclip className="w-4 h-4 text-muted-foreground" />
            </button>
            {showDocPicker && (
              <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden">
                {documents.map(doc => {
                  const isSel = selectedDocIds.includes(doc.id);
                  return (
                    <button key={doc.id} type="button"
                      onClick={() => setSelectedDocIds(prev => isSel ? prev.filter(id => id !== doc.id) : [...prev, doc.id])}
                      className="flex items-center gap-3 w-full px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/40"
                    >
                      <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition", isSel ? "bg-primary border-primary" : "border-border")}>
                        {isSel && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm text-foreground truncate text-left">{doc.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{doc.category}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <Button type="submit" size="lg" className="mt-2" isLoading={isPending}>
          {isEditing ? 'Save Changes' : 'Add to Timeline'}
        </Button>
      </form>
    </BottomSheet>
  );
}
