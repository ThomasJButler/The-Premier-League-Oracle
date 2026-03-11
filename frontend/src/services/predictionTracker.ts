import type { Match } from '../types';

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
}

export interface AccuracyStats {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  resultAccuracy: number; // W/D/L accuracy
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

class PredictionTracker {
  private readonly STORAGE_KEY = 'pl_oracle_predictions';
  private predictions: Map<string, StoredPrediction>;
  private static idCounter = 0;

  constructor() {
    this.predictions = new Map();
    this.loadPredictions();
  }

  // Load predictions from localStorage
  private loadPredictions(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.predictions = new Map(Object.entries(parsed));
      }
    } catch (error) {
      // Error loading predictions, using empty map
      this.predictions = new Map();
    }
  }

  // Save predictions to localStorage
  private savePredictions(): void {
    try {
      const toStore = Object.fromEntries(this.predictions);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
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
    matchDate: string
  ): void {
    PredictionTracker.idCounter++;
    const id = `${matchId}_${Date.now()}_${PredictionTracker.idCounter}`;
    const storedPrediction: StoredPrediction = {
      id,
      matchId,
      homeTeam,
      awayTeam,
      ...prediction,
      timestamp: new Date().toISOString(),
      matchDate
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

    // Calculate result accuracy (W/D/L)
    const resultCorrect = relevantPredictions.filter(p => p.predictedResult === p.actualResult).length;
    const resultAccuracy = (resultCorrect / totalPredictions) * 100;

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

    // Calculate streaks
    const streak = this.calculateStreaks(relevantPredictions);

    return {
      totalPredictions,
      correctPredictions,
      accuracy,
      resultAccuracy,
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
      resultAccuracy: 0,
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

  // Export predictions for analysis
  public exportPredictions(): string {
    const data = Array.from(this.predictions.values());
    return JSON.stringify(data, null, 2);
  }

  // Import predictions (for testing or migration)
  public importPredictions(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      if (Array.isArray(data)) {
        data.forEach(pred => {
          if (pred.id && pred.matchId) {
            this.predictions.set(pred.id, pred);
          }
        });
        this.savePredictions();
        return true;
      }
    } catch (error) {
      // Error importing predictions from JSON data
    }
    return false;
  }
}

// Export singleton instance
export const predictionTracker = new PredictionTracker();

// Export class for testing
export { PredictionTracker };