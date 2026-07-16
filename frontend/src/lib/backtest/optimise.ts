/**
 * Dependency-free fitting of the Butler post-core layers (residual stack
 * weights and calibration) on walk-forward out-of-sample records.
 *
 * The no-leakage rule is architectural: every DcRecord fed in here was
 * produced by the walk-forward protocol, so the layers only ever learn from
 * forecasts made without knowledge of their outcomes. Season-blocked CV on
 * top of that guards the SHIP-ZERO rule: a stack feature is kept only if it
 * buys ≥ MIN_CV_GAIN log-loss on held-out seasons — otherwise its weight
 * ships as 0 and the pipeline degrades gracefully to pure Dixon-Coles.
 */

import { applyStack, applyCalibration } from '../engine/stack';
import { logLoss, type ProbTriple } from '../engine/metrics';
import type { DcRecord } from './adapters/dcAdapter';

/** A stack feature must earn this much held-out log-loss to ship non-zero. */
export const MIN_CV_GAIN = 0.002;

/** Calibration ships as identity inside these thresholds (P1 design). */
const T_IDENTITY = [0.97, 1.03] as const;
const CD_IDENTITY = 0.02;

/** Golden-section minimisation on [lo, hi] — exact enough at 40 iterations
 *  for 1-D smooth objectives, no derivatives, no dependencies. */
export function goldenSection(
  f: (x: number) => number,
  lo: number,
  hi: number,
  iterations: number = 40
): number {
  const phi = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - phi * (b - a);
  let d = a + phi * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let k = 0; k < iterations; k++) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - phi * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + phi * (b - a);
      fd = f(d);
    }
  }
  return (a + b) / 2;
}

function meanNll(records: DcRecord[], transform: (r: DcRecord) => ProbTriple): number {
  if (records.length === 0) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (const r of records) total += logLoss(transform(r), r.outcome);
  return total / records.length;
}

export interface StackWeights {
  wForm: number;
  wRest: number;
}

/** L2 penalty keeping stack weights small — regularisation, not zeroing
 *  (the ship-zero decision is made by CV, not by the penalty). */
const STACK_L2 = 0.01;

/** Fit (wForm, wRest) by coordinate golden-section on penalised NLL,
 *  honouring a feature mask (masked features stay at 0). */
export function fitStackWeights(
  records: DcRecord[],
  mask: { form: boolean; rest: boolean }
): StackWeights {
  let w: StackWeights = { wForm: 0, wRest: 0 };
  const objective = (candidate: StackWeights) =>
    meanNll(records, (r) => applyStack(r.dc, r.features, candidate)) +
    STACK_L2 * (candidate.wForm ** 2 + candidate.wRest ** 2);

  // Two coordinate passes are plenty for a 2-D smooth objective.
  for (let pass = 0; pass < 2; pass++) {
    if (mask.form) {
      const wForm = goldenSection((x) => objective({ ...w, wForm: x }), -0.6, 0.6);
      w = { ...w, wForm };
    }
    if (mask.rest) {
      const wRest = goldenSection((x) => objective({ ...w, wRest: x }), -0.3, 0.3);
      w = { ...w, wRest };
    }
  }
  return w;
}

/** Mean held-out NLL under season-blocked cross-validation for a mask.
 *  Callers must guarantee ≥ 2 seasons — selectStack enforces it. */
function cvNll(records: DcRecord[], mask: { form: boolean; rest: boolean }): number {
  const seasons = [...new Set(records.map((r) => r.season))].sort();
  let total = 0;
  for (const held of seasons) {
    const train = records.filter((r) => r.season !== held);
    const test = records.filter((r) => r.season === held);
    const w = fitStackWeights(train, mask);
    total += meanNll(test, (r) => applyStack(r.dc, r.features, w)) * test.length;
  }
  return total / records.length;
}

export interface StackSelection {
  weights: StackWeights;
  cv: Record<'none' | 'form' | 'rest' | 'both', number>;
}

/**
 * The ship-zero rule, executed: evaluate all four feature masks under
 * season-blocked CV; a feature ships non-zero only when every mask that
 * includes it beats the corresponding mask without it by ≥ MIN_CV_GAIN.
 *
 * With fewer than two seasons of records, cross-validation is impossible —
 * and no feature may ship without held-out evidence, so everything ships
 * zero. In-sample "evidence" is not evidence.
 */
export function selectStack(records: DcRecord[]): StackSelection {
  const seasonCount = new Set(records.map((r) => r.season)).size;
  if (seasonCount < 2) {
    const none = meanNll(records, (r) => ({ ...r.dc }));
    return {
      weights: { wForm: 0, wRest: 0 },
      cv: { none, form: Number.POSITIVE_INFINITY, rest: Number.POSITIVE_INFINITY, both: Number.POSITIVE_INFINITY },
    };
  }

  const cv = {
    none: cvNll(records, { form: false, rest: false }),
    form: cvNll(records, { form: true, rest: false }),
    rest: cvNll(records, { form: false, rest: true }),
    both: cvNll(records, { form: true, rest: true }),
  };

  const keepForm = cv.form <= cv.none - MIN_CV_GAIN && cv.both <= cv.rest - MIN_CV_GAIN;
  const keepRest = cv.rest <= cv.none - MIN_CV_GAIN && cv.both <= cv.form - MIN_CV_GAIN;

  const weights =
    keepForm || keepRest
      ? fitStackWeights(records, { form: keepForm, rest: keepRest })
      : { wForm: 0, wRest: 0 };

  return { weights, cv };
}

export interface CalibrationParams {
  T: number;
  cD: number;
}

/**
 * Fit temperature + draw intercept on stacked OOS forecasts by coordinate
 * golden-section, then apply the ship-identity thresholds: if the fitted
 * values are within noise of the identity, ship the identity — an honest
 * model needs no correction, and two fewer moving parts is the Butler way.
 */
export function fitCalibration(records: DcRecord[], stack: StackWeights): CalibrationParams {
  // No evidence → no correction. (Also guards the NLL's divide-by-zero.)
  if (records.length === 0) return { T: 1, cD: 0 };

  const stacked = records.map((r) => ({
    p: applyStack(r.dc, r.features, stack),
    outcome: r.outcome,
  }));
  const nll = (T: number, cD: number) => {
    let total = 0;
    for (const s of stacked) total += logLoss(applyCalibration(s.p, { T, cD }), s.outcome);
    return total / stacked.length;
  };

  let T = 1;
  let cD = 0;
  for (let pass = 0; pass < 3; pass++) {
    T = goldenSection((x) => nll(x, cD), 0.7, 1.5);
    cD = goldenSection((x) => nll(T, x), -0.4, 0.4);
  }

  if (T >= T_IDENTITY[0] && T <= T_IDENTITY[1] && Math.abs(cD) < CD_IDENTITY) {
    return { T: 1, cD: 0 };
  }
  return { T, cD };
}
