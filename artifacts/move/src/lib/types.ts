export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string; // ISO
  endDate: string; // ISO
  createdAt: number;
}

export type ItineraryCategory = 'flight' | 'train' | 'hotel' | 'activity' | 'food' | 'travel' | 'other';

export interface ItineraryItem {
  id: string;
  tripId: string;
  title: string;
  location: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  notes: string;
  category: ItineraryCategory;
  order: number;
}

export type DocumentCategory = 'flight' | 'hotel' | 'visa' | 'ticket' | 'activity' | 'other';

export interface TripDocument {
  id: string;
  tripId: string;
  name: string;
  category: DocumentCategory;
  notes: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  blob: Blob; // Stored in IDB
  createdAt: number;
}

export type ExpenseCategory = 'food' | 'transport' | 'hotel' | 'activity' | 'shopping' | 'other';

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string; // ISO
  createdAt: number;
}

export interface Place {
  id: string;
  tripId: string;
  name: string;
  location: string;
  notes: string;
  visited: boolean;
  createdAt: number;
}
