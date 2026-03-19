"""
FastAPI Production Server — Premier League Oracle API (Free Tier)

REST endpoints for match predictions using an XGBoost ensemble trained on
historical Premier League data.  Pro-tier models (LSTM, Transformer, LangChain)
are archived on the `pro-tier-archive` branch.
"""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Anchor all file paths to the backend/ directory, not the CWD.
# main.py lives at backend/app/api/main.py → 3 levels up = backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent

# Setup logging — must be before any logger calls
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Free-tier feature engineer — lightweight, no heavy deps
try:
    from app.features.free_tier_features import CSV_TO_API, FreeTierFeatureEngineer
    FREE_TIER_AVAILABLE = True
except ImportError as e:
    logger.warning(f"FreeTierFeatureEngineer unavailable ({e})")
    FreeTierFeatureEngineer = None  # type: ignore
    FREE_TIER_AVAILABLE = False

try:
    from app.data.football_data_collector import FootballDataCollector
    DATA_COLLECTOR_AVAILABLE = True
except ImportError as e:
    logger.warning(f"FootballDataCollector unavailable ({e})")
    FootballDataCollector = None  # type: ignore
    DATA_COLLECTOR_AVAILABLE = False

# Environment variables
FOOTBALL_API_KEY = os.getenv("FOOTBALL_DATA_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Free-tier model state
free_tier_model = None  # xgb.Booster loaded from joblib
free_tier_metadata: dict[str, Any] = {}  # Model metadata (version, features, etc.)
free_tier_engineer: Any | None = None  # FreeTierFeatureEngineer for live predictions

# In-memory rate limiter for /predict/free
_rate_limit_store: dict[str, list[float]] = {}
RATE_LIMIT_MAX = 60  # requests per minute per IP
RATE_LIMIT_WINDOW = 60.0  # seconds


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    logger.info("Starting Premier League Oracle API...")

    # Load free-tier model if available
    global free_tier_model, free_tier_metadata, free_tier_engineer
    free_tier_model_path = BACKEND_ROOT / "models" / "xgboost_free_tier.joblib"
    if free_tier_model_path.exists() and FREE_TIER_AVAILABLE:
        try:
            import joblib
            payload = joblib.load(str(free_tier_model_path))

            # Validate metadata keys
            required_keys = {'tier', 'feature_names', 'version', 'model'}
            missing = required_keys - set(payload.keys())
            if missing:
                raise ValueError(f"Model file missing required keys: {missing}")

            free_tier_model = payload['model']
            free_tier_metadata = {
                k: v for k, v in payload.items() if k != 'model'
            }
            if payload.get('calibrators'):
                logger.info("Probability calibrators loaded")
            if payload.get('stacked_ensemble'):
                logger.info("Stacked ensemble loaded (3 OvR classifiers + meta-learner)")
            logger.info(
                "Free-tier model loaded: version %s, %d features",
                payload.get('version', 'unknown'),
                len(payload.get('feature_names', [])),
            )

            # Create a feature engineer with empty data for live predictions.
            # For real predictions, we populate with current-season data
            # from the API or CSVs.
            import pandas as pd
            empty_df = pd.DataFrame(columns=[
                'date', 'home_team', 'away_team', 'home_goals', 'away_goals',
                'result', 'half_time_home_goals', 'half_time_away_goals',
                'half_time_result', 'home_shots', 'away_shots',
                'home_shots_target', 'away_shots_target', 'home_corners',
                'away_corners', 'home_yellows', 'away_yellows', 'home_reds',
                'away_reds', 'home_fouls', 'away_fouls',
            ])
            empty_df['date'] = pd.to_datetime(empty_df['date'])
            free_tier_engineer = FreeTierFeatureEngineer(empty_df)

            # Try loading CSV data for richer predictions
            csv_dir = BACKEND_ROOT / "spreadsheets" / "KnowledgeFilesCSV"
            if csv_dir.exists():
                try:
                    csv_data = FreeTierFeatureEngineer.load_csvs(str(csv_dir))
                    free_tier_engineer = FreeTierFeatureEngineer(csv_data)
                    logger.info("Free-tier engineer loaded with %d historical matches", len(csv_data))
                except Exception as csv_err:
                    logger.warning("Could not load CSV data for free-tier: %s", csv_err)
            else:
                logger.warning(
                    "CSV training data not found at %s — free-tier features will return 0.0 for all matches. "
                    "Place CSV files in backend/spreadsheets/KnowledgeFilesCSV/ or see IMPLEMENTATION_PLAN.md",
                    csv_dir,
                )

        except Exception as e:
            logger.warning(f"Could not load free-tier model: {e}")
            free_tier_model = None
            free_tier_metadata = {}
    else:
        if not free_tier_model_path.exists():
            logger.info("No free-tier model found at %s — run train_free_tier.py first", free_tier_model_path)
        if not FREE_TIER_AVAILABLE:
            logger.info("FreeTierFeatureEngineer not available")

    logger.info("Oracle API startup complete")

    yield

    # Shutdown
    logger.info("Shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Premier League Oracle API",
    description="Free-tier football prediction API powered by XGBoost ensemble",
    version="3.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],  # Dev/preview origins
    allow_origin_regex=r"https://.*\.vercel\.app",  # Vercel production + preview deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check():
    """Check if the API is running and healthy."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "free_tier_model_loaded": free_tier_model is not None,
    }


# ---------------------------------------------------------------------------
# Free-tier prediction endpoints
# ---------------------------------------------------------------------------

# Current + recent PL teams (2 seasons) for validation
VALID_FREE_TIER_TEAMS = set(CSV_TO_API.keys()) if FREE_TIER_AVAILABLE else set()


class FreeTierPredictionRequest(BaseModel):
    """Request for free-tier match prediction."""
    home_team: str = Field(..., description="Home team name")
    away_team: str = Field(..., description="Away team name")

    class Config:
        json_schema_extra = {
            "example": {
                "home_team": "Arsenal",
                "away_team": "Chelsea",
            }
        }


def _check_rate_limit(client_ip: str) -> bool:
    """In-memory sliding-window rate limiter. Returns True if allowed."""
    import time
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW

    if client_ip not in _rate_limit_store:
        _rate_limit_store[client_ip] = []

    # Prune old entries
    _rate_limit_store[client_ip] = [
        t for t in _rate_limit_store[client_ip] if t > window_start
    ]

    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_MAX:
        return False

    _rate_limit_store[client_ip].append(now)
    return True


def _resolve_team_name(name: str) -> str:
    """Resolve a team name to CSV format, raising 422 if unrecognised."""
    if not FREE_TIER_AVAILABLE:
        return name
    csv_name = FreeTierFeatureEngineer.normalize_team_name(name, to='csv')
    if csv_name in VALID_FREE_TIER_TEAMS:
        return csv_name
    raise HTTPException(
        status_code=422,
        detail={
            "error": "Unknown team name",
            "team": name,
            "hint": f"Valid teams include: {', '.join(sorted(list(VALID_FREE_TIER_TEAMS)[:10]))}...",
        },
    )


def _get_client_ip(request: Request) -> str:
    """Extract the real client IP, checking X-Forwarded-For for reverse proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First entry is the original client IP
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


@app.post("/predict/free", tags=["Free-Tier Predictions"])
async def predict_free_tier(prediction_request: FreeTierPredictionRequest,
                            request: Request):
    """
    Predict match outcome using the free-tier XGBoost model.

    Uses ~94 features derived from match results, form, H2H, draw indicators, and contextual data.
    No paid API data required.
    """
    # Rate limiting — extract real client IP from request
    client_ip = _get_client_ip(request)
    if not _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded — maximum 60 requests per minute",
        )

    # Validate and normalise team names first (422 before 503)
    home = _resolve_team_name(prediction_request.home_team)
    away = _resolve_team_name(prediction_request.away_team)

    if free_tier_model is None:
        raise HTTPException(
            status_code=503,
            detail="Free-tier model not loaded — run train_free_tier.py first",
        )

    if free_tier_engineer is None:
        raise HTTPException(
            status_code=503,
            detail="Free-tier feature engineer not available",
        )

    try:
        # Compute features
        features = free_tier_engineer.create_features(home, away)
        feature_names = free_tier_metadata.get('feature_names', FreeTierFeatureEngineer.FEATURE_NAMES)
        feature_vec = [features[name] for name in feature_names]

        import xgboost as xgb
        dmatrix = xgb.DMatrix(
            [feature_vec], feature_names=feature_names,
        )

        # Use stacked ensemble if available, otherwise fall back to single model
        stacked = free_tier_metadata.get('stacked_ensemble')
        if stacked and stacked.get('classifiers') and stacked.get('meta_learner'):
            # Stacked ensemble: 3 OvR classifiers → meta-learner
            ovr_probs = np.column_stack([
                clf.predict(dmatrix) for clf in stacked['classifiers']
            ])
            ovr_scaled = stacked['meta_scaler'].transform(ovr_probs)
            probs = stacked['meta_learner'].predict_proba(ovr_scaled)[0]
        else:
            # Single XGBoost with calibration
            raw_probs = free_tier_model.predict(dmatrix)[0]
            calibrators = free_tier_metadata.get('calibrators')
            if calibrators and len(calibrators) == 3:
                cal_probs = np.array([
                    float(cal.predict([raw_probs[i]])[0])
                    for i, cal in enumerate(calibrators)
                ])
                total = cal_probs.sum()
                probs = cal_probs / total if total > 0 else raw_probs
            else:
                probs = raw_probs

        home_prob = float(probs[0])
        draw_prob = float(probs[1])
        away_prob = float(probs[2])

        # Determine predicted outcome
        outcome_idx = int(np.argmax(probs))
        outcomes = ['Home win', 'Draw', 'Away win']
        predicted = outcomes[outcome_idx]

        # Top feature importances for this prediction
        importance = free_tier_metadata.get('feature_importance', {})
        top_features = dict(
            sorted(importance.items(), key=lambda x: x[1], reverse=True)[:10]
        )

        return {
            "home_team": home,
            "away_team": away,
            "probabilities": {
                "home_win": round(home_prob, 4),
                "draw": round(draw_prob, 4),
                "away_win": round(away_prob, 4),
            },
            "predicted_outcome": predicted,
            "confidence": round(float(probs[outcome_idx]), 4),
            "model_version": free_tier_metadata.get('version', 'unknown'),
            "feature_importance": top_features,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Free-tier prediction failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Prediction failed — please try again",
        )


@app.get("/models/free-tier/info", tags=["Free-Tier Predictions"])
async def free_tier_model_info():
    """
    Get information about the loaded free-tier model.

    Returns model version, training date, feature count, validation accuracy,
    and the complete feature list.
    """
    if free_tier_model is None:
        raise HTTPException(
            status_code=503,
            detail="Free-tier model not loaded",
        )

    stacked = free_tier_metadata.get('stacked_ensemble')
    ensemble_info = None
    if stacked:
        ens_metrics = free_tier_metadata.get('ensemble_metrics', {})
        ensemble_info = {
            "active": True,
            "architecture": "3 OvR binary classifiers + logistic regression meta-learner",
            "accuracy": ens_metrics.get('accuracy', 0.0),
            "per_class_accuracy": ens_metrics.get('per_class_accuracy', {}),
        }

    return {
        "version": free_tier_metadata.get('version', 'unknown'),
        "tier": free_tier_metadata.get('tier', 'free'),
        "training_date": free_tier_metadata.get('training_date', 'unknown'),
        "training_samples": free_tier_metadata.get('training_samples', 0),
        "validation_accuracy": free_tier_metadata.get('validation_accuracy', 0.0),
        "validation_log_loss": free_tier_metadata.get('validation_log_loss', 0.0),
        "feature_count": len(free_tier_metadata.get('feature_names', [])),
        "feature_names": free_tier_metadata.get('feature_names', []),
        "training_seasons": free_tier_metadata.get('training_seasons', []),
        "top_features": dict(
            sorted(
                free_tier_metadata.get('feature_importance', {}).items(),
                key=lambda x: x[1], reverse=True,
            )[:20]
        ),
        "stacked_ensemble": ensemble_info,
    }


# Error handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler — logs full error server-side, returns generic message to client."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "timestamp": datetime.now().isoformat()
        }
    )


if __name__ == "__main__":
    # Run the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
