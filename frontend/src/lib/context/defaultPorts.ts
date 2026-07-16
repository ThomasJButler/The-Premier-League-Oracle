// Production adapter implementing KickerContextPorts on top of the salvaged
// v3 prediction stack. Routes/endpoints call buildKickerContext(defaultPorts())
// to inject live model output into pundit prompts.
//
// Adapter responsibilities (kept dependency-injectable so tests don't have to
// boot IndexedDB):
//   • map dataService.getMatches() → FixtureContext[] with ourProb derived from
//     OptimizedPredictor.predictMatch and (when match odds exist) marketImplied
//     + valueEdge populated.
//   • map dataService.getStandings() → StandingsRow[].
//   • reduce predictionTracker.getAccuracyStats + getCalibrationFactors to the
//     compact {brier, calibration, sampleSize} shape KickerContext exposes.

import type { Match, Standing } from '../../types';
import type {
  AccuracyStats,
  FixtureContext,
  KickerContextPorts,
  StandingsRow
} from './types';
import { dataService as defaultDataService } from '../../services/dataService';
import { predictionTracker as defaultTracker } from '../../services/predictionTracker';
import { OptimizedPredictor } from '../optimizedPredictions';
import { calibrationIndex } from '../calibrationIndex';
import { VALUE_ODDS_MARGIN } from '../constants';
import { coefficients as butlerCoefficients, isFitted as butlerFitted } from '../engine';
import type { Coefficients } from '../engine';

interface PredictMatchPort {
  (homeTeam: string, awayTeam: string): Promise<{
    predictedResult: 'H' | 'D' | 'A';
    confidence: number;
    /** The engine's final combined triple — used verbatim when present. */
    probabilities?: { home: number; draw: number; away: number };
    /** Legacy fallback only: inverted when a test port omits probabilities. */
    valueOdds?: { home: number; draw: number; away: number };
  }>;
}

interface DataServicePort {
  getMatches: (opts: { upcoming?: boolean; days?: number }) => Promise<Match[]>;
  getStandings: () => Promise<Standing[]>;
}

interface TrackerPort {
  getAccuracyStats: () => {
    brierScore: number;
    rps: number;
    scoredSampleSize: number;
    totalPredictions: number;
  };
  getCalibrationFactors: () => { highBand: number; mediumBand: number; lowBand: number };
}

export interface DefaultPortsDeps {
  dataService?: DataServicePort;
  predictionTracker?: TrackerPort;
  predictMatch?: PredictMatchPort;
}

const PICK_INDEX = { H: 'home', D: 'draw', A: 'away' } as const;

/**
 * Convert a prediction's valueOdds back to normalised win probabilities.
 * valueOdds.home = (1 / homeWin) * VALUE_ODDS_MARGIN, so the raw inversion
 * recovers the pre-margin probability — but bookmaker margin inflates the
 * sum slightly; we re-normalise so {home + draw + away} sums to 1.
 */
function probsFromValueOdds(
  valueOdds?: { home: number; draw: number; away: number }
): { home: number; draw: number; away: number } {
  if (!valueOdds) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  const raw = {
    home: VALUE_ODDS_MARGIN / valueOdds.home,
    draw: VALUE_ODDS_MARGIN / valueOdds.draw,
    away: VALUE_ODDS_MARGIN / valueOdds.away
  };
  const total = raw.home + raw.draw + raw.away || 1;
  return { home: raw.home / total, draw: raw.draw / total, away: raw.away / total };
}

/**
 * Convert match-level decimal odds to normalised implied probabilities,
 * stripping bookmaker overround. Returns undefined if any odd is missing
 * or non-positive (treat as "no market").
 */
function marketImpliedFromMatch(
  match: Match
): { home: number; draw: number; away: number } | undefined {
  const { home_odds, draw_odds, away_odds } = match;
  if (
    home_odds == null || draw_odds == null || away_odds == null ||
    home_odds <= 0 || draw_odds <= 0 || away_odds <= 0
  ) return undefined;
  const raw = { home: 1 / home_odds, draw: 1 / draw_odds, away: 1 / away_odds };
  const total = raw.home + raw.draw + raw.away || 1;
  return { home: raw.home / total, draw: raw.draw / total, away: raw.away / total };
}

async function matchToFixtureContext(
  match: Match,
  predictMatch: PredictMatchPort
): Promise<FixtureContext> {
  let ourProb: { home: number; draw: number; away: number };
  let pick: 'H' | 'D' | 'A' = 'D';
  try {
    const prediction = await predictMatch(match.home_team, match.away_team);
    // Use the engine's final triple directly. The valueOdds inversion is a
    // legacy fallback for injected test ports only — it round-trips through a
    // synthetic bookmaker margin and loses precision.
    ourProb = prediction.probabilities ?? probsFromValueOdds(prediction.valueOdds);
    pick = prediction.predictedResult;
  } catch {
    ourProb = { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  }

  const fixture: FixtureContext = {
    id: match.id,
    home: match.home_team,
    away: match.away_team,
    kickoff: match.date,
    ourProb
  };

  const marketImplied = marketImpliedFromMatch(match);
  if (marketImplied) {
    fixture.marketImplied = marketImplied;
    const key = PICK_INDEX[pick];
    fixture.valueEdge = ourProb[key] - marketImplied[key];
  }
  return fixture;
}

/**
 * Choose the honesty source for the AI accuracy line: live tracked
 * predictions when any have been probability-scored; otherwise the Butler
 * model's fit-time walk-forward evidence (real numbers over thousands of
 * historical matches beat "no data yet" — and the provenance is labelled).
 */
export function resolveAccuracyStats(
  live: {
    brierScore: number;
    rps: number;
    scoredSampleSize: number;
    totalPredictions: number;
    calibration: number;
  },
  fitted?: Pick<Coefficients, 'backtest'>
): AccuracyStats {
  if (live.scoredSampleSize > 0 || !fitted || fitted.backtest.sampleSize === 0) {
    return {
      brier: live.brierScore,
      rps: live.rps,
      calibration: live.calibration,
      sampleSize: live.totalPredictions,
      scoredSampleSize: live.scoredSampleSize,
      source: 'live'
    };
  }
  const bt = fitted.backtest;
  return {
    brier: bt.brier,
    rps: bt.rps,
    // ECE measures miscalibration; the context's calibration scalar means
    // "1 = perfect", matching calibrationIndex's convention.
    calibration: Math.max(0, Math.min(1, 1 - bt.ece)),
    sampleSize: bt.sampleSize,
    scoredSampleSize: bt.sampleSize,
    source: 'backtest'
  };
}

function standingToRow(s: Standing): StandingsRow {
  return {
    position: s.position,
    team: s.team.name,
    played: s.playedGames,
    points: s.points,
    goalDifference: s.goalDifference
  };
}

/**
 * Build a KickerContextPorts wired to the production prediction stack. Pass
 * `deps` to override individual ports for tests; omit for live behaviour.
 */
export function defaultPorts(deps: DefaultPortsDeps = {}): KickerContextPorts {
  const dataService = deps.dataService ?? defaultDataService;
  const tracker = deps.predictionTracker ?? defaultTracker;
  const predictMatch = deps.predictMatch ??
    ((home: string, away: string) => OptimizedPredictor.predictMatch(home, away));

  return {
    async getUpcomingFixtures({ daysAhead }) {
      const matches = await dataService.getMatches({ upcoming: true, days: daysAhead });
      return Promise.all(matches.map((m) => matchToFixtureContext(m, predictMatch)));
    },
    async getStandings() {
      const standings = await dataService.getStandings();
      return standings.map(standingToRow);
    },
    async getAccuracyStats(): Promise<AccuracyStats> {
      const stats = tracker.getAccuracyStats();
      const factors = tracker.getCalibrationFactors();
      return resolveAccuracyStats(
        {
          brierScore: stats.brierScore,
          rps: stats.rps,
          scoredSampleSize: stats.scoredSampleSize,
          totalPredictions: stats.totalPredictions,
          calibration: calibrationIndex(factors)
        },
        butlerFitted ? butlerCoefficients : undefined
      );
    }
  };
}

// Test-only exports — kept off the default barrel by convention. Module is
// already small enough that consumers reaching for these is fine.
export const __test = { probsFromValueOdds, marketImpliedFromMatch, matchToFixtureContext, standingToRow };
