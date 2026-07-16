/**
 * Keeps the shipped coefficients live between deploys.
 *
 * When the caller's match history contains results newer than the shipped
 * fit, both parameter sets are re-fitted over that history — warm-started
 * from the shipped values, shrunk TOWARD the shipped values (they are the
 * prior, carrying 33 seasons of information), decay re-anchored to the
 * newest result, ρ frozen. Saturday's results move Monday's numbers without
 * waiting for a redeploy.
 *
 * Deterministic and memoised: the refit is a pure function of
 * (coefficients, history), cached on a cheap history fingerprint so it runs
 * once per data refresh, not once per fixture.
 */

import { fitDixonColes } from './dixonColes';
import type { Coefficients, DCParams, EngineMatch, TeamRating } from './types';
import type { LiveParams } from './predict';

const WARM_ITER = 150;

let cacheKey = '';
let cacheValue: LiveParams | undefined;

/**
 * Order-independent FNV-style content hash over every field the fit
 * consumes. Length + newest-date alone would collide when a result is
 * CORRECTED in place (same match count, same max date, different score) —
 * and a stale fit on a corrected result is exactly the silent bug a cache
 * must never introduce. Summing per-match hashes keeps the key independent
 * of array order, so IndexedDB retrieval order can't bust the cache.
 */
function contentHash(history: EngineMatch[]): string {
  let sum = 0;
  for (const m of history) {
    let h = 0x811c9dc5;
    const s = `${m.date}|${m.home}|${m.away}|${m.homeGoals}|${m.awayGoals}`;
    for (let k = 0; k < s.length; k++) {
      h ^= s.charCodeAt(k);
      h = Math.imul(h, 0x01000193);
    }
    sum = (sum + (h >>> 0)) % Number.MAX_SAFE_INTEGER;
  }
  return `${history.length}:${sum.toString(36)}`;
}

function fingerprint(coefficients: Coefficients, history: EngineMatch[], newest: string): string {
  return `${coefficients.version}|${coefficients.fitAt}|${newest}|${contentHash(history)}`;
}

function shippedParams(coefficients: Coefficients): LiveParams {
  return { decayed: coefficients.decayed, flat: coefficients.flat };
}

function refit(
  coefficients: Coefficients,
  history: EngineMatch[],
  shipped: DCParams,
  xi: number,
  refDate: string
): DCParams {
  // The shipped ratings act as the prior means — this is how 33 seasons of
  // archive information transfers into a fit over a few hundred live
  // matches. Unknown clubs shrink toward the promoted prior.
  const priorMeans: Record<string, TeamRating> = { ...shipped.teams };
  return fitDixonColes(history, {
    xi,
    sigma: coefficients.hyper.sigma,
    refDate,
    priorMeans,
    promotedPrior: coefficients.promotedPrior,
    init: shipped,
    freezeRho: true,
    maxIter: WARM_ITER,
  }).params;
}

/**
 * The parameter sets to predict with: shipped coefficients, refreshed by a
 * warm refit when `history` carries results newer than the shipped fit.
 */
export function getLiveParams(coefficients: Coefficients, history: EngineMatch[]): LiveParams {
  if (history.length === 0) return shippedParams(coefficients);

  let newest = '';
  for (const m of history) {
    if (m.date > newest) newest = m.date;
  }
  // Nothing newer than the shipped fit → the shipped params are current.
  if (newest.slice(0, 10) <= coefficients.fitAt) return shippedParams(coefficients);

  const key = fingerprint(coefficients, history, newest);
  if (key === cacheKey && cacheValue) return cacheValue;

  const live: LiveParams = {
    decayed: refit(coefficients, history, coefficients.decayed, coefficients.hyper.xi, newest),
    flat: refit(coefficients, history, coefficients.flat, coefficients.hyper.xi / 4, newest),
  };
  cacheKey = key;
  cacheValue = live;
  return live;
}

/** Test hook: clear the memo between cases. */
export function __clearRuntimeFitCache(): void {
  cacheKey = '';
  cacheValue = undefined;
}
