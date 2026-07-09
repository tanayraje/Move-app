import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trip, ItineraryItem, TripDocument, Expense, Place, TripBudget } from '@/lib/types';
import { supabase } from '@/lib/supabase';

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

export async function joinTripByCode(inviteCode: string) {
  const { data, error } = await supabase.rpc(
    "join_trip_by_code",
    {
      code: inviteCode.trim().toUpperCase(),
    }
  );

  if (error) throw error;

  return data;
}

// --- TRIPS ---
export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: memberships } = await supabase
  .from('trip_members')
  .select('trip_id')
  .eq('user_id', user.id)
  .eq('status', 'active');

const memberTripIds = memberships?.map(m => m.trip_id) || [];

const { data, error } = await supabase
  .from("trips")
  .select(`
    *,
    trip_members (
      id
    )
  `)
  .or(
  `owner_id.eq.${user.id},id.in.(${
      memberTripIds.length
        ? memberTripIds.join(",")
        : "00000000-0000-0000-0000-000000000000"
    })`
  );


      if (error) throw error;

      return (data || []).map((trip: any) => ({
  id: trip.id,
  name: trip.name,
  destination: trip.destination,
  destinationCurrency: trip.destination_currency,
  startDate: trip.start_date || '',
  endDate: trip.end_date || '',
  inviteCode: trip.invite_code,
  guests: trip.trip_members || [],
  status: trip.status || 'active',
  dayCities: trip.day_cities || {},
  budget: trip.budget || undefined,
  createdAt: trip.created_at_ms,
  heroImage: trip.hero_image,
  heroLocation: trip.hero_location,
  state: trip.state,
}));
    },
  });
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: ['trips', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('USETRIP ERROR', error);
        return null;
      }

      return {
  id: data.id,
  name: data.name,
  destination: data.destination,
  destinationCurrency: data.destination_currency,
  startDate: data.start_date || '',
  endDate: data.end_date || '',
  inviteCode: data.invite_code,
  guests: data.members || [],
  status: data.status || 'active',
  dayCities: data.day_cities || {},
  budget: data.budget || undefined,
  createdAt: data.created_at_ms,
  heroImage: data.hero_image,
  heroLocation: data.hero_location,
  state: data.state,
};
    },
    enabled: !!id,
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (trip: Trip) => {
      const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  throw new Error("User not authenticated");
}
      const { error } = await supabase
        .from('trips')
        .insert({
          owner_id: user.id,
          id: trip.id,
          name: trip.name,
          destination: trip.destination,
          destination_currency: trip.destinationCurrency,
          start_date: trip.startDate,
          end_date: trip.endDate,
          invite_code: trip.inviteCode,
          members: trip.guests || [],
          status: trip.status || 'active',
          day_cities: trip.dayCities || {},
          created_at_ms: trip.createdAt,
          state: trip.state ?? null,
        });

      if (error) throw error;

const { error: memberError } = await supabase
  .from('trip_members')
  .insert({
    trip_id: trip.id,
    user_id: user.id,
    role: 'owner',
  });

// ======================================================
// Fetch and save hero image after creating the trip
// ======================================================

if (memberError) {
  console.error("OWNER MEMBER ERROR", memberError);
  throw memberError;
}

// ======================================================
// Fetch destination hero image
// ======================================================

try {
  await supabase.functions.invoke("hero-image", {
    body: {
    trip_id: trip.id,
    destination: trip.state || trip.destination,
},
  });
} catch (err) {
  console.error("Hero image failed", err);
}

return trip;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useUpdateTrip() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (trip: Trip) => {
      const response = await supabase
  .from("trips")
  .update({
    name: trip.name,
    destination: trip.destination,
    destination_currency: trip.destinationCurrency,
    start_date: trip.startDate,
    end_date: trip.endDate,
    invite_code: trip.inviteCode,
    members: trip.guests || [],
    status: trip.status || "active",
    day_cities: trip.dayCities || {},
    budget: trip.budget ?? null,
    state: trip.state ?? null,
  })
  .eq("id", trip.id)
  .select();


if (response.error) {
  throw response.error;
}

try {
  await supabase.functions.invoke("hero-image", {
    body: {
      trip_id: trip.id,
      destination: trip.state || trip.destination,
    },
  });
} catch (err) {
  console.error("Hero image update failed", err);
}

return trip;
    },

    onSuccess: (trip) => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['trips', trip.id] });
    },
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('trips')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
// --- ITINERARY ---
export function useItinerary(tripId: string) {
  return useQuery({
    queryKey: ['itinerary', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('itinerary_items')
        .select('*')
        .eq('trip_id', tripId)
        .order('date', { ascending: true })
        .order('order_index', { ascending: true });

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        tripId: item.trip_id,
        elementType: item.element_type,
        title: item.title,
        location: item.location || '',
        fromLocation: item.from_location || '',
        toLocation: item.to_location || '',
        travelType: item.travel_type || undefined,
        date: item.date,
        startTime: item.start_time || '',
        endTime: item.end_time || '',
        endDate: item.end_date || undefined,
        notes: item.notes || '',
        category: item.category,
        order: item.order_index || 0,
        attachedDocIds: item.attached_doc_ids || [],
        checklist: item.checklist || [],
        fromPlaceId: item.from_place_id || undefined,
        cost: item.cost || undefined,
        expenseId: item.expense_id || undefined,
        mealSubType: item.meal_sub_type || undefined,
      }));
    },
    enabled: !!tripId,
  });
}

export function useSaveItineraryItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (item: ItineraryItem) => {
      const { error } = await supabase
        .from('itinerary_items')
        .upsert({
          id: item.id,
          trip_id: item.tripId,
          element_type: item.elementType,
          title: item.title,
          location: item.location,
          from_location: item.fromLocation,
          to_location: item.toLocation,
          travel_type: item.travelType,
          date: item.date,
          start_time: item.startTime,
          end_time: item.endTime,
          end_date: item.endDate,
          notes: item.notes,
          category: item.category,
          order_index: item.order,
          attached_doc_ids: item.attachedDocIds || [],
          checklist: item.checklist || [],
          from_place_id: item.fromPlaceId,
          cost: item.cost,
          expense_id: item.expenseId,
          meal_sub_type: item.mealSubType,
        });

      if (error) throw error;

      return item;
    },

    onSuccess: (_, item) => {
      qc.invalidateQueries({
        queryKey: ['itinerary', item.tripId]
      });
    }
  });
}

export function useDeleteItineraryItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ tripId, id }: { tripId: string; id: string }) => {
      const { error } = await supabase
        .from('itinerary_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ['itinerary', vars.tripId]
      });
    }
  });
}

export function useReorderItinerary() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tripId,
      items,
    }: {
      tripId: string;
      items: ItineraryItem[];
    }) => {
      const updates = items.map((item, index) => ({
        id: item.id,
        order_index: index,
      }));

      for (const update of updates) {
        await supabase
          .from('itinerary_items')
          .update({
            order_index: update.order_index,
          })
          .eq('id', update.id);
      }
    },

    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ['itinerary', vars.tripId]
      });
    }
  });
}

// --- DOCUMENTS (IndexedDB) ---
// --- DOCUMENTS ---
export function useDocuments(tripId: string) {
  return useQuery({
    queryKey: ['documents', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('trip_id', tripId);

      if (error) throw error;

      return (data || []).map((doc: any) => ({
  id: doc.id,
  tripId: doc.trip_id,
  name: doc.name,
  category: doc.category,
  notes: doc.notes,
  fileName: doc.file_name,
  fileType: doc.file_type,
  fileSize: doc.file_size,
  file_url: doc.file_url,
  createdAt: doc.created_at_ms,
}));
    },
    enabled: !!tripId,
  });
}

export function useAddDocument() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (doc: any) => {
      const filePath = `${doc.tripId}/${doc.id}_${doc.fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('trip-documents')
        .upload(filePath, doc.blob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('trip-documents')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          id: doc.id,
          trip_id: doc.tripId,
          name: doc.name,
          category: doc.category,
          notes: doc.notes,
          file_name: doc.fileName,
          file_type: doc.fileType,
          file_size: doc.fileSize,
          file_url: urlData.publicUrl,
          created_at_ms: doc.createdAt,
        });

      if (dbError) throw dbError;

      return doc;
    },

    onSuccess: (_, doc) => {
      qc.invalidateQueries({
        queryKey: ['documents', doc.tripId]
      });
    }
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      tripId,
    }: {
      id: string;
      tripId: string;
    }) => {
      const { data: doc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (doc?.file_url) {
        const path = decodeURIComponent(
          doc.file_url.split('/trip-documents/')[1]
        );

        await supabase.storage
          .from('trip-documents')
          .remove([path]);
      }

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ['documents', vars.tripId]
      });
    }
  });
}

// --- EXPENSES ---
export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: ['expenses', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', tripId)
        .order('date', { ascending: true });

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        tripId: item.trip_id,
        title: item.title,
        amount: item.amount,
        category: item.category,
        date: item.date,
        payerId: item.payer_id || undefined,
payerName: item.payer_name || "",
        notes: item.notes || '',
        split: item.split ?? null,
        createdAt: item.created_at_ms,
      }));
    },
    enabled: !!tripId,
  });
}

export function useSaveExpense() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (item: Expense) => {
      console.log("SAVE EXPENSE", item);
      const { error } = await supabase
        .from('expenses')
        .upsert({
          id: item.id,
          trip_id: item.tripId,
          title: item.title,
          amount: item.amount,
          category: item.category,
          date: item.date,
          payer_id: item.payerId,
          payer_name: item.payerName,
          notes: item.notes,
          split: item.split ?? null,
          created_at_ms: item.createdAt,
        });

      if (error) throw error;

      return item;
    },

    onSuccess: (_, item) => {
      qc.invalidateQueries({
        queryKey: ['expenses', item.tripId]
      });
    }
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tripId,
      id,
    }: {
      tripId: string;
      id: string;
    }) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ['expenses', vars.tripId]
      });
    }
  });
}

// --- PLACES ---
export function usePlaces(tripId: string) {
  return useQuery({
    queryKey: ['places', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .eq('trip_id', tripId);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        tripId: item.trip_id,
        name: item.name,
        location: item.location || '',
        notes: item.notes || '',
        visited: item.visited,
        date: item.date || undefined,
        checklist: item.checklist || [],
        linkedToTimeline: item.linked_to_timeline || false,
        createdAt: item.created_at_ms,
      }));
    },
    enabled: !!tripId,
  });
}

export function useSavePlace() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (item: Place) => {
      const { error } = await supabase
        .from('places')
        .upsert({
          id: item.id,
          trip_id: item.tripId,
          name: item.name,
          location: item.location,
          notes: item.notes,
          visited: item.visited,
          date: item.date,
          checklist: item.checklist || [],
          linked_to_timeline: item.linkedToTimeline || false,
          created_at_ms: item.createdAt,
        });

      if (error) throw error;

      return item;
    },

    onSuccess: (_, item) => {
      qc.invalidateQueries({
        queryKey: ['places', item.tripId]
      });
    }
  });
}

export function useDeletePlace() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tripId,
      id,
    }: {
      tripId: string;
      id: string;
    }) => {
      const { error } = await supabase
        .from('places')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ['places', vars.tripId]
      });
    }
  });
}
