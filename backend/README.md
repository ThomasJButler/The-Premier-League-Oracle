# Premier League Oracle - ML Backend

## Current Status

> **Work in progress.** The models are scaffolded but untrained — no training data pipeline exists yet and feature engineering methods currently return placeholder values. The FastAPI server starts and all endpoints are defined, but predictions are not production-ready.

| Component | Status |
|---|---|
| FastAPI server | Starts correctly |
| XGBoost, LSTM, Transformer | Scaffolded — untrained |
| Feature engineering (150+ features) | Structure in place — placeholder values |
| LangChain / ChromaDB | Optional — server starts without them |
| Redis | Optional — server starts without it |
| Tests | None yet (0% coverage) |

---

## What This Does

The backend provides a REST API for Premier League match predictions. It combines three ML models (XGBoost, LSTM, Transformer) into an ensemble, and exposes endpoints for match predictions, team stats, standings, and WebSocket live updates.

---

## Understanding the Code - Three Levels

### For 10-Year-Olds
Imagine you want to guess who'll win a football match. You might think about:
- Who won last time they played?
- Are they good at home?
- Did they win their last few games?

The system does the same thing, but looks at hundreds of things at once — like a very attentive analyst who remembers every Premier League match ever played.

### For Junior Developers
We use machine learning models (mainly XGBoost) to predict match outcomes. The system:
1. Collects data from Football-Data.org API v4
2. Engineers 150+ features (calculated values that help predictions)
3. Trains models on historical data
4. Combines multiple models for better accuracy
5. Provides predictions with confidence scores

```python
# Simple version of what we do
def predict_match(home_team, away_team):
    features = get_features(home_team, away_team)  # Get data
    prediction = model.predict(features)            # Use ML model
    return prediction                               # Return result
```

### For Experts
Full implementation uses:
- **XGBoost**: Gradient boosting with custom objectives, SHAP explanations, Optuna hyperparameter optimisation
- **LSTM Networks**: Bidirectional LSTM with attention for sequence modelling and momentum capture
- **Transformers**: Multi-head self-attention with positional encoding for complex feature relationships
- **LangChain Integration**: Natural language queries (optional — requires OpenAI API key)
- **Feature Engineering**: 150+ features across 10 categories (form, xG, tactical styles, contextual)
- **MLflow Tracking**: Experiment tracking, model versioning
- **FastAPI**: REST API, WebSocket support, Redis caching, async processing

---

## Project Structure

```
backend/
├── app/
│   ├── models/
│   │   ├── xgboost_model.py          # XGBoost with SHAP
│   │   ├── lstm_predictor.py         # LSTM neural network
│   │   ├── transformer_model.py      # Transformer with attention
│   │   └── modern_oracle.py          # Ensemble orchestrator
│   ├── features/
│   │   └── advanced_engineering.py   # 150+ feature pipeline
│   ├── data/
│   │   └── football_data_collector.py # Football-Data.org API v4
│   ├── api/
│   │   └── main.py                   # FastAPI server
│   └── security/
│       ├── auth.py                   # JWT / OAuth2
│       ├── validators.py
│       └── secrets.py
├── docs/
│   └── FOR_BEGINNERS.md
├── tests/                            # Empty — tests to be written
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

Or use the setup script:

```bash
./setup.sh
```

### Configuration

Add your Football-Data.org API key to `.env`:

```bash
FOOTBALL_DATA_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here  # Optional — only needed for LangChain natural language queries
```

### Run the API

```bash
uvicorn app.api.main:app --reload --port 8000
# API: http://localhost:8000
# Interactive docs: http://localhost:8000/docs
```

Redis and MLflow are optional — the server starts without them.

---

## How Predictions Work

### Step 1: Data Collection
```python
# Football-Data.org API v4
data = {
    'recent_form': get_last_5_matches(team),
    'head_to_head': get_previous_meetings(home, away),
    'team_strength': get_league_position(team),
}
```

### Step 2: Feature Engineering
```python
features = {
    'home_win_rate_last_5': 0.6,
    'avg_goals_scored': 2.1,
    'days_since_last_match': 4,
    # ... 150+ more features
}
```

### Step 3: Ensemble Prediction
```python
# Three models, weighted average
probabilities = ensemble.predict(features)
# Returns: [0.45, 0.30, 0.25] = [Home Win, Draw, Away Win]
```

---

## Feature Categories (150+ total)

1. **Basic Stats** (20): Goals, points, positions, win/draw/loss rates
2. **Advanced Metrics** (30): xG, possession, shot accuracy, defensive efficiency
3. **Form & Momentum** (25): Weighted form, streaks, volatility, bounce-back rates
4. **Head-to-Head** (15): Historical results, venue records
5. **Contextual** (20): Derby matches, fatigue, fixture congestion, season stage
6. **Betting Market** (15): Odds movements, value calculations
7. **Tactical Style** (20): Playing style, tempo, pressing, set pieces
8. **Player Impact** (10): Key players, injuries, squad depth
9. **Time Series** (15): Trends, seasonality, mean reversion
10. **External Factors** (10): Weather, travel, crowd impact

---

## Running the API

### Start the Server

```bash
# Minimal (no Redis, no MLflow required)
uvicorn app.api.main:app --reload --port 8000

# With optional services (Docker)
docker run -d -p 6379:6379 redis
mlflow ui --port 5000
uvicorn app.api.main:app --reload --port 8000
```

### API Endpoints

#### Ensemble Prediction
```bash
curl -X POST "http://localhost:8000/predict" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"home_team": "Arsenal FC", "away_team": "Chelsea FC", "include_details": true}'
```

#### Natural Language Query (requires OpenAI key)
```bash
curl -X POST "http://localhost:8000/predict/natural" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the chances of Liverpool beating Man City?"}'
```

#### Batch Predictions
```bash
curl -X POST "http://localhost:8000/predict/batch" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "matches": [
      {"home_team": "Arsenal FC", "away_team": "Chelsea FC"},
      {"home_team": "Liverpool FC", "away_team": "Manchester City FC"}
    ]
  }'
```

#### WebSocket Live Updates
```python
import asyncio, websockets, json

async def get_live_predictions():
    uri = "ws://localhost:8000/ws/predictions"
    async with websockets.connect(uri) as websocket:
        await websocket.send(json.dumps({
            "action": "subscribe",
            "match": "Arsenal FC vs Chelsea FC"
        }))
        while True:
            prediction = await websocket.recv()
            print(f"Live update: {prediction}")

asyncio.run(get_live_predictions())
```

---

## Testing

```bash
pytest
pytest --cov=app
```

No tests exist yet. Frontend has 364 Vitest tests across 21 files; backend is next.

---

## Common Questions

### Why XGBoost?
It's a gradient-boosted decision tree that learns from mistakes iteratively. It's fast, accurate, and SHAP values let us explain every prediction — important for betting decisions.

### What's Feature Engineering?
Taking raw data ("Arsenal scored 2 goals") and turning it into useful numbers for the model ("average goals per game: 1.8", "goals scored per shot: 0.12").

### How Accurate Is It?
Models are currently untrained scaffolds — the accuracy depends on training with real historical data. The feature engineering pipeline is built to support strong predictions once trained.

---

## Requirements

- Python 3.10+
- See `requirements.txt` for all package dependencies
- Football-Data.org API key (free tier available)
- OpenAI API key (optional — only for natural language queries)

---

## Links

- [Interactive API Docs](http://localhost:8000/docs) (when server is running)
- [Training Spec](../specs/08-backend-training.md)

---

## Licence

MIT — use however you want.
