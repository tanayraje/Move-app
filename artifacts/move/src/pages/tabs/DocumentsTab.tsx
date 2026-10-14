import React, { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import {
  Plus,
  Search,
  X,
  Plane,
  Building2,
  Ticket,
  ShieldCheck,
  Folder,
  FileText,
  FileImage,
  KeyRound,
  UtensilsCrossed,
  Link2,
  Clock,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Share2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useDocuments,
  useAddDocument,
  useDeleteDocument,
  useUpdateDocument,
  useItinerary,
} from "@/hooks/use-store";
import { Trip, TripDocument, DocumentCategory, ItineraryItem } from "@/lib/types";
import { generateId, cn, getTripStatus, safeFormatDate } from "@/lib/utils";
import { Button, Input, Label, Select, BottomSheet, FAB } from "@/components/ui";
import { PlaceCode, TICKET_MASK, TICKET_SHADOW, TRAVEL_META } from "@/components/TicketParts";

// ─── Kinds ────────────────────────────────────────────────────────────────────────────────────────
// A document takes its look (and colour) from the Timeline item it is attached to, so the colour code is
// the same everywhere: travel blue, stay violet, meal amber, activity / tickets teal.
// Documents with no link follow the type chosen at upload.

type Kind = "travel" | "stay" | "meal" | "activity" | "id" | "file";
type DocGroup = "transport" | "stay" | "id" | "tickets" | "other";

function kindOf(doc: TripDocument, link?: ItineraryItem): Kind {
  if (link) {
    if (link.elementType === "travel") return "travel";
    if (link.elementType === "accommodation") return "stay";
    if (link.elementType === "meal") return "meal";
    if (link.elementType === "activity") return "activity";
  }
  switch (doc.category) {
    case "flight":
      return "travel";
    case "hotel":
      return "stay";
    case "visa":
      return "id";
    case "ticket":
    case "activity":
      return "activity";
    default:
      return "file";
  }
}

const GROUP_OF_KIND: Record<Kind, DocGroup> = {
  travel: "transport",
  stay: "stay",
  id: "id",
  activity: "tickets",
  meal: "other",
  file: "other",
};

interface Entry {
  doc: TripDocument;
  link?: ItineraryItem;
  kind: Kind;
  group: DocGroup;
}

const GROUPS: { id: DocGroup; label: string; icon: any }[] = [
  { id: "transport", label: "Transport", icon: Plane },
  { id: "stay", label: "Stays", icon: Building2 },
  { id: "id", label: "Visa and ID", icon: ShieldCheck },
  { id: "tickets", label: "Tickets", icon: Ticket },
  { id: "other", label: "Other", icon: Folder },
];

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: "flight", label: "Transport (flight, train, bus)" },
  { value: "hotel", label: "Stay (hotel, rental)" },
  { value: "visa", label: "Visa and ID" },
  { value: "ticket", label: "Ticket or pass" },
  { value: "activity", label: "Activity booking" },
  { value: "other", label: "Other" },
];

// ─── Small helpers ───────────────────────────────────────────────────────────────────────────────

function guessCategory(fileName: string): DocumentCategory {
  const n = fileName.toLowerCase();
  if (/(passport|visa|aadhaar|aadhar|id[-_ ]?card|permit|licen[cs]e)/.test(n)) return "visa";
  if (/(flight|boarding|airline|irctc|train|bus|pnr|cab|metro|e-?ticket)/.test(n)) return "flight";
  if (/(hotel|booking|resort|hostel|airbnb|reservation|check-?in|voucher|stay)/.test(n)) return "hotel";
  if (/(ticket|pass|entry|museum|show|event|tour|admission)/.test(n)) return "ticket";
  return "other";
}

const cleanName = (fileName: string) =>
  fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

const isImage = (doc: TripDocument) => (doc.fileType || "").startsWith("image/");
const kindLabel = (doc: TripDocument) => (isImage(doc) ? "Image" : (doc.fileType || "").includes("pdf") ? "PDF" : "File");

const sizeLabel = (bytes?: number) =>
  typeof bytes !== "number"
    ? ""
    : bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const addedLabel = (doc: TripDocument) => {
  if (!doc.createdAt) return "";
  const d = new Date(doc.createdAt);
  return isNaN(d.getTime()) ? "" : format(d, "MMM d");
};

const dateLabel = (date?: string) => safeFormatDate(date ?? "", d => format(d, "MMM d"), date ?? "");

// ─── Page ────────────────────────────────────────────────────────────────────────────────────────

export default function DocumentsTab({ trip }: { trip: Trip }) {
  const { data: docs = [], isLoading } = useDocuments(trip.id);
  const { data: items = [] } = useItinerary(trip.id);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editDoc, setEditDoc] = useState<TripDocument | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<DocGroup | "all">("all");
  const [view, setView] = useState<"type" | "date">("type");

  // Which timeline item(s) each document is attached to (existing data, nothing new stored)
  const linkOf = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const byDoc = new Map<string, ItineraryItem[]>();
    items.forEach(it => (it.attachedDocIds || []).forEach((id: string) => byDoc.set(id, [...(byDoc.get(id) || []), it])));
    const pick = new Map<string, ItineraryItem>();
    byDoc.forEach((list, id) => {
      const sorted = [...list].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
      pick.set(id, sorted.find(i => i.date >= today) ?? sorted[0]);
    });
    return pick;
  }, [items]);

  const entries: Entry[] = useMemo(
    () =>
      docs.map(doc => {
        const link = linkOf.get(doc.id);
        const kind = kindOf(doc, link);
        return { doc, link, kind, group: GROUP_OF_KIND[kind] };
      }),
    [docs, linkOf]
  );

  const q = query.trim().toLowerCase();
  const visible = entries.filter(e => {
    if (group !== "all" && e.group !== group) return false;
    if (!q) return true;
    return [e.doc.name, e.doc.fileName, e.doc.notes, e.link?.title].some(v => (v || "").toLowerCase().includes(q));
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    entries.forEach(e => (c[e.group] = (c[e.group] || 0) + 1));
    return c;
  }, [entries]);

  // Needed soon: documents attached to something happening today or tomorrow
  const soon = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    return entries
      .filter(e => e.link && (e.link.date === today || e.link.date === tomorrow))
      .sort((a, b) => `${a.link!.date}${a.link!.startTime}`.localeCompare(`${b.link!.date}${b.link!.startTime}`));
  }, [entries]);

  const sections = useMemo(() => {
    if (group !== "all" || q) return [{ key: "flat", title: "", entries: visible }];
    if (view === "type") {
      return GROUPS.map(g => ({
        key: g.id,
        title: g.label,
        entries: visible.filter(e => e.group === g.id),
      })).filter(sec => sec.entries.length > 0);
    }
    const dated = new Map<string, Entry[]>();
    const unlinked: Entry[] = [];
    visible.forEach(e => {
      if (!e.link) unlinked.push(e);
      else dated.set(e.link.date, [...(dated.get(e.link.date) || []), e]);
    });
    const out = Array.from(dated.keys())
      .sort()
      .map(date => ({
        key: date,
        title: safeFormatDate(date, d => format(d, "EEEE, MMM d"), date),
        entries: dated.get(date)!,
      }));
    if (unlinked.length) out.push({ key: "none", title: "Not linked to the timeline", entries: unlinked });
    return out;
  }, [visible, group, q, view]);

  const open = entries.find(e => e.doc.id === openId) ?? null;
  const readOnly = getTripStatus(trip) === "archived";

  return (
    <div className="relative px-4 pb-40 pt-2">
      <div className="mb-4 flex items-end justify-between px-1">
        <h2 className="font-display text-[28px] font-bold leading-none tracking-tight">Documents</h2>
        <span className="text-sm text-muted-foreground">
          {docs.length} {docs.length === 1 ? "file" : "files"}
        </span>
      </div>

      {docs.length > 0 && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, note or booking"
              className="h-12 w-full rounded-2xl bg-card pl-11 pr-10 text-[15px] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_6px_16px_-6px_rgba(15,23,42,0.1)] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
            />
            {query && (
              <button
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Type filter */}
          <div className="-mx-4 -mb-3 mt-3 overflow-x-auto px-4 pb-6 no-scrollbar">
            <div className="flex min-w-max gap-2">
              {[{ id: "all" as const, label: "All" }, ...GROUPS.filter(g => counts[g.id])].map(g => {
                const active = group === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setGroup(g.id)}
                    className={cn(
                      "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold outline-none transition-colors focus:outline-none",
                      active
                        ? "bg-primary text-primary-foreground shadow-[0_8px_16px_-6px_hsl(var(--primary)/0.55)] dark:shadow-none"
                        : "bg-card text-foreground/80 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_10px_-4px_rgba(15,23,42,0.1)]"
                    )}
                  >
                    {g.label}
                    <span className={cn("text-[12px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {counts[g.id] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Needed soon */}
          {!q && group === "all" && soon.length > 0 && (
            <div className="mt-6">
              <p className="mb-2.5 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Needed soon
              </p>
              <div className="-mx-4 -mb-3 overflow-x-auto px-4 pb-6 no-scrollbar">
                <div className="flex min-w-max gap-3">
                  {soon.map(entry => (
                    <SoonTile key={entry.doc.id} entry={entry} onOpen={() => setOpenId(entry.doc.id)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Grouping */}
          {group === "all" && !q && docs.length > 1 && (
            <div className="mt-5 flex items-center justify-end">
              <div className="flex rounded-full bg-muted p-0.5 text-[12px] font-semibold">
                {(["type", "date"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 transition-colors",
                      view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    {v === "type" ? "By type" : "By date"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Content */}
      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[120px] animate-pulse rounded-[22px] bg-muted" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="mt-16 flex flex-col items-center px-8 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary/10 text-primary">
              <FileText className="h-9 w-9" />
            </div>
            <h3 className="font-display text-xl font-bold">No documents yet</h3>
            <p className="mt-1.5 max-w-[260px] text-[15px] text-muted-foreground">
              Add tickets, hotel bookings, visas and IDs so everyone on the trip can find them.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-12 text-center text-muted-foreground">
            <p className="font-medium text-foreground">No matches</p>
            <p className="mt-1 text-sm">Try a different word or clear the filter.</p>
          </div>
        ) : (
          <div className="space-y-7">
            {sections.map(section => (
              <section key={section.key}>
                {section.title && (
                  <h3 className="mb-3 flex items-center justify-between px-1 text-[13px] font-semibold text-muted-foreground">
                    <span>{section.title}</span>
                    <span className="font-normal">{section.entries.length}</span>
                  </h3>
                )}
                <div className="space-y-5">
                  {section.entries.map(entry => (
                    <DocCard key={entry.doc.id} entry={entry} onOpen={() => setOpenId(entry.doc.id)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {!readOnly && <FAB icon={Plus} label="Upload document" onClick={() => setIsAddOpen(true)} />}
      <AddDocSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} tripId={trip.id} />
      <PreviewSheet
        entry={open}
        readOnly={readOnly}
        onClose={() => setOpenId(null)}
        onEdit={d => {
          setOpenId(null);
          setEditDoc(d);
        }}
      />
      <EditDocSheet doc={editDoc} onClose={() => setEditDoc(null)} />
    </div>
  );
}

// ─── Cards: the same shapes as the Timeline (boarding pass, key card, receipt, ticket) ──────────────

const ZIGZAG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='8' viewBox='0 0 16 8'%3E%3Cpath d='M0 0h16L8 8z'/%3E%3C/svg%3E")`;
const RECEIPT_MASK = `linear-gradient(#000, #000) top / 100% calc(100% - 7px) no-repeat, ${ZIGZAG} bottom / 16px 8px repeat-x`;

function Meta({ doc, className }: { doc: TripDocument; className?: string }) {
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

function Linked({ link, className }: { link?: ItineraryItem; className?: string }) {
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

function DocCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
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
function BoardingPass({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
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
                {travel.startTime && <span className="text-[12px] text-blue-900/70">{travel.startTime}</span>}
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
function TicketCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
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
                {link.startTime && <span className="text-[12px] text-teal-900/70">{link.startTime}</span>}
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

function StayCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
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
function ReceiptCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
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

function PassportCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
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

function FileCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
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

function SoonTile({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
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
          {link?.startTime ? `, ${link.startTime}` : ""}
        </span>
      </span>
    </button>
  );
}

// ─── Preview ─────────────────────────────────────────────────────────────────────────────────────

function PreviewSheet({
  entry,
  readOnly,
  onClose,
  onEdit,
}: {
  entry: Entry | null;
  readOnly: boolean;
  onClose: () => void;
  onEdit: (d: TripDocument) => void;
}) {
  const doc = entry?.doc ?? null;
  const link = entry?.link;
  const { mutate: deleteDoc, isPending } = useDeleteDocument();
  const [confirming, setConfirming] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [shared, setShared] = useState(false);

  const close = () => {
    setConfirming(false);
    setImgFailed(false);
    setShared(false);
    onClose();
  };

  const share = async () => {
    if (!doc?.file_url) return;
    try {
      if (navigator.share) await navigator.share({ title: doc.name, url: doc.file_url });
      else {
        await navigator.clipboard.writeText(doc.file_url);
        setShared(true);
      }
    } catch {
      /* cancelled */
    }
  };

  const g = entry ? GROUPS.find(x => x.id === entry.group) : undefined;
  const rows: [string, string][] = doc
    ? ([
        ["Type", g?.label ?? "Other"],
        ["Linked to", link ? `${link.title}, ${dateLabel(link.date)}` : ""],
        ["Notes", doc.notes || ""],
        ["File", [kindLabel(doc), sizeLabel(doc.fileSize)].filter(Boolean).join(", ")],
        ["Added", addedLabel(doc)],
      ] as [string, string][]).filter(r => r[1])
    : [];

  return (
    <BottomSheet isOpen={!!doc} onClose={close} title={doc?.name ?? "Document"}>
      {doc && (
        <div className="flex flex-col gap-4 [&>*]:min-w-0">
          <div className="flex min-h-[160px] items-center justify-center overflow-hidden rounded-2xl bg-muted">
            {isImage(doc) && !imgFailed ? (
              <img
                src={doc.file_url}
                alt={doc.name}
                onError={() => setImgFailed(true)}
                className="max-h-[48dvh] w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                {isImage(doc) ? <FileImage className="h-12 w-12" /> : <FileText className="h-12 w-12" />}
                <span className="text-sm font-medium">{kindLabel(doc)} document</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <a
              href={doc.file_url}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground"
            >
              <ExternalLink className="h-[18px] w-[18px]" />
              Open
            </a>
            <button
              onClick={share}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-card text-[15px] font-semibold ring-1 ring-border"
            >
              <Share2 className="h-[18px] w-[18px]" />
              {shared ? "Link copied" : "Share"}
            </button>
          </div>

          {rows.length > 0 && (
            <dl className="divide-y divide-border/60 rounded-2xl bg-card px-4 ring-1 ring-border">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 py-3 text-sm">
                  <dt className="shrink-0 text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 break-words text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {!readOnly &&
            (confirming ? (
              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">Delete this document for everyone on the trip?</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    className="h-11 flex-1 rounded-xl bg-card text-sm font-semibold ring-1 ring-border"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => deleteDoc({ id: doc.id, tripId: doc.tripId }, { onSuccess: close })}
                    className="h-11 flex-1 rounded-xl bg-[#dc2626] dark:bg-[#dc2626]/85 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isPending ? "Deleting" : "Delete"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(doc)}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-card text-[15px] font-semibold ring-1 ring-border"
                >
                  <Pencil className="h-4 w-4" />
                  Edit details
                </button>
                <button
                  onClick={() => setConfirming(true)}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-card text-[15px] font-semibold text-red-600 ring-1 ring-border"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            ))}
        </div>
      )}
    </BottomSheet>
  );
}

// ─── Edit ────────────────────────────────────────────────────────────────────────────────────────

const textarea =
  "flex min-h-[96px] w-full min-w-0 rounded-xl border-2 border-border bg-card px-4 py-3 text-base focus:border-primary focus:outline-none";

function EditDocSheet({ doc, onClose }: { doc: TripDocument | null; onClose: () => void }) {
  const { mutateAsync: update, isPending } = useUpdateDocument();
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!doc) return;
    const fd = new FormData(e.currentTarget);
    setError("");
    try {
      await update({
        id: doc.id,
        tripId: doc.tripId,
        name: ((fd.get("name") as string) || doc.name).trim(),
        category: fd.get("category") as string,
        notes: (fd.get("notes") as string) || "",
      });
      onClose();
    } catch {
      setError("Could not save changes. Your database may not allow editing documents yet.");
    }
  };

  return (
    <BottomSheet isOpen={!!doc} onClose={onClose} title="Edit document">
      {doc && (
        <form key={doc.id} onSubmit={submit} className="flex flex-col gap-4 [&>*]:min-w-0">
          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" name="name" required defaultValue={doc.name} />
          </div>
          <div>
            <Label htmlFor="edit-category">Type</Label>
            <Select id="edit-category" name="category" defaultValue={doc.category}>
              {CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="edit-notes">Notes</Label>
            <textarea id="edit-notes" name="notes" defaultValue={doc.notes || ""} className={textarea} placeholder="Booking reference, seat, anything useful" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" size="lg" isLoading={isPending}>
            Save changes
          </Button>
        </form>
      )}
    </BottomSheet>
  );
}

// ─── Upload (several files at once, type guessed from the file name) ─────────────────────────────

interface UploadRow {
  id: string;
  file: File;
  name: string;
  category: DocumentCategory;
}

function AddDocSheet({ isOpen, onClose, tripId }: { isOpen: boolean; onClose: () => void; tripId: string }) {
  const { mutateAsync: addDoc } = useAddDocument();
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState("");
  const busy = progress !== "";

  const pick = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map(file => ({
      id: generateId(),
      file,
      name: cleanName(file.name),
      category: guessCategory(file.name),
    }));
    setRows(r => [...r, ...next]);
  };
  const patch = (id: string, p: Partial<UploadRow>) => setRows(r => r.map(x => (x.id === id ? { ...x, ...p } : x)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) return;
    setError("");
    const failed: UploadRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setProgress(`Uploading ${i + 1} of ${rows.length}`);
      try {
        await addDoc({
          id: generateId(),
          tripId,
          name: row.name.trim() || row.file.name,
          category: row.category,
          notes: "",
          fileName: row.file.name,
          fileType: row.file.type,
          fileSize: row.file.size,
          blob: row.file,
          createdAt: Date.now(),
        });
      } catch {
        failed.push(row);
      }
    }
    setProgress("");
    setRows(failed);
    if (failed.length) setError(`${failed.length} file${failed.length > 1 ? "s" : ""} could not be uploaded. Try again.`);
    else onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add documents">
      <form onSubmit={submit} className="flex flex-col gap-4 [&>*]:min-w-0">
        <label className="flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 text-center transition-colors hover:bg-primary/10">
          <Upload className="mb-2 h-7 w-7 text-primary" />
          <span className="text-sm font-medium">{rows.length ? "Add more files" : "Tap to choose files"}</span>
          <span className="text-xs text-muted-foreground">PDF or images, several at once</span>
          <input
            type="file"
            multiple
            className="hidden"
            accept="application/pdf,image/*"
            onChange={e => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {rows.length > 0 && (
          <div className="space-y-3">
            {rows.map(row => (
              <div key={row.id} className="rounded-2xl bg-card p-3 ring-1 ring-border">
                <div className="flex items-center gap-2">
                  <Input
                    value={row.name}
                    onChange={e => patch(row.id, { name: e.target.value })}
                    className="h-11 flex-1 text-[15px]"
                    aria-label="Document name"
                  />
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={() => setRows(r => r.filter(x => x.id !== row.id))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Select
                  value={row.category}
                  onChange={e => patch(row.id, { category: e.target.value as DocumentCategory })}
                  className="mt-2 h-11 text-[15px]"
                  aria-label="Document type"
                >
                  {CATEGORY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 truncate text-[11.5px] text-muted-foreground">
                  {row.file.name}, {sizeLabel(row.file.size)}
                </p>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" size="lg" disabled={rows.length === 0 || busy} isLoading={busy}>
          {busy ? progress : rows.length > 1 ? `Upload ${rows.length} files` : "Upload"}
        </Button>
      </form>
    </BottomSheet>
  );
}
