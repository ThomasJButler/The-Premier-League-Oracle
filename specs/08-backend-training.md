# Spec 08: Backend Training Pipeline

**JTBD: Train and serve ML models that predict Premier League match outcomes, starting with a lean free-tier model and scaling to a full-feature Pro model when paid API data becomes available**

---

## Current State

The backend in `backend/` has model architectures (XGBoost, LSTM, Transformer) and a feature engineering pipeline, but training is incomplete:

| Component | Status | Notes |
| --------- | ------ | ----- |
| `xgboost_model.py` | Architecture complete | Real training, SHAP, Optuna, save/load |
| `lstm_predictor.py` | Architecture complete | `get_feature_importance()` returns `np.random.random()` (stub) |
| `transformer_model.py` | Architecture complete | Save/load only stores 2 of 8 params; `val_accuracy` UnboundLocalError |
| `modern_oracle.py` | Orchestrator exists | `optimize_ensemble_weights()` uses `np.random.random()` (stub) |
| `advanced_engineering.py` | 150 features declared | 63 methods return hardcoded `0.0` (no data from free API) |
| `train.py` | Runnable | Trains XGBoost on all 150 features (including 63 zero-columns) |
| `football_data_collector.py` | Partial | `get_head_to_head()` stub; `get_team_form()` result-flip bug |
| `models/xgboost_model.pkl` | Exists on disk | Trained on noisy feature set (63 zero-value columns) |
| LSTM/Transformer models | No saved artefacts | Untrained |
| Backend tests | 0% coverage | `test_setup.py` only checks imports |

**Training data:** 2,197 matches across 6 seasons (2020/21–2025/26) in `backend/spreadsheets/KnowledgeFilesCSV/`. CSVs include scores, half-time results, shots, corners, cards, fouls, referee, and betting odds from 10+ bookmakers.

**Free API constraint:** Football-Data.org free tier provides match results, standings, and team info only. No xG, shots, possession, cards, corners, or player data. This permanently limits ~70 features at inference time.

---

## Two-Tier Architecture

```
Tier 1: Free (active development)
  Features:     ~73 (results, form, standings, H2H, contextual, time series)
  Model:        XGBoost
  Training:     train_free_tier.py → xgboost_free_tier.joblib
  Endpoint:     POST /predict/free
  Data source:  Football-Data.org free tier + CSV history

Tier 2: Pro (future, when paid API available)
  Features:     ~150 (adds xG, shots, possession, cards, corners, odds, player data)
  Models:       XGBoost + LSTM + Transformer ensemble
  Training:     train.py → xgboost_model.pkl + lstm.pt + transformer.pt
  Endpoint:     POST /predict
  Data source:  Football-Data.org Pro tier + CSV history
```

The two tiers are fully decoupled. `FreeTierFeatureEngineer` is a standalone class — it does not wrap `AdvancedFeatureEngineer`, as that class has 63 stub methods that would pollute feature vectors. All free-tier features are computed from scratch using only CSV/free-API data.

---

## Requirements

### 1. Free-Tier Feature Engineer (Priority: High)

**New file:** `backend/app/features/free_tier_features.py`

`FreeTierFeatureEngineer` class that:
- Is a standalone class (does not wrap `AdvancedFeatureEngineer`)
- `create_features(home_team, away_team, match_date)` returns a dict of ~83 features
- Class-level `FEATURE_NAMES` list for validation and documentation
- Team name normalisation dict mapping CSV short names (e.g. "Man United") to API canonical names (e.g. "Manchester United FC")
- Never calls any of the 63 stub methods that require Pro API data

**Feature groups:**

| Group | Count | Source data |
| ----- | ----- | ----------- |
| Basic stats | 12 | Goals scored/conceded avg, points/game, win/draw/loss rates, home/away splits, clean sheet rate |
| Form & momentum | 20 | Form last 5/10, weighted form, momentum, streaks, form vs top/bottom 6, scoring/defensive form, volatility, bounce-back rate |
| Head-to-head | 15 | H2H wins, draws, goals avg, recent form, unbeaten streak, venue record, dominance, revenge factor, importance |
| Contextual | 12 | Rest days, fatigue index, fixture congestion, derby, six-pointer, relegation battle, title race, season progress, must-win factor |
| Time series | 9 | Short/medium/long trends (linear regression), monthly performance, consistency, mean reversion, autocorrelation |
| Derived | 5 | Over 2.5 probability, BTTS probability, goal conversion, defensive efficiency, venue advantage |
| Half-time | 3–5 | Avg HT goals scored (home/away), HT form last N, HT momentum — free API returns `match.score.halfTime`; CSVs have `HTHG`/`HTAG`/`HTR` |
| Match stats | 5–7 | Cards rolling avg (`HY`/`AY`), corners rolling avg (`HC`/`AC`), fouls rolling avg (`HF`/`AF`), shots/game (`HS`/`AS`), shot accuracy (`HST`/`AST`), goal difference trend, clean sheet streak — all derivable from historical match data |

**Acceptance criteria:**

> Updated 24 March 2026 — markers synced with IMPLEMENTATION_PLAN.md

- [x] `create_features()` returns exactly `FEATURE_NAMES` keys
- [x] No feature returns `0.0` when given sufficient match history (i.e. no stubs leak through)
- [x] Features use only pre-match data (no leakage from the match being predicted)
- [x] Team name normalisation handles both CSV and API formats
- [x] Class is importable and usable independently of `AdvancedFeatureEngineer` internals

Note: `FreeTierFeatureEngineer` is a standalone class (not wrapping `AdvancedFeatureEngineer` via composition as originally specified — the parent class has 63 stub methods that would pollute feature vectors). All 86 features are computed from scratch using only CSV/free-API data.

---

### 2. Free-Tier Training Script (Priority: High)

**New file:** `backend/train_free_tier.py`

Standalone entry point:

```bash
cd backend
python train_free_tier.py            # Train with 80/20 split
python train_free_tier.py --test     # Also evaluate on held-out 2025/26 data
```

**Behaviour:**

1. Load CSVs from `backend/spreadsheets/KnowledgeFilesCSV/EPL*.csv`
2. Normalise columns to `date, home_team, away_team, home_score, away_score, result` plus `half_time_home_goals, half_time_away_goals, half_time_result, home_shots, away_shots, home_shots_target, away_shots_target, home_corners, away_corners, home_yellows, away_yellows, home_reds, away_reds, home_fouls, away_fouls`
3. For each match (chronological order), compute features via `FreeTierFeatureEngineer`
4. Skip matches where either team has fewer than 5 prior games (warmup period)
5. Data quality checks: log dropped rows, print class distribution, verify all season CSVs loaded
6. Chronological 80/20 train/val split (no shuffling — prevents future leakage)
7. Train logistic regression baseline on same features (for comparison)
8. Train `XGBoostPredictor` with early stopping on validation set
9. Print: overall accuracy, per-class accuracy (Home/Draw/Away), top 20 feature importances
10. Print: XGBoost vs logistic regression comparison (accuracy, log loss)
11. Print: confusion matrix, Brier score, per-class AUC-ROC
12. Save calibration curve as PNG
13. Save model to `backend/models/xgboost_free_tier.joblib`

**Model metadata saved alongside the model:**

```python
{
    'model': xgb.Booster,
    'feature_names': ['home_goals_scored_avg', ...],  # The ~83 feature names
    'params': {...},                                   # XGBoost hyperparameters
    'feature_importance': {...},                       # Feature importance scores
    'version': '1.0.0-free',                           # Tier marker
    'tier': 'free',
    'training_date': '2026-03-18T...',
    'training_samples': 1758,
    'validation_accuracy': 0.52,
    'training_seasons': ['2020/21', '2021/22', ...],
}
```

**Acceptance criteria:**

> Updated 24 March 2026 — markers synced with IMPLEMENTATION_PLAN.md

- [x] Training completes without errors on the existing CSV dataset
- [x] Data quality checks run and log results (dropped rows, class distribution, season counts)
- [x] Chronological split verified (all validation dates strictly after all training dates)
- [x] Logistic regression baseline trained and accuracy compared to XGBoost
- [x] Model file saved to `backend/models/xgboost_free_tier.joblib` with metadata
- [x] Per-class accuracy printed (Home, Draw, Away separately)
- [x] Confusion matrix, Brier score, and per-class AUC-ROC printed
- [x] Calibration curve saved as PNG (best-effort — skips gracefully if matplotlib unavailable)
- [x] `--test` flag evaluates on 2025/26 held-out data
- [x] No dependency on paid API data or features that return `0.0`

---

### 3. Free-Tier API Endpoints (Priority: High)

**Modified file:** `backend/app/api/main.py`

Two new endpoints:

#### `POST /predict/free`

Predict a match using the free-tier XGBoost model.

**Request:**

```json
{
  "home_team": "Arsenal",
  "away_team": "Chelsea"
}
```

**Response:**

```json
{
  "home_team": "Arsenal",
  "away_team": "Chelsea",
  "probabilities": {
    "home_win": 0.45,
    "draw": 0.28,
    "away_win": 0.27
  },
  "predicted_outcome": "Home win",
  "confidence": 0.45,
  "model_version": "1.0.0-free",
  "feature_importance": {
    "home_form_last_5": 0.12,
    "away_goals_conceded_avg": 0.09
  }
}
```

**Behaviour:**
- Loads `xgboost_free_tier.joblib` at startup (in FastAPI lifespan)
- Uses `FreeTierFeatureEngineer` with current-season data for feature computation
- Validates team names against a current PL team allowlist
- Returns 422 for unknown team names with a helpful error message
- Returns 503 if model not loaded

#### `GET /models/free-tier/info`

Returns model metadata: version, training date, feature count, validation accuracy, feature list.

**Acceptance criteria:**

> Updated 24 March 2026 — markers synced with IMPLEMENTATION_PLAN.md

- [x] `/predict/free` returns valid probabilities summing to ~1.0
- [x] `/predict/free` returns 422 for invalid team names
- [x] `/predict/free` returns 503 when model is not loaded
- [x] `/models/free-tier/info` returns training metadata
- [x] Existing `/predict` endpoint (full Oracle) is completely unchanged

---

### 4. Security (Priority: High)

These are the minimum security requirements for the free-tier model to be safely deployable.

#### 4a. `.gitignore`

Add `backend/.env` — currently only `/.env` (root) and `frontend/.env` are listed. The backend `.env` contains real API keys.

#### 4b. Input validation

Team name allowlist on `/predict/free`. Accept current Premier League teams plus recently promoted/relegated clubs (last 2 seasons). Return 422 with a clear error for unknown teams.

The existing `validators.py` has a `VALID_TEAMS` set but it's outdated (2023/24 clubs) and entirely unused at runtime. The free-tier endpoint should use its own inline validation rather than depending on the broken validator module.

#### 4c. Error sanitisation

New endpoints must return generic error messages, never raw `str(exc)` or stack traces. The existing global exception handler in `main.py` (line 582-593) leaks internal error strings — do not replicate this pattern.

```python
# Good
{"error": "Prediction failed", "request_id": "abc123"}

# Bad (current pattern in main.py)
{"detail": "KeyError: 'home_goals_scored_avg'"}
```

#### 4d. Rate limiting

Basic in-memory rate limiting on `/predict/free`: 60 requests per minute per IP address. Use a simple sliding window or token bucket — no Redis dependency.

#### 4e. Model integrity

When loading the model file at startup, validate that it contains the expected metadata keys (`tier`, `feature_names`, `version`). Fail loudly at startup if the model is malformed, rather than silently serving garbage predictions.

**Acceptance criteria:**

> Updated 24 March 2026 — markers synced with IMPLEMENTATION_PLAN.md

- [x] `backend/.env` added to `.gitignore`
- [x] Invalid team names return 422, not 500
- [x] Error responses contain no stack traces or internal paths
- [x] Rate limiting returns 429 after 60 requests/minute from the same IP — fixed in P5a: `_get_client_ip()` extracts real IP from `X-Forwarded-For` header
- [x] Malformed model file causes startup failure with clear error message

---

### 5. Testing (Priority: High)

The backend currently has 0% test coverage. The free-tier model introduces the first real tests.

#### `backend/tests/test_free_tier_features.py`

- `create_features()` returns exactly `FEATURE_NAMES` keys
- No feature returns `0.0` when given sufficient historical data
- Features use only pre-match data (no data leakage)
- Team name normalisation works for both CSV and API formats
- Edge cases: newly promoted teams with no history, first match of season

#### `backend/tests/test_train_free_tier.py`

- CSV loading produces expected DataFrame shape
- Feature matrix has no NaN columns after warmup period
- Chronological split is correct (all val dates > all train dates)
- Model saves and loads with correct metadata

#### `backend/tests/test_predict_free_tier.py`

- FastAPI TestClient: valid request returns correct response shape
- Probabilities sum to ~1.0 (within floating-point tolerance)
- Invalid team name returns 422
- Rate limiting returns 429 after threshold
- Model info endpoint returns expected metadata

**Acceptance criteria:**

> Updated 24 March 2026 — markers synced with IMPLEMENTATION_PLAN.md

- [x] All feature tests pass: `python -m pytest tests/test_free_tier_features.py -v` (39 tests)
- [x] All training tests pass: `python -m pytest tests/test_train_free_tier.py -v` (12 tests)
- [x] All API tests pass: `python -m pytest tests/test_predict_free_tier.py -v` (11 tests)
- [x] Tests run in CI without requiring a Football-Data.org API key

---

### 6. Pro-Tier Training Pipeline (Priority: Low — future work)

This section documents the full-feature pipeline for when a paid Football-Data.org subscription is available. **Do not implement until the free-tier model is stable and deployed.**

#### 6a. Feature engineering fixes

- Implement the 63 stubbed methods in `advanced_engineering.py` that have real data from the Pro API (xG, shots, possession, cards, corners)
- Remove methods that require data sources beyond Football-Data.org (weather, betting odds, player injuries) or honestly document them as permanently stubbed
- Fix `football_data_collector.py`: `get_head_to_head()` returns empty DataFrame; `get_team_form()` has result-flip bug

#### 6b. Model training fixes

- Fix `lstm_predictor.py:523`: `get_feature_importance()` returns `np.random.random()`
- Fix `modern_oracle.py:581`: `optimize_ensemble_weights()` returns `np.random.random()`
- Fix `modern_oracle.py`: calls non-existent `data_collector.get_team_stats()` method
- Fix `modern_oracle.py`: wrong kwarg `last_n=5` (should be `n_matches`)
- Fix `transformer_model.py`: save/load only stores 2 of 8 constructor params
- Fix `transformer_model.py`: `val_accuracy` UnboundLocalError when no validation set
- Fix `transformer_model.py`: `num_decoder_layers` param silently ignored

#### 6c. Full training pipeline

- Update `train.py` to orchestrate: data collection → feature engineering → XGBoost + LSTM + Transformer training → ensemble weight optimisation → evaluation
- Train/val/test splits: 2020-2023 train, 2024 validation, 2025 test
- Wire `/admin/retrain` endpoint (currently returns mock response)

#### 6d. Frontend integration

- Covered by spec 03 (`backend-integration.md`)
- `BackendService` bridge, `useBackend` toggle, `OptimizedPredictor` × ML merge
- Silent fallback to TypeScript ensemble when backend unavailable

---

## File Map

| File | Action | Priority |
| ---- | ------ | -------- |
| `backend/app/features/free_tier_features.py` | Create | High |
| `backend/train_free_tier.py` | Create | High |
| `backend/app/api/main.py` | Modify (add endpoints) | High |
| `backend/tests/test_free_tier_features.py` | Create | High |
| `backend/tests/test_train_free_tier.py` | Create | High |
| `backend/tests/test_predict_free_tier.py` | Create | High |
| `.gitignore` | Modify (add `backend/.env`) | High |
| `backend/app/features/advanced_engineering.py` | No change (free tier) | — |
| `backend/train.py` | No change (free tier) | — |
| `backend/app/models/xgboost_model.py` | No change (reused) | — |

---

## Verification

```bash
# 1. Feature tests
cd backend && python -m pytest tests/test_free_tier_features.py -v

# 2. Train the free-tier model
python train_free_tier.py

# 3. Training tests
python -m pytest tests/test_train_free_tier.py -v

# 4. Start the server
uvicorn app.api.main:app --reload --port 8000

# 5. Test prediction endpoint
curl -X POST http://localhost:8000/predict/free \
  -H "Content-Type: application/json" \
  -d '{"home_team": "Arsenal", "away_team": "Chelsea"}'

# 6. Test model info endpoint
curl http://localhost:8000/models/free-tier/info

# 7. Test invalid team (should return 422)
curl -X POST http://localhost:8000/predict/free \
  -H "Content-Type: application/json" \
  -d '{"home_team": "Barcelona", "away_team": "Chelsea"}'

# 8. All backend tests
python -m pytest tests/ -v
```
