import type { CalibrationFactors } from '../services/predictionTracker';

/**
 * Reduces the three per-band calibration factors to a single [0, 1] scalar.
 *
 * Formula: 1 - mean(|1 - factor|) across high / medium / low bands.
 *
 * A factor of 1.0 means the model's stated confidence matches actual hit rate
 * for that band; |1 - factor| therefore measures distance from perfect
 * calibration. Averaging across the three bands and subtracting from 1 yields:
 *   1.0 → every band is perfectly calibrated
 *   0.0 → every band is maximally miscalibrated
 *
 * MVP definition; spec doesn't pin the formula. Open to swap for ECE / Brier
 * decomposition / log-loss reliability if a more standard scalar is wanted.
 *
 * Result is clamped to [0, 1] defensively. `getCalibrationFactors` already
 * clamps each factor to [0.5, 1.5], so the natural lower bound from that path
 * is 0.5 — but consumers may pass synthetic factors during analysis, so the
 * clamp protects the [0, 1] contract regardless of input range.
 */
export function calibrationIndex(factors: CalibrationFactors): number {
  const meanDeviation =
    (Math.abs(1 - factors.highBand) +
      Math.abs(1 - factors.mediumBand) +
      Math.abs(1 - factors.lowBand)) /
    3;
  return Math.max(0, Math.min(1, 1 - meanDeviation));
}
