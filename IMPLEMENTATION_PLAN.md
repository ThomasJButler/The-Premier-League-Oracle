# Premier League Oracle — Implementation Plan

Last updated: 20 March 2026
Active branch: `v3.0-MVP-UX`

---

## Project Status: MVP Complete — Verified by Two Full Audits

**Latest audit:** 20 March 2026
**Method:** 7 parallel agents audited all 8 specs, every frontend `lib/` and `services/` file, all Svelte components, all backend modules, CI/CD configuration, and project config files. Searched for TODO/FIXME/HACK, stubs, hardcoded values, empty arrays, mock data, and redundant files.
**Result:** All P0–P6 items confirmed complete. 0 TODO/FIXME/HACK in production code. All documented stubs verified accurate. 4 minor housekeeping items added to P7e/P7g. No regressions or undocumented issues found.
**Previous audit:** 19 March 2026 — identical conclusions (6 agents).

**v3.0 scope (excluding deferred Pro-tier P3a–d):**

| Priority | Status | Notes |
|----------|--------|-------|
| P0 Blockers | 3/3 (100%) | Backend startup, requirements audit, stale docs |
| P1 High Priority | 17/17 (100%) | ALL DONE — wizard dismiss bug fixed |
| P2 Next Sprint | 27/27 (100%) | ALL DONE — Docker fixed, CI coverage enforced, .env.example created |
| P3-Free ML Pipeline | DONE | 114 features (incl. 10 odds + 13 draw + 5 Elo), rolling CV, stacked ensemble, ELO leakage fixed |
| P3e/f/g Integration | ALL DONE | ML ensemble, LiveService, AI Analysis |
| P4 Polish | 8/8 (100%) | Minor deferred sub-items only; Spec 07 UI/UX now 100% complete |
| P5 Hardening | 56/56 (100%) | ALL DONE — P5g nineteenth audit items resolved |
| P5h Twentieth Audit | 17/17 (100%) | ALL DONE |
| **P6 Final Push** | **5/5 (100%)** | **ALL DONE — MVP complete** |
| P7 Beyond MVP | 57/59 | 2 deferred: retrain awaiting season completion, rate-limit persistence low priority. P7m 10/10 complete |

**Frontend:** 561 Vitest tests (34 files), 43 E2E tests, 0 type errors, 0 svelte-check warnings
**Backend free-tier:** Pipeline complete with hyperparameter tuning, v3 training run done (53.3% accuracy with draw features + dual calibration, model saved)
**Backend pro-tier (P3a–d):** Archived to `pro-tier-archive` branch (pushed to remote) — future work
**All 8 specs:** 100% of active acceptance criteria met (99/99)

All completed P0–P4 work is documented in `CHANGELOG.md`.

## P7: Beyond MVP — Remaining Items

P7a–P7m complete except the two items below.

- [ ] **P7a — Retrain with latest season data** — Model trained on 2,191 matches through 2025/26 partial; ~380 more available when the season completes.
- [ ] **P7e — Rate-limit persistence** — Backend rate limiter is in-memory only; each Vercel instance has its own counter. Consider Redis if abuse becomes an issue. Low priority.

---

## Free-Tier ML Model: V3 Final Results

**Model:** `backend/models/xgboost_free_tier.joblib` — trained 20 March 2026
**Dataset:** 2,191 matches (6 CSVs, 2020/21–2025/26 partial), 2,100 samples after warmup filter, 114 features (86 base + 13 draw + 5 Elo + 10 odds), 1,680 train / 420 val (80/20 chronological)
**Result:** 53.3% overall accuracy, Draw AUC-ROC 0.601, log loss 0.954, isotonic calibration, stacked ensemble excluded (51.7% vs 53.3%)

**Draw calibration paradox:** The raw model predicts draws at 16.3% accuracy, but after isotonic calibration it drops to 0.0%. The calibrator learns "when the model thinks draw, it's usually wrong" and maps draw probabilities downward, pushing argmax toward H/A instead. Fix requires a post-calibration draw threshold (separate item, deferred).

### Benchmarking Context

| Strategy | Expected Accuracy |
|----------|-------------------|
| Random guess (3-class) | ~33% |
| Always predict home win | ~43% |
| LR baseline (this run) | 47.9% |
| XGBoost v1 (no odds) | 51.0% |
| XGBoost v2 (with odds) | 51.9% |
| **XGBoost v3 (draw features + calibration)** | **53.3%** |
| Good PL models (industry) | 52–58% |
| Bookmaker-implied | 55–58% |

---

## Git Branch Strategy

```
main                       — stable releases only, merged via PR
v3.0-Development           — integration branch for v3.0 features
v3.0-BackendMLTraining     — backend ML training pipeline (this branch)
v3.0-Frontend              — frontend improvements
feature/<name>             — isolated features, merged via PR
fix/<name>                 — bug fixes, merged via PR
```

**Merge flow:** `feature/*` / `v3.0-*` → `v3.0-Development` → `main` (PR only)

---

## Active Stubs (known hardcoded values remaining)

### Frontend

| Location | Problem | Priority |
|----------|---------|----------|
| `advancedPredictions.ts` | `avgPenalties: 0.2` — no penalty data from free API tier | Low |
| `advancedPredictions.ts` | `SEED_RATINGS` — 20 teams with manually assigned ELO, not backcalculated. Mitigated: historical warm-up processes 5 seasons of matches on first load, so seeds are only used briefly before being overwritten by real data | Low |
| `advancedPredictions.ts` | `ratingReliability = 0.8` — constant, should reflect actual model accuracy | Low |
| `advancedPredictions.ts` | `HOME_ADVANTAGE = 65` ELO points — static, should vary by team | Low |
| `advancedPredictions.ts` | Default referee stats (`avgYellowCards: 4, avgRedCards: 0.1, homeWinRate: 0.46`) | Low |
| `optimizedPredictions.ts` | `MODEL_WEIGHTS` — users can apply backtest-derived weights via Predictions panel (persisted to localStorage) | Resolved |
| `optimizedPredictions.ts` | ELO draw, form weights, confidence, standings step — extracted to named constants in `constants.ts` with documented derivations | Resolved |
| `optimizedPredictions.ts` | Fallback prediction returns static `{result: 'D', confidence: 0.33, goals: 1-1, odds: 3.0/3.3/3.0}` | Low |
| `betBuilder.ts` | `avgCorners: 9.5` — no corner data from free tier | Low |
| `betBuilder.ts` | `expectedCards: 3.2` — no card data from free tier | Low |
| `betBuilder.ts` | `ftBias = 0.4` — HT-FT correlation arbitrarily set at 40% | Low |
| `betBuilder.ts` | `homeCleanSheet` prediction threshold 0.3 — no empirical basis | Low |
| `Predictions.svelte` | `estimatedBookmakerOdds = (1 / topProb) * 1.05` — fabricated margin | Low |
| `Predictions.svelte` | `totalGameweeks` — now uses `PREMIER_LEAGUE_GAMEWEEKS` from `constants.ts` | Resolved |
| `value.ts` | `MIN_CONFIDENCE = 0.55` — filters out most draw/away predictions | Low |

### Backend

| Location | Problem | Priority |
|----------|---------|----------|
| `football_data_collector.py` | `get_head_to_head()` returns empty DataFrame | P3b |
| `football_data_collector.py` | `get_team_form()` confusing result-flip logic | P3b |
| `football_data_collector.py` | `get_team_form()` mixed `'H'`/`'A'` and `'W'`/`'L'` values | P3b |
| `football_data_collector.py` | `time.sleep()` in `_enforce_rate_limit()` blocks asyncio event loop | P3b |

---

## Deferred Pro-Tier — P3a–d (Future Work)

> **All Pro-tier files archived to `pro-tier-archive` branch (pushed to remote). Restore with:**
> ```
> git checkout pro-tier-archive -- backend/app/models/ backend/app/features/advanced_engineering.py
> ```

The full 150-feature Pro-tier pipeline requires the paid Football-Data.org API (xG, shots, possession, cards, corners, betting odds, player data). Explicitly deferred until the free-tier model is stable and the API subscription is upgraded.

### P3a. Real Feature Engineering

`advanced_engineering.py` — no `np.random.*` calls, but **63 methods return hardcoded `0.0`** for advanced metrics, betting features, tactical features, player impact, and external factors. ~75 features compute real data from scorelines/results.

Priority features to implement with real data (free-tier data available for these):
- [ ] Rolling goals scored/conceded (last 5, 10 matches); form streaks; rest days since last match
- [ ] H2H win rates — fix `get_head_to_head()` returning empty DataFrame
- [ ] Remove or document the ~63 `return 0.0` stub methods (tactics, weather, player-level require paid data)
- [ ] `_is_derby_match()` — uses canonical API names but CSVs use short names; derby detection always returns `0.0` in training
- [ ] `_compute_league_positions()` — builds cumulative all-time points rather than per-season; wrong for multi-season training

**Constraint:** xG, shots, possession, cards, corners not available on free tier — ~70 features remain stubs without a paid data source.

### P3b. Data Collector Fixes

- [ ] `football_data_collector.py`: `get_head_to_head()` returns empty DataFrame (stub)
- [ ] `football_data_collector.py`: `get_team_form()` returns mixed value types — home matches return `'H'`/`'A'`/`'D'` while away matches return `'W'`/`'L'`/`'D'`. Should consistently return `'W'`/`'D'`/`'L'`
- [ ] Add retry logic to API client (currently no retries on failure)
- [ ] `modern_oracle.py` calls `self.data_collector.get_team_stats(team_name)` — method doesn't exist. Will `AttributeError`
- [ ] `modern_oracle.py` calls `self.data_collector.get_team_form(team_name, last_n=5)` — wrong kwarg name, should be `n_matches`. Will `TypeError`

### P3c. Model Training Pipeline

**New file:** `backend/train.py` needed to orchestrate data collection → feature engineering → training → evaluation with proper 2020-2023 train / 2024 val / 2025 test splits.

Critical issues in archived model files (all in `pro-tier-archive`): column rename mismatch (`FTHG` → `home_score` but engineer reads `home_goals`); hardcoded CSV directory; `scaler.fit_transform` at inference time; data leakage in ensemble optimisation; `val_accuracy` UnboundLocalError in transformer; `/admin/retrain` returns mock response; 0% pytest coverage on all Pro-tier models.

### P3d. Security Layer Fixes

`auth.py`, `secrets.py`, `validators.py` deleted in P6c (never imported). If auth is needed for Pro-tier, write from scratch.

- [ ] `main.py` bearer tokens on `/predict/natural` and `/admin/retrain` are **never verified** — any bearer string passes
- [ ] `lstm_predictor.py` / `transformer_model.py`: unguarded `import torch` at module level — crashes if torch not installed (archived to `pro-tier-archive`)

---

## Specs

All feature specifications in `specs/`:

| File | Topic | Implementation Status |
|------|-------|-----------------------|
| `specs/01-prediction-engine.md` | ELO, Poisson, fatigue, referee, confidence, backtesting | **100% — ALL 8/8 criteria met.** Poisson lambda uses per-team stats (Dixon-Coles). Reqs 5/6/8 DONE markers added (calibration, ELO auto-update, backtest optimisation). |
| `specs/02-data-pipeline.md` | Football-Data.org integration, caching, historical data | **100% — ALL 8/8 criteria met.** Progressive 5-season bulk loader (Req 5), rate-limit queue (Req 7), backend proxy (Req 8). Live status filter expanded to include `EXTRA_TIME`/`PENALTY_SHOOTOUT`. Season range updated to 2020–2024. **Markers: 8/8** |
| `specs/03-backend-integration.md` | Python ML backend connection | **100% — ALL 8/8 criteria met.** WebSocket superseded note added — polling-only architecture satisfies Req 7 via `/live` endpoint. Docker fixed (P2o). Dead batch/stats methods removed (P5ak). **Markers: 8/8** |
| `specs/04-betting-intelligence.md` | Kelly, value bets, bet history, accumulators | **100% — ALL 12/12 criteria met.** AccumulatorBuilder.svelte with cross-match accumulator building, Track Bet integration, 17 tests. **Markers: 12/12** |
| `specs/05-live-data.md` | Live scores, smart polling, WebSocket | **100% — ALL 10/10 criteria met.** WebSocket superseded note added; polling-only with adaptive intervals. Status filter expanded (`EXTRA_TIME`/`PENALTY_SHOOTOUT`). Match event notifications via polling-diff. **Markers: 10/10** |
| `specs/06-prediction-tracking.md` | Accuracy tracking, auto-reconciliation | **100% — ALL 7/7 criteria met** |
| `specs/07-ui-ux.md` | shadcn-svelte migration, dark mode, accessibility | **100% — ALL 17/17 criteria met.** bits-ui note clarified (custom implementations, not bits-ui). Tabs section updated. Priority 6+ deferred items documented. **Markers: 17/17** |
| `specs/08-backend-training.md` | Backend training pipeline (free-tier + Pro-tier) | **100% — ALL 29/29 active criteria met.** P3-Free DONE, Pro-tier Req 6 deferred (no acceptance criteria). 114 features (incl. 13 draw + 5 Elo + 10 odds). Match count: 2,191. Rate limiter IP fix P5a (Req 4d). **Markers: 29/29** |

---

## CSV Training Data (available in `backend/spreadsheets/`)

**2,191 completed matches across 5.75 seasons** in `KnowledgeFilesCSV/`:
- EPL 2020/21 through 2025/26 (partial) — 380 matches per full season
- **Rich column set**: shots (`HS`/`AS`/`HST`/`AST`), fouls (`HF`/`AF`), corners (`HC`/`AC`), cards (`HY`/`AY`/`HR`/`AR`), referee, half-time scores, plus ~80 bookmaker odds columns
- These CSVs contain data the free API does **not** provide — making them the primary source for training the ML backend
- `fact_player_stats.csv` — 3,638 player records with goals, assists, xG, per-90 metrics

**Training/inference feature mismatch**: Features trained on CSV-only columns (shots, corners, cards, odds) will receive nulls at inference time from the free API. The `FreeTierFeatureEngineer` handles this gracefully.

---

## Test Coverage Summary

### Frontend (Vitest)

| File | Tests | Status |
|------|-------|--------|
| `betBuilder.test.ts` | 40 | Passing |
| `value.test.ts` | 17 | Passing |
| `advancedPredictions.test.ts` | 24 | Passing |
| `betHistoryService.test.ts` | 23 | Passing |
| `footballData.test.ts` | 25 | Passing |
| `kelly.test.ts` | 11 | Passing |
| `types.test.ts` | 4 | Passing |
| `predictionTracker.test.ts` | 22 | Passing |
| `ChatBot.test.ts` | 23 | Passing |
| `Predictions.test.ts` | 19 | Passing |
| `BettingHistory.test.ts` | 15 | Passing |
| `KellyCalculator.test.ts` | 15 | Passing |
| `backtest.test.ts` | 22 | Passing |
| `Dashboard.test.ts` | 15 | Passing |
| `optimizedPredictions.test.ts` | 28 | Passing |
| `ValueBets.test.ts` | 12 | Passing |
| `dataService.cache.test.ts` | 8 | Passing |
| `dataService.test.ts` | 8 | Passing |
| `Settings.test.ts` | 18 | Passing |
| `LiveMatches.test.ts` | 9 | Passing |
| `liveService.test.ts` | 24 | Passing |
| `backendService.test.ts` | 11 | Passing |
| `aiAnalysis.test.ts` | 23 | Passing |
| `AccumulatorBuilder.test.ts` | 17 | Passing |
| `SeasonStats.test.ts` | 13 | Passing |
| `StandingsTable.test.ts` | 18 | Passing |
| `TopScorers.test.ts` | 13 | Passing |
| `Help.test.ts` | 13 | Passing |
| `ApiSetupWizard.test.ts` | 13 | Passing |
| `MatchList.test.ts` | 12 | Passing |
| `LiveTicker.test.ts` | 12 | Passing |
| `MatchEventToast.test.ts` | 12 | Passing |
| `SeasonTimeline.test.ts` | 13 | Passing |
| `DataFreshness.test.ts` | 9 | Passing |
| **Total** | **561** | **All passing (34 files)** |

**Known test quality issues:** Component tests using `(component as any).refresh()` bypass `onMount` — fragile if internal methods renamed. Untested components (4): Header, MobileNav, SidebarNav, Sidebar — layout/navigation only.

### Frontend (Playwright E2E)

| File | Tests | Status |
|------|-------|--------|
| `navigation.spec.ts` | 9 | Passing |
| `oracle-chat.spec.ts` | 9 | Passing |
| `betting.spec.ts` | 7 | Passing |
| `dashboard.spec.ts` | 6 | Passing |
| `predictions.spec.ts` | 6 | Passing |
| `mobile.spec.ts` | 6 | Passing |
| **Total** | **43 unique (123 with 3 viewports)** | **All passing (0 skipped)** |

### Backend (pytest)

**190 tests across 5 files** — all pass. Covers free-tier features (60 incl. 10 odds-as-features tests + Elo leakage), training pipeline (33 incl. rolling CV, odds extraction, calibrator dispatch), API endpoints (17), RAG engine (58 incl. 14 player data tests), and web search fallback (22 incl. cache, prompt injection, graceful degradation). Pro-tier models and data collector have 0% test coverage.
