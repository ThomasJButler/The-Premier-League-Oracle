# Premier League Oracle — Implementation Plan

Last updated: 14 March 2026
Active branch: `v3.0-Development`
Completed work archive: `COMPLETED_WORK.md`

---

## Git Branch Strategy

```
main                  — stable releases only, merged via PR
v3.0-Development      — current active sprint (this branch)
feature/<name>        — isolated features, merged to v3.0-Development via PR
fix/<name>            — bug fixes, merged to v3.0-Development via PR
```

**Merge flow:** `feature/*` → `v3.0-Development` → `main` (PR only)

---

## P0 — Blockers (must fix before anything else)

### P0a. Fix Backend Startup

The server **will not start** due to broken imports in `modern_oracle.py`.

**Files:** `backend/app/models/modern_oracle.py`, `backend/app/api/main.py`

- [ ] Update `from langchain.embeddings import OpenAIEmbeddings` → `langchain_community.embeddings`
- [ ] Fix deprecated ChromaDB `duckdb+parquet` API to use modern `chromadb.PersistentClient()`
- [ ] Wrap `ModernPremierLeagueOracle` import in `main.py` with `try/except` so server starts without OpenAI key
- [ ] Make LangChain/ChromaDB optional — log warning if unavailable, don't crash

**Verify:** `cd backend && uvicorn app.api.main:app --reload --port 8000` then `curl http://localhost:8000/health` returns 200.

### P0b. Backend requirements.txt Audit

`backend/requirements.txt` still has packages that aren't imported anywhere.

- [ ] Run `pipreqs backend/app/ --print` and cross-reference with current `requirements.txt`
- [ ] Remove: Kafka, Azure SDK, AWS SDK, Graph Neural Networks, Computer Vision, Dash, LightGBM, CatBoost, Polars, DuckDB, FeatureTools, TensorFlow (not used), Plotly
- [ ] Keep: FastAPI, uvicorn, xgboost, torch, transformers, scikit-learn, pandas, numpy, httpx, pydantic, python-dotenv, scipy, langchain-community, chromadb, mlflow, optuna, redis, shap, joblib, loguru, cryptography, passlib, python-jose

---

## P1 — High Priority (v3.0-Development sprint)

### P1a. Playwright E2E Test Suite

No end-to-end tests exist. Critical for catching regressions and driving UI improvement systematically.

**New files:**
- `frontend/playwright.config.ts`
- `frontend/e2e/navigation.spec.ts` — all sidebar views load, no JS errors
- `frontend/e2e/dashboard.spec.ts` — stat cards show real values, chart renders
- `frontend/e2e/predictions.spec.ts` — generate predictions, gameweek nav, accuracy panel toggle
- `frontend/e2e/betting.spec.ts` — manual odds entry, Kelly calculator
- `frontend/e2e/mobile.spec.ts` — 375px viewport, no overflow, nav works

**Setup:**
```bash
cd frontend
npm install -D @playwright/test
npx playwright install chromium
```

Add to `package.json`: `"test:e2e": "playwright test"`

### P1b. Mobile UX Overhaul

Mobile is currently broken. Use Playwright screenshots to identify worst issues first, then fix.

**Files:** `Sidebar.svelte`, `MobileNav.svelte`, `app.css`, all card components

- [ ] Fix mobile sidebar — use CSS `translate` properly or migrate to shadcn `Sheet`
- [ ] `MobileNav.svelte`: add missing views (currently only 5 of 10+ exposed), fix active state
- [ ] Fix card overflow/scroll on small viewports
- [ ] Ensure prediction probability bars are readable on mobile
- [ ] Test at 375px (iPhone SE), 390px (iPhone 14), 768px (iPad)

### P1c. Dark Mode Persistence

`Header.svelte` saves theme to localStorage but `App.svelte` doesn't restore it on load.

**File:** `frontend/src/App.svelte`

- [ ] In `onMount`, restore theme from `localStorage.getItem('theme')`
- [ ] Fall back to `prefers-color-scheme` media query if no stored preference

---

## P2 — Next Sprint

### P2a. Backend Service (frontend bridge)

No frontend code calls the Python backend.

**New file:** `frontend/src/services/backendService.ts`

- [ ] `isAvailable()` — pings `/health`, returns bool
- [ ] `predictMatch(homeTeam, awayTeam)` — calls `/predict`
- [ ] `predictBatch(matches)` — calls `/predict/batch`
- [ ] All methods throw `BackendUnavailableError` if backend down
- [ ] Add Vite proxy: `/api/oracle` → `http://localhost:8000` in `vite.config.ts`

### P2b. Backend Feature Flag in Settings

**File:** `frontend/src/components/Settings.svelte`

- [ ] `useBackend` toggle (persisted as `use_backend` in localStorage)
- [ ] Backend connection status indicator (green/red dot)
- [ ] `oracle_api_token` input field
- [ ] Fix fake cache size calculation (`localStorage.length × 0.005 MB` → real estimate)

### P2c. shadcn-svelte Initialisation

shadcn-svelte is NOT initialised — zero shadcn files exist in `frontend/`.

- [ ] `cd frontend && npx shadcn-svelte@latest init` (Svelte 4, TypeScript, Tailwind, `src/lib/components/ui`)
- [ ] Add CSS variable mapping to `app.css` (`:root` and `.dark` blocks per spec 07)
- [ ] Migrate in priority order: Button → Card → Dialog → Badge → Tabs → Skeleton

### P2d. Missing Component Tests

No tests exist for these components:

- [ ] `Predictions.svelte` — generate, gameweek nav, Kelly stake display
- [ ] `LiveMatches.svelte` — polling state, no live matches, score display
- [ ] `ValueBets.svelte` — odds entry form, EV calculation output
- [ ] `KellyCalculator.svelte` — input validation, stake output
- [ ] `Settings.svelte` — toggle persistence, cache clear

### P2e. Backtest Runner

**New file:** `frontend/src/lib/backtest.ts`

- [ ] `BacktestRunner` class — takes completed match array, runs ensemble on each
- [ ] Reports: overall accuracy %, H/D/A accuracy, log loss, Brier score
- [ ] Accessible from Predictions view (button in accuracy panel)

### P2f. Kelly Auto-Suggestions

**File:** `frontend/src/components/betting/KellyCalculator.svelte`

- [ ] Load upcoming predictions from `OptimizedPredictor`
- [ ] For confidence ≥ 65% + positive EV: generate Kelly suggestions
- [ ] Display as "Suggested Bets" list above manual calculator
- [ ] Add confidence threshold slider (currently hardcoded at 0.7)

---

## P3 — Backend ML (Future Sprint)

### P3a. Real Feature Engineering

`advanced_engineering.py` — **102 occurrences of `np.random.*`** fake all features.

Priority features to implement with real data:
- Rolling goals scored/conceded (last 5, 10 matches)
- Form streaks (W/D/L sequences)
- Rest days since last match
- H2H win rates
- xG proxies from shots data

Connect `FootballDataCollector` output to `AdvancedFeatureEngineer` input. Write `specs/08-backend-training.md` first.

### P3b. Model Training Pipeline

**New file:** `backend/train.py`

- [ ] Orchestrates: data collection → feature engineering → model training → evaluation
- [ ] Train/validation/test splits: 2020–2023 train, 2024 validation, 2025 test
- [ ] Wire `/admin/retrain` endpoint (currently returns mock response)
- [ ] Fix `get_head_to_head()` returning empty DataFrame
- [ ] Fix `get_feature_importance()` returning random values
- [ ] Fix `optimize_ensemble_weights()` returning `np.random.random()`
- [ ] Add pytest tests (currently 0% backend test coverage)

### P3c. OptimizedPredictor × ML Integration

- [ ] When `useBackend` enabled and backend available, merge ML prediction with TypeScript ensemble
- [ ] Silent fallback to TypeScript ensemble when backend unavailable
- [ ] Add `MLPrediction` interface to `types/index.ts`

### P3d. LiveService with WebSocket

**New file:** `frontend/src/services/liveService.ts`

- [ ] Svelte store `liveMatchesStore`
- [ ] WebSocket to `ws://localhost:8000/ws` when backend available
- [ ] Falls back to polling when backend unavailable
- [ ] `LiveMatches.svelte` and `LiveTicker.svelte` subscribe to store

### P3e. AI Match Analysis

**New file:** `frontend/src/services/aiAnalysis.ts`

- [ ] `AIAnalysisService` — takes `MatchPrediction`, returns natural language analysis
- [ ] User configures OpenAI/Anthropic key in Settings
- [ ] Supplementary only — does NOT modify numerical probabilities
- [ ] 24h cache per match
- [ ] Update `Help.svelte` to reflect actual AI capabilities

---

## P4 — Polish & Cosmetic (when P1–P2 stable)

### P4a. UI Dead Code Cleanup

- [ ] Remove `Math.random()` star particles in `App.svelte:96-100`
- [ ] Fix hardcoded "Tom Butler" / "tom@example.com" in `Header.svelte:140-141`
- [ ] Fix hardcoded "3 new predictions available" in `Header.svelte:102`
- [ ] Wire or remove Header.svelte search bar (dispatches event but nothing handles it)
- [ ] Wire or remove Header.svelte profile/logout actions
- [ ] Fix `ApiSetupWizard.svelte` Step 3 single-option auto-advance
- [ ] Update `Help.svelte` accuracy claim "60-65%" to use real `predictionTracker` stat
- [ ] Update `Help.svelte` to remove push notifications / offline caching claims

### P4b. Accessibility

- [ ] `role="meter"`, `aria-valuenow/min/max` on prediction probability bars
- [ ] Proper `<label>` elements on Kelly calculator inputs
- [ ] `aria-current="page"` on active nav items
- [ ] `aria-label` on theme toggle and confidence indicators

### P4c. Component Data Accuracy Cleanup

- [ ] `LiveMatches.svelte`: "Auto-refreshing every 30 seconds" label — make dynamic
- [ ] `LiveTicker.svelte`: live dot detection uses `startsWith('⚽')` heuristic — use boolean flag
- [ ] `SeasonStats.svelte`: "Late Drama" metric is HT/FT proxy — rename or document
- [ ] `StandingsTable.svelte`: position movement arrows inferred from form, not real API data

### P4d. betBuilder Improvements

- [ ] Generate 2–4 accumulator combos per match (confidence ≥ 55%, odds ≥ 2.0)
- [ ] Market correlation in combo probability (e.g. clean sheet + over 2.5 negatively correlated)
- [ ] Replace hardcoded combo confidence values (0.65, 0.45, 0.25, 0.40) with calculated
- [ ] Replace `avgCorners: 9.5` and `expectedCards: 3.2` with league averages from match data
- [ ] Expand rivalry list beyond 6 hardcoded entries

---

## Specs

All feature specifications in `specs/`:

| File | Topic |
|------|-------|
| `specs/01-prediction-engine.md` | ELO, Poisson, fatigue, referee, confidence, backtesting |
| `specs/02-data-pipeline.md` | Football-Data.org integration, caching, historical data |
| `specs/03-backend-integration.md` | Python ML backend connection |
| `specs/04-betting-intelligence.md` | Kelly, value bets, bet history, accumulators |
| `specs/05-live-data.md` | Live scores, smart polling, WebSocket |
| `specs/06-prediction-tracking.md` | Accuracy tracking, auto-reconciliation |
| `specs/07-ui-ux.md` | shadcn-svelte migration, dark mode, accessibility |

Write `specs/08-backend-training.md` before starting P3.

---

## Active Stubs (known hardcoded values remaining)

| Location | Problem | Priority |
|----------|---------|----------|
| `advancedPredictions.ts:557` | `avgPenalties: 0.2` — no penalty data from free API tier | Low |
| `optimizedPredictions.ts:415` | `cleanSheetRate: 0.3` — no clean sheet data from free tier | Low |
| `betBuilder.ts:209` | `avgCorners: 9.5` — no corner data from free tier | P4d |
| `betBuilder.ts:236` | `expectedCards: 3.2` — no card data from free tier | P4d |
| `betBuilder.ts:269-276` | Only 6 hardcoded rivalries, case-sensitive | P4d |
| `betBuilder.ts:339-405` | Combo confidence values hardcoded | P4d |
| `Header.svelte:140-141` | Hardcoded "Tom Butler" / "tom@example.com" | P4a |
| `Header.svelte:102` | Hardcoded "3 new predictions available" | P4a |
| `App.svelte:96-100` | `Math.random()` star particles | P4a |
| `Settings.svelte:126-128` | Fake cache size calculation | P2b |
| `advanced_engineering.py` | 102× `np.random.*` — all features fake | P3a |
| `lstm_predictor.py:523` | `get_feature_importance()` returns random values | P3b |
| `modern_oracle.py:404-408` | `_calculate_betting_value()` uses mock odds | P3b |
| `modern_oracle.py:463` | `optimize_ensemble_weights()` returns random | P3b |
| `auth.py:434` | Mock user database lookup | P3b |
