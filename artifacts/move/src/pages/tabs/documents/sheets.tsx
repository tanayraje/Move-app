import React, { useState } from "react";
import { X, FileText, FileImage, ExternalLink, Share2, Pencil, Trash2, Upload } from "lucide-react";
import { useAddDocument, useDeleteDocument, useUpdateDocument } from "@/hooks/use-store";
import { TripDocument, DocumentCategory } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { Button, Input, Label, Select, BottomSheet } from "@/components/ui";
import {
  Entry,
  GROUPS,
  CATEGORY_OPTIONS,
  guessCategory,
  cleanName,
  isImage,
  kindLabel,
  sizeLabel,
  addedLabel,
  dateLabel,
} from "./shared";

// ─── Preview ─────────────────────────────────────────────────────────────────────────────────────

export function PreviewSheet({
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

export const textarea =
  "flex min-h-[96px] w-full min-w-0 rounded-xl border-2 border-border bg-card px-4 py-3 text-base focus:border-primary focus:outline-none";

export function EditDocSheet({ doc, onClose }: { doc: TripDocument | null; onClose: () => void }) {
  const { mutateAsync: update, isPending } = useUpdateDocument({ quiet: true });
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

export interface UploadRow {
  id: string;
  file: File;
  name: string;
  category: DocumentCategory;
}

export function AddDocSheet({ isOpen, onClose, tripId }: { isOpen: boolean; onClose: () => void; tripId: string }) {
  const { mutateAsync: addDoc } = useAddDocument({ quiet: true });
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
