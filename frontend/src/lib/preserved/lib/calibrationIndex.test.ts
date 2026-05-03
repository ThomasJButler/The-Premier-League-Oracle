import { describe, it, expect } from 'vitest';
import { calibrationIndex } from './calibrationIndex';
import type { CalibrationFactors } from '../services/predictionTracker';

const factors = (h: number, m: number, l: number): CalibrationFactors => ({
  highBand: h,
  mediumBand: m,
  lowBand: l,
});

describe('calibrationIndex', () => {
  it('returns 1.0 when every band is perfectly calibrated (factor = 1)', () => {
    expect(calibrationIndex(factors(1, 1, 1))).toBe(1);
  });

  it('returns 0.0 when every band is maximally miscalibrated (factor = 0 or 2)', () => {
    // |1-0| + |1-0| + |1-0| = 3 → mean = 1 → index = 0
    expect(calibrationIndex(factors(0, 0, 0))).toBe(0);
    // |1-2| + |1-2| + |1-2| = 3 → mean = 1 → index = 0
    expect(calibrationIndex(factors(2, 2, 2))).toBe(0);
  });

  it('returns the expected scalar for mixed factors', () => {
    // |1-0.9| + |1-1.0| + |1-1.2| = 0.1 + 0.0 + 0.2 = 0.3 → mean = 0.1 → index = 0.9
    expect(calibrationIndex(factors(0.9, 1.0, 1.2))).toBeCloseTo(0.9, 5);
  });

  it('clamps to [0, 1] even when factors fall outside the production [0.5, 1.5] range', () => {
    // Synthetic factors pushed past the production clamp range should not produce a negative index.
    // |1-3| + |1-3| + |1-3| = 6 → mean = 2 → 1 - 2 = -1 → clamped to 0
    expect(calibrationIndex(factors(3, 3, 3))).toBe(0);
    // Symmetric: deeply negative inputs also clamp at 0 from below.
    expect(calibrationIndex(factors(-1, -1, -1))).toBe(0);
  });
});
