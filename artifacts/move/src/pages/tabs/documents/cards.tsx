import React from "react";
import { format } from "date-fns";
import { formatTime12 } from "@/lib/time";
import {
  Building2,
  Ticket,
  ShieldCheck,
  FileText,
  FileImage,
  KeyRound,
  UtensilsCrossed,
  Link2,
  ChevronRight,
} from "lucide-react";
import { TripDocument, ItineraryItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PlaceCode, TICKET_MASK, TICKET_SHADOW, TRAVEL_META } from "@/components/TicketParts";
import { Kind, Entry, isImage, kindLabel, sizeLabel, addedLabel, dateLabel } from "./shared";

// ─── Cards: the same shapes as the Timeline (boarding pass, key card, receipt, ticket) ──────────────

export const ZIGZAG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='8' viewBox='0 0 16 8'%3E%3Cpath d='M0 0h16L8 8z'/%3E%3C/svg%3E")`;
export const RECEIPT_MASK = `linear-gradient(#000, #000) top / 100% calc(100% - 7px) no-repeat, ${ZIGZAG} bottom / 16px 8px repeat-x`;

export function Meta({ doc, className }: { doc: TripDocument; className?: string }) {
  const parts = [kindLabel(doc), sizeLabel(doc.fileSize), addedLabel(doc) && `Added ${addedLabel(doc)}`].filter(Boolean);
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 text-[11.5px]", className)}>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="h-[3px] w-[3px] rounded-full bg-current opacity-50" />}
          <span>{p}</span>
        </React.Fragment>
      ))}
    </p>
  );
}

export function Linked({ link, className }: { link?: ItineraryItem; className?: string }) {
  if (!link) return null;
  return (
    <p className={cn("mt-2 flex min-w-0 items-center gap-1.5 text-[12px]", className)}>
      <Link2 className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {link.title}, {dateLabel(link.date)}
      </span>
    </p>
  );
}

export function DocCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  switch (entry.kind) {
    case "travel":
      return <BoardingPass entry={entry} onOpen={onOpen} />;
    case "activity":
      return <TicketCard entry={entry} onOpen={onOpen} />;
    case "stay":
      return <StayCard entry={entry} onOpen={onOpen} />;
    case "meal":
      return <ReceiptCard entry={entry} onOpen={onOpen} />;
    case "id":
      return <PassportCard entry={entry} onOpen={onOpen} />;
    default:
      return <FileCard entry={entry} onOpen={onOpen} />;
  }
}

/** Travel: identical to the Timeline boarding pass, with the document attached to it */
export function BoardingPass({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const { doc, link } = entry;
  const travel = link?.elementType === "travel" ? link : undefined;
  const meta = TRAVEL_META[travel?.travelType ?? "flight"];
  const Icon = meta.icon;
  const hasRoute = !!(travel?.fromLocation && travel?.toLocation);

  return (
    <button onClick={onOpen} className="block w-full text-left" style={{ filter: TICKET_SHADOW }}>
      <div className="relative overflow-hidden rounded-[22px] bg-blue-50" style={{ WebkitMask: TICKET_MASK, mask: TICKET_MASK }}>
        <span aria-hidden className="absolute bottom-4 left-[68%] top-4 border-l-[1.5px] border-dashed border-blue-300" />
        <div className="grid grid-cols-[68%_32%]">
          <div className="min-w-0 px-4 py-4">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
              <Icon className="h-3.5 w-3.5" />
              <span>{travel ? meta.label : "Transport"}</span>
            </div>
            {hasRoute ? (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <PlaceCode place={travel!.fromLocation} />
                  <div className="flex min-w-[20px] flex-1 items-center">
                    <div className="flex-1 border-t-[1.5px] border-dashed border-blue-300" />
                    <Icon className="mx-1.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <div className="flex-1 border-t-[1.5px] border-dashed border-blue-300" />
                  </div>
                  <PlaceCode place={travel!.toLocation} right />
                </div>
                <p className="mt-3 flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-blue-900/75">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{doc.name}</span>
                </p>
              </>
            ) : (
              <h4 className="mt-2 line-clamp-2 break-words text-[17px] font-semibold leading-snug text-blue-950">{doc.name}</h4>
            )}
            <Meta doc={doc} className="mt-1.5 text-blue-900/55" />
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center gap-1 bg-blue-100/60 px-2 py-4 text-center">
            {travel ? (
              <>
                <span className="font-display text-[18px] font-bold leading-none text-blue-950">{dateLabel(travel.date)}</span>
                {travel.startTime && <span className="text-[12px] text-blue-900/70">{formatTime12(travel.startTime)}</span>}
              </>
            ) : (
              <span className="font-display text-[18px] font-bold leading-none text-blue-950">{kindLabel(doc)}</span>
            )}
            <ChevronRight className="mt-1 h-4 w-4 text-blue-900/40" />
          </div>
        </div>
      </div>
    </button>
  );
}

/** Activity tickets: the same ticket shape as the boarding pass, in the activity colour (teal) */
export function TicketCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const { doc, link } = entry;
  return (
    <button onClick={onOpen} className="block w-full text-left" style={{ filter: TICKET_SHADOW }}>
      <div className="relative overflow-hidden rounded-[22px] bg-teal-50" style={{ WebkitMask: TICKET_MASK, mask: TICKET_MASK }}>
        <span aria-hidden className="absolute bottom-4 left-[68%] top-4 border-l-[1.5px] border-dashed border-teal-300" />
        <div className="grid grid-cols-[68%_32%]">
          <div className="min-w-0 px-4 py-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-700">
              <Ticket className="h-3.5 w-3.5" />
              Ticket
            </p>
            <h4 className="mt-2 line-clamp-2 break-words text-[17px] font-semibold leading-snug text-teal-950">{doc.name}</h4>
            {link && link.title !== doc.name && <Linked link={link} className="text-teal-900/70" />}
            <Meta doc={doc} className="mt-2 text-teal-900/55" />
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center gap-1 bg-teal-100/60 px-2 py-4 text-center">
            {link ? (
              <>
                <span className="font-display text-[18px] font-bold leading-none text-teal-950">{dateLabel(link.date)}</span>
                {link.startTime && <span className="text-[12px] text-teal-900/70">{formatTime12(link.startTime)}</span>}
              </>
            ) : (
              <span className="font-display text-[18px] font-bold leading-none text-teal-950">{kindLabel(doc)}</span>
            )}
            <ChevronRight className="mt-1 h-4 w-4 text-teal-900/40" />
          </div>
        </div>
      </div>
    </button>
  );
}

export function StayCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const { doc, link } = entry;
  return (
    <button
      onClick={onOpen}
      className="mb-3 block w-full rounded-[24px] bg-violet-50 p-4 text-left ring-1 ring-violet-200/80 shadow-[0_5px_0_-1px_#E9E3FD,0_10px_0_-2px_#F2EEFE] dark:shadow-[0_5px_0_-1px_#362d58,0_10px_0_-2px_#202431]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#7c3aed] text-white dark:bg-[#7c3aed]/80">
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-violet-700">Stay</p>
          <h4 className="line-clamp-2 break-words text-[17px] font-semibold leading-snug text-violet-950">{doc.name}</h4>
        </div>
        <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-violet-900/40" />
      </div>
      {link?.elementType === "accommodation" && (
        <p className="mt-3 text-[12.5px] font-medium text-violet-900/75">
          {dateLabel(link.date)}
          {link.endDate ? ` to ${dateLabel(link.endDate)}` : ""}
        </p>
      )}
      <Linked link={link?.elementType === "accommodation" ? undefined : link} className="text-violet-900/70" />
      <Meta doc={doc} className="mt-2.5 text-violet-900/55" />
    </button>
  );
}

/** Meals: the Timeline receipt with its torn edge, in amber */
export function ReceiptCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const { doc, link } = entry;
  return (
    <button onClick={onOpen} className="block w-full text-left" style={{ filter: TICKET_SHADOW }}>
      <div className="rounded-t-[26px] bg-amber-50 px-4 pb-4 pt-3.5" style={{ WebkitMask: RECEIPT_MASK, mask: RECEIPT_MASK }}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <UtensilsCrossed className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-amber-700">Meal</p>
            <h4 className="line-clamp-2 break-words text-[16px] font-semibold leading-snug text-amber-950">{doc.name}</h4>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-amber-900/40" />
        </div>
        <Linked link={link} className="text-amber-900/70" />
        <Meta doc={doc} className="mt-2 text-amber-900/55" />
      </div>
    </button>
  );
}

export function PassportCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const { doc, link } = entry;
  return (
    <button
      onClick={onOpen}
      className="relative block w-full overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0F2A5C] to-[#1B3F82] text-left text-white shadow-[0_14px_28px_-10px_rgba(15,42,92,0.55)] ring-1 ring-inset ring-white/15"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-3 bg-black/20" />
      <ShieldCheck aria-hidden className="absolute -right-5 -top-5 h-36 w-36 text-white/[0.07]" />
      <div className="relative py-4 pl-7 pr-5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/70">
          <ShieldCheck className="h-3.5 w-3.5" />
          Visa and ID
        </p>
        <h4 className="mt-2 line-clamp-2 break-words text-[18px] font-semibold leading-snug">{doc.name}</h4>
        {doc.notes && <p className="mt-1 line-clamp-1 text-[12.5px] text-white/70">{doc.notes}</p>}
        <Linked link={link} className="text-white/70" />
        <Meta doc={doc} className="mt-3 text-white/55" />
      </div>
    </button>
  );
}

export function FileCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const { doc, link } = entry;
  const Icon = isImage(doc) ? FileImage : FileText;
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3.5 rounded-[22px] bg-card p-3.5 text-left ring-1 ring-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-8px_rgba(15,23,42,0.12)]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-slate-600">
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 break-words text-[16px] font-semibold leading-snug">{doc.name}</h4>
        <Linked link={link} className="text-muted-foreground" />
        <Meta doc={doc} className="mt-1.5 text-muted-foreground" />
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    </button>
  );
}

export function SoonTile({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const { doc, link, kind } = entry;
  const tone: Record<Kind, string> = {
    travel: "bg-blue-50 text-blue-600",
    stay: "bg-violet-50 text-violet-600",
    meal: "bg-amber-50 text-amber-600",
    activity: "bg-teal-50 text-teal-600",
    id: "bg-slate-100 text-[#1B3F82] dark:text-blue-300",
    file: "bg-muted text-slate-600",
  };
  const icon: Record<Kind, any> = {
    travel: TRAVEL_META[link?.travelType ?? "flight"].icon,
    stay: Building2,
    meal: UtensilsCrossed,
    activity: Ticket,
    id: ShieldCheck,
    file: FileText,
  };
  const Icon = icon[kind];
  const today = format(new Date(), "yyyy-MM-dd");
  return (
    <button
      onClick={onOpen}
      className="flex w-[240px] items-center gap-3 rounded-[22px] bg-card p-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_-8px_rgba(15,23,42,0.14)]"
    >
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", tone[kind])}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] font-semibold">{doc.name}</span>
        <span className="block truncate text-[12px] text-muted-foreground">
          {link?.date === today ? "Today" : "Tomorrow"}
          {link?.startTime ? `, ${formatTime12(link.startTime)}` : ""}
        </span>
      </span>
    </button>
  );
}
