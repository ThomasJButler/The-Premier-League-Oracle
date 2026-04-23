import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isBackendAvailable, invalidateBackendHealth } from './chatBackendHealth';

const STORAGE_KEY = 'oracle_backend_health_v1';

/** Helper: return how many times /health was called on the mocked fetch. */
function countHealthProbes() {
  return vi.mocked(globalThis.fetch).mock.calls.filter(
    ([url]) => typeof url === 'string' && url === '/health'
  ).length;
}

describe('chatBackendHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset both cache layers (module-level and sessionStorage) between tests.
    invalidateBackendHealth();
    globalThis.sessionStorage?.clear();
    vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
      if (typeof url === 'string' && url === '/health') {
        return { ok: true, json: () => Promise.resolve({ status: 'healthy' }) } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });
  });

  it('probes /health on first call and caches the result across subsequent calls', async () => {
    const first = await isBackendAvailable();
    const second = await isBackendAvailable();
    const third = await isBackendAvailable();

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(third).toBe(true);
    // Exactly one /health fetch across three calls — proves session cache works.
    expect(countHealthProbes()).toBe(1);
  });

  it('re-probes after invalidateBackendHealth() is called', async () => {
    await isBackendAvailable();
    expect(countHealthProbes()).toBe(1);

    invalidateBackendHealth();

    await isBackendAvailable();
    expect(countHealthProbes()).toBe(2);
  });

  it('caches a negative probe (network failure) without re-probing', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async () => {
      throw new Error('Network down');
    });

    const first = await isBackendAvailable();
    const second = await isBackendAvailable();

    expect(first).toBe(false);
    expect(second).toBe(false);
    expect(countHealthProbes()).toBe(1);
  });

  it('returns false when /health responds with non-healthy status payload', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
      if (typeof url === 'string' && url === '/health') {
        return { ok: true, json: () => Promise.resolve({ status: 'degraded' }) } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

    const result = await isBackendAvailable();
    expect(result).toBe(false);
  });

  it('deduplicates in-flight probes — two simultaneous callers share one fetch', async () => {
    // Use a deferred promise so both callers arrive while the probe is still in flight.
    let resolveFetch!: (response: Response) => void;
    vi.mocked(globalThis.fetch).mockImplementation(() =>
      new Promise<Response>((r) => { resolveFetch = r; })
    );

    const promiseA = isBackendAvailable();
    const promiseB = isBackendAvailable();

    resolveFetch({ ok: true, json: () => Promise.resolve({ status: 'healthy' }) } as Response);

    const [a, b] = await Promise.all([promiseA, promiseB]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(countHealthProbes()).toBe(1);
  });

  it('uses a fresh sessionStorage entry on cold module cache (simulates page refresh)', async () => {
    // Seed sessionStorage as if a previous page load had probed recently.
    globalThis.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ available: true, probedAt: Date.now() - 60_000 })
    );
    // Invalidate only the module-level cache — NOT sessionStorage — to simulate refresh.
    // `invalidateBackendHealth()` clears both layers, so instead we rely on the fact that
    // no prior call in this test has populated the module cache.
    // (beforeEach already reset the module cache and then cleared storage; we reset storage
    // again after that by setting the entry directly above.)

    const result = await isBackendAvailable();

    expect(result).toBe(true);
    // Critically: zero fetches, because the sessionStorage entry was honoured.
    expect(countHealthProbes()).toBe(0);
  });

  it('ignores a stale sessionStorage entry and re-probes, writing a fresh entry', async () => {
    // Seed sessionStorage with an entry older than the 15-minute threshold.
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    globalThis.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ available: false, probedAt: oneHourAgo })
    );

    const result = await isBackendAvailable();

    expect(result).toBe(true);
    expect(countHealthProbes()).toBe(1);

    const stored = JSON.parse(globalThis.sessionStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.available).toBe(true);
    expect(typeof stored.probedAt).toBe('number');
    // The refreshed entry must be newer than the stale one.
    expect(stored.probedAt).toBeGreaterThan(oneHourAgo);
  });

  it('invalidateBackendHealth() removes the sessionStorage entry', async () => {
    await isBackendAvailable();
    expect(globalThis.sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();

    invalidateBackendHealth();

    expect(globalThis.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('resolves normally when sessionStorage.setItem throws (private-mode fallback)', async () => {
    // Simulate a private-mode browser where writes are rejected but reads may still work.
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

    try {
      const result = await isBackendAvailable();
      expect(result).toBe(true);
      // No error should have propagated to the caller — the fetch still resolved.
      expect(countHealthProbes()).toBe(1);
    } finally {
      setItemSpy.mockRestore();
    }
  });
});
