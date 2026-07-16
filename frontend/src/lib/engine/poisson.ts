/**
 * Score-grid machinery: Poisson pmf, the Dixon-Coles low-score correction,
 * and the coherence rescale that keeps the displayed grid in exact agreement
 * with the calibrated outcome probabilities.
 *
 * Pure functions throughout. Grid cells are keyed "home-away" — the same
 * format the UI's scoreProbabilities contract has always used.
 */

import type { ProbTriple } from './metrics';
import type { ScoreGrid } from './types';

/** Goals 0..GRID_MAX per side. 11×11 truncation error < 1e-4 for λ ≤ 4. */
export const GRID_MAX = 10;

/** Memoised log-factorial that grows on demand, so a caller passing
 *  maxGoals > GRID_MAX gets correct values instead of an out-of-bounds
 *  undefined poisoning the grid with NaN. */
const LOG_FACTORIAL: number[] = [0];
function logFactorial(k: number): number {
  for (let i = LOG_FACTORIAL.length; i <= k; i++) {
    LOG_FACTORIAL.push(LOG_FACTORIAL[i - 1] + Math.log(i));
  }
  return LOG_FACTORIAL[k];
}

/** P(X = k) for X ~ Poisson(λ), computed in log space for stability. */
export function poissonPmf(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(lambda) - lambda - logFactorial(k));
}

/**
 * Dixon-Coles τ correction for the four low-score cells (1997, eq. 4.2).
 * With ρ < 0 it boosts 0-0 and 1-1 and shaves 1-0 / 0-1 — repairing the
 * independent-Poisson model's known underestimation of low-score draws.
 * Returns 1 outside the 2×2 block so callers multiply unconditionally.
 */
export function dcTau(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): number {
  if (homeGoals === 0 && awayGoals === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + lambdaAway * rho;
  if (homeGoals === 0 && awayGoals === 1) return 1 + lambdaHome * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

/** Build the τ-corrected, renormalised score grid. */
export function buildGrid(
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
  maxGoals: number = GRID_MAX
): ScoreGrid {
  const grid: ScoreGrid = {};
  let total = 0;
  for (let h = 0; h <= maxGoals; h++) {
    const ph = poissonPmf(lambdaHome, h);
    for (let a = 0; a <= maxGoals; a++) {
      // τ can go non-positive for extreme ρ/λ combinations — clamp so the
      // grid never emits a negative probability.
      const cell = Math.max(0, ph * poissonPmf(lambdaAway, a) * dcTau(h, a, lambdaHome, lambdaAway, rho));
      grid[`${h}-${a}`] = cell;
      total += cell;
    }
  }
  if (total > 0) {
    for (const key of Object.keys(grid)) grid[key] /= total;
  }
  return grid;
}

/** Sum grid cells into the H/D/A outcome triple. */
export function gridToTriple(grid: ScoreGrid): ProbTriple {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const [score, prob] of Object.entries(grid)) {
    const dash = score.indexOf('-');
    const h = Number(score.slice(0, dash));
    const a = Number(score.slice(dash + 1));
    if (h > a) home += prob;
    else if (h === a) draw += prob;
    else away += prob;
  }
  return { home, draw, away };
}

/**
 * Rescale grid cells per outcome class so the grid's implied triple equals
 * `target` EXACTLY. Because {h>a}, {h=a}, {h<a} partition the grid, one
 * multiplicative pass suffices (no iteration), and relative probabilities
 * WITHIN each outcome are preserved — the correct invariance when a
 * calibration layer has moved outcome mass but not scoreline shape.
 *
 * This is what makes scoreline, top-scorelines, pick, and probability bars
 * mutually consistent by construction rather than by patching.
 */
export function rescaleGridToTriple(grid: ScoreGrid, target: ProbTriple): ScoreGrid {
  const current = gridToTriple(grid);
  // A positive target on an empty outcome class cannot be represented — the
  // rescaled grid would silently drop that mass and stop summing to 1.
  // Impossible with real λ inputs (every τ-corrected cell is positive), so
  // reaching this is a caller bug that must be loud, not a quiet mis-sum.
  if (
    (current.home === 0 && target.home > 0) ||
    (current.draw === 0 && target.draw > 0) ||
    (current.away === 0 && target.away > 0)
  ) {
    throw new RangeError('rescaleGridToTriple: positive target mass on an empty outcome class');
  }
  const factor = {
    home: current.home > 0 ? target.home / current.home : 0,
    draw: current.draw > 0 ? target.draw / current.draw : 0,
    away: current.away > 0 ? target.away / current.away : 0,
  };
  const out: ScoreGrid = {};
  for (const [score, prob] of Object.entries(grid)) {
    const dash = score.indexOf('-');
    const h = Number(score.slice(0, dash));
    const a = Number(score.slice(dash + 1));
    out[score] = prob * (h > a ? factor.home : h === a ? factor.draw : factor.away);
  }
  return out;
}

/** Top-N scorelines by probability, descending. Ties break by key order for
 *  determinism (lower home goals, then lower away goals first). */
export function topScorelines(
  grid: ScoreGrid,
  n: number
): Array<{ score: string; probability: number }> {
  return Object.entries(grid)
    .map(([score, probability]) => ({ score, probability }))
    .sort((a, b) => b.probability - a.probability || a.score.localeCompare(b.score))
    .slice(0, n);
}
