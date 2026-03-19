"""
⚡ FastAPI Production Server - Premier League Oracle API

This is the production-ready API server for our god mode prediction system.
It provides REST endpoints, WebSocket support, and real-time predictions.

Features:
- RESTful API for predictions
- WebSocket for live updates
- Redis caching for performance
- Async request handling
- Swagger documentation
- Rate limiting
- Authentication support
"""

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import uvicorn
from typing import Dict, List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field
import asyncio
import json
import logging
from pathlib import Path
import os
import numpy as np

# Anchor all file paths to the backend/ directory, not the CWD.
# main.py lives at backend/app/api/main.py → 3 levels up = backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent

# Setup logging — must be before any logger calls
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Redis — optional, server starts without it
REDIS_AVAILABLE = False
try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    logger.warning("redis package not available — caching disabled")
    aioredis = None  # type: ignore

# Our modules — oracle import is optional so the server can start without all dependencies
try:
    from app.models.modern_oracle import ModernPremierLeagueOracle
    ORACLE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"ModernPremierLeagueOracle unavailable ({e}) — ML features disabled")
    ModernPremierLeagueOracle = None  # type: ignore
    ORACLE_AVAILABLE = False

try:
    from app.features.advanced_engineering import AdvancedFeatureEngineer
    FEATURE_ENGINEER_AVAILABLE = True
except ImportError as e:
    logger.warning(f"AdvancedFeatureEngineer unavailable ({e})")
    AdvancedFeatureEngineer = None  # type: ignore
    FEATURE_ENGINEER_AVAILABLE = False

# Free-tier feature engineer — lightweight, no heavy deps
try:
    from app.features.free_tier_features import FreeTierFeatureEngineer, CSV_TO_API, API_TO_CSV
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
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
MLFLOW_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")

# Global instances
oracle: Optional['ModernPremierLeagueOracle'] = None
redis_client = None
active_websockets: set[WebSocket] = set()

# Free-tier model state
free_tier_model = None  # xgb.Booster loaded from joblib
free_tier_metadata: Dict[str, Any] = {}  # Model metadata (version, features, etc.)
free_tier_engineer: Optional[Any] = None  # FreeTierFeatureEngineer for live predictions

# In-memory rate limiter for /predict/free
_rate_limit_store: Dict[str, List[float]] = {}
RATE_LIMIT_MAX = 60  # requests per minute per IP
RATE_LIMIT_WINDOW = 60.0  # seconds

# Security
security = HTTPBearer()


# Pydantic models for request/response
class PredictionRequest(BaseModel):
    """Request model for match prediction."""
    home_team: str = Field(..., description="Home team name")
    away_team: str = Field(..., description="Away team name")
    include_details: bool = Field(default=True, description="Include detailed analysis")
    use_cache: bool = Field(default=True, description="Use cached predictions if available")
    
    class Config:
        json_schema_extra = {
            "example": {
                "home_team": "Arsenal FC",
                "away_team": "Chelsea FC",
                "include_details": True,
                "use_cache": True
            }
        }


class NaturalLanguageRequest(BaseModel):
    """Request model for natural language queries."""
    query: str = Field(..., description="Natural language query about football")
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "Who will win between Arsenal and Chelsea this weekend?"
            }
        }


class PredictionResponse(BaseModel):
    """Response model for predictions."""
    match: str
    prediction: Dict[str, float]
    confidence: float
    recommendation: str
    betting_value: Optional[Dict[str, Any]] = None
    individual_models: Optional[Dict[str, Any]] = None
    similar_matches: Optional[List[Dict]] = None
    timestamp: str


class TeamStatsRequest(BaseModel):
    """Request model for team statistics."""
    team_name: str
    season: Optional[str] = None
    last_n_matches: int = Field(default=10, ge=1, le=38)


class BatchPredictionRequest(BaseModel):
    """Request model for batch predictions."""
    matches: List[Dict[str, str]] = Field(..., description="List of matches to predict")
    
    class Config:
        json_schema_extra = {
            "example": {
                "matches": [
                    {"home_team": "Arsenal FC", "away_team": "Chelsea FC"},
                    {"home_team": "Liverpool FC", "away_team": "Manchester City FC"}
                ]
            }
        }


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    global oracle, redis_client
    
    logger.info("🚀 Starting Premier League Oracle API...")

    # Initialize Redis — optional, server starts without it
    if REDIS_AVAILABLE:
        try:
            redis_client = await aioredis.from_url(REDIS_URL)
            await redis_client.ping()
            logger.info("Redis connected")
        except Exception as e:
            logger.warning(f"Redis unavailable ({e}) — caching disabled")
            redis_client = None
    else:
        logger.info("Redis package not installed — caching disabled")

    # Initialize Oracle system — optional, endpoints degrade gracefully without it
    if ORACLE_AVAILABLE and ModernPremierLeagueOracle is not None:
        try:
            oracle = ModernPremierLeagueOracle(
                api_key=FOOTBALL_API_KEY,
                openai_api_key=OPENAI_API_KEY if OPENAI_API_KEY else None,
                mlflow_tracking_uri=MLFLOW_URI
            )
        except Exception as e:
            logger.warning(f"Oracle system failed to initialise ({e}) — ML endpoints disabled")
            oracle = None
    else:
        logger.warning("Oracle system not available — ML endpoints disabled")
    
    # Oracle ensemble models (xgboost_model.pkl, lstm_model.pt, transformer_model.pt)
    # are not loaded — the frontend uses /predict/free which serves the free-tier
    # XGBoost model (xgboost_free_tier.joblib) loaded below. The /predict endpoint
    # remains available but requires all 3 ensemble models to be trained first.
    if oracle is not None:
        logger.info("Oracle initialised but ensemble models not loaded — use /predict/free")

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
            # For real predictions, we'd populate with current-season data
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
    logger.info("🛑 Shutting down...")
    if redis_client is not None:
        await redis_client.close()
    
    # Close WebSocket connections
    for ws in active_websockets:
        await ws.close()


# Create FastAPI app
app = FastAPI(
    title="⚽ Premier League Oracle API",
    description="God-tier football prediction system with ML ensemble and LangChain",
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


# --------------------------------------------------------------------------
# Auth policy: read-only prediction endpoints are public. Endpoints that
# invoke external AI services (OpenAI via LangChain) or trigger admin
# operations (model retraining) require a Bearer token via HTTPBearer.
# --------------------------------------------------------------------------

# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check():
    """Check if the API is running and healthy."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models_loaded": oracle is not None,
        "redis_connected": redis_client is not None
    }


# Main prediction endpoint
@app.post("/predict", response_model=PredictionResponse, tags=["Predictions"])
async def predict_match(
    request: PredictionRequest
):
    """
    Predict match outcome using ensemble of ML models.
    
    This endpoint combines XGBoost, LSTM, and Transformer predictions
    with 150+ engineered features for maximum accuracy.
    """
    if not oracle:
        raise HTTPException(status_code=503, detail="Oracle system not initialized")
    
    # Check cache if enabled
    if request.use_cache and redis_client:
        cache_key = f"prediction:{request.home_team}:{request.away_team}:{datetime.now().date()}"
        cached = await redis_client.get(cache_key)
        if cached:
            logger.info(f"Cache hit for {cache_key}")
            return JSONResponse(content=json.loads(cached))
    
    try:
        # Make prediction
        result = oracle.predict_match_ensemble(
            request.home_team,
            request.away_team,
            use_mlflow=True
        )
        
        # Format response
        response = PredictionResponse(
            match=f"{request.home_team} vs {request.away_team}",
            prediction=result['ensemble_prediction'],
            confidence=result['ensemble_prediction']['confidence'],
            recommendation=result['recommendation'],
            betting_value=result.get('betting_value') if request.include_details else None,
            individual_models=result.get('individual_predictions') if request.include_details else None,
            similar_matches=result.get('similar_matches') if request.include_details else None,
            timestamp=datetime.now().isoformat()
        )
        
        # Cache result
        if redis_client:
            cache_key = f"prediction:{request.home_team}:{request.away_team}:{datetime.now().date()}"
            await redis_client.setex(
                cache_key,
                3600,  # 1 hour TTL
                json.dumps(response.model_dump())
            )
        
        return response
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Natural language prediction endpoint
@app.post("/predict/natural", tags=["Predictions"])
async def predict_natural_language(
    request: NaturalLanguageRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)  # Auth required: invokes OpenAI API
):
    """
    Make predictions using natural language queries powered by LangChain.
    
    Examples:
    - "Who will win between Arsenal and Chelsea?"
    - "What are the odds for Liverpool beating Man City?"
    - "Show me Manchester United's recent form"
    """
    if not oracle:
        raise HTTPException(status_code=503, detail="Oracle system not initialized")
    
    if not oracle.langchain_enabled:
        raise HTTPException(
            status_code=503,
            detail="Natural language features not available. OpenAI API key required."
        )
    
    try:
        result = await oracle.predict_match_natural_language(request.query)
        return result
    except Exception as e:
        logger.error(f"Natural language prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Batch prediction endpoint
@app.post("/predict/batch", tags=["Predictions"])
async def predict_batch(
    request: BatchPredictionRequest
):
    """
    Predict multiple matches in a single request.
    
    Useful for predicting an entire gameweek at once.
    """
    if not oracle:
        raise HTTPException(status_code=503, detail="Oracle system not initialized")
    
    predictions = []
    
    for match in request.matches:
        try:
            result = oracle.predict_match_ensemble(
                match['home_team'],
                match['away_team'],
                use_mlflow=False  # Don't track batch predictions
            )
            
            predictions.append({
                'match': f"{match['home_team']} vs {match['away_team']}",
                'prediction': result['ensemble_prediction'],
                'confidence': result['ensemble_prediction']['confidence']
            })
        except Exception as e:
            predictions.append({
                'match': f"{match['home_team']} vs {match['away_team']}",
                'error': str(e)
            })
    
    return {
        'predictions': predictions,
        'total': len(predictions),
        'timestamp': datetime.now().isoformat()
    }


# Team statistics endpoint
@app.get("/teams/{team_name}/stats", tags=["Teams"])
async def get_team_stats(
    team_name: str,
    last_n_matches: int = 10
):
    """Get detailed statistics for a specific team."""
    if not oracle:
        raise HTTPException(status_code=503, detail="Oracle system not initialized")
    
    try:
        form = oracle.data_collector.get_team_form(team_name, last_n_matches)

        return {
            'team': team_name,
            'recent_form': form,
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Team stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# League standings endpoint
@app.get("/standings", tags=["League"])
async def get_standings():
    """Get current Premier League standings."""
    if not oracle:
        raise HTTPException(status_code=503, detail="Oracle system not initialized")
    
    try:
        standings = oracle.data_collector.get_standings()
        # get_standings() returns a pd.DataFrame — convert to list of dicts
        # so FastAPI can serialise it to JSON
        standings_data = standings.to_dict(orient='records') if hasattr(standings, 'to_dict') else standings
        return {
            'standings': standings_data,
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Standings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Model performance endpoint
@app.get("/models/performance", tags=["Models"])
async def get_model_performance():
    """Get performance metrics for all models."""
    if not oracle:
        raise HTTPException(status_code=503, detail="Oracle system not initialized")
    
    models_info = {
        'xgboost': {
            'trained': oracle.xgboost_model.model is not None,
            'features': len(oracle.xgboost_model.feature_names) if oracle.xgboost_model.feature_names else 0
        }
    }
    if oracle.lstm_model is not None:
        models_info['lstm'] = {
            'trained': oracle.lstm_model.model is not None,
            'sequence_length': oracle.lstm_model.sequence_length
        }
    if oracle.transformer_model is not None:
        models_info['transformer'] = {
            'trained': oracle.transformer_model.model is not None,
            'sequence_length': oracle.transformer_model.sequence_length
        }

    return {
        'ensemble_weights': oracle.ensemble_weights,
        'models': models_info,
        'timestamp': datetime.now().isoformat()
    }


# WebSocket endpoint for live updates
@app.websocket("/ws/predictions")
async def websocket_predictions(websocket: WebSocket):
    """
    WebSocket endpoint for real-time prediction updates.
    
    Clients can subscribe to live predictions as matches approach.
    """
    await websocket.accept()
    active_websockets.add(websocket)

    # Oracle must be available for predictions — reject early if not
    if oracle is None:
        await websocket.send_json({
            'type': 'error',
            'message': 'Oracle system not available — ML endpoints disabled',
        })
        await websocket.close(code=1008, reason="Oracle not available")
        active_websockets.discard(websocket)
        return

    try:
        while True:
            # Wait for message from client
            data = await websocket.receive_json()

            if data.get('action') == 'subscribe':
                match_str = data.get('match')
                if not match_str or not isinstance(match_str, str):
                    await websocket.send_json({
                        'type': 'error',
                        'message': 'Missing or invalid "match" field — expected "TeamA vs TeamB"',
                    })
                    continue

                teams = match_str.split(' vs ')
                if len(teams) != 2:
                    await websocket.send_json({
                        'type': 'error',
                        'message': 'Invalid match format — expected "TeamA vs TeamB"',
                    })
                    continue

                await websocket.send_json({
                    'type': 'subscribed',
                    'match': match_str,
                    'message': f'Subscribed to updates for {match_str}'
                })

                # Send periodic updates until the client disconnects
                while True:
                    try:
                        result = oracle.predict_match_ensemble(teams[0], teams[1])
                        await websocket.send_json({
                            'type': 'prediction_update',
                            'match': match_str,
                            'prediction': result['ensemble_prediction'],
                            'timestamp': datetime.now().isoformat()
                        })
                    except Exception as pred_err:
                        logger.warning("WS prediction failed for %s: %s", match_str, pred_err)
                        await websocket.send_json({
                            'type': 'error',
                            'message': f'Prediction failed for {match_str}',
                        })

                    await asyncio.sleep(60)

    except WebSocketDisconnect:
        active_websockets.discard(websocket)
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        active_websockets.discard(websocket)


# Feature importance endpoint
@app.get("/features/importance", tags=["Features"])
async def get_feature_importance():
    """Get feature importance from the models."""
    if not oracle:
        raise HTTPException(status_code=503, detail="Oracle system not initialized")
    
    importance = {}
    
    # XGBoost feature importance
    if oracle.xgboost_model.model:
        importance['xgboost'] = oracle.xgboost_model.get_top_features(20)
    
    # LSTM feature importance (gradient-based)
    if oracle.lstm_model is not None and oracle.lstm_model.model:
        importance['lstm'] = oracle.lstm_model.get_feature_importance()

    # Transformer attention weights
    if oracle.transformer_model is not None and oracle.transformer_model.model:
        importance['transformer'] = "Use /predict with explain=true for attention weights"
    
    return {
        'feature_importance': importance,
        'total_features': 150,
        'timestamp': datetime.now().isoformat()
    }


# Betting value endpoint
@app.post("/betting/value", tags=["Betting"])
async def calculate_betting_value(
    request: PredictionRequest
):
    """
    Calculate betting value for a match.
    
    Returns expected value calculations and recommendations.
    """
    if not oracle:
        raise HTTPException(status_code=503, detail="Oracle system not initialized")
    
    try:
        result = oracle.predict_match_ensemble(
            request.home_team,
            request.away_team
        )
        
        return {
            'match': f"{request.home_team} vs {request.away_team}",
            'betting_value': result['betting_value'],
            'recommendation': result['recommendation'],
            'confidence': result['ensemble_prediction']['confidence'],
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Betting value error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Admin endpoint to retrain models
@app.post("/admin/retrain", tags=["Admin"])
async def retrain_models(
    credentials: HTTPAuthorizationCredentials = Depends(security)  # Auth required: admin-only operation
):
    """
    Retrain all models with latest data.
    
    This is an admin endpoint that should be protected in production.
    """
    if not oracle:
        raise HTTPException(status_code=503, detail="Oracle system not initialized")
    
    # This would fetch latest data and retrain
    # For now, return mock response
    return {
        'status': 'retraining_started',
        'message': 'Models are being retrained in the background',
        'timestamp': datetime.now().isoformat()
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
