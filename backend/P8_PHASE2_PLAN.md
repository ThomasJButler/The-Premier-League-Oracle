# P8 Phase 2 — Prediction Engine + Betting UI

> Phase 1 complete: draw calibration fix, Optuna tuning, --no-odds flag, feature interactions.
> This document covers everything remaining in P8.

---

## A5. Dedicated Draw Model (+0.5–1.5%)

**Files:** `backend/train_free_tier.py`

### What

A binary XGBoost classifier specifically for "Draw vs Not-Draw" that cascades with the main 3-class model:

```
Input → Draw classifier: P(draw) > threshold? → Yes → Predict Draw
                                                → No  → Use main 3-class model for H/A
```

### How

1. New function `train_draw_classifier()` in `train_free_tier.py`
2. Uses the 13 draw indicator features + 5 interaction features + ELO features as primary inputs
3. Separate hyperparameter tuning (shallower trees, higher regularisation — draws need conservative models)
4. Threshold tuned via cross-validation to maximise draw F1 without destroying overall accuracy
5. Saved as `backend/models/xgboost_draw_model.joblib`

### Integration

- If draw_model P(draw) > 0.30 AND main model's draw prob is in top 2 → predict draw
- Otherwise → use main model
- Store draw threshold in saved model metadata for inference

---

## A6. Orthogonalise Form from ELO (+0.3–0.5%)

**Files:** `backend/app/features/free_tier_features.py`, `frontend/src/lib/optimizedPredictions.ts`

### Problem

ELO (25% weight) and form (20% weight) both measure team quality. When a team wins, both improve — the ensemble partially double-counts.

### Backend Fix

Add 2 features to `free_tier_features.py`:
```python
features['home_form_vs_elo'] = home_form_normalised - elo_expected_home
features['away_form_vs_elo'] = away_form_normalised - (1 - elo_expected_home)
```

Positive = outperforming ELO expectation (hot streak). Negative = underperforming (cold streak).

### Frontend Fix

In `optimizedPredictions.ts analyzeRecentForm()`:
- Compute `formResidual = actualFormScore - eloExpectedScore`
- Use `formResidual` in the form model instead of raw form score
- This isolates "recent momentum" from "overall quality"

---

## B1. Rename "Value Bets" → "Value Scanner"

**Files to update:**
- `frontend/src/components/betting/ValueBets.svelte` — rename file and internal text
- `frontend/src/components/SidebarNav.svelte` — nav item name
- `frontend/src/components/MobileNav.svelte` — nav item name
- `frontend/src/components/App.svelte` — view routing (`'Value Bets'` → `'Value Scanner'`)
- `frontend/src/services/betting/value.ts` — any display strings
- Test files: `ValueBets.test.ts`, `SidebarNav.test.ts`, `MobileNav.test.ts`

The view name changes but the underlying `value.ts` service stays the same.

---

## B2. Extract "Suggested Bets" into Own Page

### Current State

"Suggested Bets" lives inside `KellyCalculator.svelte` as a section at the top. It:
- Auto-generates bet suggestions from upcoming match predictions
- Has a confidence slider (Min. Confidence)
- Shows matches with predicted edges, Kelly stakes, and "Track Bet" buttons
- Uses the Kelly bankroll input for stake calculations

### New Architecture

1. **Create `SuggestedBets.svelte`** — standalone page component
   - Move the suggested bets section from KellyCalculator.svelte
   - Read/write bankroll from shared localStorage key (`kelly_bankroll`)
   - Import prediction data from `dataService` and `predictionTracker`
   - Import Kelly calculation from `services/betting/kelly.ts`
   - Keep the confidence slider, bet cards, Track Bet functionality

2. **Simplify `KellyCalculator.svelte`** — pure manual calculator
   - Keep: bankroll input, manual odds/probability entry, stake output
   - Remove: suggested bets section
   - The bankroll value persists to `kelly_bankroll` in localStorage (shared)

3. **Shared bankroll** — both components read/write the same localStorage key
   - Changing bankroll in either page updates the other when navigated to
   - Consider dispatching a custom event (`bankroll-changed`) for live sync

### Data Flow

```
SuggestedBets.svelte
├── Reads predictions from predictionTracker/dataService
├── Reads bankroll from localStorage ('kelly_bankroll')
├── Calculates Kelly stakes using kelly.ts
├── Displays bet suggestions with confidence filter
└── Track Bet → writes to betHistoryService

KellyCalculator.svelte
├── Reads/writes bankroll to localStorage ('kelly_bankroll')
├── Manual odds + probability input
├── Calculates Kelly stake
└── No suggested bets section
```

---

## B3. Update Navigation

### SidebarNav.svelte

Betting section (currently 4 items) → 5 items:
```
Kelly Calculator  (existing)
Suggested Bets    (NEW — icon: Zap or Sparkles)
Value Scanner     (renamed from Value Bets)
Accumulators      (existing)
Betting History   (existing)
```

### MobileNav.svelte

Add "Suggested Bets" to `moreItems` array (now 12 items).

### App.svelte

Add routing for `'Suggested Bets'` view → `SuggestedBets.svelte` component.

---

## Implementation Order

1. A5 — Dedicated draw model (backend only)
2. A6 — Form orthogonalisation (backend + frontend)
3. B1 — Value Scanner rename (frontend, quick)
4. B2 — Suggested Bets extraction (frontend, largest piece)
5. B3 — Navigation updates (frontend, follows B1+B2)

---

## Test Updates Required

- Update feature count tests (if A6 adds features)
- Update SidebarNav.test.ts, MobileNav.test.ts for B1+B3 nav changes
- Create SuggestedBets.test.ts for B2
- Update KellyCalculator.test.ts (remove suggested bets tests, or move them)
- Update App routing tests if they exist
- Update IMPLEMENTATION_PLAN.md with P8 items + new test counts

---

*Created: 21 March 2026*
