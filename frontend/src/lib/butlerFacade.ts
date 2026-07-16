/**
 * The Butler model behind the app's prediction contract.
 *
 * This module is the engine-to-app seam that REPLACES OptimizedPredictor's
 * internals at the gate-approved swap: same signature, same
 * EnhancedPredictionModel field names, but every number comes from the
 * fitted Dixon-Coles core + residual stack + calibration instead of the
 * five-heuristic ensemble.
 *
 * Until the swap commit lands, this module has no production consumers —
 * it exists in parallel so the old engine keeps serving (and keeps being
 * measurable as the baseline) while the Butler path is fully testable.
 *
 * Differences from the old engine, all deliberate:
 * - `probabilities`/`confidence` are the calibrated triple and its max —
 *   honest statements, no boost/penalty/fatigue/band heuristics.
 * - `modelOutputs` is a real stage decomposition (class / form / calibrated)
 *   rather than five pseudo-model triples.
 * - The XGBoost backend joins by log-odds blend inside the engine
 *   (coefficients.stack.wMl), not probability averaging + confidence nudges.
 * - `valueOdds` are fair odds 1/p — the synthetic bookmaker margin is gone.
 * - The score grid is rescaled to agree with the published triple exactly,
 *   so scoreline, top-scorelines, pick, and bars can never contradict.
 */

import { dataService } from '../services/dataService';
import { backendService } from '../services/backendService';
import { BackendUnavailableError } from '../types';
import type { Match, MLPrediction } from '../types';
import {
  coefficients,
  isFitted,
  getLiveParams,
  predictFixture,
  topScorelines as gridTop,
  toCsvName,
  argmaxOutcome,
  restDays,
  type EngineMatch,
  type EnginePrediction,
  type ProbTriple,
} from './engine';

/** The Butler decomposition shown as the UI's model-breakdown bars. */
export interface ButlerModelOutputs {
  /** Season-long class (slow-memory fit): "who's the better side". */
  class: ProbTriple;
  /** Current form (decayed fit + residual stack): "who's better right now". */
  form: ProbTriple;
  /** The published, calibrated triple — identical to `probabilities`. */
  calibrated: ProbTriple;
}

export interface ButlerPredictionModel {
  predictedResult: 'H' | 'D' | 'A';
  probabilities: ProbTriple;
  confidence: number;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  homeForm: string;
  awayForm: string;
  /** Truthful display constant: the prediction is one goal model (+ ML when
   *  the backend contributed). Kept for contract compatibility. */
  modelWeights: {
    elo: number;
    poisson: number;
    form: number;
    h2h: number;
    standings: number;
    ml?: number;
  };
  insights: string[];
  /** Fair odds, 1/p — no synthetic margin. */
  valueOdds: ProbTripleOdds;
  modelOutputs: ButlerModelOutputs;
  topScorelines: Array<{ score: string; probability: number }>;
  scoreProbabilities: { [score: string]: number };
  /** Real expected goals (the fitted λs) — what the UI's xG slot should show. */
  expectedGoals: { home: number; away: number };
  /** True when the class and form views disagree on the winner. */
  divergenceFlag: boolean;
}

interface ProbTripleOdds {
  home: number;
  draw: number;
  away: number;
}

const TOP_SCORELINES_COUNT = 7;
const H2H_DOMINATION_MIN_MATCHES = 3;
const REFEREE_MIN_MATCHES = 10;
const CONGESTION_REST_DAYS = 4;
const COINFLIP_ENTROPY = 0.97;

function toEngineMatches(matches: Match[]): EngineMatch[] {
  const out: EngineMatch[] = [];
  for (const m of matches) {
    if (!m.result || m.home_goals === null || m.away_goals === null) continue;
    out.push({
      date: m.date,
      home: toCsvName(m.home_team) ?? m.home_team,
      away: toCsvName(m.away_team) ?? m.away_team,
      homeGoals: m.home_goals,
      awayGoals: m.away_goals,
    });
  }
  return out;
}

/** Newest-first last-5 form string ("WDLWW") for a team, from engine history. */
function formString(history: EngineMatch[], team: string): string {
  const recent = history
    .filter((m) => m.home === team || m.away === team)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((m) => {
      if (m.homeGoals === m.awayGoals) return 'D';
      const homeWon = m.homeGoals > m.awayGoals;
      return (m.home === team ? homeWon : !homeWon) ? 'W' : 'L';
    });
  return recent.length > 0 ? recent.join('') : 'N/A';
}

/** Outcome-consistent modal scoreline: the most likely cell agreeing with
 *  the pick. The grid already agrees with the triple, so this is coherent
 *  with the probability bars by construction. */
function modalScoreline(
  grid: Record<string, number>,
  pick: 'H' | 'D' | 'A'
): { home: number; away: number } {
  const matches =
    pick === 'H' ? (h: number, a: number) => h > a
    : pick === 'A' ? (h: number, a: number) => a > h
    : (h: number, a: number) => h === a;
  let best = -1;
  let bestHome = pick === 'A' ? 0 : 1;
  let bestAway = pick === 'H' ? 0 : 1;
  if (pick === 'D') { bestHome = 1; bestAway = 1; }
  for (const [score, prob] of Object.entries(grid)) {
    const dash = score.indexOf('-');
    const h = Number(score.slice(0, dash));
    const a = Number(score.slice(dash + 1));
    if (!matches(h, a) || prob <= best) continue;
    best = prob;
    bestHome = h;
    bestAway = a;
  }
  return { home: bestHome, away: bestAway };
}

function buildInsights(args: {
  homeTeam: string;
  awayTeam: string;
  homeCsv: string;
  awayCsv: string;
  prediction: EnginePrediction;
  history: EngineMatch[];
  matches: Match[];
  referee: string | null;
  kickoff: string;
  mlPrediction: MLPrediction | null;
}): string[] {
  const { homeTeam, awayTeam, prediction: p } = args;
  const insights: string[] = [];

  if (!isFitted) {
    insights.push('Engine running on unfitted placeholder coefficients — run engine:fit');
  }

  // Strength gap, from the fitted ratings the prediction actually used.
  const attackEdge = p.ratings.home.att - p.ratings.away.att;
  const defenceEdge = p.ratings.away.def - p.ratings.home.def; // positive = away leakier
  const netEdge = p.lambdas.home - p.lambdas.away;
  if (Math.abs(netEdge) > 0.6) {
    const stronger = netEdge > 0 ? homeTeam : awayTeam;
    insights.push(
      `${stronger} rate ${Math.abs(netEdge).toFixed(1)} goals/game stronger on the fitted numbers`
    );
  } else if (Math.abs(attackEdge) > 0.25 || Math.abs(defenceEdge) > 0.25) {
    const attacker = attackEdge > 0 ? homeTeam : awayTeam;
    insights.push(`${attacker} carry the sharper attack; margins are fine everywhere else`);
  }

  // Class vs form divergence — the editorial gold.
  if (p.usedPromotedPrior.home || p.usedPromotedPrior.away) {
    const club = p.usedPromotedPrior.home ? homeTeam : awayTeam;
    insights.push(`${club} rated on the promoted-club prior — little top-flight history to go on`);
  } else if (argmaxOutcome(p.classTriple) !== argmaxOutcome(p.formTriple)) {
    insights.push(
      'Season-long numbers and current form disagree on the winner — trust the bars, expect debate'
    );
  }

  // Congestion — narrative only (the old engine double-counted it into both
  // the rates and the confidence; the Butler model tells you and moves on).
  for (const [team, csv] of [[homeTeam, args.homeCsv], [awayTeam, args.awayCsv]] as const) {
    const rest = restDays(args.history, csv, args.kickoff);
    if (rest < CONGESTION_REST_DAYS) {
      insights.push(`${team} on a ${Math.floor(rest)}-day turnaround — congestion could bite`);
    }
  }

  // H2H dominance — kept verbatim from the old engine, including the
  // ≥3-completed-meetings guard that stops "1W in last 1" nonsense.
  const meetings = args.matches
    .filter(
      (m) =>
        ((m.home_team === homeTeam && m.away_team === awayTeam) ||
          (m.home_team === awayTeam && m.away_team === homeTeam)) &&
        m.result !== null
    )
    // Newest first — "last N meetings" must mean the LATEST N, regardless of
    // the caller's array order.
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  if (meetings.length >= H2H_DOMINATION_MIN_MATCHES) {
    let homeWins = 0;
    let awayWins = 0;
    for (const m of meetings) {
      const homeSideWon = m.result === 'H';
      const awaySideWon = m.result === 'A';
      if ((m.home_team === homeTeam && homeSideWon) || (m.away_team === homeTeam && awaySideWon)) homeWins++;
      if ((m.home_team === awayTeam && homeSideWon) || (m.away_team === awayTeam && awaySideWon)) awayWins++;
    }
    if (homeWins / meetings.length > 0.6) {
      insights.push(`${homeTeam} dominates H2H (${homeWins}W in last ${meetings.length})`);
    } else if (awayWins / meetings.length > 0.6) {
      insights.push(`${awayTeam} dominates H2H (${awayWins}W in last ${meetings.length})`);
    }
  }

  // Referee tendencies — narrative only, never a probability shift.
  if (args.referee) {
    const withRef = args.matches.filter((m) => m.referee === args.referee && m.result);
    if (withRef.length >= REFEREE_MIN_MATCHES) {
      const completed = args.matches.filter((m) => m.result);
      const refHomeRate = withRef.filter((m) => m.result === 'H').length / withRef.length;
      const leagueHomeRate =
        completed.length > 0
          ? completed.filter((m) => m.result === 'H').length / completed.length
          : 0.46;
      if (Math.abs(refHomeRate - leagueHomeRate) > 0.05) {
        const direction = refHomeRate > leagueHomeRate ? 'favours home sides' : 'favours away sides';
        insights.push(
          `Referee ${args.referee} historically ${direction} (${(refHomeRate * 100).toFixed(0)}% home wins vs ${(leagueHomeRate * 100).toFixed(0)}% league average)`
        );
      }
    }
  }

  // Honest uncertainty.
  if (p.entropy > COINFLIP_ENTROPY) {
    insights.push('Genuine coin-flip fixture — the model refuses to pretend otherwise');
  }

  if (args.mlPrediction) {
    const mlPick = argmaxOutcome({
      home: args.mlPrediction.prediction.home,
      draw: args.mlPrediction.prediction.draw,
      away: args.mlPrediction.prediction.away,
    });
    const butlerPick = argmaxOutcome(p.triple);
    insights.push(
      mlPick === butlerPick
        ? 'XGBoost backend agrees with the pick — blended in'
        : 'XGBoost backend leans the other way — blended, tempering the pick'
    );
  }

  return insights;
}

export class ButlerPredictor {
  /**
   * Same signature as OptimizedPredictor.predictMatch — the swap commit
   * re-points that name here.
   */
  static async predictMatch(
    homeTeam: string,
    awayTeam: string,
    historicalMatches?: Match[],
    referee?: string | null,
    matchDate?: string
  ): Promise<ButlerPredictionModel> {
    try {
      // 1. Matches: live mode fetches; backtest mode uses what it was given.
      let matches: Match[] = historicalMatches ?? [];
      if (!historicalMatches) {
        try {
          matches = await dataService.getMatches();
        } catch {
          matches = [];
        }
      }
      const history = toEngineMatches(matches);

      // 2. Kickoff reference: the fixture's date, else just after the newest
      //    known result — data time, never the wall clock.
      const newest = history.reduce((max, m) => (m.date > max ? m.date : max), '');
      const kickoff =
        matchDate ??
        (newest ? new Date(Date.parse(newest) + 86_400_000).toISOString() : '1970-01-02T00:00:00Z');

      // 3. Live parameters: shipped coefficients warm-refit over fresh results.
      const live = getLiveParams(coefficients, history);

      // 4. Optional XGBoost triple (live mode only; silent fallback — but the
      //    blend itself happens in log-odds space inside the engine).
      //    Storage access is guarded separately: a throwing localStorage
      //    (private browsing, storage disabled) must only skip the ML blend,
      //    never degrade the whole prediction to the uniform fallback.
      let mlPrediction: MLPrediction | null = null;
      let backendEnabled = false;
      try {
        backendEnabled =
          typeof localStorage !== 'undefined' && localStorage.getItem('use_backend') !== 'false';
      } catch {
        backendEnabled = false;
      }
      if (!historicalMatches && backendEnabled && coefficients.stack.wMl > 0) {
        try {
          mlPrediction = await backendService.predictMatch(homeTeam, awayTeam);
        } catch (err) {
          if (!(err instanceof BackendUnavailableError)) {
            console.warn('XGBoost backend unavailable:', err);
          }
        }
      }

      // 5. The engine.
      const homeCsv = toCsvName(homeTeam) ?? homeTeam;
      const awayCsv = toCsvName(awayTeam) ?? awayTeam;
      const prediction = predictFixture(coefficients, live, {
        home: homeTeam,
        away: awayTeam,
        kickoff,
        history,
        external: mlPrediction
          ? {
              home: mlPrediction.prediction.home,
              draw: mlPrediction.prediction.draw,
              away: mlPrediction.prediction.away,
            }
          : undefined,
      });

      // Diagnostics live here at the app boundary — the engine itself stays
      // pure. An established club hitting the promoted prior means
      // team-name drift upstream (fix it in engine/teamNames.ts).
      if (prediction.usedPromotedPrior.home || prediction.usedPromotedPrior.away) {
        console.warn(
          '[butler] promoted-team prior applied:',
          [
            prediction.usedPromotedPrior.home ? homeTeam : null,
            prediction.usedPromotedPrior.away ? awayTeam : null,
          ].filter(Boolean).join(', ')
        );
      }

      // 6. Contract mapping.
      const pick = argmaxOutcome(prediction.triple);
      const goals = modalScoreline(prediction.grid, pick);
      const insights = buildInsights({
        homeTeam,
        awayTeam,
        homeCsv,
        awayCsv,
        prediction,
        history,
        matches,
        referee: referee ?? null,
        kickoff,
        mlPrediction,
      });

      return {
        predictedResult: pick,
        probabilities: prediction.triple,
        confidence: Math.max(
          prediction.triple.home,
          prediction.triple.draw,
          prediction.triple.away
        ),
        predictedHomeGoals: goals.home,
        predictedAwayGoals: goals.away,
        homeForm: formString(history, homeCsv),
        awayForm: formString(history, awayCsv),
        modelWeights: {
          elo: 0,
          poisson: 1,
          form: 0,
          h2h: 0,
          standings: 0,
          ...(mlPrediction ? { ml: coefficients.stack.wMl } : {}),
        },
        insights,
        valueOdds: {
          home: prediction.triple.home > 0 ? 1 / prediction.triple.home : 100,
          draw: prediction.triple.draw > 0 ? 1 / prediction.triple.draw : 100,
          away: prediction.triple.away > 0 ? 1 / prediction.triple.away : 100,
        },
        modelOutputs: {
          class: prediction.classTriple,
          form: prediction.formTriple,
          calibrated: prediction.triple,
        },
        topScorelines: gridTop(prediction.grid, TOP_SCORELINES_COUNT),
        scoreProbabilities: prediction.grid,
        expectedGoals: prediction.lambdas,
        divergenceFlag:
          argmaxOutcome(prediction.classTriple) !== argmaxOutcome(prediction.formTriple),
      };
    } catch (error) {
      console.warn('ButlerPredictor.predictMatch failed, using fallback:', error);
      const uniform = { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
      return {
        predictedResult: 'D',
        probabilities: uniform,
        confidence: 1 / 3,
        predictedHomeGoals: 1,
        predictedAwayGoals: 1,
        homeForm: 'N/A',
        awayForm: 'N/A',
        modelWeights: { elo: 0, poisson: 1, form: 0, h2h: 0, standings: 0 },
        insights: ['Using simplified prediction due to data limitations'],
        valueOdds: { home: 3, draw: 3, away: 3 },
        modelOutputs: { class: uniform, form: uniform, calibrated: uniform },
        topScorelines: [],
        scoreProbabilities: {},
        expectedGoals: { home: 1.35, away: 1.1 },
        divergenceFlag: false,
      };
    }
  }
}
