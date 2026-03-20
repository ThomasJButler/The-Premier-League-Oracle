import type { Match } from '../types';
import { OptimizedPredictor, MODEL_WEIGHTS, getActiveModelWeights, type EnhancedPredictionModel, type ModelOutputs } from './optimizedPredictions';
import { sharedEloSystem, EloRatingSystem } from './advancedPredictions';

export interface BacktestResult {
  totalMatches: number;
  correctPredictions: number;
  overallAccuracy: number;
  outcomeAccuracy: {
    home: { correct: number; total: number; accuracy: number };
    draw: { correct: number; total: number; accuracy: number };
    away: { correct: number; total: number; accuracy: number };
  };
  logLoss: number;
  brierScore: number;
  predictions: BacktestPrediction[];
  /** Optimal weights found by the weight optimiser (populated after run) */
  optimisedWeights?: OptimisedWeights;
}

export interface BacktestPrediction {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  predictedResult: 'H' | 'D' | 'A';
  actualResult: 'H' | 'D' | 'A';
  correct: boolean;
  confidence: number;
  probabilities: { home: number; draw: number; away: number };
  /** Raw per-model probabilities for weight optimisation */
  modelOutputs?: ModelOutputs;
}

export interface OptimisedWeights {
  elo: number;
  poisson: number;
  form: number;
  h2h: number;
  standings: number;
  accuracy: number;
  logLoss: number;
  improvement: number; // percentage points over current weights
}

export type BacktestProgressCallback = (completed: number, total: number) => void;

import { VALUE_ODDS_MARGIN } from './constants';

/**
 * Extract outcome probabilities from the prediction model.
 *
 * valueOdds are computed as `(1 / probability) * margin`, so we reverse:
 *   probability = margin / odds
 *
 * The raw values won't sum to exactly 1.0 due to the margin, so we
 * renormalise to get a proper probability distribution.
 */
function extractProbabilities(prediction: EnhancedPredictionModel): { home: number; draw: number; away: number } {
  const conf = prediction.confidence;
  const remainder = (1 - conf) / 2;
  const confidenceFallback = prediction.predictedResult === 'H'
    ? { home: conf, draw: remainder, away: remainder }
    : prediction.predictedResult === 'A'
      ? { home: remainder, draw: remainder, away: conf }
      : { home: remainder, draw: conf, away: remainder };

  if (!prediction.valueOdds) return confidenceFallback;

  // Guard against zero odds (division by zero → Infinity/NaN probabilities)
  const { home: ho, draw: dr, away: aw } = prediction.valueOdds;
  if (!ho || !dr || !aw) return confidenceFallback;

  const rawHome = VALUE_ODDS_MARGIN / ho;
  const rawDraw = VALUE_ODDS_MARGIN / dr;
  const rawAway = VALUE_ODDS_MARGIN / aw;
  const total = rawHome + rawDraw + rawAway;

  return {
    home: rawHome / total,
    draw: rawDraw / total,
    away: rawAway / total
  };
}

/**
 * Clamp a probability to avoid log(0) in log loss calculation.
 * Standard epsilon used in sklearn and other ML libraries.
 */
function clamp(p: number): number {
  return Math.max(1e-15, Math.min(1 - 1e-15, p));
}

/**
 * BacktestRunner — runs completed matches through the ensemble predictor
 * and accumulates accuracy metrics.
 *
 * Usage:
 *   const runner = new BacktestRunner(completedMatches);
 *   const result = await runner.run((done, total) => console.log(`${done}/${total}`));
 */
export class BacktestRunner {
  private matches: Match[];

  constructor(matches: Match[]) {
    // Only keep matches with a definitive result, sorted chronologically
    // to prevent data leakage from future matches into ELO state.
    this.matches = matches
      .filter(m => m.result === 'H' || m.result === 'D' || m.result === 'A')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Run the backtest across all completed matches.
   *
   * Matches are processed in chronological order. For each match, only
   * earlier matches are passed as historical context to prevent data leakage.
   * The shared ELO system is snapshot/restored to ensure reproducibility.
   */
  async run(onProgress?: BacktestProgressCallback): Promise<BacktestResult> {
    // Snapshot the shared ELO state so backtesting doesn't corrupt live ratings
    const eloSnapshot = sharedEloSystem.getAllRatings();
    const processedIdsSnapshot = sharedEloSystem.getProcessedMatchIds();

    const predictions: BacktestPrediction[] = [];
    const total = this.matches.length;

    for (let i = 0; i < total; i++) {
      const match = this.matches[i];

      // Historical context: only matches before this one (chronological order)
      const historicalMatches = this.matches.slice(0, i);

      let prediction: EnhancedPredictionModel;
      try {
        prediction = await OptimizedPredictor.predictMatch(
          match.home_team,
          match.away_team,
          historicalMatches,
          match.referee,
          match.date
        );
      } catch {
        // If prediction fails, skip this match
        onProgress?.(i + 1, total);
        continue;
      }

      const probabilities = extractProbabilities(prediction);

      predictions.push({
        matchId: match.id,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        predictedResult: prediction.predictedResult,
        actualResult: match.result!,
        correct: prediction.predictedResult === match.result,
        confidence: prediction.confidence,
        probabilities,
        modelOutputs: prediction.modelOutputs
      });

      onProgress?.(i + 1, total);
    }

    // Restore the shared ELO state to its pre-backtest snapshot.
    // First reset any teams created during the backtest that weren't in the original snapshot
    // (simply restoring known teams leaves stale entries for newly added teams).
    const postBacktestRatings = sharedEloSystem.getAllRatings();
    for (const team of Object.keys(postBacktestRatings)) {
      if (!(team in eloSnapshot)) {
        sharedEloSystem.setTeamRating(team, EloRatingSystem.DEFAULT_RATING);
      }
    }
    for (const [team, rating] of Object.entries(eloSnapshot)) {
      sharedEloSystem.setTeamRating(team, rating);
    }
    sharedEloSystem.setProcessedMatchIds(processedIdsSnapshot);

    const result = this.computeMetrics(predictions);

    // Run weight optimisation over the stored model outputs
    result.optimisedWeights = WeightOptimiser.optimise(predictions);

    return result;
  }

  private computeMetrics(predictions: BacktestPrediction[]): BacktestResult {
    const totalMatches = predictions.length;

    if (totalMatches === 0) {
      return {
        totalMatches: 0,
        correctPredictions: 0,
        overallAccuracy: 0,
        outcomeAccuracy: {
          home: { correct: 0, total: 0, accuracy: 0 },
          draw: { correct: 0, total: 0, accuracy: 0 },
          away: { correct: 0, total: 0, accuracy: 0 }
        },
        logLoss: 0,
        brierScore: 0,
        predictions: []
      };
    }

    const correctPredictions = predictions.filter(p => p.correct).length;

    // Per-outcome accuracy
    const outcomes: Array<'H' | 'D' | 'A'> = ['H', 'D', 'A'];
    const outcomeKeys: Record<string, 'home' | 'draw' | 'away'> = { H: 'home', D: 'draw', A: 'away' };
    const outcomeAccuracy = {
      home: { correct: 0, total: 0, accuracy: 0 },
      draw: { correct: 0, total: 0, accuracy: 0 },
      away: { correct: 0, total: 0, accuracy: 0 }
    };

    for (const outcome of outcomes) {
      const key = outcomeKeys[outcome];
      const matching = predictions.filter(p => p.actualResult === outcome);
      const correct = matching.filter(p => p.predictedResult === outcome).length;
      outcomeAccuracy[key] = {
        correct,
        total: matching.length,
        accuracy: matching.length > 0 ? correct / matching.length : 0
      };
    }

    // Log loss: -1/N * Σ [y_h * log(p_h) + y_d * log(p_d) + y_a * log(p_a)]
    // where y is a one-hot vector for the actual outcome
    let logLossSum = 0;
    for (const p of predictions) {
      const probForActual =
        p.actualResult === 'H' ? p.probabilities.home
          : p.actualResult === 'D' ? p.probabilities.draw
            : p.probabilities.away;
      logLossSum += -Math.log(clamp(probForActual));
    }
    const logLoss = logLossSum / totalMatches;

    // Brier score: 1/N * Σ [(p_h - y_h)² + (p_d - y_d)² + (p_a - y_a)²]
    let brierSum = 0;
    for (const p of predictions) {
      const yHome = p.actualResult === 'H' ? 1 : 0;
      const yDraw = p.actualResult === 'D' ? 1 : 0;
      const yAway = p.actualResult === 'A' ? 1 : 0;

      brierSum +=
        (p.probabilities.home - yHome) ** 2 +
        (p.probabilities.draw - yDraw) ** 2 +
        (p.probabilities.away - yAway) ** 2;
    }
    const brierScore = brierSum / totalMatches;

    return {
      totalMatches,
      correctPredictions,
      overallAccuracy: correctPredictions / totalMatches,
      outcomeAccuracy,
      logLoss,
      brierScore,
      predictions
    };
  }
}

/**
 * WeightOptimiser — tests different ensemble weight combinations against
 * stored model outputs from a backtest run.
 *
 * This is extremely fast because it doesn't re-run predictions. It just
 * re-combines the already-computed per-model probabilities with different
 * weights and scores the resulting predictions.
 */
export class WeightOptimiser {
  /** Step size for weight grid (5% increments) */
  private static readonly STEP = 0.05;

  /**
   * Generate all weight combinations that sum to 1.0 at the given step size.
   * With 5 models and step=0.05, this produces ~10,626 combinations.
   */
  private static generateCombinations(): Array<{ elo: number; poisson: number; form: number; h2h: number; standings: number }> {
    const step = this.STEP;
    const combos: Array<{ elo: number; poisson: number; form: number; h2h: number; standings: number }> = [];

    for (let elo = 0; elo <= 1; elo += step) {
      for (let poisson = 0; poisson <= 1 - elo; poisson += step) {
        for (let form = 0; form <= 1 - elo - poisson; form += step) {
          for (let h2h = 0; h2h <= 1 - elo - poisson - form; h2h += step) {
            const standings = 1 - elo - poisson - form - h2h;
            // Floating point guard — standings should be ≥ 0
            if (standings >= -0.001 && standings <= 1.001) {
              combos.push({
                elo: Math.round(elo * 100) / 100,
                poisson: Math.round(poisson * 100) / 100,
                form: Math.round(form * 100) / 100,
                h2h: Math.round(h2h * 100) / 100,
                standings: Math.round(Math.max(0, standings) * 100) / 100
              });
            }
          }
        }
      }
    }

    return combos;
  }

  /**
   * Combine model outputs with given weights and return the predicted outcome.
   */
  private static combineWithWeights(
    outputs: ModelOutputs,
    weights: { elo: number; poisson: number; form: number; h2h: number; standings: number }
  ): { home: number; draw: number; away: number; predicted: 'H' | 'D' | 'A' } {
    const home =
      outputs.elo.home * weights.elo +
      outputs.poisson.home * weights.poisson +
      outputs.form.home * weights.form +
      outputs.h2h.home * weights.h2h +
      outputs.standings.home * weights.standings;

    const draw =
      outputs.elo.draw * weights.elo +
      outputs.poisson.draw * weights.poisson +
      outputs.form.draw * weights.form +
      outputs.h2h.draw * weights.h2h +
      outputs.standings.draw * weights.standings;

    const away =
      outputs.elo.away * weights.elo +
      outputs.poisson.away * weights.poisson +
      outputs.form.away * weights.form +
      outputs.h2h.away * weights.h2h +
      outputs.standings.away * weights.standings;

    const total = home + draw + away;
    const pH = total > 0 ? home / total : 1 / 3;
    const pD = total > 0 ? draw / total : 1 / 3;
    const pA = total > 0 ? away / total : 1 / 3;

    const predicted = pH > pD && pH > pA ? 'H' as const
      : pA > pD && pA > pH ? 'A' as const
      : 'D' as const;

    return { home: pH, draw: pD, away: pA, predicted };
  }

  /**
   * Find the weight combination that maximises accuracy over the backtest predictions.
   * Returns null if fewer than 10 predictions have model outputs.
   */
  static optimise(predictions: BacktestPrediction[]): OptimisedWeights | undefined {
    // Filter to predictions with stored model outputs
    const withOutputs = predictions.filter(p => p.modelOutputs);
    if (withOutputs.length < 10) return undefined;

    const combos = this.generateCombinations();
    let bestAccuracy = 0;
    let bestLogLoss = Infinity;
    let bestWeights = { elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 };

    // Score the currently active weights (user-applied or default) for comparison
    const currentAccuracy = this.scoreWeights(withOutputs, getActiveModelWeights());

    for (const weights of combos) {
      const accuracy = this.scoreWeights(withOutputs, weights);

      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        bestWeights = weights;
        bestLogLoss = this.scoreLogLoss(withOutputs, weights);
      } else if (accuracy === bestAccuracy) {
        // Tie-break on log loss (lower is better)
        const ll = this.scoreLogLoss(withOutputs, weights);
        if (ll < bestLogLoss) {
          bestLogLoss = ll;
          bestWeights = weights;
        }
      }
    }

    return {
      ...bestWeights,
      accuracy: bestAccuracy,
      logLoss: bestLogLoss,
      improvement: Math.round((bestAccuracy - currentAccuracy) * 10000) / 100
    };
  }

  private static scoreWeights(
    predictions: BacktestPrediction[],
    weights: { elo: number; poisson: number; form: number; h2h: number; standings: number }
  ): number {
    let correct = 0;
    for (const p of predictions) {
      if (!p.modelOutputs) continue;
      const result = this.combineWithWeights(p.modelOutputs, weights);
      if (result.predicted === p.actualResult) correct++;
    }
    return correct / predictions.length;
  }

  private static scoreLogLoss(
    predictions: BacktestPrediction[],
    weights: { elo: number; poisson: number; form: number; h2h: number; standings: number }
  ): number {
    let sum = 0;
    for (const p of predictions) {
      if (!p.modelOutputs) continue;
      const result = this.combineWithWeights(p.modelOutputs, weights);
      const probForActual =
        p.actualResult === 'H' ? result.home
        : p.actualResult === 'D' ? result.draw
        : result.away;
      sum += -Math.log(Math.max(1e-15, Math.min(1 - 1e-15, probForActual)));
    }
    return sum / predictions.length;
  }
}
