# Premier League Oracle — ML Backend

## Current Status

| Component | Status |
|---|---|
| FastAPI server | Running — graceful degradation if heavy deps missing |
| Free-tier XGBoost model | **Trained** — 53.3% accuracy with draw features + dual calibration (retrained 20 March 2026) |
| Dedicated draw classifier | **Active cascade** — trained binary draw-vs-not-draw model overrides the main argmax when P(draw) > tuned threshold (set `ORACLE_DRAW_CASCADE=0` to force-disable) |
| Free-tier feature engineering | 114 features (incl. 13 draw indicators, 10 bookmaker odds, 5 Elo), standalone, no heavy deps |
| Pro-tier models (LSTM, Transformer, Oracle ensemble) | Archived to `pro-tier-archive` branch — not in working tree |
| Backend tests | **194 tests across 5 files — all non-skip tests passing** |
| AI chat provider | Anthropic Claude only (Haiku 4.5 default, Sonnet 4.6 / Opus 4.6 / Opus 4.7 selectable) — OpenAI removed April 2026 |
| Redis | Optional — server starts without it |

---

## What This Does

The backend provides a REST API for Premier League match predictions. The active prediction path uses a trained XGBoost model with isotonic calibration, built on 114 free-tier features derived from CSV historical data and the Football-Data.org API. Pro-tier models (LSTM, Transformer, full oracle ensemble) have been archived to the `pro-tier-archive` branch.

The frontend connects exclusively to the `/predict/free` endpoint.

---

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── main.py                       # FastAPI server
│   ├── features/
│   │   └── free_tier_features.py         # 114-feature pipeline (active)
│   ├── models/
│   │   └── xgboost_model.py              # XGBoost wrapper
│   ├── data/
│   │   └── football_data_collector.py    # Football-Data.org API v4 client
│   └── api/rag.py                       # DataFrame RAG engine for natural language queries
├── models/
│   └── xgboost_free_tier.joblib          # Trained free-tier model
├── tests/
│   ├── test_free_tier_features.py        # 60 feature engineering tests (incl. Elo leakage)
│   ├── test_train_free_tier.py           # 33 training pipeline tests (incl. rolling CV, ensemble)
│   ├── test_predict_free_tier.py         # 20 API endpoint tests (incl. 3 draw cascade)
│   ├── test_rag.py                       # 59 RAG engine tests (Anthropic-only, incl. cache_control guard)
│   └── test_web_search.py               # 22 web search fallback tests
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
ANTHROPIC_API_KEY=sk-ant-your_key_here  # Optional — used by /chat/rag for natural-language queries
```

### Run the API

```bash
uvicorn app.api.main:app --reload --port 8000
# API:              http://localhost:8000
# Interactive docs: http://localhost:8000/docs
```

Redis and MLflow are optional — the server starts and serves predictions without them. The `/chat/rag` endpoint needs `ANTHROPIC_API_KEY` to be set (or a per-request `X-Anthropic-Key` header).

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

Current result: **53.3% accuracy** (3-class: home win / draw / away win).

### Feature engineering

`app/features/free_tier_features.py` — `FreeTierFeatureEngineer` class, 114 features (86 base + 13 draw indicators + 5 Elo + 10 odds), no heavy dependencies. Works standalone from the Football-Data.org free tier (no xG, shots, possession, cards, or corners — those aren't available on the free API tier). The CSV training data is richer than the live API, providing shots, corners, and cards columns that feed additional features during training.

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

194 tests across 5 files, all non-skip tests passing (8 skip without libomp/XGBoost):
- `test_free_tier_features.py` — 60 tests covering the feature engineering pipeline (incl. Elo ratings, data leakage verification, and 10 bookmaker odds feature tests)
- `test_train_free_tier.py` — 33 tests covering the training script (rolling CV, stacked ensemble, recency weights, feature selection, 5 odds extraction, and 3 calibrator dispatch tests)
- `test_predict_free_tier.py` — 20 tests covering `/predict/free`, rate limiting, client IP extraction, and the **draw classifier cascade** (3 cases: override above threshold, no-op below, no-op when classifier absent)
- `test_rag.py` — 59 tests covering the Anthropic-only RAG engine (team extraction, intent parsing, query builder, prompt grounding, 14 player data tests, and a `cache_control: ephemeral` regression guard)
- `test_web_search.py` — 22 tests covering the DuckDuckGo web search fallback (cache, prompt injection, graceful degradation)

CI runs backend tests on every push and PR via `.github/workflows/ci.yml`.

---

## Known Limitations

- `docker-compose.yml` stripped to just `oracle-api` service — Pro-tier services (Redis, MLflow, Postgres, Jupyter, Nginx) commented out
- `app/security/` modules were deleted in P6c as dead code — if a proper auth layer is needed, write from scratch
- CSV training data in `backend/spreadsheets/` is gitignored — cloning the repo does not include it (see [Training](#training-the-free-tier-model) for how to obtain it)

---

## Requirements

- Python 3.10+
- Football-Data.org API key (free tier sufficient for the active prediction path)
- Anthropic API key (optional — used by the `/chat/rag` endpoint for data-grounded natural-language queries)

---

## Links

- [Interactive API Docs](http://localhost:8000/docs) (when server is running)
- [Training Spec](../specs/08-backend-training.md)

---

## Licence

MIT — use however you want.
