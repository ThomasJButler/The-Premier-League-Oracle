/**
 * Bumped whenever the prediction pipeline changes in a way that would make
 * stored scoreline / result / confidence values disagree with what the current
 * model would produce (fatigue fix, tier-blend lambdas, bet-builder grid
 * reuse, etc). Stored predictions with a missing or different modelVersion are
 * treated as stale for unplayed fixtures — the card reverts to "pending" so
 * the user gets a fresh forecast. Completed-match history (those with
 * actualResult set) is preserved regardless for accuracy tracking.
 */
export const MODEL_VERSION = 'v3.5-MVP';

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

class PredictionTracker {
  private readonly STORAGE_KEY = 'pl_oracle_predictions';
  /** Minimum settled predictions per band before calibration applies */
  private static readonly MIN_CALIBRATION_SAMPLES = 10;
  private predictions: Map<string, StoredPrediction>;
  constructor() {
    this.predictions = new Map();
    this.loadPredictions();
    this.cleanOldPredictions();
  }

  // Load predictions from localStorage
  private loadPredictions(): void {
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

    // Brier score across settled predictions that carry a probability vector.
    // Predictions stored before poissonProbs was added (or via paths that omit it)
    // can't contribute — they have no probability distribution to score.
    const brierScore = this.computeBrier(relevantPredictions);

    // Calculate streaks
    const streak = this.calculateStreaks(relevantPredictions);

    return {
      totalPredictions,
      correctPredictions,
      accuracy,
      brierScore,
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
   * Mean Brier score for 3-class (H/D/A) outcome predictions.
   * Brier per match = (p_home - 1{H})^2 + (p_draw - 1{D})^2 + (p_away - 1{A})^2.
   * Range [0, 2]; calibrated random ≈ 0.667; perfect = 0.
   * Skips predictions without poissonProbs — they have no probability vector to score.
   */
  private computeBrier(predictions: StoredPrediction[]): number {
    const scored = predictions.filter(p => p.actualResult && p.poissonProbs);
    if (scored.length === 0) return 0;

    const total = scored.reduce((sum, p) => {
      const probs = p.poissonProbs!;
      const homeBit = p.actualResult === 'H' ? 1 : 0;
      const drawBit = p.actualResult === 'D' ? 1 : 0;
      const awayBit = p.actualResult === 'A' ? 1 : 0;
      return sum
        + (probs.homeWin - homeBit) ** 2
        + (probs.draw    - drawBit) ** 2
        + (probs.awayWin - awayBit) ** 2;
    }, 0);

    return total / scored.length;
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