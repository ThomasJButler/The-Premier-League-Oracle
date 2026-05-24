import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBroadsheet, writeBroadsheet, clearBroadsheet } from './broadsheetStore';
import type { BroadsheetJson } from '$lib/server/broadsheetPrompt';

const SAMPLE: BroadsheetJson = {
  headline: 'Gameweek read in red ink',
  standfirst: 'Five fixtures, one truth.',
  byline: 'The Voice',
  sections: [{ heading: 'Top of the table', body: 'A taut weekend awaits.' }],
  pullQuote: 'The model is honest about its doubt.',
  closingLine: 'Until next week.'
};

describe('broadsheetStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('returns null when no entry exists', () => {
    expect(readBroadsheet(34, 'voice')).toBeNull();
  });

  it('round-trips a broadsheet keyed by gameweek + persona', () => {
    const entry = writeBroadsheet(34, 'voice', SAMPLE);
    expect(entry.broadsheet.headline).toBe(SAMPLE.headline);
    expect(entry.gameweek).toBe(34);
    expect(entry.personaId).toBe('voice');
    const read = readBroadsheet(34, 'voice');
    expect(read).not.toBeNull();
    expect(read!.broadsheet.standfirst).toBe(SAMPLE.standfirst);
    expect(read!.generatedAt).toBe(entry.generatedAt);
  });

  it('namespaces by both gameweek AND persona', () => {
    writeBroadsheet(34, 'voice', { ...SAMPLE, headline: 'voice GW34' });
    writeBroadsheet(34, 'scouser', { ...SAMPLE, headline: 'macca GW34' });
    writeBroadsheet(35, 'voice', { ...SAMPLE, headline: 'voice GW35' });
    expect(readBroadsheet(34, 'voice')!.broadsheet.headline).toBe('voice GW34');
    expect(readBroadsheet(34, 'scouser')!.broadsheet.headline).toBe('macca GW34');
    expect(readBroadsheet(35, 'voice')!.broadsheet.headline).toBe('voice GW35');
    expect(readBroadsheet(36, 'voice')).toBeNull();
  });

  it('clearBroadsheet removes only the targeted entry', () => {
    writeBroadsheet(34, 'voice', SAMPLE);
    writeBroadsheet(35, 'voice', SAMPLE);
    clearBroadsheet(34, 'voice');
    expect(readBroadsheet(34, 'voice')).toBeNull();
    expect(readBroadsheet(35, 'voice')).not.toBeNull();
  });

  it('recovers from corrupt JSON by returning null', () => {
    localStorage.setItem('kicker:broadsheet:gw34:voice', '{not json');
    expect(readBroadsheet(34, 'voice')).toBeNull();
  });

  it('rejects entries missing required fields', () => {
    localStorage.setItem(
      'kicker:broadsheet:gw34:voice',
      JSON.stringify({ gameweek: 34, personaId: 'voice', generatedAt: 'x' })
    );
    expect(readBroadsheet(34, 'voice')).toBeNull();
  });

  it('rejects entries whose broadsheet payload is malformed', () => {
    localStorage.setItem(
      'kicker:broadsheet:gw34:voice',
      JSON.stringify({
        gameweek: 34,
        personaId: 'voice',
        generatedAt: 'x',
        broadsheet: { headline: 'oops', sections: 'not-an-array' }
      })
    );
    expect(readBroadsheet(34, 'voice')).toBeNull();
  });

  it('honours an explicit generatedAt override', () => {
    const fixed = '2026-05-24T10:00:00.000Z';
    const entry = writeBroadsheet(34, 'voice', SAMPLE, fixed);
    expect(entry.generatedAt).toBe(fixed);
    expect(readBroadsheet(34, 'voice')!.generatedAt).toBe(fixed);
  });
});
