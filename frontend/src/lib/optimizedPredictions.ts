import { dataService } from '../services/dataService';
import type { Match, Standing, MLPrediction, TeamForm } from '../types';
import { BackendUnavailableError } from '../types';
import { EloRatingSystem, PoissonPredictor, FatigueAnalyzer, RefereeAnalyzer, sharedEloSystem } from './advancedPredictions';
import { backendService } from '../services/backendService';
import { predictionTracker } from '../services/predictionTracker';
import { getPairStats, getTeamProfile } from './data/statsPack';

// Blend weight for 33-season historical stats vs current-form signal.
// 0.3 = 30% historical influence, 70% current. Small enough to let recent
// form and team strength dominate, large enough to lift known high-scoring
// fixtures (Liverpool-Arsenal) and dampen defensive ones (Burnley-Palace).
const STATS_PACK_BLEND_WEIGHT = 0.3;
// Minimum historical sample before we trust the blend. Below this, fall
// through to the raw current-form signal.
const STATS_PACK_PAIR_MIN_MATCHES = 5;
const STATS_PACK_TEAM_MIN_MATCHES = 20;

// Opposition-tier blend: when ELO gap identifies a strong favourite, blend
// the favourite's lambda toward their historical average goals scored vs
// bottom-6 opposition, and blend the underdog's lambda toward their
// historical average vs top-6 opposition. This surfaces 3+ goal scorelines
// for "Arsenal vs Burnley"-style fixtures where the aggregated Poisson at
// fitted λ ≈ 2.3 narrowly prefers 2-0 over 3-0 (11% vs 8%) and the modal
// display always picks 2-0.
const ELO_TIER_THRESHOLD = 150;
// Blend weight for the tier-specific anchor. 0.3 is conservative enough
// not to distort tight fixtures while enough to shift blowouts into the
// 3-x display range. Only fires when the tier has ≥30 historical matches.
const TIER_BLEND_WEIGHT = 0.3;
const TIER_MIN_MATCHES = 30;
import {
  VALUE_ODDS_MARGIN, DEFAULT_HOME_WIN_RATE, DEFAULT_DRAW_RATE,
  POISSON_LAMBDA_MIN, POISSON_LAMBDA_MAX, POISSON_FALLBACK_HOME_GOALS,
  POISSON_FALLBACK_AWAY_GOALS, POISSON_FALLBACK_AVG_GOALS,
  ELO_DRAW_BASE_RATE, ELO_DRAW_SCALE, ELO_DRAW_MIN, ELO_DRAW_MAX,
  FORM_RECENCY_WEIGHTS, FORM_DRAW_WEIGHT, FORM_SCORE_MIN, FORM_SCORE_MAX,
  FORM_EXCELLENT_THRESHOLD, FORM_POOR_THRESHOLD,
  FORM_DRAW_BASE, FORM_DRAW_SENSITIVITY, FORM_DRAW_MIN, FORM_DRAW_MAX,
  FORM_ELO_BETA,
  STANDINGS_POSITION_STEP,
  CONFIDENCE_MIN, CONFIDENCE_MAX, CONFIDENCE_BOOST_THRESHOLD, CONFIDENCE_BOOST_AMOUNT,
  CONFIDENCE_PENALTY_THRESHOLD, CONFIDENCE_PENALTY_AMOUNT, MODEL_DISAGREEMENT_PENALTY,
  ML_AGREEMENT_BOOST_MAX, ML_AGREEMENT_BOOST_FACTOR,
  ML_DISAGREEMENT_PENALTY_MAX, ML_DISAGREEMENT_PENALTY_FACTOR,
  REFEREE_ADJUSTMENT_MAX, REFEREE_ADJUSTMENT_THRESHOLD,
  MAX_PREDICTED_GOALS,
} from './constants';

export interface ModelOutputs {
  elo: { home: number; draw: number; away: number };
  poisson: { home: number; draw: number; away: number };
  form: { home: number; draw: number; away: number };
  h2h: { home: number; draw: number; away: number };
  standings: { home: number; draw: number; away: number };
}

export interface EnhancedPredictionModel {
  predictedResult: 'H' | 'D' | 'A';
  confidence: number;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  homeForm: string;
  awayForm: string;
  modelWeights: {
    elo: number;
    poisson: number;
    form: number;
    h2h: number;
    standings: number;
    ml?: number;
  };
  insights: string[];
  valueOdds?: {
    home: number;
    draw: number;
    away: number;
  };
  /** Raw per-model probabilities before ensemble combination (for weight optimisation) */
  modelOutputs?: ModelOutputs;
  /**
   * Top-N scorelines from the Poisson grid, sorted by probability descending.
   * Surfaces the shape of the distribution instead of collapsing it to one score.
   */
  topScorelines?: Array<{ score: string; probability: number }>;
  /**
   * The full fatigue-adjusted Poisson score grid used to derive the main card's
   * probabilities. Exposed so downstream consumers (BetBuilder, value scanner)
   * can reuse the same grid instead of re-deriving a degenerate one from the
   * integer predictedHomeGoals/predictedAwayGoals fields. Keyed as "H-A": prob.
   */
  scoreProbabilities?: { [score: string]: number };
}

/** Number of top scorelines to surface on the Predictions card. */
const TOP_SCORELINES_COUNT = 7;

/**
 * Sort a Poisson score-probability grid descending and return the top N entries.
 */
function getTopScorelines(
  scoreProbabilities: { [score: string]: number },
  n: number = TOP_SCORELINES_COUNT
): Array<{ score: string; probability: number }> {
  return Object.entries(scoreProbabilities)
    .map(([score, probability]) => ({ score, probability }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, n);
}

/**
 * Return the single most likely (modal) scoreline from a Poisson grid.
 * This differs from `round(E[home])-round(E[away])` because the Poisson mean
 * exceeds the mode for small λ, so rounded means systematically overstate goals
 * (e.g. λ=1.5 rounds to 2 but mode=1). Using argmax gives the single most likely
 * individual scoreline rather than the score closest to the expected goals.
 */
export function argmaxScoreline(
  scoreProbabilities: { [score: string]: number }
): { home: number; away: number; probability: number } {
  let best = { home: 0, away: 0, probability: -1 };
  for (const [score, prob] of Object.entries(scoreProbabilities)) {
    if (prob > best.probability) {
      const [home, away] = score.split('-').map(Number);
      best = { home, away, probability: prob };
    }
  }
  return best;
}

// Home/away attack & defence strengths for the Poisson model
interface TeamStrengths {
  homeAttack: number;   // Goals scored at home relative to league average
  homeDefence: number;  // Goals conceded at home relative to league average
  awayAttack: number;   // Goals scored away relative to league average
  awayDefence: number;  // Goals conceded away relative to league average
}

// League-wide averages derived from completed matches
interface LeagueAverages {
  avgHomeGoals: number; // Average goals scored by home teams per match
  avgAwayGoals: number; // Average goals scored by away teams per match
  homeWinRate: number;  // Proportion of completed matches won by the home side
  teamStrengths: Map<string, TeamStrengths>;
}

// Return type of analyzeRecentForm()
interface FormAnalysis {
  homeFormScore: number;
  awayFormScore: number;
  homeFormString: string;
  awayFormString: string;
  probabilities: { homeWin: number; draw: number; awayWin: number };
}

// Return type of analyzeHeadToHead()
interface H2HAnalysis {
  totalMatches: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  homeWinRate: number;
  awayWinRate: number;
  avgHomeGoals?: number;
  avgAwayGoals?: number;
  probabilities: { homeWin: number; draw: number; awayWin: number };
}

/**
 * Default ensemble model weights — used as the baseline when no custom weights are saved.
 * Users can apply backtest-derived optimal weights via the Predictions backtest panel,
 * which are persisted to localStorage and read by getActiveModelWeights().
 */
export const MODEL_WEIGHTS = {
  elo: 0.25,
  poisson: 0.30,
  form: 0.20,
  h2h: 0.10,
  standings: 0.15
} as const;

/** Mutable weight shape for user-applied weights (same keys as MODEL_WEIGHTS). */
export type ModelWeightValues = { elo: number; poisson: number; form: number; h2h: number; standings: number };

/**
 * Residualise the Form model's H/A probabilities against ELO's implied
 * advantage, on the logit scale, so Form contributes signal orthogonal to ELO.
 *
 * Both inputs are probability triples that should sum to ~1. We:
 *   1. Compute each model's "home-over-away" log-odds (draw mass ignored).
 *   2. Subtract β × ELO logit from Form logit (β = FORM_ELO_BETA).
 *   3. Rebuild a Form triple that preserves Form's draw probability and
 *      splits the non-draw mass per the residual log-odds.
 *
 * Exported for unit testing — the production path calls it inline in
 * OptimizedPredictor.predictMatch().
 */
export function orthogonaliseFormVsElo(
  formProbs: { home: number; draw: number; away: number },
  eloProbs: { home: number; draw: number; away: number },
  beta: number = FORM_ELO_BETA
): { home: number; draw: number; away: number } {
  // Guard: degenerate probabilities (all zero, or only draw mass) — return form unchanged
  const formNonDraw = formProbs.home + formProbs.away;
  const eloNonDraw = eloProbs.home + eloProbs.away;
  if (formNonDraw <= 1e-9 || eloNonDraw <= 1e-9) return { ...formProbs };

  // Clamp shares away from 0/1 so logit is finite
  const clamp = (x: number) => Math.max(1e-4, Math.min(1 - 1e-4, x));
  const formHomeShare = clamp(formProbs.home / formNonDraw);
  const eloHomeShare = clamp(eloProbs.home / eloNonDraw);

  const logit = (p: number) => Math.log(p / (1 - p));
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

  const formLogit = logit(formHomeShare);
  const eloLogit = logit(eloHomeShare);
  const residualLogit = formLogit - beta * eloLogit;
  const residualHomeShare = sigmoid(residualLogit);

  const drawKeep = formProbs.draw;
  const nonDrawMass = 1 - drawKeep;
  return {
    home: residualHomeShare * nonDrawMass,
    draw: drawKeep,
    away: (1 - residualHomeShare) * nonDrawMass
  };
}

const WEIGHTS_STORAGE_KEY = 'oracle_model_weights';

/**
 * Read the active ensemble weights — user-applied custom weights from localStorage,
 * falling back to the built-in defaults. Validates that weights sum to ~1.0.
 */
export function getActiveModelWeights(): ModelWeightValues {
  try {
    const stored = localStorage.getItem(WEIGHTS_STORAGE_KEY);
    if (!stored) return { ...MODEL_WEIGHTS };

    const parsed = JSON.parse(stored) as ModelWeightValues;

    // Validate shape: must have all five keys as numbers
    const keys: (keyof ModelWeightValues)[] = ['elo', 'poisson', 'form', 'h2h', 'standings'];
    for (const key of keys) {
      if (typeof parsed[key] !== 'number' || isNaN(parsed[key]) || parsed[key] < 0) {
        return { ...MODEL_WEIGHTS };
      }
    }

    // Validate sum is approximately 1.0 (allow ±0.02 for floating-point rounding)
    const sum = keys.reduce((s, k) => s + parsed[k], 0);
    if (Math.abs(sum - 1.0) > 0.02) {
      return { ...MODEL_WEIGHTS };
    }

    return parsed;
  } catch {
    return { ...MODEL_WEIGHTS };
  }
}

/** Persist user-applied weights to localStorage. Weights must sum to 1.0 (±0.02). */
export function saveModelWeights(weights: ModelWeightValues): boolean {
  const keys: (keyof ModelWeightValues)[] = ['elo', 'poisson', 'form', 'h2h', 'standings'];
  const sum = keys.reduce((s, k) => s + weights[k], 0);
  if (Math.abs(sum - 1.0) > 0.02) return false;
  for (const key of keys) {
    if (typeof weights[key] !== 'number' || isNaN(weights[key]) || weights[key] < 0) return false;
  }
  localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(weights));
  return true;
}

/** Remove custom weights, reverting to defaults. */
export function resetModelWeights(): void {
  localStorage.removeItem(WEIGHTS_STORAGE_KEY);
}

/** Check whether the user has applied custom weights. */
export function hasCustomWeights(): boolean {
  return localStorage.getItem(WEIGHTS_STORAGE_KEY) !== null;
}

/**
 * When the ML backend contributes to the ensemble, it gets this weight and
 * the TypeScript model weights are scaled down proportionally. A 30% ML weight
 * means the Python models contribute nearly a third of the final prediction.
 */
const ML_BACKEND_WEIGHT = 0.30;

export class OptimizedPredictor {
  // Use the shared ELO system — single source of truth for team ratings
  private static eloSystem = sharedEloSystem;

  /**
   * Compute league averages and per-team attack/defence strengths from completed matches.
   * This is the foundation of the Dixon-Coles Poisson model.
   */
  private static computeLeagueAverages(matches: Match[]): LeagueAverages {
    const completed = matches.filter(m => m.result && m.home_goals !== null && m.away_goals !== null);

    if (completed.length === 0) {
      return { avgHomeGoals: POISSON_FALLBACK_HOME_GOALS, avgAwayGoals: POISSON_FALLBACK_AWAY_GOALS, homeWinRate: DEFAULT_HOME_WIN_RATE, teamStrengths: new Map() };
    }

    // League totals
    let totalHomeGoals = 0;
    let totalAwayGoals = 0;

    // Per-team accumulators
    const teamHome = new Map<string, { scored: number; conceded: number; matches: number }>();
    const teamAway = new Map<string, { scored: number; conceded: number; matches: number }>();

    for (const m of completed) {
      const hg = m.home_goals!;
      const ag = m.away_goals!;
      totalHomeGoals += hg;
      totalAwayGoals += ag;

      // Home team stats
      const h = teamHome.get(m.home_team) ?? { scored: 0, conceded: 0, matches: 0 };
      h.scored += hg;
      h.conceded += ag;
      h.matches += 1;
      teamHome.set(m.home_team, h);

      // Away team stats
      const a = teamAway.get(m.away_team) ?? { scored: 0, conceded: 0, matches: 0 };
      a.scored += ag;
      a.conceded += hg;
      a.matches += 1;
      teamAway.set(m.away_team, a);
    }

    const avgHomeGoals = totalHomeGoals / completed.length;
    const avgAwayGoals = totalAwayGoals / completed.length;
    const homeWinRate = completed.filter(m => m.result === 'H').length / completed.length;

    // Compute per-team strengths relative to league average
    const teamStrengths = new Map<string, TeamStrengths>();
    const allTeams = new Set([...teamHome.keys(), ...teamAway.keys()]);

    for (const team of allTeams) {
      const home = teamHome.get(team);
      const away = teamAway.get(team);

      teamStrengths.set(team, {
        homeAttack: home && home.matches >= 3
          ? (home.scored / home.matches) / avgHomeGoals
          : 1.0,
        homeDefence: home && home.matches >= 3
          ? (home.conceded / home.matches) / avgAwayGoals
          : 1.0,
        awayAttack: away && away.matches >= 3
          ? (away.scored / away.matches) / avgAwayGoals
          : 1.0,
        awayDefence: away && away.matches >= 3
          ? (away.conceded / away.matches) / avgHomeGoals
          : 1.0,
      });
    }

    return { avgHomeGoals, avgAwayGoals, homeWinRate, teamStrengths };
  }

  /**
   * Calculate Poisson lambda values using the Dixon-Coles approach.
   *
   * λ_home = home_attack × away_defence × league_avg_home_goals
   * λ_away = away_attack × home_defence × league_avg_away_goals
   *
   * Falls back to ELO-derived estimates when insufficient match data exists.
   */
  private static calculatePoissonLambdas(
    homeTeam: string,
    awayTeam: string,
    leagueAvgs: LeagueAverages,
    homeStats: { avgGoalsScored: number; avgGoalsConceded: number },
    awayStats: { avgGoalsScored: number; avgGoalsConceded: number },
    useHistoricalPack: boolean = true,
    eloGap: number = 0,
  ): { lambdaHome: number; lambdaAway: number } {
    const homeStrengths = leagueAvgs.teamStrengths.get(homeTeam);
    const awayStrengths = leagueAvgs.teamStrengths.get(awayTeam);

    let rawLambdaHome: number;
    let rawLambdaAway: number;

    if (homeStrengths && awayStrengths) {
      // Full Dixon-Coles: team strengths are relative to league average
      rawLambdaHome = homeStrengths.homeAttack * awayStrengths.awayDefence * leagueAvgs.avgHomeGoals;
      rawLambdaAway = awayStrengths.awayAttack * homeStrengths.homeDefence * leagueAvgs.avgAwayGoals;
    } else {
      // Fallback: derive from overall stats (no home/away split available)
      const avgLeagueGoals = (leagueAvgs.avgHomeGoals + leagueAvgs.avgAwayGoals) / 2 || POISSON_FALLBACK_AVG_GOALS;
      rawLambdaHome = (homeStats.avgGoalsScored / avgLeagueGoals) * (awayStats.avgGoalsConceded / avgLeagueGoals) * leagueAvgs.avgHomeGoals;
      rawLambdaAway = (awayStats.avgGoalsScored / avgLeagueGoals) * (homeStats.avgGoalsConceded / avgLeagueGoals) * leagueAvgs.avgAwayGoals;
    }

    // Blend with 33-season pair history when available. Skipped in backtest
    // mode (useHistoricalPack=false) to keep regression tests deterministic.
    let lambdaHome = rawLambdaHome;
    let lambdaAway = rawLambdaAway;
    if (useHistoricalPack) {
      const pair = getPairStats(homeTeam, awayTeam);
      if (pair && pair.totalMatches >= STATS_PACK_PAIR_MIN_MATCHES) {
        lambdaHome = (1 - STATS_PACK_BLEND_WEIGHT) * rawLambdaHome + STATS_PACK_BLEND_WEIGHT * pair.avgHomeGoals;
        lambdaAway = (1 - STATS_PACK_BLEND_WEIGHT) * rawLambdaAway + STATS_PACK_BLEND_WEIGHT * pair.avgAwayGoals;
      }

      // Opposition-tier blend for mismatched fixtures. The ELO gap is the
      // cleanest live signal of who's favoured; when it exceeds 150 points,
      // we treat the fixture as "strong vs weak" and pull the favoured
      // team's lambda toward their 33-season avg-goals-scored vs bottom-6
      // opposition, while dragging the underdog's lambda toward their
      // avg-goals vs top-6. This surfaces the "top-four crush bottom-half"
      // 3+ goal scorelines that aggregated Poisson otherwise flattens.
      if (eloGap > ELO_TIER_THRESHOLD) {
        // Home is strong favourite
        const homeProfile = getTeamProfile(homeTeam);
        const awayProfile = getTeamProfile(awayTeam);
        const homeVsWeak = homeProfile?.oppositionTier?.bottom6;
        const awayVsStrong = awayProfile?.oppositionTier?.top6;
        if (homeVsWeak && homeVsWeak.matches >= TIER_MIN_MATCHES) {
          lambdaHome = (1 - TIER_BLEND_WEIGHT) * lambdaHome + TIER_BLEND_WEIGHT * homeVsWeak.avgGoalsScored;
        }
        if (awayVsStrong && awayVsStrong.matches >= TIER_MIN_MATCHES) {
          lambdaAway = (1 - TIER_BLEND_WEIGHT) * lambdaAway + TIER_BLEND_WEIGHT * awayVsStrong.avgGoalsScored;
        }
      } else if (eloGap < -ELO_TIER_THRESHOLD) {
        // Away is strong favourite (mirror)
        const homeProfile = getTeamProfile(homeTeam);
        const awayProfile = getTeamProfile(awayTeam);
        const awayVsWeak = awayProfile?.oppositionTier?.bottom6;
        const homeVsStrong = homeProfile?.oppositionTier?.top6;
        if (awayVsWeak && awayVsWeak.matches >= TIER_MIN_MATCHES) {
          lambdaAway = (1 - TIER_BLEND_WEIGHT) * lambdaAway + TIER_BLEND_WEIGHT * awayVsWeak.avgGoalsScored;
        }
        if (homeVsStrong && homeVsStrong.matches >= TIER_MIN_MATCHES) {
          lambdaHome = (1 - TIER_BLEND_WEIGHT) * lambdaHome + TIER_BLEND_WEIGHT * homeVsStrong.avgGoalsScored;
        }
      }
    }

    return {
      lambdaHome: Math.max(POISSON_LAMBDA_MIN, Math.min(POISSON_LAMBDA_MAX, lambdaHome)),
      lambdaAway: Math.max(POISSON_LAMBDA_MIN, Math.min(POISSON_LAMBDA_MAX, lambdaAway)),
    };
  }

  /**
   * Main prediction method with enhanced algorithms
   */
  static async predictMatch(
    homeTeam: string,
    awayTeam: string,
    historicalMatches?: Match[],
    referee?: string | null,
    matchDate?: string
  ): Promise<EnhancedPredictionModel> {
    const insights: string[] = [];
    
    try {
      // 1. Get current standings and team positions
      // In backtest mode (historicalMatches provided), skip dataService.getStandings()
      // to avoid both stale data and per-match API overhead. ELO-derived positions are
      // a better proxy for historical standings anyway.
      let standings: Standing[] = [];
      let homePosition = 0;
      let awayPosition = 0;

      if (!historicalMatches) {
        try {
          standings = await dataService.getStandings();
          homePosition = standings.findIndex(s => s.team.name === homeTeam) + 1;
          awayPosition = standings.findIndex(s => s.team.name === awayTeam) + 1;
        } catch {
          // Falls through to ELO-derived positions below
        }
      }

      if (!homePosition || !awayPosition) {
        // Use ELO-derived positions as fallback (or primary in backtest mode)
        const allRatings = this.eloSystem.getAllRatings();
        const sortedTeams = Object.entries(allRatings).sort((a, b) => b[1] - a[1]);
        homePosition = sortedTeams.findIndex(([team]) => team === homeTeam) + 1;
        awayPosition = sortedTeams.findIndex(([team]) => team === awayTeam) + 1;
      }
      
      if (homePosition && awayPosition) {
        const positionDiff = awayPosition - homePosition;
        if (positionDiff > 10) {
          insights.push(`${homeTeam} is ${positionDiff} places higher in the table`);
        } else if (positionDiff < -10) {
          insights.push(`${awayTeam} is ${Math.abs(positionDiff)} places higher in the table`);
        }
      }

      // 2. Get team statistics. In backtest mode (historicalMatches passed)
      // we skip the 33-season stats pack to keep regression tests
      // deterministic; live mode uses it when standings are thin or missing.
      const useHistoricalPack = !historicalMatches;
      const [homeStats, awayStats] = await Promise.all([
        this.getEnhancedTeamStats(homeTeam, standings, useHistoricalPack),
        this.getEnhancedTeamStats(awayTeam, standings, useHistoricalPack)
      ]);

      // 3. Calculate ELO ratings from shared system
      const homeElo = this.eloSystem.getTeamRating(homeTeam);
      const awayElo = this.eloSystem.getTeamRating(awayTeam);
      const eloWinProbability = this.eloSystem.calculateWinProbability(
        homeElo + EloRatingSystem.HOME_ADVANTAGE,
        awayElo
      );

      // 4. Fetch match data once — used for fatigue, Poisson, standings, referee
      let allMatches: Match[] = historicalMatches ?? [];
      if (!historicalMatches) {
        try {
          allMatches = await dataService.getMatches();
        } catch {
          // No match data available — fallback paths will handle empty array
        }
      }

      // 5. Calculate fatigue factor (needed before Poisson lambdas).
      // Rest days MUST be measured against the match's kickoff, not "now" —
      // otherwise a team that played three days ago looks fatigued for a fixture
      // four weeks in the future, which crushes Poisson lambdas through the
      // restDays/7 multiplier and collapses the grid onto 0-0 / 1-0.
      // When backtesting with pre-fetched data, derive rest days locally
      // to avoid hitting dataService on every iteration.
      const asOfDate = matchDate ? new Date(matchDate) : undefined;
      const fatigueFactor = historicalMatches
        ? this.calculateFatigueFromMatches(homeTeam, awayTeam, historicalMatches, asOfDate)
        : this.calculateFatigueFromMatches(homeTeam, awayTeam, allMatches, asOfDate);

      // 6. Calculate Poisson predictions using Dixon-Coles lambdas.
      // In live mode, blend with 33-season pair history for goal-tempo
      // context; in backtest mode, stick to current-form only. Pass the ELO
      // gap so the function can apply the opposition-tier blend when the
      // fixture is a "strong vs weak" mismatch.
      const leagueAvgs = this.computeLeagueAverages(allMatches);
      const eloGap = homeElo - awayElo;
      const rawLambdas =
        this.calculatePoissonLambdas(homeTeam, awayTeam, leagueAvgs, homeStats, awayStats, useHistoricalPack, eloGap);

      // Apply fatigue: tired teams score fewer goals (lambda × fatigue).
      // Multipliers are in (0, 1.0] so the adjustment only reduces lambda.
      // Clamp to [POISSON_LAMBDA_MIN, POISSON_LAMBDA_MAX] to prevent
      // degenerate outputs — matches advancedPredictions.ts implementation.
      const homeGoalsExpected = Math.max(POISSON_LAMBDA_MIN, Math.min(POISSON_LAMBDA_MAX,
        rawLambdas.lambdaHome * fatigueFactor.homeFatigue));
      const awayGoalsExpected = Math.max(POISSON_LAMBDA_MIN, Math.min(POISSON_LAMBDA_MAX,
        rawLambdas.lambdaAway * fatigueFactor.awayFatigue));

      const scoreProbabilities = PoissonPredictor.predictScoreProbabilities(
        homeGoalsExpected,
        awayGoalsExpected
      );
      const poissonProbs = PoissonPredictor.getOutcomeProbabilities(scoreProbabilities);

      // 6. Analyze recent form — always pass allMatches so form is computed from
      // already-fetched data instead of making per-team rate-limited API calls
      const formAnalysis = await this.analyzeRecentForm(homeTeam, awayTeam, allMatches);

      // 7. Head-to-head analysis
      const h2hAnalysis = await this.analyzeHeadToHead(homeTeam, awayTeam, allMatches);
      
      // 8. Attempt ML backend prediction (parallel — started earlier or fetched now)
      let mlPrediction: MLPrediction | null = null;
      // ML backend defaults ON: predictions are significantly better with the
      // XGBoost model included in the ensemble, and new users won't know to
      // toggle it on in Settings. Only skip when explicitly disabled.
      if (!historicalMatches && typeof localStorage !== 'undefined' && localStorage.getItem('use_backend') !== 'false') {
        try {
          mlPrediction = await backendService.predictMatch(homeTeam, awayTeam);
          insights.push('ML backend prediction incorporated into ensemble');
        } catch (err) {
          if (!(err instanceof BackendUnavailableError)) {
            console.warn('ML backend prediction failed:', err);
          }
          // Silent fallback — TypeScript ensemble handles it alone
        }
      }

      // 9. Combine all models with weighted approach
      // Dynamic draw probability: closer ratings → more likely draw (~26.5% PL average)
      const ratingDiffAbs = Math.abs(homeElo - awayElo);
      const eloDrawProb = ELO_DRAW_BASE_RATE * Math.exp(-ratingDiffAbs / ELO_DRAW_SCALE);
      const eloDrawClamped = Math.max(ELO_DRAW_MIN, Math.min(ELO_DRAW_MAX, eloDrawProb));
      const eloHomeProb = eloWinProbability * (1 - eloDrawClamped);
      const eloAwayProb = (1 - eloWinProbability) * (1 - eloDrawClamped);

      const eloProbs = { home: eloHomeProb, draw: eloDrawClamped, away: eloAwayProb };
      const standingsProbs = this.getStandingsProbabilities(homePosition, awayPosition);

      // Residualise form against ELO so Form contributes signal that isn't
      // already encoded in ELO — prevents double-counting recent results.
      const formProbsTriple = {
        home: formAnalysis.probabilities.homeWin,
        draw: formAnalysis.probabilities.draw,
        away: formAnalysis.probabilities.awayWin
      };
      const residualForm = orthogonaliseFormVsElo(formProbsTriple, eloProbs);
      const formOrthogonal = { homeWin: residualForm.home, draw: residualForm.draw, awayWin: residualForm.away };

      const modelInputs = {
        elo: eloProbs,
        poisson: poissonProbs,
        form: formOrthogonal,
        h2h: h2hAnalysis.probabilities,
        standings: standingsProbs
      };
      const combinedProbabilities = this.combineModels(modelInputs, mlPrediction);

      // 8b. Apply referee adjustment (±3% max on home/away probabilities)
      // Home win rate derived from actual completed matches (fallback 0.46 if no data)
      const leagueHomeWinRate = leagueAvgs.homeWinRate;
      const adjustedProbabilities = { ...combinedProbabilities };

      if (referee) {
        try {
          const refereeStats = await RefereeAnalyzer.getRefereeStats(referee);
          const homeWinBias = refereeStats.homeWinRate - leagueHomeWinRate;
          const adjustment = Math.max(-REFEREE_ADJUSTMENT_MAX, Math.min(REFEREE_ADJUSTMENT_MAX, homeWinBias));

          if (Math.abs(adjustment) > REFEREE_ADJUSTMENT_THRESHOLD) {
            adjustedProbabilities.homeWin += adjustment;
            adjustedProbabilities.awayWin -= adjustment;

            // Re-normalise to ensure probabilities sum to 1
            const total = adjustedProbabilities.homeWin + adjustedProbabilities.draw + adjustedProbabilities.awayWin;
            adjustedProbabilities.homeWin /= total;
            adjustedProbabilities.draw /= total;
            adjustedProbabilities.awayWin /= total;

            const direction = adjustment > 0 ? 'favours home' : 'favours away';
            insights.push(`Referee ${referee} ${direction} (${(refereeStats.homeWinRate * 100).toFixed(0)}% home win rate vs ${(leagueHomeWinRate * 100).toFixed(0)}% avg)`);
          }
        } catch {
          // Referee data unavailable — skip adjustment
        }
      }

      // 9. Determine predicted outcome
      const prediction = this.determinePrediction(adjustedProbabilities);

      // 10. Calculate confidence score with ensemble disagreement detection
      // Determine what each key model predicts independently
      const eloTopOutcome = this.getTopOutcome(eloProbs.home, eloProbs.draw, eloProbs.away);
      const poissonTopOutcome = this.getTopOutcome(poissonProbs.homeWin, poissonProbs.draw, poissonProbs.awayWin);
      const modelsDisagree = eloTopOutcome !== poissonTopOutcome;

      const rawConfidence = this.calculateConfidence(
        adjustedProbabilities,
        prediction.result,
        fatigueFactor,
        modelsDisagree
      );

      // 10b. ML backend confidence adjustment — when the backend's calibrated
      // probabilities are available, use agreement/disagreement to adjust confidence.
      // Backend agreement boosts confidence by up to 8%, disagreement penalises by up to 10%.
      let mlAdjustedConfidence = rawConfidence;
      if (mlPrediction) {
        const mlTopOutcome = this.getTopOutcome(mlPrediction.prediction.home, mlPrediction.prediction.draw, mlPrediction.prediction.away);
        const mlAgreesWithEnsemble = mlTopOutcome === prediction.result;

        if (mlAgreesWithEnsemble) {
          // Boost confidence — both the TS ensemble and Python ML agree
          const boost = Math.min(ML_AGREEMENT_BOOST_MAX, mlPrediction.confidence * ML_AGREEMENT_BOOST_FACTOR);
          mlAdjustedConfidence += boost;
          insights.push(`ML backend confirms ${prediction.result === 'H' ? 'home win' : prediction.result === 'A' ? 'away win' : 'draw'} (${(mlPrediction.confidence * 100).toFixed(0)}% confidence) — boosted`);
        } else {
          // Penalise confidence — models disagree
          const penalty = Math.min(ML_DISAGREEMENT_PENALTY_MAX, (1 - mlPrediction.confidence) * ML_DISAGREEMENT_PENALTY_FACTOR);
          mlAdjustedConfidence -= penalty;
          insights.push(`ML backend predicts ${mlTopOutcome === 'H' ? 'home win' : mlTopOutcome === 'A' ? 'away win' : 'draw'} instead — lower confidence`);
        }
      }

      // Apply historical calibration — adjust confidence based on past accuracy
      // per confidence band (Spec 01 Req 5). If the model has been overconfident
      // in a given band, the factor < 1 brings future confidence down.
      const calibration = predictionTracker.getCalibrationFactors();
      const bandFactor = mlAdjustedConfidence > 0.7 ? calibration.highBand
        : mlAdjustedConfidence >= 0.5 ? calibration.mediumBand
        : calibration.lowBand;
      const confidence = Math.max(CONFIDENCE_MIN, Math.min(CONFIDENCE_MAX, mlAdjustedConfidence * bandFactor));

      if (modelsDisagree) {
        insights.push(`Models split: ELO predicts ${eloTopOutcome}, Poisson predicts ${poissonTopOutcome} — lower confidence`);
      }

      // 11. Predict goals with adjusted model — argmax over the Poisson grid
      // (most likely single scoreline), then apply result-consistency + H2H tweaks
      const predictedGoals = this.predictGoals(
        scoreProbabilities,
        prediction.result,
        formAnalysis,
        h2hAnalysis
      );

      // Add form insights
      if (formAnalysis.homeFormScore > FORM_EXCELLENT_THRESHOLD) {
        insights.push(`${homeTeam} in excellent form (last 5: ${formAnalysis.homeFormString})`);
      } else if (formAnalysis.homeFormScore < FORM_POOR_THRESHOLD) {
        insights.push(`${homeTeam} struggling with form (last 5: ${formAnalysis.homeFormString})`);
      }

      if (formAnalysis.awayFormScore > FORM_EXCELLENT_THRESHOLD) {
        insights.push(`${awayTeam} in excellent form (last 5: ${formAnalysis.awayFormString})`);
      } else if (formAnalysis.awayFormScore < FORM_POOR_THRESHOLD) {
        insights.push(`${awayTeam} struggling with form (last 5: ${formAnalysis.awayFormString})`);
      }

      // Add H2H insights
      if (h2hAnalysis.totalMatches > 0) {
        if (h2hAnalysis.homeWinRate > 0.6) {
          insights.push(`${homeTeam} dominates H2H (${h2hAnalysis.homeWins}W in last ${h2hAnalysis.totalMatches})`);
        } else if (h2hAnalysis.awayWinRate > 0.6) {
          insights.push(`${awayTeam} dominates H2H (${h2hAnalysis.awayWins}W in last ${h2hAnalysis.totalMatches})`);
        }
      }

      // Add statistical insights
      if (homeStats.avgGoalsScored > 2.0) {
        insights.push(`${homeTeam} averaging ${homeStats.avgGoalsScored.toFixed(1)} goals per game`);
      }
      if (awayStats.avgGoalsConceded > 2.0) {
        insights.push(`${awayTeam} conceding ${awayStats.avgGoalsConceded.toFixed(1)} goals per game`);
      }

      // Calculate value odds
      const valueOdds = this.calculateValueOdds(adjustedProbabilities);

      // Report the effective weights used in this prediction
      const activeWeights = getActiveModelWeights();
      const tsScale = mlPrediction ? (1 - ML_BACKEND_WEIGHT) : 1;
      const effectiveWeights: EnhancedPredictionModel['modelWeights'] = {
        elo: activeWeights.elo * tsScale,
        poisson: activeWeights.poisson * tsScale,
        form: activeWeights.form * tsScale,
        h2h: activeWeights.h2h * tsScale,
        standings: activeWeights.standings * tsScale,
        ...(mlPrediction ? { ml: ML_BACKEND_WEIGHT } : {}),
      };

      // Store raw model outputs for weight optimisation
      const modelOutputs: ModelOutputs = {
        elo: eloProbs,
        poisson: { home: poissonProbs.homeWin, draw: poissonProbs.draw, away: poissonProbs.awayWin },
        form: { home: formAnalysis.probabilities.homeWin, draw: formAnalysis.probabilities.draw, away: formAnalysis.probabilities.awayWin },
        h2h: { home: h2hAnalysis.probabilities.homeWin, draw: h2hAnalysis.probabilities.draw, away: h2hAnalysis.probabilities.awayWin },
        standings: { home: standingsProbs.homeWin, draw: standingsProbs.draw, away: standingsProbs.awayWin }
      };

      return {
        predictedResult: prediction.result,
        confidence,
        predictedHomeGoals: predictedGoals.home,
        predictedAwayGoals: predictedGoals.away,
        homeForm: formAnalysis.homeFormString,
        awayForm: formAnalysis.awayFormString,
        modelWeights: effectiveWeights,
        insights,
        valueOdds,
        modelOutputs,
        topScorelines: getTopScorelines(scoreProbabilities),
        scoreProbabilities
      };

    } catch (error) {
      console.warn('OptimizedPredictor.predictMatch failed, using fallback:', error);
      // Fallback to simple prediction — still report the real weights for consistency
      return {
        predictedResult: 'D',
        confidence: 0.33,
        predictedHomeGoals: 1,
        predictedAwayGoals: 1,
        homeForm: 'N/A',
        awayForm: 'N/A',
        modelWeights: { ...getActiveModelWeights() },
        insights: ['Using simplified prediction due to data limitations'],
        valueOdds: { home: 3.0, draw: 3.3, away: 3.0 }
      };
    }
  }

  private static getEnhancedTeamStats(team: string, standings: Standing[], useHistoricalPack: boolean = true) {
    const standing = standings.find(s => s.team.name === team);

    if (!standing) {
      // Before falling back to ELO, check the 33-season stats pack — it's a
      // much richer source than a pure ELO-derived estimate. Era-weighted so
      // recent performance dominates.
      if (useHistoricalPack) {
        const profile = getTeamProfile(team);
        if (profile && profile.totalMatches >= STATS_PACK_TEAM_MIN_MATCHES) {
          const avgScored = (profile.eraWeighted.homeGoalsScored + profile.eraWeighted.awayGoalsScored) / 2;
          const avgConceded = (profile.eraWeighted.homeGoalsConceded + profile.eraWeighted.awayGoalsConceded) / 2;
          const cleanSheetRate = (profile.cleanSheetRateHome + profile.cleanSheetRateAway) / 2;
          // Approximate pointsPerGame from goal differential — good teams have GD > 0
          const gd = avgScored - avgConceded;
          return {
            avgGoalsScored: Math.max(0.5, avgScored),
            avgGoalsConceded: Math.max(0.5, avgConceded),
            pointsPerGame: Math.max(0.3, Math.min(3, 1.3 + gd * 0.7)),
            cleanSheetRate: Math.max(0.1, Math.min(0.5, cleanSheetRate)),
            winRate: Math.max(0.1, Math.min(0.8, 0.33 + gd * 0.2)),
          };
        }
      }

      // Fallback: ELO-derived estimate when neither standings nor stats pack help
      const teamStrength = this.eloSystem.getTeamRating(team);
      const relativeStrength = (teamStrength - 1500) / 200; // Normalise to approx -1.5 to +1.75

      // Better teams score more and concede less
      const avgGoalsScored = 1.5 + (relativeStrength * 0.5);
      const avgGoalsConceded = 1.5 - (relativeStrength * 0.3);
      const pointsPerGame = 1.3 + (relativeStrength * 0.7);
      const winRate = 0.33 + (relativeStrength * 0.2);

      return {
        avgGoalsScored: Math.max(0.5, avgGoalsScored),
        avgGoalsConceded: Math.max(0.5, avgGoalsConceded),
        pointsPerGame: Math.max(0.3, Math.min(3, pointsPerGame)),
        cleanSheetRate: Math.max(0.1, Math.min(0.5, 0.3 + relativeStrength * 0.1)),
        winRate: Math.max(0.1, Math.min(0.8, winRate))
      };
    }

    const gamesPlayed = standing.playedGames || 1;
    
    return {
      avgGoalsScored: standing.goalsFor / gamesPlayed,
      avgGoalsConceded: standing.goalsAgainst / gamesPlayed,
      pointsPerGame: standing.points / gamesPlayed,
      cleanSheetRate: Math.exp(-(standing.goalsAgainst / gamesPlayed)), // Poisson P(0 goals conceded)
      winRate: standing.won / gamesPlayed
    };
  }

  private static async analyzeRecentForm(homeTeam: string, awayTeam: string, historicalMatches?: Match[]) {
    const [homeForm, awayForm] = await Promise.all([
      dataService.getTeamForm(homeTeam, historicalMatches),
      dataService.getTeamForm(awayTeam, historicalMatches)
    ]);

    const calculateFormScore = (form: TeamForm[]) => {
      if (!form || form.length === 0) {
        // Return neutral form score when no form data available.
        // Previously this derived from ELO, which double-counted ELO's
        // contribution (25% ELO weight + 20% form weight both from ELO).
        return 0.5;
      }
      
      let score = 0;

      form.slice(0, 5).forEach((match, idx) => {
        if (match.result === 'W') score += 1 * FORM_RECENCY_WEIGHTS[idx];
        else if (match.result === 'D') score += FORM_DRAW_WEIGHT * FORM_RECENCY_WEIGHTS[idx];
      });

      return Math.max(FORM_SCORE_MIN, Math.min(FORM_SCORE_MAX, score));
    };

    const homeFormScore = calculateFormScore(homeForm);
    const awayFormScore = calculateFormScore(awayForm);
    
    const formString = (form: TeamForm[]) => {
      if (!form || form.length === 0) {
        return 'N/A'; // No form data available
      }
      return form.slice(0, 5).map(m => m.result || '?').join('');
    };

    // Calculate form-based probabilities — no home bias here as ELO already
    // accounts for home advantage via ELO_HOME_ADVANTAGE
    const homeMomentum = homeFormScore;
    const awayMomentum = awayFormScore;
    
    // Add variance based on form difference
    const formDiff = Math.abs(homeMomentum - awayMomentum);
    const drawProb = Math.max(FORM_DRAW_MIN, Math.min(FORM_DRAW_MAX, FORM_DRAW_BASE - formDiff * FORM_DRAW_SENSITIVITY));
    
    // Calculate win probabilities
    const totalMomentum = homeMomentum + awayMomentum;
    const homeWinProb = (homeMomentum / totalMomentum) * (1 - drawProb);
    const awayWinProb = (awayMomentum / totalMomentum) * (1 - drawProb);
    
    // Ensure probabilities sum to 1
    const total = homeWinProb + drawProb + awayWinProb;
    
    return {
      homeFormScore,
      awayFormScore,
      homeFormString: formString(homeForm),
      awayFormString: formString(awayForm),
      probabilities: {
        homeWin: homeWinProb / total,
        draw: drawProb / total,
        awayWin: awayWinProb / total
      }
    };
  }

  private static async analyzeHeadToHead(homeTeam: string, awayTeam: string, historicalMatches?: Match[]) {
    const matches = historicalMatches || await dataService.getMatches();

    // Only completed H2H matches — filter BEFORE slicing so we don't waste our
    // 10-match budget on scheduled/pending fixtures. Leaving pending matches in
    // previously caused every card to show "X dominates H2H (1W in last 2)":
    // for a May fixture the pair typically has played the reverse leg (one
    // result) plus the current scheduled return (no result), giving a
    // pseudo-denominator of 2 but a completed count of 1 → spurious 100% rate.
    const h2hMatches = matches.filter(m =>
      ((m.home_team === homeTeam && m.away_team === awayTeam) ||
       (m.home_team === awayTeam && m.away_team === homeTeam)) &&
      m.result !== null &&
      m.home_goals !== null &&
      m.away_goals !== null
    ).slice(0, 10); // Last 10 completed H2H matches

    if (h2hMatches.length === 0) {
      // No H2H data — use league-average home advantage (consistent with ensemble priors)
      const awayRate = (1 - DEFAULT_HOME_WIN_RATE) * 0.55; // ~0.297
      const drawRate = 1 - DEFAULT_HOME_WIN_RATE - awayRate; // ~0.263
      return {
        totalMatches: 0,
        homeWins: 0,
        awayWins: 0,
        draws: 0,
        homeWinRate: DEFAULT_HOME_WIN_RATE,
        awayWinRate: awayRate,
        probabilities: {
          homeWin: DEFAULT_HOME_WIN_RATE,
          draw: drawRate,
          awayWin: awayRate
        }
      };
    }

    let homeWins = 0, awayWins = 0, draws = 0;
    let homeGoals = 0, awayGoals = 0;

    h2hMatches.forEach(match => {
      if (match.result) {
        if (match.home_team === homeTeam) {
          if (match.result === 'H') homeWins++;
          else if (match.result === 'A') awayWins++;
          else draws++;
          
          homeGoals += match.home_goals || 0;
          awayGoals += match.away_goals || 0;
        } else {
          if (match.result === 'H') awayWins++;
          else if (match.result === 'A') homeWins++;
          else draws++;
          
          homeGoals += match.away_goals || 0;
          awayGoals += match.home_goals || 0;
        }
      }
    });

    const total = homeWins + awayWins + draws || 1;
    
    return {
      totalMatches: h2hMatches.length,
      homeWins,
      awayWins,
      draws,
      homeWinRate: homeWins / total,
      awayWinRate: awayWins / total,
      avgHomeGoals: homeGoals / h2hMatches.length,
      avgAwayGoals: awayGoals / h2hMatches.length,
      probabilities: {
        // Shrink towards uniform (1/3) to avoid overfitting small H2H samples
        homeWin: (homeWins / total) * 0.7 + 0.1,
        draw: (draws / total) * 0.7 + 0.1,
        awayWin: (awayWins / total) * 0.7 + 0.1
      }
    };
  }

  /**
   * Calculate fatigue from pre-fetched match data (backtest mode).
   * Avoids hitting dataService — derives rest days directly from the match list.
   */
  private static calculateFatigueFromMatches(
    homeTeam: string, awayTeam: string, matches: Match[], asOfDate?: Date
  ): { homeFatigue: number; awayFatigue: number } {
    const ref = asOfDate ?? new Date();
    const restDaysFor = (team: string): number => {
      const teamMatches = matches
        .filter(m => (m.home_team === team || m.away_team === team) && new Date(m.date) < ref)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (teamMatches.length === 0) return 7;
      return Math.floor((ref.getTime() - new Date(teamMatches[0].date).getTime()) / (1000 * 60 * 60 * 24));
    };
    return {
      homeFatigue: FatigueAnalyzer.getFatigueMultiplier(restDaysFor(homeTeam)),
      awayFatigue: FatigueAnalyzer.getFatigueMultiplier(restDaysFor(awayTeam))
    };
  }

  private static getStandingsProbabilities(homePosition: number, awayPosition: number) {
    if (!homePosition || !awayPosition) {
      return { homeWin: DEFAULT_HOME_WIN_RATE, draw: DEFAULT_DRAW_RATE, awayWin: 1 - DEFAULT_HOME_WIN_RATE - DEFAULT_DRAW_RATE };
    }

    const positionDiff = awayPosition - homePosition;
    
    // Convert position difference to probability
    let homeWinProb = 0.5 + (positionDiff * STANDINGS_POSITION_STEP);
    homeWinProb = Math.max(0.15, Math.min(0.85, homeWinProb));
    
    let awayWinProb = 0.5 - (positionDiff * STANDINGS_POSITION_STEP);
    awayWinProb = Math.max(0.10, Math.min(0.70, awayWinProb));
    
    const remaining = 1 - homeWinProb - awayWinProb;
    const drawProb = Math.max(0.15, Math.min(0.35, remaining));
    
    // Normalize
    const total = homeWinProb + drawProb + awayWinProb;
    
    return {
      homeWin: homeWinProb / total,
      draw: drawProb / total,
      awayWin: awayWinProb / total
    };
  }

  /**
   * Combine all sub-models into a single probability distribution.
   *
   * When an ML backend prediction is available, it joins the ensemble with its
   * own weight (ML_BACKEND_WEIGHT). The TypeScript model weights are scaled down
   * proportionally so they still sum to (1 - ML_BACKEND_WEIGHT).
   */
  private static combineModels(
    models: {
      elo: { home: number; draw: number; away: number };
      poisson: { homeWin: number; draw: number; awayWin: number };
      form: { homeWin: number; draw: number; awayWin: number };
      h2h: { homeWin: number; draw: number; awayWin: number };
      standings: { homeWin: number; draw: number; awayWin: number };
    },
    mlPrediction?: MLPrediction | null
  ) {
    // Read user-applied or default weights
    const weights = getActiveModelWeights();
    // When the ML backend is contributing, scale TS weights down proportionally
    const tsScale = mlPrediction ? (1 - ML_BACKEND_WEIGHT) : 1;

    const homeWin =
      models.elo.home * weights.elo * tsScale +
      models.poisson.homeWin * weights.poisson * tsScale +
      models.form.homeWin * weights.form * tsScale +
      models.h2h.homeWin * weights.h2h * tsScale +
      models.standings.homeWin * weights.standings * tsScale +
      (mlPrediction ? mlPrediction.prediction.home * ML_BACKEND_WEIGHT : 0);

    const draw =
      models.elo.draw * weights.elo * tsScale +
      models.poisson.draw * weights.poisson * tsScale +
      models.form.draw * weights.form * tsScale +
      models.h2h.draw * weights.h2h * tsScale +
      models.standings.draw * weights.standings * tsScale +
      (mlPrediction ? mlPrediction.prediction.draw * ML_BACKEND_WEIGHT : 0);

    const awayWin =
      models.elo.away * weights.elo * tsScale +
      models.poisson.awayWin * weights.poisson * tsScale +
      models.form.awayWin * weights.form * tsScale +
      models.h2h.awayWin * weights.h2h * tsScale +
      models.standings.awayWin * weights.standings * tsScale +
      (mlPrediction ? mlPrediction.prediction.away * ML_BACKEND_WEIGHT : 0);

    // Normalise to ensure sum equals 1 — guard against all-zero edge case
    const total = homeWin + draw + awayWin;

    if (total === 0) {
      return { homeWin: DEFAULT_HOME_WIN_RATE, draw: DEFAULT_DRAW_RATE, awayWin: 1 - DEFAULT_HOME_WIN_RATE - DEFAULT_DRAW_RATE };
    }

    return {
      homeWin: homeWin / total,
      draw: draw / total,
      awayWin: awayWin / total
    };
  }

  private static determinePrediction(probabilities: { homeWin: number; draw: number; awayWin: number }) {
    const { homeWin, draw, awayWin } = probabilities;
    
    if (homeWin > draw && homeWin > awayWin) {
      return { result: 'H' as const, probability: homeWin };
    } else if (awayWin > draw && awayWin > homeWin) {
      return { result: 'A' as const, probability: awayWin };
    } else {
      return { result: 'D' as const, probability: draw };
    }
  }

  /**
   * Determine which outcome a model predicts from its three probabilities.
   */
  private static getTopOutcome(home: number, draw: number, away: number): 'H' | 'D' | 'A' {
    if (home > draw && home > away) return 'H';
    if (away > draw && away > home) return 'A';
    return 'D';
  }

  private static calculateConfidence(
    probabilities: { homeWin: number; draw: number; awayWin: number },
    predictedResult: 'H' | 'D' | 'A',
    fatigueFactor: { homeFatigue: number; awayFatigue: number },
    modelsDisagree: boolean = false
  ): number {
    const probs = Object.values(probabilities);
    const sorted = [...probs].sort((a, b) => b - a); // Non-mutating sort
    const maxProb = sorted[0];
    const secondProb = sorted[1];

    // Confidence based on probability gap between top two outcomes
    const probDifference = maxProb - secondProb;

    // Base confidence from the predicted outcome's probability
    let confidence = maxProb;

    // Boost confidence if there's a clear favourite
    if (probDifference > CONFIDENCE_BOOST_THRESHOLD) {
      confidence += CONFIDENCE_BOOST_AMOUNT;
    } else if (probDifference < CONFIDENCE_PENALTY_THRESHOLD) {
      confidence -= CONFIDENCE_PENALTY_AMOUNT;
    }

    // Penalise when key models (ELO & Poisson) disagree on the outcome
    if (modelsDisagree) {
      confidence -= MODEL_DISAGREEMENT_PENALTY;
    }

    // Apply fatigue adjustment — uncertain when teams are tired
    const avgFatigue = (fatigueFactor.homeFatigue + fatigueFactor.awayFatigue) / 2;
    confidence *= avgFatigue;

    return Math.max(CONFIDENCE_MIN, Math.min(CONFIDENCE_MAX, confidence));
  }

  private static predictGoals(
    scoreProbabilities: { [score: string]: number },
    predictedResult: 'H' | 'D' | 'A',
    formAnalysis: FormAnalysis,
    h2hAnalysis: H2HAnalysis
  ): { home: number; away: number } {
    // Start from the rounded expected-goals from the grid. Argmax-of-H-wins
    // was ~honest but systematically under-surfaced 3+ goal scorelines: at
    // PL-typical λ≈2.3 for strong favourites, P(2-0) narrowly beats P(3-0)
    // every time, so Arsenal/City vs-weak-team predictions never showed 3-1.
    // Rounded expected goals reflects blowout favouritism naturally (λ_h=2.5
    // → 3 goals displayed) AND matches how users reason about predictions.
    // Fatigue + stats-pack lambdas are now healthy enough that Math.round
    // doesn't overshoot the way it did pre-fatigue-fix (λ≈0.3 days).
    let expectedHomeGoals = 0;
    let expectedAwayGoals = 0;
    for (const [score, prob] of Object.entries(scoreProbabilities)) {
      const parts = score.split('-');
      const h = Number(parts[0]);
      const a = Number(parts[1]);
      if (!Number.isFinite(h) || !Number.isFinite(a)) continue;
      expectedHomeGoals += h * prob;
      expectedAwayGoals += a * prob;
    }
    let homeGoals = Math.min(MAX_PREDICTED_GOALS, Math.round(expectedHomeGoals));
    let awayGoals = Math.min(MAX_PREDICTED_GOALS, Math.round(expectedAwayGoals));

    // Enforce predictedResult: rounded means can produce a draw scoreline
    // even when the ensemble's H/D/A says "Home wins" (e.g. λ_h=1.5, λ_a=1.2
    // rounds to 2-1 which happens to be H already; but λ_h=1.3, λ_a=1.4
    // rounds to 1-1 while ensemble may have called A). If the rounded pick
    // disagrees with predictedResult, bump the favoured team by +1. This is
    // a valid Poisson cell — real grid mass always exists at (roundHome+1,
    // roundAway) when λ_h > 0.
    if (predictedResult === 'H' && homeGoals <= awayGoals) {
      homeGoals = Math.min(MAX_PREDICTED_GOALS, awayGoals + 1);
    } else if (predictedResult === 'A' && awayGoals <= homeGoals) {
      awayGoals = Math.min(MAX_PREDICTED_GOALS, homeGoals + 1);
    } else if (predictedResult === 'D' && homeGoals !== awayGoals) {
      // Make it a draw — use the higher of the two rounded means so we don't
      // collapse high-scoring draws (e.g. 2-3 expected) down to 1-1.
      const target = Math.max(homeGoals, awayGoals);
      homeGoals = target;
      awayGoals = target;
    }

    // H2H fixture-type nudge: keep or lightly adjust the result-consistent
    // modal by the historical goal tempo of this fixture. Only nudges by at
    // most one goal per side, and only when the unadjusted score is out of
    // character with the fixture's known tendency.
    if (h2hAnalysis.totalMatches > 0 && h2hAnalysis.avgHomeGoals !== undefined && h2hAnalysis.avgAwayGoals !== undefined) {
      const h2hTotal = h2hAnalysis.avgHomeGoals + h2hAnalysis.avgAwayGoals;
      if (h2hTotal < 2.0) {
        homeGoals = Math.min(homeGoals, 2);
        awayGoals = Math.min(awayGoals, 2);
      } else if (h2hTotal > 3.5) {
        if (homeGoals + awayGoals < 3) {
          homeGoals = Math.max(homeGoals, 2);
          awayGoals = Math.max(awayGoals, 1);
        }
      }
    }

    return {
      home: Math.max(0, homeGoals),
      away: Math.max(0, awayGoals)
    };
  }

  private static calculateValueOdds(probabilities: { homeWin: number; draw: number; awayWin: number }) {
    // Convert probabilities to decimal odds with bookmaker margin
    return {
      home: probabilities.homeWin > 0 ? (1 / probabilities.homeWin) * VALUE_ODDS_MARGIN : 10.0,
      draw: probabilities.draw > 0 ? (1 / probabilities.draw) * VALUE_ODDS_MARGIN : 4.0,
      away: probabilities.awayWin > 0 ? (1 / probabilities.awayWin) * VALUE_ODDS_MARGIN : 10.0
    };
  }
}