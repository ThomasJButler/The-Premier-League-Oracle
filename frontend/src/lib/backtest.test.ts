import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BacktestRunner, WeightOptimiser, type BacktestPrediction } from './backtest';
import { OptimizedPredictor } from './optimizedPredictions';
import type { Match } from '../types';
import type { EnhancedPredictionModel } from './optimizedPredictions';

// Mock the predictor — we're testing BacktestRunner logic, not the ensemble
vi.mock('./optimizedPredictions', () => ({
  OptimizedPredictor: {
    predictMatch: vi.fn()
  },
  MODEL_WEIGHTS: { elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 },
  getActiveModelWeights: () => ({ elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 })
}));

// Stateful fake for the shared ELO system — tracks real state so snapshot/restore
// logic is actually exercised (not just called). A no-op mock would hide bugs
// where backtest corrupts live ELO ratings.
const fakeEloState = {
  ratings: {} as Record<string, number>,
  processedIds: new Set<string>()
};

function resetFakeElo(initial: Record<string, number> = { 'Arsenal': 1800, 'Liverpool': 1780 }) {
  fakeEloState.ratings = { ...initial };
  fakeEloState.processedIds = new Set<string>();
}

vi.mock('./advancedPredictions', () => ({
  sharedEloSystem: {
    getAllRatings: vi.fn(() => ({ ...fakeEloState.ratings })),
    setTeamRating: vi.fn((team: string, rating: number) => {
      fakeEloState.ratings[team] = rating;
    }),
    getProcessedMatchIds: vi.fn(() => new Set(fakeEloState.processedIds)),
    setProcessedMatchIds: vi.fn((ids: Set<string>) => {
      fakeEloState.processedIds = new Set(ids);
    })
  },
  EloRatingSystem: { DEFAULT_RATING: 1500 }
}));

const mockPredictMatch = vi.mocked(OptimizedPredictor.predictMatch);

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: '1', season_id: 's1', date: '2025-01-01T15:00:00Z',
    home_team: 'Arsenal', away_team: 'Liverpool',
    home_goals: 2, away_goals: 1, result: 'H',
    home_odds: null, draw_odds: null, away_odds: null,
    first_half_home_goals: null, first_half_away_goals: null,
    full_time_result: null, half_time_result: null,
    referee: 'Michael Oliver', home_shots: null, away_shots: null,
    home_shots_target: null, away_shots_target: null,
    home_fouls: null, away_fouls: null,
    home_corners: null, away_corners: null,
    home_yellows: null, away_yellows: null,
    home_reds: null, away_reds: null,
    created_at: '2025-01-01T15:00:00Z',
    ...overrides
  };
}

function makePrediction(overrides: Partial<EnhancedPredictionModel> = {}): EnhancedPredictionModel {
  return {
    predictedResult: 'H',
    confidence: 0.65,
    predictedHomeGoals: 2,
    predictedAwayGoals: 1,
    homeForm: 'WWDWW',
    awayForm: 'WLDWL',
    modelWeights: { elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 },
    insights: [],
    valueOdds: { home: 1.75, draw: 3.80, away: 5.25 },
    ...overrides
  };
}

describe('BacktestRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFakeElo();
  });

  it('should filter out matches without a result', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'H' }),
      makeMatch({ id: '2', result: null, home_goals: null, away_goals: null }),
      makeMatch({ id: '3', result: 'A' })
    ];

    mockPredictMatch.mockResolvedValue(makePrediction());

    const runner = new BacktestRunner(matches);
    const result = await runner.run();

    // Only 2 matches have results, so only 2 predictions should be made
    expect(mockPredictMatch).toHaveBeenCalledTimes(2);
    expect(result.totalMatches).toBe(2);
  });

  it('should return empty metrics when no valid matches provided', async () => {
    const matches = [
      makeMatch({ id: '1', result: null })
    ];

    const runner = new BacktestRunner(matches);
    const result = await runner.run();

    expect(result.totalMatches).toBe(0);
    expect(result.overallAccuracy).toBe(0);
    expect(result.logLoss).toBe(0);
    expect(result.brierScore).toBe(0);
    expect(result.predictions).toHaveLength(0);
  });

  it('should calculate overall accuracy correctly', async () => {
    const matches = [
      makeMatch({ id: '1', home_team: 'Arsenal', away_team: 'Liverpool', result: 'H' }),
      makeMatch({ id: '2', home_team: 'Chelsea', away_team: 'Spurs', result: 'D' }),
      makeMatch({ id: '3', home_team: 'City', away_team: 'United', result: 'A' }),
      makeMatch({ id: '4', home_team: 'Villa', away_team: 'Everton', result: 'H' })
    ];

    // 3 out of 4 correct
    mockPredictMatch
      .mockResolvedValueOnce(makePrediction({ predictedResult: 'H' }))   // correct
      .mockResolvedValueOnce(makePrediction({ predictedResult: 'D' }))   // correct
      .mockResolvedValueOnce(makePrediction({ predictedResult: 'H' }))   // wrong (actual A)
      .mockResolvedValueOnce(makePrediction({ predictedResult: 'H' }));  // correct

    const runner = new BacktestRunner(matches);
    const result = await runner.run();

    expect(result.totalMatches).toBe(4);
    expect(result.correctPredictions).toBe(3);
    expect(result.overallAccuracy).toBe(0.75);
  });

  it('should calculate per-outcome accuracy', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'H' }),
      makeMatch({ id: '2', result: 'H' }),
      makeMatch({ id: '3', result: 'D' }),
      makeMatch({ id: '4', result: 'A' })
    ];

    mockPredictMatch
      .mockResolvedValueOnce(makePrediction({ predictedResult: 'H' }))   // H correct
      .mockResolvedValueOnce(makePrediction({ predictedResult: 'D' }))   // H wrong
      .mockResolvedValueOnce(makePrediction({ predictedResult: 'D' }))   // D correct
      .mockResolvedValueOnce(makePrediction({ predictedResult: 'A' }));  // A correct

    const runner = new BacktestRunner(matches);
    const result = await runner.run();

    // Home: 2 actual, 1 correct = 50%
    expect(result.outcomeAccuracy.home.total).toBe(2);
    expect(result.outcomeAccuracy.home.correct).toBe(1);
    expect(result.outcomeAccuracy.home.accuracy).toBe(0.5);

    // Draw: 1 actual, 1 correct = 100%
    expect(result.outcomeAccuracy.draw.total).toBe(1);
    expect(result.outcomeAccuracy.draw.correct).toBe(1);
    expect(result.outcomeAccuracy.draw.accuracy).toBe(1);

    // Away: 1 actual, 1 correct = 100%
    expect(result.outcomeAccuracy.away.total).toBe(1);
    expect(result.outcomeAccuracy.away.correct).toBe(1);
    expect(result.outcomeAccuracy.away.accuracy).toBe(1);
  });

  it('should extract probabilities from valueOdds correctly', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'H' })
    ];

    // valueOdds: home=2.0 → raw prob = 1.05/2.0 = 0.525
    //            draw=3.5 → raw prob = 1.05/3.5 = 0.300
    //            away=6.0 → raw prob = 1.05/6.0 = 0.175
    // Total raw = 1.0, so normalised is the same
    mockPredictMatch.mockResolvedValue(
      makePrediction({
        predictedResult: 'H',
        valueOdds: { home: 2.0, draw: 3.5, away: 6.0 }
      })
    );

    const runner = new BacktestRunner(matches);
    const result = await runner.run();

    const probs = result.predictions[0].probabilities;
    expect(probs.home).toBeCloseTo(0.525, 3);
    expect(probs.draw).toBeCloseTo(0.300, 3);
    expect(probs.away).toBeCloseTo(0.175, 3);
    expect(probs.home + probs.draw + probs.away).toBeCloseTo(1.0, 10);
  });

  it('should fall back to confidence-based probabilities when no valueOdds', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'H' })
    ];

    mockPredictMatch.mockResolvedValue(
      makePrediction({
        predictedResult: 'H',
        confidence: 0.60,
        valueOdds: undefined
      })
    );

    const runner = new BacktestRunner(matches);
    const result = await runner.run();

    const probs = result.predictions[0].probabilities;
    expect(probs.home).toBe(0.60);
    expect(probs.draw).toBe(0.20);
    expect(probs.away).toBe(0.20);
  });

  it('should calculate log loss — perfect prediction scores near zero', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'H' })
    ];

    // Near-certain home win prediction
    mockPredictMatch.mockResolvedValue(
      makePrediction({
        predictedResult: 'H',
        valueOdds: { home: 1.07, draw: 21.0, away: 21.0 }
      })
    );

    const runner = new BacktestRunner(matches);
    const result = await runner.run();

    // log loss should be very small (close to 0) for a near-certain correct prediction
    expect(result.logLoss).toBeLessThan(0.1);
    expect(result.logLoss).toBeGreaterThanOrEqual(0);
  });

  it('should calculate log loss — wrong confident prediction scores high', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'A' })
    ];

    // Near-certain home win prediction, but actual is away win
    mockPredictMatch.mockResolvedValue(
      makePrediction({
        predictedResult: 'H',
        valueOdds: { home: 1.07, draw: 21.0, away: 21.0 }
      })
    );

    const runner = new BacktestRunner(matches);
    const result = await runner.run();

    // log loss should be very high for a confident wrong prediction
    expect(result.logLoss).toBeGreaterThan(2);
  });

  it('should calculate Brier score correctly for a perfect prediction', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'H' })
    ];

    // Perfect prediction: p(H) = 1.0, p(D) = 0.0, p(A) = 0.0
    // Brier = (1-1)² + (0-0)² + (0-0)² = 0
    // We can't get exactly 1.0 from valueOdds, so use the fallback
    mockPredictMatch.mockResolvedValue(
      makePrediction({
        predictedResult: 'H',
        confidence: 1.0,
        valueOdds: undefined
      })
    );

    const runner = new BacktestRunner(matches);
    const result = await runner.run();

    expect(result.brierScore).toBe(0);
  });

  it('should calculate Brier score correctly for a completely wrong prediction', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'A' })
    ];

    // Worst case for away: p(H) = 1.0, actual = A
    // Brier = (1-0)² + (0-0)² + (0-1)² = 2.0
    mockPredictMatch.mockResolvedValue(
      makePrediction({
        predictedResult: 'H',
        confidence: 1.0,
        valueOdds: undefined
      })
    );

    const runner = new BacktestRunner(matches);
    const result = await runner.run();

    expect(result.brierScore).toBe(2.0);
  });

  it('should call progress callback with correct counts', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'H' }),
      makeMatch({ id: '2', result: 'D' }),
      makeMatch({ id: '3', result: 'A' })
    ];

    mockPredictMatch.mockResolvedValue(makePrediction());

    const progressCalls: Array<[number, number]> = [];
    const onProgress = (done: number, total: number) => {
      progressCalls.push([done, total]);
    };

    const runner = new BacktestRunner(matches);
    await runner.run(onProgress);

    expect(progressCalls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3]
    ]);
  });

  it('should still report progress when a prediction throws', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'H' }),
      makeMatch({ id: '2', result: 'D' }),
      makeMatch({ id: '3', result: 'A' })
    ];

    mockPredictMatch
      .mockResolvedValueOnce(makePrediction())
      .mockRejectedValueOnce(new Error('Prediction failed'))
      .mockResolvedValueOnce(makePrediction({ predictedResult: 'A' }));

    const progressCalls: Array<[number, number]> = [];
    const runner = new BacktestRunner(matches);
    const result = await runner.run((done, total) => progressCalls.push([done, total]));

    // All 3 progress calls even though match 2 failed
    expect(progressCalls).toHaveLength(3);
    // Only 2 predictions in the result (match 2 skipped)
    expect(result.totalMatches).toBe(2);
  });

  it('should pass only earlier matches as historical context (chronological order)', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'H', date: '2025-01-01T15:00:00Z' }),
      makeMatch({ id: '2', result: 'D', date: '2025-01-08T15:00:00Z' }),
      makeMatch({ id: '3', result: 'A', date: '2025-01-15T15:00:00Z' })
    ];

    mockPredictMatch.mockResolvedValue(makePrediction());

    const runner = new BacktestRunner(matches);
    await runner.run();

    // First call (earliest match): no historical context available
    const firstCallHistory = mockPredictMatch.mock.calls[0][2] as Match[];
    expect(firstCallHistory.map(m => m.id)).toEqual([]);

    // Second call: only the first match is available as history
    const secondCallHistory = mockPredictMatch.mock.calls[1][2] as Match[];
    expect(secondCallHistory.map(m => m.id)).toEqual(['1']);

    // Third call: first two matches available as history
    const thirdCallHistory = mockPredictMatch.mock.calls[2][2] as Match[];
    expect(thirdCallHistory.map(m => m.id)).toEqual(['1', '2']);
  });

  it('should pass referee to predictMatch', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'H', referee: 'Anthony Taylor' })
    ];

    mockPredictMatch.mockResolvedValue(makePrediction());

    const runner = new BacktestRunner(matches);
    await runner.run();

    expect(mockPredictMatch).toHaveBeenCalledWith(
      'Arsenal',
      'Liverpool',
      expect.any(Array),
      'Anthony Taylor',
      '2025-01-01T15:00:00Z'
    );
  });

  it('should handle uniform probability (maximum uncertainty) Brier score', async () => {
    const matches = [
      makeMatch({ id: '1', result: 'H' })
    ];

    // Uniform probabilities: p = 1/3 for each outcome
    // valueOdds where each probability = 1/3 → odds = margin/prob = 1.05/(1/3) = 3.15
    mockPredictMatch.mockResolvedValue(
      makePrediction({
        predictedResult: 'H',
        valueOdds: { home: 3.15, draw: 3.15, away: 3.15 }
      })
    );

    const runner = new BacktestRunner(matches);
    const result = await runner.run();

    // Brier for uniform on 3-class: (1/3-1)² + (1/3-0)² + (1/3-0)² = 4/9 + 1/9 + 1/9 = 6/9 = 2/3
    expect(result.brierScore).toBeCloseTo(2 / 3, 3);
  });

  it('should restore ELO ratings to their pre-backtest state after a run', async () => {
    // Seed with known initial ratings
    resetFakeElo({ 'Arsenal': 1800, 'Liverpool': 1780, 'Chelsea': 1750 });

    const matches = [
      makeMatch({ id: '1', home_team: 'Arsenal', away_team: 'Liverpool', result: 'H' }),
      makeMatch({ id: '2', home_team: 'Chelsea', away_team: 'Arsenal', result: 'D', date: '2025-01-08T15:00:00Z' })
    ];

    // The predictor internally calls sharedEloSystem.setTeamRating during prediction,
    // which mutates our fake state. Simulate this by mutating ratings in the mock.
    mockPredictMatch.mockImplementation(async () => {
      // Simulate ELO updates that would happen during prediction
      fakeEloState.ratings['Arsenal'] = 1820;
      fakeEloState.ratings['Liverpool'] = 1760;
      fakeEloState.ratings['NewTeam'] = 1500; // Simulate a new team appearing
      fakeEloState.processedIds.add('extra-match');
      return makePrediction();
    });

    const runner = new BacktestRunner(matches);
    await runner.run();

    // After the run, ELO state should be restored to the original snapshot
    expect(fakeEloState.ratings['Arsenal']).toBe(1800);
    expect(fakeEloState.ratings['Liverpool']).toBe(1780);
    expect(fakeEloState.ratings['Chelsea']).toBe(1750);
    // New teams created during backtest should be reset to DEFAULT_RATING (1500)
    expect(fakeEloState.ratings['NewTeam']).toBe(1500);
    // Processed match IDs should be restored to the original empty set
    expect(fakeEloState.processedIds.size).toBe(0);
  });

  it('should restore ELO ratings even when all predictions throw', async () => {
    resetFakeElo({ 'Arsenal': 1800, 'Liverpool': 1780 });

    const matches = [
      makeMatch({ id: '1', result: 'H' }),
      makeMatch({ id: '2', result: 'D', date: '2025-01-08T15:00:00Z' })
    ];

    mockPredictMatch.mockImplementation(async () => {
      // Corrupt the state before throwing
      fakeEloState.ratings['Arsenal'] = 9999;
      throw new Error('Prediction failed');
    });

    const runner = new BacktestRunner(matches);
    await runner.run();

    // Despite all predictions failing, ratings should still be restored
    expect(fakeEloState.ratings['Arsenal']).toBe(1800);
    expect(fakeEloState.ratings['Liverpool']).toBe(1780);
  });
});

describe('WeightOptimiser', () => {
  function makeBtPrediction(actual: 'H' | 'D' | 'A', outputs: { elo: number; poisson: number; form: number; h2h: number; standings: number }): BacktestPrediction {
    return {
      matchId: '1',
      homeTeam: 'Arsenal',
      awayTeam: 'Liverpool',
      predictedResult: 'H',
      actualResult: actual,
      correct: actual === 'H',
      confidence: 0.6,
      probabilities: { home: 0.5, draw: 0.25, away: 0.25 },
      modelOutputs: {
        elo: { home: outputs.elo, draw: 0.25, away: 1 - outputs.elo - 0.25 },
        poisson: { home: outputs.poisson, draw: 0.25, away: 1 - outputs.poisson - 0.25 },
        form: { home: outputs.form, draw: 0.25, away: 1 - outputs.form - 0.25 },
        h2h: { home: outputs.h2h, draw: 0.25, away: 1 - outputs.h2h - 0.25 },
        standings: { home: outputs.standings, draw: 0.25, away: 1 - outputs.standings - 0.25 }
      }
    };
  }

  it('should return undefined with fewer than 10 predictions', () => {
    const predictions = Array(5).fill(null).map(() =>
      makeBtPrediction('H', { elo: 0.6, poisson: 0.5, form: 0.5, h2h: 0.5, standings: 0.5 })
    );
    const result = WeightOptimiser.optimise(predictions);
    expect(result).toBeUndefined();
  });

  it('should return undefined when predictions lack model outputs', () => {
    const predictions: BacktestPrediction[] = Array(15).fill(null).map(() => ({
      matchId: '1', homeTeam: 'A', awayTeam: 'B',
      predictedResult: 'H' as const, actualResult: 'H' as const,
      correct: true, confidence: 0.6,
      probabilities: { home: 0.5, draw: 0.25, away: 0.25 }
      // no modelOutputs
    }));
    const result = WeightOptimiser.optimise(predictions);
    expect(result).toBeUndefined();
  });

  it('should find optimal weights with sufficient data', () => {
    // Create 20 predictions where ELO is the best predictor (high home prob when actual is H)
    const predictions: BacktestPrediction[] = [];
    for (let i = 0; i < 20; i++) {
      predictions.push(makeBtPrediction('H', { elo: 0.7, poisson: 0.4, form: 0.3, h2h: 0.3, standings: 0.3 }));
    }
    const result = WeightOptimiser.optimise(predictions);
    expect(result).toBeDefined();
    expect(result!.accuracy).toBeGreaterThanOrEqual(0);
    expect(result!.elo + result!.poisson + result!.form + result!.h2h + result!.standings).toBeCloseTo(1.0, 1);
  });

  it('should favour the model that predicts correctly most often', () => {
    // ELO always predicts home strongly, Poisson always predicts away
    // Actual is always home — optimizer should weight ELO heavily
    const predictions: BacktestPrediction[] = [];
    for (let i = 0; i < 20; i++) {
      predictions.push({
        matchId: String(i), homeTeam: 'A', awayTeam: 'B',
        predictedResult: 'H', actualResult: 'H', correct: true,
        confidence: 0.6, probabilities: { home: 0.5, draw: 0.25, away: 0.25 },
        modelOutputs: {
          elo: { home: 0.8, draw: 0.1, away: 0.1 },
          poisson: { home: 0.1, draw: 0.1, away: 0.8 },
          form: { home: 0.33, draw: 0.34, away: 0.33 },
          h2h: { home: 0.33, draw: 0.34, away: 0.33 },
          standings: { home: 0.33, draw: 0.34, away: 0.33 }
        }
      });
    }
    const result = WeightOptimiser.optimise(predictions);
    expect(result).toBeDefined();
    // ELO should get more weight than Poisson (which always predicts wrong)
    expect(result!.elo).toBeGreaterThan(result!.poisson);
  });

  it('should report improvement over current weights', () => {
    const predictions: BacktestPrediction[] = [];
    for (let i = 0; i < 20; i++) {
      predictions.push(makeBtPrediction('H', { elo: 0.7, poisson: 0.5, form: 0.5, h2h: 0.5, standings: 0.5 }));
    }
    const result = WeightOptimiser.optimise(predictions);
    expect(result).toBeDefined();
    expect(typeof result!.improvement).toBe('number');
  });
});
