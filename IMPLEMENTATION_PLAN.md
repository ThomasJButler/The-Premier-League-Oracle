# Premier League Oracle — Implementation Plan

Last updated: 18 March 2026 (fifth planning audit — ~11 new findings across 8 parallel agents; shadcn utils missing, cache key bug, test quality regressions, backend dep gaps, font loading correction)
Active branch: `v3.0-Frontend`

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

## P0 — Blockers — ALL DONE

- [x] **P0a. Fix Backend Startup** — all imports guarded with try/except and availability flags. Server starts gracefully. Verified: uvicorn starts, `/health` returns 200.
- [x] **P0b. Backend requirements.txt Audit** — completed 14 March 2026.
- [x] **P0c. Delete Stale Documentation** — 5 files confirmed absent. **Note:** `backend/docs/FOR_BEGINNERS.md` still exists with broken tutorial links — should be cleaned up (see P4g).

---

## P1 — High Priority (current sprint)

### P1a. Frontend Bug Fixes — DONE (18 March 2026)

All 20 correctness bugs fixed. 275/275 passing, 0 type errors. See CHANGELOG for details.

### P1b. Dark Mode Persistence — DONE (18 March 2026)

Shared theme store at `frontend/src/stores/theme.ts` with localStorage restore, media query fallback.

### P1d. Mobile UX Overhaul — DONE (18 March 2026)

Fixed 7 mobile layout bugs across 7 files. Navigation dead zone, content clipping, responsive cards.

### P1c. E2E Test Maintenance — DONE (18 March 2026)

E2E coverage expanded from 27 tests (2 skipped) to 43 unique tests × 3 viewports = 123 executions (0 skipped) across 6 spec files.

### P1e. Frontend Correctness Bugs — DONE (18 March 2026)

7 of 8 silent logic bugs fixed. Season boundary unified, model weights extracted, H2H fallback consistency, IndexedDB cache fixed, dead code removed.

### P1f. Frontend UX Critical Fixes — PARTIAL (18 March 2026)

**Done:** Help.svelte rewritten (5/5 major inaccuracies), Dashboard hero + "How We Predict" updated, KellyCalculator headers, empty states, error standardisation, confidence tooltips, mobile features section.

**Still to do:**

- [ ] "Last updated" indicator — deferred (requires data layer changes to track cache freshness)

**Remaining Help.svelte inaccuracies — DONE (19 March 2026):**

- [x] "Offline data caching" → "Local data caching" — IndexedDB is a browser cache, not offline capability
- [x] FAQ "CSV export button" → "JSON export button" — BettingHistory exports JSON, not CSV
- [x] "Value Bets > Historical performance" → "Track placed bets" — the actual feature
- [x] "Golden Rules" accuracy claims → removed specific percentages ("75-85%"), replaced with "check the Predictions accuracy panel"
- [x] "Bounce-Back Effect" and "New Manager Bounce" → replaced with practical advice ("Fixture Difficulty" and "Use the Backtest") that reflects actual model features
- [x] FAQ "offline viewing" answer → clarified there is no full offline mode, just browser caching

### P1h. CodeRabbit Unfixed — High Priority (18 March 2026)

Identified by CodeRabbit review. 11 of 19 actionable issues were fixed in commit `c3d2f36`. The following require larger changes:

**ChatBot API key exposure (security — active risk):**

- [ ] `ChatBot.svelte` makes direct browser→OpenAI calls — API key visible in DevTools network tab. Route OpenAI calls through a backend proxy endpoint so the key is never sent to the client. Until then, users should be warned not to use their primary key. Architecture fix required — not a one-liner.

**`importBets` stores unvalidated data (data integrity) — DONE (18 March 2026):**

- [x] `betHistoryService.ts`: `importBets()` now validates each bet before storing: requires `id`, `matchId`, `homeTeam`, `awayTeam`; `odds > 1` and `stake > 0`; `market` in allowlist (`match_result`, `btts`, `over_2_5`, `over_3_5`, `combo`); resolved bets must have `profit` value. Invalid bets silently skipped.

**Frontend prediction model bugs (deep audit) — DONE (18 March 2026):**

- [x] `optimizedPredictions.ts`: H2H probability shrinkage fixed — changed `ratio * 0.8 + 0.1` to `ratio * 0.7 + 0.1` so probabilities sum to 1.0 (was 1.1). Proper shrinkage towards uniform distribution
- [x] `advancedPredictions.ts`: `ratingDiff > 200` threshold fixed to `> 2` — ratingDiff is divided by 100 at line 475, so 200-point ELO gap = 2.0 in the scaled units. "Significant quality gap" insight now fires correctly
- [x] `optimizedPredictions.ts`: error fallback now logs `console.warn` with the error before returning static fallback prediction

### P1i. Bet Storage Pipeline Broken — DONE (18 March 2026)

`betHistoryService.storeBet()` now wired into both betting UIs. 378/378 tests passing, 0 type errors.

- [x] `KellyCalculator.svelte`: "Track Bet" button on each Kelly suggestion — stores match result bet with halfKelly fraction, model confidence, and calculated stake. Shows "Tracked" state after click
- [x] `ValueBets.svelte`: "Track Bet" button on each value bet result — maps ValueBet market format (`'home'`, `'over2.5'`, `'btts'`) to StoredBet market format (`'match_result'`, `'over_2_5'`, `'btts'`). Shows "Tracked" state after click
- [x] `BettingHistory.svelte` already reads from `betHistoryService.getAllBets()` — stored bets appear on next page load
- [ ] `betHistoryService.getBetsByMonth()` and `clearHistory()` are still never called from any component — defer to P4f dead code cleanup

### P1j. ChatBot XSS Risk — DONE (19 March 2026)

- [x] `ChatBot.svelte:420` — `{@html renderMarkdown(msg.content)}` now sanitised via `DOMPurify.sanitize()` with an explicit allowlist of safe tags (`pre`, `code`, `strong`, `em`, `li`, `ul`, `ol`, `br`, `p`, `div`, `span`) and only `class` attribute permitted. DOMPurify installed as a production dependency. Test mock added to `ChatBot.test.ts`

### P1k. Prediction Storage Bug — DONE (19 March 2026)

- [x] `Predictions.svelte:215` — removed `was_correct: false` from the view-level prediction object. Made `was_correct` optional on the `Prediction` type in `types/index.ts` since correctness is only determined later by `predictionTracker.updateWithResult()`
- [x] `Predictions.svelte:47` — updated misleading comment "Updated from API season data if available" to "Premier League: 20 teams × 2 = 38 matchdays (always)". Also removed stale comment about totalGameweeks in onMount

### P1l. Live Probability Bugs — DONE (18 March 2026)

All 5 probability and UX bugs fixed. 378/378 tests passing, 0 type errors.

- [x] `betBuilder.ts`: corner and card probability outputs clamped to `[0, 0.99]` in `calculateCorners()` and `calculateCards()` — prevents nonsensical >1.0 probabilities in `suggestedCombos`
- [x] `KellyCalculator.svelte`: fixed circular Kelly calculation — was using `1.05 / odds` as `ourProbability` (always gave fake 5% edge against model's own odds). Now correctly uses `prediction.confidence` as `ourProbability` and `valueOdds` as `bookmakerOdds`, so edge only appears when model confidence exceeds the odds-implied probability
- [x] `footballData.ts:366`: replaced `!fdMatch.score.halfTime.home` falsy check with explicit `=== null || === undefined` — 0-0 half-time scores now correctly classified as `'D'` instead of `null`
- [x] `Dashboard.svelte`: replaced unbounded 5s retry interval with exponential backoff (5s, 10s, 20s) capped at 3 retries — prevents indefinite API spam when key is missing/invalid
- [x] `Settings.svelte`: `saveFootballDataKey()` now trims whitespace and delegates to `setApiKey()` only (removed redundant duplicate `localStorage.setItem` call)

### P1m. Data Layer Cache Bugs — PARTIAL (19 March 2026)

**dataService cache TTL mismatches — DONE:**

- [x] `dataService.ts:528`: `getHistoricalMatches` now passes `24 * 60 * 60 * 1000` (24h) TTL to `getCachedData` — matches the comment's intent
- [x] `dataService.ts:549`: `getTeamRecentMatches` now passes `30 * 60 * 1000` (30min) TTL to `getCachedData` — matches the comment's intent
- [x] `dataService.ts:179`: `getCurrentSeason()` caching in `teamStats` store documented with inline comment explaining the trade-off (no dedicated season store; IDB schema migration not worth it)

**footballData double-cache architecture — deferred (P3):**

- [ ] The `FootballDataAPI` in-memory `Map` cache and `dataService` IndexedDB cache operate independently with separate TTLs. After `setApiKey()`, only the in-memory cache clears but IndexedDB retains stale entries. Consider consolidating or adding IndexedDB invalidation on key change

### P1n. footballData API Error Misidentification — DONE (19 March 2026)

- [x] `footballData.ts:189`: HTTP 403 now parses the response body and checks for rate-limit keywords (`rate`, `limit`, `quota`, `too many`). Rate-limit 403s show "Rate limit exceeded — please wait and try again" instead of "API authentication failed". Also added explicit HTTP 429 handling as a separate branch

### P1o. Backend `/standings` Endpoint Crashes at Runtime — DONE (19 March 2026)

- [x] `main.py` `/standings` endpoint: added `standings.to_dict(orient='records')` conversion with `hasattr` guard — `pd.DataFrame` is now properly serialised to a list of dicts before FastAPI returns it as JSON

### P1p. dataService `getTeamForm` Cache Key Bug — DONE (19 March 2026)

- [x] `dataService.ts:395`: cache key now uses `matches.slice(0, 10).map(m => m.id).join(',')` as a fingerprint instead of `matches?.length || 5`. Different match arrays for the same team now correctly produce different cache keys

### P1g. Newly Discovered Logic Bugs — DONE (18 March 2026)

All 13 silent logic bugs discovered during the 8-agent audit have been fixed. 378/378 tests passing, 0 type errors.

- [x] `betBuilder.ts`: `||` → `??` for `predictedHomeGoals`/`awayGoals` — 0 goals no longer treated as falsy
- [x] `betHistoryService.ts`: clean sheet resolution fixed — home clean sheet = away scored 0 (was requiring home to score AND away concede 0)
- [x] `betHistoryService.ts`: bare `'win to nil'` leg now has fallback (was silently unresolved forever)
- [x] `betHistoryService.ts`: void bets excluded from `getMonthlyPL` (consistent with `getROI`)
- [x] `TopScorers.svelte`: `||` → `??` for assists/penalties — 0 values now display correctly
- [x] `TopScorers.svelte`: position fallback changed from `'Forward'` to `'Unknown'`
- [x] `BettingHistory.svelte`: Chart.js CSS variables corrected (`--text-muted` → `--muted-foreground`, `--text-base` → `--foreground`)
- [x] `dataService.ts`: `clearCache()` no longer removes the user's API key
- [x] `dataService.ts`: `getPredictionAccuracy(seasonId)` now filters predictions by season date range
- [x] `optimizedPredictions.ts`: form fallback returns neutral 0.5 instead of deriving from ELO (eliminates double-counting)
- [x] `backtest.ts`: matches sorted chronologically before iteration (prevents data leakage)
- [x] `backtest.ts`: ELO system snapshot/restored around backtest runs (reproducible results)
- [x] `ValueBets.svelte`: BTTS odds inputs added to template (engine already supported the market)

---

## P2 — Next Sprint

### P2a. shadcn-svelte Completion — DONE (18 March 2026)

5 components installed, `components.json` created. Component wiring deferred (CSS class system has diverged from shadcn styles).

### P2a-fix. shadcn-svelte `$lib/utils.ts` Missing — DONE (18 March 2026)

`components.json` sets `aliases.utils: "$lib/utils"` but `frontend/src/lib/utils.ts` did not exist. Created the standard shadcn `cn()` utility with `clsx` + `tailwind-merge`. Both deps already in package.json.

- [x] Create `frontend/src/lib/utils.ts` with `cn()` utility
- [x] Verify `clsx` and `tailwind-merge` are in `frontend/package.json`

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
- [x] Fix fake cache size calculation — now sums actual key+value byte lengths across all localStorage entries (UTF-16, 2 bytes per char)

### P2d. Missing Component Tests — DONE (18 March 2026)

378 Vitest tests across 21 files (was 275/13). Eight new test files added: LiveMatches, KellyCalculator, Settings, Predictions, ChatBot, ValueBets, backtest, dataService.cache.

**Still untested components (10):** SeasonStats, StandingsTable, TopScorers, Help, App, ApiSetupWizard, MatchList, LiveTicker, MobileNav, Sidebar.

### P2e. Type System Gaps — DONE (18 March 2026)

`getTopScorers` return type fixed, `Prediction` interface documented. Remaining type gaps deferred as low priority.

### P2f. Backtest Runner — DONE (18 March 2026)

`BacktestRunner` class in `frontend/src/lib/backtest.ts` with 15 tests. Reports accuracy, log loss, Brier score. Wired to Predictions UI (P2f-UI).

### P2g. Kelly Auto-Suggestions — DONE (18 March 2026)

Suggested bets panel above manual calculator. Confidence threshold slider (40-90%), reactive bankroll. 15 tests.

### P2h. Oracle Chat Improvements — DONE (18 March 2026)

Security warning banner, markdown rendering, batched context calls, chat persistence. Backend prediction integration deferred until P2b.

### P2i. Wire ValueBettingEngine to UI — DONE (18 March 2026)

`ValueBets.svelte` created with match selector, user-entered odds inputs, scan for value. 12 tests.

### P2j. Backtest Reliability Fixes — DONE (18 March 2026)

Discovered in audit — the backtest runner had two methodological issues, plus two remaining cleanup tasks:

- [x] Sort matches chronologically before iteration (prevent data leakage from future matches into ELO state) — fixed P1g
- [x] Snapshot and restore `sharedEloSystem` before/after backtest run (ensure reproducibility across multiple runs in same session) — fixed P1g; ELO restore now also resets teams created during the run (CodeRabbit fix, commit `c3d2f36`)
- [x] Guard division by zero in `extractProbabilities` when `valueOdds` fields are 0 — fixed CodeRabbit batch
- [x] Extract `VALUE_ODDS_MARGIN = 1.05` to a shared constant in `lib/constants.ts` (was duplicated in `advancedPredictions.ts`, `optimizedPredictions.ts`, `backtest.ts`)

### P2k. ELO Auto-Update Integration — DONE (18 March 2026)

Spec 01 requires ELO ratings to auto-update from completed match results. Wired `sharedEloSystem.processCompletedMatches()` into `dataService.reconcilePredictions()` — ELO ratings now update automatically whenever match results are reconciled.

- [x] Wire `processCompletedMatches()` into `dataService.reconcilePredictions()` — call after prediction/bet resolution
- [x] Add `sharedEloSystem` mock to `dataService.test.ts` and `dataService.cache.test.ts`

### P2l. Production Deployment — DONE (19 March 2026)

Created `vercel.json` with build command, output directory, and SPA catch-all rewrite. The Vite dev proxy is only needed locally; in production, the frontend calls Football-Data.org directly (they send `Access-Control-Allow-Origin: *`). The user's API key is stored in localStorage and sent via `X-Auth-Token` header from the browser.

- [x] Create `vercel.json` with `buildCommand`, `outputDirectory`, and SPA rewrite `/(.*) → /index.html`
- [x] Football-Data.org CORS verified — sends `Access-Control-Allow-Origin: *`, direct browser calls work
- [x] Root `.env.example` updated (P2p) — Supabase references removed
- [ ] No `backend/.env.example` exists — create a template for required backend environment variables (deferred — backend not deployed to Vercel)

### P2m. Derive Hardcoded League Stats from Data — DONE (19 March 2026)

- [x] `optimizedPredictions.ts`: `LEAGUE_AVG_HOME_WIN_RATE = 0.46` replaced with `leagueAvgs.homeWinRate` computed from completed matches in `computeLeagueAverages()`
- [x] Added `homeWinRate` field to `LeagueAverages` interface with 0.46 fallback for zero-data case
- [x] Fixed `FatigueAnalyzer.getFatigueMultiplier()` zero-multiplier bug — floored `restDays` at 0.5 to prevent division-by-zero in Poisson lambda calculation
- [x] Fixed test timing race in `optimizedPredictions.test.ts` — mock match dates now use "yesterday" instead of `new Date()` to avoid flaky `calculateRestDays` filtering
- [ ] `advancedPredictions.ts`: default referee stats `avgYellowCards: 4, avgRedCards: 0.1, homeWinRate: 0.46` — these are fallback values when no referee data is available; kept as-is since `RefereeAnalyzer` doesn't have access to league-wide stats context

### P2n. CI/CD Pipeline — DONE (19 March 2026)

- [x] Created `.github/workflows/ci.yml` — runs `npm run check`, `npm run test:run`, and `npm run build` on push/PR to `main` and `v3.0-*` branches
- [x] Uses Node.js 20, npm caching, and `npm ci` for deterministic installs
- [ ] Consider Playwright E2E in CI (heavier, but valuable — deferred to later)

### P2o. Docker Cleanup — NEW (19 March 2026)

`backend/docker-compose.yml` references files and directories that don't exist. Running `docker-compose up` fails immediately.

- [ ] `config.yml` — referenced by `Dockerfile COPY` but doesn't exist. Create a minimal config or remove the COPY
- [ ] `nginx.conf` — referenced as a volume mount but doesn't exist. Create or remove from compose
- [ ] `notebooks/` — mounted as a volume but directory doesn't exist. Create or remove from compose
- [ ] `POSTGRES_PASSWORD` required by compose but no `.env.example` template documents it
- [ ] `setup.sh` creates `data/`, `logs/`, `notebooks/` directories that `docker-compose.yml` depends on as bind-mount sources — this dependency is undocumented. Running `docker-compose up` without first running `setup.sh` will fail (fifth audit)

### P2p. Supabase Cleanup Completion — DONE (19 March 2026)

- [x] Updated `specs/02-data-pipeline.md` — all 7 Supabase removal items checked off (confirmed absent from codebase)
- [x] `.env.example` updated — Supabase references removed, replaced with Football-Data.org API key comment

### P2q. Parallel Fatigue Models — DONE (19 March 2026)

Consolidated to single fatigue model. `OptimizedPredictor.calculateFatigueFactor()` now delegates to `FatigueAnalyzer.getFatigueMultiplier()` instead of using its own discrete step function. Both callers now use the same continuous formula.

- [x] `optimizedPredictions.ts`: replaced inline step function with `FatigueAnalyzer.getFatigueMultiplier(restDays, 1)` call
- [x] `advancedPredictions.ts`: `FatigueAnalyzer.getFatigueMultiplier()` is now the single source of truth for fatigue calculations

### P2r. Config & Infrastructure Cleanup — PARTIAL (19 March 2026)

**Dead dependencies in `package.json` — DONE:**

- [x] Remove `tailwind-variants` — uninstalled
- [x] Remove `bits-ui` — uninstalled
- [x] Remove `happy-dom` from devDependencies — uninstalled
- [x] ~~Add `@types/node` to devDependencies~~ **DONE** — provides types for `path` and `__dirname` in vite.config

**Version pinning:**

- [x] Created `.nvmrc` at project root with `20` — matches CI Node.js version
- [ ] Fix Python version mismatch: `requirements.txt` says 3.13, `Dockerfile` uses 3.11, `environment.yml` uses 3.11 — align all to one version
- [ ] `passlib==1.7.4` is incompatible with Python 3.13 — the `crypt` module was removed from stdlib in 3.13. If the target is truly 3.13, this will crash at import. (Only used by dead `auth.py` module, so low runtime risk)

**`.gitignore` gaps — DONE:**

- [x] Add `**/__pycache__/` globally — replaced single path with glob pattern
- [x] Add `backend/cache/` — added
- [x] Add `backend/logs/` and `backend/mlruns/` — added

**Build configuration — PARTIAL:**

- [x] `vite.config.ts`: removed `console.log` from proxy handler
- [x] `vite.config.ts`: removed unnecessary `secure: false` on proxy
- [ ] `vite.config.ts`: consider adding `build` block with chunk splitting and sourcemaps for production
- [ ] `tsconfig.json`: consider enabling `strict: true` in the app tsconfig (currently only enabled in `tsconfig.node.json`)

**Production readiness:**

- [x] `index.html`: added `<meta name="description">` and Open Graph tags (`og:title`, `og:description`, `og:type`). Favicon remains Vite default (project branding asset not yet available)
- [x] `app.css`: removed dead `.gradient-text` class and `@keyframes gradientShift` — class was never used by any component, and the gradient colours were imperceptibly similar

**Backend dead dependencies in `requirements.txt`:**

- [ ] Remove or mark as optional: `boto3`, `hvac`, `azure-keyvault-secrets`, `azure-identity` — heavy deps (~30MB+) for `secrets.py` which is never imported by `main.py`
- [ ] Remove `sqlalchemy` — only imported by unused `auth.py`
- [ ] Add `pyyaml` and `httpx` if needed (present in `environment.yml` but missing from `requirements.txt`)

**Backend missing dependencies in `requirements.txt` (fifth audit):**

- [ ] Add `langchain-community` — `modern_oracle.py` imports `from langchain_community.embeddings import OpenAIEmbeddings`, `from langchain_community.vectorstores import Chroma`, `from langchain_community.document_loaders import DataFrameLoader`. Package is separate from `langchain` and not listed
- [ ] Add `bcrypt` — `auth.py` uses `passlib` with `CryptContext(schemes=["bcrypt"])` which requires the `bcrypt` package as a backend. Currently only `passlib` is listed
- [ ] `main.py:511-515`: `/features/importance` endpoint accesses `oracle.lstm_model.model` without checking if `lstm_model` is not None — will `AttributeError` when LSTM is unavailable (torch missing). Add None guard matching the REST endpoint pattern

### P2s. LSTM Synthetic Training Data — NEW (18 March 2026, third audit)

- [ ] `lstm_predictor.py:537-540` generates entirely synthetic training data using `np.random.randn` (features) and `np.random.randint` (labels) when training without real data. This is distinct from the feature importance stub at line 523. The LSTM can "train" on random noise without error, producing a trained-but-meaningless model with no warning. Add: guard that raises `ValueError("No real training data provided")` instead of falling back to random data.

### P2t. Type Safety Gaps — PARTIAL (19 March 2026)

- [x] `Dashboard.svelte:38`: `topPredictions` now properly typed with inline `Array<{ match: string; confidence: number; prediction: string; wasCorrect: boolean | null }>`
- [x] `betBuilder.ts:206,234,306,350-355`: `calculateCorners`/`calculateCards` now typed as `TeamStats | null | undefined`; `calculateHalfTimeResult` and `generateSuggestedCombos` now use `BetBuilderPrediction` indexed types
- [ ] `Predictions.svelte:7,19`: imports dead legacy `Prediction` type from `types/index.ts` (diverges from `StoredPrediction` which is the actual runtime type) — deferred
- [x] `ChatBot.svelte:281`: `handleKeydown` now accepts `Event` with `KeyboardEvent` cast (Svelte 4 type system quirk prevents direct `KeyboardEvent` typing on `on:keydown`)
- [x] `App.svelte`: `currentView` now typed as `ViewName` union (13 valid view names); `navigate` casts from `string` at the event boundary

### P2u. betHistoryService Market Format Mismatch — MITIGATED (19 March 2026)

`StoredBet.market` uses `'over_2_5'` (underscores) while `ValueBet.market` from `value.ts` uses `'over2.5'` (dot format). Investigated and found that `ValueBets.svelte` already has `mapMarket()` and `mapSelection()` functions that convert between formats before calling `storeBet()`. `KellyCalculator.svelte` uses `StoredBet` format directly. No code path bypasses the conversion — only these two components call `storeBet()`. Risk is mitigated but the mapping should ideally live at the service boundary if more callers are added.

### P2v. Backtest Performance — DONE (19 March 2026)

`OptimizedPredictor.predictMatch()` now accepts `historicalMatches` as a fast path that bypasses all `dataService` calls during backtesting:

- [x] When `historicalMatches` is provided, uses it directly for Poisson league averages instead of `dataService.getMatches()`
- [x] New `calculateFatigueFromMatches()` derives rest days from the provided match list (avoids 2× `dataService.getMatches()` per match from `FatigueAnalyzer.calculateRestDays`)
- [x] `analyzeRecentForm()` passes `historicalMatches` through to `dataService.getTeamForm(team, matches)` — the API already supported this but it was never wired up
- [x] Standings skipped in backtest mode — ELO-derived positions used instead (more accurate for historical backtesting than current-season standings)
- [x] Net effect: **6 async `dataService` calls per match → 0** when `historicalMatches` is provided (i.e., the backtest loop). Normal live predictions are unchanged

### P2w. dataService `refreshApiConfiguration` Wiring Bug — DONE (19 March 2026)

- [x] `refreshApiConfiguration()` now reassigns `this.readyPromise = this.checkDataSources()` before awaiting, matching the pattern in `refreshDataSources()`. Concurrent `ensureReady()` calls now wait for the fresh check

### P2x. ID Collision Risk in Singletons — DONE (19 March 2026)

- [x] `predictionTracker.ts` and `betHistoryService.ts` now use `crypto.randomUUID()` for ID generation, eliminating multi-tab and same-millisecond collision risks. Removed `static idCounter` from both classes

---

## P3 — Backend ML

Two-tier approach: **P3-Free** builds a lean XGBoost model trained on ~83 features available from the Football-Data.org free API — this is the active development track and the model used for all testing and deployment. **P3a–P3g** remain in place for the future Pro API integration, which unlocks the full 150-feature pipeline (xG, shots, possession, cards, corners, betting odds, player data). `specs/08-backend-training.md` is the single source of truth for training requirements — written 18 March 2026.

### P3-Free. Free-Tier ML Model (separate entry point)

Standalone ML model trained on features available from the free API tier. Completely separate from the full 150-feature pipeline (P3a-P3c), which is kept for future Pro API use. This is the model used for all testing and initial deployment.

**Architecture:** `FreeTierFeatureEngineer` wraps `AdvancedFeatureEngineer` via composition (not subclassing) and cherry-picks only the methods that return real computed data — no stubs, no flags polluting the existing class. The two tiers are fully decoupled.

**Features used (~83):** Basic stats (12), Form & momentum (20), H2H (15), Contextual (12), Time series (9), Derived (5), Half-time (3–5), Match stats from history (5–7: cards, corners, fouls, shots rolling averages) — all computable from match results, standings, and dates available on the free API.

**New features identified (audit 18 March 2026):**

- [ ] Half-time goals scored avg (home/away) — free API returns `match.score.halfTime`; CSVs have `HTHG`/`HTAG`
- [ ] Half-time form last N — rolling points from `HTR` (half-time result)
- [ ] Half-time momentum — HT form last 5 minus HT form last 10
- [ ] Yellow cards rolling avg (last 5) — CSVs have `HY`/`AY`; free API returns card data in match details
- [ ] Corners rolling avg (last 5) — CSVs have `HC`/`AC`; implement `_calculate_corners_for/against`
- [ ] Fouls rolling avg (last 5) — CSVs have `HF`/`AF`
- [ ] Shots per game rolling avg — CSVs have `HS`/`AS`; implement `_calculate_shots_per_game`
- [ ] Shot accuracy rolling avg — CSVs have `HST`/`AST`; implement `_calculate_shot_accuracy`
- [ ] Goal difference trend (rolling std of GF-GA over last 10) — derivable from scores
- [ ] Clean sheet streak (current consecutive) — derivable from scores

**Files:**

- [ ] `backend/app/features/free_tier_features.py` — `FreeTierFeatureEngineer` class (~83 features via composition over `AdvancedFeatureEngineer`)
- [ ] `backend/tests/test_free_tier_features.py` — feature unit tests (no stubs leak through, no data leakage, team name normalisation)
- [ ] `backend/train_free_tier.py` — training script (CSVs → `FreeTierFeatureEngineer` → `XGBoostPredictor` → `xgboost_free_tier.joblib`)
- [ ] `backend/tests/test_train_free_tier.py` — training integration tests (chronological split, model save/load with metadata)
- [ ] `backend/app/api/main.py` — add `POST /predict/free` + `GET /models/free-tier/info` endpoints
- [ ] `backend/tests/test_predict_free_tier.py` — API endpoint tests (response shape, validation, rate limiting)

**Logistic regression baseline:**

- [ ] Train a logistic regression model on the same free-tier features alongside XGBoost
- [ ] Compare accuracy, log loss, and feature importances between the two
- [ ] Report in training output: "XGBoost accuracy: X% vs Logistic Regression baseline: Y% (+Z% lift)"
- [ ] Keep LR as a sanity check — if XGBoost isn't beating LR by >3%, investigate feature engineering

**Evaluation metrics (beyond accuracy):**

- [ ] Log loss (already computed during training — report it)
- [ ] Brier score (average squared error of probabilities per class)
- [ ] Calibration curve (predicted probability vs actual win rate — save as PNG)
- [ ] Confusion matrix (H/D/A classification errors — print and save)
- [ ] ROI simulation (if betting on all predictions at estimated odds, what's the return?)
- [ ] Per-class AUC-ROC (one-vs-rest)

**Data quality checks (added to training script):**

- [ ] Log rows dropped by `dropna()` — flag if >2% of matches lost
- [ ] Print class distribution (H/D/A split) — flag if draws <20% or >35%
- [ ] Verify all 6 season CSVs loaded with expected row counts
- [ ] Team name consistency check across seasons (promoted/relegated mapping)

**Training data access (fifth audit):**

- [ ] `backend/spreadsheets/` is gitignored — cloning the repo does NOT include CSV training data. Either remove from `.gitignore` (data is public PL results, not sensitive) or document how to obtain it. Without these CSVs, `train_free_tier.py` cannot run

**Security (scoped to this feature):**

- [x] `.gitignore` — add `backend/.env` — DONE (line 14, confirmed present)
- [ ] Team name normalisation dict (CSV short names ↔ API canonical names)
- [ ] Input validation on `/predict/free` — team name allowlist (current PL + recent promoted/relegated)
- [ ] Rate limiting on `/predict/free` (60 req/min per IP, in-memory)
- [ ] Error response sanitisation — new endpoints return generic messages, not raw `str(exc)`
- [ ] Model integrity — validate metadata keys when loading joblib at startup

**Verification:**

```bash
cd backend
python -m pytest tests/test_free_tier_features.py -v   # Feature tests
python train_free_tier.py                                # Train model
python -m pytest tests/test_train_free_tier.py -v        # Training tests
uvicorn app.api.main:app --reload --port 8000            # Start server
curl -X POST http://localhost:8000/predict/free \
  -H "Content-Type: application/json" \
  -d '{"home_team": "Arsenal", "away_team": "Chelsea"}'  # Test endpoint
python -m pytest tests/ -v                               # All tests
```

### P3a. Real Feature Engineering

`advanced_engineering.py` — no `np.random.*` calls (was 102), but **63 methods return hardcoded `0.0`** for: advanced metrics (13), betting features (10), tactical features (10), player impact (5), external factors (7), plus contextual stubs. ~75 features compute real data from scorelines/results. Third audit corrected count from 49 to 63.

Priority features to implement with real data:
- [ ] Rolling goals scored/conceded (last 5, 10 matches) — data available from free tier
- [ ] Form streaks (W/D/L sequences) — data available
- [ ] Rest days since last match — data available
- [ ] H2H win rates — fix `get_head_to_head()` returning empty DataFrame
- [ ] xG proxies from shots data — limited by free tier
- [ ] Remove or honestly document the ~63 `return 0.0` stub methods (tactics, weather, player-level require paid data sources)

**Derby detection broken for CSV training (third audit):**

- [ ] `_is_derby_match()` uses Football-Data.org canonical names (e.g. `'Manchester United FC'`) but CSV training data uses short names (e.g. `'Man United'`). Derby detection always returns `0.0` during training from CSVs
- [ ] `_compute_league_positions()` builds cumulative all-time points rather than per-season. A team relegated in 2019 still accumulates points from the full historical dataset — wrong for multi-season training
- [ ] `warnings.filterwarnings('ignore')` at module level silences all Python warnings globally for any importing module — makes debugging harder

**Constraint:** Football-Data.org free tier does not provide xG, shots, possession, cards, corners data — ~70 features will remain stubs unless a paid data source is added.

### P3b. Data Collector Fixes

- [ ] `football_data_collector.py`: `get_head_to_head()` returns empty DataFrame (stub)
- [ ] `football_data_collector.py`: `get_team_form()` returns mixed value types — home matches return raw `'H'`/`'A'`/`'D'` codes while away matches return flipped `'W'`/`'L'`/`'D'`. Any caller checking for `'W'` misses home wins; any caller checking for `'H'` misses away wins. Should consistently return `'W'`/`'D'`/`'L'` regardless of venue
- [ ] Add retry logic to API client (currently no retries on failure)
- [ ] **`modern_oracle.py`** calls `self.data_collector.get_team_stats(team_name)` — method doesn't exist on `FootballDataCollector`. Will raise `AttributeError` at runtime
- [ ] **`modern_oracle.py`** calls `self.data_collector.get_team_form(team_name, last_n=5)` — wrong kwarg name, should be `n_matches`. Will raise `TypeError` at runtime

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
- [ ] Fix `lstm_predictor.py` + `transformer_model.py`: shallow `.copy()` on `state_dict()` — "best model" state can be mutated mid-training. Use `copy.deepcopy()` or tensor `.clone()`
- [ ] **`train.py` column rename mismatch (CRITICAL — silent training on zeros):** `train.py` renames `FTHG` → `home_score` but `AdvancedFeatureEngineer` reads `home_goals`. Every feature method querying goal history returns `0.0`. Fix: rename to `home_goals` / `away_goals` to match what the feature engineer expects. Training completes but the model learns from near-zero features without this fix.
- [ ] **`train.py` hardcoded CSV directory:** no fallback path — breaks environments that keep CSVs at a different location. Support `CSV_DIR` env override with legacy path fallback.
- [ ] **Data leakage in `modern_oracle.py`:** `optimize_ensemble_weights()` samples a validation set from `training_data` but then passes the full `training_data` (including those validation samples) to `train()`. Models train on data they're validated against. Fix: exclude validation indices from the training split before calling `train()`.
- [ ] Add pytest tests (currently 0% backend test coverage — `test_setup.py` only checks imports, no assertions)
- [ ] Fix `lstm_predictor.py`: `prepare_sequences` calls `scaler.fit_transform` on inference data — re-fits the scaler with test-time statistics instead of using the training-fitted scaler. Should be `self.scaler.transform(features)` during prediction
- [ ] Fix `transformer_model.py`: same `scaler.fit_transform` during inference bug — `prepare_data` re-fits at prediction time instead of using training scaler
- [ ] Fix `xgboost_model.py`: `_optimize_hyperparameters` passes `n_estimators` to `xgb.train()` — `xgb.train` does not accept this param (uses `num_boost_round` instead). Optuna optimisation of tree count has no effect
- [ ] Fix `modern_oracle.py`: `train_all_models` uses `training_data.sample(frac=0.2)` for validation — random split, not chronological. Leaks future match data into validation, inflating apparent accuracy
- [ ] Fix `modern_oracle.py`: `predict_match_natural_language()` calls `self.agent_executor.run()` synchronously inside an `async` method — blocks the asyncio event loop for 2–30 seconds during LLM round-trips. Use `asyncio.to_thread()` or async LangChain interface
- [ ] Fix `modern_oracle.py`: LangChain `create_react_agent` is wired with a `PromptTemplate` missing `{tools}` and `{tool_names}` variables — will cause `KeyError` or broken agent execution at runtime
- [ ] Fix `lstm_predictor.py:537-540`: synthetic `np.random.randn`/`np.random.randint` fallback training data — LSTM can "train" on noise without error, producing a meaningless model with no warning
- [ ] Fix `lstm_predictor.py` + `transformer_model.py`: `torch.load()` called without `weights_only=True` — PyTorch 2.0+ security warning for unsafe deserialisation from untrusted files
- [ ] Fix `xgboost_model.py`: `_optimize_hyperparameters()` imports `optuna` unconditionally inside the method body, bypassing the top-level `OPTUNA_AVAILABLE` guard — `ImportError` if optuna not installed
- [ ] Fix `xgboost_model.py`: `predict_single_match()` passes feature dict → DataFrame without ensuring column ordering matches `self.feature_names` — silent NaN injection or wrong-column mapping possible

### P3d. Security Layer Fixes

- [ ] `auth.py`: `SECRET_KEY` regenerated every restart (should be env var)
- [ ] `auth.py`: mock user database lookup (line 434)
- [ ] `auth.py`: brute force protection broken (per-request dict, not persistent — `AuthenticationService()` instantiated fresh each request)
- [ ] `auth.py`: Redis connection never established
- [ ] **All 3 security files** (`auth.py`, `secrets.py`, `validators.py`) are **completely unused at runtime** — not imported by `main.py` or any model. Consider removing or properly wiring them
- [ ] `main.py` bearer tokens on `/predict/natural` and `/admin/retrain` are **never verified** — any bearer string passes
- [ ] `main.py` global exception handler returns raw `str(exc)` in response body, leaking internal error details to clients (confirmed by CodeRabbit review — spec 08 §4c)
- [ ] **`main.py` WebSocket handler missing `oracle` null guard:** REST endpoints all check `if not oracle: raise HTTPException(503)` but the WebSocket handler calls `oracle.predict_match_ensemble()` without a guard. When deps are missing and `oracle` is `None`, the client gets a silent disconnect with no error message. Add null check at the top of the WebSocket handler matching the REST endpoint pattern.
- [ ] `main.py`: `response.dict()` deprecated in Pydantic v2 — should be `.model_dump()`
- [ ] `secrets.py`: Azure Key Vault imported but no provider class; hard imports `boto3`, `hvac`, `azure` with no guards — will crash on import without cloud SDKs
- [ ] `secrets.py`: `SecureConfig.__init__` requires `DATABASE_URL` which doesn't exist in the project
- [ ] `secrets.py`: audit log in-memory only
- [ ] `validators.py`: `VALID_TEAMS` has 2023/24 clubs (Burnley/Luton/Sheffield — missing Leicester/Ipswich/Southampton)
- [ ] `validators.py`: `ValidationError` raised incorrectly (will TypeError at runtime — Pydantic V2 doesn't accept bare string)
- [ ] `validators.py`: SQL blacklist blocks natural language queries containing "from" or "where"
- [ ] `lstm_predictor.py` and `transformer_model.py` have unguarded `import torch` at module level — will crash if torch not installed (handled by `modern_oracle.py` try/except, but the files themselves aren't safely importable)
- [ ] `requirements.txt` missing `torch` — LSTM and Transformer models require PyTorch but it's only in `environment.yml` (conda), not pip requirements. `pip install -r requirements.txt` produces a non-functional backend for neural network features
- [ ] `requirements.txt` includes `python-jose` (3.3.0) and `passlib` (1.7.4) — both unmaintained since 2022. Only used by dead security modules (`auth.py`). Remove from requirements or document as dead weight
- [ ] `environment.yml` specifies Python 3.11 while `requirements.txt` header claims Python 3.13 — version mismatch between the two environment specs
- [ ] `main.py` WebSocket handler: `active_websockets.remove(websocket)` will raise `ValueError` if the socket was never appended (e.g. exception occurs before `append` completes). Wrap in try/except or use a `set` with `discard()`
- [ ] `.gitignore`: `__pycache__/` directories not fully excluded — only `backend/app/api/__pycache__` is listed. Add `__pycache__/` globally. Also missing `mlruns/` (MLflow tracking directory)
- [ ] `validators.py`: SQL blacklist would reject team name "Nottingham Forest" — `'from'` is a substring of `'Forest'`. The `_contains_sql_injection` check uses substring matching (`keyword in text_lower`), not word boundary matching
- [ ] `validators.py`: `html.escape()` applied to team names breaks `&` characters — `Brighton & Hove Albion` becomes `Brighton &amp; Hove Albion`, causing team lookup mismatches if passed to ML models or API calls
- [ ] `auth.py`: HS256 used despite docstring claiming RS256 (asymmetric) — symmetric key means any holder can forge tokens
- [ ] `main.py`: CORS only allows `localhost:5173` and `localhost:4173` — no production Vercel domain listed, blocking deployed frontend from calling the backend API
- [ ] `football_data_collector.py`: `time.sleep()` in `_enforce_rate_limit()` — blocks asyncio event loop if collector is ever called from async endpoints
- [ ] `main.py`: `active_websockets.remove(websocket)` raises `ValueError` if socket was never appended (e.g. exception before `append`). Use `set.discard()` instead

### P3e. OptimizedPredictor × ML Integration

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

- [x] Remove `Math.random()` star particles in `App.svelte` — REMOVED (App rewritten)
- [x] Fix hardcoded "Tom Butler" / "tom@example.com" in `Header.svelte` — REMOVED (Header rewritten)
- [x] Fix hardcoded "3 new predictions available" in `Header.svelte` — REMOVED (Header rewritten)
- [ ] Wire or remove Header.svelte search bar (dispatches event but nothing handles it)
- [ ] Wire or remove Header.svelte profile/logout actions
- [ ] Fix `ApiSetupWizard.svelte` Step 3 single-option auto-advance
- [ ] Fix `ApiSetupWizard.svelte` double `window.location.reload()` (5s delay + button click)
- [ ] Fix `ApiSetupWizard.svelte` — no way to dismiss/close the wizard ("Skip" path)
- [ ] `StandingsTable.svelte` movement arrows need tooltip explaining they're form-based ("Based on recent form"), not actual position change

### P4b. Accessibility (spec 07: 0 of 5 ARIA requirements met)

- [ ] `role="meter"`, `aria-valuenow/min/max` on prediction probability bars
- [ ] Proper `<label>` elements on Kelly calculator inputs
- [ ] `aria-current="page"` on active nav items (already done in MobileNav/Sidebar — verify all)
- [ ] `aria-label` on theme toggle and confidence indicators
- [ ] Add `prefers-reduced-motion` media query to `app.css` (also needed for `LiveTicker.svelte` animation)
- [ ] `ApiSetupWizard.svelte` missing `role="dialog"`, `aria-modal="true"`, focus trap
- [ ] Charts (Dashboard Line, BettingHistory Bar) have no `role="img"` or `aria-label` fallback
- [ ] `LiveTicker.svelte` has no way to pause scrolling animation (WCAG 2.2.2)
- [ ] `Predictions.svelte` progress bar has no `role="progressbar"` or `aria-valuenow`
- [ ] `ChatBot.svelte` message list has no `aria-live="polite"` for new responses; input has no `<label>`; send button has no `aria-label`
- [ ] Prediction flip cards have no `aria-label` or focus indicator — keyboard users can't tell when selected; screen readers read both sides simultaneously (no `aria-hidden` on non-visible face)
- [ ] Win/loss indicators use colour only (green/red) — add icons for colourblind users (WCAG 1.4.1)
- [ ] `LiveMatches.svelte` tab buttons lack `role="tab"` / `role="tabpanel"` / `aria-selected` pattern
- [ ] `Settings.svelte` API key input has `placeholder` but `<label>` lacks `for` attribute; favourite team `<select>` has no `<label>`
- [ ] `StandingsTable.svelte` table has no `<caption>` or `aria-label`; column headers use abbreviations without `<abbr>` or `title`
- [ ] `BettingHistory.svelte` table has no `<caption>`; filter `<select>` has no `<label>`
- [ ] `Help.svelte` nav sections have no `aria-current` or `aria-selected`; mobile menu button lacks `aria-expanded`
- [ ] `Sidebar.svelte` and `MobileNav.svelte` lack focus trapping when open on mobile — focus can escape behind the backdrop
- [ ] `Predictions.svelte:658` card close `×` button has no `aria-label` — screen readers will read "times" or nothing
- [ ] `SeasonStats.svelte` stat cards have `cursor-pointer` styling with no click handler, `tabindex`, or keyboard support — misleading to keyboard/AT users
- [ ] `KellyCalculator.svelte` results panel has no `aria-live` — won't be announced when calculation updates
- [ ] `ValueBets.svelte` scan results have no `aria-live` region
- [ ] `LiveTicker.svelte` has no `role="marquee"` or `aria-live` — screen readers treat as static text; no pause control fails WCAG 2.2.2
- [ ] `TopScorers.svelte` uses `<div class="grid">` instead of semantic `<table>` — no `aria-sort` or column headers
- [ ] `MatchList.svelte` sort buttons have no `aria-pressed` to indicate active sort
- [ ] `Predictions.svelte` flip-card "Tap for Analysis" buttons lack `aria-label` with match context
- [ ] `App.svelte` `<main>` element has no `aria-label` for landmark name
- [ ] `BettingHistory.svelte` filter `<select>` has no `<label>` element

### P4c. Component Data Accuracy Cleanup

- [x] `LiveMatches.svelte`: "Auto-refreshing every 30 seconds" label — FIXED (now shows actual interval)
- [ ] `LiveTicker.svelte`: live dot detection uses `startsWith('football emoji')` heuristic — use boolean flag
- [ ] `Settings.svelte`: `cacheSize` computation measures `localStorage` only, not IndexedDB — significantly underestimates actual storage use
- [ ] `Settings.svelte`: `plTeams` array hardcoded for 2024-25 season — needs updating each season
- [x] ~~`SeasonStats.svelte`: "Did you know? These statistics are updated in real-time"~~ **FIXED:** changed to "refreshed each time you visit this page"
- [x] ~~`SeasonStats.svelte`: no error state in template~~ **FIXED:** added `error` state variable, error message in catch block, and `{:else if error}` template block with AlertTriangle icon
- [ ] `MatchList.svelte:12`: `selectedSeason = '2024-2025'` hardcoded fallback — will go stale each season
- [x] `Settings.svelte`: "Connected" status without real API ping — FIXED (now calls `testConnection()` on mount)
- [ ] `Help.svelte:101`: "📊 Live Standings" describes Dashboard — but Dashboard doesn't show standings (that's `StandingsTable.svelte`)
- [ ] `Help.svelte:489`: FAQ "The app caches recent data for offline viewing" — overstates capability; IndexedDB expires and there is no Service Worker
- [ ] `Help.svelte:295`: "75-85% accuracy when all models agree" — fabricated, never validated against backtest data
- [ ] `ApiSetupWizard.svelte:284`: "AI-powered predictions" listed as a Football-Data.org feature — misleading (AI is from OpenAI via ChatBot, not the data source)
- [ ] `ApiSetupWizard.svelte`: Step 3 "Choose Provider" has only one hardcoded option — dead step, should auto-advance or be removed
- [ ] `StandingsTable.svelte`: `getMovementIcon` only renders arrows for top 5 positions — rest of the table shows no movement indicator, creating visual inconsistency
- [ ] `Predictions.svelte:198`: `estimatedBookmakerOdds = (1 / topProb) * 1.05` creates circular Kelly recommendation — model is both the predictor and the bookmaker; Kelly stake will almost always be near zero
- [ ] `ApiSetupWizard.svelte:430`: `⏳` emoji inside `animate-spin` span does not actually spin (emoji aren't CSS-transformable)
- [x] ~~`LiveMatches.svelte:98`: `sevenDaysFromNow = subDays(now, -7)`~~ **FIXED:** replaced with `addDays(now, 7)`
- [ ] `Settings.svelte:84`: `window.location.reload()` after API connection — hard page reload discards all app state; a targeted refresh would be better
- [x] ~~`BettingHistory.svelte`: `DollarSign` icon used throughout for GBP values~~ **FIXED:** replaced with `PoundSterling` icon
- [x] ~~`BettingHistory.svelte`: redundant double `loadBettingHistory()` call~~ **FIXED:** removed `onMount` wrapper — single module-scope call is sufficient for synchronous localStorage reads. Also removed now-unused `onMount` import
- [ ] `BettingHistory.svelte`: loading spinner never renders — `loading = true` wraps synchronous localStorage code that completes before the DOM can repaint, so `{#if loading}` skeleton block is invisible (fifth audit)
- [x] ~~`MatchList.svelte:23-29`: `loadSeasons()` has no try/catch~~ **FIXED:** wrapped in try/catch with console.warn and user-facing error message
- [ ] `Settings.svelte:75-86` and `ApiSetupWizard.svelte:61-71`: artificial 5-second delay before `clearCache()` + `window.location.reload()`. The 5s wait serves no purpose — the cache clear is instant (fifth audit)

### P4d. betBuilder Improvements

- [x] Fix `checkRivalry()` to match API canonical team names — done (normalise + 10 rivalries)
- [x] Expand rivalry list beyond 6 hardcoded entries — done (10 entries)
- [x] Combo confidence derived from selection probabilities — DONE
- [x] `bothCleanSheets: { prediction: false }` unconditional — FIXED (now uses threshold)
- [x] Win-to-nil probability hardcoded 0.30 — FIXED (now derived from favProb × favCleanSheet)
- [ ] Replace `avgCorners: 9.5` and `expectedCards: 3.2` with league averages from match data (free tier has CSV data for these)
- [ ] Market correlation in combo probability (e.g. clean sheet + over 2.5 negatively correlated)
- [ ] `'Over 1.5 first half goals'` probability hardcoded as `0.35`
- [ ] Rivalry list includes Championship teams (West Brom, Birmingham City, Sunderland) that will never appear in PL API data — dead entries

**Plan correction (third audit):** `checkRivalry()` now works correctly via `normaliseTeamName()` which strips `FC`/`AFC`/`CF` suffixes. The previously documented "short names never match API names" issue is resolved.

### P4e. CSS & Theme Polish

- [ ] Some raw hex values in `app.css` not using CSS design tokens
- [ ] Team theme CSS variables exist (20 PL clubs) but integration unclear
- [ ] `Dashboard.svelte` chart border colours hardcoded as hex (`'#4299e1'`, `'#10b981'`) — won't track dark/light theme
- [ ] `BettingHistory.svelte` chart CSS variables passed to Chart.js at creation time, not reactively — won't update on theme change without chart re-creation
- [ ] `Sidebar.svelte` has inline `style` with `rgba(0, 255, 135, 0.15)` rather than Tailwind/CSS variable
- [ ] `Predictions.svelte` progress bar uses hardcoded hex `from-[#00cc6a] to-[#00ff87]`
- [ ] `LiveTicker.svelte` live dot uses hardcoded `background: #ef4444`
- [ ] `Dashboard.svelte` hero section is always dark regardless of theme (intentional? or should adapt)
- [x] ~~`tailwind.config.js` declares custom fonts `Figtree` and `Outfit` in `fontFamily` but no Google Fonts import or self-hosted font assets exist~~ **CORRECTED (fifth audit):** `index.html` properly loads both Figtree and Outfit via Google Fonts with lazy-load pattern + `<noscript>` fallback. Fonts are working correctly
- [ ] `tailwind.config.js` uses CommonJS `require('@tailwindcss/forms')` in an ESM `export default` context — inconsistent module style

### P4f. Dead Imports & Code Duplication

- [x] `Predictions.svelte`: remove dead imports `Database`, `Clock` — DONE
- [x] `SeasonStats.svelte`: remove unused `animatedValue` tweened store — DONE
- [x] ~~`StandingsTable.svelte`: remove dead imports `TrendingUp`, `TrendingDown`, `fade`~~ **DONE**
- [x] ~~`TopScorers.svelte`: remove dead imports `Target`, `User`~~ **DONE**
- [x] ~~`Settings.svelte`: remove dead imports `Sparkles`, `Key`~~ **DONE**
- [x] ~~`ApiSetupWizard.svelte`: remove dead import `Sparkles`~~ **DONE**; clean up stale test comments
- [x] ~~`MatchList.svelte`: remove dead imports `Check`, `Calendar`~~ **DONE**
- [x] ~~`BettingHistory.svelte`: remove dead `<style global>` block (6 unreferenced CSS classes)~~ **DONE**
- [ ] Extract `getSeasonLabel()` to shared utility — duplicated in StandingsTable, TopScorers, SeasonStats
- [ ] `footballData.ts`: `getTeamSquad()`, `getPlayer()`, `getTeam()`, `getRecentResults()` are never called — remove or keep for future use
- [ ] `dataService.ts`: `getStatus()` and `getDataSourceStatus()` are never called — remove dead methods
- [ ] `dataService.ts`: `refreshApiConfiguration` is a stub alias for `checkDataSources` — should call `refreshDataSources` instead
- [ ] `predictions.ts`: entire module is dead at runtime — zero imports from any component. Has 11 tests but produces no output in production. Consider deprecating or removing
- [ ] `kelly.ts`: multiple dead exports — `decimalToFractional`, `requiredWinRate`, `calculateMultiple`, `calculateArbitrage`, `detectArbitrage`, `formatPercentage`, `breakEvenOdds` are never called. `getRiskLevel` ignores its `kellyFraction` and `edge` parameters
- [ ] `value.ts`: `OddsProvider` interface defined but never implemented; `calculateCLV` always returns `betId: ''`
- [ ] `advancedPredictions.ts`: `ExpectedGoalsCalculator` class permanently returns `{homeXG: 0, awayXG: 0}` (no shots data on free tier). `AdvancedMatchPredictor.predictMatch` is never called at runtime (only tested)
- [ ] `advancedPredictions.ts`: `dataService.getMatches()` called 3× per prediction — once in `FatigueAnalyzer` and twice in `predictMatch`. Fetch once at the start of `predictMatch` and pass the array to helper methods.
- [ ] `advancedPredictions.ts`: two `updateRatings` methods (instance + static) with slightly different signatures — maintenance risk
- [ ] Extract `VALUE_ODDS_MARGIN = 1.05` to shared constant — duplicated in `advancedPredictions.ts`, `optimizedPredictions.ts`, `backtest.ts`
- [ ] Extract `LEAGUE_AVG_HOME_WIN_RATE = 0.46` to shared constant — duplicated in `optimizedPredictions.ts` and `advancedPredictions.ts`
- [ ] `predictionTracker.ts`: `resultAccuracy` is identical to `accuracy` in `getAccuracyStats` — redundant field
- [ ] ~~`advancedPredictions.ts`: `AdvancedMatchPredictor.predictMatch` is never called at runtime~~ **CORRECTED (third audit):** `AdvancedMatchPredictor.predictMatch` IS called at runtime by `value.ts:72` for value bet scanning. Not dead code. Remove from dead code list
- [ ] `advancedPredictions.ts`: `ExpectedGoalsCalculator.calculateShotValue` is never called anywhere in the codebase — dead code
- [ ] `advancedPredictions.ts`: `FatigueAnalyzer.calculateFixtureDifficulty` not called by production code — only `calculateRestDays` is used by `OptimizedPredictor`
- [ ] `optimizedPredictions.ts`: `formString` function has unused `team` parameter — declared but never read inside the function body
- [ ] `dataService.ts`: `getCurrentSeasonMatches()` is an alias for `getMatches()` — never called by any component. `getTeamRecentMatches()` also never called
- [ ] `predictionTracker.ts`: `exportPredictions()` and `importPredictions()` have no UI surface — dead functionality from a user perspective (tests-only)
- [ ] `BettingHistory.svelte`: `loadBettingHistory()` called twice on startup — once at module scope (line 169) and once inside `onMount` (line 173). Both synchronous, so harmless but redundant
- [x] ~~`Help.svelte`: dead import `fly` from `svelte/transition`~~ **DONE**
- [ ] `value.ts`: `calculateCLV`, `findArbitrage`, `calculateSharpeRatio`, `calculatePerformanceMetrics` — 4 static methods never called from any component
- [ ] `dataService.ts`: additional dead public methods beyond already-listed: `getPredictionAccuracy()`, `setCacheTimeout()`, `disableCache()`, `enableCache()`, `refreshDataSources()` — none called from any component
- [ ] `footballData.ts:383`: `|| null` on odds fields instead of `?? null` — semantically wrong for `0` values (harmless in practice since odds can't be 0)
- [ ] `ApiSetupWizard.svelte`: commented-out debug notes at lines 33, 44, 52–53 — stale test comments to clean up
- [ ] `optimizedPredictions.ts`: `form: '?????' ` field in `getEnhancedTeamStats()` fallback is dead output — never read by anything
- [ ] `optimizedPredictions.ts`: `analyzeRecentForm()` inner `calculateFormScore(form, isHome)` has unused `isHome` parameter — vestigial
- [ ] `optimizedPredictions.ts`: `getTopOutcome()` duplicates `determinePrediction()` logic — one is redundant
- [ ] `footballData.ts`: `getRecentResults()` is an unused duplicate of `getRecentMatches()` — never imported outside tests
- [ ] `footballData.ts`: `getTeamByName()`, `getHeadToHead()`, exported types `FDSquadMember`, `FDPlayer`, `FootballDataConfig` — all dead (never imported outside this file)
- [ ] `MatchList.svelte`: season selector UI is fetched (`loadSeasons()`) but has no `<select>` in the template — dead code path
- [ ] `value.ts`: `calculateSharpeRatio()` divides by zero silently for empty arrays — returns `NaN`
- [ ] `value.ts`: `calculatePerformanceMetrics()` divides by `totalBets`/`totalStaked` with no guard for empty input — returns `NaN` across all fields
- [ ] `predictions.ts`: `TeamStats` and `TeamForm` interfaces shadow same-named types in `types/index.ts` with incompatible field names — naming collision (harmless since module is dead)
- [x] ~~`Dashboard.svelte:37`: `predictionAccuracy: number[]` declared but never assigned or used in template~~ **DONE**
- [x] ~~`KellyCalculator.svelte:38`: `showSuggestions = true` declared but never toggled or read in template~~ **DONE**
- [x] ~~`Settings.svelte`: dead imports `Sparkles` and `Key` from lucide-svelte~~ **DONE**
- [ ] `advancedPredictions.ts`: `calculateFixtureDifficulty` creates a second `EloRatingSystem` instance when no `eloSystem` is passed — diverges from singleton pattern, reads localStorage independently
- [ ] `BettingHistory.svelte`: `<style global>` defines 5 CSS classes (`.shadow-glow-success-sm`, `.shadow-glow-success-md`, `.shadow-glow-error-sm`, `.shadow-glow-error-md`, `.th`, `.td`) never referenced in template

### P4h. Test Quality Improvements — NEW (19 March 2026)

Test suite has 364 passing tests but several are structurally unable to catch regressions:

**Conditional assertions that silently pass without asserting:**

- [x] ~~`value.test.ts` — 6 assertion blocks wrapped in `if (homeBet)` / `if (awayBet)` / `if (result.length > 0)` guards~~ **FIXED:** All 9 conditional blocks converted to unconditional `expect(x).toBeDefined()` guards. Sorting test updated to produce multiple value bets (1X2 + goals markets) so sorting is actually exercised
- [ ] `kelly.test.ts:240` — arbitrage stakes assertions guarded by `if (result.isArbitrage)`. If detection is broken, test trivially passes

**Tautological tests that cannot fail:**

- [x] ~~`types.test.ts` — 16 tests assert `expect(x.field).toBe(value)` where `value` is what was just assigned~~ **FIXED:** Reduced from 18 tests to 4 — kept only consistency validation tests (home+away=total, points formula, goal difference formula, form string regex). Removed 14 tautological tests that TypeScript already guarantees
- [ ] `footballData.test.ts` — "Data Transformation" describe block re-implements result-determination and team-name-normalisation logic inline instead of testing the actual `FootballDataAPI` functions. Would pass even if `transformMatch` were deleted

**Tests that can never fail:**

- [ ] `dataService.test.ts:190-200` — error test wraps assertion in `try/catch` that accepts both `[]` return and thrown error — passes regardless of implementation behaviour

**Other quality issues:**

- [ ] `predictions.test.ts` — 11 tests exercise the entirely dead `predictions.ts` module. Gives false confidence that a model is tested which is never used in production
- [ ] `backtest.test.ts` — ELO snapshot/restore logic is entirely mocked out — a real rollback bug would not be caught
- [ ] Component tests bypass `onMount` via `(component as any).refresh()` — fragile if internal methods renamed; does not verify the component lifecycle actually triggers data loads

**Tests encoding known bugs as correct (fifth audit):**

- [x] ~~`backtest.test.ts:156-174` — encodes Kelly 1.05 inflation bug~~ — **No longer applicable.** The P1l Kelly fix changed `KellyCalculator.loadSuggestions()` to use `prediction.confidence` as `ourProbability` (not derive it from odds). `backtest.ts:extractProbabilities()` is a separate codepath that correctly reverses the `VALUE_ODDS_MARGIN = 1.05` to recover the model's true probability. The test at 0.525 remains correct for backtesting purposes
- [ ] `advancedPredictions.test.ts:544-549` — value bet assertion wrapped in `if (prediction.valueBets.length > 0)` guard. If value bet detection breaks to return empty arrays, the test passes silently with zero assertions

### P4g. Documentation Cleanup — NEW (18 March 2026)

Stale documentation and broken links discovered in the 8-agent audit:

- [ ] `README.md`: version badge says `v2.0` (should be v3.0); install instructions wrong (`npm install` at root — should be `cd frontend && npm install`); dead links to `docs/` directory; stale "Future Enhancements" lists dark mode and IndexedDB as future (both implemented); omits Python backend entirely
- [ ] `backend/README.md`: broken links to `JUPYTER_GUIDE.md` and `TRAINING_GUIDE.md` (both deleted on v2.0-Development branch)
- [ ] `backend/docs/FOR_BEGINNERS.md`: broken links to `tutorials/01_first_prediction.py` etc. (directory doesn't exist); claims "68-72% accuracy" for untrained models
- [ ] `specs/01-prediction-engine.md`: claims `backtest.ts` doesn't exist (it does, created P2f)
- [ ] `specs/03-backend-integration.md`: top note says backend won't start due to broken imports (P0a fixed this)
- [ ] `specs/07-ui-ux.md`: says shadcn not initialised (it is — `components.json` exists); dark mode fix described as needed (done in P1b)
- [ ] `specs/02-data-pipeline.md`: Supabase removal checklist items all done but still unchecked
- [x] `.gitignore`: `backend/.env` — DONE (confirmed present on line 14)
- [ ] `frontend/package.json`: version is `0.0.0` — should reflect project version (git tags at `v0.0.7`, project is v3.0)
- [ ] No `backend/.dockerignore` — test files, docs, spreadsheets (~100MB+ CSVs), and `chroma_db/` all included in Docker build context unnecessarily
- [ ] `README.md`: clone URL uses `yourusername` placeholder instead of `ThomasJButler`
- [ ] `README.md`: "Recent Updates (v2.0)" section describes already-implemented features; "Future Enhancements" lists dark mode and Kelly calculator as future (both done)

---

## Specs

All feature specifications in `specs/`:

| File | Topic | Implementation Status |
|------|-------|-----------------------|
| `specs/01-prediction-engine.md` | ELO, Poisson, fatigue, referee, confidence, backtesting | ~65% — ELO dynamic + persistence + auto-update wired (P2k DONE), Poisson Dixon-Coles, fatigue wired, referee adjustments, backtest runner created (P2f DONE); no AI analysis (P3g), confidence calibration rudimentary |
| `specs/02-data-pipeline.md` | Football-Data.org integration, caching, historical data | ~55% — DataService + 3-tier cache work; getLiveMatches/getHistoricalMatches/getTeamRecentMatches all implemented; missing progressive 5-season bulk loader with rate limiting |
| `specs/03-backend-integration.md` | Python ML backend connection | **0%** — 0 of 8 acceptance criteria met |
| `specs/04-betting-intelligence.md` | Kelly, value bets, bet history, accumulators | ~70% — Kelly + auto-suggestions done (P2g), CLV corrected, betBuilder fixed (probability overflow clamped P1l), ValueBets UI created (P2i); Kelly circular probability bug fixed (P1l); bet storage pipeline wired (P1i — KellyCalculator + ValueBets → betHistoryService → BettingHistory); betHistoryService resolution bugs fixed (P1g) |
| `specs/05-live-data.md` | Live scores, smart polling, WebSocket | ~65% — smart polling + LiveMatches working; no liveService.ts, no WebSocket, no shared store |
| `specs/06-prediction-tracking.md` | Accuracy tracking, auto-reconciliation | ~95% — substantially complete |
| `specs/07-ui-ux.md` | shadcn-svelte migration, dark mode, accessibility | ~20% — dark mode fixed (P1b), 5 components installed (1 wired), components.json created, `$lib/utils.ts` created (P2a-fix DONE), 0/5 ARIA requirements met |
| `specs/08-backend-training.md` | Backend training pipeline (free-tier + Pro-tier) | **P3-Free: 0%** — spec written, implementation not started. Pro-tier (P3a–P3g) deferred |

---

## Active Stubs (known hardcoded values remaining)

### Frontend

| Location | Problem | Priority |
|----------|---------|----------|
| `advancedPredictions.ts` | `avgPenalties: 0.2` — no penalty data from free API tier | Low |
| `advancedPredictions.ts` | `SEED_RATINGS` — 25 teams with manually assigned ELO, not backcalculated | Low |
| `advancedPredictions.ts` | `ratingReliability = 0.8` — constant, should reflect actual model accuracy | Low |
| `advancedPredictions.ts` | `ExpectedGoalsCalculator.calculateMatchXG` — always returns `{homeXG: 0, awayXG: 0}` (no shots data from free tier) | Low |
| `advancedPredictions.ts` | `HOME_ADVANTAGE = 65` ELO points — static, should vary by team | Low |
| `advancedPredictions.ts` | Default referee stats (`avgYellowCards: 4, avgRedCards: 0.1, homeWinRate: 0.46`) — should be derived from match data | Low |
| `optimizedPredictions.ts` | `MODEL_WEIGHTS` — static ensemble weights, not derived from backtesting | Low |
| `optimizedPredictions.ts` | `LEAGUE_AVG_HOME_WIN_RATE = 0.46` — hardcoded, should be derived from completed matches | Low |
| `optimizedPredictions.ts` | `eloDrawProb = 0.265 * Math.exp(-ratingDiffAbs / 600)` — base 26.5% and scale 600 hardcoded | Low |
| `optimizedPredictions.ts` | Form weight array `[0.35, 0.25, 0.20, 0.12, 0.08]` — arbitrary decay, not empirically derived | Low |
| `optimizedPredictions.ts` | `homeMomentum * 1.1` / `awayMomentum * 0.9` — arbitrary 10% home advantage in form | Low |
| `optimizedPredictions.ts` | `calculateFatigueFactor` step function — discrete tiers with no empirical basis | Low |
| `optimizedPredictions.ts` | Confidence boost/penalty thresholds and values — all hardcoded | Low |
| `optimizedPredictions.ts` | Fallback prediction returns `{result: 'D', confidence: 0.33, goals: 1-1, odds: 3.0/3.3/3.0}` — completely static | Low |
| `optimizedPredictions.ts` | `getStandingsProbabilities` — `0.025` per position-difference step is arbitrary | Low |
| `betBuilder.ts` | `avgCorners: 9.5` — no corner data from free tier | P4d |
| `betBuilder.ts` | `expectedCards: 3.2` — no card data from free tier | P4d |
| `betBuilder.ts` | `'Over 1.5 first half goals'` probability hardcoded as `0.35` | P4d |
| `betBuilder.ts` | `ftBias = 0.4` — HT-FT correlation arbitrarily set at 40% | Low |
| `betBuilder.ts` | `homeCleanSheet` prediction threshold 0.3 — no empirical basis | Low |
| `ChatBot.svelte` | Model hardcoded as `gpt-4o-mini` | Low |
| `Predictions.svelte` | `estimatedBookmakerOdds = (1 / topProb) * 1.05` — fabricated margin | Low |
| `Predictions.svelte` | 300ms artificial delay in `predictGameweek` — cosmetic fake loading | Low |
| `value.ts` | `calculateCLV` returns `betId: ''` (stub) | Low |
| `value.ts` | `MIN_CONFIDENCE = 0.55` — filters out most draw/away predictions | Low |
| `kelly.ts` | `Math.random()` in `simulate()` — non-deterministic Monte Carlo | Low |
| `StandingsTable.svelte` | Position movement from form wins (fake proxy) | P4c |
| `Settings.svelte` | `plTeams` array hardcoded for 2024-25 season | P4c |
| `predictions.ts` | `WEIGHTS` object uses different model architecture from production — entire file is dead code at runtime | P4f |
| `Predictions.svelte` | `was_correct: false` hardcoded when storing predictions — never reflects actual outcome | P1k |
| `Predictions.svelte` | `totalGameweeks = 38` hardcoded — never updated from API season data | P1k |
| `MatchList.svelte` | `selectedSeason = '2024-2025'` hardcoded fallback — stale each season | P4c |
| ~~`betHistoryService.ts`~~ | ~~`storeBet()` never called~~ — FIXED: wired into KellyCalculator + ValueBets via "Track Bet" buttons | ~~P1i~~ |
| ~~`betBuilder.ts`~~ | ~~Corner/card probabilities can exceed 1.0~~ — FIXED: clamped to [0, 0.99] | ~~P1l~~ |
| ~~`KellyCalculator.svelte`~~ | ~~`prob = 1.05 / odds` inflates probability~~ — FIXED: uses model confidence as ourProbability | ~~P1l~~ |
| ~~`footballData.ts`~~ | ~~`halfTimeResult` bug: `!0 === true`~~ — FIXED: explicit null/undefined check | ~~P1l~~ |
| `advancedPredictions.ts` | `SEED_RATINGS` includes relegated teams (Leicester, Leeds, Luton, Burnley, Sheff Utd) and Sunderland (not in PL) | Low |
| `advancedPredictions.ts` | Two parallel fatigue models with different thresholds (AdvancedMatchPredictor vs OptimizedPredictor) | P2q |
| `dataService.ts` | Cache TTL comments lie about actual TTL (claim 24h/30m, deliver 5m) | P1m |
| `dataService.ts` | `getTeamForm` cache key uses `matches.length` not content — stale data on same-length arrays | P1p |
| `advanced_engineering.py` | `0.45` fallback win rate when no match data — hardcoded league average | Low |

### Backend

| Location | Problem | Priority |
|----------|---------|----------|
| `advanced_engineering.py` | 63 methods return `0.0` (tactics, players, betting, weather, advanced — was 49, corrected in third audit) | P3a |
| `football_data_collector.py` | `get_head_to_head()` returns empty DataFrame | P3b |
| `football_data_collector.py` | `get_team_form()` confusing result-flip logic | P3b |
| `lstm_predictor.py` | `get_feature_importance()` returns `np.random.random()` | P3c |
| `modern_oracle.py` | `optimize_ensemble_weights()` returns `np.random.random()` | P3c |
| `modern_oracle.py` | `_calculate_betting_value()` uses mock odds | P3c |
| `modern_oracle.py` | Calls non-existent `data_collector.get_team_stats()` | P3b |
| `modern_oracle.py` | Wrong kwarg `last_n=5` (should be `n_matches`) | P3b |
| `modern_oracle.py` | LSTM sequence is 10× duplicate single row (meaningless time series) | P3c |
| `transformer_model.py` | Save/load only saves 2 of 8 constructor params | P3c |
| `transformer_model.py` | `val_accuracy` UnboundLocalError | P3c |
| `transformer_model.py` | `num_decoder_layers` silently ignored | P3c |
| `lstm/transformer_model.py` | Shallow `.copy()` on `state_dict()` — best model state mutable | P3c |
| `auth.py` | `SECRET_KEY` regenerated every restart | P3d |
| `auth.py` | Mock user database lookup | P3d |
| `auth.py` | Brute force protection broken (per-request dict) | P3d |
| `auth.py` | Entirely unused at runtime — not imported by main.py | P3d |
| `secrets.py` | Hard imports cloud SDKs (boto3, hvac, azure) — crash without them | P3d |
| `secrets.py` | Requires DATABASE_URL which doesn't exist | P3d |
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
| `main.py` | `/features/importance` doesn't guard against None LSTM/Transformer | P3c |
| `lstm_predictor.py` | `prepare_sequences` calls `scaler.fit_transform` on inference data — should use `transform` only | P3c |
| `transformer_model.py` | Same `scaler.fit_transform` during inference bug | P3c |
| `xgboost_model.py` | `_optimize_hyperparameters` passes `n_estimators` to `xgb.train` — ignored (should be `num_boost_round`) | P3c |
| `modern_oracle.py` | `train_all_models` uses random val split — data leakage from future matches into validation | P3c |
| `football_data_collector.py` | `get_team_form()` returns mixed `'H'`/`'A'` and `'W'`/`'L'` values — inconsistent form codes | P3b |
| `requirements.txt` | Missing `torch` — LSTM/Transformer non-functional via pip install | P3d |
| `requirements.txt` | `python-jose` + `passlib` unmaintained since 2022 — dead security module deps | P3d |
| `lstm_predictor.py` | Synthetic `np.random` training data fallback — trains on noise without error | P2s |
| `modern_oracle.py` | LangChain ReAct prompt missing `{tools}`/`{tool_names}` — broken agent execution | P3c |
| `modern_oracle.py` | Blocking `agent_executor.run()` in async method — freezes event loop | P3c |
| `advanced_engineering.py` | `_is_derby_match()` uses API names but CSVs have short names — always returns `0.0` during training | P3a |
| `advanced_engineering.py` | `_compute_league_positions()` cumulative all-time, not per-season — wrong for multi-season | P3a |
| `validators.py` | `html.escape()` corrupts `Brighton & Hove Albion` to `Brighton &amp; Hove Albion` | P3d |
| `requirements.txt` | `boto3`, `hvac`, `azure-*`, `sqlalchemy` — heavy dead deps for unused security modules | P2r |
| `main.py` | `/standings` endpoint returns `pd.DataFrame` — not JSON-serialisable, will `TypeError` at runtime | P1o |
| `requirements.txt` | `passlib==1.7.4` incompatible with Python 3.13 (`crypt` module removed from stdlib) | P2r |
| `requirements.txt` | Missing `langchain-community` — `modern_oracle.py` imports it but package not listed | P2r |
| `requirements.txt` | Missing `bcrypt` — `auth.py` passlib bcrypt backend requires it | P2r |
| `main.py` | `/features/importance` accesses `oracle.lstm_model.model` without None guard — `AttributeError` when torch missing | P2r |
| `main.py` | `total_features` in `/features/importance` hardcoded to `150`, not dynamically counted | Low |
| `football_data_collector.py` | `get_standings()` returns `pd.DataFrame` — must be converted before JSON response | P1o |

---

## CSV Training Data (available in `backend/spreadsheets/`)

**2,191 completed matches across 5.75 seasons** in `KnowledgeFilesCSV/`:
- EPL 2020/21 through 2025/26 (partial) — 380 matches per full season
- **Rich column set**: shots (`HS`/`AS`/`HST`/`AST`), fouls (`HF`/`AF`), corners (`HC`/`AC`), cards (`HY`/`AY`/`HR`/`AR`), referee, half-time scores, plus ~80 bookmaker odds columns
- These CSVs contain data the free API does **not** provide — making them the primary source for training the ML backend
- `fact_player_stats.csv` — 3,638 player records with goals, assists, xG, per-90 metrics

**Training/inference feature mismatch**: The CSVs have shots, corners, cards, and odds data. At inference time (predicting future matches), the free Football-Data.org API does not return these fields. Features trained on CSV-only columns will receive nulls at inference. The `FreeTierFeatureEngineer` (P3-Free) must document which features are training-only vs available at inference.

---

## Test Coverage Summary

### Frontend (Vitest)

| File | Tests | Status |
|------|-------|--------|
| `betBuilder.test.ts` | 40 | Passing |
| `value.test.ts` | 38 | Passing |
| `advancedPredictions.test.ts` | 28 | Passing |
| `betHistoryService.test.ts` | 27 | Passing |
| `footballData.test.ts` | 26 | Passing |
| `kelly.test.ts` | 20 | Passing |
| `types.test.ts` | 18 | Passing |
| `predictionTracker.test.ts` | 18 | Passing |
| `ChatBot.test.ts` | 18 | Passing |
| `Predictions.test.ts` | 17 | Passing |
| `BettingHistory.test.ts` | 15 | Passing |
| `KellyCalculator.test.ts` | 15 | Passing |
| `backtest.test.ts` | 15 | Passing |
| `Dashboard.test.ts` | 12 | Passing |
| `optimizedPredictions.test.ts` | 12 | Passing |
| `ValueBets.test.ts` | 12 | Passing |
| `dataService.cache.test.ts` | 11 | Passing |
| `predictions.test.ts` | 11 | Passing |
| `dataService.test.ts` | 10 | Passing |
| `Settings.test.ts` | 8 | Passing |
| `LiveMatches.test.ts` | 7 | Passing |
| **Total** | **378** | **All passing** |

**Known test quality issues:**
- `types.test.ts`: 18 tests validate the dead `Prediction` type interface with trivial `expect(x).toBe(x)` assertions
- `dataService.test.ts`: "should return empty array on error" test can never fail (try/catch passes both ways)
- `footballData.test.ts`: normalisation test re-implements logic inline instead of testing the actual function
- Component tests using `(component as any).refresh()` bypass `onMount` — fragile if internal methods renamed
- `dashboard.spec.ts` E2E uses `click({ force: true })` to bypass mobile nav overlap — hides a real layout bug
- `value.test.ts`: 3 warning tests wrap assertions in `if (homeBet)` guards — silently pass without asserting if no value bet is identified
- `predictions.test.ts`: form trend test replicates the algorithm inline rather than testing the actual `analyzeFormTrend` function (not exported) — cannot detect bugs in the real implementation
- `backtest.test.ts`: ELO snapshot/restore logic is entirely mocked out — a real rollback bug would not be caught by any test
- ~~`betBuilder.test.ts`: rivalry tests pass because they use hardcoded team names, not API names — production rivalry detection may be dead code since the API returns different name formats~~ **CORRECTED (third audit):** rivalry check now works correctly via `normaliseTeamName()`. Tests are valid.
- `ValueBets.test.ts`: the core user action (entering odds + clicking Scan) is acknowledged as too hard to test in jsdom and skipped entirely
- ~~`value.test.ts`: 6 conditional assertions wrapped in `if` guards~~ **FIXED (P4h)**
- `kelly.test.ts:240`: arbitrage assertions guarded by `if (result.isArbitrage)` — trivially passes if detection broken
- `types.test.ts`: 16 tautological tests that assert `x.field === value` where `value` was just assigned — cannot fail
- `dataService.test.ts:190-200`: error test uses try/catch that passes regardless of implementation behaviour
- `footballData.test.ts`: "Data Transformation" block re-implements logic inline rather than testing actual functions

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

**0% coverage. No real tests exist.** (`test_setup.py` only checks imports — no assertions.)

---

## Services Still To Create

| File | Purpose | Priority |
|------|---------|----------|
| `frontend/src/services/backendService.ts` | Frontend-backend bridge | P2b |
| `frontend/src/services/liveService.ts` | WebSocket live data | P3f |
| `frontend/src/services/aiAnalysis.ts` | AI match analysis | P3g |
| `backend/app/features/free_tier_features.py` | Free-tier feature engineer (~83 features) | P3-Free |
| `backend/train_free_tier.py` | Free-tier training pipeline | P3-Free |
| `backend/tests/test_free_tier_*.py` | Free-tier tests (features, training, API) | P3-Free |
