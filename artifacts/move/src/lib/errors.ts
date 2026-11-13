/**
 * One place for how Move talks about a save that did not go through.
 * Pattern: "<What could not be done>. <Why, or what to do next>."
 */

/** True when the failure is the connection, not the data. */
export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = String((error as { message?: unknown } | null)?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed")
  );
}

/** "Could not save the expense. You are offline. Try again when you are back online." */
export function saveErrorMessage(what: string, error: unknown): string {
  return isOfflineError(error)
    ? `${what}. You are offline. Try again when you are back online.`
    : `${what}. Please try again.`;
}
