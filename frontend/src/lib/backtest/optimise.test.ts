import { describe, it, expect } from 'vitest';
import { goldenSection, fitStackWeights, selectStack, fitCalibration, MIN_CV_GAIN } from './optimise';
import type { DcRecord } from './adapters/dcAdapter';
import type { Outcome } from '../engine/metrics';

describe('goldenSection', () => {
  it('finds the minimum of a smooth 1-D function', () => {
    expect(goldenSection((x) => (x - 0.37) ** 2, -1, 1)).toBeCloseTo(0.37, 6);
    expect(goldenSection((x) => Math.cosh(x - 2), 0, 5)).toBeCloseTo(2, 6);
  });
});

/**
 * Synthetic OOS records, deterministic (index-driven, no randomness).
 *
 * The "noise" features use a hash (fractional part of a scaled sine) rather
 * than small modular cycles: an earlier version used `i % 3` / `i % 5`
 * patterns whose periods aliased against the period-10 outcome cycle, and
 * the CV honestly discovered that phantom correlation and fitted a large
 * weight to it — a good reminder that periodic "noise" isn't noise.
 */
const hashNoise = (i: number): number => {
  const x = Math.sin((i + 1) * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1; // deterministic, in [−1, 1)
};

function syntheticRecords(informativeForm: boolean): DcRecord[] {
  const records: DcRecord[] = [];
  const outcomes: Outcome[] = ['H', 'A', 'H', 'D', 'A', 'H', 'A', 'D', 'H', 'A'];
  for (let i = 0; i < 200; i++) {
    const outcome = outcomes[i % outcomes.length];
    // When informative: the form feature genuinely points at the outcome.
    // When noise: hash — uncorrelated with the outcome cycle.
    const formResidual = informativeForm
      ? outcome === 'H' ? 1 : outcome === 'A' ? -1 : 0
      : hashNoise(i);
    records.push({
      dc: { home: 0.4, draw: 0.27, away: 0.33 }, // core sees nothing
      features: { formResidual, restDiff: hashNoise(i + 1000) * 1.5 }, // rest always noise
      outcome,
      season: i < 100 ? '2015-2016' : '2016-2017', // two seasons → CV possible
    });
  }
  return records;
}

describe('fitStackWeights', () => {
  it('learns a positive form weight from informative records', () => {
    const w = fitStackWeights(syntheticRecords(true), { form: true, rest: false });
    expect(w.wForm).toBeGreaterThan(0.3);
    expect(w.wRest).toBe(0);
  });

  it('respects the mask exactly', () => {
    const w = fitStackWeights(syntheticRecords(true), { form: false, rest: false });
    expect(w).toEqual({ wForm: 0, wRest: 0 });
  });
});

describe('selectStack — the ship-zero rule', () => {
  it('keeps a genuinely predictive feature and rejects the noise one', () => {
    const { weights, cv } = selectStack(syntheticRecords(true));
    expect(weights.wForm).toBeGreaterThan(0.3);
    expect(weights.wRest).toBe(0);
    // The gain must clear the threshold by construction of the test data.
    expect(cv.form).toBeLessThan(cv.none - MIN_CV_GAIN);
  });

  it('ships all-zero when no feature carries signal', () => {
    const { weights } = selectStack(syntheticRecords(false));
    expect(weights).toEqual({ wForm: 0, wRest: 0 });
  });

  it('ships all-zero when cross-validation is impossible (single season)', () => {
    // Even a PERFECTLY informative feature may not ship without held-out
    // evidence — in-sample fit is not evidence.
    const oneSeason = syntheticRecords(true).map((r) => ({ ...r, season: '2015-2016' }));
    const { weights, cv } = selectStack(oneSeason);
    expect(weights).toEqual({ wForm: 0, wRest: 0 });
    expect(cv.form).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('fitCalibration', () => {
  it('ships the identity when forecasts are already calibrated', () => {
    // Outcomes drawn to match the stated probabilities as closely as a
    // deterministic pattern allows: 40% H, 27% D, 33% A ≈ 12H/8D/10A per 30.
    const records: DcRecord[] = [];
    const pattern: Outcome[] = [
      ...Array(12).fill('H'), ...Array(8).fill('D'), ...Array(10).fill('A'),
    ];
    for (let i = 0; i < 300; i++) {
      records.push({
        dc: { home: 0.4, draw: 0.267, away: 0.333 },
        features: { formResidual: 0, restDiff: 0 },
        outcome: pattern[i % 30],
        season: '2015-2016',
      });
    }
    const cal = fitCalibration(records, { wForm: 0, wRest: 0 });
    expect(cal).toEqual({ T: 1, cD: 0 });
  });

  it('raises the draw intercept when draws are systematically under-forecast', () => {
    // Forecasts say 15% draws; reality delivers ~40%.
    const records: DcRecord[] = [];
    const pattern: Outcome[] = ['H', 'D', 'A', 'D', 'H', 'D', 'A', 'D', 'H', 'D'];
    for (let i = 0; i < 300; i++) {
      records.push({
        dc: { home: 0.45, draw: 0.15, away: 0.4 },
        features: { formResidual: 0, restDiff: 0 },
        outcome: pattern[i % pattern.length],
        season: '2015-2016',
      });
    }
    const cal = fitCalibration(records, { wForm: 0, wRest: 0 });
    expect(cal.cD).toBeGreaterThan(0.1);
  });
});
