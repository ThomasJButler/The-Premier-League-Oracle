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
