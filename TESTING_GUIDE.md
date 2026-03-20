# Testing Guide

Quick reference for testing the Premier League Oracle. Pick this up cold after a week away.

---

## Quick Start

```bash
# Terminal 1 — Backend (Python)
conda activate anaconda-ml-ai
cd backend
uvicorn app.api.main:app --reload --port 8000

# Terminal 2 — Frontend (Node)
cd frontend
npm run dev    # → http://localhost:5173
```

Both need to be running for full functionality. The frontend works without the backend but RAG chat and ML predictions require it.

---

## Frontend Tests

```bash
cd frontend

# TypeScript + Svelte type check (must pass before committing)
npm run check

# Unit tests — 540 tests across 33 files
npm run test:run          # One-shot, no watch
npm run test              # Watch mode (re-runs on file changes)
npm run test:coverage     # With coverage report (thresholds: 60/65/65/60)

# E2E tests — 43 tests across 6 specs (3 viewports each = 123 executions)
npx playwright test                          # Headless
npx playwright test --headed                 # See the browser
npx playwright test --ui                     # Interactive UI
npx playwright show-report                   # View last report (localhost:9323)
```

**Coverage thresholds** (enforced in CI): statements 60%, branches 65%, functions 65%, lines 60%.

---

## Backend Tests

```bash
conda activate anaconda-ml-ai
cd backend

# All tests — 163 across 4 files
python -m pytest tests/ -v

# Specific test files
python -m pytest tests/test_free_tier_features.py -v     # 55 feature engineering tests (incl. 10 odds)
python -m pytest tests/test_train_free_tier.py -v         # 33 training pipeline tests (incl. 5 odds + 3 calibration)
python -m pytest tests/test_predict_free_tier.py -v       # 17 prediction endpoint tests
python -m pytest tests/test_rag.py -v                     # 58 RAG engine tests

# Note: 8 tests skip without libomp on macOS — this is expected
```

---

## Endpoint Testing (curl)

Backend must be running on port 8000.

```bash
# 1. Health check — should return {"status":"healthy","free_tier_model_loaded":true}
curl http://localhost:8000/health

# 2. Prediction — should return probabilities and predicted outcome
curl -X POST http://localhost:8000/predict/free \
  -H "Content-Type: application/json" \
  -d '{"home_team":"Arsenal","away_team":"Chelsea"}'

# 3. Model info — should return version, features, training metadata
curl http://localhost:8000/models/free-tier/info

# 4. RAG Chat — should return an AI-generated grounded response
curl -X POST http://localhost:8000/chat/rag \
  -H "Content-Type: application/json" \
  -d '{"message":"How is Liverpool doing this season?"}'
```

**If RAG returns "No OpenAI API key configured":** The `.env` file isn't being loaded. Check that `backend/.env` contains `OPENAI_API_KEY=sk-...` and restart the backend.

---

## Model Retraining

```bash
conda activate anaconda-ml-ai
cd backend

# Full training run (~3 minutes)
python train_free_tier.py

# Output: model saved to backend/models/xgboost_free_tier.joblib
# Calibration curve saved to backend/models/calibration_curve.png
```

**Expected results (March 2026):**
- XGBoost calibrated: ~52.6% accuracy
- LR baseline: ~44.3%
- Draw accuracy: ~1.9% (essentially non-functional — P7a improvement)

---

## Health Check Checklist

Run this when you haven't touched the project in a while:

- [ ] `cd frontend && npm run check` → 0 errors, 0 warnings
- [ ] `cd frontend && npm run test:run` → 540 tests pass
- [ ] `conda activate anaconda-ml-ai && cd backend && python -m pytest tests/ -v` → 163 tests pass (8 skip OK)
- [ ] Backend starts: `uvicorn app.api.main:app --reload --port 8000`
- [ ] `curl http://localhost:8000/health` → healthy, model loaded
- [ ] Frontend starts: `cd frontend && npm run dev`
- [ ] Open http://localhost:5173 → Dashboard loads with data
- [ ] Oracle Chat responds (type a message in the chat)

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| RAG chat says "No API key" | `.env` not loaded | Restart backend — `load_dotenv()` reads `backend/.env` on startup |
| Frontend shows no data | API key not set | Add Football-Data.org key in Settings |
| Backend won't start | Wrong Python env | `conda activate anaconda-ml-ai` first |
| Playwright tests fail | Browser not installed | `npx playwright install chromium` |
| Rate limit errors | Too many API calls | Wait 60 seconds, or check rate limit queue in footballData.ts |
| Type check errors | Stale node_modules | `cd frontend && rm -rf node_modules && npm install` |

---

## CI Pipeline

GitHub Actions runs on every push across three parallel jobs:

**Frontend checks**
1. ESLint
2. TypeScript/Svelte check (`npm run check`)
3. Unit tests with coverage (`npm run test:coverage`)
4. Production build (`npm run build`)

**Playwright E2E tests** (separate job)
- Runs 43 tests across 6 specs with Chromium at 3 viewports (123 executions total)
- HTML report uploaded as an artifact on every run, retained for 14 days

**Backend checks**
1. ruff linting
2. pytest (`python -m pytest tests/ -v`)
