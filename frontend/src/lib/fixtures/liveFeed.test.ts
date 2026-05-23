import { describe, expect, it } from 'vitest';
import { getLiveFeed, eventGlyph } from './liveFeed';

describe('getLiveFeed', () => {
  it('returns a non-empty, deterministic feed for a given fixture id', () => {
    const a = getLiveFeed('pl-99-arsliv', 'ARS', 'LIV');
    const b = getLiveFeed('pl-99-arsliv', 'ARS', 'LIV');

    expect(a.events.length).toBeGreaterThan(0);
    expect(a.commentary.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it('sorts events ascending by minute', () => {
    const { events } = getLiveFeed('pl-12-mciche');
    for (let i = 1; i < events.length; i++) {
      expect(events[i].minute).toBeGreaterThanOrEqual(events[i - 1].minute);
    }
  });

  it('threads the supplied team abbrs onto the event rows', () => {
    const { events } = getLiveFeed('pl-77-eveful', 'EVE', 'FUL');
    const abbrs = new Set(events.map((e) => e.teamAbbr));
    expect(abbrs.has('EVE') || abbrs.has('FUL')).toBe(true);
    for (const e of events) {
      expect(['EVE', 'FUL']).toContain(e.teamAbbr);
    }
  });

  it('maps every event type to a glyph', () => {
    const types = ['GOAL', 'OWN_GOAL', 'PENALTY', 'YELLOW', 'RED', 'SUB', 'VAR'] as const;
    for (const t of types) {
      expect(eventGlyph(t)).toBeTruthy();
    }
  });
});
