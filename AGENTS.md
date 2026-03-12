## Build & Run

- **Frontend:** `cd frontend && npm install && npm run dev` (localhost:5173)
- **Backend:** `cd backend && docker-compose up` or `uvicorn app.api.main:app --reload --port 8000`

## Validation

- Type check: `cd frontend && npm run check`
- Tests: `cd frontend && npm run test:run`
- Backend tests: `cd backend && pytest tests/ -v`

## Codebase Patterns

- **Routing:** String state `currentView` in `frontend/src/App.svelte`
- **Data access:** Always via `dataService` singleton (`frontend/src/services/dataService.ts`)
- **Prediction storage:** PredictionTracker (localStorage only) — NO Supabase
- **Events:** Svelte `createEventDispatcher` for component communication
- **Styles:** Tailwind utilities first, then named CSS classes from app.css (`.card`, `.card-glass`, `.btn`, `.btn-primary`, `.badge-*`), shadcn components in `src/lib/components/ui/`
- **Icons:** lucide-svelte exclusively

## Prediction Model Pattern

- **New factor:** Implement in `advancedPredictions.ts`, integrate into `OptimizedPredictor.combineModels()` in `optimizedPredictions.ts`, adjust weights to sum to 1.0
- **ELO updates:** Call `eloSystem.updateRatings()` after completed matches

## Data Source

- **API:** Football-Data.org (https://api.football-data.org/v4)
- **API key:** Stored in localStorage as `football_data_api_key`
- **Vite proxy:** `/api/football-data` → football-data.org
- **Backend proxy:** `/api/oracle` → http://localhost:8000

## Known Bugs

None currently tracked. See `IMPLEMENTATION_PLAN.md` for outstanding items.

## Safety

- Only touch files under `frontend/`, `backend/`, `specs/`, and Ralph management files
- No system-level changes or global package installs
- Git commits to current branch only
