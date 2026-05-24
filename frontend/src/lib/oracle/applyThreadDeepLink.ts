import { get } from 'svelte/store';
import { threadsStore } from '$lib/stores/threads';

/**
 * Activates `threadId` in `threadsStore` if it resolves to an existing thread.
 * Returns true when the activation fires, false for nullish ids or unknown
 * ids (so a stale `/oracle?thread=…` link can't leave the UI pointing at a
 * thread that no longer exists). Browser-only — `get` reads localStorage-
 * hydrated state, so call from `onMount`.
 */
export function applyThreadDeepLink(threadId: string | null | undefined): boolean {
  if (!threadId) return false;
  const state = get(threadsStore);
  if (!state.threads.some((t) => t.id === threadId)) return false;
  threadsStore.setActive(threadId);
  return true;
}
