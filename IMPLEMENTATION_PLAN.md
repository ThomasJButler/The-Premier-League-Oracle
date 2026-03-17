# Premier League Oracle — Implementation Plan

Last updated: 17 March 2026
Active branch: `v3.0-BackendMLTraining`
Completed work archive: `COMPLETED_WORK.md`

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

## P0 — Blockers (must fix before anything else)

### P0a. Fix Backend Startup

The server **will not start** due to broken imports across multiple files.

- [ ] `modern_oracle.py`: unguarded imports — `optuna`, `sklearn`, `joblib`, `redis` (lines 77-81) crash on import even when unused
- [ ] `modern_oracle.py`: `from langchain.embeddings import OpenAIEmbeddings` → `langchain_community.embeddings`
- [ ] `modern_oracle.py`: deprecated ChromaDB `duckdb+parquet` API → modern `chromadb.PersistentClient()`
- [ ] `xgboost_model.py`: unguarded `import shap` breaks entire import chain
- [ ] `main.py`: lifespan calls `oracle.xgboost_model.load_model()` without null-checking oracle — crashes if Oracle init fails
- [ ] `main.py`: wrap `ModernPremierLeagueOracle` import with `try/except` so `/health` works without ML deps
- [ ] Make all heavy deps (LangChain, ChromaDB, SHAP, Optuna, Redis) optional — log warning if unavailable, don't crash

**Verify:** `cd backend && uvicorn app.api.main:app --reload --port 8000` then `curl http://localhost:8000/health` returns 200.

### P0b. Backend requirements.txt Audit -- DONE (14 March 2026)

### P0c. Delete Stale Documentation

Files that were deleted on `v2.0-Development` but still exist on this branch:

- [ ] Delete `SUPABASE_SETUP_GUIDE.md` (root) — Supabase fully removed; spec 02 says delete this
- [ ] Delete `backend/TRAINING_GUIDE.md` — 1227-line generic ML tutorial, not project-specific
- [ ] Delete `backend/JUPYTER_GUIDE.md` — 993-line generic Jupyter tutorial, not project-specific
- [ ] Delete `backend/QUICKSTART.md` — references deleted infrastructure
- [ ] Delete `backend/ANACONDA_SETUP.md` — references deleted infrastructure

---

## P1 — High Priority (current sprint)

### P1a. Frontend Bug Fixes (discovered during audit)

Critical bugs that affect correctness or user experience:

- [ ] `betBuilder.ts`: `checkRivalry()` uses short names ("Manchester United") that never match API canonical names ("Manchester United FC") — rivalry card bonus is permanently dead code
- [ ] `betBuilder.ts`: `calculateHalfTimeResult()` probabilities don't sum to 1.0
- [ ] `optimizedPredictions.ts`: fatigue factor is NOT applied to Poisson lambda calculation (spec 01 requires this)
- [ ] `predictions.ts` vs `optimizedPredictions.ts`: confidence bounds differ ([0.15, 0.85] vs [0.25, 0.95]) — should be unified
- [ ] `Predictions.svelte`: synthesised bookmaker odds `(1 / topProb) * 1.05` shown as if real — needs clear "estimated" label
- [ ] `Predictions.svelte`: `accuracy` variable loaded from tracker but never used in template (dead code)
- [ ] `Predictions.svelte`: 38 gameweeks hardcoded — PL has 38 but future-proof with API data
- [ ] `Header.svelte`: theme state local to component, `toggleDarkMode` event dispatched but never consumed by App.svelte
- [ ] `App.svelte`: dark mode defaults to dark, no `prefers-color-scheme` fallback, no localStorage restore
- [ ] `MobileNav.svelte`: "Season Stats" phantom route; `<nav>` not hidden on `lg:` breakpoint (overlaps desktop sidebar)
- [ ] `Sidebar.svelte`: `LogOut` icon imported but never used (dead import)
- [ ] `SeasonStats.svelte`: `totalPenalties = 0` hardcoded; unbeaten run calculation bug
- [ ] `StandingsTable.svelte`: position movement arrows derived from form wins (fake proxy, not real position delta)
- [ ] `Dashboard.svelte`: Chart.js instance not destroyed `onDestroy` (memory leak on navigation)
- [ ] `Dashboard.svelte`: accuracy trend chart mislabels "confidence" as "accuracy"
- [ ] `dataService.ts`: `getMatchesBySeason(seasonId)` ignores its `seasonId` argument
- [ ] `dataService.ts`: `getTeamStats()` returns 14 zeroed fields
- [ ] `predictionTracker.ts`: `cleanOldPredictions()` defined but never auto-called (unbounded growth)
- [ ] `kelly.ts`: "half-Kelly" naming misleading — applies `confidence * 0.5`, not standard half-Kelly formula
- [ ] `value.ts`: CLV sign convention inverted; `MAX_ODDS_MOVEMENT` dead code; silent error swallow in `identifyValueBets`

### P1b. Dark Mode Persistence

`Header.svelte` saves theme to localStorage but `App.svelte` doesn't restore it on load.

- [ ] In `App.svelte` `onMount`, restore theme from `localStorage.getItem('theme')`
- [ ] Fall back to `prefers-color-scheme` media query if no stored preference
- [ ] Create a shared theme store so Header and App share state (currently local to Header)

### P1c. E2E Test Maintenance

27 Playwright E2E tests exist across 5 spec files. 2 tests are skipped (prediction generation flow).

- [ ] Fix the 2 skipped prediction generation tests
- [ ] Add E2E coverage for Oracle Chat (ChatBot.svelte)
- [ ] Add E2E coverage for Kelly Calculator
- [ ] Verify mobile viewport tests at 375px, 390px, 768px

### P1d. Mobile UX Overhaul

- [ ] Fix mobile sidebar — use CSS `translate` properly or migrate to shadcn `Sheet`
- [ ] `MobileNav.svelte`: add missing views (currently only 5 of 10+ exposed), fix active state
- [ ] Fix card overflow/scroll on small viewports
- [ ] Ensure prediction probability bars are readable on mobile

---

## P2 — Next Sprint

### P2a. shadcn-svelte Completion

5 components installed (Button, Card, Badge, Separator, Skeleton) but only Separator used in Sidebar. No `components.json` config file.

- [ ] Create `components.json` (shadcn-svelte init file)
- [ ] Wire existing Button, Card, Badge, Skeleton components into UI (currently unused)
- [ ] Add missing components per spec 07: Dialog, Tabs, Sheet, Select, Table, Progress, Tooltip
- [ ] Add CSS variable mapping to `app.css` (`:root` and `.dark` blocks per spec 07)

### P2b. Backend Service (frontend bridge)

No frontend code calls the Python backend. **0 of 8 acceptance criteria from spec 03 met.**

**New file:** `frontend/src/services/backendService.ts`

- [ ] `isAvailable()` — pings `/health`, returns bool
- [ ] `predictMatch(homeTeam, awayTeam)` — calls `/predict`
- [ ] `predictBatch(matches)` — calls `/predict/batch`
- [ ] All methods throw `BackendUnavailableError` if backend down
- [ ] Add Vite proxy: `/api/oracle` → `http://localhost:8000` in `vite.config.ts`
- [ ] Add `MLPrediction` interface to `types/index.ts`

### P2c. Backend Feature Flag in Settings

- [ ] `useBackend` toggle (persisted as `use_backend` in localStorage)
- [ ] Backend connection status indicator (green/red dot) — real ping, not fake "Connected"
- [ ] `oracle_api_token` input field
- [ ] Fix fake cache size calculation (`localStorage.length * 0.005 MB` → real estimate)

### P2d. Missing Component Tests

244 Vitest tests exist (documented as 275 — count has drifted). No tests for:

- [ ] `Predictions.svelte` — generate, gameweek nav, Kelly stake display
- [ ] `LiveMatches.svelte` — polling state, no live matches, score display
- [ ] `KellyCalculator.svelte` — input validation, stake output
- [ ] `ChatBot.svelte` — API key setup, message send/receive, context building
- [ ] `Settings.svelte` — toggle persistence, cache clear
- [ ] IndexedDB cache layer — completely untested

### P2e. Type System Gaps

`types/index.ts` missing several interfaces used across the codebase:

- [ ] `EloRatings` (used in advancedPredictions.ts)
- [ ] `Bet` / `BetRecord` (used in betHistoryService.ts)
- [ ] `KellyResult` (used in kelly.ts)
- [ ] `ValueBet` (used in value.ts)
- [ ] `MLPrediction` (needed for backend integration)
- [ ] `TopScorer` (used in TopScorers.svelte)
- [ ] `LiveMatch` (used in LiveMatches.svelte)
- [ ] `ChatMessage` (used in ChatBot.svelte)
- [ ] `CacheEntry` (used in dataService.ts)

### P2f. Backtest Runner

**New file:** `frontend/src/lib/backtest.ts`

- [ ] `BacktestRunner` class — takes completed match array, runs ensemble on each
- [ ] Reports: overall accuracy %, H/D/A accuracy, log loss, Brier score
- [ ] Accessible from Predictions view (button in accuracy panel)

### P2g. Kelly Auto-Suggestions

- [ ] Load upcoming predictions from `OptimizedPredictor`
- [ ] For confidence >= 65% + positive EV: generate Kelly suggestions
- [ ] Display as "Suggested Bets" list above manual calculator
- [ ] Add confidence threshold slider (currently hardcoded at 0.7)

### P2h. Oracle Chat Improvements

`ChatBot.svelte` has several issues found in audit:

- [ ] Direct browser-to-OpenAI API call exposes key in network tab — needs backend proxy or at minimum clear warning
- [ ] No markdown rendering in chat responses
- [ ] Sequential context API calls add latency — should batch or cache
- [ ] Move OpenAI API key config to Settings.svelte (currently only in ChatBot)
- [ ] Persist chat sessions to localStorage with configurable history length
- [ ] Add backend prediction results to system prompt when backend available

---

## P3 — Backend ML (write `specs/08-backend-training.md` first)

### P3a. Real Feature Engineering

`advanced_engineering.py` — no longer has `np.random.*` calls (was 102), but **49 methods now return hardcoded `0.0`** for: tactics, player-level, betting market, weather, and advanced metric features. ~75 features compute real data from scorelines/results.

Priority features to implement with real data:
- [ ] Rolling goals scored/conceded (last 5, 10 matches) — data available from free tier
- [ ] Form streaks (W/D/L sequences) — data available
- [ ] Rest days since last match — data available
- [ ] H2H win rates — fix `get_head_to_head()` returning empty DataFrame
- [ ] xG proxies from shots data — limited by free tier
- [ ] Remove or honestly document the ~49 `return 0.0` stub methods (tactics, weather, player-level require paid data sources)

**Constraint:** Football-Data.org free tier does not provide xG, shots, possession, cards, corners data — ~70 features will remain stubs unless a paid data source is added.

### P3b. Data Collector Fixes

- [ ] `football_data_collector.py`: `get_head_to_head()` returns empty DataFrame (stub)
- [ ] `football_data_collector.py`: `get_team_form()` result-flip bug — home team results not flipped to W/L format
- [ ] Add retry logic to API client (currently no retries on failure)

### P3c. Model Training Pipeline

**New file:** `backend/train.py`

- [ ] Orchestrates: data collection -> feature engineering -> model training -> evaluation
- [ ] Train/validation/test splits: 2020-2023 train, 2024 validation, 2025 test
- [ ] Wire `/admin/retrain` endpoint (currently returns mock response)
- [ ] Fix `lstm_predictor.py`: `get_feature_importance()` returns `{name: np.random.random()}`
- [ ] Fix `modern_oracle.py`: `optimize_ensemble_weights()` returns `np.random.random()`
- [ ] Fix `modern_oracle.py`: `_calculate_betting_value()` uses mock odds `{home: 2.5, draw: 3.2, away: 2.8}`
- [ ] Fix `transformer_model.py`: model save/load only saves 2 of 8 constructor params
- [ ] Fix `transformer_model.py`: `val_accuracy` UnboundLocalError when no validation set
- [ ] Fix `transformer_model.py`: `num_decoder_layers` param silently ignored
- [ ] Add pytest tests (currently 0% backend test coverage)

### P3d. Security Layer Fixes

- [ ] `auth.py`: `SECRET_KEY` regenerated every restart (should be env var)
- [ ] `auth.py`: mock user database lookup (line 434)
- [ ] `auth.py`: brute force protection broken (per-request dict, not persistent)
- [ ] `auth.py`: Redis connection never established
- [ ] `secrets.py`: Azure Key Vault imported but no provider class
- [ ] `secrets.py`: audit log in-memory only
- [ ] `validators.py`: `VALID_TEAMS` has 2023/24 clubs (Burnley/Luton/Sheffield — missing Leicester/Ipswich/Southampton)
- [ ] `validators.py`: `ValidationError` raised incorrectly (will TypeError at runtime)
- [ ] `validators.py`: SQL blacklist blocks natural language queries containing "from" or "where"
- [ ] `main.py`: CORS wildcard `*` in production — should restrict to frontend origin

### P3e. OptimizedPredictor x ML Integration

- [ ] When `useBackend` enabled and backend available, merge ML prediction with TypeScript ensemble
- [ ] Silent fallback to TypeScript ensemble when backend unavailable

### P3f. LiveService with WebSocket

**New file:** `frontend/src/services/liveService.ts`

- [ ] Svelte store `liveMatchesStore`
- [ ] WebSocket to `ws://localhost:8000/ws` when backend available
- [ ] Falls back to polling when backend unavailable
- [ ] `LiveMatches.svelte` and `LiveTicker.svelte` subscribe to store

### P3g. AI Match Analysis

**New file:** `frontend/src/services/aiAnalysis.ts`

- [ ] `AIAnalysisService` — takes `MatchPrediction`, returns natural language analysis
- [ ] User configures OpenAI/Anthropic key in Settings
- [ ] Supplementary only — does NOT modify numerical probabilities
- [ ] 24h cache per match
- [ ] Feed analysis context into ChatBot system prompt for richer responses

---

## P4 — Polish & Cosmetic (when P1-P3 stable)

### P4a. UI Dead Code Cleanup

- [ ] Remove `Math.random()` star particles in `App.svelte:96-100`
- [ ] Fix hardcoded "Tom Butler" / "tom@example.com" in `Header.svelte:140-141`
- [ ] Fix hardcoded "3 new predictions available" in `Header.svelte:102`
- [ ] Wire or remove Header.svelte search bar (dispatches event but nothing handles it)
- [ ] Wire or remove Header.svelte profile/logout actions
- [ ] Fix `ApiSetupWizard.svelte` Step 3 single-option auto-advance
- [ ] Update `Help.svelte` accuracy claim "60-65%" to use real `predictionTracker` stat
- [ ] Update `Help.svelte` to remove push notifications / offline caching claims (they don't exist)

### P4b. Accessibility (spec 07: 0 of 5 ARIA requirements met)

- [ ] `role="meter"`, `aria-valuenow/min/max` on prediction probability bars
- [ ] Proper `<label>` elements on Kelly calculator inputs
- [ ] `aria-current="page"` on active nav items
- [ ] `aria-label` on theme toggle and confidence indicators
- [ ] Add `prefers-reduced-motion` media query to `app.css`

### P4c. Component Data Accuracy Cleanup

- [ ] `LiveMatches.svelte`: "Auto-refreshing every 30 seconds" label hardcoded — make dynamic (wrong when backed off to 5min/30min)
- [ ] `LiveTicker.svelte`: live dot detection uses `startsWith('football emoji')` heuristic — use boolean flag
- [ ] `SeasonStats.svelte`: "Late Drama" metric is HT/FT proxy — rename or document
- [ ] `StandingsTable.svelte`: position movement arrows inferred from form, not real API data
- [ ] `Settings.svelte`: "Connected" status shown without actually pinging API — wire real check

### P4d. betBuilder Improvements

- [ ] Fix `checkRivalry()` to match API canonical team names (e.g. "Manchester United FC")
- [ ] Expand rivalry list beyond 6 hardcoded entries
- [ ] Replace hardcoded combo confidence values (0.65, 0.45, 0.25, 0.40) with calculated
- [ ] Replace `avgCorners: 9.5` and `expectedCards: 3.2` with league averages from match data
- [ ] Market correlation in combo probability (e.g. clean sheet + over 2.5 negatively correlated)

### P4e. CSS & Theme Polish

- [ ] Some raw hex values in `app.css` not using CSS design tokens
- [ ] Team theme CSS variables exist (20 PL clubs) but integration unclear

---

## Specs

All feature specifications in `specs/`:

| File | Topic | Implementation Status |
|------|-------|-----------------------|
| `specs/01-prediction-engine.md` | ELO, Poisson, fatigue, referee, confidence, backtesting | ~70% — fatigue not in Poisson lambda, no backtest runner, no AI analysis |
| `specs/02-data-pipeline.md` | Football-Data.org integration, caching, historical data | ~80% — cache TTLs inconsistent, no batch pre-loader, stale docs exist |
| `specs/03-backend-integration.md` | Python ML backend connection | **0%** — 0 of 8 acceptance criteria met |
| `specs/04-betting-intelligence.md` | Kelly, value bets, bet history, accumulators | ~60% — no Kelly auto-suggestions, betBuilder bugs, combo thresholds wrong |
| `specs/05-live-data.md` | Live scores, smart polling, WebSocket | ~50% — polling works, no WebSocket, no liveService.ts |
| `specs/06-prediction-tracking.md` | Accuracy tracking, auto-reconciliation | ~90% — substantially complete |
| `specs/07-ui-ux.md` | shadcn-svelte migration, dark mode, accessibility | ~10% — 5 components installed (1 wired), 0/5 ARIA, dark mode broken |

Write `specs/08-backend-training.md` before starting P3.

---

## Active Stubs (known hardcoded values remaining)

### Frontend

| Location | Problem | Priority |
|----------|---------|----------|
| `advancedPredictions.ts` | `avgPenalties: 0.2` — no penalty data from free API tier | Low |
| `optimizedPredictions.ts` | `cleanSheetRate: 0.3` — derivable from match results but not computed | P1a |
| `betBuilder.ts` | `avgCorners: 9.5` — no corner data from free tier | P4d |
| `betBuilder.ts` | `expectedCards: 3.2` — no card data from free tier | P4d |
| `betBuilder.ts` | 6 hardcoded rivalries, short names that never match API names | P4d |
| `betBuilder.ts` | Combo confidence values (0.65, 0.45, 0.25, 0.40) hardcoded | P4d |
| `betBuilder.ts` | `calculateHalfTimeResult()` probabilities don't sum to 1.0 | P1a |
| `Predictions.svelte` | Synthesised odds `(1 / topProb) * 1.05` shown as real | P1a |
| `Header.svelte:140-141` | Hardcoded "Tom Butler" / "tom@example.com" | P4a |
| `Header.svelte:102` | Hardcoded "3 new predictions available" | P4a |
| `App.svelte:96-100` | `Math.random()` star particles | P4a |
| `Settings.svelte` | Fake cache size: `localStorage.length * 0.005 MB` | P2c |
| `Settings.svelte` | "Connected" status without real API ping | P4c |
| `SeasonStats.svelte` | `totalPenalties = 0` hardcoded | P1a |
| `StandingsTable.svelte` | Position movement from form wins (fake proxy) | P4c |
| `LiveMatches.svelte` | "Auto-refreshing every 30 seconds" hardcoded label | P4c |
| `ChatBot.svelte` | OpenAI API key exposed in browser network tab | P2h |

### Backend

| Location | Problem | Priority |
|----------|---------|----------|
| `advanced_engineering.py` | 49 methods return `0.0` (tactics, players, betting, weather, advanced) | P3a |
| `football_data_collector.py` | `get_head_to_head()` returns empty DataFrame | P3b |
| `football_data_collector.py` | `get_team_form()` result-flip bug | P3b |
| `lstm_predictor.py` | `get_feature_importance()` returns `np.random.random()` | P3c |
| `modern_oracle.py` | `optimize_ensemble_weights()` returns `np.random.random()` | P3c |
| `modern_oracle.py` | `_calculate_betting_value()` uses mock odds | P3c |
| `transformer_model.py` | Save/load only saves 2 of 8 constructor params | P3c |
| `transformer_model.py` | `val_accuracy` UnboundLocalError | P3c |
| `auth.py` | `SECRET_KEY` regenerated every restart | P3d |
| `auth.py` | Mock user database lookup | P3d |
| `auth.py` | Brute force protection broken (per-request dict) | P3d |
| `validators.py` | `VALID_TEAMS` outdated (2023/24 season clubs) | P3d |
| `validators.py` | `ValidationError` TypeError at runtime | P3d |
| `validators.py` | SQL blacklist blocks "from"/"where" in NL queries | P3d |
| `main.py` | CORS wildcard `*` | P3d |
| `main.py` | `/admin/retrain` returns mock response | P3c |

---

## Test Coverage Summary

### Frontend (Vitest)

| File | Tests | Status |
|------|-------|--------|
| `predictions.test.ts` | 11 | Passing |
| `types.test.ts` | 18 | Passing |
| `advancedPredictions.test.ts` | 28 | Passing |
| `Dashboard.test.ts` | 12 | Passing |
| `kelly.test.ts` | 20 | Passing |
| `footballData.test.ts` | 26 | Passing |
| `dataService.test.ts` | 10 | Passing |
| `predictionTracker.test.ts` | 18 | Passing |
| `optimizedPredictions.test.ts` | 12 | Passing |
| `betHistoryService.test.ts` | 27 | Passing |
| `BettingHistory.test.ts` | ~13 | Passing |
| `betBuilder.test.ts` | 40 | Passing |
| `value.test.ts` | 38 | Passing |
| **Total** | **~244** | **All passing** |

**Known test issues:**
- `predictions.test.ts`: form trend test re-implements logic inline instead of testing actual function
- `footballData.test.ts`: normalisation test re-implements logic instead of testing actual function
- IndexedDB cache layer completely untested
- No component tests except Dashboard and BettingHistory

### Frontend (Playwright E2E)

| File | Tests | Status |
|------|-------|--------|
| `navigation.spec.ts` | varies | Passing |
| `dashboard.spec.ts` | varies | Passing |
| `predictions.spec.ts` | varies | 2 skipped |
| `betting.spec.ts` | varies | Passing |
| `mobile.spec.ts` | varies | Passing |
| **Total** | **27** | **25 passing, 2 skipped** |

### Backend (pytest)

**0% coverage. No tests exist.**

---

## Services Still To Create

| File | Purpose | Priority |
|------|---------|----------|
| `frontend/src/services/backendService.ts` | Frontend-backend bridge | P2b |
| `frontend/src/services/liveService.ts` | WebSocket live data | P3f |
| `frontend/src/services/aiAnalysis.ts` | AI match analysis | P3g |
| `frontend/src/lib/backtest.ts` | Backtest runner | P2f |
| `backend/train.py` | ML training pipeline | P3c |
| `specs/08-backend-training.md` | Backend training spec | P3 (prerequisite) |
