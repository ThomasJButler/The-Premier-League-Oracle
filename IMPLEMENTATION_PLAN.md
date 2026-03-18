# Premier League Oracle — Implementation Plan

Last updated: 18 March 2026 (P1g + CodeRabbit review — 11 additional fixes committed, 8 unfixed issues tracked as P1h/P2/P3/P4)
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

**Remaining Help.svelte inaccuracies (discovered in audit):**

- [ ] "Offline data caching" claim — IndexedDB cache exists but no Service Worker; this isn't offline capability
- [ ] FAQ "CSV export button" — `BettingHistory.svelte` exports JSON, not CSV
- [ ] "Value Bets > Historical performance" — aspirational, feature doesn't exist
- [ ] "Golden Rules" accuracy claims ("75-85%", "15% drop", "+15% manager bounce") — made-up figures not backed by any model measurement
- [ ] "Bounce-Back Effect" — presented as model insight, but no such logic exists in the prediction engine

### P1h. CodeRabbit Unfixed — High Priority (18 March 2026)

Identified by CodeRabbit review. 11 of 19 actionable issues were fixed in commit `c3d2f36`. The following require larger changes:

**ChatBot API key exposure (security — active risk):**

- [ ] `ChatBot.svelte` makes direct browser→OpenAI calls — API key visible in DevTools network tab. Route OpenAI calls through a backend proxy endpoint so the key is never sent to the client. Until then, users should be warned not to use their primary key. Architecture fix required — not a one-liner.

**`importBets` stores unvalidated data (data integrity):**

- [ ] `betHistoryService.ts`: `importBets()` only checks `bet.id && bet.matchId` before writing. Negative odds, missing `profit` on resolved bets, and invalid `market` strings are silently stored and corrupt `getROI()`, `getWinRate()`, and `getMonthlyPL()`. Add: `odds > 1`, `stake > 0`, `market` in allowlist, `profit` present on resolved bets.

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
- [ ] Extract `VALUE_ODDS_MARGIN = 1.05` to a shared constant in `lib/constants.ts` (currently duplicated in `advancedPredictions.ts`, `optimizedPredictions.ts`, `backtest.ts`)

### P2k. ELO Auto-Update Integration — NEW (18 March 2026)

Spec 01 requires ELO ratings to auto-update from completed match results. Currently:

- [ ] `processCompletedMatches()` exists on `EloRatingSystem` but is not wired into `dataService` — ELO ratings never update automatically when match results load
- [ ] Wire into `dataService.reconcilePredictions()` or a new lifecycle hook after fetching finished matches

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

`advanced_engineering.py` — no `np.random.*` calls (was 102), but **49 methods return hardcoded `0.0`** for: tactics, player-level, betting market, weather, and advanced metric features. ~75 features compute real data from scorelines/results.

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
- [ ] `football_data_collector.py`: `get_team_form()` result-flip logic works but is confusingly written — could be misread as a bug
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

### P4c. Component Data Accuracy Cleanup

- [x] `LiveMatches.svelte`: "Auto-refreshing every 30 seconds" label — FIXED (now shows actual interval)
- [ ] `LiveTicker.svelte`: live dot detection uses `startsWith('football emoji')` heuristic — use boolean flag
- [ ] `Settings.svelte`: `cacheSize` computation measures `localStorage` only, not IndexedDB — significantly underestimates actual storage use
- [ ] `Settings.svelte`: `plTeams` array hardcoded for 2024-25 season — needs updating each season
- [ ] `SeasonStats.svelte`: "Did you know? These statistics are updated in real-time" — not true; fetches once on mount
- [ ] `SeasonStats.svelte`: no error state in template — if fetch fails, shows empty grid forever (loading stops but nothing renders)
- [x] `Settings.svelte`: "Connected" status without real API ping — FIXED (now calls `testConnection()` on mount)

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

### P4e. CSS & Theme Polish

- [ ] Some raw hex values in `app.css` not using CSS design tokens
- [ ] Team theme CSS variables exist (20 PL clubs) but integration unclear
- [ ] `Dashboard.svelte` chart border colours hardcoded as hex (`'#4299e1'`, `'#10b981'`) — won't track dark/light theme
- [ ] `BettingHistory.svelte` chart CSS variables passed to Chart.js at creation time, not reactively — won't update on theme change without chart re-creation
- [ ] `Sidebar.svelte` has inline `style` with `rgba(0, 255, 135, 0.15)` rather than Tailwind/CSS variable
- [ ] `Predictions.svelte` progress bar uses hardcoded hex `from-[#00cc6a] to-[#00ff87]`
- [ ] `LiveTicker.svelte` live dot uses hardcoded `background: #ef4444`
- [ ] `Dashboard.svelte` hero section is always dark regardless of theme (intentional? or should adapt)

### P4f. Dead Imports & Code Duplication

- [x] `Predictions.svelte`: remove dead imports `Database`, `Clock` — DONE
- [x] `SeasonStats.svelte`: remove unused `animatedValue` tweened store — DONE
- [ ] `StandingsTable.svelte`: remove dead imports `TrendingUp`, `TrendingDown`, `fade`
- [ ] `TopScorers.svelte`: remove dead imports `Target`, `User`
- [ ] `Settings.svelte`: remove dead import `Sparkles`
- [ ] `ApiSetupWizard.svelte`: remove dead import `Sparkles`; clean up stale test comments
- [ ] `MatchList.svelte`: remove dead import `Check`
- [ ] `BettingHistory.svelte`: remove dead `.th`/`.td` CSS classes in `<style global>`
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

---

## Specs

All feature specifications in `specs/`:

| File | Topic | Implementation Status |
|------|-------|-----------------------|
| `specs/01-prediction-engine.md` | ELO, Poisson, fatigue, referee, confidence, backtesting | ~45% — ELO dynamic, Poisson Dixon-Coles, fatigue wired, referee adjustments, backtest runner created; ELO auto-update not wired to dataService, no AI analysis, confidence calibration rudimentary |
| `specs/02-data-pipeline.md` | Football-Data.org integration, caching, historical data | ~55% — DataService + 3-tier cache work; getLiveMatches/getHistoricalMatches/getTeamRecentMatches all implemented; missing progressive 5-season bulk loader with rate limiting |
| `specs/03-backend-integration.md` | Python ML backend connection | **0%** — 0 of 8 acceptance criteria met |
| `specs/04-betting-intelligence.md` | Kelly, value bets, bet history, accumulators | ~65% — Kelly + auto-suggestions done, CLV corrected, betBuilder fixed, ValueBets UI created; betHistoryService has resolution bugs (P1g) |
| `specs/05-live-data.md` | Live scores, smart polling, WebSocket | ~65% — smart polling + LiveMatches working; no liveService.ts, no WebSocket, no shared store |
| `specs/06-prediction-tracking.md` | Accuracy tracking, auto-reconciliation | ~95% — substantially complete |
| `specs/07-ui-ux.md` | shadcn-svelte migration, dark mode, accessibility | ~15% — dark mode fixed, 5 components installed (1 wired), components.json created, 0/5 ARIA requirements met |
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

### Backend

| Location | Problem | Priority |
|----------|---------|----------|
| `advanced_engineering.py` | 49 methods return `0.0` (tactics, players, betting, weather, advanced) | P3a |
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
