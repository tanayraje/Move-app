import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { notify } from "@/lib/dialogs";
import { saveErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Start of the failure message, e.g. "Could not save the expense". */
      errorLabel?: string;
      /** The screen shows its own inline error, so skip the toast. */
      quiet?: boolean;
    };
  }
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = "move-query-cache";
const CACHE_USER_KEY = "move-query-cache-user";

/**
 * Offline behaviour (decided in workstream 4):
 * - Reading: the last data each screen loaded is kept on the phone for a week,
 *   so trips open read-only without a connection.
 * - Writing: saves are never queued. Without a connection a save fails at once,
 *   the screen goes back to how it was, and a message says what happened.
 */
export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.quiet) return;
      notify(saveErrorMessage(mutation.meta?.errorLabel ?? "Could not save your changes", error), "error");
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: WEEK_MS,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "always",
      retry: false,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: CACHE_KEY,
  throttleTime: 1000,
});

export const persistOptions: PersistQueryClientProviderProps["persistOptions"] = {
  persister,
  maxAge: WEEK_MS,
  buster: "1",
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.status === "success",
  },
};

/** Saved trip data belongs to one account: wipe it on sign-out or when a different account signs in. */
export function watchAuthForCache() {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user?.id ?? null;
    let savedFor: string | null = null;
    try {
      savedFor = localStorage.getItem(CACHE_USER_KEY);
    } catch {
      /* storage unavailable */
    }

    if (event === "SIGNED_OUT" || (userId && savedFor && savedFor !== userId)) {
      queryClient.clear();
      persister.removeClient();
    }

    try {
      if (userId) localStorage.setItem(CACHE_USER_KEY, userId);
      else if (event === "SIGNED_OUT") localStorage.removeItem(CACHE_USER_KEY);
    } catch {
      /* storage unavailable */
    }
  });
  return () => data.subscription.unsubscribe();
}
