/**
 * The Butler model — public surface.
 *
 * A time-decayed, shrinkage-regularised Dixon-Coles engine with a
 * walk-forward-fitted residual stack and calibration, shipped as a few KB of
 * fitted coefficients and ~1k lines of dependency-free TypeScript.
 *
 * Everything exported here is pure and environment-free (no localStorage,
 * no fetch, no wall clock): identical inputs → identical predictions on the
 * server, in the browser, and in tests.
 */

import coefficientsJson from './coefficients.json';
import type { Coefficients } from './types';

export const coefficients = coefficientsJson as Coefficients;

/** True once `npm run engine:fit` has minted real coefficients. */
export const isFitted = coefficients.version >= 1;

export { predictFixture, type FixtureInput, type LiveParams } from './predict';
export { getLiveParams } from './runtimeFit';
export { fitDixonColes, lambdasFor, matchWeight, DEFAULT_XI, DEFAULT_SIGMA } from './dixonColes';
export { buildGrid, gridToTriple, rescaleGridToTriple, topScorelines, GRID_MAX } from './poisson';
export { applyStack, applyCalibration, blendLogOdds, normalizedEntropy } from './stack';
export { stackFeatures, formResidual, restDays } from './features';
export { toCsvName, isKnownCsvTeam, KNOWN_CSV_TEAMS } from './teamNames';
export * from './metrics';
export type {
  Coefficients,
  DCParams,
  EngineMatch,
  EnginePrediction,
  FitOptions,
  FitResult,
  ScoreGrid,
  StackFeatures,
  TeamRating,
} from './types';
