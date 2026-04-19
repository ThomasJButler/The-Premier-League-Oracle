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

import anthropic
import numpy as np
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Anchor all file paths to the backend/ directory, not the CWD.
# main.py lives at backend/app/api/main.py → 3 levels up = backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent

# Load .env from the backend root directory
load_dotenv(BACKEND_ROOT / ".env")

# Setup logging — must be before any logger calls
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Free-tier feature engineer — lightweight, no heavy deps
try:
    from app.features.free_tier_features import _ALIASES, CSV_TO_API, FreeTierFeatureEngineer
    FREE_TIER_AVAILABLE = True
except ImportError as e:
    logger.warning(f"FreeTierFeatureEngineer unavailable ({e})")
    FreeTierFeatureEngineer = None  # type: ignore
    CSV_TO_API = {}  # type: ignore
    _ALIASES = {}  # type: ignore
    FREE_TIER_AVAILABLE = False

try:
    from app.api.rag import build_rag_prompt, init_player_data, init_team_patterns
    RAG_AVAILABLE = True
except ImportError as e:
    logger.warning(f"RAG module unavailable ({e})")
    RAG_AVAILABLE = False

try:
    from app.api.web_search import inject_search_context, search_premier_league
    WEB_SEARCH_AVAILABLE = True
except ImportError as e:
    logger.info(f"Web search fallback unavailable ({e})")
    WEB_SEARCH_AVAILABLE = False

try:
    from app.data.football_data_collector import FootballDataCollector
    DATA_COLLECTOR_AVAILABLE = True
except ImportError as e:
    logger.warning(f"FootballDataCollector unavailable ({e})")
    FootballDataCollector = None  # type: ignore
    DATA_COLLECTOR_AVAILABLE = False

# Environment variables
FOOTBALL_API_KEY = os.getenv("FOOTBALL_DATA_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Supported Claude models — keep in sync with api/chat.ts ALLOWED_MODELS
# and frontend/src/lib/constants.ts AI_MODELS.
ALLOWED_AI_MODELS = {
    "claude-opus-4-7",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
}
DEFAULT_AI_MODEL = "claude-haiku-4-5-20251001"

# Free-tier model state
free_tier_model = None  # xgb.Booster loaded from joblib
free_tier_metadata: dict[str, Any] = {}  # Model metadata (version, features, etc.)
free_tier_engineer: Any | None = None  # FreeTierFeatureEngineer for live predictions

# Draw classifier cascade — a dedicated binary draw-vs-not-draw model that
# overrides the main model when it's confident a match will be drawn. Loaded
# from the joblib payload at startup when available and only used when training
# confirmed it improves validation accuracy.
draw_classifier_model = None  # xgb.Booster (binary)
draw_classifier_threshold: float | None = None  # P(draw) threshold for cascade
_draw_cascade_overrides = 0  # Counts of cascade overrides since startup
_draw_cascade_total = 0

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
    global draw_classifier_model, draw_classifier_threshold
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

            # Activate the dedicated draw classifier cascade if training
            # confirmed it improved validation accuracy. The env var
            # ORACLE_DRAW_THRESHOLD overrides the trained threshold if set.
            draw_clf_payload = payload.get('draw_classifier')
            if draw_clf_payload and draw_clf_payload.get('model') is not None:
                trained_threshold = float(draw_clf_payload.get('threshold', 0.42))
                env_threshold = os.getenv('ORACLE_DRAW_THRESHOLD')
                threshold = float(env_threshold) if env_threshold else trained_threshold
                improves = bool(draw_clf_payload.get('improves_accuracy', False))
                # Default to activating when training flagged it as beneficial;
                # env var ORACLE_DRAW_CASCADE=1 force-enables, =0 force-disables.
                force = os.getenv('ORACLE_DRAW_CASCADE')
                activate = (force == '1') if force in ('0', '1') else improves
                if activate:
                    draw_classifier_model = draw_clf_payload['model']
                    draw_classifier_threshold = threshold
                    logger.info(
                        "Draw classifier cascade active (threshold=%.3f, training flagged improves=%s)",
                        threshold, improves,
                    )
                else:
                    logger.info(
                        "Draw classifier present but cascade disabled (improves_accuracy=%s, "
                        "set ORACLE_DRAW_CASCADE=1 to force-enable)",
                        improves,
                    )
            else:
                logger.info("No draw classifier in payload — skipping cascade")
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

    # Initialise RAG team patterns for intent parsing
    if RAG_AVAILABLE and FREE_TIER_AVAILABLE:
        try:
            init_team_patterns(CSV_TO_API, _ALIASES)
            logger.info("RAG team patterns initialised")
        except Exception as e:
            logger.warning("Could not initialise RAG team patterns: %s", e)

    # Load player data for RAG enrichment (P7h)
    if RAG_AVAILABLE:
        try:
            player_csv = BACKEND_ROOT / "spreadsheets" / "fact_player_stats.csv"
            api_scorers = None

            # Fetch current season top scorers from API if key is available
            if FOOTBALL_API_KEY and DATA_COLLECTOR_AVAILABLE:
                try:
                    collector = FootballDataCollector(api_key=FOOTBALL_API_KEY)
                    response = collector._make_request(
                        f"competitions/{collector.PREMIER_LEAGUE_ID}/scorers",
                        params={'limit': 30},
                        cache_ttl=3600,
                    )
                    api_scorers = response.get('scorers', [])
                    if api_scorers:
                        logger.info("Fetched %d top scorers from API", len(api_scorers))
                except Exception as api_err:
                    logger.warning("Could not fetch API scorers: %s", api_err)

            init_player_data(csv_path=player_csv, api_scorers=api_scorers)
        except Exception as e:
            logger.warning("Could not initialise player data: %s", e)

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
    odds_home: float | None = Field(
        None, description="Optional bookmaker decimal odds for home win (e.g. 2.10)",
    )
    odds_draw: float | None = Field(
        None, description="Optional bookmaker decimal odds for draw (e.g. 3.50)",
    )
    odds_away: float | None = Field(
        None, description="Optional bookmaker decimal odds for away win (e.g. 3.80)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "home_team": "Arsenal",
                "away_team": "Chelsea",
                "odds_home": 1.85,
                "odds_draw": 3.60,
                "odds_away": 4.50,
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
    """Resolve a team name to CSV format, raising 422 if unrecognised.

    Tries exact normalisation first, then case-insensitive fallback against
    the valid team set so that minor casing differences from the frontend
    (e.g. Football-Data.org API names) don't produce spurious 422s.
    """
    if not FREE_TIER_AVAILABLE:
        return name
    csv_name = FreeTierFeatureEngineer.normalize_team_name(name, to='csv')
    if csv_name in VALID_FREE_TIER_TEAMS:
        return csv_name
    # Case-insensitive fallback against valid team set
    lower = csv_name.lower()
    for valid in VALID_FREE_TIER_TEAMS:
        if valid.lower() == lower:
            return valid
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

    Uses ~109 features derived from match results, form, H2H, draw indicators,
    Elo ratings, and contextual data. Optionally accepts bookmaker odds for
    significantly improved accuracy (~55% with odds vs ~51% without).
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
        # Build odds dict from optional request fields.
        # When odds are provided, the model can use bookmaker-implied
        # probabilities — the single strongest predictor of match outcomes.
        odds: dict[str, float] | None = None
        if prediction_request.odds_home is not None:
            odds = {}
            odds['AvgH'] = prediction_request.odds_home
            if prediction_request.odds_draw is not None:
                odds['AvgD'] = prediction_request.odds_draw
            if prediction_request.odds_away is not None:
                odds['AvgA'] = prediction_request.odds_away

        # Compute features
        features = free_tier_engineer.create_features(home, away, odds=odds)
        feature_names = free_tier_metadata.get('feature_names', FreeTierFeatureEngineer.FEATURE_NAMES)
        feature_vec = [features[name] for name in feature_names]

        import xgboost as xgb
        dmatrix = xgb.DMatrix(
            [feature_vec], feature_names=feature_names,
        )

        # Use stacked ensemble if available (only saved when it outperforms
        # calibrated XGBoost), otherwise fall back to calibrated single model
        stacked = free_tier_metadata.get('stacked_ensemble')
        raw_probs = free_tier_model.predict(dmatrix)[0]

        if stacked and stacked.get('classifiers') and stacked.get('meta_learner'):
            # Stacked ensemble: 3 OvR classifiers → meta-learner
            ovr_probs = np.column_stack([
                clf.predict(dmatrix) for clf in stacked['classifiers']
            ])
            ovr_scaled = stacked['meta_scaler'].transform(ovr_probs)
            probs = stacked['meta_learner'].predict_proba(ovr_scaled)[0]
        else:
            # Single XGBoost with calibration (Dirichlet, isotonic, or Platt).
            calibrators = free_tier_metadata.get('calibrators')
            cal_method = free_tier_metadata.get('calibration_method', 'isotonic')
            if cal_method == 'dirichlet' and calibrators is not None:
                # Joint calibration: calibrators is a single DirichletCalibrator.
                probs = calibrators.predict_proba(
                    np.asarray(raw_probs).reshape(1, -1)
                )[0]
            elif calibrators and hasattr(calibrators, '__len__') and len(calibrators) == 3:
                if cal_method == 'platt':
                    cal_probs = np.array([
                        float(cal.predict_proba(
                            np.array([[raw_probs[i]]])
                        )[0, 1])
                        for i, cal in enumerate(calibrators)
                    ])
                else:
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

        # Classification: use raw probabilities for the predicted outcome.
        # Calibration improves probability estimates (log loss) but can
        # suppress the draw class — isotonic calibration maps draw probs
        # to near-zero because the model's draw accuracy is low. However,
        # the raw model has draw AUC-ROC 0.601, meaning it *can* identify
        # draw-prone matches. Using raw probs for argmax recovers ~16%
        # draw accuracy vs 0% after calibration, while the returned
        # probabilities still use calibrated values for better estimates.
        outcome_idx = int(np.argmax(raw_probs))
        draw_cascade_override = False
        draw_clf_prob: float | None = None

        # Dedicated draw classifier cascade: when the binary draw model is
        # confident a match will be drawn (P(draw) > threshold), override the
        # main model's prediction. Recovers part of the draw signal that the
        # calibrated 3-class model suppresses.
        if draw_classifier_model is not None and draw_classifier_threshold is not None:
            global _draw_cascade_overrides, _draw_cascade_total
            _draw_cascade_total += 1
            draw_clf_prob = float(draw_classifier_model.predict(dmatrix)[0])
            if draw_clf_prob > draw_classifier_threshold:
                outcome_idx = 1  # Draw
                draw_cascade_override = True
                _draw_cascade_overrides += 1
                # Log override rate periodically so Tom can tune the threshold
                if _draw_cascade_total % 20 == 0:
                    override_rate = _draw_cascade_overrides / _draw_cascade_total
                    logger.info(
                        "Draw cascade override rate: %.1f%% (%d/%d since startup)",
                        override_rate * 100, _draw_cascade_overrides, _draw_cascade_total,
                    )

        outcomes = ['Home win', 'Draw', 'Away win']
        predicted = outcomes[outcome_idx]

        # Top feature importances for this prediction
        importance = free_tier_metadata.get('feature_importance', {})
        top_features = dict(
            sorted(importance.items(), key=lambda x: x[1], reverse=True)[:10]
        )

        response: dict[str, Any] = {
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
        if draw_clf_prob is not None:
            response["draw_classifier"] = {
                "probability": round(draw_clf_prob, 4),
                "threshold": round(draw_classifier_threshold or 0.0, 4),
                "overrode_main_model": draw_cascade_override,
            }
        return response

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


# ---------------------------------------------------------------------------
# Oracle Chat RAG endpoint (P6b)
# ---------------------------------------------------------------------------

class ChatRAGRequest(BaseModel):
    """Request for Oracle Chat with RAG-grounded responses."""
    message: str = Field(..., min_length=1, max_length=500, description="User message")
    conversation_history: list[dict[str, str]] = Field(
        default_factory=list,
        description="Previous messages [{role, content}]",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "message": "How has Arsenal been doing this season?",
                "conversation_history": [
                    {"role": "user", "content": "Hi"},
                    {"role": "assistant", "content": "Hello! Ask me anything about the Premier League."},
                ],
            }
        }


class ChatRAGResponse(BaseModel):
    """Response from Oracle Chat RAG."""
    reply: str
    grounded: bool = Field(description="Whether the response was grounded in match data")


@app.post("/chat/rag", response_model=ChatRAGResponse, tags=["Oracle Chat"])
async def chat_rag(request_body: ChatRAGRequest, request: Request):
    """
    Oracle Chat with DataFrame RAG — data-grounded responses.

    Parses user intent, queries the in-memory historical match DataFrame
    (2,191+ matches), builds an augmented prompt with relevant data, and
    calls the Anthropic Claude API server-side. No client-side API key
    needed when ANTHROPIC_API_KEY is set.
    """
    # Rate limiting
    client_ip = _get_client_ip(request)
    if not _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded — maximum 60 requests per minute",
        )

    # Resolve Claude model — ORACLE_AI_MODEL overrides the default, but must
    # be one of the allow-listed Claude models. Unknown values fall back.
    env_model = os.getenv("ORACLE_AI_MODEL", "")
    ai_model = env_model if env_model in ALLOWED_AI_MODELS else DEFAULT_AI_MODEL

    # Resolve API key: server env var takes priority, then request header
    api_key = ANTHROPIC_API_KEY or request.headers.get('x-anthropic-key', '')

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail=(
                "No Anthropic API key configured. "
                "Set the ANTHROPIC_API_KEY environment variable or pass via "
                "X-Anthropic-Key header."
            ),
        )

    if not RAG_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="RAG module not available",
        )

    # Get the historical match DataFrame
    df = free_tier_engineer.data if free_tier_engineer is not None else None

    # Build RAG-augmented system prompt
    system_prompt, has_data = build_rag_prompt(df, request_body.message)

    # Web search fallback (P7h): when RAG can't ground on DataFrame data,
    # search the web for current Premier League information instead of
    # letting the LLM hallucinate from its training corpus.
    if not has_data and WEB_SEARCH_AVAILABLE:
        try:
            import asyncio
            search_results = await asyncio.to_thread(
                search_premier_league, request_body.message,
            )
            if search_results:
                system_prompt = inject_search_context(system_prompt, search_results)
                has_data = True
                logger.info("Web search fallback grounded response with %d results", len(search_results))
        except Exception as e:
            logger.warning("Web search fallback failed: %s", e)

    # Assemble conversation messages
    user_messages: list[dict[str, str]] = []
    for msg in request_body.conversation_history[-10:]:
        role = msg.get('role', '')
        content = msg.get('content', '')
        if role in ('user', 'assistant') and content:
            user_messages.append({"role": role, "content": content})
    user_messages.append({"role": "user", "content": request_body.message})

    try:
        client = anthropic.Anthropic(api_key=api_key)

        # Prompt caching: the RAG system prompt (team stats, player data,
        # match context) is reused across turns in a session — ephemeral
        # caching turns repeat turns into ~0.1x cost reads. Only request
        # caching when the prompt is long enough to plausibly meet the
        # model's minimum cacheable prefix (~2048 tokens for Sonnet 4.6,
        # 4096 for Haiku 4.5); ~4 chars/token → 8000 char floor.
        if len(system_prompt) >= 8000:
            system_field = [{
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }]
        else:
            system_field = [{"type": "text", "text": system_prompt}]

        response = client.messages.create(
            model=ai_model,
            max_tokens=1024,
            system=system_field,
            messages=user_messages,  # type: ignore[arg-type]
        )
        # Concatenate all text blocks — adaptive thinking on Opus 4.6/4.7 can
        # emit thinking blocks before the text block.
        reply = "".join(
            getattr(block, "text", "")
            for block in (response.content or [])
            if getattr(block, "type", None) == "text"
        )

        return ChatRAGResponse(reply=reply, grounded=has_data)
    except HTTPException:
        raise
    except anthropic.APIStatusError as e:
        # Typed SDK exceptions carry the upstream status + Anthropic's own
        # error message. Surface both so invalid-key and other 4xx failures
        # are diagnosable instead of hiding behind a generic 502.
        upstream_status = getattr(e, "status_code", 502)
        detail = getattr(e, "message", "") or str(e)
        logger.error(
            "Chat RAG Anthropic call failed (status=%s): %s",
            upstream_status, detail,
        )
        raise HTTPException(
            status_code=upstream_status if 400 <= upstream_status < 600 else 502,
            detail=f"Anthropic API error ({upstream_status}). {detail}".strip(),
        )
    except Exception as e:
        logger.error("Chat RAG Anthropic call failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail="Failed to generate response — please try again",
        )


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
