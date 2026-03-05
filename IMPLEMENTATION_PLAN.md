# Premier League Oracle — Implementation Plan

Last updated: 5 March 2026

---

## Current State

### Done
- Supabase fully removed from frontend code (types/index.ts, services, components)
- Football-Data.org v4 API client (`frontend/src/services/api/footballData.ts`) with rate limiting
- IndexedDB 3-tier cache in `frontend/src/services/dataService.ts` (memory -> IndexedDB -> API)
- Prediction models: ELO, Poisson, xG, Fatigue, Referee in `frontend/src/lib/advancedPredictions.ts`
- Ensemble orchestrator in `frontend/src/lib/optimizedPredictions.ts` (ELO 25%, Poisson 30%, Form 20%, H2H 10%, Standings 15%)
- Kelly criterion calculator in `frontend/src/services/betting/kelly.ts` (full/half/quarter Kelly)
- PredictionTracker (localStorage) in `frontend/src/services/predictionTracker.ts` — fully implemented with store, resolve, accuracy stats
- BetBuilder in `frontend/src/lib/betBuilder.ts` — multi-market predictions (partial)
- Vite proxy for Football-Data.org in `frontend/vite.config.ts`
- Test framework: Vitest with testing-library/svelte
- Ralph loop configured: `loop.sh`, `PROMPT_build.md`, `PROMPT_plan.md`
- Python ML backend scaffolded: XGBoost, LSTM, Transformer models, FastAPI, feature engineering

### NOT Done (Incorrectly Marked as Done Previously)
- shadcn-svelte is NOT initialised — zero shadcn files exist anywhere in `frontend/`

---

## Priority 0: Codebase Cleanup (CRITICAL — Do First)

The project has significant duplication that will cause confusion and bugs if not addressed.

### 0a. Remove old `src/` directory
The root `src/` directory is the old v1.x codebase. The active codebase is in `frontend/src/`. The old `src/` contains stale versions of components plus v1-only files (`AiAssistant.svelte`, `PlayerProfile.svelte`, `Counter.svelte`, `aiService.ts`).
- [ ] Delete entire `src/` directory (it's the old v1.x codebase; `frontend/src/` is the active one)

### 0b. Remove stale documentation
Multiple docs reference the old architecture (Supabase, old branches, non-existent features). These conflict with the specs which are the single source of truth.
- [ ] Delete `oldestplan.md` (explicitly marked "OUT OF DATE", points to this file)
- [ ] Delete `SYSTEM_PROMPT.md` (references old Supabase architecture, superseded by CLAUDE.md)
- [ ] Delete `SAAS_OPERATION_GUIDE.md` (premature — references non-existent SaaS features)
- [ ] Delete `MATCH_DAY_EXAMPLES.md` (references non-functional features)
- [ ] Delete `TEST_SUITE.md` (references old `src/` paths, not `frontend/src/`)
- [ ] Delete `USER_GUIDE.md` (references old setup flow with Supabase)
- [ ] Delete `KELLY_CRITERION_GUIDE.md` (educational content, not operational — kelly.ts has proper JSDoc)
- [ ] Delete `frontend/src/devdocs/` directory (4 stale v1 docs: implementation-plan.md, future-enhancements.md, UPDATING_DATA.md, DESIGN_IMPROVEMENTS.md)
- [ ] Delete `docs/` directory (6 stale docs referencing old architecture: api-setup.md, api-integration.md, user-guide.md, getting-started.md, features.md, maximizing-predictions.md)

### 0c. Remove Supabase remnants
- [ ] Delete `supabase/` directory (3 migration SQL files — no longer used)
- [ ] Remove `@supabase/supabase-js` from root `package.json` dependencies (root package.json still has it; `frontend/package.json` is clean)

### 0d. Fix duplicate root package.json
The root `package.json` is a copy of the old v1 `package.json` and still references `@supabase/supabase-js`. Development commands run from `frontend/`.
- [ ] Either delete root `package.json` or convert it to a workspace root that delegates to `frontend/` and `backend/`

### 0e. Trim backend requirements.txt
`backend/requirements.txt` lists 130+ packages including Kafka, Azure, AWS, Graph Neural Networks, Computer Vision, Dash, etc. Most are aspirational and make installation fail.
- [ ] Trim `requirements.txt` to only actually-imported packages (FastAPI, uvicorn, xgboost, torch, transformers, scikit-learn, pandas, numpy, httpx, pydantic, python-dotenv, scipy, etc.)

### 0f. Update Ralph loop prompts
`PROMPT_build.md` and `PROMPT_plan.md` reference `src/*` not `frontend/src/*` and `backend/app/*`.
- [ ] Update `how-to-ralph-wiggum/files/PROMPT_build.md` to reference `frontend/src/*` and `backend/app/*`
- [ ] Update `how-to-ralph-wiggum/files/PROMPT_plan.md` to reference `frontend/src/*` and `backend/app/*`

---

## Phase 1: Data Pipeline & Live Data (specs 02, 05)

### 1a. Fix IndexedDB bugs
`dataService.ts:40-58` — `onupgradeneeded` has two bugs:
1. Missing `scorers` store — `getTopScorers()` at line 252 uses it but it doesn't exist, causing silent failures
2. `standings` store uses `team_id` as keyPath but Football-Data API returns `team.id` nested in object — cache writes silently fail
- [ ] Add `db.createObjectStore('scorers', { keyPath: 'id' })` to `onupgradeneeded` handler
- [ ] Fix `standings` store keyPath to match actual API response structure (use `id` or transform data before caching)

### 1b. Add missing DataService methods (spec 02)
`footballData.ts` has `getLiveMatches()` at line 506, but `dataService.ts` doesn't expose it.
- [ ] Add `getLiveMatches()` to `dataService.ts` — delegates to `footballData.getLiveMatches()`, 60s IndexedDB cache
- [ ] Add `getHistoricalMatches(season: number)` — fetches `/competitions/PL/matches?season={year}&status=FINISHED`, 24h cache, queue requests 6s apart for rate limiting
- [ ] Add `getTeamRecentMatches(teamId: number, limit: number = 5)` — fetches `/teams/{teamId}/matches?status=FINISHED&limit={limit}`, 30min cache

### 1c. Smart polling manager (spec 05)
- [ ] Implement polling schedule: 60s during match hours, 5min on match days, 30min otherwise
- [ ] Adaptive backoff: if 3 consecutive polls return empty, switch to 5-minute intervals

### 1d. Fix LiveMatches.svelte (spec 05)
`LiveMatches.svelte:43` — `liveMatches = []` is hardcoded, never populated from API.
- [ ] Replace stub with `dataService.getLiveMatches()` call on mount + smart polling
- [ ] Show real scores with current minute, team logos, match status
- [ ] Add "No live matches" state with next kickoff countdown

### 1e. Enhance LiveTicker.svelte (spec 05)
`LiveTicker.svelte:34` — uses `Math.random()` for fake confidence values.
- [ ] Priority ordering: live scores > recent results (24h) > upcoming fixtures (48h)
- [ ] Live format: `Arsenal 2-1 Chelsea (67')` with pulsing indicator
- [ ] Remove `Math.random()` confidence generation

### 1f. Backend proxy (spec 02, 03)
- [ ] Add Vite proxy in `frontend/vite.config.ts`: `/api/oracle` -> `http://localhost:8000`

---

## Phase 2: Prediction Engine (spec 01)

### 2a. Dynamic ELO ratings
`advancedPredictions.ts:67-89` — teams initialised with static ratings (Man City: 1850, Luton: 1300). `updateRatings()` exists but is never called.
- [ ] On startup, load persisted ELO ratings from localStorage key `elo_ratings`
- [ ] After each completed match loads, call `eloSystem.updateRatings()` to update ratings
- [ ] Persist updated ratings back to localStorage after each update
- [ ] Wire into `dataService` — trigger ELO updates when processing completed match results

### 2b. Poisson lambdas from real stats
`PoissonPredictor` uses manually estimated lambda values instead of computing from team stats.
- [ ] Lambda home = `(home avg goals scored at home) * (away avg goals conceded away) / (league avg goals)`
- [ ] Lambda away = `(away avg goals scored away) * (home avg goals conceded at home) / (league avg goals)`
- [ ] Pull stats from `dataService.getTeamStats()` instead of hardcoded averages

### 2c. Fatigue analysis fix
`advancedPredictions.ts:308` — `calculateFixtureDifficulty()` always returns `1500` (hardcoded placeholder).
- [ ] Use ELO system (2a) to look up actual opponent ratings
- [ ] Wire fatigue multiplier into `OptimizedPredictor.predictMatch()` to adjust Poisson lambda

### 2d. Referee adjustment
`advancedPredictions.ts:380` — referee stats calculated but never applied to prediction output.
- [ ] Apply +/-3% max adjustment to home win probability based on referee's historical home win rate vs league average
- [ ] Surface referee stats as tooltip/info panel in Predictions component

### 2e. Confidence calibration
`OptimizedPredictor.calculateConfidence()` uses simple probability gap formula.
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

### 2h. Fix hardcoded form strings
`Predictions.svelte:171` has `homeForm: 'WWDLW'` hardcoded. `optimizedPredictions.ts:306` has fallback `'WDLDW'`.
- [ ] Replace with computed form from `dataService.getTeamRecentMatches()`
- [ ] Remove all hardcoded form strings from components and prediction logic

### 2i. Fix hardcoded ELO in optimizedPredictions.ts
`optimizedPredictions.ts:40-57` — all 20 PL teams have hardcoded ELO ratings.
- [ ] Load from the persisted ELO system (2a) instead of static object

---

## Phase 3: Prediction Tracking (spec 06)

### 3a. Replace hardcoded accuracy
`dataService.ts:395-401` — `getPredictionAccuracy()` returns `{total: 100, correct: 65, accuracy: 0.65}` always.
- [ ] Replace with `predictionTracker.getAccuracyStats()` call (the real implementation already exists)

### 3b. Auto-reconciliation
- [ ] Add `reconcilePredictions(completedMatches)` to `dataService.ts`
- [ ] On every `getMatches(status: 'FINISHED')` call, check for pending predictions and resolve them against actual results
- [ ] Call `predictionTracker.updateWithResult()` for each resolved prediction

### 3c. Dashboard real stats
`Dashboard.svelte:169-214` — uses `Math.random()` extensively for fake confidence, odds, accuracy, and bet results.
- [ ] Wire `overallAccuracy` from `predictionTracker.getAccuracyStats().accuracy`
- [ ] Wire `totalPredictions` from `predictionTracker.getAccuracyStats().total`
- [ ] Wire `profitMargin` from `betHistoryService.getROI().roi` (requires Phase 5a first)
- [ ] Wire `betsPlaced` from `betHistoryService.getAllBets().length`
- [ ] Remove ALL `Math.random()` calls (lines 169, 173, 176, 185, 200, 208, 214)

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

### 4a. BetHistoryService (new file)
`BettingHistory.svelte:22` has `bets: any[] = []` — completely empty.
- [ ] Create `frontend/src/services/betting/betHistoryService.ts`
- [ ] Follow localStorage pattern from `PredictionTracker`
- [ ] Implement: `storeBet()`, `updateBetResult()`, `getAllBets()`, `getBetsByMonth()`, `getROI()`, `getMonthlyPL()`, `clearHistory()`

### 4b. Fix BettingHistory.svelte
- [ ] Wire to `betHistoryService` — real history table, monthly P/L bar chart, summary stats
- [ ] Remove `bets: any[] = []` stub entirely

### 4c. Kelly auto-suggestions
`KellyCalculator.svelte` is manual-input only.
- [ ] Load upcoming predictions from `OptimizedPredictor`
- [ ] For predictions with confidence >= 65% and positive EV, generate Kelly suggestions
- [ ] Display as "Suggested Bets" list above manual calculator

### 4d. Fix ValueBets.svelte
`ValueBets.svelte:64-97` — uses `Math.random()` for ALL odds and stats.
- [ ] MVP: manual odds entry — user selects match, enters bookmaker odds
- [ ] Calculate EV = `(predicted_probability * decimal_odds) - 1`
- [ ] Show Kelly-recommended stake as % of bankroll
- [ ] Leave `OddsProvider` interface stub for future API integration

### 4e. Complete betBuilder suggestedCombos
`betBuilder.ts` — `suggestedCombos` is incomplete.
- [ ] Generate 2-4 accumulator combos per match
- [ ] Combine 2-3 markets (e.g. "Home Win + Over 2.5")
- [ ] Only suggest combos with confidence >= 55% and odds >= 2.0
- [ ] Add `reasoning` string per combo

### 4f. Auto-resolve bets
- [ ] When match results arrive via API, check for unresolved bets on that match
- [ ] Call `betHistoryService.updateBetResult()` accordingly

---

## Phase 5: Backend ML Integration (spec 03)

### 5a. BackendService (new file)
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

### 5f. Historical data collection for training
- [ ] Wire `backend/app/data/football_data_collector.py` to use Football-Data.org API
- [ ] Document training command in `AGENTS.md`: `python -m app.data.football_data_collector --seasons 2020,2021,2022,2023,2024`

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

### 6f. Dead code removal
- [ ] Dashboard.svelte: remove unreachable code after `return` in `onMount` (profit chart setup)
- [ ] Remove `Math.random()` star particle animation in `App.svelte:96-100` (cosmetic, low priority)
- [ ] Remove commented-out Supabase import in `BettingHistory.svelte` (if present)

---

## Missing Specifications

The following capabilities are mentioned in the project goals but have no dedicated spec. Create specs if implementing:

### AI Integration (spec 01 section 6 covers frontend; backend has LangChain)
- GPT-5 / Claude natural language match analysis
- Frontend: `aiAnalysis.ts` service (specified in spec 01)
- Backend: `/nl-query` endpoint exists in `main.py`
- Need: spec for the complete end-to-end AI pundit flow (which model, prompt template, caching, cost management)

### Transformer Model Training
- `backend/app/models/transformer_model.py` exists but may be incomplete
- No spec for training pipeline, hyperparameters, or evaluation criteria
- Need: spec for backend model training and evaluation

---

## File Inventory: What Exists vs What's Needed

### Existing Services (frontend/src/services/)
| File | Status |
|------|--------|
| `api/footballData.ts` | Implemented — API client with rate limiting |
| `dataService.ts` | Partial — `footballData.ts` has the underlying methods but dataService doesn't expose getLiveMatches/getHistoricalMatches/getTeamRecentMatches; IndexedDB scorers+standings store bugs |
| `predictionTracker.ts` | Implemented — but not wired into dashboard/accuracy displays |
| `betting/kelly.ts` | Implemented — full/half/quarter Kelly |
| `betting/value.ts` | Partially working — core maths correct but Math.random() used in UI component; empty matchId strings; silent error swallowing |

### Files That Need Creating
| File | Spec | Purpose |
|------|------|---------|
| `services/backendService.ts` | 03 | Frontend-backend bridge |
| `services/liveService.ts` | 05 | WebSocket + polling for live data |
| `services/aiAnalysis.ts` | 01 | AI-powered match analysis |
| `services/betting/betHistoryService.ts` | 04 | Bet history persistence (localStorage) |
| `lib/backtest.ts` | 01 | Ensemble backtesting runner |

### Backend Files (backend/app/)
| File | Status |
|------|--------|
| `api/main.py` | Scaffolded — endpoints defined, needs wiring |
| `models/xgboost_model.py` | Scaffolded — needs training pipeline |
| `models/lstm_predictor.py` | Scaffolded — needs training pipeline |
| `models/transformer_model.py` | Scaffolded — needs training pipeline |
| `models/modern_oracle.py` | Scaffolded — ensemble orchestrator |
| `features/advanced_engineering.py` | Scaffolded — 150+ features defined |
| `data/football_data_collector.py` | Scaffolded — needs API key wiring |
| `security/auth.py` | Scaffolded — HTTPBearer auth |
| `security/secrets.py` | Scaffolded — secrets management |
| `security/validators.py` | Scaffolded — input validation |

---

## Stubs & Hardcoded Values — Complete Audit

| Location | Problem | Fix Phase |
|----------|---------|-----------|
| `dataService.ts:401` | `accuracy: 0.65` hardcoded | Phase 3a |
| `dataService.ts:40-58` | `scorers` IndexedDB store missing | Phase 1a |
| `dataService.ts:286` | `season_id: '2024'` hardcoded TODO | Phase 1b |
| `LiveMatches.svelte:43` | `liveMatches = []` never populated | Phase 1d |
| `LiveTicker.svelte:34` | `Math.random()` for confidence | Phase 1e |
| `BettingHistory.svelte:22` | `bets: any[] = []` empty | Phase 4b |
| `Predictions.svelte:171` | `homeForm: 'WWDLW'` hardcoded | Phase 2h |
| `advancedPredictions.ts:308` | Fatigue always returns 1500 | Phase 2c |
| `advancedPredictions.ts:344-345` | ELO `1500`/`1450` placeholder | Phase 2a |
| `advancedPredictions.ts:380` | Referee stats never applied | Phase 2d |
| `advancedPredictions.ts:454` | `avgPenalties: 0.2` placeholder | Phase 2b |
| `optimizedPredictions.ts:40-57` | All team ELO ratings hardcoded | Phase 2i |
| `optimizedPredictions.ts:306` | Fallback form string `'WDLDW'` | Phase 2h |
| `Dashboard.svelte:169-214` | 7x `Math.random()` calls for fake data | Phase 3c |
| `ValueBets.svelte:64-97` | 9x `Math.random()` for fake odds/stats | Phase 4d |
| `App.svelte:96-100` | `Math.random()` for star particles (cosmetic) | Phase 6f |
| `kelly.ts:202` | `Math.random()` in simulation (acceptable — Monte Carlo) | N/A |
| `predictions.ts:456` | TODO: save prediction to storage | Phase 3d |
| `dataService.ts:294-308` | All home/away team stats hardcoded to 0 (clean_sheets, failed_to_score, etc.) | Phase 1b |
| `dataService.ts:50-53` | IndexedDB `standings` store uses `team_id` keyPath but API returns `team.id` nested | Phase 1a |
| `value.ts:74,99,112,143` | Empty `matchId: ''` hardcoded — value bets created with blank match IDs | Phase 4d |
| `predictionTracker.ts:206-234` | Streak calculation bug — resets then decrements, incorrect worst streak | Phase 3a |
| `dataService.test.ts` | Tests methods that don't exist: `getHeadToHead()`, `getMatches({teamName})` | Phase 1b |

---

## Additional Bugs Found (Deep Analysis)

| Location | Bug | Severity |
|----------|-----|----------|
| `dataService.ts:50-53` | `standings` IndexedDB store uses `team_id` as keyPath but Football-Data API returns `team.id` nested in object — cache writes will silently fail | High |
| `predictionTracker.ts:206-234` | Streak logic resets `currentStreak` to 0 then decrements to -1, making worst streak calculation unreliable | Medium |
| `value.ts:151-153` | Empty catch block swallows errors silently — value bet identification failures are invisible | Medium |
| `dataService.test.ts` | Tests reference non-existent methods (`getHeadToHead`, `getMatches({teamName})`) — tests may pass due to mocking but don't validate real API | Low |

---

## TODO/FIXME Comments in Codebase

| Location | Comment | Fix Phase |
|----------|---------|-----------|
| `dataService.ts:286` | `// TODO: Get current season ID` | Phase 1b |
| `dataService.ts:396` | `// TODO: Implement prediction tracking and accuracy calculation` | Phase 3a |
| `predictions.ts:456` | `// TODO: Implement prediction saving to local storage or API` | Phase 3d |
| `BettingHistory.svelte:22` | `// TODO: replace with BetHistoryService` | Phase 4b |
