import type { Match } from '../types';
import {
  predictionTracker,
  MODEL_VERSION,
  type StoredPrediction,
} from '../services/predictionTracker';
import { OptimizedPredictor } from './optimizedPredictions';
import type { EnhancedPredictionModel } from './optimizedPredictions';

export interface BulkPersistDeps {
  predict: (home: string, away: string) => Promise<EnhancedPredictionModel>;
  hasExistingPrediction: (matchId: string) => boolean;
  store: (
    matchId: string,
    homeTeam: string,
    awayTeam: string,
    prediction: Pick<
      StoredPrediction,
      'predictedResult' | 'predictedHomeGoals' | 'predictedAwayGoals' | 'confidence'
    >,
    matchDate: string,
    matchday?: number,
    extras?: {
      modelVersion?: string;
      homeForm?: string;
      awayForm?: string;
      keyFactors?: string[];
      poissonProbs?: { homeWin: number; draw: number; awayWin: number };
    },
  ) => void;
}

export interface BulkPersistResult {
  persisted: number;
  skipped: number;
  failed: number;
}

const defaultDeps: BulkPersistDeps = {
  predict: (h, a) => OptimizedPredictor.predictMatch(h, a),
  hasExistingPrediction: (id) => predictionTracker.getMatchPredictions(id).length > 0,
  store: (...args) => predictionTracker.storePrediction(...args),
};

export function isGameweekFullyPredicted(
  fixtures: Match[],
  hasPrediction: (matchId: string) => boolean = defaultDeps.hasExistingPrediction,
): boolean {
  return fixtures.length > 0 && fixtures.every((m) => hasPrediction(m.id));
}

export async function bulkPersistGameweekPredictions(
  fixtures: Match[],
  deps: Partial<BulkPersistDeps> = {},
): Promise<BulkPersistResult> {
  const { predict, hasExistingPrediction, store } = { ...defaultDeps, ...deps };
  const result: BulkPersistResult = { persisted: 0, skipped: 0, failed: 0 };

  for (const m of fixtures) {
    if (hasExistingPrediction(m.id)) {
      result.skipped += 1;
      continue;
    }
    try {
      const p = await predict(m.home_team, m.away_team);
      store(
        m.id,
        m.home_team,
        m.away_team,
        {
          predictedResult: p.predictedResult,
          predictedHomeGoals: p.predictedHomeGoals,
          predictedAwayGoals: p.predictedAwayGoals,
          confidence: p.confidence,
        },
        m.date,
        m.matchday,
        {
          modelVersion: MODEL_VERSION,
          homeForm: p.homeForm,
          awayForm: p.awayForm,
          keyFactors: p.insights,
        },
      );
      result.persisted += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
