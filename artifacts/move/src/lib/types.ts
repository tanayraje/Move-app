export interface TripMember {
  id: string;
  name: string;
  color?: string; // hex color for avatar
}

export type TripStatus = 'active' | 'archived' | 'wishlist';

export interface Trip {
  id: string;
  name: string;
  destination: string;
  destinationCurrency: string; // ISO currency code e.g. "VND"
  startDate: string;
  endDate: string;
  budget?: TripBudget;
  dayCities?: Record<string, string>; // date → city name
  guests?: TripMember[];
  inviteCode?: string;
  status?: TripStatus; // replaces `archived` boolean
  archived?: boolean; // legacy — kept for backward compat
  createdAt: number;
}

export interface TripBudget {
  total: number;
  transport: number;
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
  mealSubType?: 'breakfast' | 'lunch' | 'dinner' | 'drinks';
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
  blob?: Blob;
  file_url?: string;
  createdAt: number;
}

export type ExpenseCategory = 'food' | 'transport' | 'accommodation' | 'activities' | 'misc';

export interface ExpenseSplit {
  memberId: string;
  amount: number; // in INR
}

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  amount: number; // stored in INR
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD
  payerId?: string; // member ID who paid; defaults to self
  notes?: string;
  split?: ExpenseSplit[]; // if present, expense is split
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
  linkedToTimeline?: boolean;
  createdAt: number;
}
