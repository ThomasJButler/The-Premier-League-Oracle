import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isBackendAvailable, invalidateBackendHealth } from './chatBackendHealth';

/** Helper: return how many times /health was called on the mocked fetch. */
function countHealthProbes() {
  return vi.mocked(globalThis.fetch).mock.calls.filter(
    ([url]) => typeof url === 'string' && url === '/health'
  ).length;
}

describe('chatBackendHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-level cache between tests so each test starts fresh.
    invalidateBackendHealth();
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
});
