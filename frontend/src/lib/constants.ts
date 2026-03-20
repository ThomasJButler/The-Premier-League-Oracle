/**
 * Shared constants across the prediction and betting modules.
 *
 * VALUE_ODDS_MARGIN represents the typical bookmaker overround applied
 * when converting model probabilities to implied odds. A value of 1.05
 * means the bookmaker takes a 5% margin. Used in:
 * - advancedPredictions.ts (AdvancedMatchPredictor.predictMatch)
 * - optimizedPredictions.ts (OptimizedPredictor.calculateValueOdds)
 * - backtest.ts (extractProbabilities)
 */
export const VALUE_ODDS_MARGIN = 1.05;

/**
 * DEFAULT_HOME_WIN_RATE is the fallback proportion of matches won by the
 * home side when no completed match data is available. Derived from
 * long-term Premier League averages (~46%).
 *
 * In production, `computeLeagueAverages().homeWinRate` dynamically computes
 * this from actual completed matches. This constant is only used as a
 * safe fallback when the match list is empty. Used in:
 * - optimizedPredictions.ts (computeLeagueAverages fallback)
 * - advancedPredictions.ts (RefereeAnalyzer.getStats fallback)
 */
export const DEFAULT_HOME_WIN_RATE = 0.46;

/**
 * DEFAULT_DRAW_RATE is the fallback proportion of matches ending in a draw
 * when no completed match data is available. Derived from long-term Premier
 * League averages (~27%).
 *
 * Used as a fallback in:
 * - optimizedPredictions.ts (getStandingsProbabilities, combineModels zero-guard)
 */
export const DEFAULT_DRAW_RATE = 0.27;

/**
 * AI_MODELS defines the models available in the Settings dropdown.
 * The server-side allowlist in api/chat.ts and vite.config.ts must match.
 * Provider is detected from the model ID: claude-* → Anthropic, gpt-* → OpenAI.
 */
export const AI_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (fastest, cheapest)' },
  { id: 'gpt-4o', label: 'GPT-4o (balanced)' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo (powerful)' },
  { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (fastest, cheapest)' },
  { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet (balanced)' },
  { id: 'claude-3-opus-latest', label: 'Claude 3 Opus (powerful)' },
] as const;

/** Determine the API provider from a model ID. */
export function getModelProvider(modelId: string): 'openai' | 'anthropic' {
  return modelId.startsWith('claude') ? 'anthropic' : 'openai';
}

/**
 * PREMIER_LEAGUE_GAMEWEEKS — the Premier League always has 38 matchdays
 * (20 teams × 2 = 38 rounds). Structurally fixed by the competition format.
 * Used in Predictions gameweek selector and SeasonTimeline progress display.
 */
export const PREMIER_LEAGUE_GAMEWEEKS = 38;

// ─────────────────────────────────────────────────────────────────────────────
// Prediction model configuration
//
// These constants control the ensemble prediction engine in optimizedPredictions.ts.
// Extracting them here makes tuning parameters visible in one place and documents
// their derivations. All values affect prediction quality; adjust with care.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ELO draw probability formula parameters.
 *
 * The draw probability from the ELO model is:
 *   P(draw) = BASE_DRAW_RATE × exp(-|ratingDiff| / ELO_DRAW_SCALE)
 *
 * BASE_DRAW_RATE (0.265) — long-term Premier League average draw rate (~26.5%),
 * derived from 2000-2024 PL data. This is the draw probability when two
 * equally-rated teams meet.
 *
 * ELO_DRAW_SCALE (600) — controls how quickly draw probability falls as the
 * rating gap widens. Larger values = draws remain likely even for mismatches.
 * 600 was chosen so that a 200-point gap (e.g. Man City vs mid-table) yields
 * ~19% draw probability, matching observed PL frequencies.
 *
 * Result is clamped to [ELO_DRAW_MIN, ELO_DRAW_MAX] to prevent extreme values.
 */
export const ELO_DRAW_BASE_RATE = 0.265;
export const ELO_DRAW_SCALE = 600;
export const ELO_DRAW_MIN = 0.10;
export const ELO_DRAW_MAX = 0.35;

/**
 * Poisson model bounds.
 *
 * Lambda (expected goals) is clamped to [POISSON_LAMBDA_MIN, POISSON_LAMBDA_MAX]
 * to prevent degenerate predictions. A team can't realistically average fewer
 * than 0.3 or more than 4.5 goals per match over a season.
 *
 * POISSON_FALLBACK_AVG_GOALS (1.35) — used when no completed matches exist
 * and league averages can't be computed. Derived from the midpoint of typical
 * PL home (1.5) and away (1.2) averages.
 */
export const POISSON_LAMBDA_MIN = 0.3;
export const POISSON_LAMBDA_MAX = 4.5;
export const POISSON_FALLBACK_HOME_GOALS = 1.5;
export const POISSON_FALLBACK_AWAY_GOALS = 1.2;
export const POISSON_FALLBACK_AVG_GOALS = 1.35;

/**
 * Form recency weights — how much weight each of the last 5 matches gets.
 *
 * Most recent match = 35%, second = 25%, third = 20%, fourth = 12%, fifth = 8%.
 * Sums to 1.0. Decay is steeper than geometric because recent PL form is
 * disproportionately predictive (a team that won their last 2 is more likely
 * to win than one that won 3 of their last 5 but lost the most recent 2).
 *
 * FORM_DRAW_WEIGHT (0.33) — fraction of a win's value awarded for draws when
 * computing form score. Draws contribute ~1/3 of a win's momentum.
 */
export const FORM_RECENCY_WEIGHTS = [0.35, 0.25, 0.20, 0.12, 0.08] as const;
export const FORM_DRAW_WEIGHT = 0.33;
export const FORM_SCORE_MIN = 0.1;
export const FORM_SCORE_MAX = 0.9;

/** Thresholds for form-based insights ("excellent form" / "struggling"). */
export const FORM_EXCELLENT_THRESHOLD = 0.7;
export const FORM_POOR_THRESHOLD = 0.3;

/**
 * Form-derived draw probability parameters.
 *
 * When two teams have similar form, draws are more likely. The draw probability
 * from the form model is: clamp(FORM_DRAW_BASE - formDiff × FORM_DRAW_SENSITIVITY)
 * bounded by [FORM_DRAW_MIN, FORM_DRAW_MAX].
 */
export const FORM_DRAW_BASE = 0.25;
export const FORM_DRAW_SENSITIVITY = 0.3;
export const FORM_DRAW_MIN = 0.15;
export const FORM_DRAW_MAX = 0.35;

/**
 * Standings-derived probability parameters.
 *
 * STANDINGS_POSITION_STEP (0.025) — each league position difference adds 2.5%
 * to the higher-placed team's win probability. A 10-place gap thus means ~25%
 * advantage on top of the 50% base.
 */
export const STANDINGS_POSITION_STEP = 0.025;

/**
 * Confidence calculation parameters.
 *
 * CONFIDENCE_MIN/MAX — hard bounds on confidence output. Even the most one-sided
 * fixture shouldn't produce 100% confidence, and no prediction should be below 25%.
 *
 * CONFIDENCE_BOOST_THRESHOLD — if the gap between the top two outcome probabilities
 * exceeds this, confidence gets a +10% boost (clear favourite).
 * CONFIDENCE_PENALTY_THRESHOLD — if the gap is below this, confidence gets a −10%
 * penalty (too close to call).
 *
 * MODEL_DISAGREEMENT_PENALTY — confidence drops 8% when ELO and Poisson predict
 * different outcomes, signalling genuine uncertainty.
 */
export const CONFIDENCE_MIN = 0.25;
export const CONFIDENCE_MAX = 0.95;
export const CONFIDENCE_BOOST_THRESHOLD = 0.2;
export const CONFIDENCE_BOOST_AMOUNT = 0.1;
export const CONFIDENCE_PENALTY_THRESHOLD = 0.1;
export const CONFIDENCE_PENALTY_AMOUNT = 0.1;
export const MODEL_DISAGREEMENT_PENALTY = 0.08;

/**
 * ML backend confidence adjustment.
 *
 * When the Python ML backend contributes to the ensemble, agreement with the
 * TS ensemble boosts confidence, disagreement penalises it. These cap the
 * magnitude of the adjustment.
 */
export const ML_AGREEMENT_BOOST_MAX = 0.08;
export const ML_AGREEMENT_BOOST_FACTOR = 0.1;
export const ML_DISAGREEMENT_PENALTY_MAX = 0.10;
export const ML_DISAGREEMENT_PENALTY_FACTOR = 0.12;

/**
 * Referee adjustment bounds.
 *
 * The referee model nudges home/away probabilities by the referee's historical
 * home win bias. Clamped to ±3% to prevent a single referee from dominating
 * the prediction. Adjustments below 0.5% are ignored (noise threshold).
 */
export const REFEREE_ADJUSTMENT_MAX = 0.03;
export const REFEREE_ADJUSTMENT_THRESHOLD = 0.005;

export const DEFAULT_AI_MODEL = 'gpt-4o-mini';
export const AI_MODEL_STORAGE_KEY = 'oracle_ai_model';

/** Read the user's saved model preference from localStorage. */
export function getSavedAiModel(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_AI_MODEL;
  return localStorage.getItem(AI_MODEL_STORAGE_KEY) || DEFAULT_AI_MODEL;
}
