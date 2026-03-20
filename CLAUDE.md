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

# Backend (run from backend/ directory — requires conda environment)
conda activate anaconda-ml-ai
cd backend
pip install -r requirements.txt
uvicorn app.api.main:app --reload --port 8000
```

## Code Architecture

### Frontend Structure (`frontend/src/`)
- `components/` - Svelte components (Dashboard, Predictions, LiveMatches, etc.)
- `components/betting/` - Betting UI (KellyCalculator, ValueBets, AccumulatorBuilder)
- `lib/` - Core prediction libraries:
  - `advancedPredictions.ts` - Statistical models (ELO, Poisson, xG, Fatigue, Referee)
  - `optimizedPredictions.ts` - Weighted ensemble orchestrator (production model)
  - `betBuilder.ts` - Multi-market prediction generator
  - `renderMarkdown.ts` - Shared markdown→HTML renderer (DOMPurify sanitised)
  - `constants.ts` - Shared constants (`DEFAULT_HOME_WIN_RATE`, `DEFAULT_DRAW_RATE`, `VALUE_ODDS_MARGIN`)
  - `utils.ts` - Shared utilities (`cn()`, `focusTrap()`, `getSeasonYear()`, `getSeasonLabel()`)
- `services/` - Data and business logic:
  - `api/footballData.ts` - Football-Data.org API client with rate limiting + request queue
  - `dataService.ts` - Singleton data layer (cache + API + progressive historical loader)
  - `predictionTracker.ts` - Prediction persistence + calibration factors (localStorage)
  - `betting/kelly.ts` - Kelly Criterion calculator
  - `betting/value.ts` - Value bet detection engine (imports PoissonPredictor from advancedPredictions)
  - `betting/betHistoryService.ts` - Bet persistence and ROI tracking (localStorage)
- `types/index.ts` - Shared TypeScript types
- `App.svelte` - Root component with routing
- `app.css` - Global styles with glassmorphism theme

### Backend Structure (`backend/`)
- `app/api/main.py` - FastAPI server with prediction + chat endpoints
- `app/api/rag.py` - DataFrame RAG engine (team extraction, intent parsing, query builder, prompt grounding)
- `app/features/free_tier_features.py` - Free-tier feature engineering (99 features incl. 8 draw indicators + 5 Elo)
- `app/data/football_data_collector.py` - Historical data collection
- `train_free_tier.py` - Free-tier training script (XGBoost + stacked OvR ensemble + LR baseline) — lives at `backend/` root, not inside `app/`

### Key Design Decisions
- **Single data source**: Football-Data.org API v4. No Supabase.
- **Frontend-first**: TypeScript ensemble runs entirely in browser. Python backend is optional enhancement.
- **localStorage persistence**: ELO ratings, predictions, bets, settings all in localStorage.
- **Vite proxy**: `/api/football-data` proxies to `https://api.football-data.org/v4`

## Specifications

All feature specifications live in `specs/`:
- `01-prediction-engine.md` - ELO, Poisson, fatigue, referee, confidence, backtesting — **100% (8/8)**
- `02-data-pipeline.md` - Football-Data.org integration, caching, historical data — **100% (8/8)**
- `03-backend-integration.md` - Python ML backend connection — **100% (8/8)**
- `04-betting-intelligence.md` - Kelly, value bets, bet history, accumulators — **100% (12/12)**
- `05-live-data.md` - Live scores, smart polling — **100% (10/10)**
- `06-prediction-tracking.md` - Accuracy tracking, auto-reconciliation — **100% (7/7)**
- `07-ui-ux.md` - shadcn-svelte migration, dark mode, accessibility — **100% (17/17)**
- `08-backend-training.md` - Backend ML training pipeline — **~95% (23/24)** Pro-tier Req 6 deferred

These specs are the single source of truth for requirements. **All 99 active acceptance criteria met.**

### Coding Standards
- Use TypeScript for all new frontend code
- Follow existing Svelte component patterns
- Maintain dark/light theme compatibility
- Use Tailwind CSS classes for styling
- Check types before committing: `cd frontend && npm run check`
- Run tests before committing: `cd frontend && npm run test:run`

## Current Focus — P7 Beyond MVP

**P0–P6:** ALL DONE — MVP shipped and verified by two full codebase audits (19–20 March 2026).

**P7 improvements** (see `IMPLEMENTATION_PLAN.md` for full details — 0/46 items):

| Item | Description | Priority |
|------|-------------|----------|
| P7a | Model accuracy — odds-as-features, draw overhaul, calibration, retraining | High |
| P7b | AI integration — configurable model (`gpt-4o-mini` hardcoded), Claude support | Medium |
| P7c | Seasonal maintenance — SEED_RATINGS, teamColors, aliases for promotion/relegation | Required annually |
| P7d | Frontend enhancements — backtest-derived weights, real odds input | Low |
| P7e | Infrastructure — Playwright in CI, rate-limit persistence, pin `openai`/`ruff` versions | Low |
| P7f | Season Timeline — interactive visual timeline of 2025/26 key moments | New feature |
| P7g | Frontend Polish — team theme toggle fix, FAQ, README overhaul, Dashboard weights display | Medium |
| P7h | RAG Intelligence — player data enrichment, web search fallback | Medium |
| P7i | Frontend Design Uplift — empty states, richer prediction cards, standings zones, loading states | Medium |

**Active branches:** `v3.0-MVP` (current), `v3.0-Development` (integration), `pro-tier-archive` (archived Pro-tier code — pushed to remote)

## Current State & Gotchas

### Test Coverage
- **Frontend:** 519 Vitest tests (32 files), 43 Playwright E2E tests (6 specs × 3 viewports = 123 executions), all passing
- **Backend:** 131 pytest tests (4 files), all non-skip passing (8 skip without libomp)
- **CI:** GitHub Actions runs type check, unit tests with coverage (60/65/65/60 thresholds), ESLint, ruff, production build
- **Untested components (4):** Header, MobileNav, SidebarNav, Sidebar — layout/navigation only

### Frontend Gotchas
- `Prediction` type in `types/index.ts` is a view-model for Predictions.svelte card display — `StoredPrediction` is the persistence type used by `predictionTracker`
- `KellyCalculator.svelte` edge display: `edgePercentage` from `kelly.ts` is already a percentage (e.g. 5.0 for 5%) — do NOT multiply by 100 again in the template
- `betHistoryService.StoredBet.market` uses `'over_2_5'` format but `value.ts ValueBet.market` uses `'over2.5'` — mitigated by `ValueBets.svelte` `mapMarket()` conversion
- `SEED_RATINGS` in `advancedPredictions.ts` contains only the 20 current PL teams — unknown teams fall back to `DEFAULT_RATING` (1500). Needs seasonal update on promotion/relegation
- `Settings.svelte` `teamColors` hardcodes current season teams — needs seasonal update
- shadcn-svelte: 7 components (Button, Card, Badge, Separator, Skeleton, Dialog, Sheet) all wired. Custom implementations (no bits-ui). `components.json` exists for `npx shadcn-svelte@latest add`
- Svelte 4 `any` limitations: `SeasonStats.svelte` icon prop, `Sidebar/MobileNav` keydown handlers — cannot be resolved without `any`

### Backend Gotchas
- Server starts cleanly — only free-tier dependencies required. Pro-tier code archived to `pro-tier-archive` branch
- `backend/spreadsheets/` is gitignored — CSV training data (2,191 matches) not included in repo clone
- CORS includes `allow_origin_regex=r"https://.*\.vercel\.app"` for Vercel production + preview deployments

### Data Constraints
- Football-Data.org free tier: no xG, shots, possession, cards, corners — limits ~70 backend features permanently
- Free-tier ML model: 51.0% accuracy (XGBoost + stacked OvR ensemble). Draw prediction essentially non-functional (6.7% accuracy). Model at `backend/models/xgboost_free_tier.joblib`

### Architecture Notes
- `liveService.ts` is polling-only (WebSocket infrastructure removed) with adaptive intervals and polling-diff event detection
- `footballData.ts` `rateLimitedFetch()` uses promise-based request queue for serialised API access
- `dataService.ts` progressively fetches seasons 2020-2024 in background on startup, then warm-starts ELO ratings from all cached historical matches (idempotent, runs once per 24h)
- Single Poisson implementation in `advancedPredictions.ts` (`PoissonPredictor`) — shared by `value.ts` and `betBuilder.ts`
- ELO home advantage is the single source of truth (form analysis no longer applies momentum adjustments)
- `svelte-check` reports 0 errors, 0 warnings

### The #1 Rule of E2E Tests
A test MUST fail when the feature it tests is broken. No exceptions. If a real user would see something broken, the test must fail. No "fixing the app inside the test". A passing test that hides a broken feature is worse than no test at all.

## Completed Work

All completed P0–P5h work (20 audits, hundreds of fixes) is documented in `CHANGELOG.md`.
Pro-tier deferred work (P3a–d) is detailed in `IMPLEMENTATION_PLAN.md`.
