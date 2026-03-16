export interface Trip {
  id: string;
  name: string;
  destination: string;
  destinationCurrency: string; // ISO currency code e.g. "VND"
  startDate: string;
  endDate: string;
  budget?: TripBudget;
  createdAt: number;
}

export interface TripBudget {
  total: number;
  travel: number;
  food: number;
  accommodation: number;
  activities: number;
  misc: number;
}

export type ElementType = 'travel' | 'accommodation' | 'meal' | 'activity';
export type TravelType = 'flight' | 'train' | 'bus' | 'car';
export type ItineraryCategory = 'flight' | 'train' | 'hotel' | 'activity' | 'food' | 'travel' | 'other';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ItineraryItem {
  id: string;
  tripId: string;
  elementType: ElementType;
  title: string;
  location: string;
  fromLocation?: string;
  toLocation?: string;
  travelType?: TravelType;
  date: string; // YYYY-MM-DD (departure date / start date)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  endDate?: string; // for multi-day (accommodation)
  notes: string;
  category: ItineraryCategory; // kept for color mapping
  order: number;
  attachedDocIds?: string[];
  checklist?: ChecklistItem[];
  fromPlaceId?: string; // if auto-generated from a Place
  cost?: number; // stored in INR
  expenseId?: string; // linked Expense record id
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
  blob: Blob;
  createdAt: number;
}

export type ExpenseCategory = 'food' | 'transport' | 'accommodation' | 'activities' | 'misc';

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  amount: number; // stored in INR
  category: ExpenseCategory;
  date: string;
  createdAt: number;
}

export interface Place {
  id: string;
  tripId: string;
  name: string;
  location: string;
  notes: string;
  visited: boolean;
  date?: string; // optional YYYY-MM-DD — links to itinerary
  checklist?: ChecklistItem[];
  createdAt: number;
}
