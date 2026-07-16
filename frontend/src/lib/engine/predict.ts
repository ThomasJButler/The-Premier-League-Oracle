/**
 * The Butler model's prediction path for a single fixture:
 *
 *   Dixon-Coles rates → score grid → residual stack → optional XGBoost
 *   log-odds blend → calibration → published triple + coherent grid
 *
 * Synchronous, pure, and deterministic: a function of (coefficients, live
 * parameters, match history, fixture). Identical on the Vercel server and in
 * the browser — the columnists and the reader see the same model.
 */

import { lambdasFor } from './dixonColes';
import { buildGrid, gridToTriple, rescaleGridToTriple } from './poisson';
import { applyStack, applyCalibration, blendLogOdds, normalizedEntropy } from './stack';
import { stackFeatures } from './features';
import { toCsvName } from './teamNames';
import type { ProbTriple } from './metrics';
import type { Coefficients, DCParams, EngineMatch, EnginePrediction } from './types';

export interface LiveParams {
  decayed: DCParams;
  flat: DCParams;
}

export interface FixtureInput {
  /** Team names in any known form (API, CSV, colloquial). */
  home: string;
  away: string;
  /** ISO kickoff — the decay/feature reference instant. */
  kickoff: string;
  /** Completed matches for feature derivation (CSV-canonical names). */
  history?: EngineMatch[];
  /** Optional external model triple (the XGBoost backend), blended in
   *  log-odds space at coefficients.stack.wMl. */
  external?: ProbTriple;
}

export function predictFixture(
  coefficients: Coefficients,
  live: LiveParams,
  input: FixtureInput
): EnginePrediction {
  const home = toCsvName(input.home) ?? input.home;
  const away = toCsvName(input.away) ?? input.away;
  const history = input.history ?? [];
  const prior = coefficients.promotedPrior;

  // Flagged, never logged: the engine stays pure (no console, no
  // environment). The caller boundary (butlerFacade) surfaces this —
  // a genuinely promoted club is expected; an established club appearing
  // means team-name drift upstream.
  const usedPromotedPrior = {
    home: !(home in live.decayed.teams),
    away: !(away in live.decayed.teams),
  };

  // 1. The core: time-decayed rates → τ-corrected grid.
  const rates = lambdasFor(live.decayed, home, away, prior);
  const rawGrid = buildGrid(rates.home, rates.away, live.decayed.rho);
  const dcTriple = gridToTriple(rawGrid);

  // 2. Residual stack (hot/cold streaks + congestion the decay hasn't absorbed).
  const features = stackFeatures(history, live.decayed, prior, home, away, input.kickoff);
  const formTriple = applyStack(dcTriple, features, coefficients.stack);

  // 3. Optional external blend, in log-odds space.
  const blended = input.external
    ? blendLogOdds(formTriple, input.external, coefficients.stack.wMl)
    : formTriple;

  // 4. Calibration — the published probability.
  const triple = applyCalibration(blended, coefficients.calibration);

  // 5. The "class" view: same fixture under the slow-memory parameter set.
  const classRates = lambdasFor(live.flat, home, away, prior);
  const classTriple = gridToTriple(buildGrid(classRates.home, classRates.away, live.flat.rho));

  // 6. Coherence: the displayed grid agrees with the published triple exactly.
  const grid = rescaleGridToTriple(rawGrid, triple);

  return {
    triple,
    classTriple,
    formTriple,
    grid,
    lambdas: { home: rates.home, away: rates.away },
    ratings: { home: rates.homeRating, away: rates.awayRating },
    usedPromotedPrior,
    entropy: normalizedEntropy(triple),
  };
}
