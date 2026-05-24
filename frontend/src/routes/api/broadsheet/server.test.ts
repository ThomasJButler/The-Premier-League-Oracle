import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { POST } from './+server';
import { _setAnthropic, type AnthropicClient } from '$lib/server/anthropic';
import { _resetRateLimit } from '$lib/server/rateLimit';
import { _setContextProvider } from '$lib/server/contextProvider';
import type { KickerContext } from '$lib/context/types';

const sampleContext = (): KickerContext => ({
  fixtures: [
    {
      id: 'm-1',
      home: 'Arsenal',
      away: 'Liverpool',
      kickoff: '2026-05-10T14:00:00Z',
      ourProb: { home: 0.42, draw: 0.27, away: 0.31 }
    }
  ],
  standings: [{ position: 1, team: 'Liverpool', played: 36, points: 84, goalDifference: 47 }],
  accuracyStats: { brier: 0.19, calibration: 1.0, sampleSize: 100 },
  generatedAt: '2026-05-03T12:00:00Z'
});

function makeEvent(body: unknown = { personaId: 'voice', gameweek: 36 }): RequestEvent {
  const request = new Request('http://localhost/api/broadsheet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  return { request, getClientAddress: () => '127.0.0.1' } as unknown as RequestEvent;
}

const VALID_BROADSHEET = JSON.stringify({
  headline: 'Reds Resume Title March',
  standfirst: 'A wet Tuesday at Anfield decides nothing — and everything.',
  byline: 'The Voice of the Kop',
  sections: [
    { heading: 'The match', body: 'Liverpool edged it because the model said so.' }
  ],
  pullQuote: 'Football, bloody hell.',
  closingLine: 'Up the Reds.'
});

function fakeAnthropic(text: string): AnthropicClient {
  return {
    streamText: async function* () {
      yield '';
    },
    createText: async () => text
  };
}

describe('POST /api/broadsheet', () => {
  beforeEach(() => {
    _resetRateLimit();
    _setContextProvider(async () => sampleContext());
  });

  afterEach(() => {
    _setAnthropic(undefined);
    _setContextProvider(undefined);
    _resetRateLimit();
  });

  it('returns parsed broadsheet JSON on the happy path', async () => {
    _setAnthropic(fakeAnthropic(VALID_BROADSHEET));
    const res = await POST(makeEvent());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.broadsheet.headline).toBe('Reds Resume Title March');
    expect(body.broadsheet.sections).toHaveLength(1);
    expect(typeof body.generatedAt).toBe('string');
  });

  it('strips code fences before parsing JSON', async () => {
    _setAnthropic(fakeAnthropic('```json\n' + VALID_BROADSHEET + '\n```'));
    const res = await POST(makeEvent());
    expect(res.status).toBe(200);
  });

  it('returns 500 when the model returns un-parseable JSON', async () => {
    _setAnthropic(fakeAnthropic('this is not json at all'));
    const res = await POST(makeEvent());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('broadsheet_parse_failed');
  });

  it('returns 503 when no Anthropic client is configured', async () => {
    _setAnthropic(null);
    const res = await POST(makeEvent());
    expect(res.status).toBe(503);
  });

  it('rejects bad personaId with 400', async () => {
    _setAnthropic(fakeAnthropic(VALID_BROADSHEET));
    const res = await POST(makeEvent({ personaId: 'nope', gameweek: 36 }));
    expect(res.status).toBe(400);
  });

  it('rejects missing/invalid gameweek with 400', async () => {
    _setAnthropic(fakeAnthropic(VALID_BROADSHEET));
    const res = await POST(makeEvent({ personaId: 'voice', gameweek: 'thirty-six' }));
    expect(res.status).toBe(400);
  });

  describe('kind: season-verdict', () => {
    it('returns the trimmed verdict on the happy path', async () => {
      _setAnthropic(fakeAnthropic('  The Invincibles never lost.  '));
      const res = await POST(
        makeEvent({ kind: 'season-verdict', personaId: 'voice', season: '2003/04' })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.verdict).toBe('The Invincibles never lost.');
      expect(typeof body.generatedAt).toBe('string');
    });

    it('rejects a malformed season string with 400', async () => {
      _setAnthropic(fakeAnthropic('anything'));
      const res = await POST(
        makeEvent({ kind: 'season-verdict', personaId: 'voice', season: 'last-year' })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('invalid_season');
    });

    it('rejects an unknown kind with 400', async () => {
      _setAnthropic(fakeAnthropic('x'));
      const res = await POST(makeEvent({ kind: 'rumours', personaId: 'voice', season: '2003/04' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('unknown_kind');
    });

    it('returns 500 when the model returns an empty verdict', async () => {
      _setAnthropic(fakeAnthropic('   '));
      const res = await POST(
        makeEvent({ kind: 'season-verdict', personaId: 'voice', season: '2003/04' })
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('empty_verdict');
    });
  });

  it('returns 502 when the Anthropic call itself throws', async () => {
    _setAnthropic({
      streamText: async function* () {
        yield '';
      },
      createText: async () => {
        throw new Error('upstream timeout');
      }
    });
    const res = await POST(makeEvent());
    expect(res.status).toBe(502);
  });
});
