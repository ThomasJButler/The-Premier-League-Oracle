import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { POST } from './+server';
import { _setAnthropic, type AnthropicClient, type MessageParams } from '$lib/server/anthropic';
import { _resetRateLimit, _RATE_LIMIT } from '$lib/server/rateLimit';
import { _setContextProvider } from '$lib/server/contextProvider';
import type { KickerContext } from '$lib/context/types';

const sampleContext = (): KickerContext => ({
  fixtures: [
    {
      id: 'm-1',
      home: 'Arsenal',
      away: 'Liverpool',
      kickoff: '2026-05-10T14:00:00Z',
      ourProb: { home: 0.42, draw: 0.27, away: 0.31 },
      marketImplied: { home: 0.4, draw: 0.28, away: 0.32 },
      valueEdge: 0.04
    }
  ],
  standings: [],
  accuracyStats: { brier: 0.19, calibration: 1.0, sampleSize: 100 },
  generatedAt: '2026-05-03T12:00:00Z'
});

interface MakeEventOptions {
  body?: unknown;
  ip?: string;
  forwardedFor?: string;
}

function makeEvent(opts: MakeEventOptions = {}): RequestEvent {
  const { body = { personaId: 'voice', messages: [{ role: 'user', content: 'hi' }] }, ip = '127.0.0.1', forwardedFor } = opts;
  const headers = new Headers({ 'content-type': 'application/json' });
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
  const request = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  return { request, getClientAddress: () => ip } as unknown as RequestEvent;
}

async function readSseChunks(response: Response): Promise<string[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value));
  }
  return chunks;
}

describe('POST /api/chat', () => {
  let capturedSystem: string | null = null;

  beforeEach(() => {
    _resetRateLimit();
    capturedSystem = null;
    _setContextProvider(async () => sampleContext());
    const fake: AnthropicClient = {
      // eslint-disable-next-line require-yield
      streamText: async function* (params: MessageParams) {
        capturedSystem = params.system;
        yield 'Reds';
        yield ' edge';
        yield ' it.';
      },
      createText: async () => 'unused'
    };
    _setAnthropic(fake);
  });

  afterEach(() => {
    _setAnthropic(undefined);
    _setContextProvider(undefined);
    _resetRateLimit();
  });

  it('streams text deltas and ends with [DONE] on the happy path', async () => {
    const res = await POST(makeEvent());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const chunks = (await readSseChunks(res)).join('');
    expect(chunks).toContain('"delta":"Reds"');
    expect(chunks).toContain('"delta":" edge"');
    expect(chunks).toContain('[DONE]');
  });

  it('injects ourProb (model probabilities) into the system prompt', async () => {
    const res = await POST(makeEvent());
    await readSseChunks(res);
    expect(capturedSystem).toBeTruthy();
    expect(capturedSystem).toContain('Arsenal v Liverpool');
    expect(capturedSystem).toContain('H 42%');
    expect(capturedSystem).toContain('edge +4.0pp');
  });

  it('rejects an unknown personaId with 400', async () => {
    const res = await POST(makeEvent({ body: { personaId: 'mystery', messages: [{ role: 'user', content: 'hi' }] } }));
    expect(res.status).toBe(400);
  });

  it('rejects malformed messages with 400', async () => {
    const res = await POST(makeEvent({ body: { personaId: 'voice', messages: [] } }));
    expect(res.status).toBe(400);
  });

  it('returns 429 on the (LIMIT+1)th request from the same IP', async () => {
    for (let i = 0; i < _RATE_LIMIT; i++) {
      const ok = await POST(makeEvent({ ip: '9.9.9.9' }));
      await readSseChunks(ok);
      expect(ok.status).toBe(200);
    }
    const blocked = await POST(makeEvent({ ip: '9.9.9.9' }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
  });

  it('keys rate limits on x-forwarded-for when present', async () => {
    for (let i = 0; i < _RATE_LIMIT; i++) {
      const ok = await POST(makeEvent({ forwardedFor: '8.8.8.8' }));
      await readSseChunks(ok);
    }
    const blocked = await POST(makeEvent({ forwardedFor: '8.8.8.8' }));
    expect(blocked.status).toBe(429);
    // Different forwarded IP should still pass even though same getClientAddress.
    const fresh = await POST(makeEvent({ forwardedFor: '8.8.4.4' }));
    expect(fresh.status).toBe(200);
    await readSseChunks(fresh);
  });

  it('returns 503 when ANTHROPIC_API_KEY is missing (no client)', async () => {
    _setAnthropic(null);
    const res = await POST(makeEvent());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('anthropic_unavailable');
  });

  it('rejects an empty body with 400', async () => {
    const res = await POST(makeEvent({ body: 'not-json' }));
    expect(res.status).toBe(400);
  });
});

// silence unused-import warnings for the typed re-export
void vi;
