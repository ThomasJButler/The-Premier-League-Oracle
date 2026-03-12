# Premier League Oracle — Implementation Plan

Last updated: 12 March 2026

---

## Current State

### Done
- Supabase fully removed from frontend and root dependencies
- Old `src/` directory deleted (v1.x dead code removed)
- Stale documentation cleaned up (oldestplan.md, SYSTEM_PROMPT.md, SAAS_OPERATION_GUIDE.md, MATCH_DAY_EXAMPLES.md, TEST_SUITE.md, USER_GUIDE.md, KELLY_CRITERION_GUIDE.md, devdocs/, docs/)
- Root `package.json` deleted — `frontend/package.json` is the sole package manifest
- `supabase/` directory deleted
- Ralph loop prompts updated to reference `frontend/src/*` and `backend/app/*`
- Football-Data.org v4 API client (`frontend/src/services/api/footballData.ts`) with rate limiting
- IndexedDB 3-tier cache in `frontend/src/services/dataService.ts` (memory → IndexedDB → API)
- Prediction models: ELO, Poisson, xG, Fatigue, Referee in `frontend/src/lib/advancedPredictions.ts`
- Ensemble orchestrator in `frontend/src/lib/optimizedPredictions.ts` (ELO 25%, Poisson 30%, Form 20%, H2H 10%, Standings 15%)
- Kelly criterion calculator in `frontend/src/services/betting/kelly.ts` (full/half/quarter Kelly)
- PredictionTracker (localStorage) in `frontend/src/services/predictionTracker.ts` — fully implemented
- BetBuilder in `frontend/src/lib/betBuilder.ts` — multi-market predictions (partial)
- Vite proxy for Football-Data.org in `frontend/vite.config.ts`
- Test framework: Vitest with 182 tests across 10 test files, all passing
- Python ML backend scaffolded: XGBoost, LSTM, Transformer models, FastAPI, feature engineering, security

### NOT Done (Incorrectly Marked or Assumed)
- shadcn-svelte is NOT initialised — zero shadcn files exist in `frontend/`
- Backend feature engineering is ALL FAKE — 40+ methods return `np.random.uniform()`
- No frontend ↔ backend integration exists
- No training pipeline for ML models

---

## Priority 0: Remaining Cleanup

### 0a. Remove remaining stale files ✅
- [x] Delete `oldplan.md` (explicitly marked "OUT OF DATE" in its own header, references September 2025 predictions)
- [x] Delete `to-do.txt` (references old api-football.com and Supabase — superseded by this plan)

### 0b. Trim backend requirements.txt
`backend/requirements.txt` lists 130+ packages including Kafka, Azure, AWS, Graph Neural Networks, Computer Vision, Dash, etc. Most are aspirational and make installation fail.
- [ ] Trim `requirements.txt` to only actually-imported packages (FastAPI, uvicorn, xgboost, torch, transformers, scikit-learn, pandas, numpy, httpx, pydantic, python-dotenv, scipy, langchain, chromadb, mlflow, optuna, redis, shap, joblib, loguru, cryptography, boto3, hvac, passlib, python-jose)

---

## Phase 1: Data Pipeline & Live Data (specs 02, 05)

### 1a. Fix IndexedDB bugs ✅
`dataService.ts:40-58` — `onupgradeneeded` had two bugs:
1. Missing `scorers` store — `getTopScorers()` uses it but it didn't exist, causing silent failures
2. `standings` store used `team_id` as keyPath but Football-Data API returns `team.id` nested — cache writes silently failed
- [x] Add `db.createObjectStore('scorers', { keyPath: 'id' })` to `onupgradeneeded` handler
- [x] Fix `standings` store keyPath to match actual API response structure

### 1b. Add missing DataService methods (spec 02) ✅
`footballData.ts` had `getLiveMatches()` but `dataService.ts` didn't expose it.
- [x] Add `getLiveMatches()` to `dataService.ts` — delegates to `footballData.getLiveMatches()`, 60s IndexedDB cache
- [x] Add `getHistoricalMatches(season: number)` — fetches `/competitions/PL/matches?season={year}&status=FINISHED`, 24h cache, queue requests 6s apart for rate limiting
- [x] Add `getTeamRecentMatches(teamId: number, limit: number = 5)` — fetches `/teams/{teamId}/matches?status=FINISHED&limit={limit}`, 30min cache

### 1c. Smart polling manager (spec 05) ✅
`LiveMatches.svelte` already implements smart polling: 30s when live matches exist, 5min on match days, 30min when idle, with adaptive backoff after 3 consecutive empty polls.
- [x] Implement polling schedule: 30s live / 5min match day / 30min idle
- [x] Adaptive backoff: if 3 consecutive polls return empty, switch to longer intervals

### 1d. Fix LiveMatches.svelte (spec 05) ✅
- [x] `dataService.getLiveMatches()` called on mount with smart polling
- [x] Real scores shown with current minute and match status
- [x] "No live matches" state exists with next kickoff countdown
- [x] `getMinute()` now estimates from kick-off time rather than returning hardcoded `"45'"`

### 1e. Enhance LiveTicker.svelte (spec 05) ✅
- [x] Priority ordering: live scores > recent results (24h) > upcoming fixtures (48h)
- [x] Live format: `Arsenal 2-1 Chelsea (67')` with pulsing indicator
- [x] No `Math.random()` calls remain

### 1f. Backend proxy (spec 02, 03)
- [ ] Add Vite proxy in `frontend/vite.config.ts`: `/api/oracle` → `http://localhost:8000`

---

## Phase 2: Prediction Engine (spec 01)

### ARCHITECTURAL NOTE: Three Competing Prediction Systems
1. `predictions.ts` — original weighted model (H2H 30%, Form 25%, Stats 20%, Home 15%, Trend 10%)
2. `optimizedPredictions.ts` — ensemble orchestrator (ELO 25%, Poisson 30%, Form 20%, H2H 10%, Standings 15%) — **production model**
3. `AdvancedMatchPredictor` in `advancedPredictions.ts` — standalone advanced predictor

**Resolution:** `OptimizedPredictor` is the production model. All fixes target it and its dependencies from `advancedPredictions.ts`. `predictions.ts` remains as fallback.

### 2a. Dynamic ELO ratings — Single Source of Truth ✅
`advancedPredictions.ts:67-89` — teams were initialised with static ratings. `updateRatings()` existed but was never called. `optimizedPredictions.ts:34-60` had a SEPARATE set of ratings with different values (Arsenal: 1800 vs 1600).
- [x] On startup, load persisted ELO ratings from localStorage key `elo_ratings`
- [x] After each completed match loads, call `eloSystem.updateRatings()`
- [x] Persist updated ratings back to localStorage
- [x] Wire into `dataService` — trigger ELO updates when processing completed match results
- [x] Remove `TEAM_STRENGTHS` dict from `optimizedPredictions.ts` — use `EloRatingSystem` as single source
- [x] Standardise HOME_ADVANTAGE constant — use one value (65) across both files

### 2b. Poisson lambdas from real stats ✅
`PoissonPredictor` previously used an ad-hoc formula (`avgGoalsScored * 1.2 + avgGoalsConceded * 0.8`) instead of the proper Dixon-Coles approach.
- [x] Lambda home = `home_attack_strength × away_defence_weakness × league_avg_home_goals`
- [x] Lambda away = `away_attack_strength × home_defence_weakness × league_avg_away_goals`
- [x] Compute attack/defence strengths from completed match data via `dataService.getMatches()`
- [x] Per-team home/away splits calculated from real match results (minimum 3 matches required)
- [x] Fallback to overall stats when insufficient match data exists
- [x] Lambda values clamped to sensible range (0.3 – 4.5 goals)

### 2c. Fatigue analysis fix ✅
Two separate fatigue stubs fixed:
1. `advancedPredictions.ts:308` — `calculateFixtureDifficulty()` was always returning `1500` (hardcoded placeholder)
2. `optimizedPredictions.ts:408-414` — `calculateFatigueFactor()` was always returning `1.0` (completely stubbed)
- [x] Use ELO system (2a) to look up actual opponent ratings for fixture difficulty
- [x] Implement real fatigue factor based on days since last match
- [x] Wire fatigue multiplier into `OptimizedPredictor.predictMatch()` to adjust confidence

### 2d. Referee adjustment
`advancedPredictions.ts:380` — referee stats calculated but never applied to prediction output. Also uses hardcoded bookmaker odds `{home: 2.1, draw: 3.4, away: 3.8}`.
- [ ] Apply ±3% max adjustment to home win probability based on referee's historical home win rate vs league average
- [ ] Surface referee stats as tooltip/info panel in Predictions component
- [ ] Remove hardcoded bookmaker odds from AdvancedMatchPredictor

### 2e. Confidence calibration (partially complete)
`OptimizedPredictor.calculateConfidence()` uses simple probability gap formula. Two quick wins landed this session; deeper calibration is future work.
- [x] Fix `.sort()` array mutation bug — use `[...probs].sort()` to avoid mutating the original
- [x] Update hardcoded draw probability 0.25 to match actual PL stats (~26.5%)
- [ ] Incorporate ensemble disagreement: if ELO and Poisson strongly disagree, lower confidence
- [ ] Track historical accuracy by confidence band and apply calibration factor

### 2f. AI-assisted analysis (spec 01, new)
No AI analysis service exists in the frontend.
- [ ] Create `frontend/src/services/aiAnalysis.ts` — `AIAnalysisService` class
- [ ] Takes a `MatchPrediction`, returns natural language analysis (injury context, form narrative, derby intensity)
- [ ] Configurable: users enable/disable and enter OpenAI/Anthropic API key in Settings
- [ ] Supplementary display only — does NOT modify numerical prediction probabilities
- [ ] Cache AI responses for 24h per match

### 2g. Backtest runner (spec 01, new)
No backtesting capability exists.
- [ ] Create `frontend/src/lib/backtest.ts` — `BacktestRunner` class
- [ ] Takes array of completed matches, runs each through ensemble as if upcoming
- [ ] Reports: overall accuracy %, per-outcome accuracy (H/D/A), log loss, Brier score
- [ ] Accessible from Predictions view or Settings panel

### 2h. Fix hardcoded form strings ✅
`Predictions.svelte:171` had `homeForm: 'WWDLW'` hardcoded. `optimizedPredictions.ts:258,305-307` had multiple fallback form strings. `ValueBets.svelte:395,405` had fallback forms.
- [x] Remove hardcoded form strings from `optimizedPredictions.ts` — now returns `'?????'` when no data available
- [x] Added `homeForm` and `awayForm` fields to `EnhancedPredictionModel` interface — computed from real match data via `analyzeRecentForm()`
- [x] `Predictions.svelte` now uses `optimizedPrediction.homeForm` / `.awayForm` instead of hardcoded 'WWDLW'/'LDWDL'
- [x] `ValueBets.svelte` fallbacks changed from 'WWDLL'/'LDWWL' to '?????' (no fabricated results)

### 2i. Implement `savePrediction()` in predictions.ts
`predictions.ts:456-458` — `savePrediction()` is a TODO stub with empty body.
- [ ] Implement using `predictionTracker.storePrediction()` or remove if redundant with existing tracker calls

---

## Phase 3: Prediction Tracking (spec 06)

### 3a. Replace hardcoded accuracy ✅
`dataService.ts:411` — `getPredictionAccuracy()` already delegates to `predictionTracker.getAccuracyStats()`.
- [x] Replace stub with `predictionTracker.getAccuracyStats()` call (already done)

### 3b. Auto-reconciliation
- [ ] Add `reconcilePredictions(completedMatches)` to `dataService.ts`
- [ ] On every `getMatches(status: 'FINISHED')` call, check for pending predictions and resolve them against actual results
- [ ] Call `predictionTracker.updateWithResult()` for each resolved prediction

### 3c. Dashboard real stats ✅
- [x] Wire `overallAccuracy` from `predictionTracker.getAccuracyStats().accuracy`
- [x] Wire `totalPredictions` from `predictionTracker.getAccuracyStats().totalPredictions`
- [x] Wire `profitMargin` from `betHistoryService.getROI()`
- [x] Wire `betsPlaced` from `betHistoryService.getAllBets().length`
- [x] Remove ALL `Math.random()` calls (7 total removed)
- [x] Replace hardcoded monthly profit data with `betHistoryService.getMonthlyPL()`
- [x] Remove dead code after `return` in `onMount` (unreachable profit chart initialisation)
- [x] Fix stat card labels ("Active Users" → "Total Predictions")
- [x] Replace hardcoded change strings with computed deltas

### 3d. Prediction store on generate
`Predictions.svelte:182` calls `predictionTracker.storePrediction()` in some paths but not all.
- [ ] Ensure every prediction generated (single and batch) calls `storePrediction()`

### 3e. Per-gameweek accuracy
- [ ] Store per-gameweek accuracy in localStorage under `gameweek_accuracy`
- [ ] Display accuracy-over-time chart in Dashboard using Chart.js

### 3f. Accuracy breakdown panel
- [ ] Add to Predictions component: per-outcome accuracy (Home/Draw/Away %)
- [ ] Per-confidence band accuracy (65-70%, 70-80%, 80%+)
- [ ] Last 10 predictions rolling accuracy

---

## Phase 4: Betting Intelligence (spec 04)

### 4a. BetHistoryService ✅
- [x] Create `frontend/src/services/betting/betHistoryService.ts`
- [x] Follow localStorage pattern from `PredictionTracker`
- [x] Implement: `storeBet()`, `updateBetResult()`, `resolveMatchBets()`, `getAllBets()`, `getBetsByMonth()`, `getROI()`, `getMonthlyPL()`, `getWinRate()`, `getPendingBets()`, `clearHistory()`, `export/import`
- [x] 27 comprehensive tests in `betHistoryService.test.ts`

### 4b. Create BettingHistory.svelte (file does not exist)
- [ ] Create `frontend/src/components/BettingHistory.svelte` from scratch
- [ ] Wire to `betHistoryService` — real history table, monthly P/L bar chart, summary stats

### 4c. Kelly auto-suggestions
`KellyCalculator.svelte` is manual-input only.
- [ ] Load upcoming predictions from `OptimizedPredictor`
- [ ] For predictions with confidence >= 65% and positive EV, generate Kelly suggestions
- [ ] Display as "Suggested Bets" list above manual calculator

### 4d. Fix ValueBets.svelte
`ValueBets.svelte:64-97` — uses `Math.random()` for ALL odds and stats (7 locations). Also has hardcoded h2h record `'W2 D1 L2'` at line 93.
- [ ] MVP: manual odds entry — user selects match, enters bookmaker odds
- [ ] Calculate EV = `(predicted_probability × decimal_odds) - 1`
- [ ] Show Kelly-recommended stake as % of bankroll
- [ ] Leave `OddsProvider` interface stub for future API integration
- [ ] Remove all Math.random() calls and hardcoded h2h record

### 4e. Complete betBuilder suggestedCombos
`betBuilder.ts` — `suggestedCombos` is incomplete. Combo odds ignore market correlation (e.g. clean sheet + over 2.5 negatively correlated).
- [ ] Generate 2-4 accumulator combos per match
- [ ] Combine 2-3 markets (e.g. "Home Win + Over 2.5")
- [ ] Only suggest combos with confidence >= 55% and odds >= 2.0
- [ ] Add `reasoning` string per combo
- [ ] Account for market correlation in combo probability calculation

### 4f. Fix value.ts empty matchId
`value.ts:74,99,112,143` — value bets created with blank `matchId: ''`.
- [ ] Pass real match IDs through from the calling context

### 4g. Auto-resolve bets
- [ ] When match results arrive via API, check for unresolved bets on that match
- [ ] Call `betHistoryService.updateBetResult()` accordingly

---

## Phase 5: Backend ML Integration (spec 03)

### Backend Status (Deep Analysis)
- **API endpoints**: 95% complete — all endpoints functional except `/admin/retrain` (mock)
- **Model architectures**: 100% complete — XGBoost (2000 estimators, depth 8), LSTM (3-layer bidirectional, 8-head attention), Transformer (6-layer, 512d, sinusoidal encoding)
- **Ensemble**: Fully implemented — XGBoost 40%, LSTM 30%, Transformer 30% with Optuna weight optimisation
- **Security**: 100% complete — JWT auth, RBAC (4 roles), brute force protection, rate limiting
- **LangChain**: Integrated — ReAct agent with 5 tools
- **Feature engineering**: **0% REAL** — all 40+ `_calculate_*()` methods return `np.random.uniform()` random values
- **Training pipeline**: Does not exist — no script, no data connection, no validation splits
- **Tests**: 0% — no pytest tests written
- **Data collector**: Fully implemented with rate limiting and caching
- **LSTM feature importance**: Returns `np.random.random()` placeholder (line 523)
- **Modern Oracle**: `_calculate_betting_value()` uses hardcoded mock odds (2.5, 3.2, 2.8); `optimize_ensemble_weights()` returns random performance

### 5a. BackendService (new file — frontend)
No frontend code calls the Python backend.
- [ ] Create `frontend/src/services/backendService.ts`
- [ ] Implement: `isAvailable()` (pings `/health`), `predictMatch()`, `predictBatch()`, `getUpcomingPredictions()`, `queryNaturalLanguage()`
- [ ] All methods graceful — throw `BackendUnavailableError` if backend down

### 5b. Feature flag in Settings
- [ ] Add `useBackend` toggle in `Settings.svelte` (persisted to localStorage as `use_backend`)
- [ ] Show backend connection status (connected/disconnected indicator)
- [ ] Add `oracle_api_token` input field

### 5c. OptimizedPredictor integration
- [ ] When `useBackend` is enabled and backend available, merge ML prediction with ensemble result
- [ ] Silent fallback to TypeScript ensemble when backend unavailable

### 5d. LiveService with WebSocket (spec 05)
No live service exists.
- [ ] Create `frontend/src/services/liveService.ts` with Svelte store `liveMatchesStore`
- [ ] WebSocket connection to `ws://localhost:8000/ws` when backend available
- [ ] Falls back to polling when backend unavailable
- [ ] `LiveMatches.svelte` and `LiveTicker.svelte` subscribe to the store

### 5e. MLPrediction type
- [ ] Add `MLPrediction` interface to `frontend/src/types/index.ts`
- [ ] Include: probabilities, confidence, predicted score, model breakdown (xgboost/lstm/transformer), feature importance

### 5f. Real feature engineering (backend critical path)
`advanced_engineering.py` defines 150+ features across 10 categories, but **every `_calculate_*()` method returns `np.random.uniform()` random values**. This is the single biggest backend blocker. At least 24 methods confirmed as stubs (lines 481-576).
- [ ] Implement real feature calculations using match DataFrames from the data collector
- [ ] Priority features: rolling goals scored/conceded, xG metrics, form streaks, H2H stats, rest days
- [ ] Connect `FootballDataCollector` output to `AdvancedFeatureEngineer` input
- [ ] Create train/validation/test splits (e.g. 2020-2023 train, 2024 validation)

### 5g. Model training pipeline
No training script or notebook exists.
- [ ] Create `backend/train.py` that orchestrates: data collection → feature engineering → model training → evaluation
- [ ] Implement `/admin/retrain` endpoint (currently returns mock response)
- [ ] Fix LSTM `get_feature_importance()` returning random values (line 523)
- [ ] Fix Modern Oracle `_calculate_betting_value()` hardcoded mock odds
- [ ] Fix `optimize_ensemble_weights()` returning random performance scores
- [ ] Add backend pytest tests (currently 0% coverage)

### 5h. Historical data collection for training
`football_data_collector.py` is complete with rate limiting and caching. H2H method returns empty DataFrame.
- [ ] Create a training script that calls `FootballDataCollector.get_historical_data()` for seasons 2020-2024
- [ ] Fix `get_head_to_head()` returning empty DataFrame
- [ ] Document training command in `AGENTS.md`

### 5i. Trim requirements.txt
130+ packages including unnecessary ones (Kafka, Azure, AWS, Graph Neural Networks, Computer Vision, Dash, etc.).
- [ ] Audit imports across all `.py` files and trim to actually-used packages

---

## Phase 6: UI/UX Polish (spec 07)

### 6a. Initialise shadcn-svelte
shadcn-svelte is NOT initialised despite being listed as "started".
- [ ] Run `npx shadcn-svelte@latest init` from `frontend/`
- [ ] Configure: Svelte 4, TypeScript, Tailwind, components in `src/lib/components/ui`
- [ ] Add CSS variable mapping to `frontend/src/app.css` (`:root` and `.dark` blocks as per spec 07)

### 6b. Component migration (in priority order)
- [ ] Button: replace `.btn*` CSS classes with shadcn `Button`
- [ ] Card: wrap glassmorphism cards with shadcn `Card` base
- [ ] Dialog: replace `ApiSetupWizard` hand-rolled modal with shadcn `Dialog`
- [ ] Badge: replace `.badge*` CSS classes with shadcn `Badge`
- [ ] Tabs: replace Predictions `{#if}` tab blocks with shadcn `Tabs`
- [ ] Additional: Skeleton, Select, Table, Progress, Tooltip where appropriate

### 6c. Dark mode persistence fix
`Header.svelte` saves theme to localStorage but `App.svelte` doesn't restore it on load.
- [ ] In `App.svelte` `onMount`, restore theme from localStorage
- [ ] Fall back to system preference via `prefers-color-scheme`

### 6d. Mobile sidebar as Sheet
- [ ] Replace `Sidebar.svelte` mobile CSS transform with shadcn `Sheet` (slide-in from left)
- [ ] Ensure `MobileNav.svelte` has active state styling matching `currentView`

### 6e. Accessibility
- [ ] `role="meter"`, `aria-valuenow/min/max` on prediction probability bars
- [ ] Proper `<label>` elements on Kelly calculator inputs
- [ ] `aria-current="page"` on active navigation items
- [ ] `aria-label` on theme toggle button and confidence indicators

### 6f. Dead code & cosmetic cleanup
- [ ] Dashboard.svelte: remove unreachable code after `return` in `onMount` (profit chart setup)
- [ ] Remove `Math.random()` star particle animation in `App.svelte:96-100` (cosmetic, low priority)
- [ ] Fix hardcoded user profile in Header.svelte (lines 140-141: "Tom Butler", "tom@example.com")
- [ ] Fix hardcoded notification tooltip "3 new predictions available" in Header.svelte (line 102)

---

## Stubs & Hardcoded Values — Complete Audit

| Location | Problem | Fix Phase |
|----------|---------|-----------|
| `dataService.ts:299` | `season_id: '2024'` hardcoded TODO | Phase 1b |
| `advancedPredictions.ts:381` | Bookmaker odds hardcoded `{home: 2.1, draw: 3.4, away: 3.8}` | Phase 2d |
| `advancedPredictions.ts:454` | `avgPenalties: 0.2` placeholder | Phase 2b |
| `predictions.ts:456-458` | `savePrediction()` entirely unimplemented | Phase 2i |
| `Predictions.svelte:171-172` | `homeForm: 'WWDLW'`, `awayForm: 'LDWDL'` hardcoded | Phase 2h |
| `ValueBets.svelte:64-97` | 9× `Math.random()` for fake odds/stats | Phase 4d |
| `ValueBets.svelte:93` | Hardcoded h2h record `'W2 D1 L2'` | Phase 4d |
| `ValueBets.svelte:395,405` | Hardcoded fallback form strings | Phase 2h |
| `value.ts:74,99,112,143` | Empty `matchId: ''` in value bet creation | Phase 4f |
| `betBuilder.ts:269-276` | Only 6 hardcoded rivalries, case-sensitive matching | Phase 4e |
| `betBuilder.ts:327-398` | Combo odds ignore market correlation | Phase 4e |
| `Header.svelte:140-141` | Hardcoded user "Tom Butler", "tom@example.com" | Phase 6f |
| `Header.svelte:102` | Hardcoded "3 new predictions available" tooltip | Phase 6f |
| `App.svelte:96-100` | `Math.random()` for star particles (cosmetic) | Phase 6f |
| `kelly.ts:214` | `Math.random()` in simulation (acceptable — Monte Carlo) | N/A |
| `advanced_engineering.py:481-576` | 40+ `_calculate_*()` methods return `np.random.uniform()` | Phase 5f |
| `lstm_predictor.py:523` | `get_feature_importance()` returns random values | Phase 5g |
| `modern_oracle.py` | `_calculate_betting_value()` uses mock odds (2.5, 3.2, 2.8) | Phase 5g |
| `modern_oracle.py` | `optimize_ensemble_weights()` returns random performance | Phase 5g |
| `football_data_collector.py` | `get_head_to_head()` returns empty DataFrame | Phase 5h |

### Resolved stubs (removed from active list)
| Location | What was fixed | Session |
|----------|---------------|---------|
| `dataService.ts:40-58` | `scorers` IndexedDB store added; `standings` keyPath fixed | Phase 1a |
| `optimizedPredictions.ts:27` | HOME_ADVANTAGE standardised to 65 | Phase 2a |
| `optimizedPredictions.ts:40-57` | `TEAM_STRENGTHS` removed — `EloRatingSystem` is now sole source | Phase 2a |
| `advancedPredictions.ts:344-345` | ELO ratings now loaded from shared localStorage-persisted system | Phase 2a |
| `advancedPredictions.ts:308` | `calculateFixtureDifficulty()` now uses real ELO opponent ratings | Phase 2c |
| `optimizedPredictions.ts:408-414` | `calculateFatigueFactor()` now uses real days-since-last-match logic | Phase 2c |
| `optimizedPredictions.ts:509` | `.sort()` mutation fixed — uses `[...probs].sort()` | Phase 2e |
| `optimizedPredictions.ts:142` | Draw probability updated from 0.25 to 0.265 (real PL average) | Phase 2e |
| `optimizedPredictions.ts:258,305-307` | Hardcoded form strings removed — returns `'?????'` when no data | Phase 2h |
| `LiveMatches.svelte` | `getLiveMatches()` called on mount with smart polling; real scores/minute/status shown; "No live matches" state with countdown; `getMinute()` estimates from kick-off | Phase 1c/1d |
| `LiveTicker.svelte` | Priority ordering (live > 24h results > 48h upcoming); pulsing live indicator; `Math.random()` removed | Phase 1e |
| `KellyCalculator.svelte` | Fixed `calculation.edge` → `calculation.edgePercentage` (type error) | Phase 4c |
| `ValueBets.svelte` | Fixed property mismatches (`odds→bookmakerOdds`, `matchTime→matchDate`, `goalsFor→goals_for`, `played→matches_played`); removed `Math.random()` for cleanSheets; removed hardcoded h2h `'W2 D1 L2'` | Phase 4d |
| `setup.ts` | Fixed `global` → `globalThis` (type error) | — |
| `footballData.test.ts` | Fixed `Response` mock casts (type error) | — |
| `Dashboard.svelte:169-214` | 7× `Math.random()` removed — all stats wired to `PredictionTracker` and `BetHistoryService` | Phase 3c |
| `Dashboard.svelte:252-260` | Hardcoded profit data removed — chart now uses `betHistoryService.getMonthlyPL()` | Phase 3c |
| `Dashboard.svelte:onMount` | Dead code after `return` removed — profit chart now initialised properly | Phase 3c |
| `services/betting/betHistoryService.ts` | Created with full localStorage persistence, 27 tests | Phase 4a |

---

## Files That Need Creating

| File | Spec | Purpose |
|------|------|---------|
| `services/backendService.ts` | 03 | Frontend-backend bridge |
| `services/liveService.ts` | 05 | WebSocket + polling for live data |
| `services/aiAnalysis.ts` | 01 | AI-powered match analysis |
| ~~`services/betting/betHistoryService.ts`~~ | ~~04~~ | ~~✅ Created — bet persistence (localStorage)~~ |
| `components/BettingHistory.svelte` | 04 | Bet history UI (table, charts, ROI stats) |
| `lib/backtest.ts` | 01 | Ensemble backtesting runner |
| `backend/train.py` | — | Training pipeline orchestrator |

---

## Test Coverage Status

| Test File | Tests | Quality | Notes |
|-----------|-------|---------|-------|
| `predictions.test.ts` | 11 | Good | Tests real prediction logic |
| `types.test.ts` | 18 | Trivial | Type structure validation only |
| `advancedPredictions.test.ts` | 28 | Good | Covers ELO, Poisson, fatigue, referee, xG |
| `Dashboard.test.ts` | 12 | Good | Component rendering tests — expanded from 8 this session |
| `kelly.test.ts` | 20 | Excellent | Thorough edge case coverage |
| `footballData.test.ts` | 26 | Good | API client with error handling |
| `dataService.test.ts` | 10 | Good | Service layer delegation |
| `predictionTracker.test.ts` | 18 | Excellent | Comprehensive with import/export |
| `optimizedPredictions.test.ts` | 12 | Good | Covers prediction structure, model weights, ELO integration, confidence, value odds, Dixon-Coles Poisson lambdas |
| `betHistoryService.test.ts` | 27 | Excellent | Store, resolve, ROI, monthly P/L, win rate, export/import, persistence |
| **Total** | **182** | — | All pass across 10 files, no skipped/flaky tests |

### Missing Test Coverage
- `betBuilder.ts` — no tests
- `value.ts` — no tests
- `backend/` — 0% test coverage (no pytest tests exist)

---

## Missing Specifications

### Backend Training Pipeline
- All 3 model architectures are complete but untrained
- Feature engineering has 150+ features defined but ALL return random values
- No training script, no train/test splits, no evaluation framework
- Need: spec for `specs/08-backend-training.md` covering data preparation, feature implementation, training pipeline, evaluation metrics, model versioning
