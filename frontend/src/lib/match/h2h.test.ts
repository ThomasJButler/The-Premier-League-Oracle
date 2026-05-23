import { describe, expect, it } from 'vitest';
import { recentH2H } from './h2h';
import type { Match } from '../../types';

function m(partial: Partial<Match>): Match {
  return {
    id: 'x',
    season_id: 's',
    date: '2024-01-01T15:00:00Z',
    home_team: 'Arsenal',
    away_team: 'Liverpool',
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
    created_at: '',
    ...partial,
  };
}

describe('recentH2H', () => {
  it('returns prior meetings newest-first, capped to limit', () => {
    const matches: Match[] = [
      m({ id: '1', date: '2023-09-01', home_team: 'Arsenal', away_team: 'Liverpool', home_goals: 2, away_goals: 1 }),
      m({ id: '2', date: '2023-12-01', home_team: 'Liverpool', away_team: 'Arsenal', home_goals: 1, away_goals: 1 }),
      m({ id: '3', date: '2024-02-01', home_team: 'Arsenal', away_team: 'Liverpool', home_goals: 0, away_goals: 3 }),
      m({ id: '4', date: '2024-03-15', home_team: 'Arsenal', away_team: 'Chelsea', home_goals: 1, away_goals: 0 }),
    ];
    const out = recentH2H(matches, 'Arsenal', 'Liverpool', '2025-01-01', 5);
    expect(out.map((x) => x.id)).toEqual(['3', '2', '1']);
  });

  it('reports the winner relative to teamA', () => {
    const matches: Match[] = [
      m({ id: 'a', date: '2023-09-01', home_team: 'Arsenal', away_team: 'Liverpool', home_goals: 2, away_goals: 1 }),
      m({ id: 'b', date: '2023-12-01', home_team: 'Liverpool', away_team: 'Arsenal', home_goals: 3, away_goals: 0 }),
      m({ id: 'c', date: '2024-02-01', home_team: 'Liverpool', away_team: 'Arsenal', home_goals: 1, away_goals: 1 }),
    ];
    const out = recentH2H(matches, 'Arsenal', 'Liverpool', '2025-01-01');
    const byId = Object.fromEntries(out.map((x) => [x.id, x.winner]));
    expect(byId).toEqual({ a: 'home', b: 'away', c: 'draw' });
  });

  it('skips unfinished matches and respects the strict cutoff', () => {
    const matches: Match[] = [
      m({ id: '1', date: '2023-09-01', home_team: 'Arsenal', away_team: 'Liverpool', home_goals: 2, away_goals: 1 }),
      m({ id: '2', date: '2024-05-01', home_team: 'Arsenal', away_team: 'Liverpool', home_goals: 0, away_goals: 1 }),
      m({ id: '3', date: '2024-04-01', home_team: 'Arsenal', away_team: 'Liverpool', home_goals: null, away_goals: null }),
    ];
    const out = recentH2H(matches, 'Arsenal', 'Liverpool', '2024-05-01');
    expect(out.map((x) => x.id)).toEqual(['1']);
  });
});
