import { describe, it, expect } from 'vitest';
import { toCsvName, isKnownCsvTeam, KNOWN_CSV_TEAMS } from './teamNames';
import { loadArchive } from '../backtest/archiveLoader';

describe('toCsvName', () => {
  it('passes CSV canonical names through unchanged', () => {
    expect(toCsvName('Arsenal')).toBe('Arsenal');
    expect(toCsvName("Nott'm Forest")).toBe("Nott'm Forest");
    expect(toCsvName('Sheffield Weds')).toBe('Sheffield Weds');
  });

  it('resolves Football-Data.org API v4 names', () => {
    expect(toCsvName('Arsenal FC')).toBe('Arsenal');
    expect(toCsvName('AFC Bournemouth')).toBe('Bournemouth');
    expect(toCsvName('Manchester United FC')).toBe('Man United');
    expect(toCsvName('Nottingham Forest FC')).toBe("Nott'm Forest");
    expect(toCsvName('Wolverhampton Wanderers FC')).toBe('Wolves');
    expect(toCsvName('Brighton & Hove Albion FC')).toBe('Brighton');
    expect(toCsvName('Sunderland AFC')).toBe('Sunderland');
  });

  it('resolves short and colloquial forms case-insensitively', () => {
    expect(toCsvName('spurs')).toBe('Tottenham');
    expect(toCsvName('Man Utd')).toBe('Man United');
    expect(toCsvName('wolves')).toBe('Wolves');
    expect(toCsvName('LIVERPOOL')).toBe('Liverpool');
    expect(toCsvName('Sheffield Wednesday')).toBe('Sheffield Weds');
  });

  it('returns undefined for unknown teams instead of guessing', () => {
    expect(toCsvName('Real Madrid')).toBeUndefined();
    expect(toCsvName('')).toBeUndefined();
  });
});

describe('KNOWN_CSV_TEAMS vs the real 33-season archive', () => {
  // The load-bearing invariant: every team name that appears anywhere in the
  // CSV archive must be a known canonical name. If football-data.co.uk ever
  // introduces a new spelling (or a club we've never seen is promoted), this
  // test fails loudly instead of the engine silently treating a real club as
  // an unknown promoted side.
  it('covers every distinct team name in the archive', () => {
    const archive = loadArchive();
    expect(archive.length).toBeGreaterThan(12000);

    const seen = new Set<string>();
    for (const m of archive) {
      seen.add(m.home);
      seen.add(m.away);
    }

    const unknown = [...seen].filter((name) => !isKnownCsvTeam(name));
    expect(unknown).toEqual([]);
    // And the reverse: no phantom entries in the canonical list.
    const phantom = KNOWN_CSV_TEAMS.filter((name) => !seen.has(name));
    expect(phantom).toEqual([]);
  });
});
