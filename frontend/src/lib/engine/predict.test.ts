import { describe, it, expect } from 'vitest';
import { predictFixture, type LiveParams } from './predict';
import { getLiveParams, __clearRuntimeFitCache } from './runtimeFit';
import { gridToTriple } from './poisson';
import { argmaxOutcome } from './metrics';
import type { Coefficients, EngineMatch } from './types';

/** A hand-built fitted world: Alpha strong, Beta average, Gamma weak. */
const COEFFS: Coefficients = {
  version: 1,
  fitAt: '2026-05-01',
  hyper: { xi: Math.LN2 / 390, sigma: 0.35, gridMax: 10 },
  decayed: {
    mu: Math.log(1.3),
    gamma: 0.22,
    rho: -0.06,
    teams: {
      Arsenal: { att: 0.35, def: -0.3 },
      Everton: { att: -0.05, def: 0.0 },
      Luton: { att: -0.25, def: 0.25 },
    },
  },
  flat: {
    mu: Math.log(1.3),
    gamma: 0.22,
    rho: -0.06,
    teams: {
      // The class view disagrees: Everton rated higher long-term.
      Arsenal: { att: 0.1, def: -0.1 },
      Everton: { att: 0.15, def: -0.15 },
      Luton: { att: -0.25, def: 0.25 },
    },
  },
  promotedPrior: { att: -0.2, def: 0.15 },
  stack: { wForm: 0.1, wRest: 0.02, wMl: 0.25 },
  calibration: { T: 1.05, cD: 0.03 },
  backtest: { rps: 0.2, brier: 0.6, logLoss: 1, accuracy: 0.5, ece: 0.02, sampleSize: 2660, seasons: 'x' },
};

const LIVE: LiveParams = { decayed: COEFFS.decayed, flat: COEFFS.flat };

describe('predictFixture', () => {
  const base = { home: 'Arsenal', away: 'Luton', kickoff: '2026-05-09T15:00:00Z' };

  it('produces a coherent prediction: triple, grid, and pick agree by construction', () => {
    const p = predictFixture(COEFFS, LIVE, base);

    expect(p.triple.home + p.triple.draw + p.triple.away).toBeCloseTo(1, 10);
    // Grid marginals equal the published triple EXACTLY — the B4 bug is
    // structurally impossible.
    const gridTriple = gridToTriple(p.grid);
    expect(gridTriple.home).toBeCloseTo(p.triple.home, 10);
    expect(gridTriple.draw).toBeCloseTo(p.triple.draw, 10);
    expect(gridTriple.away).toBeCloseTo(p.triple.away, 10);
    // Strong home side vs promoted-quality opposition: home clearly favoured.
    expect(p.triple.home).toBeGreaterThan(0.5);
    expect(argmaxOutcome(p.triple)).toBe('H');
  });

  it('resolves any team-name form to the same prediction', () => {
    const csv = predictFixture(COEFFS, LIVE, base);
    const api = predictFixture(COEFFS, LIVE, { ...base, home: 'Arsenal FC', away: 'Luton Town FC' });
    expect(api.triple).toEqual(csv.triple);
  });

  it('flags promoted-prior usage for unknown clubs and still predicts sanely', () => {
    const p = predictFixture(COEFFS, LIVE, { ...base, away: 'Wrexham FC' });
    expect(p.usedPromotedPrior).toEqual({ home: false, away: true });
    expect(p.triple.home).toBeGreaterThan(p.triple.away);
  });

  it('class and form views can disagree — the divergence signal', () => {
    const p = predictFixture(COEFFS, LIVE, {
      home: 'Arsenal',
      away: 'Everton',
      kickoff: '2026-05-09T15:00:00Z',
    });
    // Decayed ratings favour Arsenal strongly; flat ratings favour Everton.
    expect(argmaxOutcome(p.formTriple)).toBe('H');
    expect(p.classTriple.home).toBeLessThan(p.formTriple.home);
  });

  it('blends an external triple only when provided', () => {
    const solo = predictFixture(COEFFS, LIVE, base);
    const awayLeaningMl = { home: 0.2, draw: 0.25, away: 0.55 };
    const blended = predictFixture(COEFFS, LIVE, { ...base, external: awayLeaningMl });
    expect(blended.triple.home).toBeLessThan(solo.triple.home);
    expect(blended.triple.away).toBeGreaterThan(solo.triple.away);
  });

  it('recent form moves the needle through the stack', () => {
    // Luton on a hot streak: three wins the ratings say shouldn't happen.
    const history: EngineMatch[] = [
      { date: '2026-04-18T15:00:00Z', home: 'Luton', away: 'Everton', homeGoals: 3, awayGoals: 0 },
      { date: '2026-04-25T15:00:00Z', home: 'Everton', away: 'Luton', homeGoals: 0, awayGoals: 2 },
      { date: '2026-05-02T15:00:00Z', home: 'Luton', away: 'Everton', homeGoals: 2, awayGoals: 0 },
    ];
    const cold = predictFixture(COEFFS, LIVE, base);
    const hot = predictFixture(COEFFS, LIVE, { ...base, history });
    expect(hot.triple.away).toBeGreaterThan(cold.triple.away);
  });

  it('entropy reads high for even fixtures, low for mismatches', () => {
    const mismatch = predictFixture(COEFFS, LIVE, base);
    const even = predictFixture(COEFFS, LIVE, {
      home: 'Everton',
      away: 'Everton2 FC', // unknown → promoted prior ≈ evenly-matched-ish
      kickoff: '2026-05-09T15:00:00Z',
    });
    expect(mismatch.entropy).toBeLessThan(even.entropy);
  });
});

describe('getLiveParams', () => {
  const history: EngineMatch[] = [
    // Results NEWER than fitAt: Luton beat Arsenal twice — the refit should
    // move both ratings, anchored to the shipped prior.
    { date: '2026-05-05T15:00:00Z', home: 'Luton', away: 'Arsenal', homeGoals: 2, awayGoals: 0 },
    { date: '2026-05-08T15:00:00Z', home: 'Arsenal', away: 'Luton', homeGoals: 0, awayGoals: 1 },
  ];

  it('returns shipped params verbatim when history is empty or stale', () => {
    __clearRuntimeFitCache();
    expect(getLiveParams(COEFFS, [])).toEqual(LIVE);
    const stale: EngineMatch[] = [
      { date: '2026-04-01T15:00:00Z', home: 'Luton', away: 'Arsenal', homeGoals: 2, awayGoals: 0 },
    ];
    expect(getLiveParams(COEFFS, stale)).toEqual(LIVE);
  });

  it('refits toward fresh results while staying anchored to the shipped prior', () => {
    __clearRuntimeFitCache();
    const live = getLiveParams(COEFFS, history);
    // Two shock results move ratings in the right direction…
    expect(live.decayed.teams['Luton'].att).toBeGreaterThan(COEFFS.decayed.teams['Luton'].att);
    expect(live.decayed.teams['Arsenal'].att).toBeLessThan(COEFFS.decayed.teams['Arsenal'].att);
    // …but the prior keeps two matches from rewriting a 33-season view.
    expect(live.decayed.teams['Arsenal'].att).toBeGreaterThan(0);
    // ρ stays frozen at the shipped value.
    expect(live.decayed.rho).toBe(COEFFS.decayed.rho);
  });

  it('memoises on the history fingerprint', () => {
    __clearRuntimeFitCache();
    const first = getLiveParams(COEFFS, history);
    const second = getLiveParams(COEFFS, history);
    expect(second).toBe(first); // same object — the refit ran once
  });

  it('is deterministic across cache resets', () => {
    __clearRuntimeFitCache();
    const a = getLiveParams(COEFFS, history);
    __clearRuntimeFitCache();
    const b = getLiveParams(COEFFS, history);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
