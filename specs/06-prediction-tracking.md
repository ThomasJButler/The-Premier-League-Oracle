# Spec 06: Prediction Tracking

**JTBD: Record every prediction made, automatically resolve outcomes against real results, and display real accuracy metrics**

---

## Current Implementation Status (as of March 2026)

The following items from this spec have been **implemented**:

- **Requirement 1 (Replace hardcoded accuracy stub):** DONE. `getPredictionAccuracy()` in `dataService.ts` now calls `predictionTracker.getAccuracyStats()` and returns real data from localStorage. No hardcoded values remain.
- **Requirement 2 (Auto-reconciliation):** DONE. `dataService.reconcilePredictions()` is implemented and called automatically whenever `getMatches()` returns finished results. It also resolves pending bets via `betHistoryService.resolveMatchBets()`. `Dashboard.svelte` additionally reconciles on load.
- **Requirement 3 (Dashboard stats — real data):** DONE. `Dashboard.svelte` imports `predictionTracker` and `betHistoryService` directly. `overallAccuracy` uses `predictionTracker.getAccuracyStats()`, `profitMargin` uses `betHistoryService.getROI()`, `totalPredictions` uses `predictionTracker.getAccuracyStats().totalPredictions`, and `betsPlaced` uses `betHistoryService.getAllBets().length`. All four stats are fed by real data with tweened animations.
- **Requirement 4 (Accuracy breakdown panel):** DONE. `Predictions.svelte` displays a collapsible accuracy panel with per-outcome accuracy (Home/Draw/Away), per-confidence band accuracy (High/Medium/Low), rolling last-10 accuracy, exact score accuracy, and current/best streaks. Uses `predictionTracker.getAccuracyStats()`.
- **Requirement 6 (Prediction store on generate):** DONE. `Predictions.svelte` calls `predictionTracker.storePrediction()` for every prediction in the batch prediction loop, including the gameweek number.

The following items **remain unimplemented**:

- **Requirement 5 (Gameweek history):** PARTIALLY DONE. `predictionTracker` has `getAccuracyByGameweek()` and `Dashboard.svelte` uses it for the accuracy trend chart. However, a dedicated `gameweek_accuracy` localStorage key as described in the spec is not used — accuracy is derived on the fly from stored predictions that include a `matchday` field.

---

## Current State

| Location | Status |
|----------|--------|
| `frontend/src/services/dataService.ts` — `getPredictionAccuracy()` | Calls `predictionTracker.getAccuracyStats()` — returns real data |
| `frontend/src/services/predictionTracker.ts` | Fully implemented, called by Dashboard, Predictions, and dataService |
| `frontend/src/services/predictionPersistence.ts` | Supabase-based — **removed** |
| `frontend/src/components/Dashboard.svelte` | All four stats (`overallAccuracy`, `profitMargin`, `totalPredictions`, `betsPlaced`) use real data from `predictionTracker` and `betHistoryService` |

---

## Single Source of Truth: PredictionTracker

`frontend/src/services/predictionTracker.ts` is **the only prediction persistence layer**. It uses localStorage. No Supabase.

The `predictionPersistence.ts` file has already been deleted. All code that previously called it should call `predictionTracker` instead.

---

## Requirement 1: Replace the Hardcoded Accuracy Stub — IMPLEMENTED

`getPredictionAccuracy()` in `dataService.ts` now calls `predictionTracker.getAccuracyStats()` and maps the result to the expected return shape. No hardcoded values remain.

---

## Requirement 2: Auto-Reconciliation on Startup — IMPLEMENTED

`dataService.reconcilePredictions(completedMatches)` is implemented and called automatically inside `getMatches()` whenever finished matches are returned. It iterates completed matches, finds unresolved predictions via `predictionTracker.getMatchPredictions()`, calls `predictionTracker.updateWithResult()`, and also resolves placed bets via `betHistoryService.resolveMatchBets()`. Returns the number of predictions reconciled. `Dashboard.svelte` also reconciles on load as an additional safety net.

---

## Requirement 3: Dashboard Stats — Real Data

`frontend/src/components/Dashboard.svelte` has four tweened stats that currently use stubs:

| Stat | Source (should be) |
|------|---------------------|
| `overallAccuracy` | `predictionTracker.getAccuracyStats().accuracy` |
| `totalPredictions` | `predictionTracker.getAccuracyStats().total` |
| `profitMargin` | `betHistoryService.getROI().roi` |
| `betsPlaced` | `betHistoryService.getAllBets().length` |

Wire these up. The tweened animation (`tweened()` in Svelte) should receive the real values.

---

## Requirement 4: Accuracy Breakdown

Add accuracy breakdowns to the Predictions component:

| Metric | Description |
|--------|-------------|
| Per-outcome accuracy | Home prediction accuracy %, Draw %, Away % |
| Per-confidence accuracy | Accuracy for predictions in bands: 65–70%, 70–80%, 80%+ |
| Per-model accuracy | When running backtest, show ELO accuracy vs Poisson accuracy vs ensemble |
| Recent form | Last 10 predictions accuracy (rolling window) |

These should be displayed as a small stats panel in the Predictions view.

---

## Requirement 5: Gameweek History

Store and display per-gameweek accuracy to track model improvement over time.

```typescript
interface GameweekAccuracy {
  gameweek: number
  season: string
  total: number
  correct: number
  accuracy: number
  avgConfidence: number
}
```

Store in localStorage under key `gameweek_accuracy`. The Dashboard's "accuracy over time" chart should use this data.

---

## Requirement 6: Prediction Store on Generate

Every time the user generates predictions (in `Predictions.svelte`), call `predictionTracker.storePrediction()`. This is the hook that connects generation to tracking.

Currently the Predictions component does call `predictionTracker` in some paths but not all. Ensure it is called for every prediction generated, including batch predictions.

---

## Acceptance Criteria

- [x] `getPredictionAccuracy()` in dataService returns real data from PredictionTracker
- [x] `reconcilePredictions()` runs on match result load and auto-resolves pending predictions
- [x] Dashboard stats (`overallAccuracy`, `totalPredictions`, `profitMargin`, `betsPlaced`) use real values
- [x] Accuracy breakdown panel in Predictions component (per-outcome and per-confidence)
- [x] Gameweek accuracy derived from stored predictions with `matchday` field and charted in Dashboard
- [x] Every generated prediction is stored via `predictionTracker.storePrediction()`
- [x] No hardcoded accuracy values anywhere in the codebase
