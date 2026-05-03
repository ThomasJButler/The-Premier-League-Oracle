import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PredictionTracker, MODEL_VERSION, type StoredPrediction, type AccuracyStats, type CalibrationFactors } from './predictionTracker';

describe('PredictionTracker Service', () => {
  let tracker: PredictionTracker;
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    // Reset localStorage mock data
    localStorageMock = {};

    // Spy on the global localStorage mock (setup.ts replaces localStorage with a plain object,
    // so Storage.prototype spying doesn't work — we must spy on the object directly)
    vi.spyOn(localStorage, 'getItem').mockImplementation((key: string) => {
      return localStorageMock[key] || null;
    });

    vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      localStorageMock[key] = value;
    });

    vi.spyOn(localStorage, 'removeItem').mockImplementation((key: string) => {
      delete localStorageMock[key];
    });

    vi.spyOn(localStorage, 'clear').mockImplementation(() => {
      localStorageMock = {};
    });

    // Create new tracker instance
    tracker = new PredictionTracker();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Storing Predictions', () => {
    it('should store a new prediction', () => {
      tracker.storePrediction(
        'match123',
        'Arsenal',
        'Chelsea',
        {
          predictedResult: 'H',
          predictedHomeGoals: 2,
          predictedAwayGoals: 1,
          confidence: 0.72
        },
        '2025-08-15'
      );

      const predictions = tracker.getRecentPredictions(1);
      expect(predictions).toHaveLength(1);
      expect(predictions[0].matchId).toBe('match123');
      expect(predictions[0].homeTeam).toBe('Arsenal');
      expect(predictions[0].awayTeam).toBe('Chelsea');
      expect(predictions[0].predictedResult).toBe('H');
      expect(predictions[0].confidence).toBe(0.72);
    });

    it('should persist predictions to localStorage', () => {
      tracker.storePrediction(
        'match456',
        'Liverpool',
        'Man City',
        {
          predictedResult: 'D',
          predictedHomeGoals: 2,
          predictedAwayGoals: 2,
          confidence: 0.45
        },
        '2025-08-20'
      );

      expect(localStorage.setItem).toHaveBeenCalled();
      const storedData = localStorageMock['pl_oracle_predictions'];
      expect(storedData).toBeDefined();
      
      const parsed = JSON.parse(storedData);
      expect(Object.keys(parsed)).toHaveLength(1);
    });

    it('should generate unique IDs for predictions', () => {
      tracker.storePrediction(
        'match789',
        'Team A',
        'Team B',
        {
          predictedResult: 'A',
          predictedHomeGoals: 1,
          predictedAwayGoals: 3,
          confidence: 0.68
        },
        '2025-08-25'
      );

      tracker.storePrediction(
        'match789', // Same match
        'Team A',
        'Team B',
        {
          predictedResult: 'A',
          predictedHomeGoals: 1,
          predictedAwayGoals: 2,
          confidence: 0.55
        },
        '2025-08-25'
      );

      const predictions = tracker.getMatchPredictions('match789');
      expect(predictions).toHaveLength(2);
      expect(predictions[0].id).not.toBe(predictions[1].id);
    });

    it('should persist optional extras (modelVersion, form, keyFactors, poissonProbs)', () => {
      tracker.storePrediction(
        'match_extras',
        'Arsenal',
        'Burnley',
        {
          predictedResult: 'H',
          predictedHomeGoals: 3,
          predictedAwayGoals: 0,
          confidence: 0.74
        },
        '2025-08-15',
        5,
        {
          modelVersion: MODEL_VERSION,
          homeForm: 'WWDWL',
          awayForm: 'LLDLL',
          keyFactors: ['Arsenal strong at home', 'Burnley poor away form'],
          poissonProbs: { homeWin: 0.72, draw: 0.18, awayWin: 0.10 }
        }
      );

      const stored = tracker.getMatchPredictions('match_extras')[0];
      expect(stored.modelVersion).toBe(MODEL_VERSION);
      expect(stored.homeForm).toBe('WWDWL');
      expect(stored.awayForm).toBe('LLDLL');
      expect(stored.keyFactors).toEqual([
        'Arsenal strong at home',
        'Burnley poor away form'
      ]);
      expect(stored.poissonProbs).toEqual({ homeWin: 0.72, draw: 0.18, awayWin: 0.10 });
    });

    it('should omit extras from storage when not provided (legacy compatibility)', () => {
      tracker.storePrediction(
        'match_no_extras',
        'Liverpool',
        'Everton',
        {
          predictedResult: 'H',
          predictedHomeGoals: 2,
          predictedAwayGoals: 1,
          confidence: 0.65
        },
        '2025-09-01'
      );

      const stored = tracker.getMatchPredictions('match_no_extras')[0];
      expect(stored.modelVersion).toBeUndefined();
      expect(stored.homeForm).toBeUndefined();
      expect(stored.keyFactors).toBeUndefined();
      expect(stored.poissonProbs).toBeUndefined();
    });

    it('should export a non-empty MODEL_VERSION string', () => {
      expect(typeof MODEL_VERSION).toBe('string');
      expect(MODEL_VERSION.length).toBeGreaterThan(0);
    });
  });

  describe('Updating with Results', () => {
    it('should update predictions with actual results', () => {
      // Store a prediction
      tracker.storePrediction(
        'match001',
        'Arsenal',
        'Chelsea',
        {
          predictedResult: 'H',
          predictedHomeGoals: 2,
          predictedAwayGoals: 1,
          confidence: 0.65
        },
        '2025-08-15'
      );

      // Update with actual result
      tracker.updateWithResult('match001', 'H', 3, 1);

      const predictions = tracker.getMatchPredictions('match001');
      expect(predictions[0].actualResult).toBe('H');
      expect(predictions[0].actualHomeGoals).toBe(3);
      expect(predictions[0].actualAwayGoals).toBe(1);
      expect(predictions[0].isCorrect).toBe(true); // Predicted H, actual H
    });

    it('should mark incorrect predictions', () => {
      tracker.storePrediction(
        'match002',
        'Liverpool',
        'Man United',
        {
          predictedResult: 'H',
          predictedHomeGoals: 3,
          predictedAwayGoals: 0,
          confidence: 0.75
        },
        '2025-08-20'
      );

      tracker.updateWithResult('match002', 'D', 1, 1);

      const predictions = tracker.getMatchPredictions('match002');
      expect(predictions[0].isCorrect).toBe(false);
    });

    it('stays outcome-based: correct when H/H even if scoreline differs', () => {
      // Regression guard for the UX-clarifying amber "Correct outcome, wrong
      // scoreline" state. isCorrect must remain the 1X2 outcome check — the
      // UI layer is what surfaces the scoreline mismatch.
      tracker.storePrediction(
        'liv_ful',
        'Liverpool',
        'Fulham',
        {
          predictedResult: 'H',
          predictedHomeGoals: 2,
          predictedAwayGoals: 1,
          confidence: 0.69
        },
        '2026-04-11'
      );

      tracker.updateWithResult('liv_ful', 'H', 2, 0);

      const [pred] = tracker.getMatchPredictions('liv_ful');
      expect(pred.isCorrect).toBe(true);
      expect(pred.actualHomeGoals).toBe(2);
      expect(pred.actualAwayGoals).toBe(0);
      expect(pred.predictedHomeGoals).toBe(2);
      expect(pred.predictedAwayGoals).toBe(1);
    });

    it('should handle multiple predictions for same match', () => {
      // Two different predictions for same match
      tracker.storePrediction(
        'match003',
        'Chelsea',
        'Tottenham',
        {
          predictedResult: 'H',
          predictedHomeGoals: 2,
          predictedAwayGoals: 0,
          confidence: 0.6
        },
        '2025-08-25'
      );

      tracker.storePrediction(
        'match003',
        'Chelsea',
        'Tottenham',
        {
          predictedResult: 'D',
          predictedHomeGoals: 1,
          predictedAwayGoals: 1,
          confidence: 0.5
        },
        '2025-08-25'
      );

      tracker.updateWithResult('match003', 'H', 2, 1);

      const predictions = tracker.getMatchPredictions('match003');
      expect(predictions[0].isCorrect).toBe(true); // First prediction was correct
      expect(predictions[1].isCorrect).toBe(false); // Second prediction was wrong
    });
  });

  describe('Accuracy Calculation', () => {
    beforeEach(() => {
      // Set up test predictions with results
      const testData = [
        { matchId: 'm1', predicted: 'H', actual: 'H', confidence: 0.75, correct: true },
        { matchId: 'm2', predicted: 'A', actual: 'A', confidence: 0.68, correct: true },
        { matchId: 'm3', predicted: 'H', actual: 'D', confidence: 0.55, correct: false },
        { matchId: 'm4', predicted: 'D', actual: 'D', confidence: 0.45, correct: true },
        { matchId: 'm5', predicted: 'H', actual: 'A', confidence: 0.82, correct: false },
        { matchId: 'm6', predicted: 'A', actual: 'A', confidence: 0.71, correct: true },
        { matchId: 'm7', predicted: 'H', actual: 'H', confidence: 0.65, correct: true },
        { matchId: 'm8', predicted: 'D', actual: 'H', confidence: 0.38, correct: false },
        { matchId: 'm9', predicted: 'A', actual: 'A', confidence: 0.79, correct: true },
        { matchId: 'm10', predicted: 'H', actual: 'H', confidence: 0.62, correct: true }
      ];

      testData.forEach((data, index) => {
        tracker.storePrediction(
          data.matchId,
          'Team A',
          'Team B',
          {
            predictedResult: data.predicted as 'H' | 'A' | 'D',
            predictedHomeGoals: 2,
            predictedAwayGoals: 1,
            confidence: data.confidence
          },
          new Date(Date.now() - (10 - index) * 24 * 60 * 60 * 1000).toISOString()
        );
        
        tracker.updateWithResult(
          data.matchId,
          data.actual as 'H' | 'A' | 'D',
          2,
          1
        );
      });
    });

    it('should calculate overall accuracy correctly', () => {
      const stats = tracker.getAccuracyStats(30);
      
      expect(stats.totalPredictions).toBe(10);
      expect(stats.correctPredictions).toBe(7);
      expect(stats.accuracy).toBe(70); // 7/10 = 70%
    });

    it('should calculate confidence-based accuracy', () => {
      const stats = tracker.getAccuracyStats(30);
      
      // High confidence (>0.7): m1(✓), m5(✗), m6(✓), m9(✓) = 3/4 = 75%
      expect(stats.highConfidenceAccuracy).toBe(75);
      
      // Medium confidence (0.5-0.7): m2(✓), m3(✗), m7(✓), m10(✓) = 3/4 = 75%
      expect(stats.mediumConfidenceAccuracy).toBe(75);
      
      // Low confidence (<0.5): m4(✓), m8(✗) = 1/2 = 50%
      expect(stats.lowConfidenceAccuracy).toBe(50);
    });

    it('should calculate result-specific accuracy', () => {
      const stats = tracker.getAccuracyStats(30);
      
      // Home predictions: m1(✓), m3(✗), m5(✗), m7(✓), m10(✓) = 3/5 = 60%
      expect(stats.homeWinAccuracy).toBe(60);
      
      // Away predictions: m2(✓), m6(✓), m9(✓) = 3/3 = 100%
      expect(stats.awayWinAccuracy).toBe(100);
      
      // Draw predictions: m4(✓), m8(✗) = 1/2 = 50%
      expect(stats.drawAccuracy).toBe(50);
    });

    it('should handle empty prediction history', () => {
      localStorageMock = {};
      const emptyTracker = new PredictionTracker();
      const stats = emptyTracker.getAccuracyStats(30);

      expect(stats.totalPredictions).toBe(0);
      expect(stats.accuracy).toBe(0);
      expect(stats.highConfidenceAccuracy).toBe(0);
      expect(stats.brierScore).toBe(0);
    });
  });

  describe('Brier Score', () => {
    // Brier per match (3-class) = (p_home - 1{H})^2 + (p_draw - 1{D})^2 + (p_away - 1{A})^2.
    // We feed the tracker via the public API so the path mirrors production storage.

    it('should return 0 when no settled predictions exist', () => {
      const stats = tracker.getAccuracyStats(30);
      expect(stats.brierScore).toBe(0);
    });

    it('should compute the mean Brier across settled predictions with poissonProbs', () => {
      // Prediction A — home won, probs {0.6, 0.25, 0.15}.
      //   brier = (1-0.6)^2 + (0-0.25)^2 + (0-0.15)^2 = 0.16 + 0.0625 + 0.0225 = 0.245
      tracker.storePrediction(
        'mA',
        'Arsenal',
        'Chelsea',
        { predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 0, confidence: 0.6 },
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        undefined,
        { poissonProbs: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 } }
      );
      tracker.updateWithResult('mA', 'H', 2, 0);

      // Prediction B — away won, probs {0.5, 0.3, 0.2}.
      //   brier = (0-0.5)^2 + (0-0.3)^2 + (1-0.2)^2 = 0.25 + 0.09 + 0.64 = 0.98
      tracker.storePrediction(
        'mB',
        'Liverpool',
        'Spurs',
        { predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 0, confidence: 0.5 },
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        undefined,
        { poissonProbs: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 } }
      );
      tracker.updateWithResult('mB', 'A', 0, 1);

      const stats = tracker.getAccuracyStats(30);
      // Mean of [0.245, 0.98] = 0.6125
      expect(stats.brierScore).toBeCloseTo(0.6125, 4);
    });

    it('should skip settled predictions that have no poissonProbs', () => {
      tracker.storePrediction(
        'mNoProbs',
        'Team A',
        'Team B',
        { predictedResult: 'H', predictedHomeGoals: 1, predictedAwayGoals: 0, confidence: 0.5 },
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        // no extras → no poissonProbs
      );
      tracker.updateWithResult('mNoProbs', 'H', 1, 0);

      const stats = tracker.getAccuracyStats(30);
      // Only prediction has no probs → it is skipped → empty pool → 0
      expect(stats.brierScore).toBe(0);
    });

    it('should ignore unsettled predictions even when they carry poissonProbs', () => {
      tracker.storePrediction(
        'mUnsettled',
        'Team A',
        'Team B',
        { predictedResult: 'H', predictedHomeGoals: 1, predictedAwayGoals: 0, confidence: 0.55 },
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        undefined,
        { poissonProbs: { homeWin: 0.55, draw: 0.25, awayWin: 0.20 } }
      );
      // Deliberately not calling updateWithResult — actualResult stays undefined.

      const stats = tracker.getAccuracyStats(30);
      // getAccuracyStats already filters to actualResult !== undefined; brier should mirror that.
      expect(stats.brierScore).toBe(0);
    });
  });

  describe('Streak Calculation', () => {
    it('should track prediction streaks correctly', () => {
      const tracker = new PredictionTracker();
      
      // Create a specific sequence: W W W L L W W L W
      const sequence = [
        { correct: true },  // W
        { correct: true },  // W
        { correct: true },  // W (best streak: 3)
        { correct: false }, // L
        { correct: false }, // L (worst streak: 2)
        { correct: true },  // W
        { correct: true },  // W
        { correct: false }, // L
        { correct: true },  // W (current: 1)
      ];

      sequence.forEach((data, index) => {
        const matchId = `streak${index}`;
        tracker.storePrediction(
          matchId,
          'Team A',
          'Team B',
          {
            predictedResult: 'H',
            predictedHomeGoals: 2,
            predictedAwayGoals: 1,
            confidence: 0.65
          },
          new Date(Date.now() - (9 - index) * 24 * 60 * 60 * 1000).toISOString()
        );
        
        tracker.updateWithResult(
          matchId,
          data.correct ? 'H' : 'A',
          2,
          1
        );
      });

      const stats = tracker.getAccuracyStats(30);
      
      expect(stats.streak.current).toBe(1); // Currently on 1 win streak
      expect(stats.streak.best).toBe(3); // Best was 3 in a row
      expect(stats.streak.worst).toBe(2); // Worst was 2 losses in a row
    });
  });

  describe('Data Management', () => {
    it('should retrieve recent predictions in correct order', () => {
      // Add predictions with different timestamps
      for (let i = 0; i < 5; i++) {
        tracker.storePrediction(
          `match${i}`,
          `Team${i}`,
          `Team${i+1}`,
          {
            predictedResult: 'H',
            predictedHomeGoals: 2,
            predictedAwayGoals: 1,
            confidence: 0.6 + i * 0.05
          },
          `2025-08-${10 + i}`
        );
      }

      const recent = tracker.getRecentPredictions(3);
      
      expect(recent).toHaveLength(3);
      expect(recent[0].matchId).toBe('match4'); // Most recent
      expect(recent[1].matchId).toBe('match3');
      expect(recent[2].matchId).toBe('match2');
    });

    it('should clean old predictions', () => {
      // Add old prediction (100 days ago)
      const oldPrediction = {
        id: 'old123',
        matchId: 'oldmatch',
        homeTeam: 'Old Team A',
        awayTeam: 'Old Team B',
        predictedResult: 'H' as const,
        predictedHomeGoals: 2,
        predictedAwayGoals: 1,
        confidence: 0.65,
        timestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
        matchDate: '2025-05-01'
      };

      // Add recent prediction
      tracker.storePrediction(
        'newmatch',
        'New Team A',
        'New Team B',
        {
          predictedResult: 'A',
          predictedHomeGoals: 1,
          predictedAwayGoals: 2,
          confidence: 0.7
        },
        '2025-08-15'
      );

      // Manually add old prediction to storage
      const stored = JSON.parse(localStorageMock['pl_oracle_predictions'] || '{}');
      stored[oldPrediction.id] = oldPrediction;
      localStorageMock['pl_oracle_predictions'] = JSON.stringify(stored);
      
      // Reload tracker — constructor now auto-cleans old predictions
      tracker = new PredictionTracker();

      // Old prediction should already be cleaned by the constructor
      const allPredictions = tracker.getRecentPredictions(100);
      expect(allPredictions).toHaveLength(1);
      expect(allPredictions[0].matchId).toBe('newmatch');
    });

  });

  describe('Calibration Factors', () => {
    it('should return 1.0 for all bands with insufficient data', () => {
      // No predictions at all
      const factors = tracker.getCalibrationFactors();
      expect(factors.highBand).toBe(1.0);
      expect(factors.mediumBand).toBe(1.0);
      expect(factors.lowBand).toBe(1.0);
    });

    it('should return 1.0 when fewer than 10 predictions per band', () => {
      // Add 5 high-confidence predictions (below the 10-sample threshold)
      for (let i = 0; i < 5; i++) {
        tracker.storePrediction(
          `cal_m${i}`, 'Team A', 'Team B',
          { predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1, confidence: 0.8 },
          new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
        );
        tracker.updateWithResult(`cal_m${i}`, 'H', 2, 1);
      }

      const factors = tracker.getCalibrationFactors();
      expect(factors.highBand).toBe(1.0); // < 10 samples
    });

    it('should compute calibration factor for overconfident model', () => {
      // 12 high-confidence predictions (avg confidence ~0.80), only 9 correct (75% accuracy)
      // Factor should be ~0.75/0.80 = ~0.9375
      for (let i = 0; i < 12; i++) {
        const matchId = `cal_high_${i}`;
        tracker.storePrediction(
          matchId, 'Team A', 'Team B',
          { predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1, confidence: 0.80 },
          new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
        );
        // 9 correct, 3 wrong
        tracker.updateWithResult(matchId, i < 9 ? 'H' : 'A', 2, 1);
      }

      const factors = tracker.getCalibrationFactors();
      // 0.75 accuracy / 0.80 avg confidence = 0.9375
      expect(factors.highBand).toBeCloseTo(0.9375, 3);
      // Other bands should be 1.0 (no data)
      expect(factors.mediumBand).toBe(1.0);
      expect(factors.lowBand).toBe(1.0);
    });

    it('should compute calibration factor for underconfident model', () => {
      // 10 medium-confidence predictions (avg confidence ~0.60), all correct (100% accuracy)
      // Factor should be 1.0/0.60 = ~1.667, clamped to 1.5
      for (let i = 0; i < 10; i++) {
        const matchId = `cal_med_${i}`;
        tracker.storePrediction(
          matchId, 'Team A', 'Team B',
          { predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1, confidence: 0.60 },
          new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
        );
        tracker.updateWithResult(matchId, 'H', 2, 1); // All correct
      }

      const factors = tracker.getCalibrationFactors();
      // Raw 1.667 clamped to 1.5
      expect(factors.mediumBand).toBe(1.5);
    });

    it('should clamp extremely low calibration factors', () => {
      // 10 low-confidence predictions, none correct — factor would be 0/0.40 = 0, clamped to 0.5
      for (let i = 0; i < 10; i++) {
        const matchId = `cal_low_${i}`;
        tracker.storePrediction(
          matchId, 'Team A', 'Team B',
          { predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1, confidence: 0.40 },
          new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
        );
        tracker.updateWithResult(matchId, 'A', 0, 2); // All wrong
      }

      const factors = tracker.getCalibrationFactors();
      expect(factors.lowBand).toBe(0.5); // Clamped from 0
    });

    it('should compute independent factors for each band', () => {
      const now = Date.now();
      let idx = 0;

      // High band: 10 predictions at 0.80 confidence, 8 correct → factor = 1.0
      for (let i = 0; i < 10; i++, idx++) {
        const matchId = `cal_multi_${idx}`;
        tracker.storePrediction(
          matchId, 'Team A', 'Team B',
          { predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1, confidence: 0.80 },
          new Date(now - idx * 24 * 60 * 60 * 1000).toISOString()
        );
        tracker.updateWithResult(matchId, i < 8 ? 'H' : 'A', 2, 1);
      }

      // Medium band: 10 predictions at 0.60 confidence, 6 correct → factor = 1.0
      for (let i = 0; i < 10; i++, idx++) {
        const matchId = `cal_multi_${idx}`;
        tracker.storePrediction(
          matchId, 'Team A', 'Team B',
          { predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1, confidence: 0.60 },
          new Date(now - idx * 24 * 60 * 60 * 1000).toISOString()
        );
        tracker.updateWithResult(matchId, i < 6 ? 'H' : 'A', 2, 1);
      }

      // Low band: 10 predictions at 0.40 confidence, 2 correct → factor = 0.5
      for (let i = 0; i < 10; i++, idx++) {
        const matchId = `cal_multi_${idx}`;
        tracker.storePrediction(
          matchId, 'Team A', 'Team B',
          { predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1, confidence: 0.40 },
          new Date(now - idx * 24 * 60 * 60 * 1000).toISOString()
        );
        tracker.updateWithResult(matchId, i < 2 ? 'H' : 'A', 2, 1);
      }

      const factors = tracker.getCalibrationFactors();
      // High: 0.8 accuracy / 0.8 confidence = 1.0
      expect(factors.highBand).toBeCloseTo(1.0, 3);
      // Medium: 0.6 accuracy / 0.6 confidence = 1.0
      expect(factors.mediumBand).toBeCloseTo(1.0, 3);
      // Low: 0.2 accuracy / 0.4 confidence = 0.5
      expect(factors.lowBand).toBeCloseTo(0.5, 3);
    });
  });

  describe('Calibration Curve', () => {
    it('emits all bins with sampleCount 0 when no settled predictions exist', () => {
      const curve = tracker.getCalibrationCurve();
      expect(curve).toHaveLength(10);
      curve.forEach((bin, i) => {
        expect(bin.bin).toBe(i);
        expect(bin.sampleCount).toBe(0);
        expect(bin.actual).toBe(0);
        // predicted falls back to bin midpoint when empty
        expect(bin.predicted).toBeCloseTo((i + 0.5) / 10, 5);
      });
    });

    it('reflects mean stated confidence and hit rate inside each populated bin', () => {
      // Two predictions land in bin 7 (confidence range [0.7, 0.8)):
      //   one at 0.72 (correct), one at 0.78 (wrong) → mean predicted = 0.75, actual = 0.5
      tracker.storePrediction(
        'cv_a', 'Arsenal', 'Chelsea',
        { predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1, confidence: 0.72 },
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      );
      tracker.updateWithResult('cv_a', 'H', 2, 1); // correct

      tracker.storePrediction(
        'cv_b', 'Liverpool', 'Spurs',
        { predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 0, confidence: 0.78 },
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      );
      tracker.updateWithResult('cv_b', 'A', 0, 1); // wrong

      const curve = tracker.getCalibrationCurve();
      const bin7 = curve[7];
      expect(bin7.sampleCount).toBe(2);
      expect(bin7.predicted).toBeCloseTo(0.75, 5);
      expect(bin7.actual).toBe(0.5);
      // Other bins remain empty
      expect(curve[0].sampleCount).toBe(0);
      expect(curve[9].sampleCount).toBe(0);
    });

    it('respects a custom bin count and clamps confidence === 1 into the final bin', () => {
      // Confidence 1.0 must NOT overflow past the last bin (Math.floor(1.0 * 5) = 5 would).
      tracker.storePrediction(
        'cv_max', 'Team A', 'Team B',
        { predictedResult: 'H', predictedHomeGoals: 1, predictedAwayGoals: 0, confidence: 1.0 },
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      );
      tracker.updateWithResult('cv_max', 'H', 1, 0);

      const curve = tracker.getCalibrationCurve(5);
      expect(curve).toHaveLength(5);
      expect(curve[4].sampleCount).toBe(1);
      expect(curve[4].actual).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle localStorage errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage full');
      });

      // Should not throw
      expect(() => {
        tracker.storePrediction(
          'test',
          'Team A',
          'Team B',
          {
            predictedResult: 'H',
            predictedHomeGoals: 2,
            predictedAwayGoals: 1,
            confidence: 0.65
          },
          '2025-08-15'
        );
      }).not.toThrow();
    });

    it('should handle corrupted localStorage data', () => {
      localStorageMock['pl_oracle_predictions'] = 'corrupted data not json';
      
      // Creating new tracker should not throw
      expect(() => {
        new PredictionTracker();
      }).not.toThrow();
    });

    it('should calculate stats with date filtering', () => {
      // Add predictions over different time periods
      const now = Date.now();
      
      // 5 days ago
      tracker.storePrediction(
        'recent1',
        'Team A',
        'Team B',
        {
          predictedResult: 'H',
          predictedHomeGoals: 2,
          predictedAwayGoals: 1,
          confidence: 0.7
        },
        new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString()
      );
      tracker.updateWithResult('recent1', 'H', 2, 1);
      
      // 40 days ago (outside 30-day window)
      const oldData = {
        id: 'old1',
        matchId: 'oldmatch1',
        homeTeam: 'Team C',
        awayTeam: 'Team D',
        predictedResult: 'A' as const,
        predictedHomeGoals: 1,
        predictedAwayGoals: 2,
        confidence: 0.6,
        actualResult: 'H' as const,
        actualHomeGoals: 2,
        actualAwayGoals: 0,
        isCorrect: false,
        timestamp: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
        matchDate: '2025-07-01'
      };
      
      // Manually add old prediction
      const stored = JSON.parse(localStorageMock['pl_oracle_predictions'] || '{}');
      stored[oldData.id] = oldData;
      localStorageMock['pl_oracle_predictions'] = JSON.stringify(stored);
      tracker = new PredictionTracker();
      
      // Stats for last 30 days should only include recent
      const stats30 = tracker.getAccuracyStats(30);
      expect(stats30.totalPredictions).toBe(1);
      
      // Stats for last 60 days should include both
      const stats60 = tracker.getAccuracyStats(60);
      expect(stats60.totalPredictions).toBe(2);
    });
  });
});