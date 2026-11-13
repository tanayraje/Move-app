import { useQuery, useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { Trip, ItineraryItem, Expense, Place } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { isOfflineError } from '@/lib/errors';

// Shows a change on screen straight away. Returns what was there before so a
// failed save can put it back (see restoreList).
async function applyOptimistic<T>(
  qc: QueryClient,
  queryKey: QueryKey,
  change: (list: T[]) => T[],
): Promise<{ previous: T[] | undefined }> {
  await qc.cancelQueries({ queryKey });
  const previous = qc.getQueryData<T[]>(queryKey);
  if (previous) qc.setQueryData<T[]>(queryKey, change(previous));
  return { previous };
}

function restoreList<T>(qc: QueryClient, queryKey: QueryKey, context: { previous: T[] | undefined } | undefined) {
  if (context?.previous) qc.setQueryData<T[]>(queryKey, context.previous);
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some(existing => existing.id === item.id)
    ? list.map(existing => (existing.id === item.id ? { ...existing, ...item } : existing))
    : [...list, item];
}

/** Why a trip could not be opened. The dashboard shows a different message for each. */
export type TripLoadProblem = 'not-found' | 'offline' | 'error';

export class TripLoadError extends Error {
  kind: TripLoadProblem;
  constructor(kind: TripLoadProblem, message?: string) {
    super(message ?? kind);
    this.name = 'TripLoadError';
    this.kind = kind;
  }
}

export function tripLoadProblem(error: unknown): TripLoadProblem {
  if (error instanceof TripLoadError) return error.kind;
  return isOfflineError(error) ? 'offline' : 'error';
}

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
  wishlistDayCount: trip.wishlist_day_count ?? 1,
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
        .maybeSingle();

      if (error) {
        console.error('USETRIP ERROR', error);
        throw new TripLoadError(isOfflineError(error) ? 'offline' : 'error', error.message);
      }

      // No row: the trip was deleted, or this account is not allowed to see it.
      // The database gives the same answer for both, on purpose.
      if (!data) throw new TripLoadError('not-found');

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
  wishlistDayCount: data.wishlist_day_count ?? 1,
  budget: data.budget || undefined,
  createdAt: data.created_at_ms,
  heroImage: data.hero_image,
  heroLocation: data.hero_location,
  state: data.state,
};
    },
    enabled: !!id,
    retry: (failureCount, error) => tripLoadProblem(error) === 'error' && failureCount < 2,
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();

  return useMutation({
    meta: { errorLabel: 'Could not create the trip' },
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
    meta: { errorLabel: 'Could not save the trip' },
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
    wishlist_day_count: trip.wishlistDayCount ?? 1,
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
    meta: { errorLabel: 'Could not delete the trip' },
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
    meta: { errorLabel: 'Could not save this timeline item' },
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
    meta: { errorLabel: 'Could not delete this timeline item' },
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
    meta: { errorLabel: 'Could not save the new order' },
    mutationFn: async ({
      tripId,
      items,
    }: {
      tripId: string;
      items: ItineraryItem[];
    }) => {
      const ids = items.map(item => item.id);

      // One database call: the whole order is saved, or none of it is.
      const { error } = await supabase.rpc('reorder_itinerary_items', {
        p_trip_id: tripId,
        p_ids: ids,
      });
      if (!error) return;

      // PGRST202 = the function is not in the database yet
      // (supabase/migrations/20261113000000_reorder_itinerary_items.sql).
      // Until it is, save item by item but stop pretending a failure is a success.
      if (error.code !== 'PGRST202') throw error;

      const results = await Promise.all(
        ids.map((id, index) =>
          supabase
            .from('itinerary_items')
            .update({ order_index: index })
            .eq('id', id)
        )
      );
      const failed = results.find(result => result.error);
      if (failed?.error) throw failed.error;
    },

    onMutate: ({ tripId, items }) => {
      const position = new Map(items.map((item, index) => [item.id, index]));
      return applyOptimistic<ItineraryItem>(qc, ['itinerary', tripId], list =>
        list
          .map(item => (position.has(item.id) ? { ...item, order: position.get(item.id)! } : item))
          .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
      );
    },

    onError: (_error, vars, context) => {
      restoreList(qc, ['itinerary', vars.tripId], context);
    },

    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({
        queryKey: ['itinerary', vars.tripId]
      });
    }
  });
}

// documents.file_url holds the storage path ("<trip_id>/<document_id>_<file name>").
// Older rows hold a full public link instead, so both are understood here.
export function storagePathFromUrl(value?: string | null): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value;
  const part = value.split('/trip-documents/')[1];
  if (!part) return null;
  try {
    return decodeURIComponent(part.split('?')[0]);
  } catch {
    return null;
  }
}

// Link to use when a signed link could not be made (bucket rules not applied yet).
function unsignedDocumentUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return supabase.storage.from('trip-documents').getPublicUrl(value).data.publicUrl;
}

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

      // Resolve short-lived signed links so the bucket can be private.
      // If signing is not permitted (bucket policies not set yet) the stored public link is used.
      const paths = (data || [])
        .map((d: any) => storagePathFromUrl(d.file_url))
        .filter((p: string | null): p is string => !!p);
      const signed = new Map<string, string>();
      if (paths.length) {
        const { data: links } = await supabase.storage
          .from('trip-documents')
          .createSignedUrls(paths, 60 * 60);
        (links || []).forEach((l: any) => {
          if (l.path && l.signedUrl) signed.set(l.path, l.signedUrl);
        });
      }

      return (data || []).map((doc: any) => ({
  id: doc.id,
  tripId: doc.trip_id,
  name: doc.name,
  category: doc.category,
  notes: doc.notes,
  fileName: doc.file_name,
  fileType: doc.file_type,
  fileSize: doc.file_size,
  file_url: signed.get(storagePathFromUrl(doc.file_url) ?? '') ?? unsignedDocumentUrl(doc.file_url),
  createdAt: doc.created_at_ms,
}));
    },
    enabled: !!tripId,
  });
}

export function useAddDocument(options: { quiet?: boolean } = {}) {
  const qc = useQueryClient();

  return useMutation({
    meta: { errorLabel: 'Could not upload the document', quiet: options.quiet },
    mutationFn: async (doc: any) => {
      const filePath = `${doc.tripId}/${doc.id}_${doc.fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('trip-documents')
        .upload(filePath, doc.blob);

      if (uploadError) throw uploadError;

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
          file_url: filePath,
          created_at_ms: doc.createdAt,
        });

      if (dbError) {
        // Do not leave a file behind with no document row pointing at it.
        await supabase.storage.from('trip-documents').remove([filePath]);
        throw dbError;
      }

      return doc;
    },

    onSuccess: (_, doc) => {
      qc.invalidateQueries({
        queryKey: ['documents', doc.tripId]
      });
    }
  });
}

export function useUpdateDocument(options: { quiet?: boolean } = {}) {
  const qc = useQueryClient();

  return useMutation({
    meta: { errorLabel: 'Could not save the document', quiet: options.quiet },
    mutationFn: async ({
      id,
      tripId,
      name,
      category,
      notes,
    }: {
      id: string;
      tripId: string;
      name: string;
      category: string;
      notes: string;
    }) => {
      const { error } = await supabase
        .from('documents')
        .update({ name, category, notes })
        .eq('id', id);

      if (error) throw error;
      return { id, tripId };
    },

    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['documents', v.tripId] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();

  return useMutation({
    meta: { errorLabel: 'Could not delete the document' },
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

      // Row first: if this fails nothing is lost. The file is removed after,
      // so a failure there leaves an unused file, never a document with no file.
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const path = storagePathFromUrl(doc?.file_url);
      if (path) {
        await supabase.storage
          .from('trip-documents')
          .remove([path]);
      }
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
    meta: { errorLabel: 'Could not save the expense' },
    mutationFn: async (item: Expense) => {
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

    onMutate: (item) =>
      applyOptimistic<Expense>(qc, ['expenses', item.tripId], list =>
        upsertById(list, item).sort((a, b) => a.date.localeCompare(b.date))
      ),

    onError: (_error, item, context) => {
      restoreList(qc, ['expenses', item.tripId], context);
    },

    onSettled: (_data, _error, item) => {
      qc.invalidateQueries({
        queryKey: ['expenses', item.tripId]
      });
    }
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();

  return useMutation({
    meta: { errorLabel: 'Could not delete the expense' },
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
    meta: { errorLabel: 'Could not save the place' },
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

    onMutate: (item) =>
      applyOptimistic<Place>(qc, ['places', item.tripId], list => upsertById(list, item)),

    onError: (_error, item, context) => {
      restoreList(qc, ['places', item.tripId], context);
    },

    onSettled: (_data, _error, item) => {
      qc.invalidateQueries({
        queryKey: ['places', item.tripId]
      });
    }
  });
}

export function useDeletePlace() {
  const qc = useQueryClient();

  return useMutation({
    meta: { errorLabel: 'Could not delete the place' },
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
