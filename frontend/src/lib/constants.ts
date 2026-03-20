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
 * AI_MODELS defines the OpenAI models available in the Settings dropdown.
 * The server-side allowlist in api/chat.ts and vite.config.ts must match.
 */
export const AI_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (fastest, cheapest)' },
  { id: 'gpt-4o', label: 'GPT-4o (balanced)' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo (powerful)' },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (legacy)' },
] as const;

export const DEFAULT_AI_MODEL = 'gpt-4o-mini';
export const AI_MODEL_STORAGE_KEY = 'oracle_ai_model';

/** Read the user's saved model preference from localStorage. */
export function getSavedAiModel(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_AI_MODEL;
  return localStorage.getItem(AI_MODEL_STORAGE_KEY) || DEFAULT_AI_MODEL;
}
