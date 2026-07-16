import { isDemoMode as demoModeActive } from '../lib/demo/demoMode';
import { DEMO_PREDICTIONS } from '../lib/demo';
import { brier, rps, type ProbTriple } from '../lib/engine/metrics';

/**
 * Bumped whenever the prediction pipeline changes in a way that would make
 * stored scoreline / result / confidence values disagree with what the current
 * model would produce (fatigue fix, tier-blend lambdas, bet-builder grid
 * reuse, etc). Stored predictions with a missing or different modelVersion are
 * treated as stale for unplayed fixtures — the card reverts to "pending" so
 * the user gets a fresh forecast. Completed-match history (those with
 * actualResult set) is preserved regardless for accuracy tracking.
 *
 * v3.6-probs: bulk persistence stores the final combined probability triple
 * on every prediction (poissonProbs — historical field name, kept for
 * localStorage compatibility), so Brier/RPS scoring covers real predictions.
 *
 * butler-1.0: the Butler model (time-decayed Dixon-Coles, walk-forward
 * calibrated) replaced the five-heuristic ensemble after winning the
 * backtest gate on every proper score (see lib/backtest/pins.json).
 */
export const MODEL_VERSION = 'butler-1.0';

export interface StoredPrediction {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  predictedResult: 'H' | 'A' | 'D';
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  confidence: number;
  actualResult?: 'H' | 'A' | 'D';
  actualHomeGoals?: number;
  actualAwayGoals?: number;
  isCorrect?: boolean;
  timestamp: string;
  matchDate: string;
  matchday?: number; // Gameweek number (1-38)
  modelVersion?: string; // Pipeline version at prediction time — see MODEL_VERSION
  homeForm?: string; // Last-5 form string e.g. "WWDLL"
  awayForm?: string;
  keyFactors?: string[]; // Insight bullets shown in detailed analysis
  /**
   * The final combined H/D/A probability triple at prediction time.
   * Historical field name (it once held the raw Poisson triple) retained so
   * previously stored predictions keep parsing; since v3.6-probs it carries
   * the full ensemble output and is written on every bulk-persisted
   * prediction. Predictions without it (legacy) count toward hit-rate but
   * cannot be Brier/RPS-scored.
   */
  poissonProbs?: { homeWin: number; draw: number; awayWin: number };
}

export interface GameweekAccuracy {
  matchday: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
}

export interface AccuracyStats {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  /** Mean Brier score across settled predictions with poissonProbs. Range [0, 2]. Lower is better. */
  brierScore: number;
  /** Mean ranked probability score across the same scored set. Range [0, 1]. Lower is better. */
  rps: number;
  /**
   * How many settled predictions actually carried a probability triple —
   * the denominator behind brierScore/rps. When 0, those metrics are
   * meaningless (not "perfect") and consumers must say so.
   */
  scoredSampleSize: number;
  scoreAccuracy: number; // Exact score accuracy
  highConfidenceAccuracy: number; // Accuracy when confidence > 70%
  mediumConfidenceAccuracy: number; // Accuracy when confidence 50-70%
  lowConfidenceAccuracy: number; // Accuracy when confidence < 50%
  homeWinAccuracy: number;
  awayWinAccuracy: number;
  drawAccuracy: number;
  averageConfidence: number;
  streak: {
    current: number;
    best: number;
    worst: number;
  };
}

/**
 * Calibration factors per confidence band.
 *
 * Each factor = (actual accuracy in band) / (average stated confidence in band).
 * A factor < 1 means the model is overconfident; > 1 means underconfident.
 * Applied as a multiplier to raw confidence scores so future predictions
 * reflect historical reliability. Defaults to 1.0 when insufficient data.
 */
export interface CalibrationFactors {
  highBand: number;   // Multiplier for confidence > 0.7
  mediumBand: number; // Multiplier for confidence 0.5–0.7
  lowBand: number;    // Multiplier for confidence < 0.5
}

/**
 * One bin of a calibration curve. The curve plots predicted confidence
 * (x-axis) against actual hit rate (y-axis) across uniformly-sized bins
 * over [0, 1]. Empty bins are emitted with sampleCount = 0 so the SVG
 * can render an even x-axis; their `predicted` falls back to the bin
 * midpoint so the empty-state rendering stays geometrically sane.
 */
export interface CalibrationBin {
  bin: number;        // 0..bins-1
  predicted: number;  // Mean stated confidence inside the bin (or midpoint if empty)
  actual: number;     // Hit rate inside the bin (0 if empty)
  sampleCount: number;
}

class PredictionTracker {
  private readonly STORAGE_KEY = 'pl_oracle_predictions';
  /** Minimum settled predictions per band before calibration applies */
  private static readonly MIN_CALIBRATION_SAMPLES = 10;
  private predictions: Map<string, StoredPrediction>;
  private demoOverlayActive = false;
  constructor() {
    this.predictions = new Map();
    this.loadPredictions();
    this.applyDemoOverlay();
    this.cleanOldPredictions();
    this.cleanOrphanedEngineKeys();
  }

  /**
   * One-time hygiene: the pre-Butler engine persisted per-browser state that
   * no longer has an owner (ELO ratings, processed-match ids, custom ensemble
   * weights). Removing it reclaims storage and guarantees nothing ever reads
   * stale ratings again.
   */
  private cleanOrphanedEngineKeys(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      for (const key of ['elo_ratings', 'elo_processed_match_ids', 'oracle_model_weights']) {
        localStorage.removeItem(key);
      }
    } catch {
      // Storage unavailable — nothing to clean
    }
  }

  // When demo mode is active, layer DEMO_PREDICTIONS on top of whatever was
  // loaded from localStorage so the Predictions / Today / Insights surfaces
  // have realistic content for screenshots. Persistence is suppressed while
  // the overlay is active so we don't pollute real-user localStorage.
  private applyDemoOverlay(): void {
    if (!demoModeActive()) return;
    this.demoOverlayActive = true;
    for (const p of DEMO_PREDICTIONS) {
      this.predictions.set(p.matchId, p);
    }
  }

  // Load predictions from localStorage
  private loadPredictions(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.predictions = new Map(Object.entries(parsed));
      }
    } catch (_error) {
      // Error loading predictions, using empty map
      this.predictions = new Map();
    }
  }

  // Save predictions to localStorage
  private savePredictions(): void {
    if (this.demoOverlayActive) return; // never persist demo overlay
    if (typeof localStorage === 'undefined') return;
    try {
      const toStore = Object.fromEntries(this.predictions);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toStore));
    } catch (_error) {
      // Error saving predictions to localStorage
    }
  }

  // Store a new prediction
  public storePrediction(
    matchId: string,
    homeTeam: string,
    awayTeam: string,
    prediction: {
      predictedResult: 'H' | 'A' | 'D';
      predictedHomeGoals: number;
      predictedAwayGoals: number;
      confidence: number;
    },
    matchDate: string,
    matchday?: number,
    extras?: {
      modelVersion?: string;
      homeForm?: string;
      awayForm?: string;
      keyFactors?: string[];
      poissonProbs?: { homeWin: number; draw: number; awayWin: number };
    }
  ): void {
    const id = `${matchId}_${crypto.randomUUID()}`;
    const storedPrediction: StoredPrediction = {
      id,
      matchId,
      homeTeam,
      awayTeam,
      ...prediction,
      timestamp: new Date().toISOString(),
      matchDate,
      ...(matchday !== undefined ? { matchday } : {}),
      ...(extras?.modelVersion !== undefined ? { modelVersion: extras.modelVersion } : {}),
      ...(extras?.homeForm !== undefined ? { homeForm: extras.homeForm } : {}),
      ...(extras?.awayForm !== undefined ? { awayForm: extras.awayForm } : {}),
      ...(extras?.keyFactors !== undefined ? { keyFactors: extras.keyFactors } : {}),
      ...(extras?.poissonProbs !== undefined ? { poissonProbs: extras.poissonProbs } : {})
    };

    this.predictions.set(id, storedPrediction);
    this.savePredictions();
  }

  // Update prediction with actual result
  public updateWithResult(
    matchId: string,
    actualResult: 'H' | 'A' | 'D',
    actualHomeGoals: number,
    actualAwayGoals: number
  ): void {
    // Find all predictions for this match
    const matchPredictions = Array.from(this.predictions.values())
      .filter(p => p.matchId === matchId);

    matchPredictions.forEach(prediction => {
      prediction.actualResult = actualResult;
      prediction.actualHomeGoals = actualHomeGoals;
      prediction.actualAwayGoals = actualAwayGoals;
      
      // Check if prediction was correct
      prediction.isCorrect = prediction.predictedResult === actualResult;
      
      this.predictions.set(prediction.id, prediction);
    });

    this.savePredictions();
  }

  // Get accuracy statistics
  public getAccuracyStats(daysBack: number = 30): AccuracyStats {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const relevantPredictions = Array.from(this.predictions.values())
      .filter(p => {
        const predDate = new Date(p.timestamp);
        return predDate >= cutoffDate && p.actualResult !== undefined;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (relevantPredictions.length === 0) {
      return this.getEmptyStats();
    }

    // Calculate basic accuracy
    const correctPredictions = relevantPredictions.filter(p => p.isCorrect).length;
    const totalPredictions = relevantPredictions.length;
    const accuracy = (correctPredictions / totalPredictions) * 100;

    // Calculate exact score accuracy
    const scoreCorrect = relevantPredictions.filter(p => 
      p.predictedHomeGoals === p.actualHomeGoals && 
      p.predictedAwayGoals === p.actualAwayGoals
    ).length;
    const scoreAccuracy = (scoreCorrect / totalPredictions) * 100;

    // Confidence-based accuracy
    const highConf = relevantPredictions.filter(p => p.confidence > 0.7);
    const medConf = relevantPredictions.filter(p => p.confidence >= 0.5 && p.confidence <= 0.7);
    const lowConf = relevantPredictions.filter(p => p.confidence < 0.5);

    const highConfidenceAccuracy = highConf.length > 0 ? 
      (highConf.filter(p => p.isCorrect).length / highConf.length) * 100 : 0;
    const mediumConfidenceAccuracy = medConf.length > 0 ? 
      (medConf.filter(p => p.isCorrect).length / medConf.length) * 100 : 0;
    const lowConfidenceAccuracy = lowConf.length > 0 ? 
      (lowConf.filter(p => p.isCorrect).length / lowConf.length) * 100 : 0;

    // Result type accuracy
    const homePreds = relevantPredictions.filter(p => p.predictedResult === 'H');
    const awayPreds = relevantPredictions.filter(p => p.predictedResult === 'A');
    const drawPreds = relevantPredictions.filter(p => p.predictedResult === 'D');

    const homeWinAccuracy = homePreds.length > 0 ? 
      (homePreds.filter(p => p.isCorrect).length / homePreds.length) * 100 : 0;
    const awayWinAccuracy = awayPreds.length > 0 ? 
      (awayPreds.filter(p => p.isCorrect).length / awayPreds.length) * 100 : 0;
    const drawAccuracy = drawPreds.length > 0 ? 
      (drawPreds.filter(p => p.isCorrect).length / drawPreds.length) * 100 : 0;

    // Average confidence
    const averageConfidence = relevantPredictions.reduce((sum, p) => sum + p.confidence, 0) / totalPredictions;

    // Proper scores across settled predictions that carry a probability
    // vector. Predictions stored before poissonProbs was added (or via paths
    // that omit it) can't contribute — no distribution to score.
    const { brierScore, rpsScore, scoredSampleSize } = this.computeProperScores(relevantPredictions);

    // Calculate streaks
    const streak = this.calculateStreaks(relevantPredictions);

    return {
      totalPredictions,
      correctPredictions,
      accuracy,
      brierScore,
      rps: rpsScore,
      scoredSampleSize,
      scoreAccuracy,
      highConfidenceAccuracy,
      mediumConfidenceAccuracy,
      lowConfidenceAccuracy,
      homeWinAccuracy,
      awayWinAccuracy,
      drawAccuracy,
      averageConfidence: averageConfidence * 100,
      streak
    };
  }

  /**
   * Mean Brier (range [0, 2]) and RPS (range [0, 1]) across settled
   * predictions that carry a probability vector, plus the count actually
   * scored. Formulas delegate to lib/engine/metrics — the same functions the
   * backtest harness uses, so live tracking and offline evaluation can never
   * disagree on a definition.
   */
  private computeProperScores(predictions: StoredPrediction[]): {
    brierScore: number;
    rpsScore: number;
    scoredSampleSize: number;
  } {
    const scored = predictions.filter(p => p.actualResult && p.poissonProbs);
    if (scored.length === 0) return { brierScore: 0, rpsScore: 0, scoredSampleSize: 0 };

    let brierTotal = 0;
    let rpsTotal = 0;
    for (const p of scored) {
      const triple: ProbTriple = {
        home: p.poissonProbs!.homeWin,
        draw: p.poissonProbs!.draw,
        away: p.poissonProbs!.awayWin
      };
      brierTotal += brier(triple, p.actualResult!);
      rpsTotal += rps(triple, p.actualResult!);
    }

    return {
      brierScore: brierTotal / scored.length,
      rpsScore: rpsTotal / scored.length,
      scoredSampleSize: scored.length
    };
  }

  // Get accuracy broken down by gameweek
  public getAccuracyByGameweek(): GameweekAccuracy[] {
    const settled = Array.from(this.predictions.values())
      .filter(p => p.actualResult !== undefined && p.matchday !== undefined);

    if (settled.length === 0) return [];

    // Group by matchday
    const byGameweek = new Map<number, StoredPrediction[]>();
    for (const pred of settled) {
      const gw = pred.matchday!;
      if (!byGameweek.has(gw)) byGameweek.set(gw, []);
      byGameweek.get(gw)!.push(pred);
    }

    // Calculate accuracy per gameweek, sorted by matchday
    return Array.from(byGameweek.entries())
      .sort(([a], [b]) => a - b)
      .map(([matchday, preds]) => {
        const correct = preds.filter(p => p.isCorrect).length;
        return {
          matchday,
          totalPredictions: preds.length,
          correctPredictions: correct,
          accuracy: (correct / preds.length) * 100
        };
      });
  }

  /**
   * Compute per-band calibration factors from historical prediction accuracy.
   *
   * For each confidence band (high/medium/low), the factor is:
   *   actual_accuracy / average_stated_confidence
   *
   * Example: if predictions with ~80% confidence are correct 72% of the time,
   * the high-band factor is 0.72 / 0.80 = 0.9. Multiplying future raw
   * confidence by 0.9 produces more honest probability estimates.
   *
   * Returns 1.0 for any band with fewer than MIN_CALIBRATION_SAMPLES settled
   * predictions — not enough data to calibrate reliably.
   */
  public getCalibrationFactors(): CalibrationFactors {
    const settled = Array.from(this.predictions.values())
      .filter(p => p.actualResult !== undefined);

    const computeFactor = (preds: StoredPrediction[]): number => {
      if (preds.length < PredictionTracker.MIN_CALIBRATION_SAMPLES) return 1.0;

      const avgConfidence = preds.reduce((sum, p) => sum + p.confidence, 0) / preds.length;
      if (avgConfidence === 0) return 1.0;

      const actualAccuracy = preds.filter(p => p.isCorrect).length / preds.length;

      // Clamp to [0.5, 1.5] to prevent extreme swings from small or noisy samples
      return Math.max(0.5, Math.min(1.5, actualAccuracy / avgConfidence));
    };

    const highConf = settled.filter(p => p.confidence > 0.7);
    const medConf = settled.filter(p => p.confidence >= 0.5 && p.confidence <= 0.7);
    const lowConf = settled.filter(p => p.confidence < 0.5);

    return {
      highBand: computeFactor(highConf),
      mediumBand: computeFactor(medConf),
      lowBand: computeFactor(lowConf)
    };
  }

  /**
   * Build a uniformly-binned calibration curve over [0, 1].
   *
   * Each settled prediction lands in one bin based on its stated `confidence`
   * (bin i covers `[i/bins, (i+1)/bins)`; `confidence === 1.0` lands in the
   * last bin). For each bin we report the mean confidence (x) and hit rate
   * (y), so a perfectly-calibrated model would plot all points along the y=x
   * diagonal.
   *
   * Empty bins are still emitted with `sampleCount: 0`, `actual: 0`, and
   * `predicted` set to the bin midpoint — the consumer can render an even
   * x-axis without conditional skipping.
   */
  public getCalibrationCurve(bins: number = 10): CalibrationBin[] {
    const settled = Array.from(this.predictions.values())
      .filter(p => p.actualResult !== undefined);

    const buckets: StoredPrediction[][] = Array.from({ length: bins }, () => []);
    for (const p of settled) {
      const idx = Math.min(bins - 1, Math.floor(p.confidence * bins));
      buckets[idx].push(p);
    }

    return buckets.map((preds, i) => {
      const midpoint = (i + 0.5) / bins;
      if (preds.length === 0) {
        return { bin: i, predicted: midpoint, actual: 0, sampleCount: 0 };
      }
      const predicted = preds.reduce((s, p) => s + p.confidence, 0) / preds.length;
      const actual = preds.filter(p => p.isCorrect).length / preds.length;
      return { bin: i, predicted, actual, sampleCount: preds.length };
    });
  }

  // Calculate prediction streaks
  private calculateStreaks(predictions: StoredPrediction[]): AccuracyStats['streak'] {
    if (predictions.length === 0) {
      return { current: 0, best: 0, worst: 0 };
    }

    let current = 0;
    let best = 0;
    let worst = 0;
    let currentStreak = 0;

    predictions.forEach((pred, index) => {
      if (pred.isCorrect) {
        if (currentStreak < 0) currentStreak = 0;
        currentStreak++;
        if (currentStreak > best) best = currentStreak;
      } else {
        if (currentStreak > 0) currentStreak = 0;
        currentStreak--;
        if (Math.abs(currentStreak) > Math.abs(worst)) worst = currentStreak;
      }

      if (index === predictions.length - 1) {
        current = currentStreak;
      }
    });

    return { current, best, worst: Math.abs(worst) };
  }

  // Get recent predictions
  public getRecentPredictions(limit: number = 10): StoredPrediction[] {
    return Array.from(this.predictions.values())
      .sort((a, b) => {
        const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        // Tiebreaker: higher ID (later counter) comes first
        return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
      })
      .slice(0, limit);
  }

  // Get predictions for a specific match
  public getMatchPredictions(matchId: string): StoredPrediction[] {
    return Array.from(this.predictions.values())
      .filter(p => p.matchId === matchId);
  }

  // Clear old predictions (older than 90 days)
  public cleanOldPredictions(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const toDelete: string[] = [];
    this.predictions.forEach((pred, id) => {
      if (new Date(pred.timestamp) < cutoffDate) {
        toDelete.push(id);
      }
    });

    toDelete.forEach(id => this.predictions.delete(id));
    this.savePredictions();
  }

  // Get empty stats object
  private getEmptyStats(): AccuracyStats {
    return {
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      brierScore: 0,
      rps: 0,
      scoredSampleSize: 0,
      scoreAccuracy: 0,
      highConfidenceAccuracy: 0,
      mediumConfidenceAccuracy: 0,
      lowConfidenceAccuracy: 0,
      homeWinAccuracy: 0,
      awayWinAccuracy: 0,
      drawAccuracy: 0,
      averageConfidence: 0,
      streak: { current: 0, best: 0, worst: 0 }
    };
  }

}

// Export singleton instance
export const predictionTracker = new PredictionTracker();

// Export class for testing
export { PredictionTracker };