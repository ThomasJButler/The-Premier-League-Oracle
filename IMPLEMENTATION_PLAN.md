# Premier League Oracle — Implementation Plan

## Status: P9 Phase 1 open — Frontend scoreline realism (5 tasks, 8-loop cap)

> **Ralph loop note:** `loop.sh` terminates when this Status line contains `COMPLETE` or `POLISHED`. The active phase is **P9 Phase 1 only**. Phase 2 items (P9f–P9i) are explicitly DEFERRED and fenced off — do not pick them up in this loop.

Last updated: 19 April 2026
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
| P8 Prediction Engine | 10/12 | P8a–j DONE; P8k retrain + P8l RAG historical remaining |
| P9 Phase 1 — Scoreline Realism | 0/5 | ACTIVE — frontend only, v3.0-MVP-UX. P9a–P9e. Loop terminates on P9e. |
| P9 Phase 2 — Python Calibration | 0/4 | **DEFERRED** — fenced off from active loop. Requires separate branch + fresh planning session. |

**Frontend:** 597 Vitest tests (38 files), 43 E2E tests, 0 type errors, 0 svelte-check warnings
**Backend free-tier:** Pipeline complete with hyperparameter tuning, v3 training run done (53.3% accuracy with draw features + dual calibration, model saved)
**Backend pro-tier (P3a–d):** Archived to `pro-tier-archive` branch (pushed to remote) — future work
**All 8 specs:** 100% of active acceptance criteria met (99/99)

All completed P0–P4 work is documented in `CHANGELOG.md`.

## P7: Beyond MVP — Remaining Items

P7a–P7m complete except the two items below.

- [ ] **P7a — Retrain with latest season data** — Model trained on 2,191 matches through 2025/26 partial; ~380 more available when the season completes.
- [ ] **P7e — Rate-limit persistence** — Backend rate limiter is in-memory only; each Vercel instance has its own counter. Consider Redis if abuse becomes an issue. Low priority.

---

## P8: Prediction Engine Maximisation + Betting UI

See `backend/PREDICTION_ENGINE_STRATEGY.md` for full strategy and `backend/P8_PHASE2_PLAN.md` for Phase 2 details.

### Phase 1 — Backend Quick Wins (DONE)

- [x] **P8a — Draw calibration fix** — Post-calibration draw recovery restores draw predictions suppressed by isotonic calibration. New `recover_draws()` function + `--draw-threshold` CLI arg (default 0.22).
- [x] **P8b — Optuna hyperparameter tuning** — Replaced random search with Bayesian optimisation (TPE). Default 100 trials (was 25). Falls back to random search if Optuna not installed. Added `optuna==4.3.0` to requirements.
- [x] **P8c — --no-odds training flag** — `skip_odds` parameter flows through `build_dataset` → `create_features` → `_odds_features`. Produces honest inference baseline model.
- [x] **P8d — Feature interactions** — 5 new interaction features (119 total): `elo_x_form`, `derby_x_closeness`, `elo_x_rest`, `trend_x_form`, `h2h_draw_x_closeness`.

### Phase 2 — DONE

- [x] **P8e — Dedicated draw model** — Binary XGBoost classifier (draw vs not-draw) with cascade prediction. Threshold auto-tuned on validation set.
- [x] **P8f — Form orthogonalisation** — Added `home_form_vs_elo` and `away_form_vs_elo` residual features (121 total). Isolates recent momentum from overall quality.
- [x] **P8g — Value Scanner rename** — Renamed "Value Bets" → "Value Scanner" across nav, routing, Dashboard, Help, BettingHistory, tests.
- [x] **P8h — Suggested Bets page** — Extracted from KellyCalculator into standalone `SuggestedBets.svelte` with shared bankroll via localStorage.
- [x] **P8i — Expanded to 33 seasons** — All PL seasons 1993/94–2025/26 (12,535 matches). Fixed CSV encoding + bad lines handling.
- [x] **P8j — Retrained on full dataset** — 53.8% accuracy on 2,468 validation samples. ELO features dominate (#1-#3). `elo_x_form` interaction at #3.

### Remaining

- [ ] **P8k — Retrain V5** — Retrain with A5+A6 features (dedicated draw model + form orthogonalisation). User to run training command.
- [ ] **P8l — RAG historical data access** — Extend Oracle Chat to query historical CSV data (all 33 seasons) for questions like "what position was Liverpool in 1995?"

---

## P9: Scoreline Realism & Calibration (Audit-Driven)

**Context:** User reported that predictions are dominated by 1-0 and 2-1 scorelines, with very few matches predicted over 3 goals. Audit (19 April 2026) traced the cause to the **frontend display layer**, not the Python model:

1. `optimizedPredictions.ts:997-998` rounds the Poisson mean (`Math.round(λ_h)-Math.round(λ_a)`) — for typical EPL lambdas (λ_h≈1.5, λ_a≈1.2) this almost always yields "2-1", collapsing a rich probability distribution into one integer pair.
2. `advancedPredictions.ts:15-35` uses **independent** Poisson without the Dixon-Coles τ correction — mathematically over-predicts 1-0 / 0-1 and under-predicts 1-1 / 0-0.
3. Python H/D/A model itself (53.3% accuracy) is competitive with SOTA for free-tier data (~55-56% ceiling); no accuracy is being lost to the display issue.

See `/Users/tombutler/.claude/plans/please-ecamine-our-phyton-linear-minsky.md` for the full audit and SOTA benchmarking.

### Design Decisions (locked in 19 April 2026)

| Decision | Choice |
|----------|--------|
| Phase 1 branch | `v3.0-MVP-UX` (current) |
| Phase 2 branch | `v3.0-python-calibration` (future, separate run) |
| Dixon-Coles ρ default | -0.1 (EPL-typical; TODO to fit from data later) |
| Top-N scoreline count | 5–7 (UI should support a configurable cap) |
| Grid size | 8×8 (maxGoals=7, unchanged) |
| RPS regression tolerance | 0 — Phase 1 must not degrade backtest RPS |

---

### Phase 1 — Frontend Scoreline Fix (ACTIVE — 5 tasks, 8-loop cap)

> **ACTIVE scope.** All Phase 1 tasks are self-contained in `frontend/src/`. No backend changes. No model retraining. No Python file edits.

- [x] **P9a — [P1] Top-N scoreline display.** Show the top 5–7 most likely scorelines with probabilities in the Predictions UI instead of one rounded score (e.g. `1-0 (10%) · 2-1 (8%) · 1-1 (8%) · 2-0 (7%) · 0-0 (5%)`). Source files: `frontend/src/components/Predictions.svelte:339` (display), `frontend/src/types/index.ts` (`Prediction` type — add `topScorelines: Array<{score: string, probability: number}>`), `frontend/src/lib/optimizedPredictions.ts` (populate the new field from the existing Poisson grid). **Acceptance:** Predictions card shows ≥5 distinct scorelines with percentages that sum to ≥50% of total grid probability; existing `predictedScore` single-string field still works for backward compatibility.

- [ ] **P9b — [P1] Argmax-of-grid for "predicted score".** Replace `Math.round(homeExpected)-Math.round(awayExpected)` in `frontend/src/lib/optimizedPredictions.ts:990-1036` (`predictGoals` method) with argmax over the `PoissonPredictor.predictScoreProbabilities` grid. Keep the H2H low/high-scoring adjustment at lines 1017-1029, but apply after argmax rather than after rounding. **Acceptance:** for a typical fixture with λ_h=1.5, λ_a=1.2, the returned score is `1-0` (actual modal), NOT `2-1` (rounded mean); unit test in `optimizedPredictions.test.ts` added to prove this.

- [ ] **P9c — [P1] Dixon-Coles τ correction.** Add the low-score correlation adjustment to `PoissonPredictor.predictScoreProbabilities` at `frontend/src/lib/advancedPredictions.ts:19-35`. Multiply (0,0), (1,0), (0,1), (1,1) cells by τ(i,j,λ_h,λ_a,ρ) per Dixon-Coles (1997); τ=1 elsewhere. Add `POISSON_DIXON_COLES_RHO = -0.1` to `frontend/src/lib/constants.ts:96-100` with a derivation comment citing EPL-typical values. Re-normalise the grid after correction so probabilities sum to 1. **Acceptance:** P(1-1) increases vs naive Poisson; P(1-0) + P(0-1) decreases; grid probabilities sum to 1 ± 1e-9.

- [ ] **P9d — [P1] Tests + backtest validation.** Add Vitest cases: (i) for λ_h=1.5, λ_a=1.2, top-5 contains {1-0, 2-1, 1-1, 2-0, 0-0}; (ii) after Dixon-Coles, P(1-1) > naive P(1-1) and P(1-0) + P(0-1) < naive equivalent; (iii) grid probabilities sum to 1 after τ correction. Update `frontend/src/lib/advancedPredictions.test.ts` (line 82-99 already has a smoke test) and `frontend/src/lib/optimizedPredictions.test.ts`. Run `backtest.ts` before/after to confirm RPS does not degrade. **Acceptance:** new tests pass; `npm run test:run` shows ≥600 tests green; backtest RPS ≤ pre-change baseline (record both in commit message).

- [ ] **P9e — [P1] Final verification + terminator.** Verify P9a–P9d all marked `[x]`. Run gates: `cd frontend && npm run test:run && npm run check`; run `npm run lint` if configured. Confirm backtest output: record pre-change and post-change RPS in the completion report. Manual E2E (spin up `npm run dev`): confirm Predictions page shows distinct top-N scorelines for 3+ different fixtures (not all "2-1"). Write `### P9 Phase 1 Completion Report` block under this phase containing: files changed, RPS delta, 3 sample before/after scoreline outputs, commit hashes. Update the Status line at the top of this file to `P9 Phase 1 COMPLETE — scoreline realism shipped`. Commit with message `P9: closeout + terminator`. **Acceptance:** Status line contains terminator phrase; Completion Report section exists; gates all green.

### Terminator (Phase 1)

Loop stops when ALL true:
- P9a–P9e all marked `[x]` in this document
- Gates green: `npm run test:run` (≥600 passing), `npm run check` (0 errors/warnings)
- Backtest RPS ≤ pre-change baseline (no regression in H/D/A)
- Status line at top of this file contains: **"P9 Phase 1 COMPLETE — scoreline realism shipped"**
- `### P9 Phase 1 Completion Report` block written below

### Guardrails (Phase 1)

- **OUT OF SCOPE — Phase 2 (P9f–P9i) is DEFERRED.** Do not pick up those tasks. Do not edit any file listed under off-limits.
- **Off-limits paths (Phase 1):**
  - `backend/train_free_tier.py` — training pipeline, re-runs not permitted
  - `backend/app/features/free_tier_features.py` — feature engineering, unchanged this phase
  - `backend/models/*` — no retraining, no model artefact changes
  - `backend/app/api/main.py` — draw cascade and endpoint logic unchanged
  - Any `.joblib`, `.pkl`, or `.onnx` file under `backend/`
- **No new tasks mid-loop.** Discoveries → `### P9 Discovered Work` section below, NOT the active task list. Tag discoveries `DEFERRED-P9-PHASE-2` if backend-related.
- **Reuse existing patterns.** Use `PoissonPredictor` class as-is; extend rather than reimplement. Use `constants.ts` for any new magic numbers.
- **UK English in commits.** No `Co-Authored-By` lines, no `Claude Code` references in messages, no `--no-verify`.

### P9 Discovered Work

_(Ralph appends findings here during Phase 1 iterations. Format: `- <YYYY-MM-DD> <P9a|P9b|...>: <finding>`.)_

---

### Phase 2 — DEFERRED (DO NOT WORK ON IN THIS LOOP)

> **⚠ FENCED OFF.** These items are documented for future planning only. A fresh planning session on a new branch (`v3.0-python-calibration`) is required before any of these start. **If you are a Ralph loop iteration reading this: skip this entire subsection. The active terminator is P9e.**
>
> **Grep-safety:** Phase 2 items below use `- [~]` (tilde) instead of `- [ ]` (space) on purpose — the standard Ralph grep pattern `^- \[ \] \*\*P9` will NOT match these, so even a mis-configured loop cannot accidentally pick them up. When Phase 2 work is actually opened on a future branch, the tildes get flipped to spaces at that point.

Recommended future work, in priority order:

- [~] **P9f — [P2 — DEFERRED] Dirichlet calibration.** Replace per-class isotonic/Platt dispatch in `backend/train_free_tier.py:564-618` with joint Dirichlet calibration (Kull et al. 2019) over the full H/D/A simplex. Typical gain: better-calibrated draw probabilities without the suppression artefact that currently requires a post-hoc recovery hack. Implementation: fit Dirichlet calibrator on validation OOF probabilities (ODIR or full matrix scaling; ODIR is simpler and performs comparably).

- [~] **P9g — [P2 — DEFERRED] Remove ad-hoc draw recovery.** Once P9f lands, delete the post-calibration draw boost at `backend/train_free_tier.py:475-533` (the `recovered[i, draw] = max(cal_draw, raw_draw * 0.75)` logic and the `--draw-threshold` CLI arg). Dirichlet calibration handles this correctly at training time. The draw cascade in `backend/app/api/main.py:484-498` may be retained — A/B before deciding.

- [~] **P9h — [P2 — DEFERRED] Prune redundant draw indicator features.** The 13 draw indicators at `backend/app/features/free_tier_features.py:1058-1180` have high mutual correlation. Compute pairwise correlation matrix on training data; drop features with |r| > 0.85 vs a retained feature. Retain the 2-3 highest-gain features per XGBoost feature importance. Retrain and compare val log-loss and draw AUC-ROC — expect no regression, simpler code.

- [~] **P9i — [P2 — DEFERRED] Empirical validation of Poisson lambdas.** Backtest the frontend lambda computation (`optimizedPredictions.ts:302-332`, `calculatePoissonLambdas`) against actual goal distributions from 2020-2025 CSV data. Check clamp hit rate, mean predicted λ_h vs empirical ~1.5, fatigue multiplier impact. If systematic bias found, widen clamps or tune fatigue coefficients.

**Phase 2 completion definition (for future planning — not this loop):**
- New model artefact trained with Dirichlet calibration, saved to `backend/models/xgboost_free_tier.joblib`
- Draw AUC-ROC ≥ 0.601 (current baseline), draw precision at threshold ≥ previous calibrated value
- Feature count reduced by 8-10 with no val log-loss regression
- `pytest` green (190+ tests)
- README `backend/README.md` status section updated

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
| `advancedPredictions.ts` | `ratingReliability = 0.8` — removed during P7k constants extraction | Resolved |
| `advancedPredictions.ts` | `HOME_ADVANTAGE` — now `ELO_HOME_ADVANTAGE = 33` from `constants.ts`, derived from 2,191 PL matches (2020–2025) | Resolved |
| `advancedPredictions.ts` | Default referee stats — now `DEFAULT_REFEREE_AVG_YELLOWS = 3.6`, `DEFAULT_REFEREE_AVG_REDS = 0.12` from `constants.ts` | Resolved |
| `optimizedPredictions.ts` | `MODEL_WEIGHTS` — users can apply backtest-derived weights via Predictions panel (persisted to localStorage) | Resolved |
| `optimizedPredictions.ts` | ELO draw, form weights, confidence, standings step — extracted to named constants in `constants.ts` with documented derivations | Resolved |
| `optimizedPredictions.ts` | Fallback prediction returns static `{result: 'D', confidence: 0.33, goals: 1-1, odds: 3.0/3.3/3.0}` | Low |
| `betBuilder.ts` | `avgCorners: 9.5` — no corner data from free tier | Low |
| `betBuilder.ts` | `expectedCards: 3.2` — no card data from free tier | Low |
| `betBuilder.ts` | `ftBias` / HT priors — now `HT_FT_CORRELATION = 0.37`, `HT_PRIOR_HOME/DRAW/AWAY` from `constants.ts`, derived from 2,191 PL matches | Resolved |
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

### P3c. Model Training Pipeline - ALL ON pro-tier-archive BRANCH.

**New file:** `backend/train.py` needed to orchestrate data collection → feature engineering → training → evaluation with proper 2020-2023 train / 2024 val / 2025-2026 test splits.  THIS FILE WAS DELETED IN PAST GIT HISTORY, IT IS ALL ON pro-tier-archive BRANCH.

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
| `Header.test.ts` | 8 | Passing |
| `SidebarNav.test.ts` | 10 | Passing |
| `MobileNav.test.ts` | 10 | Passing |
| `Sidebar.test.ts` | 8 | Passing |
| **Total** | **597** | **All passing (38 files)** |

**Known test quality issues:** Component tests using `(component as any).refresh()` bypass `onMount` — fragile if internal methods renamed. Untested components (1): App.svelte — integration root, covered by Playwright E2E.

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
