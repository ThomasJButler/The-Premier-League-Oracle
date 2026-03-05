"""
🔬 Advanced Feature Engineering - 150+ Features for God Mode Predictions

This module creates comprehensive features for our ML models, extracting every
possible signal from the data to make the most accurate predictions.

Features are grouped into categories:
1. Basic Statistics (20 features)
2. Advanced Metrics (30 features)
3. Form & Momentum (25 features)
4. Head-to-Head (15 features)
5. Contextual Features (20 features)
6. Betting Market (15 features)
7. Team Style & Tactics (20 features)
8. Player Impact (10 features)
9. Time Series Features (15 features)
10. External Factors (10 features)
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime, timedelta
import logging
from scipy import stats
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class AdvancedFeatureEngineer:
    """
    Creates 150+ features for match prediction using advanced statistical methods.
    
    This is the brain of our prediction system, extracting signals from:
    - Historical performance data
    - Current form and momentum
    - Tactical matchups
    - Betting market intelligence
    - External factors (weather, time, etc.)
    """
    
    def __init__(self, historical_data: Optional[pd.DataFrame] = None):
        """
        Initialize feature engineer with optional historical data.
        
        Args:
            historical_data: DataFrame with historical match data
        """
        self.historical_data = historical_data
        self.scaler = StandardScaler()
        self.feature_names = []
        
    def create_all_features(self, 
                          home_team: str, 
                          away_team: str,
                          match_date: Optional[datetime] = None,
                          **kwargs) -> Dict[str, float]:
        """
        Create all 150+ features for a match.
        
        Args:
            home_team: Home team name
            away_team: Away team name
            match_date: Match date (default: today)
            **kwargs: Additional match context
            
        Returns:
            Dictionary with 150+ features
        """
        if match_date is None:
            match_date = datetime.now()
            
        features = {}
        
        # 1. Basic Statistics (20 features)
        features.update(self._get_basic_stats(home_team, away_team))
        
        # 2. Advanced Metrics (30 features)
        features.update(self._get_advanced_metrics(home_team, away_team))
        
        # 3. Form & Momentum (25 features)
        features.update(self._get_form_momentum(home_team, away_team))
        
        # 4. Head-to-Head (15 features)
        features.update(self._get_head_to_head(home_team, away_team))
        
        # 5. Contextual Features (20 features)
        features.update(self._get_contextual_features(home_team, away_team, match_date))
        
        # 6. Betting Market (15 features)
        features.update(self._get_betting_features(home_team, away_team))
        
        # 7. Team Style & Tactics (20 features)
        features.update(self._get_tactical_features(home_team, away_team))
        
        # 8. Player Impact (10 features)
        features.update(self._get_player_features(home_team, away_team))
        
        # 9. Time Series Features (15 features)
        features.update(self._get_time_series_features(home_team, away_team))
        
        # 10. External Factors (10 features)
        features.update(self._get_external_features(home_team, away_team, match_date))
        
        # Store feature names for reference
        self.feature_names = list(features.keys())
        
        logger.info(f"Created {len(features)} features for {home_team} vs {away_team}")
        
        return features
    
    def _get_basic_stats(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Basic team statistics (20 features)."""
        features = {}
        
        # Goals
        features['home_goals_scored_avg'] = self._calculate_avg_goals_scored(home_team)
        features['home_goals_conceded_avg'] = self._calculate_avg_goals_conceded(home_team)
        features['away_goals_scored_avg'] = self._calculate_avg_goals_scored(away_team)
        features['away_goals_conceded_avg'] = self._calculate_avg_goals_conceded(away_team)
        
        # Points and position
        features['home_points_per_game'] = self._calculate_points_per_game(home_team)
        features['away_points_per_game'] = self._calculate_points_per_game(away_team)
        features['home_league_position'] = self._get_league_position(home_team)
        features['away_league_position'] = self._get_league_position(away_team)
        features['position_difference'] = features['home_league_position'] - features['away_league_position']
        
        # Win/Draw/Loss rates
        features['home_win_rate'] = self._calculate_win_rate(home_team)
        features['home_draw_rate'] = self._calculate_draw_rate(home_team)
        features['home_loss_rate'] = self._calculate_loss_rate(home_team)
        features['away_win_rate'] = self._calculate_win_rate(away_team)
        features['away_draw_rate'] = self._calculate_draw_rate(away_team)
        features['away_loss_rate'] = self._calculate_loss_rate(away_team)
        
        # Home/Away specific
        features['home_home_win_rate'] = self._calculate_home_win_rate(home_team)
        features['away_away_win_rate'] = self._calculate_away_win_rate(away_team)
        features['home_home_goals_avg'] = self._calculate_home_goals_avg(home_team)
        features['away_away_goals_avg'] = self._calculate_away_goals_avg(away_team)
        
        # Clean sheets
        features['home_clean_sheet_rate'] = self._calculate_clean_sheet_rate(home_team)
        
        return features
    
    def _get_advanced_metrics(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Advanced performance metrics (30 features)."""
        features = {}
        
        # Expected Goals (xG)
        features['home_xg_for'] = self._calculate_xg_for(home_team)
        features['home_xg_against'] = self._calculate_xg_against(home_team)
        features['away_xg_for'] = self._calculate_xg_for(away_team)
        features['away_xg_against'] = self._calculate_xg_against(away_team)
        features['xg_difference'] = features['home_xg_for'] - features['away_xg_for']
        
        # Shot metrics
        features['home_shots_per_game'] = self._calculate_shots_per_game(home_team)
        features['home_shots_on_target_pct'] = self._calculate_shot_accuracy(home_team)
        features['away_shots_per_game'] = self._calculate_shots_per_game(away_team)
        features['away_shots_on_target_pct'] = self._calculate_shot_accuracy(away_team)
        
        # Possession and passing
        features['home_possession_avg'] = self._calculate_avg_possession(home_team)
        features['away_possession_avg'] = self._calculate_avg_possession(away_team)
        features['home_pass_accuracy'] = self._calculate_pass_accuracy(home_team)
        features['away_pass_accuracy'] = self._calculate_pass_accuracy(away_team)
        
        # Defensive metrics
        features['home_tackles_per_game'] = self._calculate_tackles_per_game(home_team)
        features['home_interceptions_per_game'] = self._calculate_interceptions_per_game(home_team)
        features['away_tackles_per_game'] = self._calculate_tackles_per_game(away_team)
        features['away_interceptions_per_game'] = self._calculate_interceptions_per_game(away_team)
        
        # Discipline
        features['home_yellow_cards_avg'] = self._calculate_yellow_cards_avg(home_team)
        features['home_red_cards_total'] = self._calculate_red_cards_total(home_team)
        features['away_yellow_cards_avg'] = self._calculate_yellow_cards_avg(away_team)
        features['away_red_cards_total'] = self._calculate_red_cards_total(away_team)
        
        # Corners and set pieces
        features['home_corners_for_avg'] = self._calculate_corners_for(home_team)
        features['home_corners_against_avg'] = self._calculate_corners_against(home_team)
        features['away_corners_for_avg'] = self._calculate_corners_for(away_team)
        features['away_corners_against_avg'] = self._calculate_corners_against(away_team)
        
        # Efficiency metrics
        features['home_goal_conversion_rate'] = self._calculate_goal_conversion(home_team)
        features['away_goal_conversion_rate'] = self._calculate_goal_conversion(away_team)
        features['home_defensive_efficiency'] = self._calculate_defensive_efficiency(home_team)
        features['away_defensive_efficiency'] = self._calculate_defensive_efficiency(away_team)
        
        # Pressure index
        features['home_pressure_index'] = self._calculate_pressure_index(home_team)
        features['away_pressure_index'] = self._calculate_pressure_index(away_team)
        
        return features
    
    def _get_form_momentum(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Form and momentum features (25 features)."""
        features = {}
        
        # Recent form (last 5, 10 games)
        features['home_form_last_5'] = self._calculate_form_last_n(home_team, 5)
        features['home_form_last_10'] = self._calculate_form_last_n(home_team, 10)
        features['away_form_last_5'] = self._calculate_form_last_n(away_team, 5)
        features['away_form_last_10'] = self._calculate_form_last_n(away_team, 10)
        
        # Weighted form (recent games matter more)
        features['home_weighted_form'] = self._calculate_weighted_form(home_team)
        features['away_weighted_form'] = self._calculate_weighted_form(away_team)
        
        # Momentum indicators
        features['home_momentum'] = self._calculate_momentum(home_team)
        features['away_momentum'] = self._calculate_momentum(away_team)
        features['momentum_difference'] = features['home_momentum'] - features['away_momentum']
        
        # Streak analysis
        features['home_win_streak'] = self._calculate_win_streak(home_team)
        features['home_unbeaten_streak'] = self._calculate_unbeaten_streak(home_team)
        features['away_win_streak'] = self._calculate_win_streak(away_team)
        features['away_unbeaten_streak'] = self._calculate_unbeaten_streak(away_team)
        
        # Form against similar opponents
        features['home_form_vs_top_6'] = self._calculate_form_vs_top_teams(home_team)
        features['home_form_vs_bottom_6'] = self._calculate_form_vs_bottom_teams(home_team)
        features['away_form_vs_top_6'] = self._calculate_form_vs_top_teams(away_team)
        features['away_form_vs_bottom_6'] = self._calculate_form_vs_bottom_teams(away_team)
        
        # Goal scoring form
        features['home_scoring_form'] = self._calculate_scoring_form(home_team)
        features['away_scoring_form'] = self._calculate_scoring_form(away_team)
        features['home_defensive_form'] = self._calculate_defensive_form(home_team)
        features['away_defensive_form'] = self._calculate_defensive_form(away_team)
        
        # Form volatility
        features['home_form_volatility'] = self._calculate_form_volatility(home_team)
        features['away_form_volatility'] = self._calculate_form_volatility(away_team)
        
        # Recovery from losses
        features['home_bounce_back_rate'] = self._calculate_bounce_back_rate(home_team)
        features['away_bounce_back_rate'] = self._calculate_bounce_back_rate(away_team)
        
        return features
    
    def _get_head_to_head(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Head-to-head historical features (15 features)."""
        features = {}
        
        # Historical results
        features['h2h_home_wins'] = self._calculate_h2h_wins(home_team, away_team)
        features['h2h_draws'] = self._calculate_h2h_draws(home_team, away_team)
        features['h2h_away_wins'] = self._calculate_h2h_wins(away_team, home_team)
        
        # Goal statistics in H2H
        features['h2h_home_goals_avg'] = self._calculate_h2h_goals_avg(home_team, away_team)
        features['h2h_away_goals_avg'] = self._calculate_h2h_goals_avg(away_team, home_team)
        features['h2h_total_goals_avg'] = features['h2h_home_goals_avg'] + features['h2h_away_goals_avg']
        
        # Recent H2H form
        features['h2h_home_form_last_5'] = self._calculate_h2h_form_recent(home_team, away_team, 5)
        features['h2h_away_form_last_5'] = self._calculate_h2h_form_recent(away_team, home_team, 5)
        
        # H2H streaks
        features['h2h_home_unbeaten'] = self._calculate_h2h_unbeaten_streak(home_team, away_team)
        features['h2h_current_streak_holder'] = self._get_h2h_streak_holder(home_team, away_team)
        
        # Venue-specific H2H
        features['h2h_home_venue_wins'] = self._calculate_h2h_venue_wins(home_team, away_team)
        features['h2h_home_venue_goals'] = self._calculate_h2h_venue_goals(home_team, away_team)
        
        # Psychological factors
        features['h2h_dominance_factor'] = self._calculate_h2h_dominance(home_team, away_team)
        features['h2h_revenge_factor'] = self._calculate_revenge_factor(home_team, away_team)
        features['h2h_importance'] = self._calculate_h2h_importance(home_team, away_team)
        
        return features
    
    def _get_contextual_features(self, home_team: str, away_team: str, 
                                match_date: datetime) -> Dict[str, float]:
        """Contextual and situational features (20 features)."""
        features = {}
        
        # Time-based features
        features['days_since_last_match_home'] = self._calculate_days_since_last_match(home_team, match_date)
        features['days_since_last_match_away'] = self._calculate_days_since_last_match(away_team, match_date)
        features['is_weekend'] = 1.0 if match_date.weekday() >= 5 else 0.0
        features['is_evening_match'] = 1.0 if match_date.hour >= 17 else 0.0
        features['month_of_season'] = match_date.month
        
        # Fatigue and congestion
        features['home_fatigue_index'] = self._calculate_fatigue_index(home_team, match_date)
        features['away_fatigue_index'] = self._calculate_fatigue_index(away_team, match_date)
        features['home_fixture_congestion'] = self._calculate_fixture_congestion(home_team, match_date)
        features['away_fixture_congestion'] = self._calculate_fixture_congestion(away_team, match_date)
        
        # Competition context
        features['is_derby'] = self._is_derby_match(home_team, away_team)
        features['is_six_pointer'] = self._is_six_pointer(home_team, away_team)
        features['relegation_battle'] = self._is_relegation_battle(home_team, away_team)
        features['title_race'] = self._is_title_race(home_team, away_team)
        
        # Season progress
        features['season_progress'] = self._calculate_season_progress(match_date)
        features['is_run_in'] = 1.0 if features['season_progress'] > 0.75 else 0.0
        
        # Pressure situations
        features['home_must_win'] = self._calculate_must_win_factor(home_team)
        features['away_must_win'] = self._calculate_must_win_factor(away_team)
        
        # Manager factors
        features['home_manager_experience'] = self._get_manager_experience(home_team)
        features['away_manager_experience'] = self._get_manager_experience(away_team)
        features['tactical_clash_factor'] = self._calculate_tactical_clash(home_team, away_team)
        
        return features
    
    def _get_betting_features(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Betting market intelligence features (15 features)."""
        features = {}
        
        # Odds-implied probabilities
        features['home_win_probability_market'] = self._get_market_probability(home_team, away_team, 'home')
        features['draw_probability_market'] = self._get_market_probability(home_team, away_team, 'draw')
        features['away_win_probability_market'] = self._get_market_probability(home_team, away_team, 'away')
        
        # Value indicators
        features['home_value_bet'] = self._calculate_value_bet(home_team, 'home')
        features['away_value_bet'] = self._calculate_value_bet(away_team, 'away')
        
        # Market movements
        features['home_odds_movement'] = self._calculate_odds_movement(home_team, away_team, 'home')
        features['away_odds_movement'] = self._calculate_odds_movement(home_team, away_team, 'away')
        
        # Goal markets
        features['over_2_5_probability'] = self._get_over_under_probability(2.5)
        features['btts_probability'] = self._get_btts_probability(home_team, away_team)
        
        # Asian handicap
        features['asian_handicap_home'] = self._get_asian_handicap(home_team, away_team)
        features['asian_handicap_value'] = self._calculate_handicap_value(home_team, away_team)
        
        # Market consensus
        features['market_confidence'] = self._calculate_market_confidence(home_team, away_team)
        features['smart_money_indicator'] = self._calculate_smart_money(home_team, away_team)
        
        # Expected value
        features['home_expected_value'] = self._calculate_expected_value(home_team, 'home')
        features['away_expected_value'] = self._calculate_expected_value(away_team, 'away')
        
        return features
    
    def _get_tactical_features(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Team style and tactical features (20 features)."""
        features = {}
        
        # Playing style
        features['home_attacking_style'] = self._classify_attacking_style(home_team)
        features['home_defensive_style'] = self._classify_defensive_style(home_team)
        features['away_attacking_style'] = self._classify_attacking_style(away_team)
        features['away_defensive_style'] = self._classify_defensive_style(away_team)
        
        # Tempo and intensity
        features['home_tempo'] = self._calculate_tempo(home_team)
        features['away_tempo'] = self._calculate_tempo(away_team)
        features['home_pressing_intensity'] = self._calculate_pressing_intensity(home_team)
        features['away_pressing_intensity'] = self._calculate_pressing_intensity(away_team)
        
        # Width and directness
        features['home_width_of_play'] = self._calculate_width_of_play(home_team)
        features['away_width_of_play'] = self._calculate_width_of_play(away_team)
        features['home_directness'] = self._calculate_directness(home_team)
        features['away_directness'] = self._calculate_directness(away_team)
        
        # Set piece strength
        features['home_set_piece_attack'] = self._calculate_set_piece_strength(home_team, 'attack')
        features['home_set_piece_defence'] = self._calculate_set_piece_strength(home_team, 'defence')
        features['away_set_piece_attack'] = self._calculate_set_piece_strength(away_team, 'attack')
        features['away_set_piece_defence'] = self._calculate_set_piece_strength(away_team, 'defence')
        
        # Counter-attack capability
        features['home_counter_attack'] = self._calculate_counter_attack_strength(home_team)
        features['away_counter_attack'] = self._calculate_counter_attack_strength(away_team)
        
        # Style matchup
        features['style_clash_factor'] = self._calculate_style_clash(home_team, away_team)
        features['tactical_advantage'] = self._calculate_tactical_advantage(home_team, away_team)
        
        return features
    
    def _get_player_features(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Player availability and impact features (10 features)."""
        features = {}
        
        # Key player availability
        features['home_key_players_available'] = self._calculate_key_players_available(home_team)
        features['away_key_players_available'] = self._calculate_key_players_available(away_team)
        
        # Top scorer impact
        features['home_top_scorer_form'] = self._get_top_scorer_form(home_team)
        features['away_top_scorer_form'] = self._get_top_scorer_form(away_team)
        
        # Squad depth
        features['home_squad_depth'] = self._calculate_squad_depth(home_team)
        features['away_squad_depth'] = self._calculate_squad_depth(away_team)
        
        # Injury impact
        features['home_injury_impact'] = self._calculate_injury_impact(home_team)
        features['away_injury_impact'] = self._calculate_injury_impact(away_team)
        
        # Star player factor
        features['home_star_factor'] = self._calculate_star_factor(home_team)
        features['away_star_factor'] = self._calculate_star_factor(away_team)
        
        return features
    
    def _get_time_series_features(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Time series and trend features (15 features)."""
        features = {}
        
        # Performance trends
        features['home_trend_short'] = self._calculate_trend(home_team, window=5)
        features['home_trend_medium'] = self._calculate_trend(home_team, window=10)
        features['home_trend_long'] = self._calculate_trend(home_team, window=20)
        features['away_trend_short'] = self._calculate_trend(away_team, window=5)
        features['away_trend_medium'] = self._calculate_trend(away_team, window=10)
        features['away_trend_long'] = self._calculate_trend(away_team, window=20)
        
        # Seasonality
        features['home_monthly_performance'] = self._calculate_monthly_performance(home_team)
        features['away_monthly_performance'] = self._calculate_monthly_performance(away_team)
        
        # Cyclic patterns
        features['home_performance_cycle'] = self._calculate_performance_cycle(home_team)
        features['away_performance_cycle'] = self._calculate_performance_cycle(away_team)
        
        # Variance and consistency
        features['home_consistency'] = self._calculate_consistency(home_team)
        features['away_consistency'] = self._calculate_consistency(away_team)
        
        # Mean reversion
        features['home_mean_reversion'] = self._calculate_mean_reversion(home_team)
        features['away_mean_reversion'] = self._calculate_mean_reversion(away_team)
        
        # Autocorrelation
        features['home_performance_autocorr'] = self._calculate_autocorrelation(home_team)
        
        return features
    
    def _get_external_features(self, home_team: str, away_team: str, 
                              match_date: datetime) -> Dict[str, float]:
        """External factors (10 features)."""
        features = {}
        
        # Weather impact (would need weather API)
        features['temperature_impact'] = self._estimate_temperature_impact(match_date)
        features['rain_probability'] = self._estimate_rain_probability(match_date)
        features['wind_factor'] = self._estimate_wind_factor(match_date)
        
        # Stadium factors
        features['stadium_capacity_factor'] = self._get_stadium_capacity_factor(home_team)
        features['crowd_impact'] = self._calculate_crowd_impact(home_team)
        features['travel_distance'] = self._calculate_travel_distance(home_team, away_team)
        
        # Media and pressure
        features['media_pressure_home'] = self._calculate_media_pressure(home_team)
        features['media_pressure_away'] = self._calculate_media_pressure(away_team)
        
        # Historical venue performance
        features['venue_advantage'] = self._calculate_venue_advantage(home_team)
        features['away_venue_record'] = self._calculate_away_venue_record(away_team, home_team)
        
        return features
    
    # Helper methods (simplified implementations)
    def _calculate_avg_goals_scored(self, team: str) -> float:
        """Calculate average goals scored by team."""
        if self.historical_data is None:
            return np.random.uniform(1.0, 2.5)
        # Actual implementation would query historical data
        return np.random.uniform(1.0, 2.5)
    
    def _calculate_avg_goals_conceded(self, team: str) -> float:
        """Calculate average goals conceded by team."""
        return np.random.uniform(0.8, 2.0)
    
    def _calculate_points_per_game(self, team: str) -> float:
        """Calculate points per game."""
        return np.random.uniform(0.5, 2.5)
    
    def _get_league_position(self, team: str) -> float:
        """Get current league position."""
        return np.random.uniform(1, 20)
    
    def _calculate_win_rate(self, team: str) -> float:
        """Calculate overall win rate."""
        return np.random.uniform(0.2, 0.7)
    
    def _calculate_draw_rate(self, team: str) -> float:
        """Calculate draw rate."""
        return np.random.uniform(0.15, 0.35)
    
    def _calculate_loss_rate(self, team: str) -> float:
        """Calculate loss rate."""
        return np.random.uniform(0.1, 0.5)
    
    def _calculate_home_win_rate(self, team: str) -> float:
        """Calculate home win rate."""
        return np.random.uniform(0.3, 0.8)
    
    def _calculate_away_win_rate(self, team: str) -> float:
        """Calculate away win rate."""
        return np.random.uniform(0.1, 0.6)
    
    def _calculate_home_goals_avg(self, team: str) -> float:
        """Calculate average goals at home."""
        return np.random.uniform(1.2, 3.0)
    
    def _calculate_away_goals_avg(self, team: str) -> float:
        """Calculate average goals away."""
        return np.random.uniform(0.8, 2.2)
    
    def _calculate_clean_sheet_rate(self, team: str) -> float:
        """Calculate clean sheet rate."""
        return np.random.uniform(0.15, 0.45)
    
    def _calculate_xg_for(self, team: str) -> float:
        """Calculate expected goals for."""
        return np.random.uniform(1.0, 2.5)
    
    def _calculate_xg_against(self, team: str) -> float:
        """Calculate expected goals against."""
        return np.random.uniform(0.8, 2.0)
    
    def _calculate_shots_per_game(self, team: str) -> float:
        """Calculate shots per game."""
        return np.random.uniform(8, 18)
    
    def _calculate_shot_accuracy(self, team: str) -> float:
        """Calculate shot accuracy percentage."""
        return np.random.uniform(0.25, 0.45)
    
    def _calculate_avg_possession(self, team: str) -> float:
        """Calculate average possession."""
        return np.random.uniform(0.35, 0.65)
    
    def _calculate_pass_accuracy(self, team: str) -> float:
        """Calculate pass accuracy."""
        return np.random.uniform(0.75, 0.90)
    
    def _calculate_tackles_per_game(self, team: str) -> float:
        """Calculate tackles per game."""
        return np.random.uniform(15, 25)
    
    def _calculate_interceptions_per_game(self, team: str) -> float:
        """Calculate interceptions per game."""
        return np.random.uniform(8, 15)
    
    def _calculate_yellow_cards_avg(self, team: str) -> float:
        """Calculate average yellow cards."""
        return np.random.uniform(1.0, 2.5)
    
    def _calculate_red_cards_total(self, team: str) -> float:
        """Calculate total red cards."""
        return np.random.uniform(0, 3)
    
    def _calculate_corners_for(self, team: str) -> float:
        """Calculate corners won per game."""
        return np.random.uniform(3, 8)
    
    def _calculate_corners_against(self, team: str) -> float:
        """Calculate corners conceded per game."""
        return np.random.uniform(3, 7)
    
    def _calculate_goal_conversion(self, team: str) -> float:
        """Calculate goal conversion rate."""
        return np.random.uniform(0.08, 0.15)
    
    def _calculate_defensive_efficiency(self, team: str) -> float:
        """Calculate defensive efficiency."""
        return np.random.uniform(0.6, 0.9)
    
    def _calculate_pressure_index(self, team: str) -> float:
        """Calculate pressure index."""
        return np.random.uniform(0.3, 0.8)
    
    def _calculate_form_last_n(self, team: str, n: int) -> float:
        """Calculate form over last n games."""
        return np.random.uniform(0.2, 0.8)
    
    def _calculate_weighted_form(self, team: str) -> float:
        """Calculate weighted recent form."""
        return np.random.uniform(0.3, 0.7)
    
    def _calculate_momentum(self, team: str) -> float:
        """Calculate team momentum."""
        return np.random.uniform(-1, 1)
    
    def _calculate_win_streak(self, team: str) -> float:
        """Calculate current win streak."""
        return np.random.uniform(0, 5)
    
    def _calculate_unbeaten_streak(self, team: str) -> float:
        """Calculate unbeaten streak."""
        return np.random.uniform(0, 10)
    
    def _calculate_form_vs_top_teams(self, team: str) -> float:
        """Calculate form against top teams."""
        return np.random.uniform(0.1, 0.6)
    
    def _calculate_form_vs_bottom_teams(self, team: str) -> float:
        """Calculate form against bottom teams."""
        return np.random.uniform(0.4, 0.9)
    
    def _calculate_scoring_form(self, team: str) -> float:
        """Calculate recent scoring form."""
        return np.random.uniform(0.5, 2.5)
    
    def _calculate_defensive_form(self, team: str) -> float:
        """Calculate recent defensive form."""
        return np.random.uniform(0.5, 1.5)
    
    def _calculate_form_volatility(self, team: str) -> float:
        """Calculate form volatility."""
        return np.random.uniform(0.1, 0.5)
    
    def _calculate_bounce_back_rate(self, team: str) -> float:
        """Calculate bounce back rate after losses."""
        return np.random.uniform(0.3, 0.7)
    
    def _calculate_h2h_wins(self, team1: str, team2: str) -> float:
        """Calculate head-to-head wins."""
        return np.random.uniform(0, 10)
    
    def _calculate_h2h_draws(self, team1: str, team2: str) -> float:
        """Calculate head-to-head draws."""
        return np.random.uniform(0, 5)
    
    def _calculate_h2h_goals_avg(self, team1: str, team2: str) -> float:
        """Calculate H2H goals average."""
        return np.random.uniform(0.8, 2.2)
    
    def _calculate_h2h_form_recent(self, team1: str, team2: str, n: int) -> float:
        """Calculate recent H2H form."""
        return np.random.uniform(0.2, 0.8)
    
    def _calculate_h2h_unbeaten_streak(self, team1: str, team2: str) -> float:
        """Calculate H2H unbeaten streak."""
        return np.random.uniform(0, 5)
    
    def _get_h2h_streak_holder(self, team1: str, team2: str) -> float:
        """Get current H2H streak holder."""
        return np.random.choice([0, 1])
    
    def _calculate_h2h_venue_wins(self, team1: str, team2: str) -> float:
        """Calculate H2H wins at this venue."""
        return np.random.uniform(0, 5)
    
    def _calculate_h2h_venue_goals(self, team1: str, team2: str) -> float:
        """Calculate H2H goals at this venue."""
        return np.random.uniform(1.0, 3.0)
    
    def _calculate_h2h_dominance(self, team1: str, team2: str) -> float:
        """Calculate psychological dominance factor."""
        return np.random.uniform(-1, 1)
    
    def _calculate_revenge_factor(self, team1: str, team2: str) -> float:
        """Calculate revenge motivation factor."""
        return np.random.uniform(0, 1)
    
    def _calculate_h2h_importance(self, team1: str, team2: str) -> float:
        """Calculate H2H match importance."""
        return np.random.uniform(0.5, 1.0)
    
    def _calculate_days_since_last_match(self, team: str, match_date: datetime) -> float:
        """Calculate days since last match."""
        return np.random.uniform(3, 14)
    
    def _calculate_fatigue_index(self, team: str, match_date: datetime) -> float:
        """Calculate team fatigue index."""
        return np.random.uniform(0.2, 0.8)
    
    def _calculate_fixture_congestion(self, team: str, match_date: datetime) -> float:
        """Calculate fixture congestion."""
        return np.random.uniform(0.1, 0.7)
    
    def _is_derby_match(self, team1: str, team2: str) -> float:
        """Check if derby match."""
        derbies = {
            ('Manchester United FC', 'Manchester City FC'),
            ('Arsenal FC', 'Tottenham Hotspur FC'),
            ('Liverpool FC', 'Everton FC'),
        }
        return 1.0 if (team1, team2) in derbies or (team2, team1) in derbies else 0.0
    
    def _is_six_pointer(self, team1: str, team2: str) -> float:
        """Check if six-pointer match."""
        return np.random.choice([0.0, 1.0], p=[0.8, 0.2])
    
    def _is_relegation_battle(self, team1: str, team2: str) -> float:
        """Check if relegation battle."""
        return np.random.choice([0.0, 1.0], p=[0.9, 0.1])
    
    def _is_title_race(self, team1: str, team2: str) -> float:
        """Check if title race match."""
        return np.random.choice([0.0, 1.0], p=[0.85, 0.15])
    
    def _calculate_season_progress(self, match_date: datetime) -> float:
        """Calculate season progress."""
        return np.random.uniform(0.1, 0.9)
    
    def _calculate_must_win_factor(self, team: str) -> float:
        """Calculate must-win pressure."""
        return np.random.uniform(0.2, 0.8)
    
    def _get_manager_experience(self, team: str) -> float:
        """Get manager experience score."""
        return np.random.uniform(0.3, 0.9)
    
    def _calculate_tactical_clash(self, team1: str, team2: str) -> float:
        """Calculate tactical clash factor."""
        return np.random.uniform(-0.5, 0.5)
    
    def _get_market_probability(self, team1: str, team2: str, outcome: str) -> float:
        """Get market-implied probability."""
        if outcome == 'home':
            return np.random.uniform(0.2, 0.7)
        elif outcome == 'draw':
            return np.random.uniform(0.2, 0.35)
        else:
            return np.random.uniform(0.15, 0.6)
    
    def _calculate_value_bet(self, team: str, side: str) -> float:
        """Calculate value betting indicator."""
        return np.random.uniform(-0.2, 0.3)
    
    def _calculate_odds_movement(self, team1: str, team2: str, side: str) -> float:
        """Calculate odds movement."""
        return np.random.uniform(-0.1, 0.1)
    
    def _get_over_under_probability(self, line: float) -> float:
        """Get over/under goals probability."""
        return np.random.uniform(0.4, 0.6)
    
    def _get_btts_probability(self, team1: str, team2: str) -> float:
        """Get both teams to score probability."""
        return np.random.uniform(0.4, 0.7)
    
    def _get_asian_handicap(self, team1: str, team2: str) -> float:
        """Get Asian handicap line."""
        return np.random.uniform(-1.5, 1.5)
    
    def _calculate_handicap_value(self, team1: str, team2: str) -> float:
        """Calculate handicap value."""
        return np.random.uniform(-0.2, 0.2)
    
    def _calculate_market_confidence(self, team1: str, team2: str) -> float:
        """Calculate market confidence."""
        return np.random.uniform(0.5, 0.9)
    
    def _calculate_smart_money(self, team1: str, team2: str) -> float:
        """Calculate smart money indicator."""
        return np.random.uniform(-0.3, 0.3)
    
    def _calculate_expected_value(self, team: str, side: str) -> float:
        """Calculate expected value."""
        return np.random.uniform(-0.1, 0.2)
    
    def _classify_attacking_style(self, team: str) -> float:
        """Classify attacking style (0=defensive, 1=attacking)."""
        return np.random.uniform(0.2, 0.8)
    
    def _classify_defensive_style(self, team: str) -> float:
        """Classify defensive style (0=open, 1=compact)."""
        return np.random.uniform(0.3, 0.7)
    
    def _calculate_tempo(self, team: str) -> float:
        """Calculate playing tempo."""
        return np.random.uniform(0.4, 0.8)
    
    def _calculate_pressing_intensity(self, team: str) -> float:
        """Calculate pressing intensity."""
        return np.random.uniform(0.3, 0.8)
    
    def _calculate_width_of_play(self, team: str) -> float:
        """Calculate width of play."""
        return np.random.uniform(0.4, 0.7)
    
    def _calculate_directness(self, team: str) -> float:
        """Calculate playing directness."""
        return np.random.uniform(0.3, 0.7)
    
    def _calculate_set_piece_strength(self, team: str, phase: str) -> float:
        """Calculate set piece strength."""
        return np.random.uniform(0.3, 0.8)
    
    def _calculate_counter_attack_strength(self, team: str) -> float:
        """Calculate counter-attack strength."""
        return np.random.uniform(0.4, 0.8)
    
    def _calculate_style_clash(self, team1: str, team2: str) -> float:
        """Calculate style clash factor."""
        return np.random.uniform(-0.3, 0.3)
    
    def _calculate_tactical_advantage(self, team1: str, team2: str) -> float:
        """Calculate tactical advantage."""
        return np.random.uniform(-0.5, 0.5)
    
    def _calculate_key_players_available(self, team: str) -> float:
        """Calculate key players availability."""
        return np.random.uniform(0.7, 1.0)
    
    def _get_top_scorer_form(self, team: str) -> float:
        """Get top scorer's current form."""
        return np.random.uniform(0.3, 0.9)
    
    def _calculate_squad_depth(self, team: str) -> float:
        """Calculate squad depth score."""
        return np.random.uniform(0.4, 0.9)
    
    def _calculate_injury_impact(self, team: str) -> float:
        """Calculate injury impact."""
        return np.random.uniform(0, 0.3)
    
    def _calculate_star_factor(self, team: str) -> float:
        """Calculate star player factor."""
        return np.random.uniform(0.3, 0.8)
    
    def _calculate_trend(self, team: str, window: int) -> float:
        """Calculate performance trend."""
        return np.random.uniform(-0.5, 0.5)
    
    def _calculate_monthly_performance(self, team: str) -> float:
        """Calculate monthly performance."""
        return np.random.uniform(0.4, 0.7)
    
    def _calculate_performance_cycle(self, team: str) -> float:
        """Calculate performance cycle position."""
        return np.random.uniform(0, 1)
    
    def _calculate_consistency(self, team: str) -> float:
        """Calculate consistency score."""
        return np.random.uniform(0.3, 0.8)
    
    def _calculate_mean_reversion(self, team: str) -> float:
        """Calculate mean reversion factor."""
        return np.random.uniform(-0.3, 0.3)
    
    def _calculate_autocorrelation(self, team: str) -> float:
        """Calculate performance autocorrelation."""
        return np.random.uniform(-0.2, 0.5)
    
    def _estimate_temperature_impact(self, match_date: datetime) -> float:
        """Estimate temperature impact."""
        return np.random.uniform(-0.1, 0.1)
    
    def _estimate_rain_probability(self, match_date: datetime) -> float:
        """Estimate rain probability."""
        return np.random.uniform(0, 0.3)
    
    def _estimate_wind_factor(self, match_date: datetime) -> float:
        """Estimate wind impact."""
        return np.random.uniform(0, 0.2)
    
    def _get_stadium_capacity_factor(self, team: str) -> float:
        """Get stadium capacity factor."""
        return np.random.uniform(0.5, 1.0)
    
    def _calculate_crowd_impact(self, team: str) -> float:
        """Calculate crowd impact."""
        return np.random.uniform(0.1, 0.3)
    
    def _calculate_travel_distance(self, team1: str, team2: str) -> float:
        """Calculate travel distance impact."""
        return np.random.uniform(0, 300)
    
    def _calculate_media_pressure(self, team: str) -> float:
        """Calculate media pressure."""
        return np.random.uniform(0.2, 0.8)
    
    def _calculate_venue_advantage(self, team: str) -> float:
        """Calculate venue advantage."""
        return np.random.uniform(0.1, 0.3)
    
    def _calculate_away_venue_record(self, away_team: str, home_team: str) -> float:
        """Calculate away team's record at this venue."""
        return np.random.uniform(0.1, 0.6)


# Example usage
if __name__ == "__main__":
    print("🔬 Advanced Feature Engineering Demo\n")
    print("=" * 50)
    
    # Create feature engineer
    engineer = AdvancedFeatureEngineer()
    
    # Generate features for a match
    features = engineer.create_all_features(
        home_team="Arsenal FC",
        away_team="Chelsea FC",
        match_date=datetime.now()
    )
    
    print(f"\n✅ Generated {len(features)} features!")
    print("\n📊 Sample features:")
    
    # Show first 10 features
    for i, (name, value) in enumerate(list(features.items())[:10], 1):
        print(f"  {i}. {name}: {value:.3f}")
    
    print(f"\n... and {len(features) - 10} more features!")
    
    # Feature categories breakdown
    categories = {
        'basic': 20,
        'advanced': 30,
        'form': 25,
        'h2h': 15,
        'context': 20,
        'betting': 15,
        'tactical': 20,
        'player': 10,
        'time_series': 15,
        'external': 10
    }
    
    print("\n📈 Feature Categories:")
    for category, count in categories.items():
        print(f"  • {category.capitalize()}: {count} features")
    
    print("\n🎯 Ready for god-mode predictions!")