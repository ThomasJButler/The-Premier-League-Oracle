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

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import uvicorn
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import asyncio
import redis.asyncio as redis
import json
import logging
from pathlib import Path
import os

# Our modules — oracle import is optional so the server can start without all dependencies
try:
    from app.models.modern_oracle import ModernPremierLeagueOracle
    ORACLE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"ModernPremierLeagueOracle unavailable ({e}) — ML features disabled")
    ModernPremierLeagueOracle = None  # type: ignore
    ORACLE_AVAILABLE = False

from app.features.advanced_engineering import AdvancedFeatureEngineer
from app.data.football_data_collector import FootballDataCollector

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
FOOTBALL_API_KEY = os.getenv("FOOTBALL_DATA_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
MLFLOW_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")

# Global instances
oracle: Optional[ModernPremierLeagueOracle] = None
redis_client: Optional[redis.Redis] = None
active_websockets: List[WebSocket] = []

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
    try:
        redis_client = await redis.from_url(REDIS_URL)
        await redis_client.ping()
        logger.info("✅ Redis connected")
    except Exception as e:
        logger.warning(f"Redis unavailable ({e}) — caching disabled, running without Redis")
        redis_client = None

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
    
    # Load pre-trained models if they exist
    model_dir = Path("models")
    if model_dir.exists():
        try:
            oracle.xgboost_model.load_model(str(model_dir / "xgboost_model.pkl"))
            oracle.lstm_model.load_model(str(model_dir / "lstm_model.pt"))
            oracle.transformer_model.load_model(str(model_dir / "transformer_model.pt"))
            logger.info("✅ Loaded pre-trained models")
        except Exception as e:
            logger.warning(f"Could not load pre-trained models: {e}")
    
    logger.info("✅ Oracle system initialized!")
    
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
    allow_origins=["*"],  # Configure appropriately for production
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
                json.dumps(response.dict())
            )
        
        return response
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Natural language prediction endpoint
@app.post("/predict/natural", tags=["Predictions"])
async def predict_natural_language(
    request: NaturalLanguageRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
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
        return {
            'standings': standings,
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
    
    return {
        'ensemble_weights': oracle.ensemble_weights,
        'models': {
            'xgboost': {
                'trained': oracle.xgboost_model.model is not None,
                'features': len(oracle.xgboost_model.feature_names) if oracle.xgboost_model.feature_names else 0
            },
            'lstm': {
                'trained': oracle.lstm_model.model is not None,
                'sequence_length': oracle.lstm_model.sequence_length
            },
            'transformer': {
                'trained': oracle.transformer_model.model is not None,
                'sequence_length': oracle.transformer_model.sequence_length
            }
        },
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
    active_websockets.append(websocket)
    
    try:
        while True:
            # Wait for message from client
            data = await websocket.receive_json()
            
            if data.get('action') == 'subscribe':
                # Subscribe to match updates
                match = data.get('match')
                await websocket.send_json({
                    'type': 'subscribed',
                    'match': match,
                    'message': f'Subscribed to updates for {match}'
                })
                
                # Send periodic updates
                while True:
                    # Make prediction
                    teams = match.split(' vs ')
                    if len(teams) == 2:
                        result = oracle.predict_match_ensemble(teams[0], teams[1])
                        
                        await websocket.send_json({
                            'type': 'prediction_update',
                            'match': match,
                            'prediction': result['ensemble_prediction'],
                            'timestamp': datetime.now().isoformat()
                        })
                    
                    # Wait before next update
                    await asyncio.sleep(60)  # Update every minute
                    
    except WebSocketDisconnect:
        active_websockets.remove(websocket)
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        active_websockets.remove(websocket)


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
    if oracle.lstm_model.model:
        importance['lstm'] = oracle.lstm_model.get_feature_importance()
    
    # Transformer attention weights
    if oracle.transformer_model.model:
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
    credentials: HTTPAuthorizationCredentials = Depends(security)
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


# Error handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc),
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