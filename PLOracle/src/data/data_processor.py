import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Union
import logging
from pathlib import Path

class EPLDataProcessor:
    """Processes EPL match data for analysis and prediction."""

    def __init__(self):
        """Initialize data processor."""
        self.logger = logging.getLogger(__name__)

    def process_historical_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """Process historical match data."""
        try:
            processed_data = data.copy()
            
            # Add calculated columns
            processed_data['total_goals'] = processed_data['FTHG'] + processed_data['FTAG']
            processed_data['goal_difference'] = processed_data['FTHG'] - processed_data['FTAG']
            processed_data['points'] = self._calculate_points(processed_data['FTR'])
            
            # Add form indicators
            processed_data['form_indicator'] = self._calculate_form_indicators(processed_data)
            
            return processed_data
            
        except Exception as e:
            self.logger.error(f"Error processing historical data: {str(e)}")
            raise

    def calculate_team_stats(self, matches: pd.DataFrame, team: str) -> Dict:
        """Calculate comprehensive team statistics."""
        try:
            home_matches = matches[matches['HomeTeam'] == team]
            away_matches = matches[matches['AwayTeam'] == team]
            
            return {
                'overall_stats': self._calculate_overall_stats(home_matches, away_matches),
                'scoring_stats': self._calculate_scoring_stats(home_matches, away_matches),
                'form_stats': self._calculate_form_stats(home_matches, away_matches),
                'performance_metrics': self._calculate_performance_metrics(home_matches, away_matches)
            }
            
        except Exception as e:
            self.logger.error(f"Error calculating team stats: {str(e)}")
            raise

    def process_head_to_head(self, matches: pd.DataFrame, team1: str, team2: str) -> pd.DataFrame:
        """Process head-to-head match data."""
        try:
            h2h_matches = matches[
                ((matches['HomeTeam'] == team1) & (matches['AwayTeam'] == team2)) |
                ((matches['HomeTeam'] == team2) & (matches['AwayTeam'] == team1))
            ]
            
            h2h_matches['winner'] = h2h_matches.apply(self._determine_winner, axis=1)
            h2h_matches['dominance_score'] = self._calculate_dominance_score(h2h_matches)
            
            return h2h_matches
            
        except Exception as e:
            self.logger.error(f"Error processing head-to-head data: {str(e)}")
            raise

    def _calculate_points(self, results: pd.Series) -> pd.Series:
        """Calculate points from match results."""
        return results.map({'H': 3, 'D': 1, 'A': 0})

    def _calculate_form_indicators(self, data: pd.DataFrame) -> pd.Series:
        """Calculate form indicators based on recent results."""
        form_values = {'W': 3, 'D': 1, 'L': 0}
        return data['FTR'].map({'H': 'W', 'D': 'D', 'A': 'L'}).map(form_values)

    def _calculate_overall_stats(self, home_matches: pd.DataFrame, away_matches: pd.DataFrame) -> Dict:
        """Calculate overall team statistics."""
        total_matches = len(home_matches) + len(away_matches)
        
        return {
            'matches_played': total_matches,
            'wins': sum((home_matches['FTR'] == 'H')) + sum((away_matches['FTR'] == 'A')),
            'draws': sum((home_matches['FTR'] == 'D')) + sum((away_matches['FTR'] == 'D')),
            'losses': sum((home_matches['FTR'] == 'A')) + sum((away_matches['FTR'] == 'H')),
            'goals_scored': sum(home_matches['FTHG']) + sum(away_matches['FTAG']),
            'goals_conceded': sum(home_matches['FTAG']) + sum(away_matches['FTHG'])
        }

    def _calculate_scoring_stats(self, home_matches: pd.DataFrame, away_matches: pd.DataFrame) -> Dict:
        """Calculate detailed scoring statistics."""
        return {
            'avg_goals_scored': (sum(home_matches['FTHG']) + sum(away_matches['FTAG'])) / (len(home_matches) + len(away_matches)),
            'avg_goals_conceded': (sum(home_matches['FTAG']) + sum(away_matches['FTHG'])) / (len(home_matches) + len(away_matches)),
            'clean_sheets': sum((home_matches['FTAG'] == 0)) + sum((away_matches['FTHG'] == 0)),
            'failed_to_score': sum((home_matches['FTHG'] == 0)) + sum((away_matches['FTAG'] == 0))
        }

    def _calculate_form_stats(self, home_matches: pd.DataFrame, away_matches: pd.DataFrame) -> Dict:
        """Calculate form-related statistics."""
        recent_matches = pd.concat([home_matches, away_matches]).sort_values('Date').tail(5)
        
        return {
            'recent_form': self._get_form_string(recent_matches),
            'form_score': self._calculate_form_score(recent_matches),
            'trend': self._calculate_trend(recent_matches)
        }

    def _calculate_performance_metrics(self, home_matches: pd.DataFrame, away_matches: pd.DataFrame) -> Dict:
        """Calculate advanced performance metrics."""
        return {
            'attack_strength': self._calculate_attack_strength(home_matches, away_matches),
            'defense_strength': self._calculate_defense_strength(home_matches, away_matches),
            'home_advantage': self._calculate_home_advantage(home_matches),
            'consistency': self._calculate_consistency(home_matches, away_matches)
        }

    def _determine_winner(self, match: pd.Series) -> str:
        """Determine the winner of a match."""
        if match['FTR'] == 'D':
            return 'Draw'
        return match['HomeTeam'] if match['FTR'] == 'H' else match['AwayTeam']

    def _calculate_dominance_score(self, matches: pd.DataFrame) -> pd.Series:
        """Calculate dominance score based on match statistics."""
        return (matches['HS'] / (matches['HS'] + matches['AS']) * 0.3 +
                matches['HST'] / (matches['HST'] + matches['AST']) * 0.4 +
                matches['HC'] / (matches['HC'] + matches['AC']) * 0.3)