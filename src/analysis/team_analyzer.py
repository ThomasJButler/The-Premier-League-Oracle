import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Union
import logging
from pathlib import Path

class TeamAnalyzer:
    """Analyzes team performance patterns and statistics."""
    
    def __init__(self):
        """Initialize team analyzer."""
        self.logger = logging.getLogger(__name__)

    def analyze_team_performance(self, team: str, matches: pd.DataFrame) -> Dict:
        """Analyze overall team performance metrics."""
        try:
            return {
                'form_analysis': self._analyze_form_patterns(matches, team),
                'scoring_analysis': self._analyze_scoring_patterns(matches, team),
                'venue_analysis': self._analyze_venue_impact(matches, team),
                'performance_trends': self._analyze_performance_trends(matches, team)
            }
            
        except Exception as e:
            self.logger.error(f"Error analyzing team performance: {str(e)}")
            raise

    def analyze_form_patterns(self, matches: pd.DataFrame, team: str) -> Dict:
        """Analyze team form patterns."""
        try:
            return {
                'win_streak': self._get_streak_stats(matches['result'], 'W'),
                'unbeaten_streak': self._get_streak_stats(matches['result'], ['W', 'D']),
                'scoring_streak': self._get_scoring_streak_stats(matches, team),
                'clean_sheet_streak': self._get_clean_sheet_streak_stats(matches, team)
            }
            
        except Exception as e:
            self.logger.error(f"Error analyzing form patterns: {str(e)}")
            raise

    def analyze_scoring_patterns(self, matches: pd.DataFrame, team: str) -> Dict:
        """Analyze team scoring patterns."""
        try:
            return {
                'goals_scored': {
                    'total': matches['goals_for'].sum(),
                    'average': matches['goals_for'].mean(),
                    'distribution': self._get_goals_distribution(matches['goals_for'])
                },
                'goals_conceded': {
                    'total': matches['goals_against'].sum(),
                    'average': matches['goals_against'].mean(),
                    'distribution': self._get_goals_distribution(matches['goals_against'])
                }
            }
            
        except Exception as e:
            self.logger.error(f"Error analyzing scoring patterns: {str(e)}")
            raise

    def _analyze_performance_trends(self, matches: pd.DataFrame, team: str) -> Dict:
        """Analyze team performance trends over time."""
        return {
            'form_trend': self._calculate_form_trend(matches),
            'goal_trend': self._calculate_goal_trend(matches),
            'defense_trend': self._calculate_defense_trend(matches)
        }

    def _get_streak_stats(self, series: pd.Series, values: Union[str, List[str]]) -> Dict:
        """Calculate streak statistics."""
        current_streak = 0
        max_streak = 0
        streaks = []

        if isinstance(values, str):
            values = [values]

        for result in series:
            if result in values:
                current_streak += 1
            else:
                streaks.append(current_streak)
                current_streak = 0
            max_streak = max(max_streak, current_streak)

        return {
            'current': current_streak,
            'max': max_streak,
            'average': np.mean(streaks) if streaks else 0
        }

    def _get_goals_distribution(self, goals: pd.Series) -> Dict[int, int]:
        """Get distribution of goals scored/conceded."""
        return goals.value_counts().sort_index().to_dict()

    def _analyze_venue_impact(self, matches: pd.DataFrame, team: str) -> Dict:
        """Analyze impact of venue on performance."""
        home_matches = matches[matches['venue'] == 'home']
        away_matches = matches[matches['venue'] == 'away']

        return {
            'home_performance': {
                'wins': len(home_matches[home_matches['result'] == 'H']),
                'draws': len(home_matches[home_matches['result'] == 'D']),
                'losses': len(home_matches[home_matches['result'] == 'A']),
                'goals_for_avg': home_matches['goals_for'].mean(),
                'goals_against_avg': home_matches['goals_against'].mean()
            },
            'away_performance': {
                'wins': len(away_matches[away_matches['result'] == 'A']),
                'draws': len(away_matches[away_matches['result'] == 'D']),
                'losses': len(away_matches[away_matches['result'] == 'H']),
                'goals_for_avg': away_matches['goals_for'].mean(),
                'goals_against_avg': away_matches['goals_against'].mean()
            }
        }