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
- **Charts**: Chart.js with svelte-chartjs (theme-aware via CSS variables)
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
  - ~~`predictions.ts` - Original weighted prediction model~~ **REMOVED** — production model is `optimizedPredictions.ts`
  - `betBuilder.ts` - Multi-market prediction generator
  - `renderMarkdown.ts` - Shared markdown→HTML renderer (DOMPurify sanitised, used by ChatBot + Predictions)
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
- `features/free_tier_features.py` - Free-tier feature engineering (94 features incl. 8 draw indicators, standalone, fully functional)
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
- **Free-tier ML model trained** — first run complete (51.0% accuracy, model at `backend/models/xgboost_free_tier.joblib`). Frontend now calls `/predict/free` endpoint. Legacy `xgboost_model.pkl` deleted (was incompatible). Improvement roadmap in IMPLEMENTATION_PLAN.md
- **Remaining work:** P1 ALL DONE, P2 partial (Docker, CI, deps, .gitignore), P5 hardening (CSS bugs, prediction quality, test quality, dead code), deferred Pro-tier (P3a–d)
- Active branches: `v3.0-BackendMLTraining` (backend ML), `v3.0-Frontend` (frontend), `v3.0-Development` (integration)
- Ralph loop configured via `loop.sh` + `PROMPT_plan.md` + `PROMPT_build.md`

### Important Notes
- `frontend/src/` is the active codebase (old `src/` directory has been removed)
- shadcn-svelte: 7 components installed (Button, Card, Badge, Separator, Skeleton, Dialog, Sheet); all wired — Button in 9 components, Card wrapping 10 card-glass instances, Badge in 3 components (with `info`/`neutral` variants added), Dialog in ApiSetupWizard, Sheet in Sidebar mobile view. SidebarNav.svelte extracted for desktop/mobile reuse. Remaining unwired: none. `components.json` exists (enables `npx shadcn-svelte@latest add`)
- Backend server starts with graceful degradation — all heavy deps (shap, optuna, redis, sklearn, joblib, langchain, torch) are optional with availability flags; ML endpoints disabled when deps missing but `/health` returns 200. Oracle ensemble model loading removed from startup (no `xgboost_model.pkl`, `lstm_model.pt`, `transformer_model.pt`). Frontend uses `/predict/free` endpoint exclusively
- Backend feature engineering: 0 `np.random.*` calls in feature methods (was 102), but **63 methods return hardcoded `0.0`** — tactics, player-level, betting market, weather, advanced metrics features all stubbed (count corrected from 49 in third audit). **2 `np.random` calls remain**: `lstm_predictor.py:523` (fake feature importance), `modern_oracle.py:581` (fake ensemble optimisation). ~~`lstm_predictor.py:537-540` (synthetic training data fallback)~~ **FIXED:** `None` guard added so synthetic fallback no longer reached when real data present (P2r)
- Backend security modules (`auth.py`, `secrets.py`, `validators.py`) are entirely unused at runtime — not imported by `main.py`
- ~~Backend has 0% test coverage~~ **FIXED:** 67 backend tests across 3 files (39 feature engineering, 12 training pipeline, 16 API endpoints) — all passing. ~~`test_setup.py` still only checks imports~~ **FIXED:** renamed to `check_imports.py` so pytest no longer collects it (P5an)
- Frontend has 369 Vitest tests across 23 test files, all passing (was 373 — 4 WebSocket tests removed with P5v dead infrastructure cleanup)
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
- ~~No CI/CD~~ **FIXED:** `.github/workflows/ci.yml` runs type check, unit tests with coverage enforcement (60/65/65/60 thresholds), and production build on push/PR to `main` and `v3.0-*` branches. Backend Python tests (67 tests via pytest) now also run in CI (P5c). Node version reads from `.nvmrc` instead of hardcoded `20` (P5g)
- ~~`docker-compose.yml` references missing files (`config.yml`, `nginx.conf`, `notebooks/`) — cannot start~~ **FIXED:** stripped to just `oracle-api` service; Pro-tier services (Redis, MLflow, Postgres, Jupyter, Nginx) commented out (P2o)
- ~~Test quality: 16 tautological tests in `types.test.ts`, 6 conditional assertions in `value.test.ts` that silently pass~~ **FIXED:** tautological tests removed (18→4), conditional assertions made unconditional. ~~`predictions.test.ts` tests a dead module~~ **REMOVED** (P4f). `kelly.test.ts:240` guarded arb assertion also removed. See P4h in IMPLEMENTATION_PLAN.md
- ~~`EloRatingSystem.processCompletedMatches()` exists but is never called~~ **FIXED:** `sharedEloSystem.processCompletedMatches()` now called from `dataService.reconcilePredictions()` — ELO ratings auto-update when match results load
- **`AdvancedMatchPredictor` is NOT dead code** — called by `value.ts:72` for value bet scanning. Previously mislabelled as dead in the plan (corrected third audit)
- ~~`betBuilder.ts`: corner/card probability overflow~~ — FIXED: clamped to [0, 0.99]
- ~~`KellyCalculator.svelte`: circular Kelly calculation~~ — FIXED: now uses model confidence as ourProbability, valueOdds as bookmakerOdds
- ~~`footballData.ts`: halfTimeResult 0-0 bug~~ — FIXED: explicit null/undefined check replaces falsy check
- ~~`dataService.ts` cache TTL comments lie about actual TTL (comments say 24h/30m, actual is 5 minutes)~~ **FIXED:** TTL values now passed correctly (24h for historical, 30min for team recent)
- ~~Two parallel fatigue models exist~~ **FIXED:** `OptimizedPredictor.calculateFatigueFactor()` now delegates to `FatigueAnalyzer.getFatigueMultiplier()` — single source of truth for fatigue calculations
- ~~`FatigueAnalyzer.getFatigueMultiplier()` had a dead `recentFixtures` parameter — every caller passed `1`~~ **FIXED:** simplified to single-param `(restDays: number)` with formula `min(max(restDays, 0.5) / 7, 1)` — floors at 0.5 to prevent zero-multiplier NaN in Poisson (P5ad)
- `LEAGUE_AVG_HOME_WIN_RATE` is no longer hardcoded — computed from actual completed matches via `computeLeagueAverages().homeWinRate` (fallback 0.46)
- ~~Dead frontend dependencies: `tailwind-variants`, `bits-ui`, `happy-dom`~~ **FIXED:** all three uninstalled. `bits-ui` remains uninstalled; Dialog and Sheet components are custom implementations using the project's `focusTrap` action, consistent with the other 5 shadcn components (none use bits-ui)
- ~~`.gitignore` gaps: only one `__pycache__` path covered~~ **FIXED:** `**/__pycache__/` glob added, plus `backend/cache/`, `backend/logs/`, `backend/mlruns/`
- `advanced_engineering.py`: `_is_derby_match()` uses API names but CSV training data has short names — derby detection always returns `0.0` during training
- `betHistoryService.StoredBet.market` uses `'over_2_5'` format but `value.ts ValueBet.market` uses `'over2.5'` — **MITIGATED:** `ValueBets.svelte` already has `mapMarket()` conversion; no code path bypasses it
- ~~Backend `/standings` endpoint returns `pd.DataFrame` which is not JSON-serialisable — will `TypeError` at runtime~~ **FIXED:** now calls `.to_dict(orient='records')` before returning
- ~~`footballData.ts:189`: HTTP 403 treated as "invalid API key" but free tier also returns 403 for rate-limit exceeded~~ **FIXED:** now parses response body to distinguish rate-limit from auth failure
- ~~`BacktestRunner` makes ~1,140+ sequential API calls~~ **FIXED:** `predictMatch()` now uses `historicalMatches` directly when provided — 0 `dataService` calls per match in backtest mode (was 6 per match). Normal live predictions unchanged
- ~~`tailwind.config.js` declares fonts `Figtree` and `Outfit` but no font import or assets exist`~~ **CORRECTED:** `index.html` properly loads both Figtree and Outfit via Google Fonts with lazy-load `media="print"` + `onload` pattern and `<noscript>` fallback. Fonts are working correctly
- ~~`package.json` version is `0.0.0` — never updated to reflect project version (v3.0)~~ **FIXED:** version set to `3.0.0`
- ~~`DOMPurify` is referenced in CLAUDE.md as needed for ChatBot XSS fix but is NOT installed~~ **FIXED:** `dompurify` and `@types/dompurify` now installed and used in ChatBot.svelte
- ~~`frontend/src/lib/utils.ts` does NOT exist~~ **FIXED:** `$lib/utils.ts` created with standard `cn()` utility (`clsx` + `tailwind-merge`). shadcn-svelte components can now import `cn()` correctly
- ~~`dataService.ts:395`: `getTeamForm` cache key uses `matches.length` not content~~ **FIXED:** cache key now uses match IDs as fingerprint
- `backtest.test.ts:156-174` encodes the known Kelly 1.05 inflation bug as a correct expected value (`0.525`). Fixing P1l will break this test — update expected value to `0.50` alongside the fix
- ~~`requirements.txt` missing `langchain-community` and `bcrypt`~~ **FIXED:** Dead security module deps removed entirely from `requirements.txt` (P2r) — `auth.py`, `secrets.py`, `validators.py` are unused at runtime
- ~~`main.py:511-515`: `/features/importance` endpoint accesses `oracle.lstm_model.model` without checking if `lstm_model` is not None — will `AttributeError` when torch missing~~ **FIXED:** Added `is not None` guard for both `lstm_model` and `transformer_model` (P2r)
- `backend/spreadsheets/` is gitignored — cloning the repo does NOT include the CSV training data needed for `train_free_tier.py`
- MIT licensed for open-source collaboration
- ~~`main.py:724-725`: `/predict/free` rate limiter broken — `client_ip` always `"unknown"`~~ **FIXED:** `_get_client_ip()` extracts real IP from `X-Forwarded-For` header with `request.client.host` fallback (P5a)
- ~~`LiveMatches.svelte`: tab panels declare `aria-controls="panel-live"` etc. but panel `<div>` elements have no `id` attributes — ARIA association broken~~ **FIXED:** panels now have matching `id="panel-live"`, `id="panel-recent"`, `id="panel-upcoming"` attributes
- ~~`ChatBot.test.ts`: DOMPurify mock returns raw HTML unchanged~~ **FIXED:** mock now uses spy, test verifies `sanitize()` is called with response content (P5e)
- ~~`betBuilder.ts:316-333`: Crystal Palace/Brighton rivalry broken — uses `'Brighton and Hove Albion'` but API sends `'Brighton & Hove Albion FC'`, `normaliseTeamName()` doesn't handle `&` vs `and`~~ **FIXED:** `normaliseTeamName()` now converts `&` to `and`
- ~~`frontend/package.json`: `@types/node` pinned to `^25.5.0` but runtime is Node 20 (per `.nvmrc` and CI)~~ **FIXED:** pinned to `^20.17.0`
- ~~`.gitignore`: `backend/chroma_db/` not listed — generated `chroma.sqlite3` database file could be committed~~ **FIXED:** `backend/chroma_db/` is already listed in `.gitignore` at line 20
- ~~Spec files 03, 04, 05, 07, 08 have severely outdated completion markers (see P5b in IMPLEMENTATION_PLAN.md)~~ **FIXED:** all 5 specs synced (P5b done 26 March 2026)
- ~~`liveService.ts:235`: WebSocket URL hardcodes port `8000`~~ **FIXED then REMOVED:** WebSocket infrastructure removed entirely in P5v — liveService is now polling-only
- ~~Season year calculation `getMonth() >= 6` duplicated in 3 places~~ **FIXED:** extracted `getSeasonYear()` and `SEASON_START_MONTH` to `lib/utils.ts` (P5j)
- ~~`optimizedPredictions.ts:566`: H2H no-data fallback uses `homeWinRate: 0.40` but `constants.ts` has `DEFAULT_HOME_WIN_RATE = 0.46`~~ **FIXED:** now uses `DEFAULT_HOME_WIN_RATE` (P5k)
- ~~`dataService.ts:98-101`: empty if/else branches with comment-only bodies~~ **FIXED:** collapsed (P5l)
- ~~`advancedPredictions.ts:29`: `maxGoals = 10` default in PoissonPredictor, spec says cap at 7~~ **FIXED:** changed to 7 (P5l)
- `Predictions.svelte:7` imports `Prediction` type from `types/index.ts` — investigated and found to be ACTIVELY USED for view-level prediction mapping (not dead code as previously thought)
- `footballData.ts`: `competitionId` now uses named `PREMIER_LEAGUE_ID` constant (was magic number 2021)
- `lib/utils.ts`: exports `getSeasonYear(date?)`, `SEASON_START_MONTH`, `getSeasonLabel()`, `cn()`, `focusTrap()` — the shared utility module for the frontend
- No TODO/FIXME/HACK comments remain in the codebase (eighth audit, 25 March 2026)
- Spec 06 (prediction tracking) is 100% complete — all 7/7 acceptance criteria met
- Spec 07 (UI/UX) at 100% — ALL 17/17 criteria met. All 7 shadcn components wired (Button, Card, Badge, Separator, Skeleton, Dialog, Sheet)
- ~~**Poisson maxGoals inconsistency (P5n):** 4 different values across codebase — `advancedPredictions.ts` fixed to 7, but `optimizedPredictions.ts:278` uses 5, `Predictions.svelte` uses 6, `value.ts:234` uses 10. Spec says 7. All three unfixed sites directly affect prediction probabilities~~ **FIXED:** all four sites now use `maxGoals=7`. `optimizedPredictions.ts`, `Predictions.svelte`, and `value.ts` updated. Note: `value.ts` no longer has its own Poisson implementation — private methods removed, now imports `PoissonPredictor` from `advancedPredictions.ts`
- ~~Three separate Poisson implementations exist: `advancedPredictions.ts` (PoissonPredictor class), `value.ts` (private static methods), `betBuilder.ts` (separate implementation). Should consolidate to one~~ **FIXED:** single Poisson implementation in `advancedPredictions.ts` (`PoissonPredictor`). `value.ts` private methods removed and replaced with imports from `advancedPredictions.ts`. `betBuilder.ts` already imported the shared class
- ~~`optimizedPredictions.ts:644`: `getStandingsProbabilities` no-data fallback uses `homeWin: 0.40` — inconsistent with `DEFAULT_HOME_WIN_RATE = 0.46` (P5o, different location from the P5k H2H fix)~~ **FIXED:** now uses `DEFAULT_HOME_WIN_RATE` (P5o)
- ~~`backtest.ts`: snapshots/restores ELO ratings but NOT `processedMatchIds` — matches processed during backtest remain marked as processed, potentially blocking future live ELO updates (P5p)~~ **FIXED:** `processedMatchIds` now included in snapshot/restore cycle (P5p)
- ~~`dataService.ts`/`footballData.ts`: live match query uses `IN_PLAY,PAUSED` only — `EXTRA_TIME` and `PENALTY_SHOOTOUT` statuses not included, matches in extra time disappear from live view (P5q)~~ **FIXED:** live match query now includes `IN_PLAY,PAUSED,EXTRA_TIME,PENALTY_SHOOTOUT` (P5q)
- ~~`ApiSetupWizard.svelte`: no focus trap on open (WCAG 2.1 failure), no Escape key handler~~ **FIXED:** ApiSetupWizard now uses the shadcn Dialog component which handles focus trap, Escape key, and click-outside natively. The previous manual `use:focusTrap`, Escape handler, and backdrop implementations were removed in favour of the Dialog wrapper (P5r)
- ~~`$lib/utils/cn.ts` duplicates `cn()` from `$lib/utils.ts`~~ **FIXED:** duplicate deleted, all 10 shadcn component imports updated to `$lib/utils` (P5s)
- ~~Dead exports: `kelly.ts` `isValueBet()`, `advancedPredictions.ts` `TeamRating` interface~~ **FIXED:** both removed (P5s). Note: `predictionTracker.ts` `GameweekAccuracy`/`getAccuracyByGameweek()` are NOT dead — actively used by `Dashboard.svelte:194`; incorrectly listed here previously
- ~~`app.css`: dead classes `.match-card`, `.match-score`, `.chart-container` not used by any component. Dead `@keyframes scroll` animation overridden by LiveTicker local keyframes (P5s)~~ **FIXED:** all dead classes and the dead `@keyframes scroll` animation removed from `app.css` (P5s)
- ~~`footballData.ts`: no AbortController or timeout on fetch~~ **FIXED:** AbortController with 15s timeout added to `rateLimitedFetch()` (P5t)
- ~~`dataService.ts`: inconsistent error contract — `getTeamStats()` returns null, `getTeamForm()` returns [], but `getMatches()` throws~~ **FIXED:** error contract documented with JSDoc: essential data methods throw, supplementary methods return empty/null (P5t)
- ~~`Predictions.svelte`: `catch (error)` variable shadows outer `let error`~~ **FIXED:** renamed to `catch (err)` (P5t)
- `SEED_RATINGS` in `advancedPredictions.ts` includes relegated teams (Leeds, Luton, Burnley, Sheffield United) — dormant but stale
- ~~`betBuilder.ts:441`: `'Over 7.5 corners'` selection string hardcoded~~ **FIXED:** changed to 'Over 8.5 corners' to match the `totalOver85` probability used in confidence calculation
- Backend `/standings` endpoint: `pd.DataFrame` serialisation was fixed with `.to_dict(orient='records')` — updating prior CLAUDE.md note
- ~~`advancedPredictions.ts`: `processCompletedMatches` filters `m.status === 'FINISHED'` but `status` is optional on Match type — matches with valid results but undefined status are silently skipped~~ **FIXED:** now also accepts matches with `!m.status` (undefined)
- ~~Backend unused imports: `main.py:24` imports `timedelta` (unused), `modern_oracle.py:18` imports `asyncio` (unused)~~ **FIXED:** `timedelta` import removed from `main.py` (P5s), `asyncio` import removed from `modern_oracle.py` (P5s). `main.py` still imports `asyncio` but it IS used (WebSocket handler line 566)
- `predictionTracker.ts` now exports `getCalibrationFactors()` — computes per-band accuracy factors from settled predictions. `optimizedPredictions.ts` applies these as a final multiplier in `predictMatch()` (Spec 01 Req 5)
- `SidebarNav.svelte` — extracted nav content component used by both desktop `<aside>` and mobile `<Sheet>` rendering paths to avoid 66 lines of template duplication
- ~~`SeasonStats.svelte:96`: `currentStreak` variable is dead code — declared and initialised to `0` but never written to or read; the streak calculation uses a separate local `streak` variable at line 118~~ **FIXED:** dead variable removed (P5s)
- ~~`LiveMatches.svelte:85-90`: `getMinute()` only computed elapsed time for `IN_PLAY`/`PAUSED` — matches in `EXTRA_TIME` or `PENALTY_SHOOTOUT` showed empty minute string~~ **FIXED:** `getMinute()` now handles all live statuses — `EXTRA_TIME` shows elapsed minutes (or "ET"), `PENALTY_SHOOTOUT` shows "PEN" (P5u)
- ~~`liveService.ts:244-249`: WebSocket `onmessage` handler parses incoming JSON then discards it entirely~~ **FIXED:** All WebSocket infrastructure removed from liveService (P5v) — service is now polling-only with adaptive intervals
- `value.ts`: `MarketOdds.bttsNo` — investigated and confirmed NOT dead. Actively used by ValueBets.svelte UI as a validation gate for BTTS market scanning
- ~~`ApiSetupWizard.svelte`: `selectedProvider` is a dead variable — typed as single-value union `'football-data'`, functionally trivial~~ **FIXED:** removed (P5s)
- ~~Spec 02 status section says "Backend ML proxy: NOT DONE" but `/api/oracle` proxy IS configured at `vite.config.ts:120` since P2b~~ **FIXED:** spec status corrected to DONE
- **Sixteenth audit (29 March 2026) — 23 new items discovered:**
- ~~`App.svelte:79`: `hasApiKey = true` set unconditionally on wizard dismiss — even when no key entered~~ **FIXED:** `handleApiSetupComplete` now early-returns when `apiKey` is empty (P1g)
- ~~`app.css:376-387`: Dead `.live-ticker` and `.ticker-content` global rules~~ **FIXED:** removed dead ticker CSS rules from app.css (P5w)
- ~~`Dashboard.svelte:408`: `hover:shadow-glow-primary-sm` undefined~~ **SEVENTEENTH AUDIT CORRECTION:** `glow-primary-sm` IS defined in `tailwind.config.js:69` under `boxShadow` — this class works correctly. False positive removed from P5x
- ~~`Dashboard.svelte:87`: `dark:text-primary-light` undefined — icon renders wrong colour in dark mode~~ **FIXED:** changed to `text-primary` (theme-aware, no dark override needed) (P5x — ALL P5x items now resolved)
- ~~`MatchList.svelte:125`, `BettingHistory.svelte:205`: `animate-fade-in` only defined locally in `Predictions.svelte`~~ **SEVENTEENTH AUDIT CORRECTION:** `animate-fade-in` IS defined globally in `tailwind.config.js:78` (maps to `fadeIn` keyframe, opacity 0→1). Both components' animations work. Predictions.svelte has a local version that additionally translates Y — cosmetic difference, not a bug. False positive removed from P5x
- ~~`SeasonStats.svelte:374`: Division by `totalGoals` produces `NaN%` when no goals scored~~ **FIXED:** guarded with `totalGoals > 0`, displays "N/A" fallback (P5y)
- ~~`renderMarkdown.ts`: Numbered lists wrap `<li class="list-decimal">` in `<ul>` instead of `<ol>`~~ **FIXED:** bullet items now wrapped in `<ul>`, numbered items in `<ol>` (P5z)
- ~~`optimizedPredictions.ts`: Home advantage double-counted — ELO adds 65 points AND form adds `*1.1`/`*0.9` momentum~~ **FIXED:** removed `*1.1`/`*0.9` momentum adjustments from `analyzeRecentForm()` — ELO `HOME_ADVANTAGE` is the single source of truth (P5aa)
- `backtest.ts`: ELO `saveToStorage()` fires on every match during backtest — ~300+ unnecessary localStorage writes (P5ab)
- ~~`betBuilder.ts:calculateHalfTimeResult`: HT priors sum to 0.95 not 1.0 — systematic bias before normalisation~~ **FIXED:** corrected to 0.26 + 0.46 + 0.28 = 1.0 (P5ac)
- `advancedPredictions.ts`: `FatigueAnalyzer.recentFixtures` always passed as `1` — congestion formula branch is dead code (P5ad)
- ~~`main.py`: Model/CSV paths resolve relative to CWD, not `__file__`~~ **FIXED:** `BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent` anchors all paths to `backend/` regardless of CWD (P5af)
- ~~`requirements.txt`: `httpx` missing — needed for backend tests but only installed ad-hoc in CI~~ **FIXED:** added httpx==0.27.2 to requirements.txt (P2t)
- ~~`.gitignore`: `backend/models/*.joblib` not ignored; `frontend/.env.local` not covered~~ **FIXED:** added *.joblib and frontend/.env.local/.env.production.local patterns (P2u)
- ~~`environment.yml`: Stale — still includes dead security deps removed from `requirements.txt` in P2r~~ **FIXED:** removed dead security deps, moved Pro-tier deps to commented section (P2v)
- Test quality: `backtest.test.ts` encodes Kelly 1.05 bug as correct value; `liveService.test.ts` passes because WS handler is broken; `value.test.ts` 3 weak assertions; backend missing happy-path test for `/predict/free` (P5ae)
- ~~CI gaps: No coverage enforcement, no linting step, no E2E tests in pipeline~~ **PARTIAL FIX:** CI now runs `test:coverage` with enforced thresholds (60/65/65/60); `httpx` ad-hoc install removed from backend CI (now in requirements.txt). Linting and E2E still not in pipeline (P2n)
- ~~Multiple spinner implementations (3 different patterns, none using `spinner-branded` from `app.css`); raw `<button>` mixed with shadcn `<Button>` across components (P5ag)~~ **FIXED:** Dead `spinner-branded` CSS removed, full-page spinners standardised to `h-12 w-12`, Retry/Refresh/Export buttons migrated to shadcn `<Button>` in 5 components
- **Seventeenth audit (29 March 2026) — P5x corrections + 7 new items:**
- **P5x CORRECTED:** `hover:shadow-glow-primary-sm` IS defined in `tailwind.config.js:69` (false positive). `animate-fade-in` IS defined globally in `tailwind.config.js:78` (false positive). Only `dark:text-primary-light` remains as a real P5x bug
- ~~`App.svelte:113`: `animate-fadeIn` (camelCase) silently ignored — Tailwind generates `animate-fade-in` (kebab-case)~~ **FIXED:** changed to `animate-fade-in` (P5ah)
- ~~`Help.svelte`: Uses `prose prose-slate dark:prose-invert` classes (6 instances) and local `@apply .prose h2/h3/h4` rules, but `@tailwindcss/typography` is NOT installed. All typography styling silently non-functional~~ **FIXED:** installed `@tailwindcss/typography` and added to `tailwind.config.js` plugins (P5ai)
- ~~`Header.svelte`: Sidebar toggle button missing `aria-expanded` — screen readers can't determine sidebar state~~ **FIXED:** added `aria-expanded={isSidebarOpen}` with prop from App.svelte (P5aj)
- ~~Dead service methods never called: `backendService.predictBatch()`, `backendService.getTeamStats()`, `backendService.headers(includeAuth)` branch, `KellyCalculator.simulate()`, `aiAnalysis.invalidateServerKeyCache()`~~ **FIXED:** all five removed, `headers()` simplified to no-arg, dead `getToken()` helper also removed. 11 corresponding tests deleted (P5ak)
- ~~`betBuilder.ts`: `correlationAdjustment()` only applied to 2 of 4 combo types~~ **FIXED:** all four combo types ("Safe Builder", "Value Builder", "High Risk Builder", "Goals Galore") now apply `correlationAdjustment()` for consistent confidence calculations (P5al)
- ~~`backend/Dockerfile`: No non-root user created — app runs as root inside container~~ **FIXED:** added `appuser` non-root user, removed stale `COPY config.yml`, removed misleading MLflow port (P5am)
- ~~`backend/test_setup.py`: `test_imports()` makes zero assertions — always "passes" in pytest regardless of import status. False confidence in CI~~ **FIXED:** renamed to `backend/check_imports.py` so pytest no longer collects it as a passing test (P5an)

### The #1 Rule of E2E Tests A test MUST fail when the feature it tests is broken. No exceptions. If a real user would see something broken, the test must fail. No "fixing the app inside the test". A passing test that hides a broken feature is worse than no test at all.