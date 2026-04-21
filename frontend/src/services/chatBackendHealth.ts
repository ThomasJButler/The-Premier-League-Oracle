/**
 * Session-lifetime cache for the Oracle Chat backend `/health` probe.
 *
 * Why this exists: `ChatBot.svelte` used to fire a health probe on every
 * mount. Remounts within a single SPA session (nav away + back) re-probed
 * unnecessarily — nothing useful changes between those checks. This module
 * caches the first probe's result for the lifetime of the module (i.e. the
 * current page/session) and only re-probes when explicitly invalidated.
 *
 * Invalidation is triggered by callers (e.g. a RAG request fails with a
 * network error or 5xx) via `invalidateBackendHealth()` — the cache then
 * re-probes on the next `isBackendAvailable()` call.
 */

const HEALTH_URL = '/health';
const HEALTH_TIMEOUT_MS = 5000;

let cachedAvailability: boolean | null = null;
let inflightProbe: Promise<boolean> | null = null;

/**
 * Returns whether the backend RAG service is reachable, using a
 * session-lifetime cache. First call probes `/health`; subsequent calls
 * in the same session return the cached result without a network request.
 *
 * Concurrent callers share a single in-flight probe promise — avoids
 * duplicate `/health` fetches when multiple components mount in the same tick.
 */
export async function isBackendAvailable(): Promise<boolean> {
  if (cachedAvailability !== null) return cachedAvailability;
  if (inflightProbe) return inflightProbe;

  inflightProbe = probeHealth();
  try {
    cachedAvailability = await inflightProbe;
    return cachedAvailability;
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
 * Clears the cached availability flag. The next `isBackendAvailable()`
 * call will re-probe. Used by callers (e.g. ChatBot) when a RAG request
 * fails with a network/5xx error, and by tests to reset state.
 */
export function invalidateBackendHealth(): void {
  cachedAvailability = null;
  inflightProbe = null;
}
