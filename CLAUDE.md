# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Important - Please commit as you go along, gradually, just like a developer would. ONLY AFTER COMPLETED FEATURES THAT ARE ISOLATED FROM THE NEXT OR FUTURE FEATURES IN THE SAME BRANCH. UK English and sound like me! DONT PUT CLAUDE CODE IN THE COMMIT MESSAGES PLEASE

## Project Overview

The Premier League Oracle is a data-driven football prediction platform that uses statistical models and machine learning to predict match outcomes and analyse team performance in the English Premier League.

## Tech Stack

- **Frontend**: Svelte 4.2.19 + TypeScript + Vite (in `frontend/`)
- **Backend**: Python + FastAPI + XGBoost/LSTM/Transformer (in `backend/`)
- **Styling**: Tailwind CSS with dark/light mode support
- **Data Source**: Football-Data.org API v4 (no Supabase)
- **Caching**: IndexedDB 3-tier cache (memory -> IndexedDB -> API)
- **Charts**: Chart.js with svelte-chartjs
- **Testing**: Vitest with @testing-library/svelte
- **Deployment**: Vercel (frontend)

## Development Commands

```bash
# Frontend (run from frontend/ directory)
cd frontend
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # TypeScript and Svelte checks
npm run test         # Run tests with Vitest
npm run test:run     # Run tests once (no watch)
npm run test:coverage # Run tests with coverage

# Backend (run from backend/ directory)
cd backend
pip install -r requirements.txt
uvicorn app.api.main:app --reload --port 8000
```

## Code Architecture

### Frontend Structure (`frontend/src/`)
- `components/` - Svelte components (Dashboard, Predictions, LiveMatches, etc.)
- `components/betting/` - Betting UI (KellyCalculator, ValueBets)
- `lib/` - Core prediction libraries:
  - `advancedPredictions.ts` - Statistical models (ELO, Poisson, xG, Fatigue, Referee)
  - `optimizedPredictions.ts` - Weighted ensemble orchestrator (production model)
  - `predictions.ts` - Original weighted prediction model
  - `betBuilder.ts` - Multi-market prediction generator
- `services/` - Data and business logic:
  - `api/footballData.ts` - Football-Data.org API client with rate limiting
  - `dataService.ts` - Singleton data layer (cache + API)
  - `predictionTracker.ts` - Prediction persistence (localStorage)
  - `betting/kelly.ts` - Kelly Criterion calculator
  - `betting/value.ts` - Value bet detection engine (user-supplied odds via ValueBets UI)
  - `betting/betHistoryService.ts` - Bet persistence and ROI tracking (localStorage)
- `types/index.ts` - Shared TypeScript types
- `utils/teamLogos.ts` - Team logo URL mappings
- `App.svelte` - Root component with routing
- `app.css` - Global styles with glassmorphism theme

### Backend Structure (`backend/app/`)
- `api/main.py` - FastAPI server with prediction endpoints
- `models/` - ML models (xgboost_model.py, lstm_predictor.py, transformer_model.py, modern_oracle.py)
- `features/advanced_engineering.py` - 150+ feature engineering pipeline (63 methods return hardcoded 0.0 — Pro tier)
- `features/free_tier_features.py` - Free-tier feature engineering (86 features, standalone, fully functional)
- `train_free_tier.py` - Free-tier training script (XGBoost + LR baseline, chronological split)
- `data/football_data_collector.py` - Historical data collection
- `security/` - Auth, secrets, validators

### Key Design Decisions
- **Single data source**: Football-Data.org API v4. No Supabase.
- **Frontend-first**: TypeScript ensemble runs entirely in browser. Python backend is optional enhancement.
- **localStorage persistence**: ELO ratings, predictions, bets, settings all in localStorage.
- **Vite proxy**: `/api/football-data` proxies to `https://api.football-data.org/v4`


## Specifications

All feature specifications live in `specs/`:
- `01-prediction-engine.md` - ELO, Poisson, fatigue, referee, confidence, backtesting
- `02-data-pipeline.md` - Football-Data.org integration, caching, historical data
- `03-backend-integration.md` - Python ML backend connection
- `04-betting-intelligence.md` - Kelly, value bets, bet history, accumulators
- `05-live-data.md` - Live scores, smart polling, WebSocket
- `06-prediction-tracking.md` - Accuracy tracking, auto-reconciliation
- `07-ui-ux.md` - shadcn-svelte migration, dark mode, accessibility

- `08-backend-training.md` - Backend ML training pipeline (free-tier + Pro-tier)

These specs are the single source of truth for requirements.

### Coding Standards
- Use TypeScript for all new frontend code
- Follow existing Svelte component patterns
- Maintain dark/light theme compatibility
- Use Tailwind CSS classes for styling
- Check types before committing: `cd frontend && npm run check`
- Run tests before committing: `cd frontend && npm run test:run`

### Current Focus Areas
- **Project ~82% complete** — see `IMPLEMENTATION_PLAN.md` for remaining work only (completed items archived to `CHANGELOG.md`)
- **Free-tier ML model ready to train** — `cd backend && python train_free_tier.py` (86 features, 62 tests, API endpoints wired)
- **Remaining work:** P2 partial (Docker, backend deps, CI), P5 hardening (rate limiter, test quality, type safety), deferred Pro-tier (P3a–d)
- Active branches: `v3.0-BackendMLTraining` (backend ML), `v3.0-Frontend` (frontend), `v3.0-Development` (integration)
- Ralph loop configured via `loop.sh` + `PROMPT_plan.md` + `PROMPT_build.md`

### Important Notes
- `frontend/src/` is the active codebase (old `src/` directory has been removed)
- shadcn-svelte: 5 components installed (Button, Card, Badge, Separator, Skeleton); Button wired in 5 components, Card wrapping 10 card-glass instances, Badge in 3 components (with `info`/`neutral` variants added). Orphaned `.btn-*`/`.badge-*` CSS removed from `app.css` (only `.btn-neon` kept). Remaining unwired: Dialog (ApiSetupWizard modal), Sheet (mobile sidebar). `components.json` exists (enables `npx shadcn-svelte@latest add`)
- Backend server starts with graceful degradation — all heavy deps (shap, optuna, redis, sklearn, joblib, langchain, torch) are optional with availability flags; ML endpoints disabled when deps missing but `/health` returns 200
- Backend feature engineering: 0 `np.random.*` calls in feature methods (was 102), but **63 methods return hardcoded `0.0`** — tactics, player-level, betting market, weather, advanced metrics features all stubbed (count corrected from 49 in third audit). **3 `np.random` calls remain**: `lstm_predictor.py:523` (fake feature importance), `modern_oracle.py:581` (fake ensemble optimisation), `lstm_predictor.py:537-540` (synthetic training data fallback)
- Backend security modules (`auth.py`, `secrets.py`, `validators.py`) are entirely unused at runtime — not imported by `main.py`
- ~~Backend has 0% test coverage~~ **FIXED:** 62 backend tests across 3 files (39 feature engineering, 12 training pipeline, 11 API endpoints) — all passing. `test_setup.py` still only checks imports
- Frontend has 375 Vitest tests across 23 test files, all passing (was 351 — 24 added: aiAnalysis.test.ts)
- 43 Playwright E2E tests across 6 spec files (0 skipped), run in 3 viewports = 123 total executions
- 8 components have unit tests (Dashboard, BettingHistory, ChatBot, LiveMatches, Predictions, Settings, KellyCalculator, ValueBets) — 10 components untested
- `betBuilder.ts` has 40 tests and `value.ts` has 38 tests — both fully covered
- ~~`predictions.ts` was entirely dead at runtime~~ **REMOVED:** module and 11 misleading tests deleted. Production model is `optimizedPredictions.ts`
- ~~3 new service files need creating: backendService, liveService, aiAnalysis (`backtest.ts` already created)~~ **ALL DONE:** backendService (P2b), liveService (P3f), aiAnalysis (P3g) all created
- ~~`ChatBot.svelte` makes direct browser-to-OpenAI API calls (key visible in network tab)~~ **FIXED:** Created `api/chat.ts` Vercel Edge Function that proxies OpenAI calls. ChatBot calls `/api/chat` instead. Vite dev middleware provides local proxy. `OPENAI_API_KEY` env var enables server-side key (users skip key setup)
- Football-Data.org free tier constraint: xG, shots, possession, cards, corners data unavailable — limits ~70 backend features permanently
- `SeasonStats.svelte` lateDrama uses `full_time_result !== half_time_result` — both fields exist on `Match` type and are populated by `transformMatch`; relabelled to "Results changed after halftime"
- `Prediction` type in `types/index.ts` is a dead legacy interface — diverges from `StoredPrediction` (the actual runtime type)
- `Help.svelte` had 5 major inaccuracies fixed in P1f; remaining issues: "offline data caching" claim (no Service Worker), "CSV export" (exports JSON), aspirational feature claims, made-up accuracy percentages in "Golden Rules"
- `.gitignore` has `backend/.env` (fixed 18 March 2026) — API keys protected
- `backend/docs/FOR_BEGINNERS.md` and `backend/README.md` have broken links to deleted guide files
- ~~No `vercel.json` exists~~ **FIXED:** `vercel.json` created with build command, output directory, and SPA catch-all rewrite. Football-Data.org sends `Access-Control-Allow-Origin: *` so direct browser calls work in production
- CSV training data in `backend/spreadsheets/KnowledgeFilesCSV/` — 2,191 matches across 5.75 seasons with shots, corners, cards, odds columns (richer than what the free API provides). These are the primary source for ML training
- `torch` is missing from `requirements.txt` but present in `environment.yml` — LSTM/Transformer models non-functional via pip install alone
- ~~Root `.env.example` still references Supabase variables~~ **FIXED:** Supabase references removed, replaced with Football-Data.org API comment
- ~~`betHistoryService.storeBet()` never called~~ — FIXED: wired into KellyCalculator and ValueBets via "Track Bet" buttons. Bets now flow to BettingHistory display and ROI/P&L calculations
- ~~`ChatBot.svelte:420` uses `{@html renderMarkdown()}` which renders unsanitised HTML~~ **FIXED:** `renderMarkdown()` output now sanitised via `DOMPurify.sanitize()` with explicit tag/attribute allowlist
- ~~`Predictions.svelte:215` — `was_correct: false` hardcoded when storing predictions~~ **FIXED:** `was_correct` removed from initial prediction object, made optional on `Prediction` type
- ~~No CI/CD~~ **FIXED:** `.github/workflows/ci.yml` runs type check, unit tests, and production build on push/PR to `main` and `v3.0-*` branches
- `docker-compose.yml` references missing files (`config.yml`, `nginx.conf`, `notebooks/`) — cannot start
- ~~Test quality: 16 tautological tests in `types.test.ts`, 6 conditional assertions in `value.test.ts` that silently pass~~ **FIXED:** tautological tests removed (18→4), conditional assertions made unconditional. ~~`predictions.test.ts` tests a dead module~~ **REMOVED** (P4f). `kelly.test.ts:240` guarded arb assertion also removed. See P4h in IMPLEMENTATION_PLAN.md
- ~~`EloRatingSystem.processCompletedMatches()` exists but is never called~~ **FIXED:** `sharedEloSystem.processCompletedMatches()` now called from `dataService.reconcilePredictions()` — ELO ratings auto-update when match results load
- **`AdvancedMatchPredictor` is NOT dead code** — called by `value.ts:72` for value bet scanning. Previously mislabelled as dead in the plan (corrected third audit)
- ~~`betBuilder.ts`: corner/card probability overflow~~ — FIXED: clamped to [0, 0.99]
- ~~`KellyCalculator.svelte`: circular Kelly calculation~~ — FIXED: now uses model confidence as ourProbability, valueOdds as bookmakerOdds
- ~~`footballData.ts`: halfTimeResult 0-0 bug~~ — FIXED: explicit null/undefined check replaces falsy check
- ~~`dataService.ts` cache TTL comments lie about actual TTL (comments say 24h/30m, actual is 5 minutes)~~ **FIXED:** TTL values now passed correctly (24h for historical, 30min for team recent)
- ~~Two parallel fatigue models exist~~ **FIXED:** `OptimizedPredictor.calculateFatigueFactor()` now delegates to `FatigueAnalyzer.getFatigueMultiplier()` — single source of truth for fatigue calculations
- `FatigueAnalyzer.getFatigueMultiplier()` floors restDays at 0.5 to prevent zero-multiplier causing NaN in Poisson calculations
- `LEAGUE_AVG_HOME_WIN_RATE` is no longer hardcoded — computed from actual completed matches via `computeLeagueAverages().homeWinRate` (fallback 0.46)
- ~~Dead frontend dependencies: `tailwind-variants`, `bits-ui`, `happy-dom`~~ **FIXED:** all three uninstalled
- ~~`.gitignore` gaps: only one `__pycache__` path covered~~ **FIXED:** `**/__pycache__/` glob added, plus `backend/cache/`, `backend/logs/`, `backend/mlruns/`
- `advanced_engineering.py`: `_is_derby_match()` uses API names but CSV training data has short names — derby detection always returns `0.0` during training
- `betHistoryService.StoredBet.market` uses `'over_2_5'` format but `value.ts ValueBet.market` uses `'over2.5'` — **MITIGATED:** `ValueBets.svelte` already has `mapMarket()` conversion; no code path bypasses it
- Backend `/standings` endpoint returns `pd.DataFrame` which is not JSON-serialisable — will `TypeError` at runtime. Needs `.to_dict(orient='records')` conversion
- ~~`footballData.ts:189`: HTTP 403 treated as "invalid API key" but free tier also returns 403 for rate-limit exceeded~~ **FIXED:** now parses response body to distinguish rate-limit from auth failure
- ~~`BacktestRunner` makes ~1,140+ sequential API calls~~ **FIXED:** `predictMatch()` now uses `historicalMatches` directly when provided — 0 `dataService` calls per match in backtest mode (was 6 per match). Normal live predictions unchanged
- ~~`tailwind.config.js` declares fonts `Figtree` and `Outfit` but no font import or assets exist`~~ **CORRECTED:** `index.html` properly loads both Figtree and Outfit via Google Fonts with lazy-load `media="print"` + `onload` pattern and `<noscript>` fallback. Fonts are working correctly
- ~~`package.json` version is `0.0.0` — never updated to reflect project version (v3.0)~~ **FIXED:** version set to `3.0.0`
- ~~`DOMPurify` is referenced in CLAUDE.md as needed for ChatBot XSS fix but is NOT installed~~ **FIXED:** `dompurify` and `@types/dompurify` now installed and used in ChatBot.svelte
- ~~`frontend/src/lib/utils.ts` does NOT exist~~ **FIXED:** `$lib/utils.ts` created with standard `cn()` utility (`clsx` + `tailwind-merge`). shadcn-svelte components can now import `cn()` correctly
- ~~`dataService.ts:395`: `getTeamForm` cache key uses `matches.length` not content~~ **FIXED:** cache key now uses match IDs as fingerprint
- `backtest.test.ts:156-174` encodes the known Kelly 1.05 inflation bug as a correct expected value (`0.525`). Fixing P1l will break this test — update expected value to `0.50` alongside the fix
- `requirements.txt` is missing `langchain-community` (needed by `modern_oracle.py`) and `bcrypt` (needed by `auth.py` passlib backend)
- `main.py:511-515`: `/features/importance` accesses `oracle.lstm_model.model` without None guard — `AttributeError` when torch is unavailable
- `backend/spreadsheets/` is gitignored — cloning the repo does NOT include the CSV training data needed for `train_free_tier.py`
- MIT licensed for open-source collaboration
- `main.py:724-725`: `/predict/free` rate limiter broken — `client_ip` always `"unknown"`, all clients share one bucket. Needs `request.client.host` extraction
- `LiveMatches.svelte`: tab panels declare `aria-controls="panel-live"` etc. but panel `<div>` elements have no `id` attributes — ARIA association broken
- `ChatBot.test.ts`: DOMPurify mock returns raw HTML unchanged — XSS regression from P1j fix would be invisible to tests
- ~~`betBuilder.ts:316-333`: Crystal Palace/Brighton rivalry broken — uses `'Brighton and Hove Albion'` but API sends `'Brighton & Hove Albion FC'`, `normaliseTeamName()` doesn't handle `&` vs `and`~~ **FIXED:** `normaliseTeamName()` now converts `&` to `and`
- ~~`frontend/package.json`: `@types/node` pinned to `^25.5.0` but runtime is Node 20 (per `.nvmrc` and CI)~~ **FIXED:** pinned to `^20.17.0`
- `.gitignore`: `backend/chroma_db/` not listed — generated `chroma.sqlite3` database file could be committed
- ~~Spec files 03, 04, 05, 07, 08 have severely outdated completion markers (see P5b in IMPLEMENTATION_PLAN.md)~~ **FIXED:** all 5 specs synced (P5b done 26 March 2026)
- `liveService.ts:235`: WebSocket URL hardcodes port `8000` — will silently fail in production deployments where backend is not on same hostname:8000. Polling fallback masks the failure
- ~~Season year calculation `getMonth() >= 6` duplicated in 3 places~~ **FIXED:** extracted `getSeasonYear()` and `SEASON_START_MONTH` to `lib/utils.ts` (P5j)
- ~~`optimizedPredictions.ts:566`: H2H no-data fallback uses `homeWinRate: 0.40` but `constants.ts` has `DEFAULT_HOME_WIN_RATE = 0.46`~~ **FIXED:** now uses `DEFAULT_HOME_WIN_RATE` (P5k)
- ~~`dataService.ts:98-101`: empty if/else branches with comment-only bodies~~ **FIXED:** collapsed (P5l)
- ~~`advancedPredictions.ts:29`: `maxGoals = 10` default in PoissonPredictor, spec says cap at 7~~ **FIXED:** changed to 7 (P5l)
- `Predictions.svelte:7` imports `Prediction` type from `types/index.ts` — investigated and found to be ACTIVELY USED for view-level prediction mapping (not dead code as previously thought)
- `footballData.ts`: `competitionId` now uses named `PREMIER_LEAGUE_ID` constant (was magic number 2021)
- `lib/utils.ts`: exports `getSeasonYear(date?)`, `SEASON_START_MONTH`, `getSeasonLabel()`, `cn()`, `focusTrap()` — the shared utility module for the frontend
- No TODO/FIXME/HACK comments remain in the codebase (eighth audit, 25 March 2026)
- Spec 06 (prediction tracking) is 100% complete — all 7/7 acceptance criteria met
- Spec 07 (UI/UX) at ~75% — 3/5 shadcn components wired (Button, Card, Badge); remaining: Dialog (ApiSetupWizard modal), Sheet (mobile sidebar), dead code removal, form string computation

### The #1 Rule of E2E Tests A test MUST fail when the feature it tests is broken. No exceptions. If a real user would see something broken, the test must fail. No "fixing the app inside the test". A passing test that hides a broken feature is worse than no test at all.