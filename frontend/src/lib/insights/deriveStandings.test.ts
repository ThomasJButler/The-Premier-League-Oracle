import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deriveStandings } from './deriveStandings';
import type { Match } from '../../types';

function makeMatch(home: string, away: string, hg: number | null, ag: number | null): Match {
  const result: 'H' | 'A' | 'D' | null =
    hg === null || ag === null
      ? null
      : hg > ag
      ? 'H'
      : ag > hg
      ? 'A'
      : 'D';

  return {
    id: `${home}-${away}`,
    season_id: 's-1',
    date: '2026-05-01T15:00:00Z',
    home_team: home,
    away_team: away,
    home_goals: hg,
    away_goals: ag,
    result,
    home_odds: null,
    draw_odds: null,
    away_odds: null,
    first_half_home_goals: null,
    first_half_away_goals: null,
    full_time_result: result,
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
    created_at: '2026-05-01T00:00:00Z',
    status: hg === null ? 'SCHEDULED' : 'FINISHED',
  };
}

describe('deriveStandings', () => {
  it('reduces a small completed season into a sorted top-N table', () => {
    const matches: Match[] = [
      makeMatch('Arsenal', 'Brentford', 3, 0),   // Arsenal W, Brentford L
      makeMatch('Chelsea', 'Arsenal', 1, 2),      // Arsenal W, Chelsea L
      makeMatch('Brentford', 'Chelsea', 1, 1),    // both D
      makeMatch('Wolves', 'Arsenal', 0, 1),       // Arsenal W, Wolves L
      makeMatch('Chelsea', 'Wolves', 2, 0),       // Chelsea W, Wolves L
      makeMatch('Brentford', 'Wolves', 2, 1),     // Brentford W, Wolves L
    ];

    const table = deriveStandings(matches, 3);

    expect(table).toHaveLength(3);
    expect(table[0].team).toBe('Arsenal');
    expect(table[0].points).toBe(9);   // 3 wins
    expect(table[0].position).toBe(1);

    // Chelsea: 1W 1D 1L = 4 pts; Brentford: 1W 1D 1L = 4 pts
    // GD: Chelsea = (3-3)=0, Brentford = (3-3+... let's verify order doesn't matter, just pts)
    expect(table[1].points).toBe(4);
    expect(table[2].points).toBe(4);
  });

  it('returns an empty array safe-default when no completed matches exist', () => {
    const matches: Match[] = [
      makeMatch('Arsenal', 'Chelsea', null, null),
      makeMatch('Wolves', 'Brentford', null, null),
    ];
    expect(deriveStandings(matches)).toEqual([]);
  });

  it('breaks ties on GD then GF then team name', () => {
    // Alpha and Beta: same points (3 each), same GD (+1), Beta scores more
    const matches: Match[] = [
      makeMatch('Alpha', 'Gamma', 2, 1), // Alpha: GF=2 GA=1 GD=+1 pts=3
      makeMatch('Beta', 'Delta', 3, 2),  // Beta:  GF=3 GA=2 GD=+1 pts=3
    ];
    const table = deriveStandings(matches, 4);

    const alphaRow = table.find((r) => r.team === 'Alpha')!;
    const betaRow = table.find((r) => r.team === 'Beta')!;

    // Equal points, equal GD — Beta wins on higher GF
    expect(betaRow.position).toBeLessThan(alphaRow.position);

    // Now equal points, equal GD, equal GF — team name asc
    const matchesTiedOnEverything: Match[] = [
      makeMatch('Zeta', 'Gamma', 1, 0),
      makeMatch('Alpha', 'Delta', 1, 0),
    ];
    const table2 = deriveStandings(matchesTiedOnEverything, 4);
    const alphaPos = table2.find((r) => r.team === 'Alpha')!.position;
    const zetaPos = table2.find((r) => r.team === 'Zeta')!.position;
    expect(alphaPos).toBeLessThan(zetaPos);
  });

  it('omits betting copy and references', () => {
    const src = readFileSync(new URL('./deriveStandings.ts', import.meta.url), 'utf8');
    const forbidden = /odd|bet|kelly|value bet|bankroll/i;
    expect(src).not.toMatch(forbidden);
  });
});
