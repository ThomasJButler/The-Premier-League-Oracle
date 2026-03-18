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
- `features/advanced_engineering.py` - 150+ feature engineering pipeline
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
- See `IMPLEMENTATION_PLAN.md` for the prioritised task list
- Active branches: `v3.0-BackendMLTraining` (backend ML), `v3.0-Frontend` (frontend), `v3.0-Development` (integration)
- Ralph loop configured via `loop.sh` + `PROMPT_plan.md` + `PROMPT_build.md`

### Important Notes
- `frontend/src/` is the active codebase (old `src/` directory has been removed)
- shadcn-svelte partially set up — 5 components installed (Button, Card, Badge, Separator, Skeleton) but only Separator wired into UI; `components.json` exists (enables `npx shadcn-svelte@latest add`)
- Backend server starts with graceful degradation — all heavy deps (shap, optuna, redis, sklearn, joblib, langchain, torch) are optional with availability flags; ML endpoints disabled when deps missing but `/health` returns 200
- Backend feature engineering: 0 `np.random.*` calls in feature methods (was 102), but 49 methods return hardcoded `0.0` — tactics, player-level, betting market, weather features all stubbed. **2 `np.random` calls remain** in `lstm_predictor.py:523` (fake feature importance) and `modern_oracle.py:581` (fake ensemble optimisation)
- Backend security modules (`auth.py`, `secrets.py`, `validators.py`) are entirely unused at runtime — not imported by `main.py`
- Backend has 0% test coverage (`test_setup.py` only checks imports — no assertions)
- Frontend has 378 Vitest tests across 21 test files, all passing
- 43 Playwright E2E tests across 6 spec files (0 skipped), run in 3 viewports = 123 total executions
- 8 components have unit tests (Dashboard, BettingHistory, ChatBot, LiveMatches, Predictions, Settings, KellyCalculator, ValueBets) — 10 components untested
- `betBuilder.ts` has 40 tests and `value.ts` has 38 tests — both fully covered
- `predictions.ts` is entirely dead at runtime — zero imports from any component; only tested, never called
- 3 new service files need creating: backendService, liveService, aiAnalysis (`backtest.ts` already created)
- `ChatBot.svelte` makes direct browser-to-OpenAI API calls (key visible in network tab) — security warning banner added but architecture unchanged
- Football-Data.org free tier constraint: xG, shots, possession, cards, corners data unavailable — limits ~70 backend features permanently
- `SeasonStats.svelte` lateDrama uses `full_time_result !== half_time_result` — both fields exist on `Match` type and are populated by `transformMatch`; relabelled to "Results changed after halftime"
- `Prediction` type in `types/index.ts` is a dead legacy interface — diverges from `StoredPrediction` (the actual runtime type)
- `Help.svelte` had 5 major inaccuracies fixed in P1f; remaining issues: "offline data caching" claim (no Service Worker), "CSV export" (exports JSON), aspirational feature claims, made-up accuracy percentages in "Golden Rules"
- `.gitignore` has `backend/.env` (fixed 18 March 2026) — API keys protected
- `backend/docs/FOR_BEGINNERS.md` and `backend/README.md` have broken links to deleted guide files
- **No `vercel.json` exists** — the Vite dev proxy (`/api/football-data`) only works locally. Production Vercel deploys cannot reach Football-Data.org API. A serverless proxy or Vercel rewrites needed for production deployment
- CSV training data in `backend/spreadsheets/KnowledgeFilesCSV/` — 2,191 matches across 5.75 seasons with shots, corners, cards, odds columns (richer than what the free API provides). These are the primary source for ML training
- `torch` is missing from `requirements.txt` but present in `environment.yml` — LSTM/Transformer models non-functional via pip install alone
- Root `.env.example` still references Supabase variables (stale)
- MIT licensed for open-source collaboration

### The #1 Rule of E2E Tests A test MUST fail when the feature it tests is broken. No exceptions. If a real user would see something broken, the test must fail. No "fixing the app inside the test". A passing test that hides a broken feature is worse than no test at all.