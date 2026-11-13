import { format } from "date-fns";
import { Plane, Building2, Ticket, ShieldCheck, Folder } from "lucide-react";
import { TripDocument, DocumentCategory, ItineraryItem } from "@/lib/types";
import { safeFormatDate } from "@/lib/utils";

// ─── Kinds ────────────────────────────────────────────────────────────────────────────────────────
// A document takes its look (and colour) from the Timeline item it is attached to, so the colour code is
// the same everywhere: travel blue, stay violet, meal amber, activity / tickets teal.
// Documents with no link follow the type chosen at upload.

export type Kind = "travel" | "stay" | "meal" | "activity" | "id" | "file";
export type DocGroup = "transport" | "stay" | "id" | "tickets" | "other";

export function kindOf(doc: TripDocument, link?: ItineraryItem): Kind {
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

export const GROUP_OF_KIND: Record<Kind, DocGroup> = {
  travel: "transport",
  stay: "stay",
  id: "id",
  activity: "tickets",
  meal: "other",
  file: "other",
};

export interface Entry {
  doc: TripDocument;
  link?: ItineraryItem;
  kind: Kind;
  group: DocGroup;
}

export const GROUPS: { id: DocGroup; label: string; icon: any }[] = [
  { id: "transport", label: "Transport", icon: Plane },
  { id: "stay", label: "Stays", icon: Building2 },
  { id: "id", label: "Visa and ID", icon: ShieldCheck },
  { id: "tickets", label: "Tickets", icon: Ticket },
  { id: "other", label: "Other", icon: Folder },
];

export const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: "flight", label: "Transport (flight, train, bus)" },
  { value: "hotel", label: "Stay (hotel, rental)" },
  { value: "visa", label: "Visa and ID" },
  { value: "ticket", label: "Ticket or pass" },
  { value: "activity", label: "Activity booking" },
  { value: "other", label: "Other" },
];

// ─── Small helpers ───────────────────────────────────────────────────────────────────────────────

export function guessCategory(fileName: string): DocumentCategory {
  const n = fileName.toLowerCase();
  if (/(passport|visa|aadhaar|aadhar|id[-_ ]?card|permit|licen[cs]e)/.test(n)) return "visa";
  if (/(flight|boarding|airline|irctc|train|bus|pnr|cab|metro|e-?ticket)/.test(n)) return "flight";
  if (/(hotel|booking|resort|hostel|airbnb|reservation|check-?in|voucher|stay)/.test(n)) return "hotel";
  if (/(ticket|pass|entry|museum|show|event|tour|admission)/.test(n)) return "ticket";
  return "other";
}

export const cleanName = (fileName: string) =>
  fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

export const isImage = (doc: TripDocument) => (doc.fileType || "").startsWith("image/");
export const kindLabel = (doc: TripDocument) => (isImage(doc) ? "Image" : (doc.fileType || "").includes("pdf") ? "PDF" : "File");

export const sizeLabel = (bytes?: number) =>
  typeof bytes !== "number"
    ? ""
    : bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const addedLabel = (doc: TripDocument) => {
  if (!doc.createdAt) return "";
  const d = new Date(doc.createdAt);
  return isNaN(d.getTime()) ? "" : format(d, "MMM d");
};

export const dateLabel = (date?: string) => safeFormatDate(date ?? "", d => format(d, "MMM d"), date ?? "");
