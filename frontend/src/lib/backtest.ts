import type { Match } from '../types';
import { OptimizedPredictor, type EnhancedPredictionModel } from './optimizedPredictions';
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
        probabilities
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

    return this.computeMetrics(predictions);
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
