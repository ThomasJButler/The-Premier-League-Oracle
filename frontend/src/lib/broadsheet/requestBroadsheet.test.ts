import { describe, expect, it, vi } from 'vitest';
import { requestBroadsheet } from './requestBroadsheet';
import type { BroadsheetJson } from '$lib/server/broadsheetPrompt';

const SAMPLE: BroadsheetJson = {
  headline: 'A weekend in red ink',
  standfirst: 'Five fixtures, one truth.',
  byline: 'The Voice',
  sections: [{ heading: 'Top of the table', body: 'A taut weekend.' }]
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('requestBroadsheet', () => {
  it('returns the parsed broadsheet on success', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse({ broadsheet: SAMPLE, generatedAt: '2026-05-24T10:00:00.000Z' })
    );
    const result = await requestBroadsheet({ personaId: 'voice', gameweek: 34 }, fetchFn);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.broadsheet.headline).toBe(SAMPLE.headline);
      expect(result.generatedAt).toBe('2026-05-24T10:00:00.000Z');
    }
  });

  it('POSTs to /api/broadsheet with the JSON-encoded payload', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse({ broadsheet: SAMPLE, generatedAt: 'x' })
    );
    await requestBroadsheet({ personaId: 'scouser', gameweek: 12 }, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/broadsheet');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ personaId: 'scouser', gameweek: 12 });
  });

  it('surfaces HTTP error codes from the server JSON body', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse({ error: 'rate_limited' }, 429)
    );
    const result = await requestBroadsheet({ personaId: 'voice', gameweek: 1 }, fetchFn);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('rate_limited');
  });

  it('falls back to http_{status} when the error body is non-JSON', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response('upstream down', { status: 502 })
    );
    const result = await requestBroadsheet({ personaId: 'voice', gameweek: 1 }, fetchFn);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('http_502');
  });

  it('returns network_error when fetch rejects', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => {
      throw new Error('socket reset');
    });
    const result = await requestBroadsheet({ personaId: 'voice', gameweek: 1 }, fetchFn);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('socket reset');
  });

  it('returns malformed_response when the success payload is missing fields', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse({ broadsheet: SAMPLE })
    );
    const result = await requestBroadsheet({ personaId: 'voice', gameweek: 1 }, fetchFn);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('malformed_response');
  });
});
