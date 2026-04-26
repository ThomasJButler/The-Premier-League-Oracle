import type { Match } from '../../types';
import type { StoredPrediction } from '../../services/predictionTracker';
import type {
  Fixture,
  FixtureStatus,
  MatchPrediction,
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

function teamFrom(name: string): TeamSummary {
  return { abbr: toAbbr(name), name };
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

export function matchToFixture(m: Match): Fixture {
  const score =
    typeof m.home_goals === 'number' && typeof m.away_goals === 'number'
      ? { home: m.home_goals, away: m.away_goals }
      : undefined;

  return {
    id: m.id,
    competition: 'Premier League',
    gameweek: m.matchday ?? 0,
    utcDate: m.date,
    status: deriveStatus(m),
    home: teamFrom(m.home_team),
    away: teamFrom(m.away_team),
    score,
  };
}

const PICK_MAP: Record<StoredPrediction['predictedResult'], MatchPrediction['pick']> = {
  H: 'HOME', A: 'AWAY', D: 'DRAW',
};

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
