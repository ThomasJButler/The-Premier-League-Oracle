/**
 * The Butler model's fitting core: time-decayed, shrinkage-regularised
 * Dixon-Coles (1997) fitted by penalised maximum likelihood.
 *
 * Model, for match k with home team i and away team j:
 *
 *   log λ_k = μ + att_i + def_j + γ        (home scoring rate)
 *   log μ_k = μ + att_j + def_i            (away scoring rate)
 *   P(x, y) ∝ τ(x, y; λ, μ, ρ) · Pois(x; λ) · Pois(y; μ)
 *
 * maximising  Σ_k w_k · log P(x_k, y_k)  −  Σ_t ‖θ_t − m_t‖² / 2σ²
 *
 * where w_k = exp(−ξ · age_days) is the exponential recency weight and the
 * second term shrinks each team's (att, def) toward its prior mean m_t
 * (league average at build time; the shipped coefficients at runtime;
 * an empirical promoted-team prior for clubs with no history).
 *
 * Two implementation notes that matter:
 *
 * 1. IDENTIFIABILITY. The likelihood is invariant under att += c, μ −= c
 *    (and the same for def) — a flat ridge. The shrinkage prior breaks that
 *    invariance analytically: along the ridge the penalty is minimised at
 *    the centred solution, so the optimiser lands there without any manual
 *    recentring step.
 *
 * 2. DETERMINISM. Full-batch gradients, fixed initialisation, teams indexed
 *    in sorted order, no randomness, no wall-clock — the same inputs produce
 *    bit-identical parameters everywhere.
 *
 * Runtime: ~50 flops per match per iteration. A cold 600-iteration fit over
 * the decay-truncated archive (~3,500 matches) is ~10⁸ flops — well under a
 * second; warm-started runtime refits converge in tens of milliseconds.
 */

import type { DCParams, EngineMatch, FitOptions, FitResult, TeamRating } from './types';

/** Dixon & Coles 1997's fitted optimum (ξ = 0.0065 per half-week → per day):
 *  a 390-day information half-life. */
export const DEFAULT_XI = Math.LN2 / 390;
export const DEFAULT_SIGMA = 0.35;

/** ρ search box. Fitted values on PL data sit around −0.03…−0.13; the upper
 *  bound stays low because τ(0,0) = 1 − λμρ can cross zero for positive ρ
 *  with large λμ. */
const RHO_MIN = -0.2;
const RHO_MAX = 0.05;

const MS_PER_DAY = 86_400_000;

export function matchWeight(matchDate: string, refDate: string, xi: number): number {
  const days = Math.max(0, (Date.parse(refDate) - Date.parse(matchDate)) / MS_PER_DAY);
  return Math.exp(-xi * days);
}

interface PreppedData {
  /** Sorted team names — index order is the parameter order. */
  teams: string[];
  /** One row per surviving match: team indices, goals, decay weight. */
  rows: Array<{ i: number; j: number; x: number; y: number; w: number }>;
  sumW: number;
}

function prepare(matches: EngineMatch[], opts: FitOptions): PreppedData {
  const minWeight = opts.minWeight ?? 0.005;
  const weighted: Array<{ m: EngineMatch; w: number }> = [];
  const teamSet = new Set<string>();

  for (const m of matches) {
    const w = matchWeight(m.date, opts.refDate, opts.xi);
    if (w < minWeight) continue;
    weighted.push({ m, w });
    teamSet.add(m.home);
    teamSet.add(m.away);
  }

  const teams = [...teamSet].sort();
  const index = new Map(teams.map((t, k) => [t, k]));
  let sumW = 0;
  const rows = weighted.map(({ m, w }) => {
    sumW += w;
    return {
      i: index.get(m.home)!,
      j: index.get(m.away)!,
      x: m.homeGoals,
      y: m.awayGoals,
      w,
    };
  });

  return { teams, rows, sumW };
}

/**
 * Penalised weighted log-likelihood and its full analytic gradient at θ.
 * Vector layout: [μ, γ, ρ, att_0..att_{T−1}, def_0..def_{T−1}].
 * (Per-match constants −log x!·y! are dropped — they never affect the argmax.)
 */
function evaluate(
  data: PreppedData,
  theta: Float64Array,
  sigma: number,
  priorAtt: Float64Array,
  priorDef: Float64Array,
  freezeRho: boolean
): { ll: number; grad: Float64Array } {
  const T = data.teams.length;
  const mu = theta[0];
  const gamma = theta[1];
  const rho = theta[2];
  const grad = new Float64Array(3 + 2 * T);
  let ll = 0;

  for (const { i, j, x, y, w } of data.rows) {
    const logLam = mu + theta[3 + i] + theta[3 + T + j] + gamma;
    const logMuA = mu + theta[3 + j] + theta[3 + T + i];
    const lam = Math.exp(logLam);
    const muA = Math.exp(logMuA);

    // τ and its partials — nonzero only on the 2×2 low-score block.
    let logTau = 0;
    let dTauDLogLam = 0;
    let dTauDLogMu = 0;
    let dTauDRho = 0;
    if (x === 0 && y === 0) {
      const tau = Math.max(1 - lam * muA * rho, 1e-10);
      logTau = Math.log(tau);
      dTauDLogLam = -lam * muA * rho / tau;
      dTauDLogMu = -lam * muA * rho / tau;
      dTauDRho = -lam * muA / tau;
    } else if (x === 1 && y === 0) {
      const tau = Math.max(1 + muA * rho, 1e-10);
      logTau = Math.log(tau);
      dTauDLogMu = muA * rho / tau;
      dTauDRho = muA / tau;
    } else if (x === 0 && y === 1) {
      const tau = Math.max(1 + lam * rho, 1e-10);
      logTau = Math.log(tau);
      dTauDLogLam = lam * rho / tau;
      dTauDRho = lam / tau;
    } else if (x === 1 && y === 1) {
      const tau = Math.max(1 - rho, 1e-10);
      logTau = Math.log(tau);
      dTauDRho = -1 / tau;
    }

    ll += w * (x * logLam - lam + y * logMuA - muA + logTau);

    const gH = w * (x - lam + dTauDLogLam);
    const gA = w * (y - muA + dTauDLogMu);
    grad[0] += gH + gA;            // μ feeds both rates
    grad[1] += gH;                 // γ feeds the home rate only
    grad[2] += w * dTauDRho;
    grad[3 + i] += gH;             // home attack
    grad[3 + j] += gA;             // away attack
    grad[3 + T + j] += gH;         // away defence (concedes λ)
    grad[3 + T + i] += gA;         // home defence (concedes μ)
  }

  // Gaussian shrinkage toward prior means (NOT decay-weighted — the prior is
  // beliefs, not data).
  const invVar = 1 / (sigma * sigma);
  for (let t = 0; t < T; t++) {
    const da = theta[3 + t] - priorAtt[t];
    ll -= 0.5 * da * da * invVar;
    grad[3 + t] -= da * invVar;
    const dd = theta[3 + T + t] - priorDef[t];
    ll -= 0.5 * dd * dd * invVar;
    grad[3 + T + t] -= dd * invVar;
  }

  if (freezeRho) grad[2] = 0;
  return { ll, grad };
}

/**
 * Fit the Dixon-Coles model by full-batch Adam ascent on the penalised
 * weighted log-likelihood. Deterministic; converges cold in a few hundred
 * iterations and warm-started in a few dozen.
 */
export function fitDixonColes(matches: EngineMatch[], opts: FitOptions): FitResult {
  const data = prepare(matches, opts);
  const T = data.teams.length;
  const n = 3 + 2 * T;

  const priorAtt = new Float64Array(T);
  const priorDef = new Float64Array(T);
  for (let t = 0; t < T; t++) {
    const mean = opts.priorMeans?.[data.teams[t]] ?? opts.promotedPrior ?? { att: 0, def: 0 };
    priorAtt[t] = mean.att;
    priorDef[t] = mean.def;
  }

  // Initialise: warm start when provided, else prior means + sane globals.
  const theta = new Float64Array(n);
  theta[0] = opts.init?.mu ?? Math.log(1.35);
  theta[1] = opts.init?.gamma ?? 0.25;
  theta[2] = Math.min(RHO_MAX, Math.max(RHO_MIN, opts.init?.rho ?? -0.05));
  for (let t = 0; t < T; t++) {
    const init = opts.init?.teams[data.teams[t]];
    theta[3 + t] = init?.att ?? priorAtt[t];
    theta[3 + T + t] = init?.def ?? priorDef[t];
  }

  const maxIter = opts.maxIter ?? 600;
  const lr = 0.05;
  const b1 = 0.9;
  const b2 = 0.999;
  const eps = 1e-8;
  const mAdam = new Float64Array(n);
  const vAdam = new Float64Array(n);
  // Convergence: gradient sup-norm relative to the effective sample size —
  // the natural scale of the weighted-sum gradient.
  const tol = 1e-7 * Math.max(1, data.sumW);

  let iterations = 0;
  for (let iter = 1; iter <= maxIter; iter++) {
    iterations = iter;
    const { grad } = evaluate(data, theta, opts.sigma, priorAtt, priorDef, opts.freezeRho ?? false);

    // Convergence is checked BEFORE stepping — an already-converged θ must
    // be returned untouched, not nudged one more time.
    let gInf = 0;
    for (let k = 0; k < n; k++) {
      if (Math.abs(grad[k]) > gInf) gInf = Math.abs(grad[k]);
    }
    if (gInf < tol) break;

    const b1c = 1 - Math.pow(b1, iter);
    const b2c = 1 - Math.pow(b2, iter);
    for (let k = 0; k < n; k++) {
      const g = grad[k];
      mAdam[k] = b1 * mAdam[k] + (1 - b1) * g;
      vAdam[k] = b2 * vAdam[k] + (1 - b2) * g * g;
      // Ascent: the objective is a log-likelihood, not a loss.
      theta[k] += lr * (mAdam[k] / b1c) / (Math.sqrt(vAdam[k] / b2c) + eps);
    }
    theta[2] = Math.min(RHO_MAX, Math.max(RHO_MIN, theta[2]));
  }

  // Report the likelihood OF THE RETURNED PARAMETERS — inside the loop the
  // objective always lagged one Adam step behind θ.
  const finalLL = evaluate(data, theta, opts.sigma, priorAtt, priorDef, opts.freezeRho ?? false).ll;

  const teams: Record<string, TeamRating> = {};
  for (let t = 0; t < T; t++) {
    teams[data.teams[t]] = { att: theta[3 + t], def: theta[3 + T + t] };
  }

  return {
    params: { mu: theta[0], gamma: theta[1], rho: theta[2], teams },
    iterations,
    logLikPerMatch: data.sumW > 0 ? finalLL / data.sumW : 0,
    effectiveMatches: data.sumW,
  };
}

/** Scoring rates for a fixture under fitted params. Unknown teams take the
 *  supplied fallback rating (the promoted-team prior at the call site). */
export function lambdasFor(
  params: DCParams,
  home: string,
  away: string,
  fallback: TeamRating
): { home: number; away: number; homeRating: TeamRating; awayRating: TeamRating } {
  const homeRating = params.teams[home] ?? fallback;
  const awayRating = params.teams[away] ?? fallback;
  return {
    home: Math.exp(params.mu + homeRating.att + awayRating.def + params.gamma),
    away: Math.exp(params.mu + awayRating.att + homeRating.def),
    homeRating,
    awayRating,
  };
}

/** Test-only access to the objective for finite-difference gradient checks. */
export const __internals = { prepare, evaluate };
