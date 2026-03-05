# Spec 06: Prediction Tracking

**JTBD: Record every prediction made, automatically resolve outcomes against real results, and display real accuracy metrics**

---

## Current State

| Location | Problem |
|----------|---------|
| `frontend/src/services/dataService.ts` — `getPredictionAccuracy()` | Returns `{total: 100, correct: 65, accuracy: 0.65}` hardcoded — always |
| `frontend/src/services/predictionTracker.ts` | Fully implemented but rarely called |
| `frontend/src/services/predictionPersistence.ts` | Supabase-based — **removed** |
| `frontend/src/components/Dashboard.svelte` | `overallAccuracy`, `profitMargin`, `totalPredictions`, `betsPlaced` fed by stubs |

---

## Single Source of Truth: PredictionTracker

`frontend/src/services/predictionTracker.ts` is **the only prediction persistence layer**. It uses localStorage. No Supabase.

The `predictionPersistence.ts` file has already been deleted. All code that previously called it should call `predictionTracker` instead.

---

## Requirement 1: Replace the Hardcoded Accuracy Stub

In `frontend/src/services/dataService.ts`, the method `getPredictionAccuracy()` must call the real tracker:

```typescript
getPredictionAccuracy() {
  return predictionTracker.getAccuracyStats()
}
```

`predictionTracker.getAccuracyStats()` returns real data from localStorage. This single change propagates through to the Dashboard and all accuracy displays.

---

## Requirement 2: Auto-Reconciliation on Startup

When the DataService loads completed match results, it should automatically resolve any pending predictions.

**Add to `dataService.ts` — reconciliation logic:**

```typescript
async reconcilePredictions(completedMatches: Match[]): Promise<void> {
  const pending = predictionTracker.getPendingPredictions()

  for (const prediction of pending) {
    const match = completedMatches.find(m =>
      m.id === prediction.matchId &&
      m.status === 'FINISHED'
    )

    if (match && match.score) {
      const homeGoals = match.score.fullTime.home
      const awayGoals = match.score.fullTime.away
      const actualResult = homeGoals > awayGoals ? 'H' :
                          awayGoals > homeGoals ? 'A' : 'D'

      predictionTracker.updateWithResult(
        prediction.matchId,
        actualResult,
        homeGoals,
        awayGoals
      )
    }
  }
}
```

Call `reconcilePredictions()` every time `getMatches(status: 'FINISHED')` returns new data.

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

- [ ] `getPredictionAccuracy()` in dataService returns real data from PredictionTracker
- [ ] `reconcilePredictions()` runs on match result load and auto-resolves pending predictions
- [ ] Dashboard stats (`overallAccuracy`, `totalPredictions`, `profitMargin`, `betsPlaced`) use real values
- [ ] Accuracy breakdown panel in Predictions component (per-outcome and per-confidence)
- [ ] Gameweek accuracy stored and charted over time
- [ ] Every generated prediction is stored via `predictionTracker.storePrediction()`
- [ ] No hardcoded accuracy values anywhere in the codebase
