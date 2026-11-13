import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Plus, Search, X, FileText, Clock } from "lucide-react";
import { useDocuments, useItinerary } from "@/hooks/use-store";
import { Trip, TripDocument, ItineraryItem } from "@/lib/types";
import { cn, getTripStatus, safeFormatDate } from "@/lib/utils";
import { FAB } from "@/components/ui";
import { DocGroup, kindOf, GROUP_OF_KIND, Entry, GROUPS } from "./documents/shared";
import { DocCard, SoonTile } from "./documents/cards";
import { PreviewSheet, EditDocSheet, AddDocSheet } from "./documents/sheets";

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
