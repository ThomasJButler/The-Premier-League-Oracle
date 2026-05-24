import { describe, expect, it } from 'vitest';
import { buildIndex, searchIndex } from './buildIndex';
import type { Match } from '../../types';
import type { FDScorer } from '../../services/api/footballData';
import type { SeasonRecord } from '../fixtures/leagueHistory';
import type { OracleThread } from '../stores/threads';

function makeMatch(over: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    season_id: 's',
    date: '2026-05-24T15:00:00Z',
    home_team: 'Arsenal',
    away_team: 'Liverpool',
    home_goals: null,
    away_goals: null,
    result: null,
    home_odds: null, draw_odds: null, away_odds: null,
    first_half_home_goals: null, first_half_away_goals: null,
    full_time_result: null, half_time_result: null,
    referee: null,
    home_shots: null, away_shots: null,
    home_shots_target: null, away_shots_target: null,
    home_fouls: null, away_fouls: null,
    home_corners: null, away_corners: null,
    home_yellows: null, away_yellows: null,
    home_reds: null, away_reds: null,
    created_at: '',
    matchday: 38,
    ...over,
  };
}

const scorer: FDScorer = {
  player: { id: 1, name: 'Mohamed Salah' } as FDScorer['player'],
  team: { id: 2, name: 'Liverpool', shortName: 'Liverpool', tla: 'LIV', crest: '' },
  goals: 22,
  assists: 7,
  penalties: 4,
};

const seasons: SeasonRecord[] = [
  { season: '2003/04', champion: { team: 'Arsenal', points: 90, goalDifference: 47 }, runnerUp: { team: 'Chelsea', points: 79 } },
  { season: '2025/26', champion: null, runnerUp: null, inProgress: true },
];

const thread: OracleThread = {
  id: 'thr-1',
  title: 'Arsenal title chances',
  messages: [{ role: 'user', content: 'Can Arteta keep them top?', timestamp: 0 }],
  createdAt: 0,
  updatedAt: 0,
};

describe('buildIndex', () => {
  it('emits one item per source entry, typed by kind', () => {
    const items = buildIndex({
      matches: [makeMatch()],
      scorers: [scorer],
      seasons,
      threads: [thread],
    });
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.kind).sort()).toEqual(['fixture', 'player', 'season', 'season', 'thread']);
  });

  it('fixture item carries href + GW sub + opponent label', () => {
    const [fx] = buildIndex({ matches: [makeMatch()], scorers: [], seasons: [], threads: [] });
    expect(fx.kind).toBe('fixture');
    expect(fx.label).toBe('Arsenal v Liverpool');
    expect(fx.sub).toBe('2026-05-24 · GW38');
    expect(fx.href).toBe('/fixtures/m1');
  });

  it('player item carries goals sub + NO href (player profile is K1g)', () => {
    const [pl] = buildIndex({ matches: [], scorers: [scorer], seasons: [], threads: [] });
    expect(pl.kind).toBe('player');
    expect(pl.label).toBe('Mohamed Salah');
    expect(pl.sub).toBe('Liverpool · 22 goals');
    expect(pl.href).toBeUndefined();
  });

  it('season item URL-encodes the slash in the season key', () => {
    const items = buildIndex({ matches: [], scorers: [], seasons, threads: [] });
    const arsenal = items.find((i) => i.label === '2003/04')!;
    expect(arsenal.href).toBe('/insights/archive?season=2003%2F04');
    expect(arsenal.sub).toBe('Won by Arsenal');
    const inProgress = items.find((i) => i.label === '2025/26')!;
    expect(inProgress.sub).toBe('In progress');
  });

  it('thread item routes to /oracle with thread query', () => {
    const [t] = buildIndex({ matches: [], scorers: [], seasons: [], threads: [thread] });
    expect(t.kind).toBe('thread');
    expect(t.href).toBe('/oracle?thread=thr-1');
    expect(t.sub).toBe('1 message');
  });
});

describe('searchIndex', () => {
  const items = buildIndex({ matches: [makeMatch()], scorers: [scorer], seasons, threads: [thread] });

  it('returns empty for whitespace-only query', () => {
    expect(searchIndex(items, '   ')).toEqual([]);
  });

  it('matches by team name substring across kinds', () => {
    const res = searchIndex(items, 'liverpool');
    const kinds = res.map((r) => r.item.kind);
    expect(kinds).toContain('fixture');
    expect(kinds).toContain('player');
  });

  it('ranks exact season label highest', () => {
    const res = searchIndex(items, '2003/04');
    expect(res[0]?.item.label).toBe('2003/04');
  });

  it('returns nothing for a query with no token hits', () => {
    expect(searchIndex(items, 'xyzqqq')).toEqual([]);
  });

  it('respects the limit', () => {
    const many = buildIndex({
      matches: Array.from({ length: 30 }, (_, i) => makeMatch({ id: `m${i}`, home_team: 'Arsenal', away_team: `Team${i}` })),
      scorers: [], seasons: [], threads: [],
    });
    expect(searchIndex(many, 'arsenal', 10)).toHaveLength(10);
  });

  it('AND-combines multi-token queries (every token must hit something)', () => {
    const res = searchIndex(items, 'arsenal liverpool');
    expect(res).toHaveLength(1);
    expect(res[0]?.item.kind).toBe('fixture');
  });
});
