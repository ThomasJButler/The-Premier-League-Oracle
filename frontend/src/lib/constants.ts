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
