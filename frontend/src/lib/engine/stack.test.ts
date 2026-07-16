import { describe, it, expect } from 'vitest';
import { applyStack, blendLogOdds, applyCalibration, normalizedEntropy } from './stack';
import { formResidual, restDays, stackFeatures } from './features';
import type { DCParams, EngineMatch } from './types';

const TRIPLE = { home: 0.5, draw: 0.28, away: 0.22 };

describe('applyStack', () => {
  it('is the identity at zero weights', () => {
    expect(applyStack(TRIPLE, { formResidual: 1, restDiff: 2 }, { wForm: 0, wRest: 0 }))
      .toEqual(TRIPLE);
  });

  it('shifts home up and away down symmetrically for a positive feature', () => {
    const shifted = applyStack(TRIPLE, { formResidual: 1, restDiff: 0 }, { wForm: 0.2, wRest: 0 });
    expect(shifted.home).toBeGreaterThan(TRIPLE.home);
    expect(shifted.away).toBeLessThan(TRIPLE.away);
    expect(shifted.home + shifted.draw + shifted.away).toBeCloseTo(1, 12);
  });

  it('mirror features produce mirror triples (no home/away asymmetry leaks in)', () => {
    const up = applyStack(TRIPLE, { formResidual: 0.8, restDiff: 1 }, { wForm: 0.2, wRest: 0.05 });
    const down = applyStack(TRIPLE, { formResidual: -0.8, restDiff: -1 }, { wForm: 0.2, wRest: 0.05 });
    // The log-odds shifts are equal and opposite around the same base triple.
    const upShift = Math.log(up.home / up.draw) - Math.log(TRIPLE.home / TRIPLE.draw);
    const downShift = Math.log(down.home / down.draw) - Math.log(TRIPLE.home / TRIPLE.draw);
    expect(upShift).toBeCloseTo(-downShift, 10);
  });
});

describe('blendLogOdds', () => {
  const ml = { home: 0.3, draw: 0.3, away: 0.4 };

  it('is the identity at w = 0 and the external model at w = 1', () => {
    expect(blendLogOdds(TRIPLE, ml, 0)).toEqual(TRIPLE);
    const full = blendLogOdds(TRIPLE, ml, 1);
    expect(full.home).toBeCloseTo(ml.home, 10);
    expect(full.away).toBeCloseTo(ml.away, 10);
  });

  it('interpolates monotonically between the two views', () => {
    const quarter = blendLogOdds(TRIPLE, ml, 0.25);
    const half = blendLogOdds(TRIPLE, ml, 0.5);
    expect(quarter.home).toBeLessThan(TRIPLE.home);
    expect(quarter.home).toBeGreaterThan(half.home);
    expect(half.away).toBeGreaterThan(TRIPLE.away);
  });

  it('preserves shared sharpness (the anti-dilution property)', () => {
    // Both models strongly favour home; a log-odds blend stays strong.
    // (The old probability-averaging ensemble would keep this too — the
    // difference shows when a flat prior joins the average — but the
    // invariant worth pinning is: blending two 80% forecasts yields 80%.)
    const sharp = { home: 0.8, draw: 0.12, away: 0.08 };
    const blended = blendLogOdds(sharp, { ...sharp }, 0.5);
    expect(blended.home).toBeCloseTo(0.8, 10);
  });
});

describe('applyCalibration', () => {
  it('is the identity at T = 1, cD = 0', () => {
    expect(applyCalibration(TRIPLE, { T: 1, cD: 0 })).toEqual(TRIPLE);
  });

  it('T > 1 softens the forecast toward uniform', () => {
    const soft = applyCalibration({ home: 0.7, draw: 0.2, away: 0.1 }, { T: 1.5, cD: 0 });
    expect(soft.home).toBeLessThan(0.7);
    expect(soft.away).toBeGreaterThan(0.1);
    expect(soft.home + soft.draw + soft.away).toBeCloseTo(1, 12);
  });

  it('positive cD raises the draw share specifically', () => {
    const drawier = applyCalibration(TRIPLE, { T: 1, cD: 0.2 });
    expect(drawier.draw).toBeGreaterThan(TRIPLE.draw);
    // Home/away keep their relative ratio.
    expect(drawier.home / drawier.away).toBeCloseTo(TRIPLE.home / TRIPLE.away, 10);
  });
});

describe('normalizedEntropy', () => {
  it('is 1 for the uniform forecast and near 0 for near-certainty', () => {
    expect(normalizedEntropy({ home: 1 / 3, draw: 1 / 3, away: 1 / 3 })).toBeCloseTo(1, 10);
    expect(normalizedEntropy({ home: 0.998, draw: 0.001, away: 0.001 })).toBeLessThan(0.05);
  });
});

describe('features over match history', () => {
  // A minimal fitted world: X slightly strong, Y slightly weak, so the model
  // expects X to beat Y by ~0.46 goals at home.
  const params: DCParams = {
    mu: Math.log(1.3),
    gamma: 0.2,
    rho: -0.05,
    teams: {
      X: { att: 0.1, def: -0.1 },
      Y: { att: -0.1, def: 0.1 },
    },
  };
  const fallback = { att: -0.2, def: 0.15 };

  const history: EngineMatch[] = [
    { date: '2026-04-01T15:00:00Z', home: 'X', away: 'Y', homeGoals: 3, awayGoals: 0 },
    { date: '2026-04-08T15:00:00Z', home: 'Y', away: 'X', homeGoals: 0, awayGoals: 2 },
    { date: '2026-04-15T15:00:00Z', home: 'X', away: 'Y', homeGoals: 4, awayGoals: 1 },
  ];

  it('formResidual is positive for a team outperforming its rating', () => {
    // X won by 3, 2, 3 — far beyond the ~0.5-goal expectation.
    const rx = formResidual(history, 'X', params, fallback, '2026-04-20T00:00:00Z');
    expect(rx).toBeGreaterThan(0.5);
    // And symmetric: Y underperformed by the mirror amount.
    const ry = formResidual(history, 'Y', params, fallback, '2026-04-20T00:00:00Z');
    expect(ry).toBeLessThan(-0.5);
  });

  it('formResidual is 0 with no history and ignores future matches', () => {
    expect(formResidual(history, 'Z', params, fallback, '2026-04-20T00:00:00Z')).toBe(0);
    expect(formResidual(history, 'X', params, fallback, '2026-04-01T00:00:00Z')).toBe(0);
  });

  it('clips single blowouts so one 7-0 cannot own the signal', () => {
    const blowout: EngineMatch[] = [
      { date: '2026-04-01T15:00:00Z', home: 'X', away: 'Y', homeGoals: 7, awayGoals: 0 },
    ];
    const r = formResidual(blowout, 'X', params, fallback, '2026-04-20T00:00:00Z');
    expect(r).toBeLessThanOrEqual(1.5);
  });

  it('restDays measures the gap to the previous match, capped and defaulted', () => {
    expect(restDays(history, 'X', '2026-04-18T15:00:00Z')).toBeCloseTo(3, 5);
    expect(restDays(history, 'Z', '2026-04-18T15:00:00Z')).toBe(7); // no history
    expect(restDays(history, 'X', '2026-06-30T15:00:00Z')).toBe(14); // capped
  });

  it('stackFeatures composes the differential view', () => {
    const f = stackFeatures(history, params, fallback, 'X', 'Y', '2026-04-18T15:00:00Z');
    expect(f.formResidual).toBeGreaterThan(1); // hot X minus cold Y
    expect(Math.abs(f.restDiff)).toBeLessThanOrEqual(3);
  });
});
