import { describe, it, expect } from 'vitest';
import { findCurrentGameweek, fixturesForGameweek, nextKickoff } from './gameweek';
import type { Match } from '../types';

function mk(over: Partial<Match> = {}): Match {
  return {
    id: 'm-1',
    season_id: 's-1',
    date: '2026-04-30T19:00:00Z',
    home_team: 'Liverpool',
    away_team: 'Arsenal',
    home_goals: null,
    away_goals: null,
    result: null,
    home_odds: null,
    draw_odds: null,
    away_odds: null,
    first_half_home_goals: null,
    first_half_away_goals: null,
    full_time_result: null,
    half_time_result: null,
    referee: null,
    home_shots: null,
    away_shots: null,
    home_shots_target: null,
    away_shots_target: null,
    home_fouls: null,
    away_fouls: null,
    home_corners: null,
    away_corners: null,
    home_yellows: null,
    away_yellows: null,
    home_reds: null,
    away_reds: null,
    created_at: '2026-04-26T00:00:00Z',
    status: 'SCHEDULED',
    matchday: 35,
    ...over,
  };
}

describe('lib/gameweek', () => {
  it('findCurrentGameweek returns the matchday of the next non-FINISHED fixture', () => {
    const matches = [
      mk({ id: 'a', matchday: 34, status: 'FINISHED', date: '2026-04-20T15:00:00Z' }),
      mk({ id: 'b', matchday: 35, status: 'SCHEDULED', date: '2026-05-01T15:00:00Z' }),
      mk({ id: 'c', matchday: 36, status: 'SCHEDULED', date: '2026-05-08T15:00:00Z' }),
    ];
    expect(findCurrentGameweek(matches)).toBe(35);
  });

  it('findCurrentGameweek returns null when all matches are finished', () => {
    expect(findCurrentGameweek([mk({ status: 'FINISHED' })])).toBe(null);
  });

  it('findCurrentGameweek returns null when matches lack a matchday', () => {
    expect(findCurrentGameweek([mk({ matchday: undefined, status: 'SCHEDULED' })])).toBe(null);
  });

  it('fixturesForGameweek filters by matchday and excludes FINISHED', () => {
    const matches = [
      mk({ id: 'a', matchday: 35, status: 'SCHEDULED' }),
      mk({ id: 'b', matchday: 35, status: 'FINISHED' }),
      mk({ id: 'c', matchday: 36, status: 'SCHEDULED' }),
    ];
    const out = fixturesForGameweek(matches, 35);
    expect(out.map((m) => m.id)).toEqual(['a']);
  });

  it('nextKickoff returns the earliest upcoming fixture', () => {
    const earlier = mk({ id: 'early', date: '2026-04-30T15:00:00Z' });
    const later = mk({ id: 'late', date: '2026-04-30T19:00:00Z' });
    expect(nextKickoff([later, earlier])?.id).toBe('early');
  });

  it('nextKickoff returns null when no fixtures are scheduled', () => {
    expect(nextKickoff([mk({ status: 'FINISHED' })])).toBe(null);
  });
});
