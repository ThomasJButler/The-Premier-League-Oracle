# Premier League Oracle — ML Backend

## Current Status

| Component | Status |
|---|---|
| FastAPI server | Running — graceful degradation if heavy deps missing |
| Free-tier XGBoost model | **Trained** — 51.9% accuracy with odds features (retrained 20 March 2026) |
| Free-tier feature engineering | 109 features (incl. 10 bookmaker odds), standalone, no heavy deps |
| Pro-tier models (LSTM, Transformer, Oracle ensemble) | Archived to `pro-tier-archive` branch — not in working tree |
| Backend tests | **163 tests across 4 files — all non-skip tests passing** |
| Redis | Optional — server starts without it |
| LangChain / ChromaDB | Optional — server starts without them |

---

## What This Does

The backend provides a REST API for Premier League match predictions. The active prediction path uses a trained XGBoost model with a stacked OvR ensemble, built on 99 free-tier features derived from CSV historical data and the Football-Data.org API. Pro-tier models (LSTM, Transformer, full oracle ensemble) have been archived to the `pro-tier-archive` branch.

The frontend connects exclusively to the `/predict/free` endpoint.

---

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── main.py                       # FastAPI server
│   ├── features/
│   │   └── free_tier_features.py         # 99-feature pipeline (active)
│   ├── models/
│   │   └── xgboost_model.py              # XGBoost wrapper
│   ├── data/
│   │   └── football_data_collector.py    # Football-Data.org API v4 client
│   └── security/
│       ├── auth.py                       # JWT / OAuth2 (not wired into main.py)
│       ├── validators.py
│       └── secrets.py
├── models/
│   └── xgboost_free_tier.joblib          # Trained free-tier model
├── tests/
│   ├── test_free_tier_features.py        # 45 feature engineering tests (incl. Elo leakage)
│   ├── test_train_free_tier.py           # 25 training pipeline tests (incl. rolling CV, ensemble)
│   ├── test_predict_free_tier.py         # 17 API endpoint tests
│   └── test_rag.py                       # 58 RAG engine tests
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

### CSV training data

The training script expects season CSV files in `backend/spreadsheets/KnowledgeFilesCSV/`. This directory is gitignored — you need to supply the CSVs yourself.

**Source:** The CSVs were originally exported from [Football-Data.co.uk](https://www.football-data.co.uk/englandm.php) (free, no account required). Each file covers one Premier League season.

**Expected format:** One CSV per season, named like `PL_19_20.csv`, `PL_20_21.csv`, etc. Required columns:

| Column | Description |
|---|---|
| `Date` | Match date (DD/MM/YYYY) |
| `HomeTeam`, `AwayTeam` | Team short names (e.g. "Arsenal", "Man City") |
| `FTHG`, `FTAG` | Full-time home/away goals |
| `FTR` | Full-time result: H / D / A |
| `HTHG`, `HTAG` | Half-time home/away goals |
| `HTR` | Half-time result: H / D / A |
| `HS`, `AS` | Home/away shots |
| `HST`, `AST` | Home/away shots on target |
| `HC`, `AC` | Home/away corners |
| `HY`, `AY` | Home/away yellow cards |
| `HR`, `AR` | Home/away red cards |
| Various odds columns | B365H, B365D, B365A, etc. (optional — used for calibration if present) |

The current dataset spans 5.75 seasons (~2,191 matches).

### Running training

```bash
cd backend
python train_free_tier.py                    # Standard training
python train_free_tier.py --tune             # With hyperparameter tuning (25 trials)
python train_free_tier.py --tune --tune-trials 50  # More tuning trials
python train_free_tier.py --cv              # Rolling cross-validation across seasons
python train_free_tier.py --cv --tune       # CV + tuning combined
```

This trains an XGBoost model with a stacked OvR ensemble (3 binary classifiers + meta-learner for improved draw prediction) and a logistic regression baseline. Uses chronological train/validation split with recency-weighted samples (recent seasons weighted higher). The `--cv` flag runs expanding-window cross-validation before the final training for robust accuracy estimates across all seasons. The trained model is saved to `backend/models/xgboost_free_tier.joblib`.

Current result: **51.0% accuracy** (3-class: home win / draw / away win).

### Feature engineering

`app/features/free_tier_features.py` — `FreeTierFeatureEngineer` class, 99 features, no heavy dependencies. Works standalone from the Football-Data.org free tier (no xG, shots, possession, cards, or corners — those aren't available on the free API tier). The CSV training data is richer than the live API, providing shots, corners, and cards columns that feed additional features during training.

---

## Pro-Tier (Archived)

The 150+ feature pipeline (`advanced_engineering.py`), LSTM predictor, Transformer model, and oracle ensemble orchestrator have been moved to the `pro-tier-archive` branch and are not present in the working tree. They are preserved there for future reference but are out of scope for the current phase.

---

## Tests

```bash
cd backend
pytest tests/
pytest tests/ -v          # verbose
pytest tests/ --cov=app   # with coverage
```

163 tests across 4 files, all non-skip tests passing (8 skip without libomp/XGBoost):
- `test_free_tier_features.py` — 55 tests covering the feature engineering pipeline (incl. Elo ratings, data leakage verification, and 10 bookmaker odds feature tests)
- `test_train_free_tier.py` — 33 tests covering the training script (rolling CV, stacked ensemble, recency weights, feature selection, 5 odds extraction, and 3 calibrator dispatch tests)
- `test_predict_free_tier.py` — 17 tests covering the `/predict/free` API endpoint, rate limiting, and client IP extraction
- `test_rag.py` — 58 tests covering the RAG engine (team extraction, intent parsing, query builder, prompt grounding)

CI runs backend tests on every push and PR via `.github/workflows/ci.yml`.

---

## Known Limitations

- `docker-compose.yml` stripped to just `oracle-api` service — Pro-tier services (Redis, MLflow, Postgres, Jupyter, Nginx) commented out
- `app/security/` modules (`auth.py`, `secrets.py`, `validators.py`) are not imported by `main.py` — unused at runtime
- CSV training data in `backend/spreadsheets/` is gitignored — cloning the repo does not include it (see [Training](#training-the-free-tier-model) for how to obtain it)

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
