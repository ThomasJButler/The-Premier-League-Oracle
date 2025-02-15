from .vizzu_charts import EPLVizualizer

__all__ = [
    'EPLVizualizer',
    'ChartTheme'
]

# Package version
__version__ = '2.0.0'

# Package metadata
__author__ = 'AiTomatic'
__description__ = 'Visualization components for EPL Predictor system'

# Default chart settings
DEFAULT_CHART_CONFIG = {
    'width': '100%',
    'height': '400px',
    'colors': {
        'primary': '#2E4057',
        'secondary': '#66A0E1',
        'accent': '#FF9B71',
        'win': '#28a745', 
        'draw': '#ffc107',
        'loss': '#dc3545',
        'home': '#4CAF50',
        'away': '#2196F3'
    }
}