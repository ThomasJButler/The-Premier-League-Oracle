import { describe, expect, it } from 'vitest';
import { isTvPick, tvTeamsFrom } from './fixtureFilters';
import type { Match, Standing } from '../types';

function standing(position: number, name: string): Standing {
  return {
    position,
    team: { id: position, name, shortName: name, tla: name.slice(0, 3).toUpperCase(), crest: '' },
  } as Standing;
}

function match(home: string, away: string): Match {
  return {
    id: `${home}-vs-${away}`,
    season_id: '2025',
    date: '2026-08-01T15:00:00Z',
    home_team: home,
    away_team: away,
    home_goals: null,
    away_goals: null,
    result: null,
  } as Match;
}

const standings: Standing[] = [
  standing(1, 'Liverpool'),
  standing(7, 'Aston Villa'),
  standing(8, 'Brighton'),
  standing(15, 'Everton'),
];

describe('tvTeamsFrom', () => {
  it('returns team names with position <= 8', () => {
    expect(tvTeamsFrom(standings)).toEqual(['Liverpool', 'Aston Villa', 'Brighton']);
  });

  it('returns an empty list when standings are empty', () => {
    expect(tvTeamsFrom([])).toEqual([]);
  });
});

describe('isTvPick', () => {
  const tvTeams = tvTeamsFrom(standings);

  it('is a TV pick when both sides are top-8 (7th v 8th)', () => {
    expect(isTvPick(match('Aston Villa', 'Brighton'), tvTeams)).toBe(true);
  });

  it('is NOT a TV pick when only one side is top-8 (1st v 15th) — distinct from TOP 6 semantics', () => {
    const fixture = match('Liverpool', 'Everton');
    // Under the page's TOP 6 filter (either side top-6) this fixture WOULD match,
    // since Liverpool is 1st. TV PICKS requires BOTH sides top-8, so it does not.
    expect(isTvPick(fixture, tvTeams)).toBe(false);
  });
});
