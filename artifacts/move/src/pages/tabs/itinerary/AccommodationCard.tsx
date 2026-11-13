import { notify, confirmDialog } from "@/lib/dialogs";
import { useState } from "react";
import { format, differenceInDays } from "date-fns";
import { MapPin, Trash2, Building2, Paperclip, Check, Pencil, X, ChevronDown } from "lucide-react";
import {
  useSaveItineraryItem,
  useDeleteItineraryItem,
  useDocuments,
  useDeleteExpense,
} from "@/hooks/use-store";
import { Trip, ItineraryItem, TripDocument } from "@/lib/types";
import { cn, safeFormatDate, safeParseDate } from "@/lib/utils";
import { formatTime12 } from "@/lib/time";
import { formatCurrency, convertFromINR } from "@/lib/countries";
import { ELEMENT_BORDER, ELEMENT_BADGES, tintSurface, stayNights } from "./shared";

// ─── Accommodation Card ─────────────────────────────────────────────────────
export function AccommodationCard({
  item,
  trip,
  currentDay,
  onEdit,
}: {
  item: ItineraryItem;
  trip: Trip;
  currentDay: string;
  onEdit: () => void;
}) {
  const { mutate: deleteItem } = useDeleteItineraryItem();
  const { mutate: deleteExpense } = useDeleteExpense();
  const { mutate: saveItem } = useSaveItineraryItem();

  const [expanded, setExpanded] = useState(false);

  const documents = useDocuments(item.tripId).data || [];

const attachedDocs = documents.filter((d) =>
  (item.attachedDocIds || []).includes(d.id)
);

const totalChecklist = item.checklist?.length ?? 0;

const doneChecklist =
  item.checklist?.filter((c) => c.done).length ?? 0;

  const nights = item.endDate ? stayNights(item.date, item.endDate) : 1;
  const destCurrency = trip.destinationCurrency || "INR";

  const openDoc = (doc: TripDocument) => {
  if (!doc.file_url) {
    notify("Document not available.", "error");
    return;
  }

  window.open(doc.file_url, "_blank");
};

const detachDoc = async (docId: string) => {
  if (!(await confirmDialog({ title: "Remove this file?", message: "It stays in Documents; only the link to this item is removed.", confirmLabel: "Remove", destructive: true }))) return;

  saveItem({
    ...item,
    attachedDocIds: (item.attachedDocIds || []).filter(
      (id) => id !== docId
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
    if (!(await confirmDialog({ title: "Remove this stay?", confirmLabel: "Remove", destructive: true }))) return;

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

  return (
    <div
      className={cn(
        "mb-6 overflow-hidden rounded-[26px] border bg-violet-50/70 dark:bg-violet-50 shadow-[0_5px_0_-1px_#E9E3FD,0_10px_0_-2px_#F2EEFE] dark:shadow-[0_5px_0_-1px_#362d58,0_10px_0_-2px_#202431] transition duration-300",
        ELEMENT_BORDER.accommodation
      )}
    >
      <div className="flex items-stretch">

        {/* Left Strip */}

  <div className="w-[6px] shrink-0 bg-violet-500" />

  {/* Right Side */}

  <div className="min-w-0 w-0 flex-1">

          <button
  type="button"
  onClick={() => setExpanded((v) => !v)}
  className="w-full text-left"
>
  <div className="pl-6 pr-5 py-5">

    {/* Header */}

    <div className="flex min-w-0 items-start justify-between gap-4">

      <div className="min-w-0 flex-1">

        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-violet-600"><Building2 className="h-3.5 w-3.5" />Stay</p>

        <h3 className="min-w-0 break-words line-clamp-2 text-[18px] font-semibold leading-[1.35]">
          {item.title}
        </h3>

      </div>

      <ChevronDown
        className={cn(
           "mt-6 h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-300",
          expanded && "rotate-180"
        )}
      />

    </div>

    {/* Stay Timeline */}

    <div className="mt-4 flex items-end justify-between gap-4">

      {/* Check In */}

      <div className="min-w-0 flex-1">

        <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Check-in
        </p>

        <p className="mt-0.5 text-[15px] font-semibold">
          {safeFormatDate(
            item.date,
            d => format(d, "MMM d"),
            item.date
          )}
        </p>

        <p className="mt-0.5 text-[12px] italic text-muted-foreground">
          {formatTime12(item.startTime, "—")}
        </p>

      </div>

      {/* Stay Progress */}

<div className="flex w-[72px] shrink-0 flex-col items-center justify-center">

  <div className="mb-2 h-px w-8 bg-border/60" />

  <p className="whitespace-nowrap text-[11px] font-medium italic text-violet-600">
    {item.endDate === currentDay
  ? "Check-out"
  : (() => {
      const night = Math.max(
        differenceInDays(
          safeParseDate(currentDay)!,
          safeParseDate(item.date)!
        ) + 1,
        1
      );

      const suffix =
        night % 10 === 1 && night % 100 !== 11
          ? "st"
          : night % 10 === 2 && night % 100 !== 12
          ? "nd"
          : night % 10 === 3 && night % 100 !== 13
          ? "rd"
          : "th";

      return `${night}${suffix} night`;
    })()}
  </p>

  {(() => {
                  const cd = safeParseDate(currentDay);
                  const sd = safeParseDate(item.date);
                  const total = stayNights(item.date, item.endDate ?? item.date);
                  if (!cd || !sd) return null;
                  const night = Math.min(Math.max(differenceInDays(cd, sd) + 1, 1), total);
                  return (
                    <div className="mt-2 flex items-center gap-1">
                      {Array.from({ length: Math.min(total, 7) }).map((_, n) => (
                        <span key={n} className={cn("h-1.5 w-1.5 rounded-full", n < night ? "bg-violet-500" : "bg-violet-200")} />
                      ))}
                    </div>
                  );
                })()}

</div>

      {/* Check Out */}

      <div className="min-w-0 flex-1 text-right">

        <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Check-out
        </p>

        <p className="mt-1 text-[15px] font-semibold">
          {item.endDate
            ? safeFormatDate(
                item.endDate,
                d => format(d, "MMM d"),
                item.endDate
              )
            : "—"}
        </p>

        <p className="mt-1 text-[12px] italic text-muted-foreground">
          {formatTime12(item.endTime, "—")}
        </p>

      </div>

    </div>

  </div>
</button>

{expanded && (
  <div className="border-t border-border/20">

    {/* Location */}

    {item.location && (
      <div className="border-b border-border/20 px-4 py-5">

        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Location
        </p>

        <div className="flex min-w-0 items-start gap-3">

          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

          <p className="min-w-0 break-words text-[14px] leading-6 text-foreground/90">
            {item.location}
          </p>

        </div>

      </div>
    )}

    {/* Cost */}

    {item.cost != null && item.cost > 0 && (
      <div className="border-b border-border/20 px-4 py-5">

        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Cost
        </p>

        <div className="w-full rounded-3xl border border-border/60 bg-muted/20 px-6 py-5">

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

        <div className="w-full rounded-3xl border border-border/60 bg-muted/20 px-6 py-4">

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
          "rounded-full px-3 py-1 text-xs font-semibold",
          ELEMENT_BADGES.accommodation
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
        className="h-full rounded-full bg-violet-500 transition"
        style={{
          width: `${
            totalChecklist
              ? (doneChecklist / totalChecklist) * 100
              : 0
          }%`,
        }}
      />

    </div>

    <div className="w-full space-y-2 rounded-3xl border border-border/60 bg-muted/20 p-5">

      {item.checklist.map((ci) => (

        <button
          key={ci.id}
          type="button"
          onClick={() => toggleChecklistItem(ci.id)}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/40"
        >

          {ci.done ? (

            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500">

              <Check className="h-3 w-3 text-white" />

            </div>

          ) : (

            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />

          )}

          <span
            className={cn(
              "text-[14px]",
              ci.done
                ? "text-muted-foreground line-through"
                : "text-foreground"
            )}
          >
            {ci.text}
          </span>

        </button>

      ))}

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

    <div className="space-y-5">

      {attachedDocs.map((doc) => (

        <div
          key={doc.id}
          className="flex w-full min-w-0 items-center gap-4 rounded-3xl border border-border bg-muted/20 px-6 py-4"
        >

          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              tintSurface(item.elementType)
            )}
          >
            <Paperclip className="h-4 w-4" />
          </div>

          <button
            type="button"
            onClick={() => openDoc(doc)}
            className="min-w-0 flex-1 text-left"
          >

            <p className="truncate text-[14px] font-medium">
              {doc.name}
            </p>

            <p className="mt-1 text-[11px] text-muted-foreground">
              Tap to open
            </p>

          </button>

          <button
            type="button"
            onClick={() => detachDoc(doc.id)}
            className="p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>

        </div>

      ))}

    </div>

  </div>

)}

{/* Actions */}

<div className="border-t border-border/20 px-5 py-5">

  <div className="flex justify-end gap-3">

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
)}

        </div>
      </div>
    </div>
  );
}
