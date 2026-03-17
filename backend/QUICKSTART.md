# Quick Start — Premier League Oracle Backend

> **Note:** The ML models are scaffolded but untrained. The API server starts and endpoints respond, but predictions are not production-ready until models are trained with real historical data.

## Option 1: Local Setup (Recommended)

```bash
# 1. Enter the backend directory
cd backend

# 2. Run the setup script (creates venv, installs requirements, creates .env)
./setup.sh

# 3. Add your Football-Data.org API key to .env
nano .env

# 4. Start the server
uvicorn app.api.main:app --reload --port 8000

# 5. Test it
curl -X POST "http://localhost:8000/predict" \
  -H "Content-Type: application/json" \
  -d '{"home_team": "Arsenal FC", "away_team": "Chelsea FC"}'
```

## Option 2: Docker (Includes Redis + MLflow)

```bash
# 1. Add API keys to .env
echo "FOOTBALL_DATA_API_KEY=your_key" > .env
echo "OPENAI_API_KEY=your_key" >> .env  # Optional

# 2. Start everything
docker-compose up

# Services:
# - API:     http://localhost:8000
# - API docs: http://localhost:8000/docs
# - MLflow:  http://localhost:5000
```

## Option 3: Jupyter Notebook

```bash
pip install jupyter
jupyter notebook
# Open notebooks/god_mode_demo.ipynb
```

---

## Making a Prediction

### Python
```python
from app.models.modern_oracle import ModernPremierLeagueOracle

oracle = ModernPremierLeagueOracle(api_key="YOUR_KEY")
result = oracle.predict_match_ensemble("Arsenal FC", "Chelsea FC")

print(f"Prediction: {result['ensemble_prediction']}")
print(f"Confidence: {result['ensemble_prediction']['confidence']:.1%}")
```

### Natural Language (requires OpenAI key)
```python
response = await oracle.predict_match_natural_language(
    "Who will win the North London Derby?"
)
print(response)
```

### REST API
```bash
curl -X POST "http://localhost:8000/predict/natural" \
  -H "Content-Type: application/json" \
  -d '{"query": "Will Liverpool beat Manchester City?"}'
```

---

## What's Included

- **3 ML model scaffolds**: XGBoost, LSTM, Transformer (need training)
- **150+ feature engineering pipeline**: Built, but returns placeholder values until training data is wired in
- **LangChain natural language queries**: Optional, requires OpenAI key
- **WebSocket support**: Live prediction updates
- **Kelly Criterion betting analysis**: Value bet calculations

---

## Requirements

- Python 3.10+
- Football-Data.org API key (free at [football-data.org](https://www.football-data.org/))
- OpenAI API key (optional)

## Need Help?

- [Full documentation](README.md)
- [Interactive API docs](http://localhost:8000/docs) (when server running)
- [Beginner's guide](docs/FOR_BEGINNERS.md)
