import { describe, it, expect } from 'vitest';
import {
  poissonPmf,
  dcTau,
  buildGrid,
  gridToTriple,
  rescaleGridToTriple,
  topScorelines,
} from './poisson';

describe('poissonPmf', () => {
  it('matches hand-computed values', () => {
    // P(X=0; λ=1.5) = e^−1.5 ≈ 0.223130
    expect(poissonPmf(1.5, 0)).toBeCloseTo(Math.exp(-1.5), 12);
    // P(X=2; λ=1.5) = 1.5²·e^−1.5/2 = 1.125·e^−1.5 ≈ 0.251021
    expect(poissonPmf(1.5, 2)).toBeCloseTo(1.125 * Math.exp(-1.5), 12);
  });

  it('handles the degenerate λ ≤ 0 edge', () => {
    expect(poissonPmf(0, 0)).toBe(1);
    expect(poissonPmf(0, 3)).toBe(0);
  });
});

describe('dcTau', () => {
  // ρ = −0.1, λ = 1.5, μ = 1.2 — worked by hand from the 1997 definitions.
  it('matches the four low-score corrections', () => {
    expect(dcTau(0, 0, 1.5, 1.2, -0.1)).toBeCloseTo(1 + 0.18, 12); // 1 − λμρ
    expect(dcTau(1, 0, 1.5, 1.2, -0.1)).toBeCloseTo(1 - 0.12, 12); // 1 + μρ
    expect(dcTau(0, 1, 1.5, 1.2, -0.1)).toBeCloseTo(1 - 0.15, 12); // 1 + λρ
    expect(dcTau(1, 1, 1.5, 1.2, -0.1)).toBeCloseTo(1.1, 12);      // 1 − ρ
  });

  it('is identity outside the 2×2 block', () => {
    expect(dcTau(2, 1, 1.5, 1.2, -0.1)).toBe(1);
    expect(dcTau(0, 2, 1.5, 1.2, -0.1)).toBe(1);
  });
});

describe('buildGrid', () => {
  it('sums to exactly 1 after τ correction and renormalisation', () => {
    const grid = buildGrid(1.6, 1.1, -0.08);
    const total = Object.values(grid).reduce((s, p) => s + p, 0);
    expect(total).toBeCloseTo(1, 12);
    expect(Object.keys(grid)).toHaveLength(11 * 11);
  });

  it('negative ρ shifts mass into 0-0 and 1-1 relative to the independent model', () => {
    const independent = buildGrid(1.4, 1.1, 0);
    const corrected = buildGrid(1.4, 1.1, -0.1);
    expect(corrected['0-0']).toBeGreaterThan(independent['0-0']);
    expect(corrected['1-1']).toBeGreaterThan(independent['1-1']);
    expect(corrected['1-0']).toBeLessThan(independent['1-0']);
    expect(corrected['0-1']).toBeLessThan(independent['0-1']);
  });

  it('never emits negative cells even at pathological ρλμ', () => {
    const grid = buildGrid(4, 4, 0.05);
    for (const p of Object.values(grid)) expect(p).toBeGreaterThanOrEqual(0);
  });
});

describe('gridToTriple', () => {
  it('partitions the full mass into H/D/A', () => {
    const t = gridToTriple(buildGrid(1.6, 1.1, -0.08));
    expect(t.home + t.draw + t.away).toBeCloseTo(1, 12);
    // λ_home > λ_away → home favoured.
    expect(t.home).toBeGreaterThan(t.away);
    // PL-shaped draw mass.
    expect(t.draw).toBeGreaterThan(0.15);
    expect(t.draw).toBeLessThan(0.4);
  });
});

describe('rescaleGridToTriple — the coherence transform', () => {
  const grid = buildGrid(1.6, 1.1, -0.08);
  const target = { home: 0.5, draw: 0.28, away: 0.22 };
  const rescaled = rescaleGridToTriple(grid, target);

  it('makes the grid marginals equal the target triple exactly', () => {
    const t = gridToTriple(rescaled);
    expect(t.home).toBeCloseTo(target.home, 12);
    expect(t.draw).toBeCloseTo(target.draw, 12);
    expect(t.away).toBeCloseTo(target.away, 12);
  });

  it('preserves relative probabilities within each outcome class', () => {
    // Scoreline shape inside "home win" is untouched — only its total mass moved.
    expect(rescaled['2-0'] / rescaled['1-0']).toBeCloseTo(grid['2-0'] / grid['1-0'], 12);
    expect(rescaled['2-2'] / rescaled['1-1']).toBeCloseTo(grid['2-2'] / grid['1-1'], 12);
  });
});

describe('topScorelines', () => {
  it('returns the N most likely cells in descending order', () => {
    const top = topScorelines(buildGrid(1.6, 1.1, -0.08), 5);
    expect(top).toHaveLength(5);
    for (let k = 1; k < top.length; k++) {
      expect(top[k].probability).toBeLessThanOrEqual(top[k - 1].probability);
    }
  });

  it('breaks exact ties deterministically by score key', () => {
    // Symmetric λs produce exactly tied mirror cells (e.g. 1-0 vs 0-1 at ρ=0).
    const top = topScorelines(buildGrid(1.3, 1.3, 0), 121);
    const p10 = top.findIndex((s) => s.score === '1-0');
    const p01 = top.findIndex((s) => s.score === '0-1');
    expect(p01).toBeLessThan(p10); // '0-1' < '1-0' lexicographically
  });
});
