/**
 * The app's prediction contract — served by the Butler model.
 *
 * This module once held a 1,200-line five-heuristic ensemble (ELO, ratio-
 * Poisson, form, H2H, standings, probability-averaged). It was replaced by
 * the Butler model (lib/engine/ + lib/butlerFacade.ts) on 2026-07-15 after
 * the walk-forward gate showed the Butler method beating it on every proper
 * score over 2018–2025 (RPS 0.2000 vs 0.2062, Brier 0.5719 vs 0.5846,
 * log-loss 0.9648 vs 0.9843; per-season table in backtest/results/).
 * The old ensemble's final measurements remain frozen in backtest/pins.json
 * as the permanent benchmark the Butler model must keep beating in CI.
 *
 * Legacy names are preserved so consumers (bulkPersist, adapters/v3,
 * defaultPorts, fixtures/[id]) keep importing from this path.
 */

export { ButlerPredictor as OptimizedPredictor } from './butlerFacade';
export type {
  ButlerPredictionModel as EnhancedPredictionModel,
  ButlerModelOutputs as ModelOutputs,
} from './butlerFacade';
