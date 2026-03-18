# Changelog

All notable changes to The Premier League Oracle are documented here.

## [Unreleased] - v3.0-Frontend Branch

### P1h Prediction Model Bugs — Partial Fix (18 March 2026)
- **H2H probability shrinkage fixed:** `optimizedPredictions.ts` shrinkage formula `ratio * 0.8 + 0.1` didn't sum to 1.0 (got 1.03). Changed to `ratio * 0.7 + 0.1` which sums exactly to 1.0 — fixes inflated H2H probabilities
- **ELO ratingDiff threshold fixed:** `advancedPredictions.ts` checked `ratingDiff > 200` but ratingDiff is already divided by 100 at line 475, so the condition was unreachable. Changed to `> 2` (equivalent to 200 raw rating points)
- **Error fallback logging added:** `optimizedPredictions.ts` `predictMatch()` catch block now logs `console.warn` with the error before returning fallback probabilities — previously swallowed errors silently
- **importBets validation hardened:** `betHistoryService.ts` now validates market against an explicit allowlist, requires `odds > 1` and `stake > 0`, checks resolved bets have a profit value, and requires core identity fields (id, matchId, homeTeam, awayTeam)

### P1l Live Probability Bugs — All Fixed (18 March 2026)
- **betBuilder probability overflow:** Corner and card probability outputs clamped to [0, 0.99] in `calculateCorners()` and `calculateCards()` — previously could exceed 1.0 for high expected values, producing nonsensical combo confidence scores
- **KellyCalculator circular Kelly fixed:** Was using `1.05 / odds` as `ourProbability`, creating a fake 5% edge against the model's own odds. Now correctly uses `prediction.confidence` as `ourProbability` and `valueOdds` as `bookmakerOdds` — edge only appears when model confidence genuinely exceeds the odds-implied probability
- **footballData halfTimeResult 0-0 bug:** Replaced `!score` falsy check with explicit `=== null || === undefined` — JavaScript's `!0 === true` was incorrectly treating 0-0 half-time scores as null, affecting SeasonStats late-drama calculations
- **Dashboard auto-retry bounded:** Replaced unbounded 5-second polling with exponential backoff (5s, 10s, 20s) capped at 3 retries — prevents indefinite API spam when key is missing/invalid
- **Settings API key trimmed:** `saveFootballDataKey()` now trims whitespace before passing to `setApiKey()`. Also removed redundant duplicate `localStorage.setItem` call (already handled by `setApiKey` internally)
- Updated Settings test to remove redundant `localStorage.setItem` assertion (no longer needed since `setApiKey` handles storage)

### P1i Bet Storage Pipeline Wired (18 March 2026)
- **KellyCalculator.svelte:** "Track Bet" button on each auto-suggestion — stores match result bet with halfKelly fraction, model confidence, and calculated stake. Shows "Tracked" confirmation state
- **ValueBets.svelte:** "Track Bet" button on each value bet scan result — maps ValueBet market format (`'home'`, `'over2.5'`, `'btts'`) to StoredBet format (`'match_result'`, `'over_2_5'`, `'btts'`). Shows "Tracked" confirmation state
- **Pipeline complete:** KellyCalculator/ValueBets → `betHistoryService.storeBet()` → localStorage → `BettingHistory.svelte` (reads via `getAllBets()`)
- Updated KellyCalculator tests with betHistoryService mock and new icon stubs

### Fifth Planning Audit — ~11 New Findings (18 March 2026)
- **8 parallel research agents** (Sonnet) audited all 8 specs, all Svelte components, all frontend libs/services, all backend Python files, all test files, and all project configuration/infrastructure — comprehensive cross-referencing against existing plan
- **shadcn-svelte `$lib/utils.ts` missing (P2a-fix):** `components.json` references `$lib/utils` for `cn()` utility but the file doesn't exist — hidden blocker for UI migration. Any new shadcn component import will fail at build time
- **Font loading correction:** Previous audits incorrectly stated that Figtree and Outfit fonts were not loaded. `index.html` properly loads both via Google Fonts with lazy-load pattern. Marked as corrected in plan
- **dataService cache key bug (P1p):** `getTeamForm` cache key uses `matches.length` not content — different match arrays of the same length serve stale cached data for the same team
- **Backend dependency gaps (P2r):** `requirements.txt` missing `langchain-community` (needed by `modern_oracle.py`), `bcrypt` (needed by passlib backend), and `main.py:511-515` `/features/importance` endpoint has no None guard for `lstm_model`
- **Test quality regressions (P4h):** `backtest.test.ts:156-174` encodes the known Kelly 1.05 inflation bug as a correct expected value (0.525) — fixing P1l will incorrectly break this test. `advancedPredictions.test.ts:544-549` has conditional value bet assertion that silently passes
- **Training data access:** `backend/spreadsheets/` is gitignored — cloning the repo doesn't include CSV training data needed for `train_free_tier.py`
- **Component-level findings:** `BettingHistory.svelte` loading spinner never renders (sync localStorage), `MatchList.svelte:23-29` `loadSeasons()` has no try/catch, `Settings.svelte`/`ApiSetupWizard.svelte` have artificial 5-second delays before page reload
- **Docker dependency:** `setup.sh` creates directories (`data/`, `logs/`, `notebooks/`) that `docker-compose.yml` depends on — undocumented prerequisite

### Fourth Planning Audit — ~15 New Findings (18 March 2026)
- **8 parallel research agents** (Sonnet) audited all 8 specs, all Svelte components, all frontend libs/services, all backend Python files, all test files, and all project configuration/infrastructure — comprehensive cross-referencing against existing plan
- **Backend API serialisation bug (P1o):** `/standings` endpoint returns `pd.DataFrame` which is not JSON-serialisable — will `TypeError` at runtime. `get_standings()` in `football_data_collector.py` returns a DataFrame that must be converted before being sent as a JSON response
- **API error misidentification (P1n):** `footballData.ts:189` treats HTTP 403 as "invalid API key" but the free tier also returns 403 for rate-limit exceeded — misleading error message when users hit rate limits
- **Backtest performance gap (P2v):** `BacktestRunner.run()` makes ~1,140+ sequential API calls for a full PL season (each match triggers 3 service calls). Free-tier rate limit of 10 req/min means a full-season backtest would take over 100 minutes. Needs pre-fetched data approach
- **dataService wiring bug (P2w):** `refreshApiConfiguration()` doesn't update `readyPromise` — concurrent `ensureReady()` calls resolve against stale state
- **ID collision risk (P2x):** both `predictionTracker` and `betHistoryService` use `Date.now() + idCounter` for IDs where `idCounter` resets to 0 on page load — multi-tab collision theoretically possible
- **Font config gap:** `tailwind.config.js` declares `Figtree` and `Outfit` fonts but no Google Fonts import or self-hosted assets exist — silently falls back to `system-ui`
- **`passlib` Python 3.13 incompatibility:** `passlib==1.7.4` uses `crypt` module removed from Python 3.13 stdlib — will crash at import (low runtime risk since `auth.py` is unused)
- **6 new dead code items:** `Dashboard.svelte` unused `predictionAccuracy` array, `KellyCalculator.svelte` unused `showSuggestions` state, `Settings.svelte` dead `Key` import, `BettingHistory.svelte` 5 unused global CSS classes, `calculateFixtureDifficulty` creates redundant EloRatingSystem instance
- **Documentation gaps:** `package.json` version stuck at `0.0.0` (should be v3.0), no `.dockerignore` (test files and CSVs in build context), `README.md` clone URL still uses `yourusername` placeholder
- **Plan confirmed accurate:** all previously documented P0-P1 completion statuses verified correct by cross-referencing actual source code against plan claims. No false "DONE" markers found
- **IMPLEMENTATION_PLAN.md expanded:** added P1n, P1o, P2v, P2w, P2x, 2 new P4e items, 6 new P4f items, 4 new backend stubs, 2 new P4g items

### Third Planning Audit — ~80 New Findings (18 March 2026)
- **6 parallel research agents** audited all 8 specs, all Svelte components, all frontend libs/services, all backend Python files, all test files, and all project configuration/infrastructure
- **Live probability bugs (P1l):** betBuilder corner/card probabilities can exceed 1.0 (no clamp on linear formula); KellyCalculator inflates probability by 5% (`1.05/odds` instead of `1/odds`); footballData halfTimeResult bug treats 0-0 scores as null (`!0 === true`)
- **Cache TTL lies (P1m):** dataService comments claim 24h and 30m cache TTLs but actual implementation defaults to 5 minutes; season data cached in wrong IndexedDB store; dual-cache architecture between footballData and dataService with no coordination
- **Plan corrections:** `AdvancedMatchPredictor` is NOT dead code (called by `value.ts` for value bet scanning); rivalry check IS fixed via `normaliseTeamName()`; backend stub count corrected from 49 to 63
- **Parallel fatigue models (P2q):** two different fatigue implementations with different thresholds exist — `FatigueAnalyzer.getFatigueMultiplier()` vs `OptimizedPredictor.calculateFatigueFactor()` — producing inconsistent results
- **Config/infra debt (P2r):** 3 dead frontend dependencies (`tailwind-variants`, `bits-ui`, `happy-dom`); `.gitignore` missing `__pycache__/` globally, `backend/cache/`, `backend/logs/`, `backend/mlruns/`; Python version mismatch (3.13 vs 3.11); no Node version pinning; heavy dead backend dependencies (`boto3`, `hvac`, `azure-*`, `sqlalchemy`) for unused security modules
- **LSTM synthetic training (P2s):** `lstm_predictor.py:537-540` generates random noise training data as fallback — trains a meaningless model without any warning
- **Type safety gaps (P2t):** `any[]` in Dashboard, `any` params in betBuilder, dead `Prediction` type imported in Predictions.svelte, untyped `currentView` routing string
- **Market format mismatch (P2u):** `StoredBet.market` uses underscored format (`over_2_5`) while `ValueBet.market` uses dotted format (`over2.5`) — cross-module bet resolution silently fails
- **Backend bugs:** LangChain ReAct prompt missing required variables, blocking sync call on async event loop, optuna imported without guard, XGBoost feature ordering bug, derby detection always 0.0 for CSV training, league positions cumulative across all seasons
- **15+ new accessibility findings:** LiveTicker no `role`/`aria-live`/pause control (WCAG 2.2.2 failure), TopScorers div grid instead of semantic table, sort buttons no `aria-pressed`, flip cards no contextual `aria-label`, filter selects missing labels
- **12+ new component data accuracy issues:** Help.svelte additional misleading claims, ApiSetupWizard dead step and non-spinning emoji, StandingsTable arrows only on top 5, circular Kelly calculation in Predictions, `DollarSign` icon for GBP values
- **10+ new dead code findings:** `footballData.ts` methods (`getRecentResults`, `getTeamByName`, `getHeadToHead`), `MatchList.svelte` dead season selector, `optimizedPredictions.ts` dead form string and unused parameters, `value.ts` division-by-zero on empty inputs

### Second Planning Audit — 12 New Findings (19 March 2026)
- **8 parallel research agents** re-audited all 8 specs, 18 Svelte components, frontend libs/services, backend Python files, 21 test files + 6 E2E specs, and project configuration
- **Critical: bet storage pipeline broken (P1i)** — `betHistoryService.storeBet()` is never called from any component. The entire bet history feature writes nothing — `BettingHistory.svelte` always shows empty state, ROI/P&L calculations return zero
- **ChatBot XSS risk (P1j)** — `ChatBot.svelte:420` uses `{@html renderMarkdown()}` which renders unsanitised HTML from OpenAI responses without DOMPurify or equivalent sanitisation
- **Prediction storage bug (P1k)** — `Predictions.svelte:215` hardcodes `was_correct: false` when storing predictions; `totalGameweeks = 38` never updated from API data
- **No CI/CD (P2n)** — no `.github/workflows/` directory exists; all testing is manual
- **Docker cleanup needed (P2o)** — `docker-compose.yml` references `config.yml`, `nginx.conf`, `notebooks/` which don't exist
- **Supabase cleanup incomplete (P2p)** — `specs/02-data-pipeline.md` has 7 done items still marked incomplete; root `.env.example` still references Supabase
- **5 new accessibility items** — focus trapping missing on mobile nav overlays, close button missing `aria-label`, SeasonStats stat cards misleading cursor, missing `aria-live` regions on KellyCalculator and ValueBets results
- **8 new test quality issues (P4h)** — 16 tautological tests in `types.test.ts`, 6 conditional assertions in `value.test.ts` that silently pass, `footballData.test.ts` re-implements logic inline, `dataService.test.ts` error test can never fail
- **6 new dead code items** — `Help.svelte` dead `fly` import, `value.ts` 4 dead static methods, `dataService.ts` 5 additional dead public methods, `ApiSetupWizard.svelte` stale comments, `MatchList.svelte` stale season fallback
- **CLAUDE.md updated** — added bet storage pipeline gap, ChatBot XSS, no CI/CD, Docker issues, test quality notes, ELO auto-update gap
- **Spec 04 status downgraded** from ~65% to ~50% due to non-functional bet storage pipeline
- **IMPLEMENTATION_PLAN.md expanded** — added P1i, P1j, P1k, P2n, P2o, P2p, P4h, 6 new P4b items, 2 new P4c items, 6 new P4f items, 4 new Active Stubs

### Deep Planning Audit — 28 New Findings (18 March 2026)
- **8 parallel research agents** studied all 8 specs, 18 Svelte components, all frontend libs/services, all backend Python files, all 21 test files + 6 E2E specs, CSV training data, and project configuration
- **Critical production deployment gap**: no `vercel.json` exists — the Vite dev proxy (`/api/football-data`) only works locally. Production Vercel deploys cannot reach Football-Data.org API. All `/api/football-data/*` requests will 404 in production
- **3 new backend ML bugs**: LSTM/Transformer `scaler.fit_transform` during inference (re-fits with test data instead of using training scaler), XGBoost `_optimize_hyperparameters` passes `n_estimators` to `xgb.train` (silently ignored — should be `num_boost_round`), `modern_oracle.py` `train_all_models` uses random validation split (data leakage from future matches)
- **3 new frontend prediction bugs**: `optimizedPredictions.ts` H2H probability shrinkage sums to 1.1 not 1.0, `advancedPredictions.ts` ratingDiff > 200 threshold impossible to reach (already divided by 100), error fallback silently swallows all prediction errors
- **7 new infrastructure findings**: `torch` missing from `requirements.txt`, `python-jose`/`passlib` unmaintained since 2022, `environment.yml` Python 3.11 vs `requirements.txt` Python 3.13 mismatch, `__pycache__`/`mlruns` not fully excluded in `.gitignore`, root `.env.example` references Supabase, no `backend/.env.example` template, WebSocket `remove()` can raise `ValueError`
- **5 new test quality issues**: `value.test.ts` has 3 conditional assertions that silently pass, `predictions.test.ts` form trend test doesn't test the actual function, `backtest.test.ts` ELO restore entirely mocked, `betBuilder.test.ts` rivalry tests use wrong name formats, `ValueBets.test.ts` skips core scan flow
- **8 new dead code items**: `AdvancedMatchPredictor.predictMatch` never called at runtime, `calculateShotValue` never called, `calculateFixtureDifficulty` not used by production code, `formString` unused parameter, `getCurrentSeasonMatches` alias never called, `BettingHistory` double load on startup, `exportPredictions`/`importPredictions` have no UI
- **CSV training data documented**: 2,191 matches across 5.75 seasons in `backend/spreadsheets/KnowledgeFilesCSV/` with rich columns (shots, corners, cards, odds) — primary source for ML training. Training/inference feature mismatch flagged for `FreeTierFeatureEngineer`
- **CLAUDE.md corrected**: fixed stale `.gitignore` note (was marked as missing, actually fixed), added spec 08, added production deployment gap, added CSV data note, added `torch` missing note
- **IMPLEMENTATION_PLAN.md expanded**: added P2l (production deployment), P2m (derive league stats), 4 new P3c items (scaler, n_estimators, data leakage, random val split), 7 new P3d items, 8 new P4f items, 8 new backend stubs, 5 new test quality notes, CSV training data section

### P1g Logic Bug Sweep — 13 Silent Bugs Fixed (18 March 2026)
- **`betBuilder.ts`** — `||` → `??` for `predictedHomeGoals`/`awayGoals`; 0 goals no longer treated as falsy and silently replaced with 1.3/1.1
- **`betHistoryService.ts`** — three fixes: home clean sheet resolution inverted (was requiring home to score), bare 'win to nil' leg fell through unresolved, void bets included in monthly P/L
- **`TopScorers.svelte`** — `||` → `??` for assists/penalties (0 now displays); position fallback `'Forward'` → `'Unknown'`
- **`BettingHistory.svelte`** — Chart.js CSS variables corrected: `--text-muted` → `--muted-foreground`, `--text-base` → `--foreground`
- **`dataService.ts`** — `clearCache()` no longer removes the user's API key; `getPredictionAccuracy(seasonId)` now filters by season date range instead of returning global stats
- **`optimizedPredictions.ts`** — form fallback returns neutral 0.5 instead of deriving from ELO (was double-counting ELO at 45% effective weight)
- **`backtest.ts`** — matches sorted chronologically (prevents data leakage), ELO system snapshot/restored for reproducibility
- **`ValueBets.svelte`** — BTTS odds inputs added to template (variable existed but had no `<input>`)
- **Tests updated**: `backtest.test.ts` (chronological context + ELO mock), `betBuilder.test.ts` (falsy-zero), `dataService.cache.test.ts` (API key preserved), `dataService.test.ts` (predictionTracker mock)
- **378/378 tests passing, 0 type errors**

### 8-Agent Comprehensive Planning Audit (18 March 2026)
- **8 parallel subagents** studied all 8 specs, 18 Svelte components, all frontend libs/services, all backend Python files, all 21 test files + 6 E2E specs, and all project documentation
- **Test counts corrected**: 378 Vitest tests across 21 files (was documented as 275/13); 43 Playwright E2E tests across 6 files × 3 viewports = 123 executions (was 27/5, 2 skipped → now 0 skipped)
- **12 new logic bugs discovered**: `betBuilder.ts` treats 0 goals as falsy (`|| 1.3`), `betHistoryService.ts` clean sheet resolution wrong, `TopScorers.svelte` treats 0 assists as null, `BettingHistory.svelte` uses non-existent CSS variables, `dataService.ts` clearCache removes API key, `optimizedPredictions.ts` ELO double-counted in form fallback, `backtest.ts` doesn't sort chronologically or reset ELO state, and more
- **Spec status updated**: spec 01 ~45%, spec 02 ~55%, spec 03 0%, spec 04 ~65%, spec 05 ~65%, spec 06 ~95%, spec 07 ~15%, spec 08 0%
- **Documentation gaps found**: README.md has v2.0 badge and broken `docs/` links; `backend/README.md` has broken links to deleted guides; `backend/docs/FOR_BEGINNERS.md` still exists with broken tutorial links; `.gitignore` missing `backend/.env`; 4 specs have stale status notes
- **CLAUDE.md updated**: corrected test counts, component coverage (8 tested, 10 untested), shadcn `components.json` exists, 3 remaining service files (not 4), lateDrama clarification, Help.svelte remaining issues
- **IMPLEMENTATION_PLAN.md rewritten**: added P1g (12 new logic bugs), P2j (backtest reliability), P2k (ELO auto-update), P4g (documentation cleanup); updated all summary tables; trimmed completed sections; expanded stubs tables; added test quality notes
- **`.gitignore` fixed**: added `backend/.env` to prevent accidental API key commits

### Stub Fixes — betBuilder and Settings (18 March 2026)
- **`betBuilder.ts`** — `bothCleanSheets.prediction` was unconditionally `false`; now uses `> 0.08` threshold (PL 0-0 avg ~7-8%)
- **`betBuilder.ts`** — Win-to-nil probability was hardcoded `0.30`; now derived from `favProb × favCleanSheet`
- **`Settings.svelte`** — "Connected" status was assumed from saved API key; now calls `testConnection()` on mount with "Verifying…" spinner
- **`optimizedPredictions.ts`** — Error fallback weights already fixed (P1e); stubs table updated

### P2d IndexedDB Cache Tests — Complete (18 March 2026)
- **New `dataService.cache.test.ts`** — 11 tests covering the full IndexedDB cache lifecycle
- Tests: store creation, cache hit (matches + standings), TTL expiry re-fetch, clearCache, disableCache bypass, enableCache restore, setCacheTimeout, separate keys per query type, per-team keys, clearCache removes API key
- Uses `fake-indexeddb` for a real in-memory IndexedDB implementation instead of mocking
- Shared singleton approach — avoids `vi.resetModules()` timing issues with DataService constructor
- **Test count 367 → 378**: 21 test files, 378/378 passing, 0 type errors

### Stub Fix — Derive league average goals from match data (18 March 2026)
- **`advancedPredictions.ts`** — `baseHomeGoals`/`baseAwayGoals` now computed from completed match data instead of hardcoded 1.5/1.2
- **`predictions.ts`** — `leagueAvgHome`/`leagueAvgAway` similarly derived from completed matches via `dataService.getMatches()`
- Both files fall back to 1.5/1.2 when no completed matches are available (e.g., start of season)
- `optimizedPredictions.ts` already correct — its `computeLeagueAverages()` has always derived from match data
- All three prediction models now use consistent, data-driven league averages

### P2a shadcn-svelte Completion — Done (18 March 2026)
- **Created `components.json`** — enables `npx shadcn-svelte@latest add` for future component installation
- CSS variable mapping already complete: `:root` + `.dark` blocks have all shadcn tokens plus custom `success`/`warning`
- Tailwind config already maps all semantic colours via `hsl(var(--token))` pattern
- Component wiring deferred: CSS class system (`.btn`, `.card-glass`, `.skeleton`) has diverged from shadcn component styles — swapping would change visual design and break tests
- 20 team-specific colour overrides already wired via `[data-team]` attribute selectors

### P2d ChatBot Component Tests — Complete (18 March 2026)
- **New `ChatBot.test.ts`** — 18 tests covering the full Oracle Chat component
- Tests: container render, header, API key setup form, OpenAI link, disabled state without key, short key validation, save valid key, security warning banner, "Change key" visibility, clear API key, clear chat, character counter, send message + API response display, 401/429 error handling, empty message guard, localStorage persistence
- Added `export` to `saveApiKey()`, `clearApiKey()`, `sendMessage()`, `clearChat()` for testability
- Uses `fireEvent.input()` to drive `bind:value` on password and chat inputs (DOM interaction pattern)
- Verifies `localStorage.setItem`/`removeItem` calls via the global mock from `setup.ts`
- Mocks `globalThis.fetch` for OpenAI API response testing (success, 401, 429)
- **Test count 349 → 367**: 20 test files, 367/367 passing, 0 type errors

### P2f-UI Backtest Runner UI — Complete (18 March 2026)
- **Backtest button** in Predictions accuracy panel — "Run Backtest" with `FlaskConical` icon triggers retrospective simulation on all completed matches
- **Progress feedback** — progress bar with match count updates during execution via `BacktestRunner` progress callback
- **Results grid** — displays overall accuracy %, total matches tested, log loss, and Brier score
- **Per-outcome breakdown** — Home / Draw / Away accuracy with correct/total counts for granular model evaluation
- **Error handling** — shows clear message when fewer than 5 completed matches available
- **3 new Predictions tests** — button render, results display after run, error state for insufficient data
- **Test count 346 → 349**: 19 test files, 349/349 passing, 0 type errors

### P2d Predictions Component Tests — Partial (18 March 2026)
- **New `Predictions.test.ts`** — 14 tests covering the core prediction view
- Tests: header render, gameweek selector with 38 options, Predict Gameweek button, loading spinner, match loading by gameweek, API error state, completed gameweek message, gameweek filtering (only shows selected week), accuracy panel visibility, team logos, OptimizedPredictor integration, predictionTracker storage
- Added `export` to `loadGameweekMatches()` and `predictGameweek()` for testability
- Full BetBuilderPrediction mock matching the complete interface shape
- **Test count 332 → 346**: 19 test files, 346/346 passing, 0 type errors

### P1f Frontend UX Critical Fixes — Partial (18 March 2026)
- **Help.svelte rewritten** — replaced "Three-Model System" with accurate "Five-Component Ensemble" showing ELO (25%), Poisson (30%), Form (20%), H2H (10%), Standings (15%) with weight badges; removed xG model (unavailable on free tier); corrected polling frequency, export status, accuracy claims, mobile features
- **Dashboard hero** — "Live Predictions" label → "Match Predictions"; hardcoded hex colours (`#0f172a`, `#111827`) → theme-aware Tailwind classes (`from-slate-900 via-gray-900 to-slate-800` with dark variants); description updated to reference five-component ensemble
- **"How We Predict" section** — expanded from 4 to 5 items matching actual model; removed fake "Home Advantage"; added Trophy icon for Standings; each card now shows weight percentage
- **KellyCalculator headers** — inline `style="background: linear-gradient(...)"` → Tailwind gradient classes with dark mode support
- **Empty state improvement** — Dashboard "No predictions" panel now shows Target icon, guidance text, and "Go to Predictions" navigation link
- **Error state standardisation** — LiveMatches and TopScorers error containers now use `border-destructive/50 bg-destructive/10` (was barely-visible `border-border bg-card`); spinner sizes standardised to `h-12 w-12 border-t-2 border-b-2`
- **Confidence tooltip** — prediction card confidence badge now shows hover text explaining what the percentage means (high/moderate/low model agreement)
- **Test count unchanged at 332** — added `Trophy` icon to Dashboard test mock

### P2h Oracle Chat Improvements — Complete (18 March 2026)
- **Security warning banner** — collapsible `ShieldAlert` alert at top of chat explains that the OpenAI API key is visible in browser network tab; includes link to Settings page for key management
- **Markdown rendering** — new `renderMarkdown()` function handles bold (`**`), italic (`*`), fenced code blocks (`` ``` ``), inline code (`` ` ``), bullet lists (`-`/`*`), and numbered lists; rendered inside `.prose-chat` styled container
- **Batched context API calls** — replaced 3 sequential try/catch blocks with a single `Promise.allSettled()` call for parallel fetch of standings, form data, and predictions; reduces system prompt build latency
- **Chat persistence** — messages saved to `localStorage` under `oracle_chat_history` key (max 50 messages); restored on mount with reactive `$:` auto-save on every message change
- **Constants extracted**: `STORAGE_KEY_MESSAGES`, `STORAGE_KEY_API_KEY`, `MAX_STORED_MESSAGES` replace magic strings
- **Test count unchanged at 332** — ChatBot has no dedicated unit tests (tested via E2E in `oracle-chat.spec.ts`)

### P2i Value Bet Scanner — Complete (18 March 2026)
- **New `ValueBets.svelte` component** — wires the tested-but-orphaned `ValueBettingEngine` (38 existing tests) to a user-facing UI
- **Match selector** dropdown populated from upcoming matches (next 14 days), auto-filters completed matches
- **User-entered odds inputs**: 1X2 market (required) + optional Over/Under 2.5 Goals; bankroll input
- **"Scan for Value" button**: calls `ValueBettingEngine.identifyValueBets()` with user odds + predicted probabilities from `AdvancedMatchPredictor`
- **Results display**: edge %, EV %, Kelly stake, model reasoning, and risk warnings for each identified value bet
- **Navigation**: added to Sidebar (under Betting section) and MobileNav with Search icon
- **12 new tests** in `ValueBets.test.ts` covering container, header, empty state, match selector, odds inputs, scan button, bankroll, optional markets, API error, completed match filter, team logos
- **Test count 320 → 332**: 18 test files, 332/332 passing, 0 type errors

### P2g Kelly Auto-Suggestions — Complete (18 March 2026)
- **Suggested Bets panel** added above the manual Kelly Calculator — fetches upcoming matches (next 14 days), runs each through `OptimizedPredictor.predictMatch()`, computes Kelly stake, and displays value bets sorted by edge percentage
- **Confidence threshold slider** (40–90%, default 65%) lets users tune aggressiveness — lower threshold shows more suggestions with weaker edges, higher shows fewer but stronger
- **Reactive bankroll**: changing the bankroll input recalculates all suggestion stakes instantly via Svelte reactivity
- **Probability extraction**: reverses `valueOdds` margin (1.05) to get true predicted probabilities for each outcome; falls back to confidence-based estimate when `valueOdds` absent
- **Filters**: skips completed matches, predictions below confidence threshold, and negative EV bets
- **`KellySuggestion` interface** exported from module context for type safety
- **Test count 312 → 320**: KellyCalculator tests expanded from 7 to 15 — added suggestions empty state, API error, low-confidence filter, completed match skip, suggestion display, count text
- **320/320 tests passing, 0 type errors**

### P2f Backtest Runner — Complete (18 March 2026)
- **New file `backtest.ts`**: `BacktestRunner` class runs completed matches through the ensemble predictor retrospectively, comparing predicted vs actual results
- **Metrics**: overall accuracy %, per-outcome accuracy (H/D/A), log loss (calibration), Brier score (probability quality)
- **Probability extraction**: reverses `valueOdds` (margin 1.05) back to normalised probabilities; falls back to confidence-based split when `valueOdds` absent
- **Progress callback**: reports `(completed, total)` after each match for UI integration
- **Error resilience**: skipped matches (prediction failures) still report progress; metrics computed from successful predictions only
- **15 new tests** in `backtest.test.ts` covering accuracy, per-outcome breakdown, probability extraction, log loss (perfect + wrong), Brier score (perfect + worst case + uniform), progress callbacks, error handling, historical match exclusion, referee pass-through
- **Test count 297 → 312**: 17 test files, 312/312 passing, 0 type errors

### P2d Component Unit Tests — Partial (18 March 2026)
- **Test count 275 → 297**: 22 new tests across 3 new test files (16 total test files now)
- **`LiveMatches.test.ts`** (7 tests): header render, loading spinner, tab display after load, auto-switch to upcoming, error state with Try Again, recent match display with auto-switch, service call verification
- **`Settings.test.ts`** (8 tests): header, API input + Connect button, not connected default, connected flow via button click, favourite team dropdown, data management section, cache/sync buttons, disabled Connect when empty
- **`KellyCalculator.test.ts`** (7 tests): container render, header, input fields, auto-calculate with defaults, result labels, value bet indicator, edge percentage
- **`LiveMatches.svelte`**: exported `loadMatches()` for testability (matches `Dashboard.svelte` `refresh()` pattern)
- **Key finding**: `onMount` doesn't fire in jsdom with @testing-library/svelte 5.x + Svelte 4 — call exported methods directly via `(component as any).method()`
- **297/297 tests passing, 0 type errors**

### P1c E2E Test Maintenance — Complete (18 March 2026)
- **Test count 27 → 123**: Expanded from 27 tests (2 skipped) to 41 unique tests × 3 viewports = 123 total (0 skipped)
- **New `oracle-chat.spec.ts`**: 8 tests covering ChatBot component — container renders, API key setup, welcome message, input/send disabled states, key save/reject flows, clear chat, character counter
- **Prediction tests unblocked**: Fixed 2 previously-skipped tests. `prediction generation` now clicks predict, waits for completion, verifies scores and card flip analysis. `accuracy panel toggle` seeds settled predictions via localStorage then reloads to reinitialise PredictionTracker singleton
- **Kelly Calculator edge cases**: 2 new tests — no-value warning when probability < implied odds, edge percentage and value bet indicator with defaults
- **Mobile detection fix**: `helpers.ts` threshold updated from 768px to 1024px to match P1d CSS breakpoint alignment
- **123/123 E2E tests passing, 275/275 unit tests passing, 0 type errors**

### P1d Mobile UX Overhaul — Complete (18 March 2026)
- **Navigation dead zone fixed**: Mobile nav CSS used `md:hidden` (768px) but sidebar auto-opens at 1024px — tablet users (768-1024px) had NO navigation. Changed to `lg:hidden` to match sidebar breakpoint
- **Season Stats added to Sidebar**: Was only reachable via mobile "More" menu; desktop sidebar skipped it entirely
- **Content hidden behind mobile nav**: Added `pb-20 lg:pb-8` bottom padding to main content area so last items aren't clipped by the fixed bottom navigation bar
- **Prediction cards responsive**: Flip cards now 360px on mobile, 400px on `sm:+`; controls row wraps with `flex-wrap`; grid uses `sm:grid-cols-2` for earlier two-column layout; accuracy grids tightened to `gap-2 sm:gap-3`
- **ChatBot mobile-safe**: Viewport height adjusted from `14rem` to `18rem` offset to account for mobile nav; API key card padding responsive; message bubbles get `break-words` for long URLs
- **KellyCalculator stacks on mobile**: Results grid uses `grid-cols-1 sm:grid-cols-2`; stake amount text responsive `text-2xl sm:text-3xl`
- **Dashboard charts responsive**: Chart heights use `h-48 sm:h-56`; "How We Predict" grid gap tightened; prediction list items stack vertically on mobile with `truncate`
- **7 files changed, 275/275 tests passing, 0 type errors**

### P1e Frontend Correctness Bugs — Complete (18 March 2026)
- **7 of 8 P1e bugs fixed** — all silent logic errors producing wrong data for users
- **SeasonStats card stats**: Now show "N/A" with "Card data unavailable on free tier" explanation when Football-Data.org free tier returns null for yellow/red card fields (was silently showing 0)
- **Season boundary unified**: Both `footballData.ts` and `dataService.ts` now use `getMonth() >= 6` (July onwards = new season). Previously `dataService.ts` used `>= 7` (August), causing season ID mismatches for July matches
- **Model weights extracted**: `optimizedPredictions.ts` now uses a single `MODEL_WEIGHTS` constant — was duplicated in `combineModels()`, return value, and error fallback (which had DIFFERENT weights: form 0.25 vs 0.20, h2h 0.15 vs 0.10)
- **H2H fallback consistency**: When no head-to-head data, `homeWinRate` (0.40) and `awayWinRate` (0.30) now match probabilities. Previously rates were 0.33/0.33 but probabilities were 0.40/0.30
- **Dead code removed**: 4 dead state variables from `Predictions.svelte` (`selectedMatch`, `predictionInProgress`, `currentPrediction`, `visible`), 2 dead imports (`Clock`, `Database`), unused `animatedValue` tweened store from `SeasonStats.svelte` (plus `tweened`/`cubicOut` imports)
- **IndexedDB cache fixed**: `setCachedData` and `clearCache` now properly wrap IDB operations in Promises (was `await`-ing `IDBRequest` which resolves immediately). `initializeIndexedDB` returns a real Promise wired into `readyPromise` chain — DB guaranteed open before first query
- **Test setup improved**: Mock IndexedDB in `setup.ts` updated to simulate async callback pattern (fires `onsuccess` on next microtask) so Promise-based IDB wrappers resolve correctly
- **lateDrama false positive**: Audit #4 reported `full_time_result` doesn't exist on `Match` type — it does (line 41 of `types/index.ts`), and `transformMatch` populates it. No fix needed; updated description to "Results changed after halftime"
- **275/275 tests passing, 0 type errors**

### Deep Audit #4 — 9-Agent Comprehensive Sweep (17 March 2026)
- **9-agent parallel audit**: Studied all 7 specs, all 17 Svelte components, all frontend lib/services/types/stores/utils, all 10 backend Python files, all 13 unit test files + 5 E2E specs, and root documentation
- **8 new correctness bugs discovered**: `SeasonStats.svelte` lateDrama always 0 (references non-existent `full_time_result` field), `SeasonStats.svelte` card stats always 0 (free-tier returns null), season boundary inconsistency between `footballData.ts` (month >= 6) and `dataService.ts` (month >= 7), `optimizedPredictions.ts` model weights duplicated in two places, H2H fallback probabilities inconsistent (0.33 vs 0.40), `dataService.ts` `setCachedData` awaits IDBRequest (not a real Promise), `dataService.ts` `initializeIndexedDB` not awaited in constructor
- **Backend runtime bugs confirmed**: `modern_oracle.py` calls non-existent `data_collector.get_team_stats()` (AttributeError) and uses wrong kwarg `last_n` instead of `n_matches` (TypeError); bearer tokens on 2 endpoints never verified; global exception handler leaks raw error strings
- **Dead code catalogued**: 3 unused backend security modules (`auth.py`, `secrets.py`, `validators.py` — none imported by `main.py`); `ValueBettingEngine` tested (38 tests) but has zero UI consumers; 11 dead imports across 7 components; `getSeasonLabel()` duplicated in 3 files; `Predictions.svelte` has 4 dead state variables; `footballData.ts` has 2 uncalled methods
- **Help.svelte accuracy audit**: 5 inaccurate claims identified (push notifications, xG on dashboard, 3-model system, 5-min polling, export "planned" when already implemented)
- **New P1e section added**: 8 frontend correctness bugs that produce wrong data for users
- **New P2i section added**: Wire `ValueBettingEngine` to UI (tested but entirely unwired)
- **New P4f section added**: Dead imports and code duplication cleanup across 12 files
- **Stubs table expanded**: 29 frontend entries (was 26), 27 backend entries (was 17) — now includes all discovered issues
- **CLAUDE.md updated**: Added 2 remaining `np.random` calls in backend, unused security modules note, dead `Prediction` type, broken lateDrama, `ValueBettingEngine` unwired, `Help.svelte` inaccuracies, component test coverage gap (14/16 untested)

### P1a Frontend Bug Fixes — Complete (18 March 2026)
- All 20 correctness bugs fixed across components, prediction engine, and services
- Tests updated to match corrected behaviour. 275/275 passing, 0 type errors
- `betBuilder.ts` rivalry normalisation, `optimizedPredictions.ts` fatigue in Poisson lambda, `kelly.ts` half/quarter-Kelly fractions, `value.ts` CLV formula corrected, dark mode shared store, Chart.js memory leak fixed, and more

### Fix Backend Startup — P0a Complete (17 March 2026)
- **Backend now starts gracefully** without all ML dependencies installed — all optional imports (`shap`, `optuna`, `redis`, `sklearn`, `joblib`, `langchain`, `chromadb`, `torch`) wrapped in try/except with availability flags
- **`main.py`**: Guarded `redis.asyncio`, `AdvancedFeatureEngineer`, and `FootballDataCollector` imports; fixed lifespan null-check crash (`oracle.xgboost_model` called when `oracle is None`); fixed model performance endpoint null-checking LSTM/Transformer; fixed invalid CORS config (`allow_origins=["*"]` + `allow_credentials=True` → explicit frontend origins)
- **`xgboost_model.py`**: `shap` and `joblib` imports guarded with `SHAP_AVAILABLE`/`JOBLIB_AVAILABLE` flags; SHAP explainer creation and model save/load now check availability before use
- **`modern_oracle.py`**: `optuna`, `sklearn`, `joblib`, `redis` imports guarded; `XGBoostPredictor`, `AdvancedFeatureEngineer`, `FootballDataCollector` imports guarded; `train_all_models` checks `MLFLOW_AVAILABLE` and null-checks LSTM/Transformer; `optimize_ensemble_weights` returns defaults when optuna unavailable; LangChain setup checks `LANGCHAIN_AVAILABLE`
- **P0c confirmed done**: All 5 stale documentation files already absent from this branch
- **Test count corrected**: 275 Vitest tests (was documented as ~244)
- **Verified**: `python3 -c "from app.api.main import app"` succeeds; uvicorn lifespan completes; `/health` endpoint returns 200

### Comprehensive Planning Audit (17 March 2026)
- **21-agent deep audit**: Parallel analysis of all 7 specs, all frontend libs/services/components, all backend files, test suites, and project documentation
- **IMPLEMENTATION_PLAN.md rewritten**: Synthesised findings into prioritised bullet list (P0-P4) with 80+ action items, expanded stubs table (33 entries), test coverage matrix, and spec implementation status percentages
- **Backend feature engineering corrected**: `advanced_engineering.py` no longer has `np.random.*` calls (was 102 in prior audit), but 49 methods now return hardcoded `0.0` — a different but equally blocking pattern for ML training
- **Test count corrected**: Actual count is ~244 Vitest tests (was documented as 275); 27 Playwright E2E tests (2 skipped)
- **20+ new bugs documented**: `betBuilder.ts` rivalry dead code, `calculateHalfTimeResult` probability sum bug, fatigue not applied to Poisson lambda, Dashboard Chart.js memory leak, `dataService.getMatchesBySeason()` ignoring argument, CLV sign inversion in `value.ts`, and more
- **Spec gap analysis**: spec 03 (backend integration) at 0%, spec 07 (UI/UX) at ~10%, spec 06 (prediction tracking) at ~90%
- **Stale files identified**: 5 backend docs still exist on this branch that were deleted on v2.0-Development; SUPABASE_SETUP_GUIDE.md still at root
- **CLAUDE.md updated**: Corrected test counts, backend feature engineering status, shadcn-svelte state, active branch references

---

## [Unreleased] - v2.0-Development Branch

### Prediction Tracking, Accuracy Breakdown & Bet Auto-Resolution (14 March 2026)
- **Per-gameweek accuracy tracking**: Added `matchday` field to `StoredPrediction` and new `getAccuracyByGameweek()` method — predictions now record which gameweek they belong to, enabling accuracy breakdown by matchday
- **Accuracy breakdown panel**: Collapsible panel in Predictions view showing per-outcome accuracy (Home/Draw/Away), per-confidence band (High/Medium/Low), rolling last-10 accuracy, exact score rate, and streak stats — all sourced from `predictionTracker.getAccuracyStats()`
- **Dashboard accuracy chart fixed**: Was plotting `confidence * 100` as a misleading proxy for accuracy — now shows real per-gameweek accuracy when settled predictions exist, with a fallback chain to confidence scores then flat line
- **Bet auto-resolution wired**: `betHistoryService.resolveMatchBets()` now called from `dataService.reconcilePredictions()` alongside prediction reconciliation — bets auto-resolve regardless of which component loads match results
- **Combo bet resolution**: Added `resolveCombo()` and `resolveSingleLeg()` to `BetHistoryService` — combo bets (e.g. "Home Win + Over 2.5 Goals + BTTS Yes") can now be auto-resolved by parsing selection legs
- **Dashboard test fix**: Fixed pre-existing `stat-icon-wrapper` test failure — added `waitFor` wrapper and missing `getAccuracyByGameweek` mock
- **Spec inconsistency fixes**: Updated specs 03 (backend status), 05 (polling interval), and 07 (shadcn init status) to match reality
- **Tests**: 275 tests across 13 files, all passing; 0 type errors

### Test Coverage: betBuilder.ts & value.ts (14 March 2026)
- **betBuilder.test.ts (40 tests)**: Comprehensive coverage for `BetBuilderPredictor.generateBetBuilder()` — tests match result prediction (H/D/A), BTTS calculation, total goals over/under thresholds, corner expectations with/without team stats, card predictions with rivalry detection (all 6 hardcoded pairs), half-time result correlation, clean sheet probabilities from score distributions, and all 4 suggested combo types (Safe/Value/High Risk/Goals Galore) with threshold verification
- **value.test.ts (38 tests)**: Comprehensive coverage for `ValueBettingEngine` — tests value bet identification across 1X2/goals/BTTS markets, edge and confidence thresholds, expected value calculation, CLV tracking, arbitrage detection across multiple bookmakers, Sharpe ratio computation, performance metrics (ROI, yield, max drawdown, CLV rate), warning generation, and error handling (silent catch on API failure)
- **Tests**: 275 tests across 13 files, all passing; 0 type errors

### Value Bets, Kelly Integration & Data Accuracy (14 March 2026)
- **ValueBets.svelte overhaul (CRITICAL fix)**: Removed all 7 `Math.random()` calls that generated fake bookmaker odds — the feature was functionally useless. Replaced with manual odds entry: users now enter real bookmaker odds (Home/Draw/Away + optional Over 2.5/Under 2.5/BTTS) and the system analyses them for positive expected value using `ValueBettingEngine` and `KellyCalculator`
- **Kelly Criterion in Predictions**: Replaced the arbitrary linear stake formula `Math.max(0, (confidence - 0.6) * 10)` with proper Kelly Criterion calculation from `kelly.ts`, using Poisson outcome probabilities and model confidence
- **BTTS precedence bug fixed**: `* 100` was only applied to the `noProb` branch of a ternary in `Predictions.svelte`, causing the "Yes" probability to display as a raw decimal instead of a percentage
- **Gameweek filtering fixed**: Predictions view was slicing matches by array index (`(gameweek - 1) * 10`) assuming exactly 10 matches per gameweek — now uses the `matchday` field from the API, correctly handling blank/double gameweeks
- **Dynamic season labels**: Replaced hardcoded "2024/25 Season" in `StandingsTable.svelte` and `TopScorers.svelte` with a computed `getSeasonLabel()` function that derives the season from the current date
- **Dashboard navigation wired**: "View All Matches" button now dispatches a navigate event to the Matches view (was previously a dead button with no click handler)
- **DataService cleanup**: Removed dead `setDataSource()`, `getApiProvider()`, and `ApiProvider` type; fixed live match cache using 5-min default instead of intended 60s TTL; fixed `season_id` always being empty string on every match
- **Dead code removed**: Unused `predictMatch` import in `Predictions.svelte`, unused `dataService` import in `value.ts`, unused `apiProvider` variable in `Dashboard.svelte`, unused icon imports in `ValueBets.svelte`
- **Real form data**: ValueBets now fetches team form from the standings API instead of hardcoded `'N/A'`; h2h fallback changed from fabricated `'W2 D1 L2'` to `'No data available'`
- **Tests**: 197 tests across 11 files, all passing; 0 type errors

### Deep Audit & Plan Update (13 March 2026)
- **Second comprehensive audit**: 7 parallel research agents studied specs, frontend libs/services/components, backend, tests, and stubs
- **Discovered 12 new stubs** not previously documented: `cleanSheetRate: 0.3`, standings fallback probabilities, betBuilder half-time/combo hardcoded values, fake cache size calculation, position movement proxy, hardcoded season labels, non-functional UI elements
- **Corrected 1 false positive**: `ValueBets.svelte` h2h fallback `'W2 D1 L2'` was marked resolved but the template fallback at line 420 remains
- **Backend blocker identified**: `modern_oracle.py` uses deprecated LangChain/ChromaDB imports — server cannot start; must fix before any backend integration
- **102 `np.random.*` calls** confirmed in `advanced_engineering.py` (up from "40+" in previous audit)
- **Missing test coverage**: `betBuilder.ts` and `value.ts` have zero tests despite containing complex probability logic
- **Updated IMPLEMENTATION_PLAN.md**: Added phases 1g, 1h, 2j, 4h, 4i, 5a; expanded stubs table from 18 to 32 active entries; corrected resolved status for 1 entry
- **Updated CLAUDE.md**: Backend startup blocker, uncommitted value.ts changes, missing test coverage notes

### Prediction Engine Refinement & Auto-Reconciliation (13 March 2026)
- **Referee adjustment wired into ensemble**: `RefereeAnalyzer` is now called by `OptimizedPredictor.predictMatch()` — applies ±3% max adjustment to home/away probabilities based on referee's historical home win rate vs league average (46%). Insight surfaced in predictions output.
- **Hardcoded bookmaker odds removed**: Replaced `{home: 2.1, draw: 3.4, away: 3.8}` in `AdvancedMatchPredictor` with fair odds derived from model probabilities — no more fictitious value bet calculations.
- **Ensemble disagreement detection**: `calculateConfidence()` now detects when ELO and Poisson predict different outcomes and reduces confidence by 8%, surfacing the split as an insight.
- **Auto-reconciliation**: New `reconcilePredictions()` method in `dataService.ts` automatically resolves pending predictions against completed match results whenever finished matches are fetched.
- **BettingHistory test fixes**: Fixed 7 pre-existing test failures — `onMount` not firing in jsdom (moved to synchronous init), profit sign formatting (`£-10.00` → `-£10.00`), "Pending" text collision with filter dropdown.
- **Tests**: 197 tests across 11 files, all passing; 0 type errors

### BetHistoryService & Dashboard Real Data (12 March 2026)
- **BetHistoryService created**: New `services/betting/betHistoryService.ts` with full localStorage persistence — stores bets, calculates ROI, monthly P/L, win rate, and auto-resolves bets against match results
- **Dashboard wired to real data**: Removed all 7 `Math.random()` calls from `Dashboard.svelte` — profit, accuracy, predictions, and bet counts now come from `PredictionTracker` and `BetHistoryService`
- **Dead code removed**: Profit chart was unreachable (after `return` in `onMount`) with hardcoded `[150, 220, 180, 300, 250, 400]` — now renders real monthly P/L from `BetHistoryService`
- **Stat card fixes**: Renamed "Active Users" to "Total Predictions"; replaced hardcoded change strings with computed deltas
- **27 new tests**: Comprehensive test coverage for `BetHistoryService` (store, resolve, ROI, monthly P/L, win rate, export/import, persistence)

### Type Check & Cleanup (12 March 2026)
- **Fixed 21 type check errors**: `KellyCalculator.svelte` (edge→edgePercentage), `ValueBets.svelte` (property name mismatches, removed `Math.random()` for clean sheets and hardcoded H2H), `setup.ts` (global→globalThis), `footballData.test.ts` (Response mock casts)
- **Stale files removed**: backend/ANACONDA_SETUP.md, backend/JUPYTER_GUIDE.md, backend/TRAINING_GUIDE.md, backend/QUICKSTART.md, backend/docs/FOR_BEGINNERS.md (all documented non-existent infrastructure), root public/vite.svg, frontend/test-api.html
- **AGENTS.md**: Removed resolved IndexedDB bug entry
- **Tests**: 182 tests across 10 files, all passing; 0 type errors

### Dixon-Coles Poisson Model (12 March 2026)
- **Proper Poisson lambdas**: Replaced ad-hoc lambda formula (`avgGoalsScored * 1.2 + avgGoalsConceded * 0.8`) with the standard Dixon-Coles approach: `λ = attack_strength × defence_weakness × league_avg_goals`
- **Home/away splits**: Attack and defence strengths now computed separately for home and away from completed match results — a team's home scoring record is distinct from their away record
- **League-relative strengths**: Team strengths are expressed relative to the league average, so a team scoring 2 goals per game in a 1.5 avg league gets attack strength 1.33, not 2.0
- **Graceful fallback**: Falls back to overall stats when fewer than 3 home or away matches are available for a team
- **3 new tests**: Verifying stronger teams get higher lambdas, fallback behaviour, and high-scoring league adaptation; total now 155 tests, all passing

### Prediction Engine Overhaul (12 March 2026)
- **Dynamic ELO ratings**: Team ratings now persist to localStorage and update automatically from completed match results — no more static hardcoded ratings
- **Single source of truth**: Removed duplicate `TEAM_STRENGTHS` dictionary from `optimizedPredictions.ts`; both `AdvancedMatchPredictor` and `OptimizedPredictor` now share one `EloRatingSystem` instance
- **Standardised HOME_ADVANTAGE**: Unified at 65 ELO points across both prediction files (was 60 vs 65)
- **Real fatigue calculation**: `OptimizedPredictor` now computes fatigue from actual rest days between matches instead of returning a constant 1.0
- **Fixture difficulty fix**: `FatigueAnalyzer.calculateFixtureDifficulty()` now uses real opponent ELO ratings instead of hardcoded 1500
- **Confidence calibration**: Fixed `.sort()` array mutation bug; draw probability now scales dynamically with rating difference (PL average ~26.5%) instead of hardcoded 0.25
- **Eliminated hardcoded form strings**: Removed fabricated form strings ('WWDWL', 'LLDLD', etc.) from prediction fallback paths
- **New test suite**: Added 9 tests for `OptimizedPredictor` (previously 0% coverage); fixed 4 pre-existing Dashboard test failures; total now 152 tests across 9 files, all passing

### Deep Audit & Plan Refresh (11 March 2026)
- Full codebase audit with 7 parallel research agents across specs, frontend libs/services, components, backend, tests, and stale files
- Identified 35 stubs/hardcoded values across frontend (up from 18 previously documented) and 40+ fake feature methods in backend
- Confirmed test suite health: 110 tests across 8 files, all passing, no broken references
- Identified missing test coverage: optimizedPredictions.ts, betBuilder.ts, value.ts have zero tests; backend has 0% coverage
- Removed stale files: `oldplan.md` (marked "OUT OF DATE"), `to-do.txt` (referenced old api-football.com and Supabase)
- Updated IMPLEMENTATION_PLAN.md with comprehensive 6-phase plan, complete stub audit table, test coverage matrix, and file creation list
- Updated CLAUDE.md to reflect current state (old src/ removed, backend feature engineering status, test counts)

### Planning & Audit (5 March 2026)
- Comprehensive codebase audit identifying 18 stubs/hardcoded values, 4 TODO comments, and 6 missing service files
- Updated IMPLEMENTATION_PLAN.md with prioritised 6-phase plan covering data pipeline, prediction engine, tracking, betting, backend ML, and UI/UX
- Updated CLAUDE.md to reflect current architecture (frontend/backend split, no Supabase, Vitest testing)
- Identified and documented stale files for removal (old src/ directory, outdated documentation, Supabase remnants)

### Backend Scaffolding
- Python ML backend with FastAPI, XGBoost, LSTM, and Transformer model files
- 150+ feature engineering pipeline in `advanced_engineering.py`
- Football data collector for historical season data
- Security layer with auth, secrets, and validators

### Frontend Restructuring
- Migrated from `src/` to `frontend/src/` directory structure
- Removed Supabase dependency from frontend code
- Added Vitest testing framework with testing-library/svelte
- Added comprehensive type definitions in `types/index.ts`

---

## [2.0.0] - 14th August 2025 - The Definitive Transformation

### 🎯 Overview
Complete transformation from a static, manually-updated prediction tool to a dynamic, AI-powered platform with real-time data integration and professional betting intelligence.

### ✨ Major Features Added

#### **AI Assistant Revolution** 🤖
- **Real AI Integration**: Replaced placeholder responses with actual OpenAI/Claude API calls
- **Multi-Model Support**: Choose between GPT-4, GPT-3.5, Claude 3 Opus/Sonnet/Haiku
- **Context-Aware Responses**: AI fetches real match data from database for informed analysis
- **Streaming Responses**: Real-time response streaming for better UX
- **Cost-Effective**: Pay-per-use with local API key storage

#### **Football-Data.org API Integration** ⚽
- **Live Data**: Real-time fixtures, results, and standings
- **Automatic Updates**: No more manual data entry
- **Smart Caching**: IndexedDB for offline support and reduced API calls
- **Rate Limiting**: Intelligent request management for free tier (10 req/min)
- **Hybrid Approach**: Seamless fallback to Supabase when API unavailable

#### **Advanced Betting Intelligence** 💰
- **Kelly Criterion Calculator**: 
  - Full, half, and quarter Kelly calculations
  - Bankroll management optimisation
  - Risk assessment with confidence levels
  - 1000-bet simulation capabilities
- **Value Betting Engine**:
  - Automatic +EV bet identification
  - Multi-market analysis (1X2, Over/Under, BTTS)
  - Edge calculation and expected value
  - CLV (Closing Line Value) tracking
- **Performance Metrics**:
  - ROI and yield tracking
  - Sharpe ratio calculation
  - Maximum drawdown analysis
  - Arbitrage opportunity detection

#### **Professional Prediction Models** 📊
- **Enhanced ELO System**: Dynamic K-factors and team-specific home advantage
- **Poisson Distribution**: Goals prediction with Dixon-Coles adjustment
- **Expected Goals (xG)**: Simplified xG calculations based on shots data
- **Fatigue Analysis**: Rest days and fixture congestion impact
- **Referee Impact**: Historical referee tendency analysis

### 🔧 Technical Improvements

#### **Architecture Overhaul**
- **Service-Oriented Design**: 
  ```
  src/services/
  ├── api/          # External API integrations
  ├── betting/      # Kelly, value detection
  ├── aiService.ts  # AI orchestration
  └── dataService.ts # Hybrid data management
  ```
- **Caching Strategy**: Three-tier caching (Memory → IndexedDB → API)
- **Error Handling**: Comprehensive error boundaries and fallbacks
- **Type Safety**: Full TypeScript coverage with proper interfaces

#### **Performance Optimisations**
- **API Call Batching**: Reduced requests by 60%
- **Lazy Loading**: Components load on-demand
- **IndexedDB Caching**: Offline-first approach
- **Rate Limit Management**: Queue system for API calls

#### **Developer Experience**
- **Environment Configuration**: `.env.example` for easy setup
- **Modular Components**: Reusable Svelte components
- **Clear Service Boundaries**: Separation of concerns
- **Comprehensive Documentation**: Plan.md, API guides, inline comments

### 🔄 Migration from v1.x

#### **Breaking Changes**
1. **Data Source**: Primary data now from Football-Data.org API (Supabase as fallback)
2. **AI Assistant**: Requires API key for full functionality (free mode still available)
3. **Environment Variables**: New required configs (see `.env.example`)

#### **Migration Steps**
1. Copy `.env.example` to `.env`
2. Add your Football-Data.org API key
3. Configure AI provider in settings (optional)
4. Run `npm install` for new dependencies
5. Clear browser cache for fresh IndexedDB

#### **Backwards Compatibility**
- ✅ Existing Supabase data remains accessible
- ✅ Free mode (without API keys) still functional
- ✅ All v1 features preserved and enhanced

### 📊 Performance Improvements
- **Page Load**: 40% faster with lazy loading
- **API Response**: Cached responses serve in <100ms
- **Prediction Accuracy**: Target 65-70% with new models
- **Data Freshness**: Real-time updates vs daily manual updates

### 🐛 Bug Fixes
- Fixed AI Assistant not using actual API keys
- Resolved hardcoded prediction values (ELO ratings)
- Fixed manual data dependency issues
- Corrected TypeScript type mismatches

### 📦 Dependencies Added
```json
{
  "@supabase/supabase-js": "^2.39.3",
  "chart.js": "^4.0.0",
  "svelte-chartjs": "^3.1.2",
  "lucide-svelte": "^0.503.0",
  "date-fns": "^2.30.0"
}
```

### 🎯 What's Next (v2.1 Roadmap)
- Python ML backend with FastAPI
- XGBoost prediction model (90% accuracy potential)
- LSTM neural networks for time series
- Live WebSocket connections
- Mobile PWA support

---

## [1.4.0] - February 2025 - Frontend Enhancements

### Added
- Modern UI with Tailwind CSS
- Dark/light mode toggle
- Responsive mobile design
- Interactive charts with Chart.js
- Live ticker component

### Improved
- Component architecture
- State management
- User experience

---

## [1.0.0] - January 2025 - Initial Release

### Features
- Basic match predictions
- Historical data from Football-Data.co.uk
- Supabase PostgreSQL database
- Simple statistical models
- Web interface

### Known Issues
- Manual data updates required
- Limited prediction accuracy
- No real-time features
- Basic UI/UX

---

## Version Naming Convention
- **Major (X.0.0)**: Breaking changes, architecture overhauls
- **Minor (0.X.0)**: New features, non-breaking changes
- **Patch (0.0.X)**: Bug fixes, small improvements

## Support
For issues or questions, please visit: https://github.com/ThomasJButler/The-Premier-League-Oracle/issues

---

*The Premier League Oracle - From humble beginnings to the definitive prediction platform*