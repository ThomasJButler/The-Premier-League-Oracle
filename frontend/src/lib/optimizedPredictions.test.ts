import { describe, it, expect } from 'vitest';
import { OptimizedPredictor, type EnhancedPredictionModel } from './optimizedPredictions';
import { ButlerPredictor } from './butlerFacade';
import { gridToTriple } from './engine/poisson';
import type { Match } from '../types';

/**
 * Contract spec for the legacy import path. The deep behavioural coverage
 * lives with the implementation (butlerFacade.test.ts + lib/engine tests);
 * this file pins what CONSUMERS of this module rely on — including the
 * scoreline/outcome coherence regressions the old engine needed three
 * dedicated tests to patch, which the Butler model satisfies by construction.
 */

function mk(id: string, date: string, home: string, away: string, hg: number, ag: number): Match {
  return {
    id, season_id: 's1', date,
    home_team: home, away_team: away,
    home_goals: hg, away_goals: ag,
    result: hg > ag ? 'H' : hg === ag ? 'D' : 'A',
    home_odds: null, draw_odds: null, away_odds: null,
    first_half_home_goals: null, first_half_away_goals: null,
    full_time_result: hg > ag ? 'H' : hg === ag ? 'D' : 'A',
    half_time_result: null, referee: null,
    home_shots: null, away_shots: null, home_shots_target: null, away_shots_target: null,
    home_fouls: null, away_fouls: null, home_corners: null, away_corners: null,
    home_yellows: null, away_yellows: null, home_reds: null, away_reds: null,
    created_at: date, status: 'FINISHED',
  };
}

// Burnley-vs-City-shaped history: City demolish everyone, Burnley lose a lot.
const HISTORY: Match[] = [
  mk('m1', '2026-04-04T15:00:00Z', 'Manchester City FC', 'Everton FC', 4, 0),
  mk('m2', '2026-04-11T15:00:00Z', 'Burnley FC', 'Manchester City FC', 0, 3),
  mk('m3', '2026-04-18T15:00:00Z', 'Manchester City FC', 'Burnley FC', 5, 1),
  mk('m4', '2026-04-25T15:00:00Z', 'Everton FC', 'Burnley FC', 2, 0),
  mk('m5', '2026-05-02T15:00:00Z', 'Everton FC', 'Manchester City FC', 0, 2),
];
const KICKOFF = '2026-05-09T15:00:00Z';

describe('OptimizedPredictor (legacy path) — the Butler model behind the old name', () => {
  it('is the Butler predictor, not a divergent copy', () => {
    expect(OptimizedPredictor.predictMatch).toBe(ButlerPredictor.predictMatch);
  });

  it('returns every field consumers rely on', async () => {
    const p: EnhancedPredictionModel = await OptimizedPredictor.predictMatch(
      'Manchester City FC', 'Burnley FC', HISTORY, null, KICKOFF
    );
    expect(['H', 'D', 'A']).toContain(p.predictedResult);
    expect(p.probabilities.home + p.probabilities.draw + p.probabilities.away).toBeCloseTo(1, 10);
    expect(p.confidence).toBeGreaterThan(0);
    expect(typeof p.homeForm).toBe('string');
    expect(p.modelWeights.poisson).toBe(1);
    expect(p.modelOutputs.calibrated).toEqual(p.probabilities);
    expect(Array.isArray(p.insights)).toBe(true);
  });

  // The regression the old engine guarded with three dedicated tests
  // (Burnley-vs-City scoreline coherence): the displayed scoreline must never
  // contradict the predicted outcome, and the grid must agree with the
  // probability bars. Butler makes both structural.
  it('never shows a home scoreline when it predicts an away win (and vice versa)', async () => {
    const cityAway = await OptimizedPredictor.predictMatch(
      'Burnley FC', 'Manchester City FC', HISTORY, null, KICKOFF
    );
    if (cityAway.predictedResult === 'A') {
      expect(cityAway.predictedAwayGoals).toBeGreaterThan(cityAway.predictedHomeGoals);
    }
    const gridTriple = gridToTriple(cityAway.scoreProbabilities);
    expect(gridTriple.home).toBeCloseTo(cityAway.probabilities.home, 10);
    // Strong side away: the pick should reflect it.
    expect(cityAway.probabilities.away).toBeGreaterThan(cityAway.probabilities.home);
  });

  it('suppresses the H2H dominance insight below 3 completed meetings', async () => {
    // One completed meeting only — no "dominates H2H (1W in last 1)" nonsense.
    const oneMeeting = [mk('x1', '2026-04-04T15:00:00Z', 'Fulham FC', 'Brentford FC', 2, 0)];
    const p = await OptimizedPredictor.predictMatch('Fulham FC', 'Brentford FC', oneMeeting, null, KICKOFF);
    expect(p.insights.join(' ')).not.toMatch(/dominates H2H/);
  });

  it('falls back to a valid shape when everything is missing', async () => {
    const p = await OptimizedPredictor.predictMatch('Unknown A', 'Unknown B', [], null, KICKOFF);
    expect(p.probabilities.home + p.probabilities.draw + p.probabilities.away).toBeCloseTo(1, 10);
    expect(p.predictedResult).toMatch(/^[HDA]$/);
  });
});
