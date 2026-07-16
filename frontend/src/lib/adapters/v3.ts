import type { Match } from '../../types';
import type { StoredPrediction } from '../../services/predictionTracker';
import type { EnhancedPredictionModel, ModelOutputs } from '../optimizedPredictions';
import type {
  Fixture,
  FixtureStatus,
  MatchPrediction,
  ModelBreakdown,
  TeamSummary,
} from '../../types/redesign';

/**
 * Adapters that map the legacy internal `Match` and `StoredPrediction`
 * shapes (used by `dataService` + `predictionTracker`) into the v3
 * broadcast-redesign `Fixture` / `MatchPrediction` shapes that
 * `MatchCard` and `MatchRow` consume.
 *
 * Reused by Today (P2a/P2b/P2c), `MatchList.svelte`, and the per-hub
 * screens in Phase 3.
 */

const STATUS_PASSTHROUGH: ReadonlySet<FixtureStatus> = new Set([
  'SCHEDULED', 'LIVE', 'PAUSED', 'FINISHED', 'POSTPONED', 'CANCELLED',
]);

function toAbbr(name: string): string {
  return name.replace(/\b(?:FC|AFC)\b/g, '').trim().slice(0, 3).toUpperCase();
}

function teamFrom(name: string, formLast5?: ('W' | 'D' | 'L')[]): TeamSummary {
  return formLast5 && formLast5.length > 0
    ? { abbr: toAbbr(name), name, formLast5 }
    : { abbr: toAbbr(name), name };
}

/**
 * Walk `matches` for the team's most recent 5 completed results strictly
 * before `beforeDate`, returning newest-first ('W' | 'D' | 'L'). Used to
 * populate `Fixture.home.formLast5` for the match-detail hero.
 *
 * Returns `[]` when no completed prior matches are found, in which case
 * callers should omit `formLast5` rather than render an empty chip row.
 */
export function deriveFormLast5(
  matches: Match[],
  teamName: string,
  beforeDate: string,
): ('W' | 'D' | 'L')[] {
  const cutoff = new Date(beforeDate).getTime();
  if (!Number.isFinite(cutoff)) return [];

  return matches
    .filter((m) => {
      if (m.home_team !== teamName && m.away_team !== teamName) return false;
      if (m.result === null) return false;
      const t = new Date(m.date).getTime();
      return Number.isFinite(t) && t < cutoff;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map((m) => {
      const isHome = m.home_team === teamName;
      if (m.result === 'D') return 'D' as const;
      if ((isHome && m.result === 'H') || (!isHome && m.result === 'A')) return 'W' as const;
      return 'L' as const;
    });
}

function deriveStatus(m: Match): FixtureStatus {
  if (m.status && STATUS_PASSTHROUGH.has(m.status as FixtureStatus)) {
    return m.status as FixtureStatus;
  }
  // Football-Data live statuses are coarser; coerce to the v3 alphabet.
  if (m.status === 'IN_PLAY' || m.status === 'EXTRA_TIME' || m.status === 'PENALTY_SHOOTOUT') {
    return 'LIVE';
  }
  // No explicit status: a non-null `result` means the match has been played.
  return m.result ? 'FINISHED' : 'SCHEDULED';
}

export function matchToFixture(m: Match, history?: Match[]): Fixture {
  const score =
    typeof m.home_goals === 'number' && typeof m.away_goals === 'number'
      ? { home: m.home_goals, away: m.away_goals }
      : undefined;

  const homeForm = history ? deriveFormLast5(history, m.home_team, m.date) : undefined;
  const awayForm = history ? deriveFormLast5(history, m.away_team, m.date) : undefined;

  return {
    id: m.id,
    competition: 'Premier League',
    gameweek: m.matchday ?? 0,
    utcDate: m.date,
    status: deriveStatus(m),
    home: teamFrom(m.home_team, homeForm),
    away: teamFrom(m.away_team, awayForm),
    score,
  };
}

const PICK_MAP: Record<StoredPrediction['predictedResult'], MatchPrediction['pick']> = {
  H: 'HOME', A: 'AWAY', D: 'DRAW',
};

export function storedPredictionToFixture(p: StoredPrediction): Fixture {
  const settled =
    p.actualResult !== undefined &&
    typeof p.actualHomeGoals === 'number' &&
    typeof p.actualAwayGoals === 'number';

  return {
    id: p.matchId,
    competition: 'Premier League',
    gameweek: p.matchday ?? 0,
    utcDate: p.matchDate,
    status: settled ? 'FINISHED' : 'SCHEDULED',
    home: teamFrom(p.homeTeam),
    away: teamFrom(p.awayTeam),
    score: settled
      ? { home: p.actualHomeGoals as number, away: p.actualAwayGoals as number }
      : undefined,
  };
}

const PICK_FROM_RESULT: Record<'H' | 'D' | 'A', MatchPrediction['pick']> = {
  H: 'HOME', D: 'DRAW', A: 'AWAY',
};

/** The Butler decomposition rows, in narrative order: season-long class,
 *  current form, and the published (calibrated) view. */
const LEAN_NAMES: ReadonlyArray<{ key: keyof ModelOutputs; label: ModelBreakdown['name'] }> = [
  { key: 'class', label: 'CLASS' },
  { key: 'form', label: 'FORM' },
  { key: 'calibrated', label: 'MODEL' },
];

function deriveLean(
  label: ModelBreakdown['name'],
  probs: { home: number; draw: number; away: number }
): ModelBreakdown {
  const { home, draw, away } = probs;
  if (home >= draw && home >= away) return { name: label, lean: 'H', confidence: home };
  if (away >= draw && away >= home) return { name: label, lean: 'A', confidence: away };
  return { name: label, lean: 'D', confidence: draw };
}

/**
 * Map the Butler engine's `EnhancedPredictionModel` into the v3 redesign
 * `MatchPrediction` shape consumed by `EnsembleBars`, `ScorelineBars`, and
 * the match-detail hero footer. Returns `undefined` when the input lacks
 * the `modelOutputs` decomposition the bars depend on.
 */
export function enhancedPredictionToV3(p: EnhancedPredictionModel): MatchPrediction | undefined {
  if (!p.modelOutputs) return undefined;

  const models: ModelBreakdown[] = LEAN_NAMES.map(({ key, label }) =>
    deriveLean(label, p.modelOutputs[key])
  );

  // The XGBoost row only appears when the ML backend contributed to the
  // log-odds blend.
  if (typeof p.modelWeights.ml === 'number' && p.modelWeights.ml > 0) {
    models.push({
      name: 'XGBOOST',
      lean: p.predictedResult,
      confidence: p.confidence,
    });
  }

  const topScorelines = (p.topScorelines ?? [])
    .map(({ score, probability }) => {
      const [home, away] = score.split('-').map(Number);
      return { home, away, prob: probability };
    })
    .filter(({ home, away }) => Number.isFinite(home) && Number.isFinite(away));

  return {
    // The engine's own final triple, verbatim — the exact distribution that
    // determined `predictedResult`. Never re-derive it here: an earlier
    // version reconstructed a weighted blend from `modelOutputs`, which
    // silently omitted the ML term, the referee shift, and the form
    // orthogonalisation, so the bars disagreed with the pick they framed.
    ensemble: { ...p.probabilities },
    models,
    topScorelines,
    // Real expected goals — the fitted scoring rates, not the integer
    // scoreline echo the old adapter faked this slot with.
    xg: { ...p.expectedGoals },
    elo: { home: 0, away: 0 },
    pick: PICK_FROM_RESULT[p.predictedResult],
    pickConfidence: p.confidence,
    divergenceFlag: p.divergenceFlag,
    keyFactors: p.insights,
  };
}

export function predictionToV3(p: StoredPrediction): MatchPrediction | undefined {
  if (!p.poissonProbs) return undefined;
  return {
    ensemble: {
      home: p.poissonProbs.homeWin,
      draw: p.poissonProbs.draw,
      away: p.poissonProbs.awayWin,
    },
    models: [],
    topScorelines: [
      { home: p.predictedHomeGoals, away: p.predictedAwayGoals, prob: p.confidence },
    ],
    xg: { home: 0, away: 0 },
    elo: { home: 0, away: 0 },
    pick: PICK_MAP[p.predictedResult],
    pickConfidence: p.confidence,
    keyFactors: p.keyFactors,
  };
}
