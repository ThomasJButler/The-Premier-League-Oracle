/**
 * Session-lifetime cache for the Oracle Chat backend `/health` probe.
 *
 * Why this exists: `ChatBot.svelte` used to fire a health probe on every
 * mount. Remounts within a single SPA session (nav away + back) re-probed
 * unnecessarily — nothing useful changes between those checks. This module
 * caches the first probe's result for the lifetime of the module (i.e. the
 * current page/session) and only re-probes when explicitly invalidated.
 *
 * Two cache layers:
 *  1. Module-level variable (`cachedAvailability`) — survives SPA navigation,
 *     lost on page refresh.
 *  2. `sessionStorage` — survives page refresh, lost on tab close. Checked
 *     when the module cache is cold (i.e. immediately after refresh).
 *
 * Invalidation is triggered by callers (e.g. a RAG request fails with a
 * network error or 5xx) via `invalidateBackendHealth()` — both cache layers
 * are cleared and the next `isBackendAvailable()` call re-probes.
 */

const HEALTH_URL = '/health';
const HEALTH_TIMEOUT_MS = 5000;
const STORAGE_KEY = 'oracle_backend_health_v1';
const STORAGE_MAX_AGE_MS = 15 * 60 * 1000;

interface StoredEntry {
  available: boolean;
  probedAt: number;
}

let cachedAvailability: boolean | null = null;
let inflightProbe: Promise<boolean> | null = null;

/**
 * Returns whether the backend RAG service is reachable, using a
 * session-lifetime cache. First call probes `/health`; subsequent calls
 * within the session return the cached result without a network request.
 *
 * Lookup order: module cache → sessionStorage (fresh within window) → fetch.
 *
 * Concurrent callers share a single in-flight probe promise — avoids
 * duplicate `/health` fetches when multiple components mount in the same tick.
 */
export async function isBackendAvailable(): Promise<boolean> {
  if (cachedAvailability !== null) return cachedAvailability;

  const stored = readStoredEntry();
  if (stored !== null && !isStale(stored)) {
    cachedAvailability = stored.available;
    return cachedAvailability;
  }

  if (inflightProbe) return inflightProbe;

  inflightProbe = probeHealth();
  try {
    const result = await inflightProbe;
    cachedAvailability = result;
    writeStoredEntry({ available: result, probedAt: Date.now() });
    return result;
  } finally {
    inflightProbe = null;
  }
}

async function probeHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === 'healthy';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Clears both the module-level cache and the sessionStorage entry. The
 * next `isBackendAvailable()` call will re-probe. Used by callers (e.g.
 * ChatBot) when a RAG request fails with a network/5xx error, and by tests
 * to reset state.
 */
export function invalidateBackendHealth(): void {
  cachedAvailability = null;
  inflightProbe = null;
  clearStoredEntry();
}

function readStoredEntry(): StoredEntry | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEntry;
    if (typeof parsed?.available !== 'boolean' || typeof parsed?.probedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredEntry(entry: StoredEntry): void {
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // sessionStorage may throw in private-mode browsers or sandboxed test
    // environments. Module-level cache still works, so swallow silently.
  }
}

function clearStoredEntry(): void {
  try {
    globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Same rationale as writeStoredEntry.
  }
}

function isStale(entry: StoredEntry): boolean {
  return Date.now() - entry.probedAt > STORAGE_MAX_AGE_MS;
}
