import { notify, confirmDialog } from "@/lib/dialogs";
import { useState } from "react";
import { PlaceCode } from "@/components/TicketParts";
import {
  MapPin,
  Trash2,
  UtensilsCrossed,
  Paperclip,
  Check,
  Clock,
  Pencil,
  X,
  ChevronDown,
} from "lucide-react";
import {
  useSaveItineraryItem,
  useDeleteItineraryItem,
  useDeleteExpense,
  useDeleteDocument,
} from "@/hooks/use-store";
import { Trip, ItineraryItem, TripDocument } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatTime12 } from "@/lib/time";
import { formatCurrency, convertFromINR } from "@/lib/countries";
import {
  MEAL_SUBTYPES,
  ELEMENT_BADGES,
  categoryLabel,
  travelIcon,
  travelLabel,
  ELEMENT_ICONS,
  getDuration,
  legStatus,
} from "./shared";

// ─── Sortable Item ────────────────────────────────────────────────────────────
export function SortableItem({
  item,
  documents,
  trip,
  onEdit,
  isLast,
  done = false,
}: {
  item: ItineraryItem;
  documents: TripDocument[];
  trip: Trip;
  onEdit: () => void;
  isLast: boolean;
  done?: boolean;
}) {

  const { mutate: deleteItem } = useDeleteItineraryItem();
  const { mutate: deleteExpense } = useDeleteExpense();
  const { mutate: saveItem } = useSaveItineraryItem();
  const { mutate: deleteDoc } = useDeleteDocument();

  const [expanded, setExpanded] = useState(false);


  const attachedDocs = documents.filter((d) =>
    (item.attachedDocIds || []).includes(d.id)
  );

  const duration = getDuration(item.startTime, item.endTime);
  const destCurrency = trip.destinationCurrency || "INR";

  const totalChecklist = item.checklist?.length ?? 0;
  const doneChecklist =
    item.checklist?.filter((c) => c.done).length ?? 0;

  const mealInfo =
    item.elementType === "meal"
      ? MEAL_SUBTYPES.find((m) => m.id === item.mealSubType)
      : null;

  const MealIcon = UtensilsCrossed;

  const Icon =
    item.elementType === "travel"
      ? travelIcon(item.travelType)
      : item.elementType === "meal"
      ? MealIcon
      : ELEMENT_ICONS[item.elementType];

  const openDoc = (doc: TripDocument) => {
  if (!doc.file_url) {
    notify("Document not available.", "error");
    return;
  }

  window.open(doc.file_url, "_blank");
};

  const detachDoc = async (docId: string) => {
  if (!(await confirmDialog({ title: "Remove this attachment?", message: "It stays in Documents; only the link to this item is removed.", confirmLabel: "Remove", destructive: true }))) return;

  saveItem({
    ...item,
    attachedDocIds: (item.attachedDocIds || []).filter(
      id => id !== docId
    ),
  });
};

  const toggleChecklistItem = (checkId: string) => {
    if (!item.checklist) return;

    saveItem({
      ...item,
      checklist: item.checklist.map((c) =>
        c.id === checkId
          ? { ...c, done: !c.done }
          : c
      ),
    });
  };

  const handleDelete = async () => {
    if (!(await confirmDialog({ title: "Delete this item?", confirmLabel: "Delete", destructive: true }))) return;

    if (item.expenseId) {
      deleteExpense({
        id: item.expenseId,
        tripId: item.tripId,
      });
    }

    deleteItem({
      tripId: item.tripId,
      id: item.id,
    });
  };

  const isTravel = item.elementType === "travel";
  const isMeal = item.elementType === "meal";
  const accentBg = isTravel ? "bg-blue-500" : isMeal ? "bg-amber-500" : "bg-teal-500";
  const leg = isTravel ? legStatus(item) : null;
  // Ticket notches at the perforation (68% across). When expanded, only the top notch is cut.
  const notchTop = "radial-gradient(circle 9px at 68% 0, #0000 97%, #000) top / 100% 51% no-repeat";
  const notchBottom = "radial-gradient(circle 9px at 68% 100%, #0000 97%, #000) bottom / 100% 51% no-repeat";
  const ticketMask = expanded
    ? `${notchTop}, linear-gradient(#000, #000) bottom / 100% 49% no-repeat`
    : `${notchTop}, ${notchBottom}`;

  const dotColor = isTravel ? "bg-blue-500" : isMeal ? "bg-amber-500" : "bg-teal-500";
  const panelTone = isTravel
    ? "border-blue-200 bg-card/70"
    : isMeal
    ? "border-amber-300/70 bg-card/60"
    : "border-teal-200 bg-card/70";
  // Receipt edge for meals: the bottom 8px is cut into a zig-zag
  const zigzag = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='8' viewBox='0 0 16 8'%3E%3Cpath d='M0 0h16L8 8z'/%3E%3C/svg%3E")`;
  const receiptMask = `linear-gradient(#000, #000) top / 100% calc(100% - 7px) no-repeat, ${zigzag} bottom / 16px 8px repeat-x`;

  return (
    <div className="flex">
      {/* Time */}
      <div className="w-11 shrink-0 pt-3.5 text-right">
        <p className="text-[13px] font-bold leading-none tabular-nums">{formatTime12(item.startTime).split(" ")[0]}</p>
        <p className="mt-0.5 text-[10px] font-semibold leading-none text-muted-foreground">{formatTime12(item.startTime).split(" ")[1]}</p>
        {duration && <p className="mt-1 text-[10.5px] text-muted-foreground">{duration}</p>}
      </div>

      {/* Rail: line turns blue once the item is done */}
      <div className="relative w-7 shrink-0">
        {!isLast && (
          <span className={cn("absolute -bottom-5 left-[13px] top-0 w-0.5", done ? "bg-primary dark:bg-primary/60" : "bg-border")} />
        )}
        <span className={cn("absolute left-2 top-[18px] h-3 w-3 rounded-full ring-4 ring-background", dotColor)} />
      </div>

      {/* Card: boarding pass (travel), receipt (meal), entry pass (activity) */}
      <div
        className={cn(
          "min-w-0 flex-1 self-start",
          !isTravel && !isMeal && "rounded-[28px] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_26px_-6px_rgba(13,148,136,0.28)]"
        )}
        style={isTravel || isMeal ? { filter: "drop-shadow(0 8px 14px rgba(15,23,42,0.12))" } : undefined}
      >
        <div
          className={cn(
            "relative overflow-hidden",
            isTravel && "rounded-[22px] bg-blue-50",
            isMeal && "rounded-t-[26px] bg-amber-50 pb-2",
            !isTravel && !isMeal && "rounded-[28px] bg-teal-50 ring-1 ring-teal-200/80"
          )}
          style={
            isTravel
              ? { WebkitMask: ticketMask, mask: ticketMask }
              : isMeal
              ? { WebkitMask: receiptMask, mask: receiptMask }
              : undefined
          }
        >
          <div className="min-w-0">
            <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full text-left">
              {isTravel && (
                <div className="relative">
                  <span
                    aria-hidden
                    className="absolute bottom-4 left-[68%] top-4 border-l-[1.5px] border-dashed border-blue-300"
                  />
                  <div className="grid grid-cols-[68%_32%]">
                    <div className="min-w-0 px-4 py-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="truncate">{travelLabel(item.travelType)}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <PlaceCode place={item.fromLocation} />
                        <div className="flex min-w-[20px] flex-1 items-center">
                          <div className="flex-1 border-t-[1.5px] border-dashed border-blue-300" />
                          <Icon className="mx-1.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                          <div className="flex-1 border-t-[1.5px] border-dashed border-blue-300" />
                        </div>
                        <PlaceCode place={item.toLocation} right />
                      </div>
                      <p className="mt-3 text-[12.5px] font-medium text-blue-900/70">
                        {formatTime12(item.startTime, "—")} to {formatTime12(item.endTime, "—")}
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-col items-center justify-center gap-2 bg-blue-100/60 dark:bg-blue-100 px-2 py-4 text-center">
                      {leg && (
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", leg.tone)}>
                          {leg.label}
                        </span>
                      )}
                      <span className="font-display text-[18px] font-bold leading-none text-blue-950">{duration || "—"}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-blue-900/40 transition-transform duration-300",
                          expanded && "rotate-180"
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              {isMeal && (
                <div className="px-4 pb-2 pt-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-amber-700">{categoryLabel(item)}</p>
                      <h3 className="truncate text-base font-semibold leading-snug">{item.title}</h3>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-amber-900/40 transition-transform duration-300",
                        expanded && "rotate-180"
                      )}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-dashed border-amber-300/80 pt-2.5 text-[12.5px]">
                    <span className="text-amber-900/70">
                      {formatTime12(item.startTime, "—")}
                      {duration ? ` · ${duration}` : ""}
                    </span>
                    {item.cost ? (
                      <span>
                        <span className="mr-1.5 text-amber-900/60">Total</span>
                        <b className="font-display text-amber-950">₹{Math.round(item.cost).toLocaleString("en-IN")}</b>
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              {item.elementType === "activity" && (
                <div>
                  <div className="relative bg-gradient-to-r from-[#0d9488] to-[#059669] dark:from-[#0d453a] dark:to-[#0d453a] px-4 pb-2.5 pt-4 text-white">
                    <span aria-hidden className="absolute left-1/2 top-1.5 h-1.5 w-10 -translate-x-1/2 rounded-full bg-black/25" />
                    <div className="flex items-center justify-between text-[12px] font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        Activity
                      </span>
                      <span>
                        {formatTime12(item.startTime, "—")}
                        {item.endTime ? ` – ${formatTime12(item.endTime)}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <h3 className="line-clamp-2 min-w-0 flex-1 break-words text-[17px] font-semibold leading-snug text-teal-950">
                        {item.title}
                      </h3>
                      <ChevronDown
                        className={cn(
                          "mt-1 h-4 w-4 shrink-0 text-teal-900/40 transition-transform duration-300",
                          expanded && "rotate-180"
                        )}
                      />
                    </div>
                    <div className="mt-2.5 flex items-center gap-3 text-[12px] text-teal-900/70">
                      {duration && (
                        <span className="flex shrink-0 items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {duration}
                        </span>
                      )}
                      {totalChecklist > 0 && (
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-teal-100">
                            <div
                              className="h-full rounded-full bg-teal-500"
                              style={{ width: `${(doneChecklist / totalChecklist) * 100}%` }}
                            />
                          </div>
                          <span className="shrink-0">
                            {doneChecklist} of {totalChecklist}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </button>


{expanded && (
  <div className={cn("border-t border-dashed py-2", panelTone)}>

  {/* Location */}

{item.location && (
  <div className="border-b border-border/20 px-4 py-5">

    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      Location
    </p>

    <div className="-mx-1 rounded-3xl border border-border/60 bg-muted/20 px-6 py-5">

      <div className="flex items-start gap-3">

        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

        <p className="break-words text-[14px] leading-6 text-foreground/90">
          {item.location}
        </p>

      </div>

    </div>

  </div>
)}

{/* Cost */}

{item.cost != null && item.cost > 0 && (
  <div className="border-b border-border/20 px-4 py-5">

    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      Cost
    </p>

    <div className="w-full rounded-3xl border border-border/60 bg-muted/20 px-6 py-6">

      <p className="text-[24px] font-semibold tracking-[-0.02em]">
        ₹{Math.round(item.cost).toLocaleString("en-IN")}
      </p>

      {destCurrency !== "INR" && (
        <p className="mt-1 text-sm text-muted-foreground">
          ≈{" "}
          {formatCurrency(
            convertFromINR(item.cost, destCurrency),
            destCurrency
          )}
        </p>
      )}

    </div>

  </div>
)}

{/* Notes */}

{item.notes && (
  <div className="border-b border-border/20 px-4 py-5">

    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      Notes
    </p>

    <div className="-mx-1 rounded-3xl border border-border/60 bg-muted/20 px-6 py-5">

      <p className="text-[14px] leading-6 text-foreground/80">
        {item.notes}
      </p>

    </div>

  </div>
)}
  {/* Checklist */}

{item.checklist && item.checklist.length > 0 && (
  <div className="border-b border-border/20 px-4 py-5">

    <div className="mb-4 flex items-center justify-between">

      <div>

        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Checklist
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {doneChecklist} of {totalChecklist} completed
        </p>

      </div>

      <span
        className={cn(
          "rounded-full px-3.5 py-1.5 text-xs font-semibold",
          ELEMENT_BADGES[item.elementType]
        )}
      >
        {totalChecklist
          ? Math.round((doneChecklist / totalChecklist) * 100)
          : 0}
        %
      </span>

    </div>

    <div className="mb-5 h-2 overflow-hidden rounded-full bg-muted">

      <div
        className={cn(
          "h-full rounded-full transition duration-300",
          item.elementType === "travel"
            ? "bg-blue-500"
            : item.elementType === "accommodation"
            ? "bg-violet-500"
            : item.elementType === "meal"
            ? "bg-amber-400"
            : "bg-teal-500"
        )}
        style={{
          width: `${
            totalChecklist
              ? (doneChecklist / totalChecklist) * 100
              : 0
          }%`,
        }}
      />

    </div>

    <div className="w-full rounded-3xl border border-border/60 bg-muted/20 p-6">

      <div className="space-y-2">

        {item.checklist.map((ci) => (

          <button
            key={ci.id}
            type="button"
            onClick={() => toggleChecklistItem(ci.id)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-background"
          >

            {ci.done ? (

              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  item.elementType === "travel"
                    ? "bg-blue-500"
                    : item.elementType === "accommodation"
                    ? "bg-violet-500"
                    : item.elementType === "meal"
                    ? "bg-amber-400"
                    : "bg-teal-500"
                )}
              >
                <Check className="h-3 w-3 text-white" />
              </div>

            ) : (

              <div className="h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/30" />

            )}

            <span
              className={cn(
                "text-[14px]",
                ci.done
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              )}
            >
              {ci.text}
            </span>

          </button>

        ))}

      </div>

    </div>

  </div>
)}

{/* Attachments */}

{attachedDocs.length > 0 && (
  <div className="border-b border-border/20 px-4 py-5">

    <div className="mb-4 flex items-center justify-between">

      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Attachments
      </p>

      <span className="text-xs text-muted-foreground">
        {attachedDocs.length} file
        {attachedDocs.length !== 1 ? "s" : ""}
      </span>

    </div>

    <div className="space-y-6">

      {attachedDocs.map((doc) => (

        <div
  key={doc.id}
  className="w-full rounded-3xl border border-border/60 bg-muted/20 px-6 py-5"
>

  <div className="flex items-start gap-3">

    <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

    <button
      type="button"
      onClick={() => openDoc(doc)}
      className="min-w-0 flex-1 text-left"
    >
      <p className="break-words text-[14px] font-medium leading-5">
        {doc.name}
      </p>

      <p className="mt-1 text-[11px] text-muted-foreground">
        Tap to open
      </p>
    </button>

    <button
      type="button"
      onClick={() => detachDoc(doc.id)}
      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
      aria-label="Remove attachment"
    >
      <X className="h-4 w-4" />
    </button>

  </div>

</div>

      ))}

    </div>

  </div>
)}

{/* Actions */}

<div className="border-t border-border/20 px-5 py-5">

  <div className="flex w-full">

  <div className="w-12 shrink-0" />

  <div className="ml-auto flex min-w-0 flex-1 justify-end gap-3">

      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted [&>svg]:shrink-0"
      >
        <Pencil className="h-4 w-4 shrink-0" />
        Edit
      </button>

      <button
        type="button"
        onClick={handleDelete}
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 [&>svg]:shrink-0"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>

    </div>

  </div>

</div>

  </div>
)}

            </div>
    </div>

  </div>

</div>
);
}
