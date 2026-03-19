# Spec 03: Backend Integration

**JTBD: Connect the Python ML backend to the Svelte frontend so real ML predictions power the UI**

---

## Current State

The Python backend in `backend/` is integrated with the frontend via `BackendService`. Key components:

> **Note (March 2026 audit — updated):** The backend server now starts with graceful degradation — all heavy deps (LangChain, ChromaDB, torch, shap, optuna) are wrapped in try/except with availability flags. ML endpoints are disabled when deps are missing but `/health` returns 200. Feature engineering methods no longer return `np.random.uniform()` — 63 methods now return hardcoded `0.0` (still stubs, but not random). See `IMPLEMENTATION_PLAN.md` P3 for the remediation plan.

- FastAPI server: `backend/app/api/main.py`
- XGBoost model: `backend/app/models/xgboost_model.py`
- LSTM model: `backend/app/models/lstm_predictor.py`
- Transformer model: `backend/app/models/transformer_model.py`
- Ensemble orchestrator: `backend/app/models/modern_oracle.py`
- 150+ feature pipeline: `backend/app/features/advanced_engineering.py`
- Data collector: `backend/app/data/football_data_collector.py`
- Docker Compose: `backend/docker-compose.yml` (just `oracle-api` — Redis/MLflow/Postgres/Jupyter/Nginx commented out since P2o)

---

## Backend API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/predict` | Single match prediction (Pro-tier Oracle) |
| POST | `/predict/free` | Free-tier XGBoost prediction |
| GET | `/predict/upcoming` | Predictions for all upcoming PL fixtures |
| GET | `/health` | Health check (backend availability) |
| GET | `/models/free-tier/info` | Free-tier model metadata |

Note: `POST /predict/batch`, `POST /team-stats`, and `WS /ws` were removed — `predictBatch()` and `getTeamStats()` were dead code (P5ak); WebSocket was removed from frontend in P5v.

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
  async getUpcomingPredictions(): Promise<MLPrediction[]>
  async queryNaturalLanguage(query: string): Promise<string>
}

export const backendService = new BackendService()
```

> **Note (P5ak):** `predictBatch()` and `getTeamStats()` were removed as dead code — never called at runtime.

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

## ~~WebSocket for Live Updates~~ — SUPERSEDED (P5v)

> **Note (P5v):** WebSocket infrastructure was entirely removed from the frontend. `liveService.ts` is now polling-only with adaptive intervals and polling-diff match event detection (`matchEventsStore`). `MatchEventToast.svelte` renders colour-coded toast notifications for goals and status changes (auto-expire 30s). The backend `/ws/predictions` endpoint still exists but the frontend no longer connects to it.

The original design (shown below for historical reference) called for WebSocket when the backend was running:

```typescript
// HISTORICAL — no longer implemented in the frontend
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

---

## AI Analysis via Backend — Deferred (Pro-tier, P3a–d)

> **Note:** Backend LangChain-based AI analysis is deferred to Pro-tier. The frontend has its own `aiAnalysis.ts` service (Spec 01 Req 6) that calls OpenAI/Anthropic directly via the `/api/chat` proxy.

The backend has LangChain integration. Add a route that:
1. Takes a match fixture
2. Constructs a prompt with team form, H2H, odds context
3. Returns a natural language pundit-style analysis

This analysis is displayed as an optional card in the Predictions component.

---

## Running the Backend

```bash
# With Docker (just oracle-api service)
cd backend && docker-compose up

# Local
cd backend
pip install -r requirements.txt
uvicorn app.api.main:app --reload --port 8000

# Train free-tier model (run once after CSV data is in place)
cd backend
python train_free_tier.py
```

> **Note (P2o):** Redis, MLflow, Postgres, Jupyter, and Nginx services were commented out in `docker-compose.yml` — only `oracle-api` runs. Redis is not required for the free-tier stack.

---

## Acceptance Criteria

> Updated 24 March 2026 — markers synced with IMPLEMENTATION_PLAN.md

- [x] `BackendService` class created with `isAvailable()`, `predictMatch()` — dead methods `predictBatch()` and `getTeamStats()` removed in P5ak
- [x] Vite proxy configured for `/api/oracle`
- [x] `useBackend` toggle in Settings, persisted to localStorage
- [x] `OptimizedPredictor` calls backend when feature flag is on, falls back gracefully
- [x] ~~WebSocket connection established when backend available~~ WebSocket infrastructure removed in P5v — `liveService` is now polling-only with adaptive intervals. The backend `/ws/predictions` endpoint still exists but the frontend no longer connects to it
- [x] Historical data collection command documented in `AGENTS.md`
- [x] ML prediction type defined in `frontend/src/types/index.ts`
- [x] Settings UI shows backend connection status (connected / disconnected)
