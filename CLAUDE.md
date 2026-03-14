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
- Active development on branch `v2.0-Development`
- Ralph loop configured in `how-to-ralph-wiggum/`

### Important Notes
- `frontend/src/` is the active codebase (old `src/` directory has been removed)
- shadcn-svelte needs initialising before UI migration (Phase 6 in plan)
- Backend server will NOT start — broken LangChain/ChromaDB imports in `modern_oracle.py` must be fixed first
- Backend models are scaffolded but need training data and pipeline completion — 102 `np.random.*` calls in feature engineering return random values
- Backend has 0% test coverage (no pytest tests)
- Frontend has 197 Vitest tests across 11 test files, all passing
- `betBuilder.ts` and `value.ts` have zero test coverage (complex logic, high priority)
- 4 new service files need creating: backendService, liveService, aiAnalysis, backtest
- `ValueBets.svelte` now uses manual odds entry — users input real bookmaker odds for value analysis (Math.random() removed)
- Predictions.svelte uses Kelly Criterion for stake sizing (replaced arbitrary linear formula)
- Dynamic season labels in StandingsTable and TopScorers (replaced hardcoded "2024/25")
- DataService dead methods removed (`setDataSource`, `getApiProvider`); live cache uses 60s TTL
- MIT licensed for open-source collaboration
