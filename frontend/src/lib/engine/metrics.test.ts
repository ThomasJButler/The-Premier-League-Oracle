import { describe, it, expect } from 'vitest';
import {
  rps,
  brier,
  logLoss,
  argmaxOutcome,
  normalizeTriple,
  summarize,
  calibrationCurve,
  ece,
  type ProbTriple,
  type ScoredRecord,
} from './metrics';

const p = (home: number, draw: number, away: number): ProbTriple => ({ home, draw, away });
const rec = (
  triple: ProbTriple,
  outcome: 'H' | 'D' | 'A',
  matchId = 'm',
  season = '2023-2024'
): ScoredRecord => ({ p: triple, outcome, season, matchId });

describe('rps', () => {
  // RPS = ½[(P_H − O_H)² + ((P_H+P_D) − (O_H+O_D))²] — every value below is
  // worked by hand from that formula.
  it('scores a confident correct home forecast well', () => {
    // (0.6,0.3,0.1) vs H: ½[(0.6−1)² + (0.9−1)²] = ½[0.16 + 0.01] = 0.085
    expect(rps(p(0.6, 0.3, 0.1), 'H')).toBeCloseTo(0.085, 10);
  });

  it('punishes the same forecast progressively more for draw, then away', () => {
    // vs D: ½[(0.6)² + (0.9−1)²] = ½[0.36 + 0.01] = 0.185
    expect(rps(p(0.6, 0.3, 0.1), 'D')).toBeCloseTo(0.185, 10);
    // vs A: ½[(0.6)² + (0.9)²] = ½[0.36 + 0.81] = 0.585
    expect(rps(p(0.6, 0.3, 0.1), 'A')).toBeCloseTo(0.585, 10);
  });

  it('is ordinal-aware: a home forecast is less wrong about a draw than an away win', () => {
    expect(rps(p(0.6, 0.3, 0.1), 'D')).toBeLessThan(rps(p(0.6, 0.3, 0.1), 'A'));
  });

  it('scores the uniform forecast at the known anchors', () => {
    // uniform vs H: ½[(⅓−1)² + (⅔−1)²] = ½[4/9 + 1/9] = 5/18
    expect(rps(p(1 / 3, 1 / 3, 1 / 3), 'H')).toBeCloseTo(5 / 18, 10);
    // uniform vs D: ½[(⅓)² + (⅔−1)²] = ½[1/9 + 1/9] = 1/9 — the middle
    // outcome is "closer" to a uniform CDF, hence the lower score.
    expect(rps(p(1 / 3, 1 / 3, 1 / 3), 'D')).toBeCloseTo(1 / 9, 10);
  });

  it('gives a perfect forecast zero', () => {
    expect(rps(p(1, 0, 0), 'H')).toBe(0);
    expect(rps(p(0, 0, 1), 'A')).toBe(0);
  });
});

describe('brier', () => {
  it('matches the hand-computed 3-class sum of squares', () => {
    // (0.6,0.3,0.1) vs H: 0.4² + 0.3² + 0.1² = 0.16 + 0.09 + 0.01 = 0.26
    expect(brier(p(0.6, 0.3, 0.1), 'H')).toBeCloseTo(0.26, 10);
  });

  it('scores uniform at 2/3 regardless of outcome (no ordinal awareness)', () => {
    // (⅔)² + (⅓)² + (⅓)² = 4/9 + 1/9 + 1/9 = 2/3
    expect(brier(p(1 / 3, 1 / 3, 1 / 3), 'H')).toBeCloseTo(2 / 3, 10);
    expect(brier(p(1 / 3, 1 / 3, 1 / 3), 'D')).toBeCloseTo(2 / 3, 10);
    expect(brier(p(1 / 3, 1 / 3, 1 / 3), 'A')).toBeCloseTo(2 / 3, 10);
  });

  it('spans [0, 2]: perfect forecast 0, maximally wrong certain forecast 2', () => {
    expect(brier(p(1, 0, 0), 'H')).toBe(0);
    expect(brier(p(1, 0, 0), 'A')).toBe(2);
  });
});

describe('logLoss', () => {
  it('equals −ln of the realised outcome probability', () => {
    expect(logLoss(p(0.6, 0.3, 0.1), 'H')).toBeCloseTo(-Math.log(0.6), 10);
    expect(logLoss(p(0.6, 0.3, 0.1), 'A')).toBeCloseTo(-Math.log(0.1), 10);
  });

  it('floors zero probabilities instead of returning Infinity', () => {
    const loss = logLoss(p(1, 0, 0), 'A');
    expect(Number.isFinite(loss)).toBe(true);
    expect(loss).toBeCloseTo(-Math.log(1e-15), 6);
  });
});

describe('argmaxOutcome', () => {
  it('picks the modal outcome', () => {
    expect(argmaxOutcome(p(0.5, 0.3, 0.2))).toBe('H');
    expect(argmaxOutcome(p(0.2, 0.5, 0.3))).toBe('D');
    expect(argmaxOutcome(p(0.2, 0.3, 0.5))).toBe('A');
  });

  it('breaks ties deterministically H > D > A', () => {
    expect(argmaxOutcome(p(0.4, 0.4, 0.2))).toBe('H');
    expect(argmaxOutcome(p(0.2, 0.4, 0.4))).toBe('D');
    expect(argmaxOutcome(p(1 / 3, 1 / 3, 1 / 3))).toBe('H');
  });
});

describe('normalizeTriple', () => {
  it('rescales to sum 1', () => {
    expect(normalizeTriple(p(2, 1, 1))).toEqual(p(0.5, 0.25, 0.25));
  });

  it('falls back to uniform on degenerate input', () => {
    expect(normalizeTriple(p(0, 0, 0))).toEqual(p(1 / 3, 1 / 3, 1 / 3));
    expect(normalizeTriple(p(NaN, 0.5, 0.5))).toEqual(p(1 / 3, 1 / 3, 1 / 3));
  });
});

describe('summarize', () => {
  const records: ScoredRecord[] = [
    rec(p(0.6, 0.3, 0.1), 'H', 'm1'), // pick H — correct
    rec(p(0.2, 0.5, 0.3), 'D', 'm2'), // pick D — correct
    rec(p(0.5, 0.3, 0.2), 'A', 'm3'), // pick H — wrong
    rec(p(0.1, 0.3, 0.6), 'H', 'm4'), // pick A — wrong
  ];

  it('computes headline means from hand-worked per-record scores', () => {
    const s = summarize(records);
    expect(s.n).toBe(4);
    expect(s.accuracy).toBe(0.5);
    // Per-record RPS: 0.085 (m1), ½[0.2² + (0.7−1)²]=0.065 (m2),
    // ½[0.5² + 0.8²]=0.445 (m3), ½[0.9² + (0.4−1)²]=0.585 (m4).
    // Mean = 1.18 / 4 = 0.295.
    expect(s.rps).toBeCloseTo(0.295, 10);
  });

  it('tracks per-outcome precision and recall', () => {
    const s = summarize(records);
    // H: occurred twice (m1, m4), predicted twice (m1, m3), correct once.
    expect(s.outcomes.H).toMatchObject({ actual: 2, predicted: 2, correct: 1, precision: 0.5, recall: 0.5 });
    // D: occurred once, predicted once, correct once.
    expect(s.outcomes.D).toMatchObject({ actual: 1, predicted: 1, correct: 1, precision: 1, recall: 1 });
    // A: occurred once (m3), predicted once (m4), never correct.
    expect(s.outcomes.A).toMatchObject({ actual: 1, predicted: 1, correct: 0, precision: 0, recall: 0 });
    expect(s.drawPredictedRate).toBe(0.25);
  });

  it('returns a zeroed summary for no records', () => {
    const s = summarize([]);
    expect(s.n).toBe(0);
    expect(s.rps).toBe(0);
    expect(s.accuracy).toBe(0);
  });
});

describe('calibrationCurve / ece', () => {
  // Four forecasts, all at 60% confidence in the pick, only half correct:
  // a model that is overconfident by exactly 10 points.
  const overconfident: ScoredRecord[] = [
    rec(p(0.6, 0.2, 0.2), 'H', 'm1'),
    rec(p(0.6, 0.2, 0.2), 'H', 'm2'),
    rec(p(0.6, 0.2, 0.2), 'D', 'm3'),
    rec(p(0.6, 0.2, 0.2), 'A', 'm4'),
  ];

  it('bins max-prob confidence against hit rate', () => {
    const curve = calibrationCurve(overconfident, 'maxProb');
    expect(curve).toHaveLength(1);
    expect(curve[0]).toMatchObject({ lo: 0.6, hi: 0.7, n: 4 });
    expect(curve[0].meanForecast).toBeCloseTo(0.6, 10);
    expect(curve[0].observedRate).toBeCloseTo(0.5, 10);
  });

  it('ECE equals the confidence-accuracy gap for a single-bin population', () => {
    expect(ece(overconfident)).toBeCloseTo(0.1, 10);
  });

  it('per-outcome mode bins the outcome probability against its frequency', () => {
    // p.draw = 0.2 for all four records; one of four was a draw.
    const curve = calibrationCurve(overconfident, 'D');
    expect(curve).toHaveLength(1);
    expect(curve[0]).toMatchObject({ lo: 0.2, hi: 0.3, n: 4 });
    expect(curve[0].observedRate).toBeCloseTo(0.25, 10);
  });

  it('lands p = 1.0 in the top bin instead of off the end', () => {
    const curve = calibrationCurve([rec(p(1, 0, 0), 'H')], 'maxProb');
    expect(curve).toHaveLength(1);
    expect(curve[0].lo).toBeCloseTo(0.9, 10);
  });

  it('returns 0 ECE for no records', () => {
    expect(ece([])).toBe(0);
  });
});
