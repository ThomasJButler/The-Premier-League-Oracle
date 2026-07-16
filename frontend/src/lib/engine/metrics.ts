/**
 * Proper scoring rules and calibration diagnostics for 3-way match forecasts.
 *
 * This module is the single vocabulary for forecast quality across the app:
 * the walk-forward backtest harness (src/lib/backtest/) and the production
 * prediction tracker both import these functions, so offline evaluation and
 * live tracking can never disagree on a formula.
 *
 * Pure and environment-free by design: no localStorage, no Date, no fs —
 * safe to import from browser, SSR, and Node test contexts alike.
 *
 * Outcomes are ordered (H, D, A). The ordering matters for RPS, which is the
 * football-standard scoring rule precisely because it respects that a
 * home-win forecast is "less wrong" about a draw than about an away win.
 */

export type Outcome = 'H' | 'D' | 'A';

/** A 3-way outcome probability distribution. Should sum to ~1. */
export interface ProbTriple {
  home: number;
  draw: number;
  away: number;
}

/** One evaluated forecast: what we predicted, what happened, where. */
export interface ScoredRecord {
  p: ProbTriple;
  outcome: Outcome;
  /** Season label, e.g. '2023-2024' — enables per-season breakdowns. */
  season: string;
  matchId: string;
}

export interface OutcomeStats {
  /** How many matches actually finished with this outcome. */
  actual: number;
  /** How many times the forecast's argmax picked this outcome. */
  predicted: number;
  /** How many picks of this outcome were correct. */
  correct: number;
  /** correct / predicted (0 when never predicted). */
  precision: number;
  /** correct / actual (0 when the outcome never occurred). */
  recall: number;
}

export interface MetricSummary {
  n: number;
  /** Mean ranked probability score. Lower is better. Range [0, 1]. */
  rps: number;
  /** Mean 3-class Brier score Σ(p−o)². Lower is better. Range [0, 2]. */
  brier: number;
  /** Mean negative log-likelihood of the realised outcome. Lower is better. */
  logLoss: number;
  /** Share of matches where argmax(p) matched the outcome. */
  accuracy: number;
  outcomes: Record<Outcome, OutcomeStats>;
  /** Share of matches where the forecast's argmax was a draw — the classic
   *  "model never picks draws" tell, tracked explicitly. */
  drawPredictedRate: number;
}

export interface CalibrationBin {
  /** Inclusive lower bound of the forecast-probability bin. */
  lo: number;
  /** Exclusive upper bound (inclusive for the final bin). */
  hi: number;
  n: number;
  /** Mean forecast probability inside the bin. */
  meanForecast: number;
  /** Empirical frequency of the event inside the bin. */
  observedRate: number;
}

const ONE_HOT: Record<Outcome, [number, number, number]> = {
  H: [1, 0, 0],
  D: [0, 1, 0],
  A: [0, 0, 1],
};

/** Floor applied inside logLoss so a zero-probability outcome scores ~34.5, not Infinity. */
const LOG_LOSS_FLOOR = 1e-15;

function asArray(p: ProbTriple): [number, number, number] {
  return [p.home, p.draw, p.away];
}

/**
 * Ranked probability score for 3 ordered outcomes (H, D, A):
 *
 *   RPS = ½ · [ (P_H − O_H)² + ((P_H + P_D) − (O_H + O_D))² ]
 *
 * i.e. the mean squared error of the cumulative distribution. A home-win
 * forecast is punished less by a draw than by an away win — the ordinal
 * awareness Brier lacks, and why RPS is the football-forecasting standard
 * (Constantinou & Fenton 2012).
 */
export function rps(p: ProbTriple, outcome: Outcome): number {
  const [pH, pD] = asArray(p);
  const [oH, oD] = ONE_HOT[outcome];
  const c1 = pH - oH;
  const c2 = pH + pD - (oH + oD);
  return 0.5 * (c1 * c1 + c2 * c2);
}

/** Multiclass Brier score Σ_k (p_k − o_k)². Range [0, 2] — matches the
 *  convention already used by predictionTracker.computeBrier. */
export function brier(p: ProbTriple, outcome: Outcome): number {
  const probs = asArray(p);
  const target = ONE_HOT[outcome];
  let sum = 0;
  for (let k = 0; k < 3; k++) {
    const d = probs[k] - target[k];
    sum += d * d;
  }
  return sum;
}

/** Negative log-likelihood of the realised outcome, floored for numeric safety. */
export function logLoss(p: ProbTriple, outcome: Outcome): number {
  const prob = outcome === 'H' ? p.home : outcome === 'D' ? p.draw : p.away;
  return -Math.log(Math.max(prob, LOG_LOSS_FLOOR));
}

/**
 * The forecast's pick. Ties break H > D > A so the result is deterministic —
 * a genuine three-way tie (uniform forecast) resolves to the empirically most
 * frequent outcome (home) rather than depending on object-key order.
 */
export function argmaxOutcome(p: ProbTriple): Outcome {
  if (p.home >= p.draw && p.home >= p.away) return 'H';
  if (p.draw >= p.away) return 'D';
  return 'A';
}

/** Rescale a triple to sum to exactly 1. Degenerate input (sum ≤ 0 or
 *  non-finite) falls back to the uniform distribution. */
export function normalizeTriple(p: ProbTriple): ProbTriple {
  const total = p.home + p.draw + p.away;
  if (!Number.isFinite(total) || total <= 0) {
    return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  }
  return { home: p.home / total, draw: p.draw / total, away: p.away / total };
}

/** Aggregate a set of scored forecasts into every headline metric at once. */
export function summarize(records: ScoredRecord[]): MetricSummary {
  const outcomes: Record<Outcome, OutcomeStats> = {
    H: { actual: 0, predicted: 0, correct: 0, precision: 0, recall: 0 },
    D: { actual: 0, predicted: 0, correct: 0, precision: 0, recall: 0 },
    A: { actual: 0, predicted: 0, correct: 0, precision: 0, recall: 0 },
  };

  if (records.length === 0) {
    return { n: 0, rps: 0, brier: 0, logLoss: 0, accuracy: 0, outcomes, drawPredictedRate: 0 };
  }

  let rpsSum = 0;
  let brierSum = 0;
  let logLossSum = 0;
  let correct = 0;

  for (const r of records) {
    rpsSum += rps(r.p, r.outcome);
    brierSum += brier(r.p, r.outcome);
    logLossSum += logLoss(r.p, r.outcome);

    const pick = argmaxOutcome(r.p);
    outcomes[r.outcome].actual++;
    outcomes[pick].predicted++;
    if (pick === r.outcome) {
      outcomes[pick].correct++;
      correct++;
    }
  }

  for (const key of ['H', 'D', 'A'] as const) {
    const o = outcomes[key];
    o.precision = o.predicted > 0 ? o.correct / o.predicted : 0;
    o.recall = o.actual > 0 ? o.correct / o.actual : 0;
  }

  const n = records.length;
  return {
    n,
    rps: rpsSum / n,
    brier: brierSum / n,
    logLoss: logLossSum / n,
    accuracy: correct / n,
    outcomes,
    drawPredictedRate: outcomes.D.predicted / n,
  };
}

/**
 * Reliability curve over uniform probability bins.
 *
 * mode 'maxProb': bins the confidence of the predicted class against its hit
 * rate — "when the model says 60%, is it right 60% of the time?".
 * mode 'H' | 'D' | 'A': bins the forecast probability of that outcome against
 * its empirical frequency — the per-outcome view that exposes draw bias.
 *
 * Empty bins are omitted; `hi` is inclusive for the final bin so p = 1 lands
 * in the top bin rather than off the end.
 */
export function calibrationCurve(
  records: ScoredRecord[],
  mode: 'maxProb' | Outcome,
  bins: number = 10
): CalibrationBin[] {
  const sums = Array.from({ length: bins }, () => ({ n: 0, forecast: 0, observed: 0 }));

  for (const r of records) {
    let forecast: number;
    let event: boolean;
    if (mode === 'maxProb') {
      const pick = argmaxOutcome(r.p);
      forecast = Math.max(r.p.home, r.p.draw, r.p.away);
      event = pick === r.outcome;
    } else {
      forecast = mode === 'H' ? r.p.home : mode === 'D' ? r.p.draw : r.p.away;
      event = r.outcome === mode;
    }
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(forecast * bins)));
    sums[idx].n++;
    sums[idx].forecast += forecast;
    sums[idx].observed += event ? 1 : 0;
  }

  const result: CalibrationBin[] = [];
  for (let i = 0; i < bins; i++) {
    const bin = sums[i];
    if (bin.n === 0) continue;
    result.push({
      lo: i / bins,
      hi: (i + 1) / bins,
      n: bin.n,
      meanForecast: bin.forecast / bin.n,
      observedRate: bin.observed / bin.n,
    });
  }
  return result;
}

/**
 * Expected calibration error over the max-prob reliability curve:
 * ECE = Σ_b (n_b / N) · |observedRate_b − meanForecast_b|.
 * 0 = perfectly calibrated confidence; ~0.05+ = visibly over/under-confident.
 */
export function ece(records: ScoredRecord[], bins: number = 10): number {
  if (records.length === 0) return 0;
  const curve = calibrationCurve(records, 'maxProb', bins);
  let total = 0;
  for (const bin of curve) {
    total += (bin.n / records.length) * Math.abs(bin.observedRate - bin.meanForecast);
  }
  return total;
}
