import { describe, expect, it, vi } from 'vitest';
import { requestSeasonVerdict } from './requestSeasonVerdict';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('requestSeasonVerdict', () => {
  it('returns the verdict on success', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse({ verdict: 'A taut season.', generatedAt: '2026-05-24T10:00:00.000Z' })
    );
    const result = await requestSeasonVerdict({ personaId: 'voice', season: '2003/04' }, fetchFn);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verdict).toBe('A taut season.');
      expect(result.generatedAt).toBe('2026-05-24T10:00:00.000Z');
    }
  });

  it('POSTs the discriminated payload to /api/broadsheet', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse({ verdict: 'x', generatedAt: 'x' })
    );
    await requestSeasonVerdict({ personaId: 'scouser', season: '2018/19' }, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/broadsheet');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      kind: 'season-verdict',
      personaId: 'scouser',
      season: '2018/19'
    });
  });

  it('surfaces HTTP error codes from the JSON body', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse({ error: 'rate_limited' }, 429)
    );
    const result = await requestSeasonVerdict({ personaId: 'voice', season: '2003/04' }, fetchFn);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('rate_limited');
  });

  it('returns malformed_response when verdict is missing', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse({ generatedAt: 'x' })
    );
    const result = await requestSeasonVerdict({ personaId: 'voice', season: '2003/04' }, fetchFn);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('malformed_response');
  });

  it('returns network_error when fetch rejects', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => {
      throw new Error('offline');
    });
    const result = await requestSeasonVerdict({ personaId: 'voice', season: '2003/04' }, fetchFn);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('offline');
  });
});
