# Spec 03: Backend Integration

**JTBD: Connect the Python ML backend to the Svelte frontend so real ML predictions power the UI**

---

## Current State

The Python backend in `backend/` is fully built but **zero frontend code calls it**. It has:

> **Note (March 2026 audit — updated):** The backend server now starts with graceful degradation — all heavy deps (LangChain, ChromaDB, torch, shap, optuna) are wrapped in try/except with availability flags. ML endpoints are disabled when deps are missing but `/health` returns 200. Feature engineering methods no longer return `np.random.uniform()` — 63 methods now return hardcoded `0.0` (still stubs, but not random). See `IMPLEMENTATION_PLAN.md` P3 for the remediation plan.

- FastAPI server: `backend/app/api/main.py`
- XGBoost model: `backend/app/models/xgboost_model.py`
- LSTM model: `backend/app/models/lstm_predictor.py`
- Transformer model: `backend/app/models/transformer_model.py`
- Ensemble orchestrator: `backend/app/models/modern_oracle.py`
- 150+ feature pipeline: `backend/app/features/advanced_engineering.py`
- Data collector: `backend/app/data/football_data_collector.py`
- Docker Compose: `backend/docker-compose.yml` (includes Redis + MLflow)

---

## Backend API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/predict` | Single match prediction |
| POST | `/predict/batch` | Batch predictions for multiple matches |
| GET | `/predict/upcoming` | Predictions for all upcoming PL fixtures |
| POST | `/nl-query` | Natural language query (LangChain) |
| POST | `/team-stats` | Team statistics with ML features |
| WS | `/ws` | WebSocket for real-time updates |

Auth: `HTTPBearer` token. For development, support `ORACLE_API_TOKEN` env var or an unauthenticated dev mode flag.

---

## Frontend Integration Plan

### Step 1: Vite Proxy

Add to `frontend/vite.config.ts`:

```typescript
'/api/oracle': {
  target: 'http://localhost:8000',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/oracle/, '')
}
```

### Step 2: BackendService

Create `frontend/src/services/backendService.ts`:

```typescript
class BackendService {
  private baseUrl = '/api/oracle'
  private token = localStorage.getItem('oracle_api_token') || ''

  async isAvailable(): Promise<boolean>
  async predictMatch(homeTeam: string, awayTeam: string): Promise<MLPrediction>
  async predictBatch(matches: MatchFixture[]): Promise<MLPrediction[]>
  async getUpcomingPredictions(): Promise<MLPrediction[]>
  async queryNaturalLanguage(query: string): Promise<string>
  async getTeamStats(teamName: string): Promise<MLTeamStats>
}

export const backendService = new BackendService()
```

Key design decisions:
- `isAvailable()` pings `/health` — if the backend is down, return `false` immediately
- All methods are graceful: if backend is unavailable, they throw `BackendUnavailableError`
- `predictMatch()` returns an `MLPrediction` that includes probabilities, confidence, and feature importance

### Step 3: Feature Flag

Add `useBackend: boolean` to Settings (stored in localStorage as `use_backend`).

Integration point in `OptimizedPredictor.predictMatch()`:

```typescript
// If backend is enabled and available, use ML prediction
if (settings.useBackend) {
  try {
    const available = await backendService.isAvailable()
    if (available) {
      const mlPrediction = await backendService.predictMatch(homeTeam, awayTeam)
      return mergeWithEnsemble(mlPrediction, ensembleResult)
    }
  } catch {
    // Silent fallback — user sees a small indicator
  }
}
// Fall back to TypeScript ensemble
return ensembleResult
```

### Step 4: ML Prediction Type

Add to `frontend/src/types/index.ts`:

```typescript
export interface MLPrediction {
  homeWinProbability: number
  drawProbability: number
  awayWinProbability: number
  confidence: number
  predictedScore: { home: number; away: number }
  modelBreakdown: {
    xgboost: { home: number; draw: number; away: number }
    lstm: { home: number; draw: number; away: number }
    transformer: { home: number; draw: number; away: number }
  }
  featureImportance: Record<string, number>
  aiAnalysis?: string
}
```

---

## Historical Data for Model Training

The Python backend needs 5 seasons of data to train. `backend/app/data/football_data_collector.py` already exists — wire it up:

1. The data collector should use the same Football-Data.org API (same key from `.env`)
2. Run `python -m app.data.football_data_collector --seasons 2020,2021,2022,2023,2024` to populate training data
3. Add this command to `AGENTS.md` so Ralph knows to run it before training
4. Training should produce model files in `backend/models/` (create this directory)

---

## WebSocket for Live Updates

When backend is running, `LiveMatches.svelte` and `LiveTicker.svelte` should use WebSocket instead of polling:

```typescript
// frontend/src/services/liveService.ts
class LiveService {
  private ws: WebSocket | null = null

  connect() {
    this.ws = new WebSocket('ws://localhost:8000/ws')
    this.ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      // Dispatch Svelte store update
    }
  }
}
```

WebSocket falls back to polling if backend is not available.

---

## AI Analysis via Backend

The backend has LangChain integration. Add a route that:
1. Takes a match fixture
2. Constructs a prompt with team form, H2H, odds context
3. Returns a natural language pundit-style analysis

This analysis is displayed as an optional card in the Predictions component.

---

## Running the Backend

```bash
# With Docker (recommended)
cd backend && docker-compose up

# Local (requires Redis on port 6379)
cd backend
pip install -r requirements.txt
uvicorn app.api.main:app --reload --port 8000

# Train models (run once after data collection)
cd backend
python -m app.models.modern_oracle --train --seasons 2020,2021,2022,2023,2024
```

---

## Acceptance Criteria

- [ ] `BackendService` class created with `isAvailable()`, `predictMatch()`, `predictBatch()`
- [ ] Vite proxy configured for `/api/oracle`
- [ ] `useBackend` toggle in Settings, persisted to localStorage
- [ ] `OptimizedPredictor` calls backend when feature flag is on, falls back gracefully
- [ ] WebSocket connection established when backend available
- [ ] Historical data collection command documented in `AGENTS.md`
- [ ] ML prediction type defined in `frontend/src/types/index.ts`
- [ ] Settings UI shows backend connection status (connected / disconnected)
