/**
 * Residual features for the Butler stack — the small, honest signals layered
 * on top of the Dixon-Coles core. Each is constructed to be orthogonal to
 * team strength BY CONSTRUCTION (residuals against the model's own
 * expectation), so the stack can only add information the core doesn't have.
 *
 * Pure functions over an EngineMatch history; time is always data time.
 */

import { lambdasFor } from './dixonColes';
import type { DCParams, EngineMatch, StackFeatures, TeamRating } from './types';

/** Matches considered for the form residual. */
const FORM_WINDOW = 5;
/** Per-match residual clip — one 7-0 shouldn't own the signal. */
const RESIDUAL_CLIP = 1.5;
/** Rest-day defaults and clips. */
const DEFAULT_REST_DAYS = 7;
const REST_DIFF_CLIP = 3;

const MS_PER_DAY = 86_400_000;

/**
 * Mean goal-difference residual vs the model's expectation over the team's
 * last FORM_WINDOW completed matches strictly before `beforeDate`.
 *
 * Positive = the team has recently outperformed what its fitted strength
 * predicts (a hot streak the decayed ratings haven't fully absorbed);
 * negative = a cold streak. Zero when no history exists.
 */
export function formResidual(
  history: EngineMatch[],
  team: string,
  params: DCParams,
  fallback: TeamRating,
  beforeDate: string
): number {
  const cutoff = Date.parse(beforeDate);
  const recent = history
    .filter(
      (m) => (m.home === team || m.away === team) && Date.parse(m.date) < cutoff
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, FORM_WINDOW);

  if (recent.length === 0) return 0;

  let sum = 0;
  for (const m of recent) {
    const { home, away } = lambdasFor(params, m.home, m.away, fallback);
    const expectedGD = home - away;
    const actualGD = m.homeGoals - m.awayGoals;
    const residual = m.home === team ? actualGD - expectedGD : expectedGD - actualGD;
    sum += Math.max(-RESIDUAL_CLIP, Math.min(RESIDUAL_CLIP, residual));
  }
  return sum / recent.length;
}

/** Days since the team's most recent match before `date` (capped at 14 so a
 *  summer break doesn't read as super-human freshness). */
export function restDays(history: EngineMatch[], team: string, date: string): number {
  const cutoff = Date.parse(date);
  let latest = -Infinity;
  for (const m of history) {
    if (m.home !== team && m.away !== team) continue;
    const t = Date.parse(m.date);
    if (t < cutoff && t > latest) latest = t;
  }
  if (!Number.isFinite(latest)) return DEFAULT_REST_DAYS;
  return Math.min(14, (cutoff - latest) / MS_PER_DAY);
}

/** The full stack feature vector for a fixture. */
export function stackFeatures(
  history: EngineMatch[],
  params: DCParams,
  fallback: TeamRating,
  home: string,
  away: string,
  kickoff: string
): StackFeatures {
  const homeForm = formResidual(history, home, params, fallback, kickoff);
  const awayForm = formResidual(history, away, params, fallback, kickoff);
  const rest = restDays(history, home, kickoff) - restDays(history, away, kickoff);
  return {
    formResidual: homeForm - awayForm,
    restDiff: Math.max(-REST_DIFF_CLIP, Math.min(REST_DIFF_CLIP, rest)),
  };
}
