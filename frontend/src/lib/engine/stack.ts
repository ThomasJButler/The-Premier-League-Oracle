/**
 * The Butler model's post-core probability layers, applied in order:
 *
 *   DC triple → residual stack (log-odds space) → optional XGBoost blend
 *            → calibration (temperature + draw intercept) → published triple
 *
 * Every transform works on log-odds/logits, never on raw probabilities —
 * blending probabilities linearly drags sharp forecasts toward the prior,
 * which is precisely the pathology the old ensemble suffered from.
 *
 * All weights ship in coefficients.json and default to inert (0 weights,
 * T = 1, cD = 0), so the pipeline degrades gracefully to pure Dixon-Coles.
 */

import { normalizeTriple, type ProbTriple } from './metrics';
import type { StackFeatures } from './types';

const EPS = 1e-9;

/** Softmax over (sH, 0, sA) — draw is the reference class. */
function fromScores(sH: number, sA: number): ProbTriple {
  const eH = Math.exp(sH);
  const eA = Math.exp(sA);
  const total = eH + 1 + eA;
  return { home: eH / total, draw: 1 / total, away: eA / total };
}

/** Log-odds of home and away vs the draw reference class. */
function toScores(p: ProbTriple): { sH: number; sA: number } {
  const d = Math.max(p.draw, EPS);
  return {
    sH: Math.log(Math.max(p.home, EPS) / d),
    sA: Math.log(Math.max(p.away, EPS) / d),
  };
}

/**
 * Apply the residual stack: symmetric feature shifts on the home/away
 * log-odds. A positive feature (home in hotter form, better rested) pushes
 * home up and away down by the same amount — draw-neutral by construction.
 */
export function applyStack(
  triple: ProbTriple,
  features: StackFeatures,
  weights: { wForm: number; wRest: number }
): ProbTriple {
  if (weights.wForm === 0 && weights.wRest === 0) return { ...triple };
  const { sH, sA } = toScores(triple);
  const shift = weights.wForm * features.formResidual + weights.wRest * features.restDiff;
  return fromScores(sH + shift, sA - shift);
}

/**
 * Blend an external model's triple (the XGBoost backend) in log-odds space:
 * s = (1 − w)·s_butler + w·s_ml per class score. At w = 0 this is the
 * identity; at w = 1 it is the external model. Unlike the old ensemble's
 * probability averaging + confidence nudges, this preserves sharpness where
 * the models agree and moves honestly where they disagree.
 */
export function blendLogOdds(butler: ProbTriple, external: ProbTriple, w: number): ProbTriple {
  if (w <= 0) return { ...butler };
  const a = toScores(butler);
  const b = toScores(external);
  return fromScores((1 - w) * a.sH + w * b.sH, (1 - w) * a.sA + w * b.sA);
}

/**
 * Calibration: temperature T on all logits plus an additive draw intercept.
 *   q_c ∝ exp(log p_c / T + cD·1[c = D])
 * T > 1 softens overconfident forecasts; cD corrects the one class (draws)
 * that systematically drifts in goal models. Two parameters — deliberately
 * too few to overfit — fitted on walk-forward out-of-sample forecasts only.
 */
export function applyCalibration(
  triple: ProbTriple,
  calibration: { T: number; cD: number }
): ProbTriple {
  const { T, cD } = calibration;
  if (T === 1 && cD === 0) return { ...triple };
  const safeT = Math.max(T, 0.05);
  return normalizeTriple({
    home: Math.exp(Math.log(Math.max(triple.home, EPS)) / safeT),
    draw: Math.exp(Math.log(Math.max(triple.draw, EPS)) / safeT + cD),
    away: Math.exp(Math.log(Math.max(triple.away, EPS)) / safeT),
  });
}

/** Normalised Shannon entropy of a triple, in [0, 1]. 1 = pure coin-flip. */
export function normalizedEntropy(p: ProbTriple): number {
  const terms = [p.home, p.draw, p.away].map((x) => {
    const v = Math.max(x, EPS);
    return -v * Math.log(v);
  });
  return (terms[0] + terms[1] + terms[2]) / Math.log(3);
}
