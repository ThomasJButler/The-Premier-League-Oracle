# Premier League Oracle — Implementation Plan

Last updated: 18 March 2026 (Settings API status verification)
Active branch: `v3.0-BackendMLTraining`

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

### P0a. Fix Backend Startup — DONE (17 March 2026)

All imports now guarded with try/except and availability flags. Server starts gracefully with warnings when optional deps are missing.

- [x] `modern_oracle.py`: `optuna`, `sklearn`, `joblib`, `redis` wrapped in try/except with `*_AVAILABLE` flags
- [x] `modern_oracle.py`: LangChain imports were already guarded (non-fatal); added `LANGCHAIN_AVAILABLE` check before `_setup_langchain`
- [x] `modern_oracle.py`: ChromaDB already migrated to `PersistentClient()` and guarded
- [x] `modern_oracle.py`: `XGBoostPredictor`, `AdvancedFeatureEngineer`, `FootballDataCollector` imports now guarded
- [x] `xgboost_model.py`: `shap` and `joblib` wrapped in try/except with `SHAP_AVAILABLE` / `JOBLIB_AVAILABLE` flags
- [x] `main.py`: lifespan null-checks `oracle is not None` before loading models; also checks `lstm_model`/`transformer_model` for `None`
- [x] `main.py`: `ModernPremierLeagueOracle` import was already guarded; added guards for `AdvancedFeatureEngineer`, `FootballDataCollector`, and `redis.asyncio`
- [x] `main.py`: CORS fixed — replaced wildcard `*` with explicit frontend origins (`localhost:5173`, `localhost:4173`)
- [x] `main.py`: model performance endpoint now null-checks `lstm_model`/`transformer_model`
- [x] `train_all_models` now checks `MLFLOW_AVAILABLE` and null-checks LSTM/Transformer models

**Verified:** `python3 -c "from app.api.main import app"` succeeds with graceful warnings. Uvicorn starts, lifespan completes.

### P0b. Backend requirements.txt Audit — DONE (14 March 2026)

### P0c. Delete Stale Documentation — DONE (already deleted on this branch)

All 5 files confirmed absent from filesystem — previously deleted and merged from v2.0-Development.

---

## P1 — High Priority (current sprint)

### P1a. Frontend Bug Fixes — DONE (18 March 2026)

All 20 correctness bugs fixed across components, prediction engine, and services. Tests updated to match corrected behaviour. 275/275 passing, 0 type errors.

- [x] `betBuilder.ts`: `checkRivalry()` — normalise team names (strip FC/AFC/CF), expand to 10 canonical rivalries
- [x] `betBuilder.ts`: `calculateHalfTimeResult()` — proper prior-based calculation with normalisation (sum = 1.0)
- [x] `optimizedPredictions.ts`: fatigue factor now applied to Poisson lambdas (moved to step 4, before Poisson)
- [x] `predictions.ts`: confidence bounds unified to [0.25, 0.95] to match production model
- [x] `Predictions.svelte`: added "Estimated Stake" label with disclaimer about model-estimated odds
- [x] `Predictions.svelte`: removed dead `accuracy` variable
- [x] `Predictions.svelte`: removed non-existent `totalMatchdays` property access (PL always 38)
- [x] `Header.svelte`/`App.svelte`: dark mode extracted into shared Svelte store (`stores/theme.ts`) with localStorage → prefers-color-scheme → dark fallback
- [x] `MobileNav.svelte`: added `lg:hidden` to bottom nav; confirmed "Season Stats" route is valid (not phantom)
- [x] `Sidebar.svelte`: removed dead `LogOut` import
- [x] `SeasonStats.svelte`: fixed unbeaten run (draws now extend both teams), removed misleading `totalPenalties` stat
- [x] `StandingsTable.svelte`: documented that movement arrows are form-based proxies via JSDoc
- [x] `Dashboard.svelte`: Chart.js instance destroyed on unmount (memory leak fixed), relabelled fallback chart
- [x] `dataService.ts`: `getMatchesBySeason()` now extracts season year and delegates to `getHistoricalMatches()`
- [x] `dataService.ts`: `getTeamStats()` now computes home/away splits, clean sheets, and failed-to-score from match data
- [x] `predictionTracker.ts`: constructor calls `cleanOldPredictions()` on init (no more unbounded growth)
- [x] `kelly.ts`: half/quarter-Kelly are now pure fractions of fullKelly; confidence applied separately to recommended stake
- [x] `value.ts`: CLV formula corrected (positive = beat the closing line), dead `MAX_ODDS_MOVEMENT` removed, error logging added

### P1b. Dark Mode Persistence — DONE (18 March 2026)

Merged into P1a. Shared theme store created at `frontend/src/stores/theme.ts` with:
- [x] localStorage restore on init
- [x] `prefers-color-scheme` media query fallback
- [x] Shared store used by both Header.svelte and App.svelte

### P1d. Mobile UX Overhaul — DONE (18 March 2026)

Fixed 7 mobile layout bugs across 7 files. 275/275 tests passing, 0 type errors.

- [x] Fix breakpoint mismatch: `.mobile-nav` CSS used `md:hidden` (768px) but sidebar opens at 1024px — users at 768-1024px had NO navigation. Changed to `lg:hidden` to match sidebar breakpoint.
- [x] Add Season Stats to desktop Sidebar — was only reachable via mobile "More" menu, desktop sidebar skipped it entirely.
- [x] Add bottom padding (`pb-20 lg:pb-8`) to `App.svelte` main content — fixed mobile nav overlapping last content items.
- [x] Make prediction flip cards responsive (`360px` on mobile, `400px` on `sm:`+); controls row now wraps with `flex-wrap`; prediction grid uses `sm:grid-cols-2` instead of `md:grid-cols-2` for earlier two-column layout.
- [x] Accuracy grids tightened: `gap-2 sm:gap-3` on outcome and confidence band panels.
- [x] ChatBot: viewport height adjusted from `14rem` to `18rem` to account for mobile nav; API key card padding responsive (`p-4 sm:p-6`); message bubbles get `break-words` for long URLs/text.
- [x] KellyCalculator: results grid stacks on mobile (`grid-cols-1 sm:grid-cols-2`); stake amount text scaled (`text-2xl sm:text-3xl`).
- [x] Dashboard: chart heights responsive (`h-48 sm:h-56`); "How We Predict" grid gap tightened; recent predictions row stacks on mobile with match name truncation.

### P1c. E2E Test Maintenance — DONE (18 March 2026)

E2E coverage expanded from 27 tests (2 skipped) to 123 tests (0 skipped) across 6 spec files × 3 viewports (desktop 1280px, Pixel 5 393px, iPhone SE 375px).

- [x] Fixed 2 skipped prediction tests: `prediction generation produces results on cards` (clicks Predict, waits for completion, verifies scores and card flip) and `accuracy panel toggle works` (seeds settled predictions via localStorage, reloads to reinitialise PredictionTracker singleton, verifies breakdown panels).
- [x] Created `oracle-chat.spec.ts` with 8 tests: renders container, API key setup visible, welcome message, input/send disabled without key, save key flow, reject short keys, clear chat, character counter.
- [x] Added 2 Kelly Calculator edge-case tests: `shows no-value warning when probability is below implied odds` (sets prob to 30% against 2.0 odds), `shows edge percentage and value bet indicator` (verifies edge display with default values).
- [x] Fixed `helpers.ts` mobile detection threshold from 768px to 1024px to match CSS breakpoint change from P1d.

### P1e. Frontend Correctness Bugs — DONE (18 March 2026)

These were silent logic bugs producing wrong data for users:

- [x] ~~`SeasonStats.svelte`: lateDrama detection~~ — **False positive**: `full_time_result` exists on `Match` type (line 41) and is populated by `transformMatch`. The comparison `full_time_result !== half_time_result` correctly identifies matches where the result changed after halftime. Description updated from 'Late Drama' to 'Results changed after halftime' for accuracy.
- [x] `SeasonStats.svelte`: card stats (`home_yellows`, `away_yellows`, `home_reds`, `away_reds`) always 0 — DONE — stats now show 'N/A' with explanation when free-tier API returns null card data
- [x] `dataService.ts` / `footballData.ts`: season boundary inconsistency — DONE — unified to `month >= 6` (July) in both files
- [x] `optimizedPredictions.ts`: model weights declared twice (in `combineModels` and in returned `modelWeights` object) — DONE — extracted to shared `MODEL_WEIGHTS` constant at module level
- [x] `optimizedPredictions.ts`: H2H no-data fallback is inconsistent — DONE — homeWinRate/awayWinRate now consistent with probabilities (0.40/0.30)
- [x] `Predictions.svelte`: 4 dead state variables (`selectedMatch`, `predictionInProgress`, `currentPrediction`, `visible`) — DONE — removed `selectedMatch`, `predictionInProgress`, `currentPrediction`, `visible`; also removed dead imports `Clock`, `Database`
- [x] `dataService.ts`: `setCachedData` awaits an IDBRequest directly which isn't a real Promise — DONE — wrapped in proper Promise with onsuccess/onerror callbacks; also fixed `clearCache` same issue
- [x] `dataService.ts`: `initializeIndexedDB` is async but called without `await` in constructor — DONE — returns proper Promise, wired into `readyPromise` chain so DB is guaranteed open before first query

### P1f. Frontend UX Critical Fixes — PARTIAL (18 March 2026)

User-facing problems where the UI actively misleads users or blocks feature discovery.

**Help.svelte — inaccurate claims (5/5 FIXED):**

- [x] "Three-model system" → rewritten as "Five-Component Ensemble" with weight badges (25%, 30%, 20%, 10%, 15%)
- [x] xG section → replaced with Form Analysis (20%) and Head-to-Head (10%) + League Standings (15%)
- [x] "5-minute polling" → updated to "adaptive polling: 30s live / 5min matchday / 30min idle"
- [x] "Export planned" → updated to "CSV export available in Betting History"
- [x] "60-65% accuracy" → replaced with dynamic advice referencing Predictions accuracy tracking

**Dashboard hero section (FIXED):**

- [x] "Live Predictions" → "Match Predictions"; green dot pulsing indicator kept as visual element
- [x] Description updated from "AI-powered predictions using ELO ratings, Poisson models, and real-time data analysis" to accurately reference the five-component ensemble

**Hardcoded dark colours (FIXED):**

- [x] `Dashboard.svelte` hero: hex colours → `from-slate-900 via-gray-900 to-slate-800` with `dark:` variants
- [x] `KellyCalculator.svelte` headers: inline `style="background: linear-gradient(...)"` → Tailwind `bg-gradient-to-br` classes with dark mode support
- [x] `Dashboard.svelte` decorative glow: `bg-[#00ff87]` → `bg-emerald-400`

**Dashboard "How We Predict" (FIXED):**

- [x] Expanded from 4 to 5 items: ELO (25%), Poisson (30%), Form (20%), H2H (10%), Standings (15%)
- [x] Removed fake "Home Advantage" model; added Trophy icon for Standings
- [x] "Live Calculation" label → "Ensemble Model"

**Empty states (FIXED):**

- [x] Dashboard "No predictions" → added Target icon, guidance text, and "Go to Predictions" CTA link
- [x] `Predictions.svelte` — already has "Click Predict Gameweek to generate analysis" CTA on card flip side (no change needed)
- [x] `BettingHistory.svelte` — already has empty state with icon and CTA linking to Kelly/Value Bets (no change needed)

**Error/loading standardisation (PARTIAL):**

- [x] `LiveMatches.svelte` error → `border-destructive/50 bg-destructive/10 text-destructive` (was invisible `border-border bg-card`)
- [x] `TopScorers.svelte` error → same destructive pattern
- [x] `LiveMatches.svelte` + `TopScorers.svelte` spinners → `h-12 w-12 border-t-2 border-b-2` (was `border-4 border-primary/30`)
- [ ] "Last updated" indicator — deferred (requires data layer changes to track cache freshness)

**Prediction UX clarity (PARTIAL):**

- [x] Confidence badge now has tooltip: "High confidence — all models agree strongly" / "Moderate" / "Low — models disagree"
- [x] Flip cards already have "Tap for Analysis" button (no change needed)
- [x] Mobile features section: removed "Push notifications" and "Swipe navigation" claims; replaced with "Bottom navigation bar" and "Responsive layouts"

---

## P2 — Next Sprint

### P2a. shadcn-svelte Completion — DONE (18 March 2026)

5 components installed (Button, Card, Badge, Separator, Skeleton). Separator used in Sidebar.

- [x] Create `components.json` (shadcn-svelte init file) — enables `npx shadcn-svelte@latest add` for future components
- [x] CSS variable mapping already complete in `app.css` — `:root` and `.dark` blocks have all shadcn tokens (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, radius) plus custom `success`/`warning` tokens
- [x] Tailwind config already maps all semantic colours via `hsl(var(--token))` pattern
- [x] Team-specific colour overrides via `[data-team="Team Name"]` CSS attribute selectors (20 PL teams)
- [-] Wire Button/Card/Badge/Skeleton into UI — **deferred**: the CSS class system (`.btn`, `.card-glass`, `.card-stats`, `.skeleton`) has diverged from the shadcn component styles (different hover effects, shimmer animations, glow shadows). Swapping would change the visual design and break existing tests. The CSS system is the active design system; shadcn components remain available for future use.
- [-] Add missing components (Dialog, Tabs, etc.) — **deferred**: can be added on demand via `npx shadcn-svelte@latest add [component]` now that `components.json` exists

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

### P2d. Missing Component Tests — PARTIAL (18 March 2026)

378 Vitest tests across 21 files (was 275/13). Eight new test files added:

- [x] `LiveMatches.test.ts` — 7 tests: header, spinner, tabs, auto-switch, error state, recent matches, service calls
- [x] `KellyCalculator.test.ts` — 7 tests: renders, header, inputs, auto-calculate, result labels, value indicator, edge %
- [x] `Settings.test.ts` — 8 tests: header, API input, not connected, connected flow, favourite team, data management, buttons, disabled state

Key discovery: `onMount` doesn't fire in jsdom with @testing-library/svelte 5.x + Svelte 4. Workaround: `export` the init function and call via `(component as any).method()` (same pattern as Dashboard.test.ts).

Still missing:
- [x] `Predictions.svelte` — 14 tests + 3 backtest: header, gameweek selector, predict button, 38 options, loading spinner, match loading, API error, completed gameweek message, gameweek filtering, accuracy panel show/hide, team logos, predictor call, prediction storage, backtest button, backtest results, backtest error
- [x] `ChatBot.svelte` — 18 tests: container render, header, API key setup form, OpenAI platform link, disabled input/button without key, short key validation, save key + enable chat, security warning banner, "Change key" button, clear API key, clear chat, character counter, send message + display response, API 401 error, rate limit 429, empty message guard, message persistence to localStorage
- [x] IndexedDB cache layer — 11 tests: store creation, cache hit after API call (matches + standings), TTL expiry re-fetch, clearCache removes entries, disableCache bypasses, enableCache restores, setCacheTimeout controls expiry, separate keys per query type, per-team cache keys, clearCache removes API key. Uses `fake-indexeddb` for real in-memory IDB.

### P2e. Type System Gaps — DONE (18 March 2026)

- [x] `getTopScorers` return type fixed: `Promise<any[]>` → `Promise<FDScorer[]>` in `dataService.ts` (import added from `footballData.ts`)
- [x] `Prediction` interface documented: not dead — used in `Predictions.svelte` as view-level type. Added JSDoc comment clarifying its role vs `StoredPrediction` (persistence type in `predictionTracker.ts`). Snake_case convention is intentional (matches original data model)
- [ ] Remaining: add missing interfaces (`EloRatings`, `Bet`/`BetRecord`, `KellyResult`, `ValueBet`, `MLPrediction`, `LiveMatch`, `ChatMessage`, `CacheEntry`) — deferred as low priority, types are co-located with their implementations

### P2f. Backtest Runner — DONE (18 March 2026)

**New file:** `frontend/src/lib/backtest.ts`

- [x] `BacktestRunner` class — takes completed match array, runs ensemble on each
- [x] Reports: overall accuracy %, H/D/A accuracy, log loss, Brier score
- [x] 15 unit tests covering metrics, probability extraction, progress callbacks, error handling
- [x] Accessible from Predictions view (button in accuracy panel) — completed in P2f-UI

### P2f-UI. Backtest Runner UI — DONE (18 March 2026)

Wires the existing `BacktestRunner` class (15 tests) to a visible UI inside the Predictions accuracy panel.

- [x] "Run Backtest" button with `FlaskConical` icon in accuracy panel
- [x] Progress bar with match count during execution
- [x] Error state for insufficient data (< 5 completed matches)
- [x] Results grid: overall accuracy, total matches, log loss, Brier score
- [x] Per-outcome breakdown: Home / Draw / Away accuracy with correct/total counts
- [x] 3 new tests: button render, results display, error handling
- [x] **Test count 346 → 349**: 19 test files, 349/349 passing, 0 type errors

### P2g. Kelly Auto-Suggestions — DONE (18 March 2026)

- [x] Load upcoming predictions from `OptimizedPredictor` (next 14 days)
- [x] For confidence >= threshold + positive EV: generate Kelly suggestions
- [x] Display as "Suggested Bets" list above manual calculator (sorted by edge)
- [x] Add confidence threshold slider (40–90%, default 65%)
- [x] Stakes recalculate reactively when bankroll changes
- [x] 15 tests (was 7) covering manual calculator + suggestions: empty state, suggestions display, low-confidence filter, API error, completed match skip, suggestion count

### P2h. Oracle Chat Improvements — DONE (18 March 2026)

`ChatBot.svelte` rewritten with four improvements:

- [x] **Security warning banner** — collapsible `ShieldAlert` alert explains that the OpenAI API key is visible in browser network tab; links to Settings page for key management
- [x] **Markdown rendering** — `renderMarkdown()` regex chain handles bold, italic, code blocks, inline code, bullet lists, and numbered lists; styled via `.prose-chat` CSS
- [x] **Batched context calls** — replaced 3 sequential try/catch blocks with `Promise.allSettled()` for parallel fetch of standings, form, and predictions
- [x] **Chat persistence** — messages saved to `localStorage` (key: `oracle_chat_history`, max 50 messages); restored on mount with reactive `$:` auto-save
- [x] API key config references Settings page (already implemented in P1b)
- [ ] Backend prediction integration — deferred until backend service bridge (P2b) is built

### P2i. Wire ValueBettingEngine to UI — DONE (18 March 2026)

`ValueBettingEngine` in `betting/value.ts` now has a full UI consumer.

- [x] Created `ValueBets.svelte` — match selector, user-entered odds inputs (1X2 + optional O/U 2.5), bankroll, "Scan for Value" button
- [x] Wired `identifyValueBets()` to real match predictions + user-entered odds
- [x] Displays value bets with edge, EV, Kelly stake, reasoning, and warnings
- [x] Added to App routing, Sidebar, and MobileNav navigation
- [x] 12 tests covering: container, header, empty state, match selector, odds inputs, scan button, bankroll, optional markets, API error, completed match filter, team logos
- [ ] Wire `OddsProvider` interface — deferred until an odds API is selected

---

## P3 — Backend ML

Two-tier approach: **P3-Free** builds a lean XGBoost model trained on ~73 features available from the Football-Data.org free API — this is the active development track and the model used for all testing and deployment. **P3a–P3g** remain in place for the future Pro API integration, which unlocks the full 150-feature pipeline (xG, shots, possession, cards, corners, betting odds, player data). `specs/08-backend-training.md` is the single source of truth for training requirements — written 18 March 2026.

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

**Security (scoped to this feature):**

- [ ] `.gitignore` — add `backend/.env` (currently only `/.env` root and `frontend/.env` listed)
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
- [ ] **NEW**: `modern_oracle.py` calls `self.data_collector.get_team_stats(team_name)` — method doesn't exist on `FootballDataCollector`. Will raise `AttributeError` at runtime
- [ ] **NEW**: `modern_oracle.py` calls `self.data_collector.get_team_form(team_name, last_n=5)` — wrong kwarg name, should be `n_matches`. Will raise `TypeError` at runtime

### P3c. Model Training Pipeline

**New file:** `backend/train.py`

- [ ] Orchestrates: data collection → feature engineering → model training → evaluation
- [ ] Train/validation/test splits: 2020-2023 train, 2024 validation, 2025 test
- [ ] Wire `/admin/retrain` endpoint (currently returns mock response)
- [ ] Fix `lstm_predictor.py`: `get_feature_importance()` returns `{name: np.random.random()}` — **live np.random stub**
- [ ] Fix `modern_oracle.py`: `optimize_ensemble_weights()` returns `np.random.random()` — **live np.random stub**
- [ ] Fix `modern_oracle.py`: `_calculate_betting_value()` uses mock odds `{home: 2.5, draw: 3.2, away: 2.8}`
- [ ] Fix `transformer_model.py`: model save/load only saves 2 of 8 constructor params
- [ ] Fix `transformer_model.py`: `val_accuracy` UnboundLocalError when no validation set
- [ ] Fix `transformer_model.py`: `num_decoder_layers` param silently ignored (no decoder built)
- [ ] Add pytest tests (currently 0% backend test coverage — `test_setup.py` only checks imports, no assertions)

### P3d. Security Layer Fixes

- [ ] `auth.py`: `SECRET_KEY` regenerated every restart (should be env var)
- [ ] `auth.py`: mock user database lookup (line 434)
- [ ] `auth.py`: brute force protection broken (per-request dict, not persistent)
- [ ] `auth.py`: Redis connection never established
- [ ] **NEW**: `auth.py`, `secrets.py`, `validators.py` are all **completely unused at runtime** — not imported by `main.py` or any model. Consider removing or properly wiring them
- [ ] **NEW**: `main.py` bearer tokens on `/predict/natural` and `/admin/retrain` are **never verified** — any bearer string passes
- [ ] **NEW**: `main.py` global exception handler returns raw `str(exc)` in response body, leaking internal error details to clients
- [ ] `secrets.py`: Azure Key Vault imported but no provider class; hard imports `boto3`, `hvac`, `azure` with no guards — will crash on import without cloud SDKs
- [ ] `secrets.py`: `SecureConfig.__init__` requires `DATABASE_URL` which doesn't exist in the project
- [ ] `secrets.py`: audit log in-memory only
- [ ] `validators.py`: `VALID_TEAMS` has 2023/24 clubs (Burnley/Luton/Sheffield — missing Leicester/Ipswich/Southampton)
- [ ] `validators.py`: `ValidationError` raised incorrectly (will TypeError at runtime — Pydantic V2 doesn't accept bare string)
- [ ] `validators.py`: SQL blacklist blocks natural language queries containing "from" or "where"
- [ ] **NEW**: `lstm_predictor.py` and `transformer_model.py` have unguarded `import torch` at module level — will crash if torch not installed (handled by `modern_oracle.py` try/except, but the files themselves aren't safely importable)

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

- [ ] Remove `Math.random()` star particles in `App.svelte:96-100`
- [ ] Fix hardcoded "Tom Butler" / "tom@example.com" in `Header.svelte:140-141`
- [ ] Fix hardcoded "3 new predictions available" in `Header.svelte:102`
- [ ] Wire or remove Header.svelte search bar (dispatches event but nothing handles it)
- [ ] Wire or remove Header.svelte profile/logout actions
- [ ] Fix `ApiSetupWizard.svelte` Step 3 single-option auto-advance
- [ ] Update `Help.svelte` accuracy claim "60-65%" to use real `predictionTracker` stat
- [ ] Update `Help.svelte` to remove push notifications / offline caching claims (they don't exist)
- [ ] **NEW**: `Help.svelte` claims "three-model system" — actual production model is 5-component ensemble — **moved to P1f (critical)**
- [ ] **NEW**: `Help.svelte` claims "5-minute refresh" — actual polling is adaptive (30s/5min/30min) — **moved to P1f (critical)**
- [ ] **NEW**: `Help.svelte` says "export functionality is planned" — BettingHistory export is already implemented — **moved to P1f (critical)**
- [ ] **NEW**: `Help.svelte` mentions xG on dashboard — xG unavailable on free tier — **moved to P1f (critical)**
- [ ] **NEW**: `StandingsTable.svelte` movement arrows need tooltip explaining they're form-based ("Based on recent form"), not actual position change
- [ ] **NEW**: `Dashboard.svelte` "How We Predict" section lists 4 models but actual model uses 5 components — update copy
- [ ] **NEW**: Glassmorphism `.card-glass` over hero section's blurred bubbles creates double-blur — use solid `.card` for nested content

### P4b. Accessibility (spec 07: 0 of 5 ARIA requirements met)

- [ ] `role="meter"`, `aria-valuenow/min/max` on prediction probability bars
- [ ] Proper `<label>` elements on Kelly calculator inputs
- [ ] `aria-current="page"` on active nav items (already done in MobileNav/Sidebar — verify all)
- [ ] `aria-label` on theme toggle and confidence indicators
- [ ] Add `prefers-reduced-motion` media query to `app.css`
- [ ] **NEW**: `ApiSetupWizard.svelte` missing `role="dialog"`, `aria-modal="true"`, focus trap
- [ ] **NEW**: Charts (Dashboard Line, BettingHistory Bar) have no `role="img"` or `aria-label` fallback
- [ ] **NEW**: `LiveTicker.svelte` has no way to pause scrolling animation (WCAG 2.2.2)
- [ ] **NEW**: `Predictions.svelte` progress bar has no `role="progressbar"` or `aria-valuenow`
- [ ] **NEW**: `ChatBot.svelte` message list has no `aria-live="polite"` for new responses
- [ ] **NEW**: Prediction flip cards have no `aria-label` or focus indicator — keyboard users can't tell when a card is selected
- [ ] **NEW**: Win/loss indicators use colour only (green/red) — add icons for colourblind users (WCAG 1.4.1)

### P4c. Component Data Accuracy Cleanup

- [ ] `LiveMatches.svelte`: "Auto-refreshing every 30 seconds" label hardcoded — make dynamic (wrong when backed off to 5min/30min)
- [ ] `LiveTicker.svelte`: live dot detection uses `startsWith('football emoji')` heuristic — use boolean flag
- [ ] `SeasonStats.svelte`: "Late Drama" metric is HT/FT proxy — rename or document
- [ ] `StandingsTable.svelte`: position movement arrows inferred from form, not real API data
- [ ] `Settings.svelte`: "Connected" status shown without actually pinging API — wire real check

### P4d. betBuilder Improvements

- [x] Fix `checkRivalry()` to match API canonical team names — done (normalise + 10 rivalries)
- [x] Expand rivalry list beyond 6 hardcoded entries — done (10 entries)
- [ ] Replace hardcoded combo confidence values (0.65, 0.45, 0.25, 0.40) with calculated
- [ ] Replace `avgCorners: 9.5` and `expectedCards: 3.2` with league averages from match data
- [ ] Market correlation in combo probability (e.g. clean sheet + over 2.5 negatively correlated)
- [ ] **NEW**: `bothCleanSheets: { prediction: false }` — unconditional hardcode regardless of computed probability

### P4e. CSS & Theme Polish

- [ ] Some raw hex values in `app.css` not using CSS design tokens
- [ ] Team theme CSS variables exist (20 PL clubs) but integration unclear
- [ ] **NEW**: `Dashboard.svelte` chart border colours hardcoded as hex (`'#4299e1'`, `'#10b981'`) — won't track dark/light theme
- [ ] **NEW**: `BettingHistory.svelte` chart CSS variables passed to Chart.js at creation time, not reactively — won't update on theme change without chart re-creation
- [ ] **NEW**: `Sidebar.svelte` has inline `style` with `rgba(0, 255, 135, 0.15)` rather than Tailwind/CSS variable

### P4f. Dead Imports & Code Duplication (NEW — discovered in audit #4)

Multiple components have dead imports that should be cleaned up:

- [x] `Predictions.svelte`: remove dead imports `Database`, `Clock` — DONE
- [ ] `StandingsTable.svelte`: remove dead imports `TrendingUp`, `TrendingDown`, `fade`
- [ ] `TopScorers.svelte`: remove dead imports `Target`, `User`
- [ ] `Settings.svelte`: remove dead import `Sparkles`
- [ ] `ApiSetupWizard.svelte`: remove dead import `Sparkles`; clean up stale test comments
- [ ] `MatchList.svelte`: remove dead import `Check`
- [x] `SeasonStats.svelte`: remove unused `animatedValue` tweened store — DONE
- [ ] `BettingHistory.svelte`: remove dead `.th`/`.td` CSS classes in `<style global>`
- [ ] Extract `getSeasonLabel()` to shared utility — duplicated in StandingsTable, TopScorers, SeasonStats
- [ ] `ApiSetupWizard.svelte`: fix double `window.location.reload()` (5s delay + button click)
- [ ] `footballData.ts`: `getTeamSquad()` and `getPlayer()` are never called — remove or keep for future use
- [ ] `dataService.ts`: `getStatus()` and `getDataSourceStatus()` are never called — remove dead methods

---

## Specs

All feature specifications in `specs/`:

| File | Topic | Implementation Status |
|------|-------|-----------------------|
| `specs/01-prediction-engine.md` | ELO, Poisson, fatigue, referee, confidence, backtesting | ~25% — ELO dynamic, Poisson Dixon-Coles, fatigue wired; no backtest runner, no AI analysis, confidence calibration rudimentary |
| `specs/02-data-pipeline.md` | Football-Data.org integration, caching, historical data | ~50% — DataService + 3-tier cache work; missing `getLiveMatches()`, `getHistoricalMatches()`, `getTeamRecentMatches()` methods; scorers store bug |
| `specs/03-backend-integration.md` | Python ML backend connection | **0%** — 0 of 8 acceptance criteria met |
| `specs/04-betting-intelligence.md` | Kelly, value bets, bet history, accumulators | ~35% — Kelly fixed, CLV corrected, betBuilder rivalry/HT fixed; `ValueBettingEngine` tested but has no UI consumer; no auto-suggestions |
| `specs/05-live-data.md` | Live scores, smart polling, WebSocket | ~15% — components exist, polling logic exists, but `liveService.ts` missing and no WebSocket |
| `specs/06-prediction-tracking.md` | Accuracy tracking, auto-reconciliation | ~90% — substantially complete |
| `specs/07-ui-ux.md` | shadcn-svelte migration, dark mode, accessibility | ~20% — dark mode fixed (shared store), 5 components installed (1 wired), 0/5 ARIA |
| `specs/08-backend-training.md` | Backend training pipeline (free-tier + Pro-tier) | **P3-Free: 0%** — spec written, implementation not started. Pro-tier (P3a–P3g) deferred |

---

## Active Stubs (known hardcoded values remaining)

### Frontend

| Location | Problem | Priority |
|----------|---------|----------|
| `advancedPredictions.ts` | `avgPenalties: 0.2` — no penalty data from free API tier | Low |
| ~~`advancedPredictions.ts`~~ | ~~`baseHomeGoals: 1.5, baseAwayGoals: 1.2` — hardcoded in 3 files~~ **FIXED** — `advancedPredictions.ts` and `predictions.ts` now derive league averages from completed match data (fallback to 1.5/1.2 when no data); `optimizedPredictions.ts` already correct via `computeLeagueAverages` | ~~P1e~~ |
| `advancedPredictions.ts` | `SEED_RATINGS` — 25 teams with manually assigned ELO, not backcalculated | Low |
| `advancedPredictions.ts` | `ratingReliability = 0.8` — constant, should reflect actual model accuracy | Low |
| `advancedPredictions.ts` | `ExpectedGoalsCalculator.calculateMatchXG` — always returns `{homeXG: 0, awayXG: 0}` (no shots data from free tier) | Low |
| ~~`optimizedPredictions.ts`~~ | ~~`cleanSheetRate: 0.3` — derivable from match results~~ **FIXED** — now uses Poisson `e^(-avgGoalsConceded)` | ~~P1e~~ |
| ~~`optimizedPredictions.ts`~~ | ~~Model weights duplicated in two places — can silently diverge~~ | ~~P1e~~ FIXED |
| ~~`optimizedPredictions.ts`~~ | ~~H2H fallback `homeWinRate: 0.33` inconsistent with `homeWin: 0.40`~~ | ~~P1e~~ FIXED |
| ~~`optimizedPredictions.ts`~~ | ~~Error fallback returns different weights than success path~~ **FIXED** — both paths now use shared `MODEL_WEIGHTS` constant (fixed in P1e) | ~~Low~~ |
| `betBuilder.ts` | `avgCorners: 9.5` — no corner data from free tier | P4d |
| `betBuilder.ts` | `expectedCards: 3.2` — no card data from free tier | P4d |
| ~~`betBuilder.ts`~~ | ~~Combo confidence values (0.65, 0.45, 0.25, 0.40) hardcoded~~ **FIXED** — now product of individual selection probabilities | ~~P4d~~ |
| ~~`betBuilder.ts`~~ | ~~`bothCleanSheets: { prediction: false }` unconditional~~ **FIXED** — now `bothCleanSheets > 0.08` (PL 0-0 average ~7-8%) | ~~P4d~~ |
| `betBuilder.ts` | `'Over 1.5 first half goals'` probability hardcoded as `0.35` | P4d |
| ~~`betBuilder.ts`~~ | ~~`'win to nil'` probability hardcoded as `0.30`~~ **FIXED** — now derived from `favProb × favCleanSheet` (clamped ≥ 0.05) | ~~P4d~~ |
| ~~`Header.svelte:140-141`~~ | ~~Hardcoded "Tom Butler" / "tom@example.com"~~ | ~~P4a~~ REMOVED — Header rewritten, no user info present |
| ~~`Header.svelte:102`~~ | ~~Hardcoded "3 new predictions available"~~ | ~~P4a~~ REMOVED — Header rewritten, no notification badge present |
| ~~`App.svelte:96-100`~~ | ~~`Math.random()` star particles~~ | ~~P4a~~ REMOVED — App rewritten, no star particles present |
| `Settings.svelte` | ~~Fake cache size: `localStorage.length * 0.005 MB`~~ **FIXED** — now sums real byte lengths | P2c |
| ~~`Settings.svelte`~~ | ~~"Connected" status without real API ping~~ **FIXED** — onMount now calls `testConnection()` with "Verifying…" spinner; shows "Connected" only on success | ~~P4c~~ |
| `StandingsTable.svelte` | Position movement from form wins (fake proxy) | P4c |
| ~~`LiveMatches.svelte`~~ | ~~"Auto-refreshing every 30 seconds" hardcoded label~~ **FIXED** — now shows actual poll interval (30s/5min/30min) | ~~P4c~~ |
| ~~`ChatBot.svelte`~~ | ~~OpenAI API key exposed in browser network tab~~ | ~~P2h~~ MITIGATED — security warning banner added |
| `ChatBot.svelte` | Model hardcoded as `gpt-4o-mini` | Low |
| `Predictions.svelte` | `estimatedBookmakerOdds = (1 / topProb) * 1.05` — fabricated | Low |
| ~~`SeasonStats.svelte`~~ | ~~`lateDrama` always 0 — references non-existent field~~ | ~~P1e~~ FALSE POSITIVE — `full_time_result` exists |
| ~~`SeasonStats.svelte`~~ | ~~Card stats always 0 — free-tier API has no card data~~ | ~~P1e~~ FIXED — shows 'N/A' with explanation |
| `value.ts` | `calculateCLV` returns `betId: ''` (stub) | Low |
| `kelly.ts` | `Math.random()` in `simulate()` — non-deterministic Monte Carlo | Low |
| ~~`dataService.ts`~~ | ~~Season boundary inconsistency (month >= 6 vs >= 7)~~ | ~~P1e~~ FIXED |

### Backend

| Location | Problem | Priority |
|----------|---------|----------|
| `advanced_engineering.py` | 49 methods return `0.0` (tactics, players, betting, weather, advanced) | P3a |
| `football_data_collector.py` | `get_head_to_head()` returns empty DataFrame | P3b |
| `football_data_collector.py` | `get_team_form()` result-flip bug | P3b |
| `lstm_predictor.py` | `get_feature_importance()` returns `np.random.random()` | P3c |
| `modern_oracle.py` | `optimize_ensemble_weights()` returns `np.random.random()` | P3c |
| `modern_oracle.py` | `_calculate_betting_value()` uses mock odds | P3c |
| `modern_oracle.py` | Calls non-existent `data_collector.get_team_stats()` | P3b |
| `modern_oracle.py` | Wrong kwarg `last_n=5` (should be `n_matches`) | P3b |
| `transformer_model.py` | Save/load only saves 2 of 8 constructor params | P3c |
| `transformer_model.py` | `val_accuracy` UnboundLocalError | P3c |
| `transformer_model.py` | `num_decoder_layers` silently ignored | P3c |
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
| `dataService.cache.test.ts` | 11 | Passing |
| `predictionTracker.test.ts` | 18 | Passing |
| `optimizedPredictions.test.ts` | 12 | Passing |
| `betHistoryService.test.ts` | 27 | Passing |
| `BettingHistory.test.ts` | 15 | Passing |
| `betBuilder.test.ts` | 40 | Passing |
| `value.test.ts` | 38 | Passing |
| **Total** | **275** | **All passing** |

**Known test issues:**
- `predictions.test.ts`: form trend test re-implements logic inline instead of testing actual function
- `footballData.test.ts`: normalisation test re-implements logic instead of testing actual function
- IndexedDB cache layer completely untested
- Only 2 components have unit tests (Dashboard, BettingHistory) — 14 components untested

**Test infrastructure note:** Test setup (`setup.ts`) updated to properly mock IndexedDB async callback pattern — all IDB operations now resolve correctly in tests.

### Frontend (Playwright E2E)

| File | Tests | Status |
|------|-------|--------|
| `navigation.spec.ts` | 9 | Passing |
| `dashboard.spec.ts` | 6 | Passing |
| `predictions.spec.ts` | 6 | 2 skipped |
| `betting.spec.ts` | 5 | Passing |
| `mobile.spec.ts` | 6 | Passing |
| **Total** | **27** | **25 passing, 2 skipped** |

### Backend (pytest)

**0% coverage. No real tests exist.** (`test_setup.py` only checks imports — no assertions.)

---

## Services Still To Create

| File | Purpose | Priority |
|------|---------|----------|
| `frontend/src/services/backendService.ts` | Frontend-backend bridge | P2b |
| `frontend/src/services/liveService.ts` | WebSocket live data | P3f |
| `frontend/src/services/aiAnalysis.ts` | AI match analysis | P3g |
| `frontend/src/lib/backtest.ts` | Backtest runner | P2f |
| `backend/app/features/free_tier_features.py` | Free-tier feature engineer (~73 features) | P3-Free |
| `backend/train_free_tier.py` | Free-tier training pipeline | P3-Free |
| `backend/tests/test_free_tier_*.py` | Free-tier tests (features, training, API) | P3-Free |
| ~~`specs/08-backend-training.md`~~ | ~~Backend training spec~~ | ~~DONE~~ |
