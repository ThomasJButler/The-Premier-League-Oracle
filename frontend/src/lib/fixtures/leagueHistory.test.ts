import { describe, expect, it } from 'vitest';
import { LEAGUE_HISTORY, getSeasonRecord, seasonStartYear } from './leagueHistory';

describe('leagueHistory fixture', () => {
  it('covers 33 seasons matching the statsPack horizon', () => {
    expect(LEAGUE_HISTORY).toHaveLength(33);
  });

  it('ranges from 1993/94 to 2025/26 in ascending order', () => {
    expect(LEAGUE_HISTORY[0].season).toBe('1993/94');
    expect(LEAGUE_HISTORY[LEAGUE_HISTORY.length - 1].season).toBe('2025/26');
  });

  it('marks 2025/26 as in-progress with null champion + runnerUp', () => {
    const current = getSeasonRecord('2025/26');
    expect(current).toBeDefined();
    expect(current!.inProgress).toBe(true);
    expect(current!.champion).toBeNull();
    expect(current!.runnerUp).toBeNull();
  });

  it('every non-in-progress season has a champion + runnerUp', () => {
    for (const r of LEAGUE_HISTORY) {
      if (r.inProgress) continue;
      expect(r.champion).not.toBeNull();
      expect(r.runnerUp).not.toBeNull();
      expect(r.champion!.points).toBeGreaterThan(0);
      expect(r.runnerUp!.points).toBeGreaterThan(0);
    }
  });

  it('getSeasonRecord returns undefined for an unknown season', () => {
    expect(getSeasonRecord('1899/00')).toBeUndefined();
  });

  it('seasonStartYear parses the leading year', () => {
    expect(seasonStartYear('2003/04')).toBe(2003);
    expect(seasonStartYear('1999/00')).toBe(1999);
    expect(seasonStartYear('not-a-season')).toBeNull();
  });
});
