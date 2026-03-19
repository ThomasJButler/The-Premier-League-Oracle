# Premier League Oracle — Implementation Plan

Last updated: 30 March 2026 (eighteenth update — P1g wizard bug fixed, P5ah/P5w/P5y/P5z resolved)
Active branch: `v3.0-BackendMLTraining`

---

## Project Status: ~82% Complete

**v3.0 scope (excluding deferred Pro-tier P3a–d):**

| Priority | Status | Notes |
|----------|--------|-------|
| P0 Blockers | 3/3 (100%) | Backend startup, requirements audit, stale docs |
| P1 High Priority | 17/17 (100%) | ALL DONE — wizard dismiss bug fixed |
| P2 Next Sprint | 22/27 (81%) | 5 open: httpx, .gitignore gaps, environment.yml stale, Docker, CI gaps |
| P3-Free ML Pipeline | DONE | 86 features, 62 tests, API endpoints wired |
| P3e/f/g Integration | ALL DONE | ML ensemble, LiveService, AI Analysis |
| P4 Polish | 8/8 (100%) | Minor deferred sub-items only; Spec 07 UI/UX now 100% complete |
| P5 Hardening | ~36/49 (73%) | P5ah animate-fadeIn typo fixed, P5w dead CSS removed, P5y NaN guard added, P5z semantic HTML fixed |

**Frontend:** 382 Vitest tests, 43 E2E tests, 0 type errors
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

## Remaining Work — P1 (ALL DONE)

### P1g. ApiSetupWizard Dismiss Bug — DONE

- [x] Made `hasApiKey = true` conditional on `event.detail.apiKey` being non-empty in `handleApiSetupComplete`. Dismissing the wizard now correctly early-returns without setting `hasApiKey`, preventing silent data-fetch failures

---

## Remaining Work — P2 (Partial Items)

### P2n. CI/CD Pipeline — PARTIAL

- [x] GitHub Actions CI — type check, unit tests, production build on push/PR
- [ ] Consider Playwright E2E in CI (heavier, but valuable — deferred to later)
- [ ] Add coverage enforcement to CI — `vitest.config.ts` defines 80%/75%/80%/80% thresholds but CI runs `test:run` not `test:coverage`
- [ ] Add linting step to CI (no ESLint or ruff currently runs in the pipeline)

### P2o. Docker Cleanup

`backend/docker-compose.yml` references files and directories that don't exist. Running `docker-compose up` fails immediately.

- [ ] `config.yml` — referenced by `Dockerfile COPY` but doesn't exist. Create a minimal config or remove the COPY
- [ ] `nginx.conf` — referenced as a volume mount but doesn't exist. Create or remove from compose
- [ ] `notebooks/` — mounted as a volume but directory doesn't exist. Create or remove from compose
- [ ] `POSTGRES_PASSWORD` required by compose but no `.env.example` template documents it
- [ ] `setup.sh` creates `data/`, `logs/`, `notebooks/` directories that `docker-compose.yml` depends on as bind-mount sources — this dependency is undocumented

### P2r. Config & Infrastructure — PARTIAL

**Version pinning:**

- [x] Fixed `requirements.txt` header from Python 3.13 to Python 3.11 (matching Dockerfile and CI)
- [ ] `passlib==1.7.4` is incompatible with Python 3.13 — the `crypt` module was removed from stdlib in 3.13. (Only used by dead `auth.py` module, so low runtime risk)

**Backend dead dependencies in `requirements.txt`:**

- [x] Removed dead security deps (`python-jose`, `passlib`, `cryptography`, `boto3`, `hvac`, `azure-keyvault-secrets`, `azure-identity`, `sqlalchemy`) and unused Pro-tier deps (`mlflow`, `optuna`, `chromadb`, `langchain*`, `python-dotenv`) from `requirements.txt` — ~30MB+ install saved
- [ ] Add `pyyaml` and `httpx` if needed (present in `environment.yml` but missing from `requirements.txt`)

**Backend missing dependencies in `requirements.txt`:**

- [ ] Add `langchain-community` — `modern_oracle.py` imports it but package is separate from `langchain` and not listed
- [ ] Add `bcrypt` — `auth.py` uses `passlib` with `CryptContext(schemes=["bcrypt"])` which requires it
- [x] Fix `main.py:590,594`: `/features/importance` endpoint accesses `oracle.lstm_model.model` and `oracle.transformer_model.model` without checking if they are not None — will `AttributeError` when torch missing

### P2t. requirements.txt Missing httpx

`httpx` is needed to run the backend test suite (pytest-asyncio async HTTP tests) but is not in `requirements.txt`. CI works around this with `pip install -r requirements.txt httpx` but a local `pip install -r requirements.txt` will fail to run tests.

- [ ] Add `httpx` to `requirements.txt` (or create a `requirements-test.txt`)

### P2u. .gitignore Gaps

- [ ] `backend/models/*.joblib` not ignored — trained model file (`xgboost_free_tier.joblib`) is unprotected from accidental commit. Binary model files typically don't belong in version control
- [ ] `frontend/.env.local` and `frontend/.env.production.local` not covered — standard Vite local override files could leak secrets if created

### P2v. environment.yml Stale

`backend/environment.yml` was not updated when dead deps were removed from `requirements.txt` in P2r.

- [ ] Remove dead security module deps (`python-jose`, `passlib`, `cryptography`, `python-dotenv`, `sqlalchemy`) from `environment.yml`
- [ ] Move `shap`, `optuna`, `mlflow` to a commented-out Pro-tier section (consistent with `requirements.txt`)
- [ ] Confirm `httpx` is present (it is — but should also be in `requirements.txt` per P2t)

### P2s. LSTM Synthetic Training Data — DONE

- [x] `lstm_predictor.py` `train()` now raises `ValueError` when called with empty data instead of proceeding silently
- [x] `__main__` demo block clearly labelled as synthetic data — not real training

---

## Remaining Work — P5 (Hardening)

### P5a. Backend Rate Limiter — PARTIAL

`main.py:724-725`: `client_ip` parameter on `/predict/free` is declared with a default of `"unknown"` and never extracted from the actual HTTP request. All clients share a single rate-limit bucket.

- [x] Extract real client IP from `request.client.host` (with `X-Forwarded-For` header fallback for reverse proxies)
- [x] Test that per-IP bucketing actually isolates clients

Additionally, the free-tier feature engineer is initialised with an empty DataFrame when CSVs are absent (gitignored). All features return `0.0` for live predictions with no warning.

- [x] Log a clear warning when CSV data is unavailable and the engineer is running on empty data
- [ ] Document how to obtain the CSV training data in the README or a setup script

### P5c. Backend CI Pipeline — DONE

- [x] Added `backend` job to `.github/workflows/ci.yml` — Python 3.11 (matching Dockerfile), `pip install -r requirements.txt httpx`, `python -m pytest tests/ -v`. Runs in parallel with frontend job
- [ ] Consider adding Playwright E2E tests to CI (heavier, needs `npx playwright install`)

### P5e. Test Quality — DONE

- [x] `ChatBot.test.ts`: DOMPurify mock now uses a spy that verifies sanitize() is called with response content
- [x] `liveService.test.ts`: WebSocket `onmessage` now triggered via `simulateMessage()` — store update asserted
- [x] `optimizedPredictions.test.ts`: conditional `if (prediction.valueOdds)` guard removed — assertions always execute
- [x] `advancedPredictions.test.ts`: empty loop renamed to document intentionally empty valueBets

### P5f. Type Safety — PARTIAL

Remaining `any` types in production code (not catch blocks):

- [x] `optimizedPredictions.ts:493,515` — `(form: any[])` → `TeamForm[]`
- [x] `optimizedPredictions.ts:783,784` — `formAnalysis: any`, `h2hAnalysis: any` → named `FormAnalysis`/`H2HAnalysis` interfaces
- [x] `footballData.ts:104` — `Map<string, { data: any }>` → `{ data: unknown }` with explicit cast on retrieval

Remaining (Svelte 4 framework limitations — cannot be resolved without `any`):

- [ ] `SeasonStats.svelte:10` — `icon: any` required for Svelte 4 component constructor typing
- [ ] `Sidebar.svelte:57` and `MobileNav.svelte:36` — `handleKeydown(e: any)` required because Svelte 4 types `on:keydown` as `CustomEvent`, not `KeyboardEvent`

### P5g. Config & Infrastructure — PARTIAL

- [x] `.github/workflows/ci.yml`: now uses `node-version-file: .nvmrc` instead of hardcoded `node-version: 20`
- [x] `.gitignore`: `backend/chroma_db/` IS already gitignored (line 20) — the prior CLAUDE.md note was incorrect. No action needed
- [ ] `vite.config.ts`: `GET /api/chat` dev proxy has no production equivalent — `api/chat.ts` Edge Function only handles POST. Frontend `checkServerKey()` probe may 405 in production
- [x] `liveService.ts:247-249`: WebSocket `onmessage` handler for `data.liveMatches` dead code removed — backend never sends this payload; test updated

### P5i. WebSocket URL Hardcodes Port 8000 — DONE

`liveService.ts:235` previously hardcoded port 8000 in the WebSocket URL, causing silent failures in production deployments where the backend is not on port 8000. Polling fallback masked the failure.

- [x] WebSocket URL now configurable via `VITE_BACKEND_WS_URL` environment variable, with fallback to `hostname:8000`
- [x] Base URL derived consistently from the configurable constant

### P5l. Minor Dead Code and Type Cleanup — DONE

- [x] `TopScorers.svelte:56` — removed `(s: any)` cast and nonexistent `FDScorer` fallback properties

### P5m. Spec 01 — Confidence Calibration — DONE

Spec 01 Req 5 requires tracking accuracy by confidence band over time and adjusting future confidence scores. `calculateConfidence()` now includes a feedback loop based on historical prediction accuracy.

- [x] `getCalibrationFactors()` added to `predictionTracker.ts` — returns `{ highBand: factor, mediumBand: factor, lowBand: factor }` computed from stored prediction outcomes
- [x] Calibration factors wired into `OptimizedPredictor.predictMatch()` as a post-processing multiplier on the confidence score
- [x] 6 tests added covering calibration factor calculation and its effect on predicted confidence

### P5n. Poisson maxGoals Inconsistency — DONE

The spec says cap Poisson at 7 goals. `advancedPredictions.ts` was fixed (P5l). All remaining call sites now corrected:

- [x] `optimizedPredictions.ts:278` — changed from 5 to 7
- [x] `Predictions.svelte` — changed from 6 to 7
- [x] `value.ts:234` — changed from 10 to 7

Additionally, `value.ts` previously had its own private Poisson re-implementation. `betBuilder.ts` already imported `PoissonPredictor` from `advancedPredictions.ts` (the ninth audit note of "three separate implementations" was incorrect — there were only two). `value.ts` now also imports and uses `PoissonPredictor`. There is now a single Poisson implementation across the frontend.

- [x] Consolidated to a single Poisson implementation — `value.ts` now imports `PoissonPredictor` from `advancedPredictions.ts`. `betBuilder.ts` already did this. Single source of truth achieved.

### P5o. getStandingsProbabilities Fallback Inconsistency — DONE

`optimizedPredictions.ts:644` — the no-data fallback previously used `homeWin: 0.40` instead of the canonical `DEFAULT_HOME_WIN_RATE` (0.46). This was a **different location** from the H2H fallback fixed in P5k.

- [x] Changed `getStandingsProbabilities` no-data fallback from `0.40` to `DEFAULT_HOME_WIN_RATE` (0.46), with draw/away derived proportionally

### P5p. Backtest ELO processedMatchIds Leak — DONE

`backtest.ts` snapshots and restores the ELO ratings map before/after a backtest run. Previously it did NOT snapshot/restore the `processedMatchIds` Set, leaving backtest-processed matches permanently marked and blocking future live ELO updates.

- [x] Added `getProcessedMatchIds()` and `setProcessedMatchIds()` methods to `EloRatingSystem`
- [x] `backtest.ts` now snapshots `processedMatchIds` before the run and restores it alongside the ratings map

### P5q. Live Match Status Filter Incomplete — DONE

`dataService.getLiveMatches()` previously queried for `IN_PLAY,PAUSED` statuses only. Matches in extra time or a penalty shootout disappeared from the live view entirely.

- [x] Added `EXTRA_TIME,PENALTY_SHOOTOUT` to the live matches status filter in `footballData.ts`

### P5r. ApiSetupWizard Accessibility (WCAG 2.1) — DONE

The `ApiSetupWizard.svelte` dialog has two WCAG failures independent of the shadcn Dialog migration (Spec 07):

- [x] Focus is not moved to the dialog on open — `use:focusTrap` auto-focuses first focusable element
- [x] No `Escape` key handler to dismiss the dialog — `on:keydown` handler added, plus click-outside-to-close on backdrop

### P5s. Dead Code Cleanup — PARTIAL

Confirmed dead exports, unused constants, and orphaned CSS discovered in ninth audit. Several items completed:

- [x] `$lib/utils/cn.ts` duplicate deleted — all 10 shadcn component imports updated to `$lib/utils`
- ~~`predictionTracker.ts`: `GameweekAccuracy` interface and `getAccuracyByGameweek()` method~~  **NINTH AUDIT CORRECTION:** These are NOT dead code — `getAccuracyByGameweek()` is actively used by `Dashboard.svelte:194`. Removed from dead code list.
- [x] `kelly.ts`: standalone `isValueBet()` function removed
- [x] `aiAnalysis.ts`: `MAX_CACHED_ANALYSES = 50` removed
- [x] `advancedPredictions.ts`: dead `TeamRating` interface removed
- [x] `app.css`: `.match-card`, `.match-score`, `.chart-container` dead classes removed
- [x] `app.css`: dead `@keyframes scroll` ticker animation removed
- [x] `main.py:24`: `timedelta` import removed
- [x] `modern_oracle.py:18`: `asyncio` import removed
- [ ] `SeasonStats.svelte:96`: `currentStreak` variable declared and initialised to `0` but never written to or read — the streak calculation uses a separate local `streak` variable (line 118)
- [ ] `ApiSetupWizard.svelte`: `selectedProvider` is a dead variable — typed as `'football-data'` (single-value union), assigned but functionally trivial
- [ ] `value.ts`: `MarketOdds.bttsNo` field defined in interface but never used — "BTTS No" value bets are never generated. Vestigial field

### P5t. Frontend Resilience — PARTIAL

- [x] `footballData.ts`: AbortController with 15s timeout added to `rateLimitedFetch()` — prevents hung API calls from blocking the rate-limit queue
- [x] `dataService.ts`: error contract documented — essential data methods (`getMatches`) throw so callers can surface errors; supplementary methods (`getTeamStats`, `getTeamForm`) return null/empty so optional UI sections degrade gracefully rather than crashing the page
- [x] `Predictions.svelte`: `catch (error)` renamed to `catch (err)` — no longer shadows outer reactive error state

### P5u. LiveMatches Minute Display Gap

`LiveMatches.svelte:85-90`: `getMinute()` only computes elapsed time for `IN_PLAY` and `PAUSED` statuses. Matches in `EXTRA_TIME` or `PENALTY_SHOOTOUT` (added to the live query in P5q) show an empty minute string despite having a valid kick-off time.

- [ ] Extend `getMinute()` to estimate elapsed time for `EXTRA_TIME` (e.g. show `90+N'` based on kick-off) and `PENALTY_SHOOTOUT` (show `PEN`)

### P5v. WebSocket onmessage No-Op

`liveService.ts:244-249`: The WebSocket `onmessage` handler parses incoming JSON but discards it entirely — the connection is established but delivers no data to any Svelte store. This makes the entire WebSocket infrastructure dead weight (the WS connection costs a network socket but provides no value).

- [ ] Either wire parsed data into the appropriate store, or remove the WebSocket connection until the backend sends payload that the frontend needs. Currently the backend only sends prediction probability updates which nothing consumes

### P5w. Dead Global CSS Rules — DONE

- [x] Removed dead `.live-ticker`, `.ticker-content`, and `.ticker-content:hover` global rules from `app.css` — all overridden by LiveTicker.svelte local styles

### P5x. Frontend CSS/Class Bugs — CORRECTED

**Seventeenth audit correction:** `hover:shadow-glow-primary-sm` IS defined in `tailwind.config.js:69` (`boxShadow.glow-primary-sm`) — false positive removed. `animate-fade-in` IS defined globally in `tailwind.config.js:78` (`fade-in` animation with `fadeIn` keyframe) — BettingHistory and MatchList animations DO work (opacity-only, vs Predictions.svelte's local version which adds translateY). Only 1 real bug remains:

- [ ] `Dashboard.svelte:87`: `dark:text-primary-light` — undefined token, icon renders wrong colour in dark mode. No `primary-light` colour key exists in the Tailwind config (only `primary.DEFAULT` and `primary.foreground`)

### P5y. SeasonStats NaN Guard — DONE

- [x] Guarded `totalGoals` division with `> 0` check — displays "N/A" when no goals scored instead of `NaN%`

### P5z. renderMarkdown Semantic HTML — DONE

- [x] Bullet list items now wrapped in `<ul>`, numbered list items wrapped in `<ol>` — correct semantic HTML for screen reader list navigation

### P5aa. Home Advantage Double-Counting — DONE

The prediction ensemble applies home advantage twice:
1. ELO model: `HOME_ADVANTAGE = 65` ELO points added in `EloRatingSystem.calculateWinProbability()`
2. Form model: `homeMomentum * 1.1` / `awayMomentum * 0.9` in `optimizedPredictions.ts:analyzeRecentForm()`

This systematically inflates home win probabilities. The fix is to remove the 10% form bias (the ELO home advantage is the correct one).

- [x] Removed `* 1.1` / `* 0.9` home/away momentum adjustments from `analyzeRecentForm()` — ELO already accounts for home advantage

### P5ab. Backtest localStorage Noise

`backtest.ts`: During a backtest run, `EloRatingSystem.updateRatings()` calls `saveToStorage()` on every match. These writes are immediately overwritten when the backtest restores the ELO snapshot at the end. This is unnecessary I/O (~300+ localStorage writes per full-season backtest).

- [ ] Add a `suppressStorage` flag to `EloRatingSystem.updateRatings()` or skip `saveToStorage()` during backtest runs

### P5ac. betBuilder Half-Time Prior Bias — DONE

`betBuilder.ts:calculateHalfTimeResult()`: The HT result priors sum to 0.95, not 1.0 (`priorHome=0.25 + priorDraw=0.45 + priorAway=0.25`). Normalisation corrects the output, but the missing 5% introduces a small systematic bias.

- [x] Corrected priors to 0.26 + 0.46 + 0.28 = 1.0, matching real PL HT distributions

### P5ad. FatigueAnalyzer Congestion Branch Dead

`advancedPredictions.ts`: `FatigueAnalyzer.getFatigueMultiplier()` has a `recentFixtures` parameter for fixture congestion, but every caller passes `1`. The congestion component of the formula never activates.

- [ ] Either wire `recentFixtures` from real match scheduling data, or simplify the formula to remove the dead congestion branch

### P5ae. Test Quality — Newly Discovered Issues

Several test files have assertions that pass when they shouldn't:

- [ ] `backtest.test.ts:154-178`: Expected value `0.525` encodes the Kelly 1.05 inflation bug — actively prevents fixing the bug. Update to `0.50` when P1l is fixed
- [ ] `liveService.test.ts:287-300`: WS test passes BECAUSE the handler discards data — test should assert data reaches the store (or be removed until P5v is resolved)
- [ ] `value.test.ts`: Three tests assert only `Array.isArray(result)` — should also assert `result.length > 0` and check element shape
- [ ] `test_free_tier_features.py`: H2H test conditionally skips assertions when `h2h_total_matches == 0`; basic stats test uses weak `or` assertion
- [ ] `test_predict_free_tier.py`: No happy-path test for `/predict/free` with a loaded model; no test for `_get_client_ip()` X-Forwarded-For extraction

### P5af. Backend Path Fragility

`main.py`: Model and CSV paths use `Path("models")` and `Path("../spreadsheets")` relative to the current working directory, not relative to the file. Starting the server from any directory other than `backend/` silently fails to load the model.

- [ ] Resolve paths relative to `__file__` (e.g. `Path(__file__).parent.parent.parent / "models"`) for robustness

### P5ag. Spinner and Button Inconsistency

Three different spinner implementations exist across components (none use the `spinner-branded` class from `app.css`). Multiple components use raw `<button>` instead of the shadcn `<Button>` component for the same category of actions (refresh, retry, filter).

- [ ] Consolidate spinners to a single pattern or shared component
- [ ] Migrate remaining raw `<button>` elements to shadcn `<Button>` where appropriate (StandingsTable, TopScorers, LiveMatches, MatchList refresh/retry/filter buttons)

### P5ah. App.svelte animate-fadeIn Typo — DONE

- [x] Changed `animate-fadeIn` to `animate-fade-in` — page transition overlay now fades correctly

### P5ai. Help.svelte Typography Plugin Missing — DONE

`Help.svelte` uses `prose prose-slate dark:prose-invert` classes in 6 wrapper `<div>` elements, and has local `@apply .prose h2/h3/h4` rules in its `<style>` block. However, `@tailwindcss/typography` is not installed as a dependency or listed in `tailwind.config.js` plugins. All prose styling is silently non-functional — headings, lists, and body text render with default browser styles rather than the Tailwind typography system.

- [x] Install `@tailwindcss/typography` (`npm install -D @tailwindcss/typography`)
- [x] Add `require('@tailwindcss/typography')` to `tailwind.config.js` plugins array

### P5aj. Header.svelte Missing aria-expanded — DONE

`Header.svelte`: The sidebar toggle button (hamburger menu) has `aria-label="Toggle menu"` but no `aria-expanded` attribute. Screen reader users cannot determine whether the sidebar is currently open or closed.

- [x] Added aria-expanded={isSidebarOpen} to sidebar toggle button, with isSidebarOpen prop passed from App.svelte

### P5ak. Dead Service Methods

Several exported service methods are never called from any component or test:

- [ ] `backendService.predictBatch()` — fully implemented but no consumer exists
- [ ] `backendService.getTeamStats()` — fully implemented but no consumer exists
- [ ] `backendService.headers(includeAuth=true)` — the bearer-token branch is never reached (all callers use `this.headers()` without arguments)
- [ ] `KellyCalculator.simulate()` — Monte Carlo simulation with `Math.random()`, never called from any component or test
- [ ] `aiAnalysis.invalidateServerKeyCache()` — public method, no caller exists

### P5al. betBuilder correlationAdjustment Inconsistency

`betBuilder.ts`: `correlationAdjustment()` applies correlation multipliers (1.15, 1.10, 0.85) to improve combo probability accuracy by accounting for market dependencies. It is applied to "Value Builder" and "Goals Galore" combos but NOT to "Safe Builder" or "High Risk Builder" combos — producing less accurate combined odds for those two combo types.

- [ ] Apply `correlationAdjustment()` consistently to all four combo generators, or document why only specific combos use it

### P5am. Dockerfile Runs as Root

`backend/Dockerfile` creates no non-root user. The application runs as root inside the container, which is a security concern for production deployments.

- [ ] Add a non-root user (e.g. `RUN adduser --disabled-password appuser`) and `USER appuser` directive

### P5an. test_setup.py False Confidence

`backend/test_setup.py` defines `test_imports()` which prints import status but makes zero assertions. pytest collects it and reports it as "passed" regardless of whether imports actually succeeded — providing false confidence in CI output.

- [ ] Either add proper assertions that fail when critical imports are missing, or rename to a non-test file (e.g. `check_imports.py`) so pytest does not collect it

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
- [ ] **P5u:** `SeasonStats.svelte`: "Most Cards" stat uses `Calendar` icon — wrong icon for a disciplinary stat, should be `AlertTriangle` or similar
- [ ] **P5u:** `MobileNav.svelte`: "More" toggle button missing `aria-expanded` attribute — screen readers get no open/close feedback
- [ ] **P5u:** `KellyCalculator.svelte`: Refresh button missing `aria-label`; confidence range slider uses `on:change` (not fired by keyboard drags) instead of `on:input`
- [ ] **P5u:** `Settings.svelte`: `dispatch('apiConfigured')` fires a 5-second `setTimeout` that is not cleaned up in `onDestroy` — callback can fire after component unmounts in SPA navigation
- [ ] **P5u:** `ApiSetupWizard.svelte`: Close button `aria-label="Skip setup wizard"` is misleading — action is dismiss/close, not skip
- [ ] **P5u:** `BettingHistory.svelte`: Stat card `animation-delay` inline styles not guarded by `prefers-reduced-motion`
- [ ] **P5u:** `Spec 02` status section says "Backend ML proxy: NOT DONE" but `/api/oracle` proxy IS configured at `vite.config.ts:120` since P2b — spec status is stale
- [ ] **P5x:** `Dashboard.svelte:436`: Profit/Loss `<canvas>` has no `role="img"` or `aria-label` (accessibility gap)
- [ ] **P5x:** `Help.svelte:39`: Mobile menu `<nav>` has no `id`/`aria-controls` linking to the toggle button
- [ ] **P5x:** `TopScorers.svelte:165`: Medal emoji `<span>` elements lack `aria-label`
- [ ] **P5x:** `ChatBot.svelte:353`: Privacy copy says "never sent to our servers" — inaccurate for the server-proxy key path
- [ ] **P5x:** `Settings.svelte:292`: Section heading says "API Provider Selection" — only one provider exists (misleading)
- [ ] **P5x:** `AdvancedMatchPredictor.predictMatch` confidence is effectively constant (returns 0.85 or 0.75) — should vary with actual model signal
- [ ] **P5x:** `advancedPredictions.ts:processCompletedMatches` filters `m.status === 'FINISHED'` but `status` is optional on `Match` type — add fallback to check `m.score.fullTime` presence
- [ ] **P5x:** `betBuilder.ts:441`: `'Over 7.5 corners'` selection text mismatches the 8.5 threshold used for probability calculation
- [ ] **P5x:** `Dockerfile:COPY config.yml .` references non-existent file — Docker build fails on clean clone. `EXPOSE 5000` is misleading (MLflow port, not the app)

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
- [x] Fix `lstm_predictor.py:537-540`: synthetic `np.random` fallback training data — `ValueError` raised instead (P2s DONE)
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
| ~~`liveService.ts`~~ | ~~WebSocket `onmessage` handler for `data.liveMatches` — dead code, backend never sends this~~ | ~~P5g~~ DONE |
| ~~`liveService.ts`~~ | ~~WebSocket URL hardcodes port `8000` — breaks production deployments~~ | ~~P5i~~ DONE |

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
| ~~`main.py`~~ | ~~`/features/importance` doesn't guard against None LSTM/Transformer~~ | ~~P2r~~ DONE |
| `main.py` | `total_features` hardcoded to `150`, not dynamically counted | Low |
| ~~`main.py`~~ | ~~`client_ip` always `"unknown"` — rate limiter non-functional~~ | ~~P5a~~ DONE |
| ~~`main.py`~~ | ~~Free-tier engineer init with empty DataFrame when CSVs absent — no warning logged~~ | ~~P5a~~ DONE |
| `lstm_predictor.py` | `prepare_sequences` calls `scaler.fit_transform` on inference data | P3c |
| `transformer_model.py` | Same `scaler.fit_transform` during inference bug | P3c |
| `xgboost_model.py` | `_optimize_hyperparameters` wrong param for `xgb.train` | P3c |
| `modern_oracle.py` | `train_all_models` uses random val split — data leakage | P3c |
| `football_data_collector.py` | `get_team_form()` mixed `'H'`/`'A'` and `'W'`/`'L'` values | P3b |
| `requirements.txt` | Missing `torch` — LSTM/Transformer non-functional via pip | P3d |
| `requirements.txt` | `python-jose` + `passlib` unmaintained since 2022 | P3d |
| ~~`lstm_predictor.py`~~ | ~~Synthetic `np.random` training data fallback — raises `ValueError` instead~~ | ~~P2s~~ DONE |
| `modern_oracle.py` | LangChain ReAct prompt missing required variables | P3c |
| `modern_oracle.py` | Blocking `agent_executor.run()` in async method | P3c |
| `advanced_engineering.py` | `_is_derby_match()` API names vs CSV short names — always `0.0` | P3a |
| `advanced_engineering.py` | `_compute_league_positions()` cumulative all-time, not per-season | P3a |
| `validators.py` | `html.escape()` corrupts `Brighton & Hove Albion` | P3d |
| ~~`requirements.txt`~~ | ~~`boto3`, `hvac`, `azure-*`, `sqlalchemy`, `python-jose`, `passlib`, `mlflow`, `optuna`, `chromadb`, `langchain*`, `python-dotenv` — heavy dead/unused deps~~ | ~~P2r~~ DONE |
| ~~`requirements.txt`~~ | ~~header declared Python 3.13 (mismatching Dockerfile/CI 3.11)~~ | ~~P2r~~ DONE |
| `requirements.txt` | Missing `langchain-community` | P2r |
| `requirements.txt` | Missing `bcrypt` | P2r |

---

## Specs

All feature specifications in `specs/`:

| File | Topic | Implementation Status |
|------|-------|-----------------------|
| `specs/01-prediction-engine.md` | ELO, Poisson, fatigue, referee, confidence, backtesting | ~85% — missing: Poisson lambda from real stats (Req 2); home advantage double-counting discovered (P5aa); fatigue congestion branch dead (P5ad). **Markers: 7/8** |
| `specs/02-data-pipeline.md` | Football-Data.org integration, caching, historical data | ~75% — missing: progressive 5-season bulk loader (Req 5), batch rate limiting (Req 7). Backend proxy marker stale (done since P2b). **Markers: 6/8 (1 stale)** |
| `specs/03-backend-integration.md` | Python ML backend connection | ~90% — AGENTS.md historical data command added (Req 6 met). **Markers: 8/8** |
| `specs/04-betting-intelligence.md` | Kelly, value bets, bet history, accumulators | ~90% — missing: accumulator/combination bet UI (Req 12); HT prior bias discovered (P5ac). **Markers: 11/12** |
| `specs/05-live-data.md` | Live scores, smart polling, WebSocket | ~85% — missing: match event notifications (Req 9). Extra-time/penalty status filter fixed (P5q). **Markers: 9/10** |
| `specs/06-prediction-tracking.md` | Accuracy tracking, auto-reconciliation | **100% — ALL 7/7 criteria met** |
| `specs/07-ui-ux.md` | shadcn-svelte migration, dark mode, accessibility | ~98% — all 17 structural criteria met; 5 new CSS/class bugs found in sixteenth audit (P5x). **Markers: 17/17 structural** |
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
| `predictionTracker.test.ts` | 24 | Passing |
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
| **Total** | **382** | **All passing** |

**Known test quality issues:** P5e test quality items all resolved. Component tests using `(component as any).refresh()` bypass `onMount` — fragile if internal methods renamed.

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
