/**
 * Core types for the Butler model — a time-decayed, shrinkage-regularised
 * Dixon-Coles engine fitted by penalised maximum likelihood.
 *
 * Everything here is pure data: no methods, no environment. The engine's
 * contract is that identical inputs produce identical outputs on server,
 * browser, and test runner alike.
 */

import type { ProbTriple } from './metrics';

/** The minimal match record the engine fits on and predicts from. */
export interface EngineMatch {
  /** ISO-8601 kickoff (only the instant matters — no wall-clock reads). */
  date: string;
  /** CSV-canonical team names (see teamNames.toCsvName). */
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
}

/** One team's fitted strength parameters, in log-goals space. */
export interface TeamRating {
  /** Attack: positive = scores more than league average. */
  att: number;
  /** Defensive weakness: positive = concedes more than league average. */
  def: number;
}

/** A fitted Dixon-Coles parameter set. */
export interface DCParams {
  /** Neutral-ground log mean goals (≈ log 1.35). */
  mu: number;
  /** Global home advantage in log-goals (PL ≈ 0.2–0.3). */
  gamma: number;
  /** Low-score dependency correction (PL ≈ −0.03…−0.13). */
  rho: number;
  teams: Record<string, TeamRating>;
}

export interface FitOptions {
  /** Exponential time-decay rate per day. Default ln2/390 ≈ 0.00178
   *  (Dixon & Coles 1997's optimum, converted from half-weeks). */
  xi: number;
  /** L2 shrinkage prior standard deviation on team parameters. */
  sigma: number;
  /** Decay anchor — matches are weighted by age relative to this instant.
   *  Build time: the fit date. Runtime: the newest result's date. */
  refDate: string;
  /** Per-team prior means. Build time: absent (league mean 0). Runtime: the
   *  shipped build-time coefficients — how 33 seasons of information
   *  transfers without shipping raw matches. */
  priorMeans?: Record<string, TeamRating>;
  /** Prior mean for teams with no entry in priorMeans (newly promoted). */
  promotedPrior?: TeamRating;
  /** Keep ρ at its initial value (runtime refits: ρ is weakly identified on
   *  a two-season window and stable across seasons). */
  freezeRho?: boolean;
  /** Warm start (runtime refits converge in a fraction of the iterations). */
  init?: DCParams;
  /** Adam iteration cap. Default 600 (cold) — warm starts need far fewer. */
  maxIter?: number;
  /** Matches with decay weight below this are dropped. Default 0.005. */
  minWeight?: number;
}

export interface FitResult {
  params: DCParams;
  iterations: number;
  /** Weighted mean log-likelihood per match (higher = better fit). */
  logLikPerMatch: number;
  /** Decay-weighted effective sample size, Σw. */
  effectiveMatches: number;
}

/** The score grid: probability per exact scoreline, keyed "home-away". */
export type ScoreGrid = Record<string, number>;

/** A residual-stack feature vector (slice B3). */
export interface StackFeatures {
  /** (home − away) last-5 goal-difference residual vs DC expectation. */
  formResidual: number;
  /** Rest-day differential, clipped to ±3. */
  restDiff: number;
}

/** The engine's full output for one fixture (slice B3 wires this). */
export interface EnginePrediction {
  /** Final calibrated triple — the published probability. */
  triple: ProbTriple;
  /** Season-long "class" view (flat fit). */
  classTriple: ProbTriple;
  /** Time-decayed "form" view including the residual stack, pre-calibration. */
  formTriple: ProbTriple;
  /** Grid rescaled to match `triple` exactly (coherence by construction). */
  grid: ScoreGrid;
  lambdas: { home: number; away: number };
  ratings: { home: TeamRating; away: TeamRating };
  /** True when home/away resolved to no known team (promoted prior applied). */
  usedPromotedPrior: { home: boolean; away: boolean };
  /** Normalised entropy of `triple` in [0, 1]; 1 = coin-flip. */
  entropy: number;
}

/** Schema of the committed coefficients artifact (engine/coefficients.json). */
export interface Coefficients {
  version: number;
  /** Decay reference date of the shipped fit (ISO date). */
  fitAt: string;
  hyper: { xi: number; sigma: number; gridMax: number };
  /** Time-decayed fit — the "form" view and the prediction spine. */
  decayed: DCParams;
  /** Flat (undecayed, recent-seasons) fit — the "class" view. */
  flat: DCParams;
  promotedPrior: TeamRating;
  stack: { wForm: number; wRest: number; wMl: number };
  calibration: { T: number; cD: number };
  /** Walk-forward evidence recorded at fit time (feeds AI accuracy context). */
  backtest: {
    rps: number;
    brier: number;
    logLoss: number;
    accuracy: number;
    ece: number;
    sampleSize: number;
    seasons: string;
  };
}
