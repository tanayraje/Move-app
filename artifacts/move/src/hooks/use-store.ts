import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trip, ItineraryItem, TripDocument, Expense, Place } from '@/lib/types';
import { getDocumentsByTrip, saveDocument, deleteDocumentDB } from '@/lib/db';

// Generic LocalStorage helper
const getLS = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

const setLS = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

// --- TRIPS ---
export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async () => getLS<Trip[]>('move_trips', []),
  });
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: ['trips', id],
    queryFn: async () => {
      const trips = getLS<Trip[]>('move_trips', []);
      return trips.find(t => t.id === id) || null;
    },
    enabled: !!id,
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trip: Trip) => {
      const trips = getLS<Trip[]>('move_trips', []);
      setLS('move_trips', [trip, ...trips]);
      return trip;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] })
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const trips = getLS<Trip[]>('move_trips', []);
      setLS('move_trips', trips.filter(t => t.id !== id));
      // Cleanup associated data
      localStorage.removeItem(`move_itinerary_${id}`);
      localStorage.removeItem(`move_expenses_${id}`);
      localStorage.removeItem(`move_places_${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] })
  });
}

// --- ITINERARY ---
export function useItinerary(tripId: string) {
  return useQuery({
    queryKey: ['itinerary', tripId],
    queryFn: async () => getLS<ItineraryItem[]>(`move_itinerary_${tripId}`, []),
    enabled: !!tripId,
  });
}

export function useSaveItineraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: ItineraryItem) => {
      const key = `move_itinerary_${item.tripId}`;
      const items = getLS<ItineraryItem[]>(key, []);
      const existing = items.findIndex(i => i.id === item.id);
      if (existing >= 0) items[existing] = item;
      else items.push(item);
      setLS(key, items);
      return item;
    },
    onSuccess: (_, item) => qc.invalidateQueries({ queryKey: ['itinerary', item.tripId] })
  });
}

export function useDeleteItineraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, id }: { tripId: string, id: string }) => {
      const key = `move_itinerary_${tripId}`;
      const items = getLS<ItineraryItem[]>(key, []);
      setLS(key, items.filter(i => i.id !== id));
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['itinerary', vars.tripId] })
  });
}

export function useReorderItinerary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, items }: { tripId: string, items: ItineraryItem[] }) => {
      setLS(`move_itinerary_${tripId}`, items);
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['itinerary', vars.tripId] })
  });
}


// --- DOCUMENTS (IndexedDB) ---
export function useDocuments(tripId: string) {
  return useQuery({
    queryKey: ['documents', tripId],
    queryFn: async () => getDocumentsByTrip(tripId),
    enabled: !!tripId,
  });
}

export function useAddDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: TripDocument) => await saveDocument(doc),
    onSuccess: (_, doc) => qc.invalidateQueries({ queryKey: ['documents', doc.tripId] })
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tripId }: { id: string, tripId: string }) => await deleteDocumentDB(id),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['documents', vars.tripId] })
  });
}

// --- EXPENSES ---
export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: ['expenses', tripId],
    queryFn: async () => getLS<Expense[]>(`move_expenses_${tripId}`, []),
    enabled: !!tripId,
  });
}

export function useSaveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Expense) => {
      const key = `move_expenses_${item.tripId}`;
      const items = getLS<Expense[]>(key, []);
      items.push(item);
      setLS(key, items);
      return item;
    },
    onSuccess: (_, item) => qc.invalidateQueries({ queryKey: ['expenses', item.tripId] })
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, id }: { tripId: string, id: string }) => {
      const key = `move_expenses_${tripId}`;
      const items = getLS<Expense[]>(key, []);
      setLS(key, items.filter(i => i.id !== id));
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['expenses', vars.tripId] })
  });
}

// --- PLACES ---
export function usePlaces(tripId: string) {
  return useQuery({
    queryKey: ['places', tripId],
    queryFn: async () => getLS<Place[]>(`move_places_${tripId}`, []),
    enabled: !!tripId,
  });
}

export function useSavePlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Place) => {
      const key = `move_places_${item.tripId}`;
      const items = getLS<Place[]>(key, []);
      const existing = items.findIndex(i => i.id === item.id);
      if (existing >= 0) items[existing] = item;
      else items.push(item);
      setLS(key, items);
      return item;
    },
    onSuccess: (_, item) => qc.invalidateQueries({ queryKey: ['places', item.tripId] })
  });
}

export function useDeletePlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, id }: { tripId: string, id: string }) => {
      const key = `move_places_${tripId}`;
      const items = getLS<Place[]>(key, []);
      setLS(key, items.filter(i => i.id !== id));
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['places', vars.tripId] })
  });
}
