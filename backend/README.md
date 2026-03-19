# Premier League Oracle — ML Backend

## Current Status

| Component | Status |
|---|---|
| FastAPI server | Running — graceful degradation if heavy deps missing |
| Free-tier XGBoost model | **Trained** — 51.0% accuracy (trained 18 March 2026) |
| Free-tier feature engineering | 86 features, standalone, no heavy deps |
| Pro-tier models (LSTM, Transformer, Oracle ensemble) | Scaffolded — explicitly deferred, not trained |
| Backend tests | **62 tests across 3 files — all passing** |
| Redis | Optional — server starts without it |
| LangChain / ChromaDB | Optional — server starts without them |

---

## What This Does

The backend provides a REST API for Premier League match predictions. The active prediction path uses a trained XGBoost model with 86 free-tier features derived from CSV historical data and the Football-Data.org API. Pro-tier models (LSTM, Transformer, full oracle ensemble) are scaffolded but deferred.

The frontend connects exclusively to the `/predict/free` endpoint.

---

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── main.py                       # FastAPI server
│   ├── features/
│   │   ├── free_tier_features.py         # 86-feature pipeline (active)
│   │   └── advanced_engineering.py       # 150+ feature pipeline (Pro-tier, deferred — 63 methods return 0.0)
│   ├── models/
│   │   ├── xgboost_model.py              # XGBoost (Pro-tier wrapper, unused at runtime)
│   │   ├── lstm_predictor.py             # LSTM (scaffolded, untrained)
│   │   ├── transformer_model.py          # Transformer (scaffolded, untrained)
│   │   └── modern_oracle.py              # Ensemble orchestrator (scaffolded, untrained)
│   ├── data/
│   │   └── football_data_collector.py    # Football-Data.org API v4 client
│   └── security/
│       ├── auth.py                       # JWT / OAuth2 (not wired into main.py)
│       ├── validators.py
│       └── secrets.py
├── models/
│   └── xgboost_free_tier.joblib          # Trained free-tier model
├── tests/
│   ├── test_free_tier_features.py        # 39 feature engineering tests
│   ├── test_train_free_tier.py           # 12 training pipeline tests
│   └── test_predict_free_tier.py         # 11 API endpoint tests
├── spreadsheets/
│   └── KnowledgeFilesCSV/                # 2,191 matches across 5.75 seasons (gitignored)
├── train_free_tier.py                    # Active training script
├── requirements.txt
├── environment.yml
├── Dockerfile
└── docker-compose.yml
```

---

## Quick Start

### Install Dependencies

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Configuration

Create a `.env` file in `backend/`:

```bash
FOOTBALL_DATA_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here  # Optional — only needed for LangChain natural language queries
```

### Run the API

```bash
uvicorn app.api.main:app --reload --port 8000
# API:              http://localhost:8000
# Interactive docs: http://localhost:8000/docs
```

Redis, MLflow, and LangChain are all optional — the server starts and serves predictions without them.

---

## Working Endpoints

### Health check
```bash
GET /health
```

### Free-tier prediction (active — used by the frontend)
```bash
POST /predict/free
Content-Type: application/json

{
  "home_team": "Arsenal FC",
  "away_team": "Chelsea FC",
  "match_date": "2026-03-22"
}
```

Returns home win / draw / away win probabilities with confidence scores.

### Free-tier model info
```bash
GET /models/free-tier/info
```

Returns model metadata: accuracy, feature count, training date.

---

## Training the Free-Tier Model

The training script expects the CSV data in `backend/spreadsheets/KnowledgeFilesCSV/`. This directory is gitignored — you need to supply the CSVs manually.

```bash
cd backend
python train_free_tier.py
```

This runs an XGBoost model with a logistic regression baseline, using a chronological train/test split. The trained model is saved to `backend/models/xgboost_free_tier.joblib`.

Current result: **51.0% accuracy** (3-class: home win / draw / away win).

### Feature engineering

`app/features/free_tier_features.py` — `FreeTierFeatureEngineer` class, 86 features, no heavy dependencies. Works standalone from the Football-Data.org free tier (no xG, shots, possession, cards, or corners — those aren't available on the free API tier).

---

## Pro-Tier (Deferred)

`app/features/advanced_engineering.py` contains a 150+ feature pipeline. 63 of its methods currently return hardcoded `0.0` — they cover tactics, player-level data, betting market signals, weather, and advanced metrics that require a paid data source. The LSTM, Transformer, and oracle ensemble models in `app/models/` are scaffolded but untrained.

Pro-tier work is explicitly out of scope for the current phase.

---

## Tests

```bash
cd backend
pytest tests/
pytest tests/ -v          # verbose
pytest tests/ --cov=app   # with coverage
```

62 tests across 3 files, all passing:
- `test_free_tier_features.py` — 39 tests covering the feature engineering pipeline
- `test_train_free_tier.py` — 12 tests covering the training script
- `test_predict_free_tier.py` — 11 tests covering the `/predict/free` API endpoint

CI runs backend tests on every push and PR via `.github/workflows/ci.yml`.

---

## Known Limitations

- `torch` is in `environment.yml` but not `requirements.txt` — LSTM/Transformer models non-functional via `pip install` alone
- `docker-compose.yml` references missing files (`config.yml`, `nginx.conf`, `notebooks/`) — cannot start as-is
- `app/security/` modules (`auth.py`, `secrets.py`, `validators.py`) are not imported by `main.py` — unused at runtime
- CSV training data in `backend/spreadsheets/` is gitignored — cloning the repo does not include it
- Security modules (`auth.py`, `secrets.py`, `validators.py`) exist in `app/security/` but are not imported by `main.py` — unused at runtime
- `advanced_engineering.py`: `_is_derby_match()` uses API-format team names but training CSVs use short names — derby detection always returns `0.0` during training

---

## Requirements

- Python 3.10+
- Football-Data.org API key (free tier sufficient for the active prediction path)
- OpenAI API key (optional — only for LangChain natural language queries)

---

## Links

- [Interactive API Docs](http://localhost:8000/docs) (when server is running)
- [Training Spec](../specs/08-backend-training.md)

---

## Licence

MIT — use however you want.
