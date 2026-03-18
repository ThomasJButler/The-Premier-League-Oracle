# Premier League Oracle — Implementation Plan

Last updated: 26 March 2026 (ninth planning audit — 22 new findings, Poisson consistency fix required)
Active branch: `v3.0-BackendMLTraining`

---

## Project Status: ~82% Complete

**v3.0 scope (excluding deferred Pro-tier P3a–d):**

| Priority | Status | Notes |
|----------|--------|-------|
| P0 Blockers | 3/3 (100%) | Backend startup, requirements audit, stale docs |
| P1 High Priority | 16/16 (100%) | All frontend bugs, security, data layer fixes |
| P2 Next Sprint | 20/24 (83%) | 4 partial — Docker, backend deps, CI gaps |
| P3-Free ML Pipeline | DONE | 86 features, 62 tests, API endpoints wired |
| P3e/f/g Integration | ALL DONE | ML ensemble, LiveService, AI Analysis |
| P4 Polish | 8/8 (100%) | Minor deferred sub-items only |
| P5 Hardening | ~7/22 (32%) | Rate limiter, CI, test quality, type safety, Poisson consistency, dead code |

**Frontend:** Production-ready — 375 Vitest tests, 43 E2E tests, 0 type errors
**Backend free-tier:** Pipeline complete, first training run done (51.0% accuracy, model saved)
**Backend pro-tier (P3a–d):** NOT STARTED — explicitly deferred future work

All completed P0–P4 work is documented in `CHANGELOG.md`.

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

## Free-Tier ML Training: FIRST RUN COMPLETE

**Model trained and saved to `backend/models/xgboost_free_tier.joblib`** (18 March 2026).

### First Training Run Results

```
Data: 2,191 matches from 6 CSV files (2020/21–2025/26)
      2,100 samples after warmup filter (91 skipped), 86 features
Split: 1,680 training / 420 validation (80/20 chronological)
```

| Metric | XGBoost | LR Baseline | Notes |
|--------|---------|-------------|-------|
| **Overall accuracy** | **51.0%** | 44.5% | +6.4% lift (above 3% threshold) |
| **Home win accuracy** | **76.4%** | 63.5% | Strong |
| **Draw accuracy** | **6.7%** | 13.5% | Broken — model avoids predicting draws |
| **Away win accuracy** | **51.4%** | 43.5% | Decent |
| **Log loss** | **1.034** | 1.106 | High — probability estimates poorly calibrated |
| **Brier score** | **0.619** | 0.660 | Marginally better than uniform (0.667) |
| **Home AUC-ROC** | **0.686** | 0.633 | Good discrimination |
| **Draw AUC-ROC** | **0.495** | 0.477 | Near random (0.5) — no draw signal |
| **Away AUC-ROC** | **0.684** | 0.642 | Good discrimination |

**Confusion matrix (XGBoost):**
```
                Predicted
              H    D    A
Actual H  [ 136    9   33 ]   (76.4% correct)
Actual D  [  58    7   39 ]   ( 6.7% correct — nearly always misclassified)
Actual A  [  57   10   71 ]   (51.4% correct)
```

**Top 10 features by importance:**
1. `position_difference` (0.042) — league position gap, strongest single predictor by 3×
2. `home_ht_goals_scored_avg` (0.017)
3. `away_shots_avg` (0.015)
4. `away_win_rate` (0.015)
5. `home_shots_avg` (0.014)
6. `home_goals_scored_avg` (0.014)
7. `home_points_per_game` (0.014)
8. `home_win_rate` (0.013)
9. `home_home_win_rate` (0.013)
10. `h2h_dominance` (0.013)

### Benchmarking Context

| Strategy | Expected Accuracy |
|----------|-------------------|
| Random guess (3-class) | ~33% |
| Always predict home win | ~43% |
| LR baseline (this run) | 44.5% |
| **XGBoost v1 (this run)** | **51.0%** |
| Good PL models (industry) | 52–58% |
| Bookmaker-implied | 55–58% |

### Diagnosis

1. **Draw prediction is essentially non-functional.** Only 7/104 draws correctly predicted. The model is biased towards home/away because draws are underrepresented (23% of data) and the loss function doesn't penalise draw misclassification enough
2. **Probabilities are poorly calibrated.** Log loss 1.034 is high for 51% accuracy (well-calibrated would be ~0.95). The model is overconfident on wrong predictions
3. **Feature importance is flat after #1.** Position difference dominates (0.042), but features 2–86 are all clustered around 0.012–0.017 — the model isn't finding strong secondary signals

### Improvement Opportunities (for next iteration)

**Quick wins (low effort, likely impact):**
- [ ] **Class weights** — add `scale_pos_weight` or `sample_weight` to boost draw importance during XGBoost training. Draws are 23% of data but equally important to predict
- [ ] **Probability calibration** — apply sklearn `CalibratedClassifierCV` (isotonic or sigmoid) as a post-processing step to fix overconfident predictions. Should directly improve log loss and Brier score
- [ ] **Feature selection** — 86 features for 1,680 training samples risks overfitting. Try dropping features with importance < 0.01 (likely ~30+ features). Fewer noisy features = better generalisation
- [ ] **Hyperparameter tuning** — model stopped at iteration 48 (early stopping). Default XGBoost params may not be optimal. Grid search or Optuna over `max_depth`, `learning_rate`, `min_child_weight`, `subsample`, `colsample_bytree`

**Medium effort (likely significant impact):**
- [ ] **Draw-specific features** — engineer features that correlate with draws: closeness in form, closeness in standings, low-scoring H2H history, defensive team matchups
- [ ] **Elo-based features** — feed the frontend Elo ratings (already computed) into the backend feature engineer as additional inputs
- [ ] **Recency weighting** — weight recent seasons more heavily than older ones (PL meta changes over 5 seasons)

**Larger effort (for later):**
- [ ] **Stacked ensemble** — train separate binary classifiers (H vs not-H, D vs not-D, A vs not-A) and stack them
- [ ] **Odds-as-features** — the CSVs contain ~80 bookmaker odds columns. Using closing odds as features would dramatically boost accuracy (bookmakers are the strongest predictor), but makes the model dependent on having odds data at inference time
- [ ] **Rolling cross-validation** — instead of a single 80/20 split, use expanding-window CV (train on seasons 1–N, validate on N+1) for more robust evaluation

### How to Retrain

```bash
cd backend
python train_free_tier.py                                # Train model → xgboost_free_tier.joblib
python -m pytest tests/ -v                               # All 62 tests
uvicorn app.api.main:app --reload --port 8000            # Start server
curl -X POST http://localhost:8000/predict/free \
  -H "Content-Type: application/json" \
  -d '{"home_team": "Arsenal", "away_team": "Chelsea"}'  # Test endpoint
```

**Non-blocking caveats:**

- [ ] `backend/spreadsheets/` is gitignored — cloning the repo does NOT include CSV training data. Either remove from `.gitignore` (data is public PL results, not sensitive) or document how to obtain it. Without these CSVs, `train_free_tier.py` cannot run
- [ ] Rate limiter on `/predict/free` is broken — `client_ip` always `"unknown"`, all clients share one bucket (see P5a)

---

## Remaining Work — P2 (Partial Items)

### P2n. CI/CD Pipeline — PARTIAL

- [x] GitHub Actions CI — type check, unit tests, production build on push/PR
- [ ] Consider Playwright E2E in CI (heavier, but valuable — deferred to later)

### P2o. Docker Cleanup

`backend/docker-compose.yml` references files and directories that don't exist. Running `docker-compose up` fails immediately.

- [ ] `config.yml` — referenced by `Dockerfile COPY` but doesn't exist. Create a minimal config or remove the COPY
- [ ] `nginx.conf` — referenced as a volume mount but doesn't exist. Create or remove from compose
- [ ] `notebooks/` — mounted as a volume but directory doesn't exist. Create or remove from compose
- [ ] `POSTGRES_PASSWORD` required by compose but no `.env.example` template documents it
- [ ] `setup.sh` creates `data/`, `logs/`, `notebooks/` directories that `docker-compose.yml` depends on as bind-mount sources — this dependency is undocumented

### P2r. Config & Infrastructure — PARTIAL

**Version pinning (remaining):**

- [ ] Fix Python version mismatch: `requirements.txt` says 3.13, `Dockerfile` uses 3.11, `environment.yml` uses 3.11 — align all to one version
- [ ] `passlib==1.7.4` is incompatible with Python 3.13 — the `crypt` module was removed from stdlib in 3.13. (Only used by dead `auth.py` module, so low runtime risk)

**Backend dead dependencies in `requirements.txt`:**

- [ ] Remove or mark as optional: `boto3`, `hvac`, `azure-keyvault-secrets`, `azure-identity` — heavy deps (~30MB+) for `secrets.py` which is never imported by `main.py`
- [ ] Remove `sqlalchemy` — only imported by unused `auth.py`
- [ ] Add `pyyaml` and `httpx` if needed (present in `environment.yml` but missing from `requirements.txt`)

**Backend missing dependencies in `requirements.txt`:**

- [ ] Add `langchain-community` — `modern_oracle.py` imports it but package is separate from `langchain` and not listed
- [ ] Add `bcrypt` — `auth.py` uses `passlib` with `CryptContext(schemes=["bcrypt"])` which requires it
- [ ] `main.py:511-515`: `/features/importance` endpoint accesses `oracle.lstm_model.model` without checking if `lstm_model` is not None — will `AttributeError` when torch missing

### P2s. LSTM Synthetic Training Data

- [ ] `lstm_predictor.py:537-540` generates entirely synthetic training data using `np.random.randn` (features) and `np.random.randint` (labels) when training without real data. Add: guard that raises `ValueError("No real training data provided")` instead of falling back to random data

---

## Remaining Work — P5 (Hardening)

### P5a. Backend Rate Limiter Broken

`main.py:724-725`: `client_ip` parameter on `/predict/free` is declared with a default of `"unknown"` and never extracted from the actual HTTP request. All clients share a single rate-limit bucket.

- [ ] Extract real client IP from `request.client.host` (with `X-Forwarded-For` header fallback for reverse proxies)
- [ ] Test that per-IP bucketing actually isolates clients

Additionally, the free-tier feature engineer is initialised with an empty DataFrame when CSVs are absent (gitignored). All features return `0.0` for live predictions with no warning.

- [ ] Log a clear warning when CSV data is unavailable and the engineer is running on empty data
- [ ] Document how to obtain the CSV training data in the README or a setup script

### P5c. Backend CI Pipeline

The 62 backend tests are never run in CI. A Python regression will not be caught automatically.

- [ ] Add a Python job to `.github/workflows/ci.yml` — `pip install -r requirements.txt && python -m pytest tests/ -v`
- [ ] Consider adding Playwright E2E tests to CI (heavier, needs `npx playwright install`)

### P5e. Test Quality

- [ ] `ChatBot.test.ts`: DOMPurify is mocked to return raw HTML unchanged (`(html) => html`). The XSS sanitisation fix (P1j) is completely bypassed in tests — a regression would be invisible
- [ ] `liveService.test.ts`: WebSocket `onmessage` is never triggered — message parsing and store updates from WebSocket data are untested
- [ ] `optimizedPredictions.test.ts:412-421`: `if (prediction.valueOdds)` wraps all assertions — test passes vacuously when `valueOdds` is undefined
- [ ] `advancedPredictions.test.ts:392-398`: value bet loop `for (const bet of prediction.valueBets)` never enters when the mock returns empty array — assertions never run

### P5f. Type Safety

Remaining `any` types in production code (not catch blocks):

- [ ] `optimizedPredictions.ts:493,515` — `(form: any[])` should be `TeamForm[]`
- [ ] `optimizedPredictions.ts:783,784` — `formAnalysis: any`, `h2hAnalysis: any` should have typed interfaces
- [ ] `footballData.ts:104` — `Map<string, { data: any; timestamp: number }>` in-memory cache value
- [ ] `SeasonStats.svelte:10` — `icon: any` in interface, should be Svelte component type
- [ ] `Sidebar.svelte:57` and `MobileNav.svelte:36` — `handleKeydown(e: any)` should be `KeyboardEvent`

### P5g. Config & Infrastructure — PARTIAL

- [ ] `.github/workflows/ci.yml`: hardcodes `node-version: 20` instead of reading `.nvmrc`. Use `node-version-file: .nvmrc` for consistency
- [ ] `.gitignore`: `backend/chroma_db/` not gitignored — `chroma.sqlite3` generated database exists on disk and could be committed
- [ ] `vite.config.ts`: `GET /api/chat` dev proxy has no production equivalent — `api/chat.ts` Edge Function only handles POST. Frontend `checkServerKey()` probe may 405 in production
- [ ] `liveService.ts:247-249`: WebSocket `onmessage` handler for `data.liveMatches` is dead code — the backend doesn't send this payload

### P5i. WebSocket URL Hardcodes Port 8000

`liveService.ts:235` constructs the WebSocket URL with hardcoded port 8000. In production deployments where the backend is not on port 8000, the WebSocket will silently fail to connect. Polling fallback masks the failure.

- [ ] Extract WebSocket URL to a configurable constant or environment variable (`VITE_BACKEND_WS_URL`)
- [ ] Consider deriving the base URL from `backendService.BASE_URL` for consistency

### P5l. Minor Dead Code and Type Cleanup — PARTIAL

- [ ] `TopScorers.svelte:56` — `(s: any)` cast is unnecessary; `FDScorer` type is already available from the import chain

### P5m. Spec 01 — Confidence Calibration Not Implemented

Spec 01 Req 5 requires tracking accuracy by confidence band over time and adjusting future confidence scores. Currently `calculateConfidence()` uses ensemble disagreement but lacks the feedback loop.

- [ ] Add `getCalibrationFactors()` to `predictionTracker.ts` — returns `{ highBand: factor, mediumBand: factor, lowBand: factor }` from stored predictions
- [ ] Wire calibration factors into `OptimizedPredictor.calculateConfidence()` as a final multiplier

### P5n. Poisson maxGoals Inconsistency — 4 Different Values

The spec says cap Poisson at 7 goals. `advancedPredictions.ts` was fixed (P5l), but **three other call sites still use wrong values**, directly affecting prediction probabilities:

- [ ] `optimizedPredictions.ts:278` — calls `predictScoreProbabilities(..., 5)` — should be 7
- [ ] `Predictions.svelte` — calls `PoissonPredictor.predictScoreProbabilities(..., 6)` — should be 7
- [ ] `value.ts:234` — has local `maxGoals = 10` with its own Poisson re-implementation — should be 7

Additionally, `value.ts` and `betBuilder.ts` each have their own private Poisson implementations instead of using the shared `PoissonPredictor` from `advancedPredictions.ts`. Three separate Poisson codebases is a maintenance risk.

- [ ] Consolidate to a single Poisson implementation in `advancedPredictions.ts` (or extract to `lib/poisson.ts`) and have `value.ts` and `betBuilder.ts` import it

### P5o. getStandingsProbabilities Fallback Inconsistency

`optimizedPredictions.ts:644` — the no-data fallback uses `homeWin: 0.40` but `DEFAULT_HOME_WIN_RATE` in `constants.ts` is `0.46`. This is a **different location** from the H2H fallback fixed in P5k.

- [ ] Change `getStandingsProbabilities` no-data fallback from `0.40` to `DEFAULT_HOME_WIN_RATE` (0.46), with draw/away derived proportionally

### P5p. Backtest ELO processedMatchIds Leak

`backtest.ts` snapshots and restores the ELO ratings map before/after a backtest run, but does NOT snapshot/restore the `processedMatchIds` Set. Matches processed during backtesting remain marked as "processed" after restoration, potentially preventing future live ELO updates from reprocessing those matches.

- [ ] Snapshot `sharedEloSystem.processedMatchIds` before backtest and restore it alongside the ratings map

### P5q. Live Match Status Filter Incomplete

`dataService.getLiveMatches()` queries for `IN_PLAY,PAUSED` statuses only. `EXTRA_TIME` and `PENALTY_SHOOTOUT` statuses are not included — matches in extra time or penalties disappear from the live view entirely. `liveService.ts` inherits this gap.

- [ ] Add `EXTRA_TIME,PENALTY_SHOOTOUT` to the live matches status filter in `footballData.ts`

### P5r. ApiSetupWizard Accessibility (WCAG 2.1)

The `ApiSetupWizard.svelte` dialog has two WCAG failures independent of the shadcn Dialog migration (Spec 07):

- [ ] Focus is not moved to the dialog on open — screen readers and keyboard users land on content behind the modal
- [ ] No `Escape` key handler to dismiss the dialog — keyboard-only users cannot close it

### P5s. Dead Code Cleanup

Confirmed dead exports, unused constants, and orphaned CSS discovered in ninth audit:

- [ ] `$lib/utils/cn.ts` duplicates `cn()` from `$lib/utils.ts` — shadcn components import the duplicate. Consolidate: either re-export from `utils.ts` or update shadcn imports to use `$lib/utils`
- [ ] `predictionTracker.ts`: `GameweekAccuracy` interface and `getAccuracyByGameweek()` method are exported but never imported anywhere
- [ ] `kelly.ts`: standalone `isValueBet()` function exported but never imported outside the file
- [ ] `aiAnalysis.ts`: `MAX_CACHED_ANALYSES = 50` declared but never referenced (eviction uses a different strategy)
- [ ] `advancedPredictions.ts`: `TeamRating` interface exported but never used anywhere
- [ ] `app.css`: `.match-card`, `.match-score`, `.chart-container` classes appear unused by any component
- [ ] `app.css`: `@keyframes scroll` ticker animation is dead code — overridden by `LiveTicker.svelte` local `@keyframes ticker-scroll`
- [ ] `main.py:24`: `timedelta` imported but never used
- [ ] `modern_oracle.py:18`: `asyncio` imported but never used

### P5t. Frontend Resilience

- [ ] `footballData.ts`: no `AbortController` or timeout on fetch requests — a hung API call blocks the entire rate-limit queue indefinitely (unlike `backendService.ts` which correctly uses AbortController)
- [ ] `dataService.ts`: inconsistent error contract — `getTeamStats()` returns `null` silently, `getTeamForm()` returns `[]` silently, but `getMatches()`/`getStandings()` throw. Callers cannot reliably distinguish "no data" from "error"
- [ ] `Predictions.svelte`: `catch (error)` variable shadows the outer `let error` state variable — may cause unexpected UI state after failed predictions

---

## Deferred Minor Items (from P1/P4)

These are low-priority items deferred from completed priority tiers:

- [ ] **P1f:** "Last updated" indicator on data displays — deferred (requires data layer changes to track cache freshness)
- [ ] **P2l:** No `backend/.env.example` exists — create a template for required backend environment variables (deferred — backend not deployed to Vercel)
- [ ] **P4e:** `Dashboard.svelte` chart border colours hardcoded as hex — Chart.js requires resolved colour values, not CSS variables. Proper fix requires `getComputedStyle` + theme-change re-creation
- [ ] **P4e:** `BettingHistory.svelte` chart colours same Chart.js limitation as Dashboard
- [ ] **P4g:** No `backend/.dockerignore` — test files, docs, spreadsheets (~100MB+ CSVs) all included in Docker build context
- [ ] **P4h:** `backtest.test.ts` — ELO snapshot/restore logic entirely mocked out — a real rollback bug would not be caught
- [ ] **P4h:** Component tests bypass `onMount` via `(component as any).refresh()` — fragile if internal methods renamed

---

## Deferred Pro-Tier — P3a–d (Future Work)

The full 150-feature Pro-tier pipeline requires the paid Football-Data.org API (xG, shots, possession, cards, corners, betting odds, player data). This is explicitly deferred until the free-tier model is stable and the user upgrades their API subscription.

### P3a. Real Feature Engineering

`advanced_engineering.py` — no `np.random.*` calls (was 102), but **63 methods return hardcoded `0.0`** for: advanced metrics (13), betting features (10), tactical features (10), player impact (5), external factors (7), plus contextual stubs. ~75 features compute real data from scorelines/results.

Priority features to implement with real data:
- [ ] Rolling goals scored/conceded (last 5, 10 matches) — data available from free tier
- [ ] Form streaks (W/D/L sequences) — data available
- [ ] Rest days since last match — data available
- [ ] H2H win rates — fix `get_head_to_head()` returning empty DataFrame
- [ ] xG proxies from shots data — limited by free tier
- [ ] Remove or honestly document the ~63 `return 0.0` stub methods (tactics, weather, player-level require paid data sources)

**Derby detection broken for CSV training:**

- [ ] `_is_derby_match()` uses Football-Data.org canonical names but CSV training data uses short names — derby detection always returns `0.0` during training
- [ ] `_compute_league_positions()` builds cumulative all-time points rather than per-season — wrong for multi-season training
- [ ] `warnings.filterwarnings('ignore')` at module level silences all Python warnings globally — makes debugging harder

**Constraint:** Football-Data.org free tier does not provide xG, shots, possession, cards, corners data — ~70 features will remain stubs unless a paid data source is added.

### P3b. Data Collector Fixes

- [ ] `football_data_collector.py`: `get_head_to_head()` returns empty DataFrame (stub)
- [ ] `football_data_collector.py`: `get_team_form()` returns mixed value types — home matches return `'H'`/`'A'`/`'D'` while away matches return `'W'`/`'L'`/`'D'`. Should consistently return `'W'`/`'D'`/`'L'`
- [ ] Add retry logic to API client (currently no retries on failure)
- [ ] `modern_oracle.py` calls `self.data_collector.get_team_stats(team_name)` — method doesn't exist. Will `AttributeError`
- [ ] `modern_oracle.py` calls `self.data_collector.get_team_form(team_name, last_n=5)` — wrong kwarg name, should be `n_matches`. Will `TypeError`

### P3c. Model Training Pipeline

**New file:** `backend/train.py`

- [ ] Orchestrates: data collection → feature engineering → model training → evaluation
- [ ] Train/validation/test splits: 2020-2023 train, 2024 validation, 2025 test
- [ ] Wire `/admin/retrain` endpoint (currently returns mock response)
- [ ] Fix `lstm_predictor.py`: `get_feature_importance()` returns `{name: np.random.random()}` — **live np.random stub**
- [ ] Fix `modern_oracle.py`: `optimize_ensemble_weights()` returns `np.random.random()` — **live np.random stub**
- [ ] Fix `modern_oracle.py`: `_calculate_betting_value()` uses mock odds `{home: 2.5, draw: 3.2, away: 2.8}`
- [ ] Fix `modern_oracle.py`: LSTM sequence is 10× duplicate of a single-row feature vector — not a real time series
- [ ] Fix `transformer_model.py`: model save/load only saves 2 of 8 constructor params — will reconstruct wrong architecture on load
- [ ] Fix `transformer_model.py`: `val_accuracy` UnboundLocalError when no validation set
- [ ] Fix `transformer_model.py`: `num_decoder_layers` param silently ignored (no decoder built)
- [ ] Fix `lstm_predictor.py` + `transformer_model.py`: shallow `.copy()` on `state_dict()` — "best model" state can be mutated mid-training
- [ ] **`train.py` column rename mismatch (CRITICAL — silent training on zeros):** `train.py` renames `FTHG` → `home_score` but `AdvancedFeatureEngineer` reads `home_goals`. Every feature method returns `0.0`
- [ ] **`train.py` hardcoded CSV directory:** no fallback path. Support `CSV_DIR` env override
- [ ] **Data leakage in `modern_oracle.py`:** `optimize_ensemble_weights()` passes full `training_data` (including validation samples) to `train()`
- [ ] Add pytest tests for Pro-tier models (currently 0% coverage)
- [ ] Fix `lstm_predictor.py`: `prepare_sequences` calls `scaler.fit_transform` on inference data — should be `transform` only
- [ ] Fix `transformer_model.py`: same `scaler.fit_transform` during inference bug
- [ ] Fix `xgboost_model.py`: `_optimize_hyperparameters` passes `n_estimators` to `xgb.train()` — ignored (should be `num_boost_round`)
- [ ] Fix `modern_oracle.py`: `train_all_models` uses random val split — data leakage from future matches
- [ ] Fix `modern_oracle.py`: `predict_match_natural_language()` calls `self.agent_executor.run()` synchronously in `async` method — blocks event loop
- [ ] Fix `modern_oracle.py`: LangChain `create_react_agent` prompt missing `{tools}` and `{tool_names}` variables
- [ ] Fix `lstm_predictor.py:537-540`: synthetic `np.random` fallback training data (also covered by P2s)
- [ ] Fix `lstm_predictor.py` + `transformer_model.py`: `torch.load()` without `weights_only=True` — PyTorch 2.0+ security warning
- [ ] Fix `xgboost_model.py`: `_optimize_hyperparameters()` imports `optuna` unconditionally, bypassing `OPTUNA_AVAILABLE` guard
- [ ] Fix `xgboost_model.py`: `predict_single_match()` passes feature dict → DataFrame without ensuring column ordering matches `self.feature_names`
- [ ] ROI simulation (betting on all predictions at estimated odds — deferred from P3-Free evaluation metrics)

### P3d. Security Layer Fixes

- [ ] `auth.py`: `SECRET_KEY` regenerated every restart (should be env var)
- [ ] `auth.py`: mock user database lookup (line 434)
- [ ] `auth.py`: brute force protection broken (per-request dict, not persistent)
- [ ] `auth.py`: Redis connection never established
- [ ] `auth.py`: HS256 used despite docstring claiming RS256
- [ ] **All 3 security files** (`auth.py`, `secrets.py`, `validators.py`) are **completely unused at runtime** — not imported by `main.py`. Consider removing or properly wiring them
- [ ] `main.py` bearer tokens on `/predict/natural` and `/admin/retrain` are **never verified** — any bearer string passes
- [ ] `main.py` global exception handler returns raw `str(exc)` in response body, leaking internal error details
- [ ] `main.py` WebSocket handler missing `oracle` null guard — silent disconnect when deps missing
- [ ] `main.py`: `response.dict()` deprecated in Pydantic v2 — should be `.model_dump()`
- [ ] `main.py`: CORS only allows `localhost:5173` and `localhost:4173` — no production Vercel domain listed
- [ ] `main.py` WebSocket handler: `active_websockets.remove(websocket)` will raise `ValueError` if socket was never appended. Use `set.discard()`
- [ ] `secrets.py`: Azure Key Vault imported but no provider class; hard imports `boto3`, `hvac`, `azure` with no guards
- [ ] `secrets.py`: `SecureConfig.__init__` requires `DATABASE_URL` which doesn't exist
- [ ] `secrets.py`: audit log in-memory only
- [ ] `validators.py`: `VALID_TEAMS` has 2023/24 clubs (Burnley/Luton/Sheffield — missing Leicester/Ipswich/Southampton)
- [ ] `validators.py`: `ValidationError` raised incorrectly (will TypeError at runtime — Pydantic V2 doesn't accept bare string)
- [ ] `validators.py`: SQL blacklist blocks natural language queries containing "from" or "where"
- [ ] `validators.py`: SQL blacklist would reject team name "Nottingham Forest" — `'from'` is a substring of `'Forest'`
- [ ] `validators.py`: `html.escape()` applied to team names breaks `&` characters — `Brighton & Hove Albion` becomes `Brighton &amp; Hove Albion`
- [ ] `lstm_predictor.py` and `transformer_model.py` have unguarded `import torch` at module level — will crash if torch not installed
- [ ] `requirements.txt` missing `torch` — LSTM and Transformer models require PyTorch but it's only in `environment.yml` (conda)
- [ ] `requirements.txt` includes `python-jose` (3.3.0) and `passlib` (1.7.4) — both unmaintained since 2022. Only used by dead security modules
- [ ] `football_data_collector.py`: `time.sleep()` in `_enforce_rate_limit()` — blocks asyncio event loop if called from async endpoints

---

## Active Stubs (known hardcoded values remaining)

### Frontend

| Location | Problem | Priority |
|----------|---------|----------|
| `advancedPredictions.ts` | `avgPenalties: 0.2` — no penalty data from free API tier | Low |
| `advancedPredictions.ts` | `SEED_RATINGS` — 25 teams with manually assigned ELO, not backcalculated. Includes relegated teams | Low |
| `advancedPredictions.ts` | `ratingReliability = 0.8` — constant, should reflect actual model accuracy | Low |
| `advancedPredictions.ts` | `HOME_ADVANTAGE = 65` ELO points — static, should vary by team | Low |
| `advancedPredictions.ts` | Default referee stats (`avgYellowCards: 4, avgRedCards: 0.1, homeWinRate: 0.46`) | Low |
| `optimizedPredictions.ts` | `MODEL_WEIGHTS` — static ensemble weights, not derived from backtesting | Low |
| `optimizedPredictions.ts` | `eloDrawProb = 0.265 * Math.exp(-ratingDiffAbs / 600)` — base 26.5% and scale 600 hardcoded | Low |
| `optimizedPredictions.ts` | Form weight array `[0.35, 0.25, 0.20, 0.12, 0.08]` — arbitrary decay | Low |
| `optimizedPredictions.ts` | `homeMomentum * 1.1` / `awayMomentum * 0.9` — arbitrary 10% home advantage in form | Low |
| `optimizedPredictions.ts` | Confidence boost/penalty thresholds and values — all hardcoded | Low |
| `optimizedPredictions.ts` | Fallback prediction returns static `{result: 'D', confidence: 0.33, goals: 1-1, odds: 3.0/3.3/3.0}` | Low |
| `optimizedPredictions.ts` | `getStandingsProbabilities` — `0.025` per position-difference step is arbitrary | Low |
| `optimizedPredictions.ts` | `getStandingsProbabilities` no-data fallback uses `homeWin: 0.40` instead of `DEFAULT_HOME_WIN_RATE` (0.46) | P5o |
| `optimizedPredictions.ts:278` | `predictScoreProbabilities(..., 5)` — maxGoals should be 7 per spec | P5n |
| `Predictions.svelte` | `PoissonPredictor.predictScoreProbabilities(..., 6)` — maxGoals should be 7 per spec | P5n |
| `value.ts:234` | Local Poisson implementation uses `maxGoals = 10` — should be 7 per spec | P5n |
| `advancedPredictions.ts` | `SEED_RATINGS` includes relegated teams (Leeds, Luton, Burnley, Sheffield United) | Low |
| `betBuilder.ts:441` | `'Over 7.5 corners'` string hardcoded — not derived from `corners` predictions object | Low |
| `betBuilder.ts` | `avgCorners: 9.5` — no corner data from free tier | Low |
| `betBuilder.ts` | `expectedCards: 3.2` — no card data from free tier | Low |
| `betBuilder.ts` | `ftBias = 0.4` — HT-FT correlation arbitrarily set at 40% | Low |
| `betBuilder.ts` | `homeCleanSheet` prediction threshold 0.3 — no empirical basis | Low |
| `ChatBot.svelte` | Model hardcoded as `gpt-4o-mini` | Low |
| `Predictions.svelte` | `estimatedBookmakerOdds = (1 / topProb) * 1.05` — fabricated margin | Low |
| `Predictions.svelte` | 300ms artificial delay in `predictGameweek` — cosmetic fake loading | Low |
| `Predictions.svelte` | `totalGameweeks = 38` hardcoded — never updated from API season data | Low |
| `value.ts` | `MIN_CONFIDENCE = 0.55` — filters out most draw/away predictions | Low |
| `kelly.ts` | `Math.random()` in `simulate()` — non-deterministic Monte Carlo | Low |
| `liveService.ts` | WebSocket `onmessage` handler for `data.liveMatches` — dead code, backend never sends this | P5g |
| `liveService.ts` | WebSocket URL hardcodes port `8000` — breaks production deployments | P5i |

### Backend

| Location | Problem | Priority |
|----------|---------|----------|
| `advanced_engineering.py` | 63 methods return `0.0` (tactics, players, betting, weather, advanced) | P3a |
| `advanced_engineering.py` | `0.45` fallback win rate when no match data | Low |
| `football_data_collector.py` | `get_head_to_head()` returns empty DataFrame | P3b |
| `football_data_collector.py` | `get_team_form()` confusing result-flip logic | P3b |
| `lstm_predictor.py` | `get_feature_importance()` returns `np.random.random()` | P3c |
| `modern_oracle.py` | `optimize_ensemble_weights()` returns `np.random.random()` | P3c |
| `modern_oracle.py` | `_calculate_betting_value()` uses mock odds | P3c |
| `modern_oracle.py` | Calls non-existent `data_collector.get_team_stats()` | P3b |
| `modern_oracle.py` | Wrong kwarg `last_n=5` (should be `n_matches`) | P3b |
| `modern_oracle.py` | LSTM sequence is 10× duplicate single row | P3c |
| `transformer_model.py` | Save/load only saves 2 of 8 constructor params | P3c |
| `transformer_model.py` | `val_accuracy` UnboundLocalError | P3c |
| `transformer_model.py` | `num_decoder_layers` silently ignored | P3c |
| `lstm/transformer_model.py` | Shallow `.copy()` on `state_dict()` — best model state mutable | P3c |
| `auth.py` | `SECRET_KEY` regenerated every restart | P3d |
| `auth.py` | Entirely unused at runtime — not imported by main.py | P3d |
| `secrets.py` | Hard imports cloud SDKs — crash without them | P3d |
| `secrets.py` | Entirely unused at runtime | P3d |
| `validators.py` | `VALID_TEAMS` outdated (2023/24 season clubs) | P3d |
| `validators.py` | `ValidationError` TypeError at runtime | P3d |
| `validators.py` | SQL blacklist blocks "from"/"where" in NL queries | P3d |
| `validators.py` | Entirely unused at runtime | P3d |
| `main.py` | `/admin/retrain` returns mock response | P3c |
| `main.py` | Bearer tokens on 2 endpoints never verified | P3d |
| `main.py` | Global exception handler leaks raw error strings | P3d |
| `main.py` | CORS only allows localhost — no production origin | P3d |
| `main.py` | WebSocket loop has no null-guard for oracle=None | P3c |
| `main.py` | `response.dict()` deprecated (Pydantic v2) | P3d |
| `main.py` | `/features/importance` doesn't guard against None LSTM/Transformer | P2r |
| `main.py` | `total_features` hardcoded to `150`, not dynamically counted | Low |
| `main.py` | `client_ip` always `"unknown"` — rate limiter non-functional | P5a |
| `main.py` | Free-tier engineer init with empty DataFrame when CSVs absent | P5a |
| `lstm_predictor.py` | `prepare_sequences` calls `scaler.fit_transform` on inference data | P3c |
| `transformer_model.py` | Same `scaler.fit_transform` during inference bug | P3c |
| `xgboost_model.py` | `_optimize_hyperparameters` wrong param for `xgb.train` | P3c |
| `modern_oracle.py` | `train_all_models` uses random val split — data leakage | P3c |
| `football_data_collector.py` | `get_team_form()` mixed `'H'`/`'A'` and `'W'`/`'L'` values | P3b |
| `requirements.txt` | Missing `torch` — LSTM/Transformer non-functional via pip | P3d |
| `requirements.txt` | `python-jose` + `passlib` unmaintained since 2022 | P3d |
| `lstm_predictor.py` | Synthetic `np.random` training data fallback | P2s |
| `modern_oracle.py` | LangChain ReAct prompt missing required variables | P3c |
| `modern_oracle.py` | Blocking `agent_executor.run()` in async method | P3c |
| `advanced_engineering.py` | `_is_derby_match()` API names vs CSV short names — always `0.0` | P3a |
| `advanced_engineering.py` | `_compute_league_positions()` cumulative all-time, not per-season | P3a |
| `validators.py` | `html.escape()` corrupts `Brighton & Hove Albion` | P3d |
| `requirements.txt` | `boto3`, `hvac`, `azure-*`, `sqlalchemy` — heavy dead deps | P2r |
| `requirements.txt` | `passlib==1.7.4` incompatible with Python 3.13 | P2r |
| `requirements.txt` | Missing `langchain-community` | P2r |
| `requirements.txt` | Missing `bcrypt` | P2r |

---

## Specs

All feature specifications in `specs/`:

| File | Topic | Implementation Status |
|------|-------|-----------------------|
| `specs/01-prediction-engine.md` | ELO, Poisson, fatigue, referee, confidence, backtesting | ~75% — missing: Poisson from real stats (Req 2), confidence calibration P5m (Req 5). **Markers: 5/8** |
| `specs/02-data-pipeline.md` | Football-Data.org integration, caching, historical data | ~65% — missing: progressive 5-season bulk loader (Req 5), batch rate limiting (Req 7). **Markers: 6/8** |
| `specs/03-backend-integration.md` | Python ML backend connection | ~85% — missing: AGENTS.md historical data command (Req 6). **Markers: 7/8** |
| `specs/04-betting-intelligence.md` | Kelly, value bets, bet history, accumulators | ~90% — missing: accumulator/combination bet UI (Req 12). **Markers: 11/12** |
| `specs/05-live-data.md` | Live scores, smart polling, WebSocket | ~80% — missing: match event notifications (Req 9), extra-time status filter P5q. **Markers: 9/10** |
| `specs/06-prediction-tracking.md` | Accuracy tracking, auto-reconciliation | **100% — ALL 7/7 criteria met** |
| `specs/07-ui-ux.md` | shadcn-svelte migration, dark mode, accessibility | ~75% — remaining: Dialog (Req 5), Sheet (Req 8), form strings from real data, dead code. **Markers: 13/17** |
| `specs/08-backend-training.md` | Backend training pipeline (free-tier + Pro-tier) | ~95% — P3-Free DONE, Pro-tier deferred. Rate limiter IP fix P5a (Req 4d). **Markers: 23/24** |

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
| `advancedPredictions.test.ts` | 22 | Passing |
| `betHistoryService.test.ts` | 27 | Passing |
| `footballData.test.ts` | 23 | Passing |
| `kelly.test.ts` | 13 | Passing |
| `types.test.ts` | 4 | Passing |
| `predictionTracker.test.ts` | 18 | Passing |
| `ChatBot.test.ts` | 18 | Passing |
| `Predictions.test.ts` | 17 | Passing |
| `BettingHistory.test.ts` | 15 | Passing |
| `KellyCalculator.test.ts` | 15 | Passing |
| `backtest.test.ts` | 15 | Passing |
| `Dashboard.test.ts` | 12 | Passing |
| `optimizedPredictions.test.ts` | 18 | Passing |
| `ValueBets.test.ts` | 12 | Passing |
| `dataService.cache.test.ts` | 8 | Passing |
| `dataService.test.ts` | 8 | Passing |
| `Settings.test.ts` | 16 | Passing |
| `LiveMatches.test.ts` | 9 | Passing |
| `liveService.test.ts` | 14 | Passing |
| `backendService.test.ts` | 19 | Passing |
| `aiAnalysis.test.ts` | 24 | Passing |
| **Total** | **375** | **All passing** |

**Known test quality issues:** See P5e for outstanding test quality items. Component tests using `(component as any).refresh()` bypass `onMount` — fragile if internal methods renamed.

**Untested components (10):** SeasonStats, StandingsTable, TopScorers, Help, App, ApiSetupWizard, MatchList, LiveTicker, MobileNav, Sidebar

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

**62 tests across 3 files** — all passing. Covers free-tier features (39), training pipeline (12), and API endpoints (11). Pro-tier models and data collector have 0% test coverage. Security modules are entirely unused at runtime and untested.
