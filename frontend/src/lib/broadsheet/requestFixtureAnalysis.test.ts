import { describe, expect, it, vi } from 'vitest';
import { requestFixtureAnalysis } from './requestFixtureAnalysis';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

const PAYLOAD = {
  personaId: 'voice' as const,
  fixtureId: 'm-1',
  fixture: { home: 'Arsenal', away: 'Liverpool' },
  prediction: {
    ensemble: { home: 0.45, draw: 0.25, away: 0.3 },
    pick: 'HOME' as const,
    pickConfidence: 0.45
  }
};

describe('requestFixtureAnalysis', () => {
  it('returns the analysis on success', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse({ analysis: 'Arsenal edge it.', generatedAt: '2026-05-25T10:00:00.000Z' })
    );
    const result = await requestFixtureAnalysis(PAYLOAD, fetchFn);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis).toBe('Arsenal edge it.');
      expect(result.generatedAt).toBe('2026-05-25T10:00:00.000Z');
    }
  });

  it('POSTs the discriminated payload to /api/broadsheet', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse({ analysis: 'x', generatedAt: 'x' })
    );
    await requestFixtureAnalysis(PAYLOAD, fetchFn);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/broadsheet');
    const body = JSON.parse(init?.body as string);
    expect(body.kind).toBe('fixture-analysis');
    expect(body.fixtureId).toBe('m-1');
    expect(body.personaId).toBe('voice');
  });

  it('surfaces HTTP error codes from the JSON body', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () =>
      jsonResponse({ error: 'rate_limited' }, 429)
    );
    const result = await requestFixtureAnalysis(PAYLOAD, fetchFn);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('rate_limited');
  });

  it('returns network_error when fetch rejects', async () => {
    const fetchFn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => {
      throw new Error('offline');
    });
    const result = await requestFixtureAnalysis(PAYLOAD, fetchFn);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('offline');
  });
});
