import { describe, it, expect } from 'vitest';
import { ButlerPredictor } from './butlerFacade';
import { gridToTriple } from './engine/poisson';
import type { Match } from '../types';

/** Minimal completed Match with API-style names. */
function mk(
  id: string,
  date: string,
  home: string,
  away: string,
  hg: number,
  ag: number
): Match {
  return {
    id,
    season_id: 's1',
    date,
    home_team: home,
    away_team: away,
    home_goals: hg,
    away_goals: ag,
    result: hg > ag ? 'H' : hg === ag ? 'D' : 'A',
    home_odds: null,
    draw_odds: null,
    away_odds: null,
    first_half_home_goals: null,
    first_half_away_goals: null,
    full_time_result: hg > ag ? 'H' : hg === ag ? 'D' : 'A',
    half_time_result: null,
    referee: 'M Oliver',
    home_shots: null,
    away_shots: null,
    home_shots_target: null,
    away_shots_target: null,
    home_fouls: null,
    away_fouls: null,
    home_corners: null,
    away_corners: null,
    home_yellows: null,
    away_yellows: null,
    home_reds: null,
    away_reds: null,
    created_at: date,
    status: 'FINISHED',
  };
}

const HISTORY: Match[] = [
  mk('m1', '2026-04-04T15:00:00Z', 'Arsenal FC', 'Everton FC', 3, 0),
  mk('m2', '2026-04-11T15:00:00Z', 'Luton Town FC', 'Arsenal FC', 0, 2),
  mk('m3', '2026-04-18T15:00:00Z', 'Arsenal FC', 'Luton Town FC', 4, 1),
  mk('m4', '2026-04-25T15:00:00Z', 'Everton FC', 'Luton Town FC', 1, 1),
  mk('m5', '2026-05-02T15:00:00Z', 'Everton FC', 'Arsenal FC', 0, 1),
  mk('m6', '2026-05-02T15:00:00Z', 'Luton Town FC', 'Everton FC', 2, 2),
];

const KICKOFF = '2026-05-09T15:00:00Z';

describe('ButlerPredictor.predictMatch — the contract', () => {
  it('returns every field the app consumes, mutually coherent', async () => {
    const p = await ButlerPredictor.predictMatch('Arsenal FC', 'Luton Town FC', HISTORY, null, KICKOFF);

    // The probability triple is normalised and confidence IS its max.
    expect(p.probabilities.home + p.probabilities.draw + p.probabilities.away).toBeCloseTo(1, 10);
    expect(p.confidence).toBeCloseTo(
      Math.max(p.probabilities.home, p.probabilities.draw, p.probabilities.away),
      12
    );

    // Grid coherence: the displayed grid's marginals ARE the published triple.
    const gridTriple = gridToTriple(p.scoreProbabilities);
    expect(gridTriple.home).toBeCloseTo(p.probabilities.home, 10);
    expect(gridTriple.draw).toBeCloseTo(p.probabilities.draw, 10);
    expect(gridTriple.away).toBeCloseTo(p.probabilities.away, 10);

    // The decomposition's published row is literally the probabilities.
    expect(p.modelOutputs.calibrated).toEqual(p.probabilities);

    // Fair odds with no synthetic margin.
    expect(p.valueOdds.home).toBeCloseTo(1 / p.probabilities.home, 10);

    // Scoreline agrees with the pick.
    const { predictedHomeGoals: h, predictedAwayGoals: a } = p;
    if (p.predictedResult === 'H') expect(h).toBeGreaterThan(a);
    if (p.predictedResult === 'A') expect(a).toBeGreaterThan(h);
    if (p.predictedResult === 'D') expect(h).toBe(a);

    // Top scorelines come from the same coherent grid.
    expect(p.topScorelines).toHaveLength(7);
    expect(p.scoreProbabilities[p.topScorelines[0].score]).toBeCloseTo(
      p.topScorelines[0].probability,
      12
    );

    // Real expected goals, not integer scoreline echoes.
    expect(p.expectedGoals.home).toBeGreaterThan(0);
    expect(Number.isInteger(p.expectedGoals.home) && Number.isInteger(p.expectedGoals.away))
      .toBe(false);

    expect(p.modelWeights).toMatchObject({ elo: 0, poisson: 1 });
    expect(Array.isArray(p.insights)).toBe(true);
  });

  it('is deterministic in backtest mode — no wall clock anywhere', async () => {
    const a = await ButlerPredictor.predictMatch('Arsenal FC', 'Luton Town FC', HISTORY, null, KICKOFF);
    const b = await ButlerPredictor.predictMatch('Arsenal FC', 'Luton Town FC', HISTORY, null, KICKOFF);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('form strings read newest-first', async () => {
    const p = await ButlerPredictor.predictMatch('Arsenal FC', 'Luton Town FC', HISTORY, null, KICKOFF);
    // Arsenal newest-first: W(m5), W(m3), W(m2 away), W(m1) → 'WWWW'.
    expect(p.homeForm).toBe('WWWW');
    // Luton newest-first: D(m6), D(m4), L(m3), L(m2) → 'DDLL'.
    expect(p.awayForm).toBe('DDLL');
  });

  it('survives unknown clubs and empty history via the promoted prior', async () => {
    const p = await ButlerPredictor.predictMatch('Wrexham FC', 'Hollywood FC', [], null, KICKOFF);
    expect(p.probabilities.home + p.probabilities.draw + p.probabilities.away).toBeCloseTo(1, 10);
    // Two identical unknown clubs: the only edge is home advantage.
    expect(p.probabilities.home).toBeGreaterThan(p.probabilities.away);
  });

  it('never blends ML in backtest mode', async () => {
    const p = await ButlerPredictor.predictMatch('Arsenal FC', 'Everton FC', HISTORY, null, KICKOFF);
    expect(p.modelWeights.ml).toBeUndefined();
  });

  it('congestion appears as narrative, never as a probability change', async () => {
    // Same fixture, one with a 2-day turnaround for Arsenal.
    const congested = [
      ...HISTORY,
      mk('m7', '2026-05-07T15:00:00Z', 'Arsenal FC', 'Everton FC', 1, 0),
    ];
    const rested = await ButlerPredictor.predictMatch('Arsenal FC', 'Luton Town FC', HISTORY, null, KICKOFF);
    const tired = await ButlerPredictor.predictMatch('Arsenal FC', 'Luton Town FC', congested, null, KICKOFF);
    expect(tired.insights.join(' ')).toMatch(/turnaround/);
    expect(rested.insights.join(' ')).not.toMatch(/turnaround/);
    // The extra match legitimately shifts the fitted rates slightly (more
    // data), but confidence is never multiplied by a fatigue factor — the
    // old engine's 0.57× haircut is gone. Sanity: both are honest maxima.
    expect(tired.confidence).toBeCloseTo(
      Math.max(tired.probabilities.home, tired.probabilities.draw, tired.probabilities.away),
      12
    );
  });
});
