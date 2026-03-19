# Spec 01: Prediction Engine

**JTBD: Deliver accurate match outcome predictions using a multi-model statistical ensemble**

Target: 72–75% prediction accuracy across a full Premier League season.

---

## Current Implementation Status (as of March 2026)

The following items from this spec have been **partially or fully implemented**:

- **ELO Rating System (Req 1):** DONE. `EloRatingSystem` persists to/loads from localStorage (`elo_ratings` key). `updateRatings()` instance method updates ratings in memory + localStorage. `processCompletedMatches()` batch-processes finished matches idempotently. **Wired:** `sharedEloSystem.processCompletedMatches(completedMatches)` is called from `dataService.reconcilePredictions()` — ELO ratings auto-update whenever match results are reconciled. The seed ratings use canonical Football-Data.org names with an extensive alias map for fuzzy matching.
- **Fatigue Analysis (Req 3):** FIXED. `calculateFixtureDifficulty()` no longer returns hardcoded `1500`. It now accepts an optional `EloRatingSystem` parameter, fetches matches in the date range from `dataService.getMatches()`, looks up opponent ELO ratings, and returns the average opponent rating. Returns `0` when no matches are found.
- **Referee Analysis (Req 4):** IMPLEMENTED. `RefereeAnalyzer.getRefereeStats()` is called by `OptimizedPredictor.predictMatch()` when a referee name is provided. It applies a clamped +-3% adjustment to home/away probabilities based on the referee's historical home win rate vs the league average (0.46). Insights are added to the prediction output.
- **Confidence Calculation (Req 5):** DONE. `OptimizedPredictor` detects ensemble disagreement between ELO and Poisson top outcomes and lowers confidence when they disagree. `getCalibrationFactors()` in `predictionTracker.ts` adjusts confidence based on per-band historical accuracy.
- **AI-Assisted Analysis (Req 6):** DONE. `frontend/src/services/aiAnalysis.ts` exists with `AIAnalysisService` class. Configurable in Settings (enable/disable, API key entry). Responses cached 24 hours per match.

All items from this spec are now **fully implemented**. See acceptance criteria below.

---

## Current State

The prediction engine lives in `frontend/src/lib/`. Two files are in play:

| File | Purpose |
|------|---------|
| `advancedPredictions.ts` | Statistical model classes (ELO, Poisson, xG, Fatigue, Referee) |
| `optimizedPredictions.ts` | Weighted ensemble orchestrator — the production model |
| `betBuilder.ts` | Multi-market prediction generator (BTTS, O/U, corners, cards) |

The `OptimizedPredictor` in `optimizedPredictions.ts` is the model used by the UI. It combines:

```
ELO:        25%
Poisson:    30%
Form:       20%
H2H:        10%
Standings:  15%
```

---

## Requirements

### 1. ELO Rating System (Priority: High) — DONE

**Current state:** `EloRatingSystem` loads persisted ratings from localStorage (`elo_ratings` key) on construction, falling back to seed ratings for first run. `updateRatings()` works correctly as an instance method with fuzzy name resolution (extensive alias map + partial matching). `processCompletedMatches()` batch-processes finished matches idempotently (tracks processed match IDs in localStorage). `saveToStorage()` persists after updates. The shared instance `sharedEloSystem` is used by both `AdvancedMatchPredictor` and `OptimizedPredictor`.

**Wiring complete:** `dataService.reconcilePredictions()` calls `sharedEloSystem.processCompletedMatches(completedMatches)` — ELO ratings auto-update whenever match results are loaded and reconciled.

**Implementation note:** `EloRatingSystem` has extensive fuzzy name matching via `resolveTeamName()` — aliases, case-insensitive lookup, and partial match against existing keys.

---

### 2. Poisson Distribution (Priority: High) — IMPLEMENTED

**Current state:** `AdvancedMatchPredictor.predictMatch()` now calls `dataService.getTeamStats()` for both teams and applies the Dixon-Coles per-team formula:
- λ_home = (home avg goals scored at home × away avg goals conceded away) / league avg goals per game
- λ_away = (away avg goals scored away × home avg goals conceded at home) / league avg goals per game
- Requires ≥3 home/away matches per team; falls back to ELO-exponent estimate when data is insufficient
- Fatigue adjustment applied after lambda calculation (clamps to 0.3–4.5 range)
- `OptimizedPredictor` already had a full Dixon-Coles implementation via `computeLeagueAverages()` — both callers now use per-team strengths
- Maximum goals capped at 7 per team (already fixed)

---

### 3. Fatigue Analysis (Priority: Medium) — IMPLEMENTED

**Current state:** `FatigueAnalyzer.calculateFixtureDifficulty()` no longer returns hardcoded `1500`. It now accepts `(teamName, startDate, endDate, eloSystem?)`, fetches matches in the date range from `dataService.getMatches()`, identifies opponents, and looks up their ELO ratings to compute average opponent difficulty. Returns `0` when no matches found in range. `getFatigueMultiplier(restDays)` is unchanged and correct.

Fatigue is fully wired into both `AdvancedMatchPredictor.predictMatch()` and `OptimizedPredictor.calculateFatigueFromMatches()`.

---

### 4. Referee Analysis (Priority: Low-Medium) — IMPLEMENTED

**Current state:** `RefereeAnalyzer.getRefereeStats()` IS used in the final prediction. `OptimizedPredictor.predictMatch()` calls it when a referee name is provided, calculates the home win bias vs league average (0.46), clamps the adjustment to +-3%, applies it to home/away probabilities, re-normalises, and adds an insight string (e.g. "Referee Michael Oliver favours home (52% home win rate vs 46% avg)").

Referee adjustments appear as text in the key factors/insights list within the Predictions component.

---

### 5. Confidence Calculation (Priority: Medium) — DONE

**Current problem:** `calculateConfidence()` in `OptimizedPredictor` uses a simple probability gap formula. It clamps to 25%–95%.

**Required behaviour:**
- Incorporate ensemble disagreement: if ELO and Poisson strongly disagree, lower confidence
- Add a `calibration` component: track historical accuracy by confidence band and adjust
- For example: if 80% confidence predictions historically achieve 72% accuracy, the calibration factor is 0.9
- Confidence should reflect both the model's certainty and historical calibration

---

### 6. AI-Assisted Analysis (Priority: Medium) — DONE

**New requirement:** Integrate GPT-5 (OpenAI) and/or Claude (Anthropic) for qualitative match analysis to supplement the statistical models.

**Required behaviour:**
- Create `frontend/src/services/aiAnalysis.ts` with an `AIAnalysisService` class
- Takes a `MatchPrediction` object and returns a natural language analysis string
- Covers: injury/suspension context, managerial factors, derby intensity, recent form narrative, weather/pitch conditions
- Configurable in Settings: users can enable/disable AI analysis and enter their own API key (OpenAI or Anthropic)
- AI analysis is a supplementary display feature — it does NOT modify the numerical prediction probabilities
- API key stored in localStorage as `openai_api_key` or `anthropic_api_key`
- Rate-limit aware: cache AI analysis responses for 24 hours per match to avoid API costs

---

### 7. Ensemble Backtesting (Priority: Medium) — DONE

**Implemented:** `frontend/src/lib/backtest.ts` contains a `BacktestRunner` class.

**What it does:**
- Takes an array of completed matches and runs each through the ensemble as if it were upcoming
- Compares predicted vs actual result and accumulates accuracy metrics
- Reports: overall accuracy %, per-outcome accuracy (Home/Draw/Away), log loss score, Brier score
- Accessible from the Predictions view — "Run Backtest" panel
- Performance optimised: 0 `dataService` calls per match when `historicalMatches` provided (was 6 per match)

---

### 8. Model Weights — Tuning Guide — DONE

The ensemble weights should be adjustable for backtesting. Current defaults:

| Model | Weight | Notes |
|-------|--------|-------|
| ELO | 25% | Increase when team form is volatile |
| Poisson | 30% | Best for goal count prediction |
| Form | 20% | Weight recency via `[0.35, 0.25, 0.20, 0.12, 0.08]` |
| H2H | 10% | Reduce for newly-promoted teams with no H2H history |
| Standings | 15% | Increase mid-season when table is established |

Ralph should run backtests with ±5% weight variations to optimise these values empirically.

---

## Acceptance Criteria

- [x] ELO ratings update from real match results and persist across sessions (persistence done; auto-update wired via `dataService.reconcilePredictions()` → `sharedEloSystem.processCompletedMatches()`)
- [x] Poisson lambda derived from real team stats, not hardcoded averages (`AdvancedMatchPredictor` uses `dataService.getTeamStats()` with Dixon-Coles formula; `OptimizedPredictor` uses `computeLeagueAverages()` inline — both use per-team attack/defence strengths)
- [x] Fatigue multiplier uses real ELO opponent ratings (via `calculateFixtureDifficulty` with `eloSystem` param)
- [x] Referee adjustments applied when referee name is available (via `OptimizedPredictor.predictMatch`)
- [x] Confidence reflects both model certainty and historical calibration — ensemble disagreement lowers confidence; `getCalibrationFactors()` in predictionTracker adjusts based on per-band historical accuracy
- [x] AI analysis available as a configurable feature in Settings (`aiAnalysis.ts` created, wired into Settings)
- [x] Backtest runner produces accuracy metrics for historical seasons (`frontend/src/lib/backtest.ts` — `BacktestRunner` class with accuracy, log loss, Brier score)
- [x] All prediction unit tests pass (`npm run test:run`)
