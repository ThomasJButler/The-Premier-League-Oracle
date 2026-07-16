import { describe, it, expect, vi } from 'vitest';
import {
  bulkPersistGameweekPredictions,
  isGameweekFullyPredicted,
} from './bulkPersistGameweekPredictions';
import type { Match } from '../types';
import type { EnhancedPredictionModel } from './optimizedPredictions';

function mk(over: Partial<Match> = {}): Match {
  return {
    id: 'm-1',
    season_id: 's-1',
    date: '2026-05-01T15:00:00Z',
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

function fakePrediction(over: Partial<EnhancedPredictionModel> = {}): EnhancedPredictionModel {
  return {
    predictedResult: 'H',
    probabilities: { home: 0.55, draw: 0.25, away: 0.2 },
    confidence: 0.62,
    predictedHomeGoals: 2,
    predictedAwayGoals: 1,
    homeForm: 'WWDLW',
    awayForm: 'LDLWW',
    modelWeights: { elo: 0, poisson: 1, form: 0, h2h: 0, standings: 0 },
    insights: ['Liverpool form trending'],
    valueOdds: { home: 1 / 0.55, draw: 1 / 0.25, away: 1 / 0.2 },
    modelOutputs: {
      class: { home: 0.5, draw: 0.27, away: 0.23 },
      form: { home: 0.56, draw: 0.24, away: 0.2 },
      calibrated: { home: 0.55, draw: 0.25, away: 0.2 },
    },
    topScorelines: [{ score: '2-1', probability: 0.12 }],
    scoreProbabilities: { '2-1': 0.12 },
    expectedGoals: { home: 1.8, away: 1.1 },
    divergenceFlag: false,
    ...over,
  };
}

describe('bulkPersistGameweekPredictions', () => {
  it('persists one prediction per fixture (happy path)', async () => {
    const fixtures = [
      mk({ id: 'a', home_team: 'Liverpool', away_team: 'Arsenal' }),
      mk({ id: 'b', home_team: 'Chelsea', away_team: 'Spurs' }),
    ];
    const store = vi.fn();
    const predict = vi.fn().mockResolvedValue(fakePrediction());
    const out = await bulkPersistGameweekPredictions(fixtures, {
      predict,
      hasExistingPrediction: () => false,
      store,
    });
    expect(out).toEqual({ persisted: 2, skipped: 0, failed: 0 });
    expect(predict).toHaveBeenCalledTimes(2);
    expect(store).toHaveBeenCalledTimes(2);
    expect(store.mock.calls[0][0]).toBe('a');
    expect(store.mock.calls[0][3]).toEqual({
      predictedResult: 'H',
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      confidence: 0.62,
    });
  });

  it('forwards the probability triple so stored predictions are Brier/RPS-scoreable', async () => {
    const store = vi.fn();
    await bulkPersistGameweekPredictions([mk({ id: 'a' })], {
      predict: async () => fakePrediction({ probabilities: { home: 0.5, draw: 0.3, away: 0.2 } }),
      hasExistingPrediction: () => false,
      store,
    });
    const extras = store.mock.calls[0][6];
    expect(extras.poissonProbs).toEqual({ homeWin: 0.5, draw: 0.3, awayWin: 0.2 });
  });

  it('is idempotent — skips fixtures already persisted', async () => {
    const fixtures = [mk({ id: 'a' }), mk({ id: 'b' })];
    const store = vi.fn();
    const predict = vi.fn().mockResolvedValue(fakePrediction());
    const out = await bulkPersistGameweekPredictions(fixtures, {
      predict,
      hasExistingPrediction: (id) => id === 'a',
      store,
    });
    expect(out).toEqual({ persisted: 1, skipped: 1, failed: 0 });
    expect(predict).toHaveBeenCalledTimes(1);
    expect(predict).toHaveBeenCalledWith('Liverpool', 'Arsenal');
    expect(store).toHaveBeenCalledTimes(1);
    expect(store.mock.calls[0][0]).toBe('b');
  });

  it('counts failed predictions without throwing', async () => {
    const fixtures = [mk({ id: 'a' }), mk({ id: 'b' })];
    const store = vi.fn();
    const predict = vi
      .fn<(home: string, away: string) => Promise<EnhancedPredictionModel>>()
      .mockResolvedValueOnce(fakePrediction())
      .mockRejectedValueOnce(new Error('predict blew up'));
    const out = await bulkPersistGameweekPredictions(fixtures, {
      predict,
      hasExistingPrediction: () => false,
      store,
    });
    expect(out).toEqual({ persisted: 1, skipped: 0, failed: 1 });
    expect(store).toHaveBeenCalledTimes(1);
  });

  it('isGameweekFullyPredicted returns true only when every fixture has a stored prediction', () => {
    const fixtures = [mk({ id: 'a' }), mk({ id: 'b' })];
    expect(isGameweekFullyPredicted(fixtures, () => true)).toBe(true);
    expect(isGameweekFullyPredicted(fixtures, (id) => id === 'a')).toBe(false);
    expect(isGameweekFullyPredicted([], () => true)).toBe(false);
  });
});
