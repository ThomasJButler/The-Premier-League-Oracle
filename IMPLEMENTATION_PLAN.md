# Premier League Oracle — Implementation Plan

Last updated: 14 March 2026

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
- Test framework: Vitest with 197 tests across 11 test files, all passing
- Python ML backend scaffolded: XGBoost, LSTM, Transformer models, FastAPI, feature engineering, security

### NOT Done (Incorrectly Marked or Assumed)
- shadcn-svelte is NOT initialised — zero shadcn files exist in `frontend/`
- Backend feature engineering is ALL FAKE — 40+ methods return `np.random.uniform()`
- No frontend ↔ backend integration exists
- No training pipeline for ML models
- Backend server (`main.py`) will NOT start — broken LangChain/ChromaDB imports in `modern_oracle.py`
- ~~ValueBets.svelte still uses `Math.random()` for ALL bookmaker odds — the feature is functionally useless~~ (resolved 14 March 2026 — manual odds entry implemented)

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

### 1g. Fix DataService inconsistencies ✅
- [x] `season_id` field on every transformed `Match` is always `''` — now derived from match date
- [x] Live match IndexedDB cache uses default 5-min timeout but intent is 60s — now uses 60s via per-call TTL parameter
- [x] Remove dead `setDataSource()` no-op method and vestigial `ApiProvider` type — removed
- [x] `getMatchesBySeason(seasonId)` ignores its argument — documented limitation
- [x] `getAllSeasons()` only returns current season — documented limitation

### 1h. Fix component data accuracy issues (partial)
- [ ] `LiveMatches.svelte`: "Auto-refreshing every 30 seconds" label is hardcoded — should reflect actual current polling interval
- [ ] `LiveTicker.svelte`: Live dot detection uses fragile `startsWith('⚽')` heuristic — use a boolean flag instead
- [x] `StandingsTable.svelte`: "2024/25 Season" subtitle replaced with dynamic `getSeasonLabel()` function
- [x] `TopScorers.svelte`: "Premier League 2024/25 Season" subtitle replaced with dynamic season label
- [ ] `SeasonStats.svelte`: "Late Drama" metric uses HT vs FT result change, not actual late goals — rename label or document the proxy
- [x] `Predictions.svelte`: Gameweek slicing fixed — now filters by `matchday` field instead of array slice `(gameweek - 1) * 10`

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

### 2d. Referee adjustment ✅ (partial)
`advancedPredictions.ts:380` — referee stats calculated but never applied to prediction output. Also used hardcoded bookmaker odds `{home: 2.1, draw: 3.4, away: 3.8}`.
- [x] Apply ±3% max adjustment to home win probability based on referee's historical home win rate vs league average (0.46)
- [x] `RefereeAnalyzer` imported into `optimizedPredictions.ts`; optional `referee` parameter added to `OptimizedPredictor.predictMatch()`
- [x] Referee insight surfaced in predictions output
- [x] Remove hardcoded bookmaker odds from `AdvancedMatchPredictor` — replaced with fair odds derived from model probabilities
- [x] `Predictions.svelte` now passes `match.referee` to `predictMatch()`
- [ ] Surface referee stats as tooltip/info panel in Predictions component

### 2e. Confidence calibration ✅ (partial)
`OptimizedPredictor.calculateConfidence()` uses simple probability gap formula. Two quick wins landed in a prior session; ensemble disagreement implemented this session. Historical accuracy calibration is future work.
- [x] Fix `.sort()` array mutation bug — use `[...probs].sort()` to avoid mutating the original
- [x] Update hardcoded draw probability 0.25 to match actual PL stats (~26.5%)
- [x] Incorporate ensemble disagreement: added `getTopOutcome()` helper; when ELO and Poisson disagree on the predicted outcome, confidence is reduced by 8%; disagreement surfaced as an insight (e.g. "Models split: ELO predicts H, Poisson predicts A — lower confidence")
- [ ] Track historical accuracy by confidence band and apply calibration factor

### 2f. AI-assisted analysis (spec 01, new)
No AI analysis service exists in the frontend.
- [ ] Create `frontend/src/services/aiAnalysis.ts` — `AIAnalysisService` class
- [ ] Takes a `MatchPrediction`, returns natural language analysis (injury context, form narrative, derby intensity)
- [ ] Configurable: users enable/disable and enter OpenAI/Anthropic API key in Settings
- [ ] Supplementary display only — does NOT modify numerical prediction probabilities
- [ ] Cache AI responses for 24h per match
- [ ] Update `Help.svelte` "AI Assistant" feature card to reflect actual capabilities (currently describes features that don't exist)

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

### 2i. Implement `savePrediction()` in predictions.ts ✅
`predictions.ts` — `savePrediction()` stub no longer exists; it was removed in a prior session.
- [x] Stub removed — no action required

### 2j. Fix Predictions.svelte calculation issues ✅
- [x] `recommendedStake` replaced linear `Math.max(0, (confidence - 0.6) * 10)` with Kelly Criterion via `calculateKelly()` from kelly.ts
- [x] BTTS display precedence bug fixed: `* 100` now correctly applied to both ternary branches
- [x] Removed dead import `predictMatch` from predictions.ts
- [x] Gameweek slicing fixed — see 1h above

---

## Phase 3: Prediction Tracking (spec 06)

### 3a. Replace hardcoded accuracy ✅
`dataService.ts:411` — `getPredictionAccuracy()` already delegates to `predictionTracker.getAccuracyStats()`.
- [x] Replace stub with `predictionTracker.getAccuracyStats()` call (already done)

### 3b. Auto-reconciliation ✅
- [x] Add `reconcilePredictions(completedMatches)` to `dataService.ts`
- [x] Automatically called whenever `getMatches()` returns finished matches
- [x] Checks for unresolved predictions and calls `predictionTracker.updateWithResult()` for each
- [x] Updated `dataService.test.ts` mock to include `getMatchPredictions` and `updateWithResult`

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

### 3d. Prediction store on generate ✅
`Predictions.svelte:182` calls `predictionTracker.storePrediction()` in the batch loop for every match. Verified — there is no separate single-prediction path.
- [x] Every prediction generated calls `storePrediction()` (confirmed — single path, batch loop)

### 3e. Per-gameweek accuracy ✅
- [x] Added `matchday` field to `StoredPrediction` interface
- [x] Added `GameweekAccuracy` interface for per-gameweek stats
- [x] Implemented `getAccuracyByGameweek()` method in `PredictionTracker` — groups settled predictions by matchday
- [x] `Predictions.svelte` now passes `selectedGameweek` (matchday) to `storePrediction()`
- [x] Dashboard accuracy trend chart now shows real per-gameweek accuracy instead of confidence scores
- [x] Fallback chain: gameweek accuracy → recent predictions confidence → flat line at overall accuracy
- Note: Dashboard accuracy trend chart previously plotted `prediction.confidence * 100` as proxy — now replaced with actual accuracy per gameweek

### 3f. Accuracy breakdown panel ✅
- [x] Collapsible accuracy panel added to Predictions component (toggle via chevron button)
- [x] Per-outcome accuracy display: Home Win / Draw / Away Win with progress bars
- [x] Per-confidence band accuracy: High (>70%) / Medium (50-70%) / Low (<50%) with progress bars
- [x] Rolling last-10 predictions accuracy
- [x] Exact score accuracy percentage
- [x] Best streak and current streak display
- [x] All data sourced from `predictionTracker.getAccuracyStats(90)` (90-day window)

### 3g. Fix Dashboard navigation ✅
- [x] "View All Matches" button wired with `on:click` dispatching navigate event to 'Matches' view; `createEventDispatcher` added to Dashboard; `on:navigate={navigate}` added in App.svelte
- [x] Removed unused `apiProvider` variable and `dataService.getApiProvider()` call
- Note: `Dashboard.test.ts` updated to remove `getApiProvider` mock references

---

## Phase 4: Betting Intelligence (spec 04)

### 4a. BetHistoryService ✅
- [x] Create `frontend/src/services/betting/betHistoryService.ts`
- [x] Follow localStorage pattern from `PredictionTracker`
- [x] Implement: `storeBet()`, `updateBetResult()`, `resolveMatchBets()`, `getAllBets()`, `getBetsByMonth()`, `getROI()`, `getMonthlyPL()`, `getWinRate()`, `getPendingBets()`, `clearHistory()`, `export/import`
- [x] 27 comprehensive tests in `betHistoryService.test.ts`

### 4b. Create BettingHistory.svelte ✅
- [x] Create `frontend/src/components/BettingHistory.svelte`
- [x] Wire to `betHistoryService` — real history table, monthly P/L bar chart, summary stats

### 4c. Kelly auto-suggestions
`KellyCalculator.svelte` is manual-input only.
- [ ] Load upcoming predictions from `OptimizedPredictor`
- [ ] For predictions with confidence >= 65% and positive EV, generate Kelly suggestions
- [ ] Display as "Suggested Bets" list above manual calculator
- [ ] Fix: `confidenceLevel` (line 11) is hardcoded at 0.7 with no UI control — add a slider or derive from model confidence

### 4d. Fix ValueBets.svelte ✅
`ValueBets.svelte` — was using `Math.random()` for ALL odds and stats (7 locations) and had a hardcoded h2h record `'W2 D1 L2'`.
- [x] MVP: manual odds entry UI implemented — user enters real bookmaker odds (Home/Draw/Away + optional Over/Under/BTTS)
- [x] EV calculated from model probabilities against entered odds
- [x] Kelly-recommended stake shown as % of bankroll
- [x] `OddsProvider` interface stub retained in `value.ts` for future API integration
- [x] All 7 `Math.random()` calls for fake bookmaker odds removed
- [x] Hardcoded h2h fallback `'W2 D1 L2'` removed — now `'No data available'`
- [x] `homeForm: 'N/A'` and `awayForm: 'N/A'` replaced with real form from standings API
- [x] Dead `dataService` import removed from `value.ts`
- [x] Fixed `identifyValueBets` call to pass `match.id` as first argument (was passing `match.home_team`)
- [x] Removed dead imports: `Target`, `Trophy`, `fade`

### 4e. Complete betBuilder suggestedCombos
`betBuilder.ts` — `suggestedCombos` is incomplete. Combo odds ignore market correlation (e.g. clean sheet + over 2.5 negatively correlated).
- [ ] Generate 2-4 accumulator combos per match
- [ ] Combine 2-3 markets (e.g. "Home Win + Over 2.5")
- [ ] Only suggest combos with confidence >= 55% and odds >= 2.0
- [ ] Add `reasoning` string per combo
- [ ] Account for market correlation in combo probability calculation
- [ ] Replace hardcoded combo confidence values (0.65, 0.45, 0.25, 0.40) with calculated values
- [ ] Replace hardcoded probabilities: HT `drawProb: 0.40`, win-to-nil `1/0.3`, first-half goals `1/0.35`
- [ ] Replace hardcoded corners `avgCorners: 9.5` and cards `expectedCards: 3.2` with league averages computed from match data (note: free tier may not provide these)
- [ ] Expand rivalry list beyond 6 hardcoded entries

### 4f. Fix value.ts empty matchId ✅
`value.ts:74,99,112,143` — value bets created with blank `matchId: ''`.
- [x] `identifyValueBets()` now takes `matchId` as first parameter and passes it through
- [x] `OddsProvider` interface added with JSDoc documentation
- [x] `ValueBets.svelte` call site updated to pass `match.id` as first argument

### 4g. Auto-resolve bets ✅
- [x] Wire `betHistoryService.resolveMatchBets()` into `dataService.reconcilePredictions()` — bets now auto-resolve alongside predictions when match results arrive
- [x] Added `resolveCombo()` and `resolveSingleLeg()` methods to `BetHistoryService` — combo bets can now be auto-resolved by parsing selection legs (e.g. "Home Win + Over 2.5 Goals + BTTS Yes")
- [x] Supported combo legs: match result (home/draw/away), BTTS (yes/no), over/under goals (1.5/2.5/3.5), clean sheet, win to nil
- [x] `dataService.ts` now imports `betHistoryService` directly

### 4h. Add betBuilder tests ✅
- [x] Create `frontend/src/lib/betBuilder.test.ts` — 40 tests covering match result prediction (H/D/A branches), BTTS calculation, total goals over/under thresholds, corner expectations with/without team stats, card predictions with rivalry detection (all 6 pairs), half-time correlation, clean sheet probabilities, and all 4 combo types with threshold verification

### 4i. Add value.ts tests ✅
- [x] Create `frontend/src/services/betting/value.test.ts` — 38 tests covering `identifyValueBets()` (1X2, goals, BTTS markets; edge/confidence thresholds; error handling), `calculateCLV()` (positive/negative/zero), `findArbitrage()` (arb detection, bookmaker attribution, tied odds), `calculateSharpeRatio()` (positive/negative/zero stddev), `calculatePerformanceMetrics()` (ROI, yield, max drawdown, CLV rate, all-win/all-loss), and warning generation

---

## Phase 5: Backend ML Integration (spec 03)

### Backend Status (Deep Analysis)
- **API endpoints**: 95% complete — all endpoints functional except `/admin/retrain` (mock)
- **Model architectures**: 100% complete — XGBoost (2000 estimators, depth 8), LSTM (3-layer bidirectional, 8-head attention), Transformer (6-layer, 512d, sinusoidal encoding)
- **Ensemble**: Fully implemented — XGBoost 40%, LSTM 30%, Transformer 30% with Optuna weight optimisation
- **Security**: 100% complete — JWT auth, RBAC (4 roles), brute force protection, rate limiting
- **LangChain**: Integrated — ReAct agent with 5 tools
- **Feature engineering**: **0% REAL** — all 40+ `_calculate_*()` methods return `np.random.uniform()` random values (102 occurrences)
- **Training pipeline**: Does not exist — no script, no data connection, no validation splits
- **Tests**: 0% — no pytest tests written
- **Data collector**: Fully implemented with rate limiting and caching
- **LSTM feature importance**: Returns `np.random.random()` placeholder (line 523)
- **Modern Oracle**: `_calculate_betting_value()` uses hardcoded mock odds (2.5, 3.2, 2.8); `optimize_ensemble_weights()` returns random performance

### ⚠️ CRITICAL: Backend Server Will Not Start (NEW)
`modern_oracle.py` imports at the top level:
1. `from langchain.embeddings import OpenAIEmbeddings` — moved to `langchain_community` in recent versions, raises `ImportError`
2. `chromadb.Client(Settings(chroma_db_impl="duckdb+parquet"))` — deprecated ChromaDB API, will error
3. `api/main.py` imports `ModernPremierLeagueOracle` at top level — server fails to start

**Must fix before any backend work can proceed.**

### 5a. Fix backend imports and startup (NEW — BLOCKER)
- [ ] Update LangChain imports from `langchain.*` to `langchain_community.*` (or make them optional/lazy)
- [ ] Update ChromaDB API from deprecated `duckdb+parquet` settings to modern API
- [ ] Make LangChain/ChromaDB optional — server should start without OpenAI key
- [ ] Fix `auth.py` mock user lookup (line 434: "Get user from database (mock for now)")
- [ ] Update `validators.py` `VALID_TEAMS` set from 2023/24 to current 2025/26 season teams
- [ ] Fix `football_data_collector.py` missing `get_team_stats()` method (called from `modern_oracle.py` but doesn't exist)
- [ ] Fix Dockerfile references to nonexistent `config.yml` and `models/` directory
- [ ] Remove hardcoded PostgreSQL password `godmode123` from `docker-compose.yml`

### 5b. BackendService (new file — frontend)
No frontend code calls the Python backend.
- [ ] Create `frontend/src/services/backendService.ts`
- [ ] Implement: `isAvailable()` (pings `/health`), `predictMatch()`, `predictBatch()`, `getUpcomingPredictions()`, `queryNaturalLanguage()`
- [ ] All methods graceful — throw `BackendUnavailableError` if backend down

### 5c. Feature flag in Settings
- [ ] Add `useBackend` toggle in `Settings.svelte` (persisted to localStorage as `use_backend`)
- [ ] Show backend connection status (connected/disconnected indicator)
- [ ] Add `oracle_api_token` input field
- [ ] Fix fake cache size calculation in `Settings.svelte:126-128` (currently `localStorage.length × 0.005 MB`)

### 5d. OptimizedPredictor integration
- [ ] When `useBackend` is enabled and backend available, merge ML prediction with ensemble result
- [ ] Silent fallback to TypeScript ensemble when backend unavailable

### 5e. LiveService with WebSocket (spec 05)
No live service exists.
- [ ] Create `frontend/src/services/liveService.ts` with Svelte store `liveMatchesStore`
- [ ] WebSocket connection to `ws://localhost:8000/ws` when backend available
- [ ] Falls back to polling when backend unavailable
- [ ] `LiveMatches.svelte` and `LiveTicker.svelte` subscribe to the store

### 5f. MLPrediction type
- [ ] Add `MLPrediction` interface to `frontend/src/types/index.ts`
- [ ] Include: probabilities, confidence, predicted score, model breakdown (xgboost/lstm/transformer), feature importance

### 5g. Real feature engineering (backend critical path)
`advanced_engineering.py` defines 150+ features across 10 categories, but **every `_calculate_*()` method returns `np.random.uniform()` random values**. This is the single biggest backend blocker. 102 occurrences of `np.random.*` confirmed.
- [ ] Implement real feature calculations using match DataFrames from the data collector
- [ ] Priority features: rolling goals scored/conceded, xG metrics, form streaks, H2H stats, rest days
- [ ] Connect `FootballDataCollector` output to `AdvancedFeatureEngineer` input
- [ ] Create train/validation/test splits (e.g. 2020-2023 train, 2024 validation)

### 5h. Model training pipeline
No training script or notebook exists.
- [ ] Create `backend/train.py` that orchestrates: data collection → feature engineering → model training → evaluation
- [ ] Implement `/admin/retrain` endpoint (currently returns mock response)
- [ ] Fix LSTM `get_feature_importance()` returning random values (line 523)
- [ ] Fix Modern Oracle `_calculate_betting_value()` hardcoded mock odds
- [ ] Fix `optimize_ensemble_weights()` returning random performance scores
- [ ] Add backend pytest tests (currently 0% coverage)

### 5i. Historical data collection for training
`football_data_collector.py` is complete with rate limiting and caching. H2H method returns empty DataFrame.
- [ ] Create a training script that calls `FootballDataCollector.get_historical_data()` for seasons 2020-2024
- [ ] Fix `get_head_to_head()` returning empty DataFrame
- [ ] Document training command in `AGENTS.md`

### 5j. Trim requirements.txt
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
- [ ] `MobileNav.svelte` only exposes 5 of 10+ views — add remaining views or use a "More" menu

### 6e. Accessibility
- [ ] `role="meter"`, `aria-valuenow/min/max` on prediction probability bars
- [ ] Proper `<label>` elements on Kelly calculator inputs
- [ ] `aria-current="page"` on active navigation items
- [ ] `aria-label` on theme toggle button and confidence indicators

### 6f. Dead code & cosmetic cleanup
- [ ] Remove `Math.random()` star particle animation in `App.svelte:96-100` (cosmetic, low priority)
- [ ] Fix hardcoded user profile in Header.svelte (lines 140-141: "Tom Butler", "tom@example.com") — either remove or make configurable
- [ ] Fix hardcoded notification tooltip "3 new predictions available" in Header.svelte (line 102) — either wire to real notification count or remove the bell
- [ ] `ApiSetupWizard.svelte` Step 3 ("Choose Provider") shows single option then auto-advances — collapse the step or remove
- [ ] Fix Header.svelte search bar — dispatches event but nothing handles it; either wire to match/team search or remove
- [ ] Fix Header.svelte profile/logout actions — dispatched but unhandled; either implement or remove dropdown
- [ ] Update `Help.svelte` to remove references to non-existent features (push notifications, offline caching beyond IndexedDB)
- [ ] Update `Help.svelte` FAQ accuracy claim "60-65%" to use real accuracy from `predictionTracker`
- [ ] `StandingsTable.svelte` position movement arrows are inferred from form wins, not real API data — either implement properly or remove

---

## Stubs & Hardcoded Values — Complete Audit

### Active stubs (must fix)

| Location | Problem | Fix Phase |
|----------|---------|-----------|
| `advancedPredictions.ts:557` | `avgPenalties: 0.2` placeholder — no penalty data from API | Phase 2d |
| `optimizedPredictions.ts:415` | `cleanSheetRate: 0.3` — commented "Would need actual clean sheet data" | Phase 4e |
| `optimizedPredictions.ts:573` | Standings fallback `{ homeWin: 0.40, draw: 0.30, awayWin: 0.30 }` hardcoded | N/A (acceptable fallback) |
| `predictions.ts:261-262` | `leagueAvgHome = 1.5`, `leagueAvgAway = 1.2` — static, not computed | Low priority (fallback model) |
| `betBuilder.ts:209` | `avgCorners = 9.5` hardcoded — no real corner data from free tier | Phase 4e |
| `betBuilder.ts:236` | `expectedCards = 3.2` hardcoded — no real card data from free tier | Phase 4e |
| `betBuilder.ts:269-276` | Only 6 hardcoded rivalries, case-sensitive matching | Phase 4e |
| `betBuilder.ts:290` | HT `drawProb: 0.40` hardcoded | Phase 4e |
| `betBuilder.ts:339-405` | Combo confidence values hardcoded (0.65, 0.45, 0.25, 0.40) | Phase 4e |
| `betBuilder.ts:371, 393` | Inline probabilities: `1/0.3` (win-to-nil), `1/0.35` (first-half goals) | Phase 4e |
| `value.ts:346` | `calculateCLV` returns `betId: ''` | Low priority |
| `dataService.ts:317-332` | `clean_sheets`, `failed_to_score`, all home/away splits always `0` | Free-tier limitation |
| `Header.svelte:140-141` | Hardcoded user "Tom Butler", "tom@example.com" | Phase 6f |
| `Header.svelte:102` | Hardcoded "3 new predictions available" tooltip | Phase 6f |
| `App.svelte:96-100` | `Math.random()` for star particles (cosmetic) | Phase 6f |
| `Settings.svelte:126-128` | Fake cache size: `localStorage.length × 0.005 MB` | Phase 5c |
| `StandingsTable.svelte:79-85` | Position movement from form wins proxy, not real data | Phase 6f |
| `SeasonStats.svelte:260` | `totalPenalties = 0` — not available from free tier | N/A (free-tier limitation) |
| `advanced_engineering.py:481-892` | 102× `np.random.*` — ALL feature calculations fake | Phase 5g |
| `lstm_predictor.py:523` | `get_feature_importance()` returns random values | Phase 5h |
| `modern_oracle.py:404-408` | `_calculate_betting_value()` mock odds (2.5, 3.2, 2.8) | Phase 5h |
| `modern_oracle.py:463` | `optimize_ensemble_weights()` returns `np.random.random()` | Phase 5h |
| `football_data_collector.py:501-506` | `get_head_to_head()` returns empty DataFrame | Phase 5i |
| `api/main.py:524-529` | `/admin/retrain` returns mock response | Phase 5h |
| `auth.py:434` | Mock user database lookup | Phase 5a |
| `kelly.ts:214` | `Math.random()` in simulation (acceptable — Monte Carlo) | N/A |

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
| `ValueBets.svelte` | Fixed property mismatches (`odds→bookmakerOdds`, `matchTime→matchDate`, `goalsFor→goals_for`, `played→matches_played`); removed `Math.random()` for cleanSheets | Phase 4d |
| `setup.ts` | Fixed `global` → `globalThis` (type error) | — |
| `footballData.test.ts` | Fixed `Response` mock casts (type error) | — |
| `Dashboard.svelte:169-214` | 7× `Math.random()` removed — all stats wired to `PredictionTracker` and `BetHistoryService` | Phase 3c |
| `Dashboard.svelte:252-260` | Hardcoded profit data removed — chart now uses `betHistoryService.getMonthlyPL()` | Phase 3c |
| `Dashboard.svelte:onMount` | Dead code after `return` removed — profit chart now initialised properly | Phase 3c |
| `services/betting/betHistoryService.ts` | Created with full localStorage persistence, 27 tests | Phase 4a |
| `advancedPredictions.ts:381` | Hardcoded bookmaker odds `{home: 2.1, draw: 3.4, away: 3.8}` removed — replaced with fair odds derived from model probabilities | Phase 2d |
| `optimizedPredictions.ts` | `RefereeAnalyzer` imported; optional `referee` param added; ±3% home win probability adjustment applied; referee insight surfaced in output; `Predictions.svelte` passes `match.referee` | Phase 2d |
| `optimizedPredictions.ts` | Ensemble disagreement: `getTopOutcome()` helper added; `calculateConfidence()` reduces confidence by 8% when ELO and Poisson disagree on outcome; disagreement surfaced as insight | Phase 2e |
| `predictions.ts:456-458` | `savePrediction()` stub — no longer exists, removed in a prior session | Phase 2i |
| `dataService.ts` | `reconcilePredictions(completedMatches)` added; auto-called on finished matches; calls `predictionTracker.updateWithResult()` per match; `dataService.test.ts` mock updated | Phase 3b |
| `Predictions.svelte:182` | `storePrediction()` called for every match in batch loop — no missing single-prediction path; verified complete | Phase 3d |
| `BettingHistory.svelte` | Fixed `onMount` not firing in tests (synchronous `loadBettingHistory()` call on init); fixed profit sign formatting (`-£10.00` not `£-10.00`); fixed "Pending" text collision in test | Phase 4b |
| `value.ts:74,99,112,143` | `matchId` parameter added and passed through | Phase 4f |
| `ValueBets.svelte:64-70` | All 7 `Math.random()` calls for fake bookmaker odds removed; manual odds entry UI implemented | Phase 4d |
| `ValueBets.svelte:91-93` | `homeForm`/`awayForm` replaced with real form from standings API | Phase 4d |
| `ValueBets.svelte:420` | Hardcoded h2h fallback `'W2 D1 L2'` removed — now `'No data available'` | Phase 4d |
| `ValueBets.svelte` | Fixed `identifyValueBets` call to pass `match.id`; removed dead imports (`Target`, `Trophy`, `fade`) | Phase 4d |
| `value.ts` | Dead `dataService` import removed | Phase 4d |
| `Dashboard.test.ts:306-307` | Fixed `stat-icon-wrapper` test — added `waitFor` and missing `getAccuracyByGameweek` mock | Phase 3e |
| `footballData.ts:369` | `season_id` now derived from match date instead of always `''` | Phase 1g |
| `dataService.ts` | Dead `setDataSource()` no-op method and `ApiProvider` type removed; live match cache TTL corrected to 60s | Phase 1g |
| `StandingsTable.svelte:103` | "2024/25 Season" hardcoded subtitle replaced with dynamic `getSeasonLabel()` | Phase 1h |
| `TopScorers.svelte:116` | "Premier League 2024/25 Season" hardcoded subtitle replaced with dynamic season label | Phase 1h |
| `Predictions.svelte:177` | `recommendedStake` linear heuristic replaced with Kelly Criterion via `calculateKelly()` | Phase 2j |
| `Predictions.svelte` | BTTS `* 100` precedence bug fixed; dead `predictMatch` import removed | Phase 2j |
| `Dashboard.svelte` | "View All Matches" button wired to navigate event; dead `apiProvider`/`getApiProvider()` removed | Phase 3g |

---

## Files That Need Creating

| File | Spec | Purpose |
|------|------|---------|
| `services/backendService.ts` | 03 | Frontend-backend bridge |
| `services/liveService.ts` | 05 | WebSocket + polling for live data |
| `services/aiAnalysis.ts` | 01 | AI-powered match analysis |
| ~~`services/betting/betHistoryService.ts`~~ | ~~04~~ | ~~✅ Created — bet persistence (localStorage)~~ |
| `lib/backtest.ts` | 01 | Ensemble backtesting runner |
| ~~`lib/betBuilder.test.ts`~~ | ~~—~~ | ~~✅ Created — 40 tests for bet builder~~ |
| ~~`services/betting/value.test.ts`~~ | ~~—~~ | ~~✅ Created — 38 tests for value betting engine~~ |
| `backend/train.py` | — | Training pipeline orchestrator |

---

## Test Coverage Status

| Test File | Tests | Quality | Notes |
|-----------|-------|---------|-------|
| `predictions.test.ts` | 11 | Good | Tests real prediction logic |
| `types.test.ts` | 18 | Trivial | Type structure validation only — redundant with `tsc`/`svelte-check` |
| `advancedPredictions.test.ts` | 28 | Good | Covers ELO, Poisson, fatigue, referee, xG |
| `Dashboard.test.ts` | 12 | Good | Component rendering tests — expanded from 8 |
| `kelly.test.ts` | 20 | Excellent | Thorough edge case coverage |
| `footballData.test.ts` | 26 | Good | API client with error handling |
| `dataService.test.ts` | 10 | Good | Service layer delegation |
| `predictionTracker.test.ts` | 18 | Excellent | Comprehensive with import/export |
| `optimizedPredictions.test.ts` | 12 | Good | Covers prediction structure, model weights, ELO integration, confidence, value odds, Dixon-Coles Poisson lambdas |
| `betHistoryService.test.ts` | 27 | Excellent | Store, resolve, ROI, monthly P/L, win rate, export/import, persistence |
| `BettingHistory.test.ts` | 15 | Good | Component rendering, filter dropdown, profit formatting, pending/resolved states |
| `betBuilder.test.ts` | 40 | Excellent | Match result (H/D/A), BTTS, total goals, corners, cards, rivalry detection, half-time, clean sheets, all 4 combo types |
| `value.test.ts` | 38 | Excellent | Value bet identification (1X2/goals/BTTS), CLV, arbitrage, Sharpe ratio, performance metrics, warnings, error handling |
| **Total** | **275** | — | All pass across 13 files, no skipped/flaky tests |

### Missing Test Coverage
- `Predictions.svelte` — no component test
- `LiveMatches.svelte` — no component test
- `LiveTicker.svelte` — no component test
- `ValueBets.svelte` — no component test
- `KellyCalculator.svelte` — no component test
- `StandingsTable.svelte` — no component test
- `SeasonStats.svelte` — no component test
- `MatchList.svelte` — no component test
- `TopScorers.svelte` — no component test
- `Settings.svelte` — no component test
- `Header.svelte` — no component test
- `App.svelte` — no component test
- `backend/` — 0% test coverage (no pytest tests exist)
- All tests use mocks exclusively — no integration tests exercise the IndexedDB cache layer

### Test quality notes
- `advancedPredictions.test.ts` validates the `avgPenalties: 0.2` stub rather than testing real logic
- `predictions.test.ts` tests `analyzeFormTrend` by duplicating the implementation inline (function is not exported)

---

## Missing Specifications

### Backend Training Pipeline
- All 3 model architectures are complete but untrained
- Feature engineering has 150+ features defined but ALL return random values
- No training script, no train/test splits, no evaluation framework
- Need: spec for `specs/08-backend-training.md` covering data preparation, feature implementation, training pipeline, evaluation metrics, model versioning
