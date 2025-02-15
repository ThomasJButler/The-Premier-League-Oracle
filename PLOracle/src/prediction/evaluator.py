import pandas as pd
import numpy as np
from typing import Dict, List, Optional
import logging
from pathlib import Path
from datetime import datetime

class ModelEvaluator:
    """Evaluates prediction model performance and accuracy."""

    def __init__(self):
        """Initialize model evaluator."""
        self.logger = logging.getLogger(__name__)
        self.evaluation_metrics = {}

    def evaluate_predictions(self, predictions: List[Dict], actual_results: pd.DataFrame) -> Dict:
        """Evaluate prediction accuracy against actual results."""
        try:
            metrics = {
                'overall_accuracy': self._calculate_accuracy(predictions, actual_results),
                'result_metrics': self._evaluate_result_predictions(predictions, actual_results),
                'score_metrics': self._evaluate_score_predictions(predictions, actual_results),
                'confidence_analysis': self._analyze_confidence_levels(predictions, actual_results)
            }
            
            self.evaluation_metrics = metrics
            return metrics
            
        except Exception as e:
            self.logger.error(f"Error evaluating predictions: {str(e)}")
            raise

    def generate_performance_report(self) -> Dict:
        """Generate detailed performance report."""
        try:
            return {
                'accuracy_trends': self._analyze_accuracy_trends(),
                'confusion_matrix': self._generate_confusion_matrix(),
                'confidence_reliability': self._analyze_confidence_reliability(),
                'error_analysis': self._analyze_prediction_errors()
            }
            
        except Exception as e:
            self.logger.error(f"Error generating performance report: {str(e)}")
            raise

    def _calculate_accuracy(self, predictions: List[Dict], actual_results: pd.DataFrame) -> float:
        """Calculate overall prediction accuracy."""
        correct_predictions = 0
        total_predictions = len(predictions)
        
        for pred, actual in zip(predictions, actual_results.itertuples()):
            if pred['predicted_result'] == actual.FTR:
                correct_predictions += 1
                
        return correct_predictions / total_predictions if total_predictions > 0 else 0

    def _evaluate_result_predictions(self, predictions: List[Dict], actual_results: pd.DataFrame) -> Dict:
        """Evaluate accuracy of match result predictions."""
        results = {'correct': 0, 'incorrect': 0}
        by_result = {'H': {'correct': 0, 'total': 0},
                    'D': {'correct': 0, 'total': 0},
                    'A': {'correct': 0, 'total': 0}}
                    
        for pred, actual in zip(predictions, actual_results.itertuples()):
            actual_result = actual.FTR
            predicted_result = pred['predicted_result']
            
            by_result[actual_result]['total'] += 1
            if predicted_result == actual_result:
                results['correct'] += 1
                by_result[actual_result]['correct'] += 1
            else:
                results['incorrect'] += 1
                
        return {
            'overall': results,
            'by_result': by_result
        }

    def _evaluate_score_predictions(self, predictions: List[Dict], actual_results: pd.DataFrame) -> Dict:
        """Evaluate accuracy of score predictions."""
        return {
            'exact_score_accuracy': self._calculate_exact_score_accuracy(predictions, actual_results),
            'goals_mae': self._calculate_goals_mae(predictions, actual_results),
            'margin_accuracy': self._calculate_margin_accuracy(predictions, actual_results)
        }

    def _analyze_confidence_levels(self, predictions: List[Dict], actual_results: pd.DataFrame) -> Dict:
        """Analyze prediction confidence levels."""
        confidence_bins = {
            'high': {'correct': 0, 'total': 0},
            'medium': {'correct': 0, 'total': 0},
            'low': {'correct': 0, 'total': 0}
        }
        
        for pred, actual in zip(predictions, actual_results.itertuples()):
            confidence = pred['confidence']
            bin_key = self._get_confidence_bin(confidence)
            
            confidence_bins[bin_key]['total'] += 1
            if pred['predicted_result'] == actual.FTR:
                confidence_bins[bin_key]['correct'] += 1
                
        return confidence_bins

    def _get_confidence_bin(self, confidence: float) -> str:
        """Determine confidence level bin."""
        if confidence >= 0.7:
            return 'high'
        elif confidence >= 0.4:
            return 'medium'
        return 'low'

    def _analyze_accuracy_trends(self) -> Dict:
        """Analyze accuracy trends over time."""
        if not self.evaluation_metrics:
            return {}
            
        return {
            'recent_trend': self._calculate_recent_trend(),
            'seasonal_pattern': self._analyze_seasonal_pattern(),
            'confidence_trend': self._analyze_confidence_trend()
        }

    def _generate_confusion_matrix(self) -> Dict:
        """Generate confusion matrix for predictions."""
        if not self.evaluation_metrics:
            return {}
            
        matrix = {
            'true_positives': 0,
            'false_positives': 0,
            'true_negatives': 0,
            'false_negatives': 0
        }
        
        return matrix

    def _analyze_confidence_reliability(self) -> Dict:
        """Analyze reliability of confidence scores."""
        if not self.evaluation_metrics:
            return {}
            
        return {
            'calibration_score': self._calculate_calibration_score(),
            'reliability_diagram': self._generate_reliability_diagram()
        }