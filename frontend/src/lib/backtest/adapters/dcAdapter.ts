/**
 * Walk-forward adapter for the Butler Dixon-Coles core.
 *
 * Maintains the replayed match history, refits once per match-date round
 * (cold Adam fit at first prediction, warm-started ≤40-iteration refits
 * thereafter, ρ frozen after the cold fit), and applies the residual stack +
 * calibration when configured. The decay reference is always the kickoff
 * being predicted — data time, never wall clock.
 *
 * Used by: hyperparameter tuning (pure DC), the B4 gate, and the CI pin spec.
 */

import { fitDixonColes, lambdasFor } from '../../engine/dixonColes';
import { buildGrid, gridToTriple } from '../../engine/poisson';
import { applyStack, applyCalibration } from '../../engine/stack';
import { stackFeatures } from '../../engine/features';
import type { DCParams, EngineMatch, StackFeatures, TeamRating } from '../../engine/types';
import type { Outcome, ProbTriple } from '../../engine/metrics';
import type { ArchiveMatch, PredictorAdapter } from '../types';

export interface DcRecord {
  /** Raw DC triple before stack/calibration — the input the layers train on. */
  dc: ProbTriple;
  features: StackFeatures;
  outcome: Outcome;
  season: string;
}

export interface DcAdapterConfig {
  name: string;
  xi: number;
  sigma: number;
  promotedPrior: TeamRating;
  stack?: { wForm: number; wRest: number };
  calibration?: { T: number; cD: number };
  coldIter?: number;
  warmIter?: number;
  /** When supplied, every prediction's raw components are appended here —
   *  the training set for stack/calibration fitting. */
  collect?: DcRecord[];
}

function toEngineMatch(m: ArchiveMatch): EngineMatch {
  return { date: m.kickoffISO, home: m.home, away: m.away, homeGoals: m.fthg, awayGoals: m.ftag };
}

export function dcAdapter(config: DcAdapterConfig): PredictorAdapter {
  const history: EngineMatch[] = [];
  let params: DCParams | undefined;
  let dirty = false;

  return {
    name: config.name,

    reset() {
      history.length = 0;
      params = undefined;
      dirty = false;
    },

    observe(m: ArchiveMatch) {
      history.push(toEngineMatch(m));
      dirty = true;
    },

    predict(m: ArchiveMatch) {
      if (history.length < 100) return undefined; // no meaningful fit yet

      // Refit once per round: walkForward forecasts a full match-date before
      // observing any of its results, so `dirty` flips exactly at round
      // boundaries. Cold fit (ρ free) the first time; warm-started refits
      // (ρ frozen) after.
      if (!params || dirty) {
        params = fitDixonColes(history, {
          xi: config.xi,
          sigma: config.sigma,
          refDate: m.kickoffISO,
          init: params,
          freezeRho: params !== undefined,
          maxIter: params ? (config.warmIter ?? 40) : (config.coldIter ?? 600),
        }).params;
        dirty = false;
      }

      const { home: lambdaHome, away: lambdaAway } = lambdasFor(
        params,
        m.home,
        m.away,
        config.promotedPrior
      );
      const dc = gridToTriple(buildGrid(lambdaHome, lambdaAway, params.rho));

      const features = stackFeatures(
        history,
        params,
        config.promotedPrior,
        m.home,
        m.away,
        m.kickoffISO
      );
      const stacked = applyStack(dc, features, config.stack ?? { wForm: 0, wRest: 0 });
      const calibrated = applyCalibration(stacked, config.calibration ?? { T: 1, cD: 0 });

      config.collect?.push({ dc, features, outcome: m.ftr, season: m.seasonId });
      return calibrated;
    },
  };
}
