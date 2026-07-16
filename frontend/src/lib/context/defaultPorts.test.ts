import { describe, it, expect } from 'vitest';
import { defaultPorts, resolveAccuracyStats, __test } from './defaultPorts';
import type { Match, Standing } from '../../types';
import { VALUE_ODDS_MARGIN } from '../constants';

const baseMatch: Match = {
  id: 'm1',
  season_id: 's1',
  date: '2026-05-10T14:00:00Z',
  home_team: 'Arsenal',
  away_team: 'Chelsea',
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
  created_at: '2026-05-01T00:00:00Z'
};

const fakeStanding = (overrides: Partial<Standing> & { name: string; position: number }): Standing => ({
  position: overrides.position,
  team: { id: 1, name: overrides.name, shortName: overrides.name, tla: overrides.name.slice(0, 3).toUpperCase(), crest: '' },
  playedGames: overrides.playedGames ?? 30,
  form: null,
  won: 20, draw: 5, lost: 5,
  points: overrides.points ?? 65,
  goalsFor: 60, goalsAgainst: 30,
  goalDifference: overrides.goalDifference ?? 30
});

const stubTracker = (overrides?: Partial<{ brierScore: number; rps: number; scoredSampleSize: number; totalPredictions: number; factors: { highBand: number; mediumBand: number; lowBand: number } }>) => ({
  getAccuracyStats: () => ({
    brierScore: overrides?.brierScore ?? 0.21,
    rps: overrides?.rps ?? 0.19,
    scoredSampleSize: overrides?.scoredSampleSize ?? 42,
    totalPredictions: overrides?.totalPredictions ?? 42
  }),
  getCalibrationFactors: () => overrides?.factors ?? { highBand: 1, mediumBand: 1, lowBand: 1 }
});

describe('defaultPorts: marketImpliedFromMatch', () => {
  it('returns undefined when any odd is missing', () => {
    expect(__test.marketImpliedFromMatch(baseMatch)).toBeUndefined();
  });

  it('normalises decimal odds to probabilities summing to 1', () => {
    const m = { ...baseMatch, home_odds: 2.0, draw_odds: 3.5, away_odds: 4.0 };
    const implied = __test.marketImpliedFromMatch(m)!;
    const sum = implied.home + implied.draw + implied.away;
    expect(sum).toBeCloseTo(1, 6);
    // Ordering: shortest odds → largest probability
    expect(implied.home).toBeGreaterThan(implied.draw);
    expect(implied.draw).toBeGreaterThan(implied.away);
  });
});

describe('defaultPorts: probsFromValueOdds', () => {
  it('returns uniform 1/3 when valueOdds missing', () => {
    const p = __test.probsFromValueOdds(undefined);
    expect(p.home).toBeCloseTo(1 / 3);
    expect(p.draw).toBeCloseTo(1 / 3);
    expect(p.away).toBeCloseTo(1 / 3);
  });

  it('inverts valueOdds and re-normalises so probs sum to 1', () => {
    // If raw probabilities were 0.5/0.3/0.2, valueOdds = MARGIN/p
    const raw = { home: 0.5, draw: 0.3, away: 0.2 };
    const valueOdds = {
      home: VALUE_ODDS_MARGIN / raw.home,
      draw: VALUE_ODDS_MARGIN / raw.draw,
      away: VALUE_ODDS_MARGIN / raw.away
    };
    const p = __test.probsFromValueOdds(valueOdds);
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 6);
    expect(p.home).toBeCloseTo(0.5, 4);
    expect(p.draw).toBeCloseTo(0.3, 4);
    expect(p.away).toBeCloseTo(0.2, 4);
  });
});

describe('defaultPorts: matchToFixtureContext', () => {
  it('uses the engine probabilities verbatim when the port provides them', async () => {
    // No valueOdds round-trip: the triple that determined the pick is the
    // triple the columnists read.
    const fix = await __test.matchToFixtureContext(baseMatch, async () => ({
      predictedResult: 'H',
      confidence: 0.62,
      probabilities: { home: 0.62, draw: 0.23, away: 0.15 },
      valueOdds: { home: 99, draw: 99, away: 99 } // must be ignored
    }));
    expect(fix.ourProb).toEqual({ home: 0.62, draw: 0.23, away: 0.15 });
  });

  it('omits marketImplied + valueEdge when match carries no odds', async () => {
    const fix = await __test.matchToFixtureContext(baseMatch, async () => ({
      predictedResult: 'H',
      confidence: 0.55,
      valueOdds: { home: VALUE_ODDS_MARGIN / 0.6, draw: VALUE_ODDS_MARGIN / 0.25, away: VALUE_ODDS_MARGIN / 0.15 }
    }));
    expect(fix.marketImplied).toBeUndefined();
    expect(fix.valueEdge).toBeUndefined();
    expect(fix.ourProb.home).toBeCloseTo(0.6, 4);
  });

  it('computes valueEdge as ourProb[pick] − marketImplied[pick]', async () => {
    const m = { ...baseMatch, home_odds: 2.5, draw_odds: 3.5, away_odds: 3.0 };
    const fix = await __test.matchToFixtureContext(m, async () => ({
      predictedResult: 'H',
      confidence: 0.5,
      // ourProb home = 0.5
      valueOdds: { home: VALUE_ODDS_MARGIN / 0.5, draw: VALUE_ODDS_MARGIN / 0.3, away: VALUE_ODDS_MARGIN / 0.2 }
    }));
    expect(fix.marketImplied).toBeDefined();
    const expectedEdge = fix.ourProb.home - fix.marketImplied!.home;
    expect(fix.valueEdge).toBeCloseTo(expectedEdge, 6);
    expect(fix.valueEdge).toBeGreaterThan(0); // 0.5 ourProb beats ~0.41 implied
  });

  it('falls back to uniform probs when predictMatch throws', async () => {
    const fix = await __test.matchToFixtureContext(baseMatch, async () => {
      throw new Error('engine outage');
    });
    expect(fix.ourProb.home).toBeCloseTo(1 / 3);
    expect(fix.ourProb.draw).toBeCloseTo(1 / 3);
    expect(fix.ourProb.away).toBeCloseTo(1 / 3);
  });
});

describe('defaultPorts: resolveAccuracyStats', () => {
  const live = { brierScore: 0.58, rps: 0.19, scoredSampleSize: 25, totalPredictions: 30, calibration: 0.95 };
  const fitted = {
    backtest: { rps: 0.2, brier: 0.6, logLoss: 1, accuracy: 0.5, ece: 0.03, sampleSize: 2660, seasons: 'x' },
  };

  it('prefers live tracked evidence once anything has been scored', () => {
    const stats = resolveAccuracyStats(live, fitted);
    expect(stats.source).toBe('live');
    expect(stats.brier).toBeCloseTo(0.58);
    expect(stats.scoredSampleSize).toBe(25);
  });

  it('falls back to the fitted walk-forward evidence before any live scoring', () => {
    const stats = resolveAccuracyStats({ ...live, scoredSampleSize: 0 }, fitted);
    expect(stats.source).toBe('backtest');
    expect(stats.rps).toBeCloseTo(0.2);
    expect(stats.sampleSize).toBe(2660);
    // ECE 0.03 → calibration scalar 0.97 ("1 = perfect" convention).
    expect(stats.calibration).toBeCloseTo(0.97);
  });

  it('stays on (empty) live stats when the engine is unfitted', () => {
    const stats = resolveAccuracyStats({ ...live, scoredSampleSize: 0 }, undefined);
    expect(stats.source).toBe('live');
    expect(stats.scoredSampleSize).toBe(0);
  });
});

describe('defaultPorts: standingToRow', () => {
  it('flattens nested team object to plain string + numeric columns', () => {
    const row = __test.standingToRow(fakeStanding({ name: 'Arsenal', position: 1, points: 80 }));
    expect(row).toEqual({ position: 1, team: 'Arsenal', played: 30, points: 80, goalDifference: 30 });
  });
});

describe('defaultPorts: KickerContextPorts integration', () => {
  it('maps fixtures + standings + accuracy stats end-to-end with injected deps', async () => {
    const ports = defaultPorts({
      dataService: {
        getMatches: async () => [baseMatch, { ...baseMatch, id: 'm2', home_team: 'City', away_team: 'Spurs' }],
        getStandings: async () => [
          fakeStanding({ name: 'Arsenal', position: 1, points: 80 }),
          fakeStanding({ name: 'City', position: 2, points: 78 })
        ]
      },
      predictionTracker: stubTracker({ brierScore: 0.18, totalPredictions: 100, factors: { highBand: 0.9, mediumBand: 1.1, lowBand: 1.0 } }),
      predictMatch: async () => ({ predictedResult: 'H', confidence: 0.5, valueOdds: undefined })
    });

    const fixtures = await ports.getUpcomingFixtures({ daysAhead: 7 });
    expect(fixtures).toHaveLength(2);
    expect(fixtures[1].id).toBe('m2');

    const standings = await ports.getStandings();
    expect(standings.map((r) => r.team)).toEqual(['Arsenal', 'City']);

    const accuracy = await ports.getAccuracyStats();
    expect(accuracy.brier).toBeCloseTo(0.18);
    expect(accuracy.rps).toBeCloseTo(0.19);
    expect(accuracy.sampleSize).toBe(100);
    expect(accuracy.scoredSampleSize).toBe(42);
    // calibrationIndex with factors {0.9, 1.1, 1.0}: meanDev = (0.1 + 0.1 + 0)/3 ≈ 0.0667
    expect(accuracy.calibration).toBeCloseTo(1 - (0.2 / 3), 6);
  });

  it('returns empty arrays when dataService returns no matches/standings', async () => {
    const ports = defaultPorts({
      dataService: {
        getMatches: async () => [],
        getStandings: async () => []
      },
      predictionTracker: stubTracker(),
      predictMatch: async () => ({ predictedResult: 'D', confidence: 0.33, valueOdds: undefined })
    });
    expect(await ports.getUpcomingFixtures({ daysAhead: 7 })).toEqual([]);
    expect(await ports.getStandings()).toEqual([]);
  });
});
