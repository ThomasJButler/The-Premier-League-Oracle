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

    # Approximate average shots per game — used for goal conversion rate estimation
    _AVG_SHOTS_PER_GAME = 10.0

    def __init__(self, historical_data: Optional[pd.DataFrame] = None):
        """
        Initialize feature engineer with optional historical data.

        Args:
            historical_data: DataFrame with historical match data
        """
        self.historical_data = historical_data
        self.scaler = StandardScaler()
        self.feature_names = []
        self.current_match_date: Optional[datetime] = None
        # Pre-filtered data and positions are computed at the start of each create_all_features call
        self._filtered_data: Optional[pd.DataFrame] = None
        self._league_positions: Dict[str, float] = {}
        
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

        self.current_match_date = match_date

        # Pre-filter historical data strictly before match_date to prevent data leakage
        if self.historical_data is not None and not self.historical_data.empty:
            try:
                dates = pd.to_datetime(self.historical_data['date'], utc=True)
                cutoff = (pd.Timestamp(match_date, tz='UTC')
                          if match_date.tzinfo is None
                          else pd.Timestamp(match_date))
                self._filtered_data = self.historical_data[dates < cutoff].copy()
            except Exception:
                self._filtered_data = self.historical_data.copy()
        else:
            self._filtered_data = None

        # Pre-compute league positions once per feature set (used by many helpers)
        self._league_positions = self._compute_league_positions()

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
    
    # ==================== INTERNAL DATA HELPERS ====================

    def _get_team_matches(self, team: str, venue: str = 'all') -> pd.DataFrame:
        """
        Return normalised historical matches for a team using pre-filtered data.

        Adds columns: team_score, opponent_score, team_result (W/D/L), is_home, opponent.
        """
        df = self._filtered_data
        if df is None or df.empty:
            return pd.DataFrame()

        frames = []
        if venue in ('home', 'all'):
            home = df[df['home_team'] == team].copy()
            if not home.empty:
                home['team_score'] = home['home_score']
                home['opponent_score'] = home['away_score']
                home['team_result'] = home['result'].map({'H': 'W', 'D': 'D', 'A': 'L'})
                home['is_home'] = True
                home['opponent'] = home['away_team']
                frames.append(home)

        if venue in ('away', 'all'):
            away = df[df['away_team'] == team].copy()
            if not away.empty:
                away['team_score'] = away['away_score']
                away['opponent_score'] = away['home_score']
                away['team_result'] = away['result'].map({'H': 'L', 'D': 'D', 'A': 'W'})
                away['is_home'] = False
                away['opponent'] = away['home_team']
                frames.append(away)

        if not frames:
            return pd.DataFrame()

        combined = pd.concat(frames).sort_values('date').reset_index(drop=True)
        return combined.dropna(subset=['team_score', 'opponent_score', 'team_result'])

    def _get_h2h_matches(self, team1: str, team2: str, n: Optional[int] = None) -> pd.DataFrame:
        """Return H2H matches between team1 and team2 in chronological order."""
        df = self._filtered_data
        if df is None or df.empty:
            return pd.DataFrame()

        mask = (((df['home_team'] == team1) & (df['away_team'] == team2)) |
                ((df['home_team'] == team2) & (df['away_team'] == team1)))
        h2h = df[mask].sort_values('date').reset_index(drop=True)
        if n is not None:
            h2h = h2h.tail(n)
        return h2h

    def _compute_league_positions(self) -> Dict[str, float]:
        """Compute league table positions from filtered data."""
        df = self._filtered_data
        if df is None or df.empty:
            return {}

        team_points: Dict[str, int] = {}
        for team in set(df['home_team'].tolist() + df['away_team'].tolist()):
            home_pts = df[df['home_team'] == team]['result'].map({'H': 3, 'D': 1, 'A': 0}).sum()
            away_pts = df[df['away_team'] == team]['result'].map({'H': 0, 'D': 1, 'A': 3}).sum()
            team_points[team] = int(home_pts) + int(away_pts)

        sorted_teams = sorted(team_points.items(), key=lambda x: (-x[1], x[0]))
        return {team: float(pos + 1) for pos, (team, _) in enumerate(sorted_teams)}

    def _points_series(self, matches: pd.DataFrame) -> pd.Series:
        """Convert team_result column to a numeric points series."""
        return matches['team_result'].map({'W': 3, 'D': 1, 'L': 0})

    # ==================== BASIC STAT HELPERS ====================

    def _calculate_avg_goals_scored(self, team: str) -> float:
        m = self._get_team_matches(team)
        return float(m['team_score'].mean()) if not m.empty else 1.3

    def _calculate_avg_goals_conceded(self, team: str) -> float:
        m = self._get_team_matches(team)
        return float(m['opponent_score'].mean()) if not m.empty else 1.3

    def _calculate_points_per_game(self, team: str) -> float:
        m = self._get_team_matches(team)
        return float(self._points_series(m).mean()) if not m.empty else 1.3

    def _get_league_position(self, team: str) -> float:
        return self._league_positions.get(team, 10.0)

    def _calculate_win_rate(self, team: str) -> float:
        m = self._get_team_matches(team)
        return float((m['team_result'] == 'W').mean()) if not m.empty else 0.35

    def _calculate_draw_rate(self, team: str) -> float:
        m = self._get_team_matches(team)
        return float((m['team_result'] == 'D').mean()) if not m.empty else 0.26

    def _calculate_loss_rate(self, team: str) -> float:
        m = self._get_team_matches(team)
        return float((m['team_result'] == 'L').mean()) if not m.empty else 0.39

    def _calculate_home_win_rate(self, team: str) -> float:
        m = self._get_team_matches(team, venue='home')
        return float((m['team_result'] == 'W').mean()) if not m.empty else 0.45

    def _calculate_away_win_rate(self, team: str) -> float:
        m = self._get_team_matches(team, venue='away')
        return float((m['team_result'] == 'W').mean()) if not m.empty else 0.25

    def _calculate_home_goals_avg(self, team: str) -> float:
        m = self._get_team_matches(team, venue='home')
        return float(m['team_score'].mean()) if not m.empty else 1.5

    def _calculate_away_goals_avg(self, team: str) -> float:
        m = self._get_team_matches(team, venue='away')
        return float(m['team_score'].mean()) if not m.empty else 1.1

    def _calculate_clean_sheet_rate(self, team: str) -> float:
        m = self._get_team_matches(team)
        return float((m['opponent_score'] == 0).mean()) if not m.empty else 0.25

    # ==================== ADVANCED METRICS — 0.0 where no data source ====================

    def _calculate_xg_for(self, team: str) -> float: return 0.0
    def _calculate_xg_against(self, team: str) -> float: return 0.0
    def _calculate_shots_per_game(self, team: str) -> float: return 0.0
    def _calculate_shot_accuracy(self, team: str) -> float: return 0.0
    def _calculate_avg_possession(self, team: str) -> float: return 0.0
    def _calculate_pass_accuracy(self, team: str) -> float: return 0.0
    def _calculate_tackles_per_game(self, team: str) -> float: return 0.0
    def _calculate_interceptions_per_game(self, team: str) -> float: return 0.0
    def _calculate_yellow_cards_avg(self, team: str) -> float: return 0.0
    def _calculate_red_cards_total(self, team: str) -> float: return 0.0
    def _calculate_corners_for(self, team: str) -> float: return 0.0
    def _calculate_corners_against(self, team: str) -> float: return 0.0
    def _calculate_pressure_index(self, team: str) -> float: return 0.0

    def _calculate_goal_conversion(self, team: str) -> float:
        return self._calculate_avg_goals_scored(team) / self._AVG_SHOTS_PER_GAME

    def _calculate_defensive_efficiency(self, team: str) -> float:
        return self._calculate_clean_sheet_rate(team)

    # ==================== FORM HELPERS ====================

    def _calculate_form_last_n(self, team: str, n: int) -> float:
        m = self._get_team_matches(team)
        if m.empty:
            return 1.0
        last_n = m.tail(n)
        return float(self._points_series(last_n).mean()) if not last_n.empty else 1.0

    def _calculate_weighted_form(self, team: str) -> float:
        m = self._get_team_matches(team)
        if m.empty:
            return 1.0
        last = m.tail(15)
        pts = self._points_series(last).values.astype(float)
        n = len(pts)
        if n == 0:
            return 1.0
        weights = np.array([0.85 ** (n - 1 - i) for i in range(n)])
        weights /= weights.sum()
        return float(np.dot(pts, weights))

    def _calculate_momentum(self, team: str) -> float:
        return self._calculate_form_last_n(team, 5) - self._calculate_form_last_n(team, 10)

    def _calculate_win_streak(self, team: str) -> float:
        m = self._get_team_matches(team)
        if m.empty:
            return 0.0
        streak = 0
        for r in reversed(m['team_result'].tolist()):
            if r == 'W':
                streak += 1
            else:
                break
        return float(streak)

    def _calculate_unbeaten_streak(self, team: str) -> float:
        m = self._get_team_matches(team)
        if m.empty:
            return 0.0
        streak = 0
        for r in reversed(m['team_result'].tolist()):
            if r in ('W', 'D'):
                streak += 1
            else:
                break
        return float(streak)

    def _calculate_form_vs_top_teams(self, team: str) -> float:
        m = self._get_team_matches(team)
        if m.empty or not self._league_positions:
            return 1.0
        top_6 = {t for t, pos in self._league_positions.items() if pos <= 6}
        vs_top = m[m['opponent'].isin(top_6)]
        return float(self._points_series(vs_top).mean()) if not vs_top.empty else 1.0

    def _calculate_form_vs_bottom_teams(self, team: str) -> float:
        m = self._get_team_matches(team)
        if m.empty or not self._league_positions:
            return 1.5
        bottom_6 = {t for t, pos in self._league_positions.items() if pos >= 15}
        vs_bottom = m[m['opponent'].isin(bottom_6)]
        return float(self._points_series(vs_bottom).mean()) if not vs_bottom.empty else 1.5

    def _calculate_scoring_form(self, team: str) -> float:
        m = self._get_team_matches(team).tail(5)
        return float(m['team_score'].mean()) if not m.empty else 1.3

    def _calculate_defensive_form(self, team: str) -> float:
        m = self._get_team_matches(team).tail(5)
        return float(m['opponent_score'].mean()) if not m.empty else 1.3

    def _calculate_form_volatility(self, team: str) -> float:
        m = self._get_team_matches(team).tail(10)
        if len(m) < 3:
            return 1.0
        return float(np.std(self._points_series(m).values.astype(float)))

    def _calculate_bounce_back_rate(self, team: str) -> float:
        m = self._get_team_matches(team)
        if len(m) < 2:
            return 0.35
        results = m['team_result'].tolist()
        losses, bounce_backs = 0, 0
        for i in range(len(results) - 1):
            if results[i] == 'L':
                losses += 1
                if results[i + 1] == 'W':
                    bounce_backs += 1
        return float(bounce_backs / losses) if losses > 0 else 0.5

    # ==================== H2H HELPERS ====================

    def _calculate_h2h_wins(self, team1: str, team2: str) -> float:
        h2h = self._get_h2h_matches(team1, team2)
        if h2h.empty:
            return 0.0
        wins = sum(
            1 for _, r in h2h.iterrows()
            if (r['home_team'] == team1 and r['result'] == 'H') or
               (r['away_team'] == team1 and r['result'] == 'A')
        )
        return float(wins)

    def _calculate_h2h_draws(self, team1: str, team2: str) -> float:
        h2h = self._get_h2h_matches(team1, team2)
        return float((h2h['result'] == 'D').sum()) if not h2h.empty else 0.0

    def _calculate_h2h_goals_avg(self, team1: str, team2: str) -> float:
        h2h = self._get_h2h_matches(team1, team2)
        if h2h.empty:
            return 1.2
        goals = [
            r['home_score'] if r['home_team'] == team1 else r['away_score']
            for _, r in h2h.iterrows()
        ]
        return float(np.mean(goals)) if goals else 1.2

    def _calculate_h2h_form_recent(self, team1: str, team2: str, n: int) -> float:
        h2h = self._get_h2h_matches(team1, team2, n=n)
        if h2h.empty:
            return 1.0
        wins = sum(
            1 for _, r in h2h.iterrows()
            if (r['home_team'] == team1 and r['result'] == 'H') or
               (r['away_team'] == team1 and r['result'] == 'A')
        )
        draws = int((h2h['result'] == 'D').sum())
        return float((wins * 3 + draws) / len(h2h))

    def _calculate_h2h_unbeaten_streak(self, team1: str, team2: str) -> float:
        h2h = self._get_h2h_matches(team1, team2)
        if h2h.empty:
            return 0.0
        streak = 0
        for _, r in h2h.iloc[::-1].iterrows():
            if (r['home_team'] == team1 and r['result'] == 'A') or \
               (r['away_team'] == team1 and r['result'] == 'H'):
                break
            streak += 1
        return float(streak)

    def _get_h2h_streak_holder(self, team1: str, team2: str) -> float:
        h2h = self._get_h2h_matches(team1, team2)
        if h2h.empty:
            return 0.5
        last = h2h.iloc[-1]
        if (last['home_team'] == team1 and last['result'] == 'H') or \
           (last['away_team'] == team1 and last['result'] == 'A'):
            return 1.0
        return 0.5 if last['result'] == 'D' else 0.0

    def _calculate_h2h_venue_wins(self, team1: str, team2: str) -> float:
        h2h = self._get_h2h_matches(team1, team2)
        if h2h.empty:
            return 0.0
        home_h2h = h2h[(h2h['home_team'] == team1) & (h2h['away_team'] == team2)]
        return float((home_h2h['result'] == 'H').sum())

    def _calculate_h2h_venue_goals(self, team1: str, team2: str) -> float:
        h2h = self._get_h2h_matches(team1, team2)
        if h2h.empty:
            return 1.5
        home_h2h = h2h[(h2h['home_team'] == team1) & (h2h['away_team'] == team2)]
        return float(home_h2h['home_score'].mean()) if not home_h2h.empty else 1.5

    def _calculate_h2h_dominance(self, team1: str, team2: str) -> float:
        h2h = self._get_h2h_matches(team1, team2)
        if h2h.empty:
            return 0.0
        t1_wins = self._calculate_h2h_wins(team1, team2)
        t2_wins = self._calculate_h2h_wins(team2, team1)
        total = len(h2h)
        return float((t1_wins - t2_wins) / total) if total > 0 else 0.0

    def _calculate_revenge_factor(self, team1: str, team2: str) -> float:
        h2h = self._get_h2h_matches(team1, team2)
        if h2h.empty:
            return 0.0
        last = h2h.iloc[-1]
        if (last['home_team'] == team1 and last['result'] == 'A') or \
           (last['away_team'] == team1 and last['result'] == 'H'):
            return 1.0
        return 0.0

    def _calculate_h2h_importance(self, team1: str, team2: str) -> float:
        h2h = self._get_h2h_matches(team1, team2)
        return float(min(len(h2h) / 20.0, 1.0))

    # ==================== CONTEXTUAL HELPERS ====================

    def _calculate_days_since_last_match(self, team: str, match_date: datetime) -> float:
        m = self._get_team_matches(team)
        if m.empty:
            return 7.0
        try:
            last_date = pd.to_datetime(m['date'].max(), utc=True)
            md = (pd.Timestamp(match_date, tz='UTC')
                  if match_date.tzinfo is None else pd.Timestamp(match_date))
            return float(max((md - last_date).days, 0))
        except Exception:
            return 7.0

    def _calculate_fatigue_index(self, team: str, match_date: datetime) -> float:
        """Matches in last 30 days, normalised 0–1."""
        m = self._get_team_matches(team)
        if m.empty:
            return 0.0
        try:
            dates = pd.to_datetime(m['date'], utc=True)
            md = (pd.Timestamp(match_date, tz='UTC')
                  if match_date.tzinfo is None else pd.Timestamp(match_date))
            return float(min(((md - dates).dt.days < 30).sum() / 5.0, 1.0))
        except Exception:
            return 0.0

    def _calculate_fixture_congestion(self, team: str, match_date: datetime) -> float:
        """Number of matches in the last 14 days."""
        m = self._get_team_matches(team)
        if m.empty:
            return 0.0
        try:
            dates = pd.to_datetime(m['date'], utc=True)
            md = (pd.Timestamp(match_date, tz='UTC')
                  if match_date.tzinfo is None else pd.Timestamp(match_date))
            return float(((md - dates).dt.days < 14).sum())
        except Exception:
            return 0.0

    def _is_derby_match(self, team1: str, team2: str) -> float:
        derbies = {
            ('Manchester United FC', 'Manchester City FC'),
            ('Arsenal FC', 'Tottenham Hotspur FC'),
            ('Liverpool FC', 'Everton FC'),
            ('Chelsea FC', 'Tottenham Hotspur FC'),
            ('Arsenal FC', 'Chelsea FC'),
            ('Manchester United FC', 'Liverpool FC'),
        }
        return 1.0 if (team1, team2) in derbies or (team2, team1) in derbies else 0.0

    def _is_six_pointer(self, team1: str, team2: str) -> float:
        pos1 = self._get_league_position(team1)
        pos2 = self._get_league_position(team2)
        return 1.0 if abs(pos1 - pos2) <= 3 else 0.0

    def _is_relegation_battle(self, team1: str, team2: str) -> float:
        pos1 = self._get_league_position(team1)
        pos2 = self._get_league_position(team2)
        return 1.0 if pos1 >= 15 or pos2 >= 15 else 0.0

    def _is_title_race(self, team1: str, team2: str) -> float:
        pos1 = self._get_league_position(team1)
        pos2 = self._get_league_position(team2)
        return 1.0 if pos1 <= 4 and pos2 <= 4 else 0.0

    def _calculate_season_progress(self, match_date: datetime) -> float:
        """0.0 = August, 1.0 = May. Clamped to [0.0, 1.0]."""
        month = match_date.month
        raw = (month - 8) / 10.0 if month >= 8 else (month + 4) / 10.0
        return max(0.0, min(1.0, raw))

    def _calculate_must_win_factor(self, team: str) -> float:
        pos = self._get_league_position(team)
        return float(max(0.0, (pos - 14) / 6.0)) if pos > 14 else 0.0

    def _get_manager_experience(self, team: str) -> float:
        return 0.0

    def _calculate_tactical_clash(self, team1: str, team2: str) -> float:
        return 0.0

    # ==================== BETTING FEATURES — all 0.0 (no data source) ====================

    def _get_market_probability(self, team1: str, team2: str, outcome: str) -> float:
        return 0.0

    def _calculate_value_bet(self, team: str, side: str) -> float:
        return 0.0

    def _calculate_odds_movement(self, team1: str, team2: str, side: str) -> float:
        return 0.0

    def _get_over_under_probability(self, line: float) -> float:
        df = self._filtered_data
        if df is None or df.empty:
            return 0.5
        total = (df['home_score'] + df['away_score']).dropna()
        return float((total > line).mean()) if len(total) > 0 else 0.5

    def _get_btts_probability(self, team1: str, team2: str) -> float:
        df = self._filtered_data
        if df is None or df.empty:
            return 0.5
        mask = (((df['home_team'] == team1) & (df['away_team'] == team2)) |
                ((df['home_team'] == team2) & (df['away_team'] == team1)))
        subset = df[mask] if mask.sum() >= 3 else df
        btts = ((subset['home_score'] > 0) & (subset['away_score'] > 0)).dropna()
        return float(btts.mean()) if len(btts) > 0 else 0.5

    def _get_asian_handicap(self, team1: str, team2: str) -> float: return 0.0
    def _calculate_handicap_value(self, team1: str, team2: str) -> float: return 0.0
    def _calculate_market_confidence(self, team1: str, team2: str) -> float: return 0.0
    def _calculate_smart_money(self, team1: str, team2: str) -> float: return 0.0
    def _calculate_expected_value(self, team: str, side: str) -> float: return 0.0

    # ==================== TACTICAL FEATURES — all 0.0 (no data source) ====================

    def _classify_attacking_style(self, team: str) -> float: return 0.0
    def _classify_defensive_style(self, team: str) -> float: return 0.0
    def _calculate_tempo(self, team: str) -> float: return 0.0
    def _calculate_pressing_intensity(self, team: str) -> float: return 0.0
    def _calculate_width_of_play(self, team: str) -> float: return 0.0
    def _calculate_directness(self, team: str) -> float: return 0.0
    def _calculate_set_piece_strength(self, team: str, phase: str) -> float: return 0.0
    def _calculate_counter_attack_strength(self, team: str) -> float: return 0.0
    def _calculate_style_clash(self, team1: str, team2: str) -> float: return 0.0
    def _calculate_tactical_advantage(self, team1: str, team2: str) -> float: return 0.0

    # ==================== PLAYER FEATURES — all 0.0 (no data source) ====================

    def _calculate_key_players_available(self, team: str) -> float: return 0.0
    def _get_top_scorer_form(self, team: str) -> float: return 0.0
    def _calculate_squad_depth(self, team: str) -> float: return 0.0
    def _calculate_injury_impact(self, team: str) -> float: return 0.0
    def _calculate_star_factor(self, team: str) -> float: return 0.0

    # ==================== TIME SERIES HELPERS ====================

    def _calculate_trend(self, team: str, window: int) -> float:
        m = self._get_team_matches(team)
        if len(m) < window:
            return 0.0
        pts = self._points_series(m.tail(window)).values.astype(float)
        if len(pts) < 2:
            return 0.0
        try:
            return float(np.polyfit(np.arange(len(pts)), pts, 1)[0])
        except Exception:
            return 0.0

    def _calculate_monthly_performance(self, team: str) -> float:
        m = self._get_team_matches(team)
        if m.empty or self.current_match_date is None:
            return 1.0
        try:
            month = self.current_match_date.month
            m = m.copy()
            m['_month'] = pd.to_datetime(m['date'], utc=True).dt.month
            same_month = m[m['_month'] == month]
            return float(self._points_series(same_month).mean()) if not same_month.empty else 1.0
        except Exception:
            return 1.0

    def _calculate_performance_cycle(self, team: str) -> float:
        return 0.0

    def _calculate_consistency(self, team: str) -> float:
        m = self._get_team_matches(team).tail(15)
        if len(m) < 3:
            return 0.5
        std = float(np.std(self._points_series(m).values.astype(float)))
        return float(1.0 - min(std / 1.5, 1.0))

    def _calculate_mean_reversion(self, team: str) -> float:
        return float(self._calculate_points_per_game(team) - self._calculate_form_last_n(team, 5))

    def _calculate_autocorrelation(self, team: str) -> float:
        m = self._get_team_matches(team).tail(20)
        if len(m) < 5:
            return 0.0
        pts = self._points_series(m).values.astype(float)
        try:
            corr = float(np.corrcoef(pts[:-1], pts[1:])[0, 1])
            return corr if not np.isnan(corr) else 0.0
        except Exception:
            return 0.0

    # ==================== EXTERNAL FEATURES — 0.0 where no data source ====================

    def _estimate_temperature_impact(self, match_date: datetime) -> float: return 0.0
    def _estimate_rain_probability(self, match_date: datetime) -> float: return 0.0
    def _estimate_wind_factor(self, match_date: datetime) -> float: return 0.0
    def _get_stadium_capacity_factor(self, team: str) -> float: return 0.0
    def _calculate_crowd_impact(self, team: str) -> float: return 0.0
    def _calculate_travel_distance(self, team1: str, team2: str) -> float: return 0.0
    def _calculate_media_pressure(self, team: str) -> float: return 0.0

    def _calculate_venue_advantage(self, team: str) -> float:
        return self._calculate_home_win_rate(team)

    def _calculate_away_venue_record(self, away_team: str, home_team: str) -> float:
        """Away team's win rate when visiting this specific home team."""
        h2h = self._get_h2h_matches(away_team, home_team)
        if h2h.empty:
            return 0.25
        as_away = h2h[h2h['away_team'] == away_team]
        if as_away.empty:
            return 0.25
        return float((as_away['result'] == 'A').sum() / len(as_away))


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
