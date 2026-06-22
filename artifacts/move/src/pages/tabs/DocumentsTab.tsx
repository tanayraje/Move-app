import React, { useState } from "react";
import { Plus, FileText, Image as ImageIcon, Trash2, Download, Plane, Hotel } from "lucide-react";
import { useDocuments, useAddDocument, useDeleteDocument } from "@/hooks/use-store";
import { Trip, TripDocument, DocumentCategory } from "@/lib/types";
import { generateId, cn, getTripStatus } from "@/lib/utils";
import { Button, Input, Label, Select, BottomSheet, FAB } from "@/components/ui";

const DOC_ICONS: Record<DocumentCategory, any> = {
  flight: Plane,
  hotel: Hotel,
  visa: FileText,
  ticket: FileText,
  activity: FileText,
  other: FileText,
};

export default function DocumentsTab({ trip }: { trip: Trip }) {
  const { data: docs = [], isLoading } = useDocuments(trip.id);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const openDoc = (doc: TripDocument) => {
    const url = URL.createObjectURL(doc.blob);
    window.open(url, '_blank');
  };

  return (
    <div className="p-6 h-full relative">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">Travel Documents</h2>
        <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold">{docs.length} saved</span>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center text-muted-foreground mt-20">
           <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 opacity-50" />
            </div>
          <p>No documents uploaded.</p>
          <p className="text-sm mt-1">Keep your tickets and bookings handy offline.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {docs.map(doc => (
            <DocCard key={doc.id} doc={doc} onOpen={() => openDoc(doc)} />
          ))}
        </div>
      )}

      {getTripStatus(trip) !== 'archived' && <FAB icon={Plus} onClick={() => setIsAddOpen(true)} />}
      <AddDocSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} tripId={trip.id} />
    </div>
  );
}

function DocCard({ doc, onOpen }: { doc: TripDocument, onOpen: () => void }) {
  const { mutate: deleteDoc } = useDeleteDocument();
  const Icon = DOC_ICONS[doc.category] || FileText;

  return (
    <div 
      onClick={onOpen}
      className="bg-card p-4 rounded-2xl shadow-sm border border-border flex items-center gap-4 active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-foreground truncate">{doc.name}</h4>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
          <span className="uppercase tracking-wider">{doc.category}</span>
          <span>•</span>
          <span>{(doc.fileSize / 1024 / 1024).toFixed(1)} MB</span>
        </div>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); if(confirm('Delete document?')) deleteDoc({ id: doc.id, tripId: doc.tripId }); }}
        className="p-2 -mr-2 text-muted-foreground hover:text-red-500 transition-colors"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}

function AddDocSheet({ isOpen, onClose, tripId }: { isOpen: boolean, onClose: () => void, tripId: string }) {
  const { mutateAsync: addDoc, isPending } = useAddDocument();
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return alert('Please select a file');

    const fd = new FormData(e.currentTarget);
    
    await addDoc({
      id: generateId(),
      tripId,
      name: fd.get('name') as string || file.name,
      category: fd.get('category') as DocumentCategory,
      notes: fd.get('notes') as string,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      blob: file,
      createdAt: Date.now()
    });
    setFile(null);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Upload Document">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label>Select File (PDF, Image)</Label>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary/40 rounded-xl cursor-pointer bg-primary/5 hover:bg-primary/10 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Download className="w-8 h-8 text-primary mb-2" />
              <p className="text-sm text-foreground font-medium">{file ? file.name : "Tap to select file"}</p>
            </div>
            <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>

        <div>
          <Label htmlFor="name">Display Name</Label>
          <Input id="name" name="name" placeholder="e.g. Return Flight Ticket" required defaultValue={file?.name || ''} />
        </div>
        
        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" required defaultValue="ticket">
            <option value="flight">Flight</option>
            <option value="hotel">Hotel/Accommodation</option>
            <option value="visa">Visa/Passport</option>
            <option value="ticket">Ticket/Pass</option>
            <option value="other">Other</option>
          </Select>
        </div>
        
        <Button type="submit" size="lg" className="mt-4" isLoading={isPending} disabled={!file}>
          Upload
        </Button>
      </form>
    </BottomSheet>
  );
}
