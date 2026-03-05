# Spec 01: Prediction Engine

**JTBD: Deliver accurate match outcome predictions using a multi-model statistical ensemble**

Target: 72–75% prediction accuracy across a full Premier League season.

---

## Current State

The prediction engine lives in `frontend/src/lib/`. Three files are in play:

| File | Purpose |
|------|---------|
| `predictions.ts` | Original weighted model (H2H 30%, Form 25%, Stats 20%, Home 15%, Trend 10%) |
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

### 1. ELO Rating System (Priority: High)

**Current problem:** `EloRatingSystem` in `advancedPredictions.ts` initialises teams with hardcoded static ratings (e.g. Man City: 1850, Luton: 1300). The `updateRatings()` method exists but is **never called**. ELO ratings are therefore frozen and never reflect real results.

**Required behaviour:**
- On startup, load any persisted ELO ratings from localStorage (key: `elo_ratings`)
- After each completed match is loaded from the API, call `eloSystem.updateRatings(homeTeam, awayTeam, result)` to update ratings
- Persist updated ratings back to localStorage after each update
- The `dataService` should trigger ELO updates when it processes completed match results

**Implementation note:** `EloRatingSystem` has fuzzy name matching (`findTeamRating`) already — use this when mapping API team names to ELO entries.

---

### 2. Poisson Distribution (Priority: High)

**Current problem:** `PoissonPredictor` uses manually estimated lambda values. Lambda (expected goals) should be derived from each team's real attacking and defensive stats.

**Required behaviour:**
- Lambda home = `(home team avg goals scored at home) × (away team avg goals conceded away) / (league avg goals per game)`
- Lambda away = `(away team avg goals scored away) × (home team avg goals conceded at home) / (league avg goals per game)`
- Pull these stats from `dataService.getTeamStats()` rather than hardcoded averages
- Maximum goals capped at 7 per team in the score matrix (was 10 — overkill)

---

### 3. Fatigue Analysis (Priority: Medium)

**Current problem:** `FatigueAnalyzer.calculateFixtureDifficulty()` always returns `1500` (hardcoded). It is supposed to look up the ELO rating of upcoming opponents but never does.

**Required behaviour:**
- `calculateFixtureDifficulty(teamName, upcomingMatches)` must use the ELO system (requirement 1) to look up opponent ratings
- `getFatigueMultiplier(restDays, recentFixtures)` is already correct — keep it
- Wire the fatigue multiplier into `OptimizedPredictor.predictMatch()` to adjust Poisson lambda before calculation

---

### 4. Referee Analysis (Priority: Low-Medium)

**Current problem:** `RefereeAnalyzer` aggregates referee stats correctly but the results are never used in the final prediction or surfaced in the UI.

**Required behaviour:**
- When referee data is available in match fixtures (Football-Data.org includes referee name), calculate `refereeStats`
- Apply a small adjustment (±3% max) to home win probability based on referee's historical home win rate vs league average
- Surface referee stats as a tooltip or info panel in the Predictions component

---

### 5. Confidence Calculation (Priority: Medium)

**Current problem:** `calculateConfidence()` in `OptimizedPredictor` uses a simple probability gap formula. It clamps to 25%–95%.

**Required behaviour:**
- Incorporate ensemble disagreement: if ELO and Poisson strongly disagree, lower confidence
- Add a `calibration` component: track historical accuracy by confidence band and adjust
- For example: if 80% confidence predictions historically achieve 72% accuracy, the calibration factor is 0.9
- Confidence should reflect both the model's certainty and historical calibration

---

### 6. AI-Assisted Analysis (Priority: Medium)

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

### 7. Ensemble Backtesting (Priority: Medium)

**New requirement:** The ensemble must be backtestable to measure and improve accuracy.

**Required behaviour:**
- Create `frontend/src/lib/backtest.ts` with a `BacktestRunner` class
- Takes an array of completed matches and runs each through the ensemble as if it were upcoming
- Compares predicted vs actual result and accumulates accuracy metrics
- Reports: overall accuracy %, per-outcome accuracy (Home/Draw/Away), log loss score, Brier score
- Accessible from a "Backtest" panel in the Predictions view or Settings

---

### 8. Model Weights — Tuning Guide

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

- [ ] ELO ratings update from real match results and persist across sessions
- [ ] Poisson lambda derived from real team stats, not hardcoded averages
- [ ] Fatigue multiplier uses real ELO opponent ratings
- [ ] Referee adjustments applied when referee name is available
- [ ] Confidence reflects both model certainty and historical calibration
- [ ] AI analysis available as a configurable feature in Settings
- [ ] Backtest runner produces accuracy metrics for historical seasons
- [ ] All prediction unit tests pass (`npm run test:run`)
