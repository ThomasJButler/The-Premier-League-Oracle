from .predictor import EPLPredictionModel, MatchPrediction
from .evaluator import ModelEvaluator

__all__ = [
    'EPLPredictionModel',
    'MatchPrediction',  
    'ModelEvaluator'
]

# Package version
__version__ = '2.0.0'

# Package metadata
__author__ = 'AiTomatic'
__description__ = 'Prediction components for EPL Predictor system'

# Default model parameters
DEFAULT_MODEL_WEIGHTS = {
    'form': 0.3,
    'head_to_head': 0.2,
    'goals': 0.2,
    'defense': 0.15,
    'home_away': 0.15
}