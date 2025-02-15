from src.data.data_processor import EPLDataProcessor
from src.analysis.match_analyzer import MatchAnalyzer
from src.prediction.predictor import EPLPredictionModel
from src.prediction.evaluator import ModelEvaluator
from src.visualization.vizzu_charts import EPLVizualizer

__version__ = '2.0.0'
__author__ = 'AiTomatic'
__description__ = 'Premier League match prediction and analysis system'

__all__ = [
    # Data Components
    'EPLDataHandler',
    'EPLDataProcessor',
    
    # Analysis Components
    'TeamAnalyzer',
    'MatchAnalyzer',
    
    # Prediction Components
    'EPLPredictionModel',
    'ModelEvaluator',
    
    # Visualization Components
    'EPLVizualizer'
]

# Default configuration
DEFAULT_CONFIG_PATH = 'config/config.yaml'