import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Generator, Union
from dataclasses import dataclass, asdict
import logging
import threading
import queue
import sqlite3
from pathlib import Path
import yaml
import json
import time
import requests
import seaborn as sns
import joblib 
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from scipy.stats import poisson
from sklearn.metrics import brier_score_loss, log_loss, confusion_matrix, mean_absolute_error, mean_squared_error
from sklearn.calibration import CalibratedClassifierCV
from colorama import Fore, Style

@dataclass
class MatchStats:
    """Detailed match statistics"""
    goals: int = 0
    shots: int = 0
    shots_on_target: int = 0
    shots_off_target: int = 0
    blocked_shots: int = 0
    possession: float = 0.0
    touches: int = 0
    passes: int = 0
    passes_completed: int = 0
    key_passes: int = 0
    crosses: int = 0
    crosses_completed: int = 0
    long_balls: int = 0
    long_balls_completed: int = 0
    through_balls: int = 0
    through_balls_completed: int = 0
    tackles: int = 0
    tackles_won: int = 0
    interceptions: int = 0
    clearances: int = 0
    blocks: int = 0
    fouls_committed: int = 0
    fouls_won: int = 0
    yellow_cards: int = 0
    red_cards: int = 0
    corners: int = 0
    offsides: int = 0
    penalty_won: int = 0
    penalty_conceded: int = 0
    penalty_scored: int = 0
    penalty_missed: int = 0
    saves: int = 0
    claims: int = 0
    punches: int = 0
    xG: float = 0.0
    xA: float = 0.0
    big_chances_created: int = 0
    big_chances_missed: int = 0
    hit_woodwork: int = 0
    counter_attacks: int = 0
    counter_attack_shots: int = 0
    recoveries: int = 0
    duels_won: int = 0
    duels_lost: int = 0
    ground_duels_won: int = 0
    aerial_duels_won: int = 0
    touches_in_box: int = 0
    passes_into_box: int = 0
    progressive_passes: int = 0
    progressive_carries: int = 0
    dribbles_attempted: int = 0
    dribbles_completed: int = 0
    pressed_actions: int = 0
    pressure_regains: int = 0
    errors_leading_to_shot: int = 0
    errors_leading_to_goal: int = 0
    distance_covered: float = 0.0
    sprints: int = 0

class EPLDataHandler:
    def __init__(self, data_handler):
        self.data = data_handler
        self.scaler = StandardScaler()
        self.result_model = RandomForestClassifier(n_estimators=100)
        self.feature_columns = [
            'home_form_score',
            'away_form_score',
            'home_goals_scored_avg',
            'home_goals_conceded_avg',
            'away_goals_scored_avg',
            'away_goals_conceded_avg',
            'home_win_rate',
            'away_win_rate'
        ]

    def train_model(self):
        """Train the prediction models"""
        try:
            if self.raw_data is None:
                raise ValueError("No data loaded. Please initialize data first.")

            print("Feature names:", self.feature_columns)
            print("Starting model training...")
            
            # Prepare training data
            X = []  # Feature matrix
            y_goals = []  # Target variable for goals
            
            print(f"Processing {len(self.raw_data)} matches for training...")
            
            # Process historical matches for training data
            for _, match in self.data.raw_data.iterrows():
                # Extract features for this match
                home_features = self._extract_team_features(match['HomeTeam'])
                away_features = self._extract_team_features(match['AwayTeam'])
                match_features = np.concatenate([home_features, away_features])
                X.append(match_features)
                y_goals.append([match['FTHG'], match['FTAG']])
            
            X = np.array(X)
            y_goals = np.array(y_goals)
            
            print(f"Training data shape: X={X.shape}, y={y_goals.shape}")
            
            # Scale features
            X = self.scaler.fit_transform(X)
            
            # Train the goals model
            self.goals_model.fit(X, y_goals)
            
            print("Model training completed successfully")
            return True
            
        except Exception as e:
            print(f"Error training model: {str(e)}")
            raise

    def initialize_data(self):
        """Initialize and process all data"""
        try:
            # Load the data
            self.load_data()
            
            # Initialize all statistics
            self._initialize_all_stats()
            
            # Process the raw data
            self._process_raw_data()
            
            print("Data initialization completed successfully")
            return True
            
        except Exception as e:
            print(f"Error initializing data: {str(e)}")
            raise

    def _process_raw_data(self):
        """Process raw data after loading"""
        if self.raw_data is None:
            raise ValueError("No data loaded. Please load data first.")
            
        # Convert date strings to datetime
        self.raw_data['Date'] = pd.to_datetime(self.raw_data['Date'])
        
        # Sort by date
        self.raw_data = self.raw_data.sort_values('Date')
        
        # Process each match
        for _, match in self.raw_data.iterrows():
            self.process_match(match)

    def _initialize_xg_model(self) -> Dict:
        """Initialize expected goals model parameters"""
        return {
            'shot_zones': {
                'six_yard_box': 0.35,
                'penalty_area': 0.12,
                'outside_box': 0.03
            },
            'shot_types': {
                'header': 0.8,
                'foot': 1.0,
                'other': 0.7
            },
            'situation_multipliers': {
                'open_play': 1.0,
                'set_piece': 0.9,
                'penalty': 0.76,
                'counter': 1.2
            },
            'pressure_factors': {
                'high': 0.8,
                'medium': 1.0,
                'low': 1.2
            }
        }

    def load_data(self):
        """Load and validate CSV data"""
        try:
            self.raw_data = pd.read_csv(self.csv_path)
            self._validate_data()
            self._process_raw_data()
            print(f"Successfully loaded {len(self.raw_data)} matches from CSV")
        except Exception as e:
            print(f"Error loading CSV file: {e}")
            raise

    def _validate_data(self):
        """Validate required columns and data format"""
        required_columns = [
            'Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG',
            'HS', 'AS', 'HST', 'AST', 'HC', 'AC',
            'HF', 'AF', 'HY', 'AY', 'HR', 'AR'
        ]
        
        missing_columns = [col for col in required_columns 
                         if col not in self.raw_data.columns]
        
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")

        # Convert date strings to datetime
        self.raw_data['Date'] = pd.to_datetime(self.raw_data['Date'])
        
        # Ensure numerical columns are numeric
        numeric_columns = ['FTHG', 'FTAG', 'HS', 'AS', 'HST', 'AST',
                         'HC', 'AC', 'HF', 'AF', 'HY', 'AY', 'HR', 'AR']
        
        for col in numeric_columns:
            self.raw_data[col] = pd.to_numeric(self.raw_data[col], errors='coerce')

    def _initialize_all_stats(self):
        """Initialize all statistics for teams"""
        self.current_season_stats = {}
        
        # Base stats for each team - example for Liverpool (we'll add all teams)
        team_base_stats = {
            'Liverpool': {
                # Basic Information
                'position': 1,
                'matches_played': 10,
                'points': 25,
                
                # Results
                'wins': 8,
                'draws': 1,
                'losses': 1,
                'goals_for': 19,
                'goals_against': 6,
                'goal_difference': 13,
                'clean_sheets': 4,
                'form': ['W', 'W', 'W', 'D', 'W'],
                
                # Home/Away Splits
                'home': {
                    'matches': 5,
                    'wins': 5,
                    'draws': 0,
                    'losses': 0,
                    'goals_for': 12,
                    'goals_against': 2,
                    'clean_sheets': 3,
                    'points': 15,
                    'xG': 13.2,
                    'xGA': 3.1,
                    'shots': 82,
                    'shots_on_target': 36,
                    'corners': 35,
                    'possession_avg': 64.2
                },
                'away': {
                    'matches': 5,
                    'wins': 3,
                    'draws': 1,
                    'losses': 1,
                    'goals_for': 7,
                    'goals_against': 4,
                    'clean_sheets': 1,
                    'points': 10,
                    'xG': 8.8,
                    'xGA': 5.2,
                    'shots': 74,
                    'shots_on_target': 32,
                    'corners': 33,
                    'possession_avg': 60.4
                },

                # Shooting Statistics
                'shooting': {
                    'total_shots': 156,
                    'shots_on_target': 68,
                    'shots_off_target': 58,
                    'blocked_shots': 30,
                    'shots_inside_box': 98,
                    'shots_outside_box': 58,
                    'shot_conversion_rate': 12.2,
                    'shots_per_goal': 8.2,
                    'shots_on_target_per_game': 6.8,
                    'big_chances_created': 28,
                    'big_chances_scored': 15,
                    'big_chances_missed': 13,
                    'hit_woodwork': 4
                },

                # Passing Statistics
                'passing': {
                    'total_passes': 5842,
                    'completed_passes': 4965,
                    'pass_accuracy': 85.0,
                    'passes_per_game': 584.2,
                    'forward_passes': 2156,
                    'backward_passes': 892,
                    'lateral_passes': 2794,
                    'short_passes': 4256,
                    'long_passes': 1586,
                    'crosses': 186,
                    'crosses_completed': 52,
                    'cross_accuracy': 28.0,
                    'through_balls': 42,
                    'through_balls_completed': 18,
                    'key_passes': 128,
                    'passes_into_final_third': 342,
                    'passes_into_penalty_area': 156,
                    'progressive_passes': 456
                },

                # Possession Statistics
                'possession': {
                    'average_possession': 62.3,
                    'touches': 6842,
                    'touches_in_box': 245,
                    'touches_in_final_third': 892,
                    'carries': 4256,
                    'progressive_carries': 234,
                    'carries_into_final_third': 156,
                    'carries_into_box': 78,
                    'miscontrols': 142,
                    'dispossessed': 98,
                    'dribbles_attempted': 245,
                    'dribbles_completed': 156,
                    'dribble_success_rate': 63.7
                },

                # Defensive Statistics
                'defense': {
                    'tackles': 168,
                    'tackles_won': 126,
                    'tackle_success_rate': 75.0,
                    'tackles_in_def_third': 56,
                    'tackles_in_mid_third': 82,
                    'tackles_in_atk_third': 30,
                    'interceptions': 89,
                    'blocks': 42,
                    'blocked_shots': 24,
                    'blocked_passes': 18,
                    'clearances': 156,
                    'errors_leading_to_shot': 3,
                    'errors_leading_to_goal': 1
                },

                # Pressure Statistics
                'pressure': {
                    'pressures_applied': 1456,
                    'pressure_regains': 468,
                    'pressure_success_rate': 32.1,
                    'pressures_in_def_third': 386,
                    'pressures_in_mid_third': 684,
                    'pressures_in_atk_third': 386,
                    'pressure_regains_in_final_third': 124
                },

                # Duels and Aerial Statistics
                'duels': {
                    'total_duels': 684,
                    'duels_won': 368,
                    'duel_success_rate': 53.8,
                    'aerial_duels': 245,
                    'aerial_duels_won': 134,
                    'aerial_duel_success_rate': 54.7,
                    'ground_duels': 439,
                    'ground_duels_won': 234,
                    'ground_duel_success_rate': 53.3
                },

                # Set Piece Statistics
                'set_pieces': {
                    'corners_total': 68,
                    'corners_completed': 28,
                    'free_kicks_won': 112,
                    'free_kicks_conceded': 98,
                    'free_kicks_scored': 2,
                    'penalties_won': 3,
                    'penalties_conceded': 1,
                    'penalties_scored': 2,
                    'penalties_missed': 1,
                    'throw_ins': 342,
                    'throw_ins_completed': 308
                },

                # Disciplinary Statistics
                'discipline': {
                    'fouls_committed': 98,
                    'fouls_won': 108,
                    'yellow_cards': 18,
                    'red_cards': 0,
                    'yellow_cards_per_game': 1.8,
                    'minutes_per_card': 50.0,
                    'tactical_fouls': 24,
                    'diving_bookings': 1,
                    'dissent_bookings': 3
                },

                # Expected Goals and Advanced Metrics
                'advanced_metrics': {
                    'xG': 20.8,
                    'xGA': 7.2,
                    'xG_per_game': 2.08,
                    'xGA_per_game': 0.72,
                    'xG_difference': 13.6,
                    'npxG': 18.8,  # non-penalty xG
                    'npxGA': 6.9,
                    'ppda': 9.8,  # passes allowed per defensive action
                    'ppda_against': 11.2,
                    'field_tilt': 58.6,  # percentage of final third possession
                    'build_up_disruption': 42.3,
                    'offensive_transition_speed': 2.8,  # seconds
                    'defensive_transition_speed': 3.2  # seconds
                },

                # Goal Timing and Game States
                'game_states': {
                    'goals_first_15': 4,
                    'goals_15_30': 3,
                    'goals_30_45': 3,
                    'goals_45_60': 3,
                    'goals_60_75': 3,
                    'goals_75_90': 3,
                    'goals_scored_first': 7,
                    'points_from_losing_position': 6,
                    'points_lost_from_winning': 3,
                    'leading_time_minutes': 456,
                    'drawing_time_minutes': 382,
                    'losing_time_minutes': 62
                },

                # Performance Indicators
                'performance': {
                    'goals_per_shot': 0.122,
                    'goals_per_shot_on_target': 0.279,
                    'shots_per_goal': 8.2,
                    'save_percentage': 78.4,
                    'clean_sheet_percentage': 40.0,
                    'win_percentage': 80.0,
                    'points_per_game': 2.5,
                    'expected_points': 23.4,
                    'performance_vs_expected': 1.6
                }
            }
            # Additional teams will follow...
        }

        # Initialize stats for all teams
        self.current_season_stats = team_base_stats
        self._update_derived_stats()

    def _update_derived_stats(self):
        """Update all derived statistics for each team"""
        for team in self.current_season_stats:
            self._update_team_derived_stats(team)

    def _update_team_derived_stats(self, team: str):
        """Update derived statistics for a specific team"""
        stats = self.current_season_stats[team]
        matches = stats['matches_played']
        
        # Update shooting metrics
        shooting = stats['shooting']
        shooting.update({
            'shots_per_game': round(shooting['total_shots'] / matches, 1),
            'shot_accuracy': round(shooting['shots_on_target'] / shooting['total_shots'] * 100, 1) if shooting['total_shots'] > 0 else 0,
            'goals_per_shot': round(stats['goals_for'] / shooting['total_shots'], 3) if shooting['total_shots'] > 0 else 0,
            'big_chance_conversion': round(shooting['big_chances_scored'] / shooting['big_chances_created'] * 100, 1) if shooting['big_chances_created'] > 0 else 0
        })

        # Update passing metrics
        passing = stats['passing']
        passing.update({
            'passes_per_game': round(passing['total_passes'] / matches, 1),
            'pass_completion_rate': round(passing['completed_passes'] / passing['total_passes'] * 100, 1) if passing['total_passes'] > 0 else 0,
            'progressive_pass_distance': self._calculate_progressive_distance(passing['progressive_passes']),
            'key_passes_per_game': round(passing['key_passes'] / matches, 1)
        })

        # Update possession metrics
        poss = stats['possession']
        poss.update({
            'touches_per_game': round(poss['touches'] / matches, 1),
            'touches_in_box_per_game': round(poss['touches_in_box'] / matches, 1),
            'carry_distance': self._calculate_carry_distance(poss['carries'], poss['progressive_carries']),
            'possession_won_final_third_per_game': round(stats['pressure']['pressure_regains_in_final_third'] / matches, 1)
        })

        # Update defensive metrics
        defense = stats['defense']
        defense.update({
            'tackles_per_game': round(defense['tackles'] / matches, 1),
            'interceptions_per_game': round(defense['interceptions'] / matches, 1),
            'clearances_per_game': round(defense['clearances'] / matches, 1),
            'defensive_actions_per_game': round((defense['tackles'] + defense['interceptions'] + defense['blocks']) / matches, 1)
        })

        # Update pressure metrics
        pressure = stats['pressure']
        pressure.update({
            'pressures_per_game': round(pressure['pressures_applied'] / matches, 1),
            'pressure_success_rate': round(pressure['pressure_regains'] / pressure['pressures_applied'] * 100, 1) if pressure['pressures_applied'] > 0 else 0,
            'high_press_intensity': self._calculate_press_intensity(pressure)
        })

        # Update duels metrics
        duels = stats['duels']
        duels.update({
            'duels_per_game': round(duels['total_duels'] / matches, 1),
            'aerial_duels_per_game': round(duels['aerial_duels'] / matches, 1),
            'ground_duels_per_game': round(duels['ground_duels'] / matches, 1)
        })

        # Update set piece metrics
        set_pieces = stats['set_pieces']
        set_pieces.update({
            'corner_success_rate': round(set_pieces['corners_completed'] / set_pieces['corners_total'] * 100, 1) if set_pieces['corners_total'] > 0 else 0,
            'penalty_conversion_rate': round(set_pieces['penalties_scored'] / (set_pieces['penalties_scored'] + set_pieces['penalties_missed']) * 100, 1) if (set_pieces['penalties_scored'] + set_pieces['penalties_missed']) > 0 else 0,
            'set_piece_goals_per_game': round((set_pieces['free_kicks_scored'] + set_pieces['penalties_scored']) / matches, 2)
        })

        # Update advanced metrics
        advanced = stats['advanced_metrics']
        advanced.update({
            'xG_difference_per_game': round((advanced['xG'] - advanced['xGA']) / matches, 2),
            'build_up_speed': self._calculate_buildup_speed(stats),
            'defensive_line_height': self._calculate_defensive_line_height(stats),
            'pressing_intensity': self._calculate_pressing_intensity(stats)
        })

        # Update game states and timing metrics
        game_states = stats['game_states']
        game_states.update({
            'average_lead_time': round(game_states['leading_time_minutes'] / matches, 1),
            'points_per_trailing_game': round(game_states['points_from_losing_position'] / matches, 2) if matches > 0 else 0,
            'win_rate_when_scoring_first': self._calculate_win_rate_when_scoring_first(game_states),
            'comeback_ratio': self._calculate_comeback_ratio(game_states)
        })

        # Update performance indicators
        perf = stats['performance']
        perf.update({
            'expected_points_per_game': round(perf['expected_points'] / matches, 2),
            'points_above_expected': round(stats['points'] - perf['expected_points'], 1),
            'goal_difference_per_game': round(stats['goal_difference'] / matches, 2),
            'defensive_solidity': self._calculate_defensive_solidity(stats),
            'attacking_efficiency': self._calculate_attacking_efficiency(stats),
            'overall_rating': self._calculate_overall_rating(stats)
        })

    def _calculate_progressive_distance(self, progressive_passes: int) -> float:
        """Calculate average progressive passing distance"""
        # Assuming average progressive pass moves ball forward 15 meters
        return round(progressive_passes * 15 / 1000, 1)  # Convert to kilometers

    def _calculate_carry_distance(self, carries: int, progressive_carries: int) -> float:
        """Calculate total ball carry distance"""
        # Assuming average carry is 5 meters and progressive carry is 15 meters
        return round((carries * 5 + progressive_carries * 15) / 1000, 1)  # Convert to kilometers

    def _calculate_press_intensity(self, pressure: Dict) -> float:
        """Calculate pressing intensity score"""
        if pressure['pressures_applied'] == 0:
            return 0.0
            
        # Weight different thirds of the pitch
        attack_weight = 1.5
        mid_weight = 1.0
        def_weight = 0.5
        
        weighted_pressures = (
            pressure['pressures_in_atk_third'] * attack_weight +
            pressure['pressures_in_mid_third'] * mid_weight +
            pressure['pressures_in_def_third'] * def_weight
        )
        
        return round(weighted_pressures / pressure['pressures_applied'] * 100, 1)

    def _calculate_buildup_speed(self, stats: Dict) -> float:
        """Calculate team's build-up speed rating"""
        passes = stats['passing']
        
        if passes['total_passes'] == 0:
            return 0.0
            
        progressive_ratio = passes['progressive_passes'] / passes['total_passes']
        forward_pass_ratio = passes['forward_passes'] / passes['total_passes']
        
        return round((progressive_ratio + forward_pass_ratio) * 50, 1)  # Scale to 0-100

    def _calculate_defensive_line_height(self, stats: Dict) -> float:
        """Calculate average defensive line height"""
        defense = stats['defense']
        
        if sum([defense['tackles_in_def_third'], 
               defense['tackles_in_mid_third'], 
               defense['tackles_in_atk_third']]) == 0:
            return 0.0
            
        # Weight tackles by field position (0-100 scale where 100 is highest line)
        weighted_position = (
            defense['tackles_in_def_third'] * 20 +
            defense['tackles_in_mid_third'] * 50 +
            defense['tackles_in_atk_third'] * 80
        ) / (defense['tackles_in_def_third'] + 
             defense['tackles_in_mid_third'] + 
             defense['tackles_in_atk_third'])
        
        return round(weighted_position, 1)

    def _calculate_pressing_intensity(self, stats: Dict) -> float:
        """Calculate overall pressing intensity rating"""
        pressure = stats['pressure']
        
        if pressure['pressures_applied'] == 0:
            return 0.0
            
        success_weight = 0.6
        position_weight = 0.4
        
        success_score = pressure['pressure_success_rate']
        position_score = self._calculate_press_intensity(pressure)
        
        return round(
            success_score * success_weight + 
            position_score * position_weight, 
            1
        )

    def process_match(self, match_data: Dict):
        """Process a single match and update all relevant statistics"""
        try:
            home_team = match_data['HomeTeam']
            away_team = match_data['AwayTeam']
            
            # Initialize teams if they don't exist in current_season_stats
            if home_team not in self.current_season_stats:
                self._initialize_team_stats(home_team)
            if away_team not in self.current_season_stats:
                self._initialize_team_stats(away_team)
            
            # Update match statistics
            self._update_team_match_stats(home_team, match_data, is_home=True)
            self._update_team_match_stats(away_team, match_data, is_home=False)
            
            # Update form and head-to-head records
            self._update_form(home_team, away_team, match_data)
            self._update_head_to_head(home_team, away_team, match_data)
            
        except Exception as e:
            print(f"Error processing match: {str(e)}")
            raise

    def _create_match_stats(self, match_data: Dict, is_home: bool) -> MatchStats:
        """Create MatchStats object from raw match data"""
        prefix = 'H' if is_home else 'A'
        
        return MatchStats(
            goals=match_data[f'FT{prefix}G'],
            shots=match_data[f'{prefix}S'],
            shots_on_target=match_data[f'{prefix}ST'],
            shots_off_target=match_data[f'{prefix}S'] - match_data[f'{prefix}ST'],
            blocked_shots=match_data.get(f'{prefix}BS', 0),
            possession=match_data.get(f'{prefix}Poss', 50.0),
            touches=match_data.get(f'{prefix}Touches', 0),
            passes=match_data.get(f'{prefix}TotalPasses', 0),
            passes_completed=match_data.get(f'{prefix}CompletedPasses', 0),
            key_passes=match_data.get(f'{prefix}KeyPasses', 0),
            crosses=match_data.get(f'{prefix}Crosses', 0),
            crosses_completed=match_data.get(f'{prefix}CompletedCrosses', 0),
            long_balls=match_data.get(f'{prefix}LongBalls', 0),
            long_balls_completed=match_data.get(f'{prefix}CompletedLongBalls', 0),
            through_balls=match_data.get(f'{prefix}ThroughBalls', 0),
            through_balls_completed=match_data.get(f'{prefix}CompletedThroughBalls', 0),
            tackles=match_data.get(f'{prefix}T', 0),
            tackles_won=match_data.get(f'{prefix}TW', 0),
            interceptions=match_data.get(f'{prefix}I', 0),
            clearances=match_data.get(f'{prefix}CL', 0),
            blocks=match_data.get(f'{prefix}BL', 0),
            fouls_committed=match_data[f'{prefix}F'],
            fouls_won=match_data.get(f'{prefix}FW', 0),
            yellow_cards=match_data[f'{prefix}Y'],
            red_cards=match_data[f'{prefix}R'],
            corners=match_data[f'{prefix}C'],
            offsides=match_data.get(f'{prefix}O', 0),
            penalty_won=match_data.get(f'{prefix}PW', 0),
            penalty_conceded=match_data.get(f'{prefix}PC', 0),
            penalty_scored=match_data.get(f'{prefix}PS', 0),
            penalty_missed=match_data.get(f'{prefix}PM', 0),
            saves=match_data.get(f'{prefix}Saves', 0),
            claims=match_data.get(f'{prefix}Claims', 0),
            punches=match_data.get(f'{prefix}Punches', 0),
            xG=self._calculate_match_xG(match_data, is_home),
            xA=match_data.get(f'{prefix}xA', 0.0),
            big_chances_created=match_data.get(f'{prefix}BC', 0),
            big_chances_missed=match_data.get(f'{prefix}BCM', 0),
            hit_woodwork=match_data.get(f'{prefix}HW', 0),
            counter_attacks=match_data.get(f'{prefix}CA', 0),
            counter_attack_shots=match_data.get(f'{prefix}CAS', 0),
            recoveries=match_data.get(f'{prefix}Rec', 0),
            duels_won=match_data.get(f'{prefix}DW', 0),
            duels_lost=match_data.get(f'{prefix}DL', 0),
            ground_duels_won=match_data.get(f'{prefix}GDW', 0),
            aerial_duels_won=match_data.get(f'{prefix}ADW', 0),
            touches_in_box=match_data.get(f'{prefix}TB', 0),
            passes_into_box=match_data.get(f'{prefix}PB', 0),
            progressive_passes=match_data.get(f'{prefix}PP', 0),
            progressive_carries=match_data.get(f'{prefix}PC', 0),
            dribbles_attempted=match_data.get(f'{prefix}DA', 0),
            dribbles_completed=match_data.get(f'{prefix}DC', 0),
            pressed_actions=match_data.get(f'{prefix}Press', 0),
            pressure_regains=match_data.get(f'{prefix}PReg', 0),
            errors_leading_to_shot=match_data.get(f'{prefix}ELS', 0),
            errors_leading_to_goal=match_data.get(f'{prefix}ELG', 0),
            distance_covered=match_data.get(f'{prefix}Dist', 0.0),
            sprints=match_data.get(f'{prefix}Sprints', 0)
        )

    def _update_team_match_stats(self, team: str, match_stats: MatchStats, is_home: bool):
        """Update team statistics with new match data"""
        stats = self.current_season_stats[team]
        
        # Update basic stats
        stats['matches_played'] += 1
        stats['goals_for'] += match_stats.goals
        stats['goals_against'] += match_stats.goals
        
        # Update home/away specific stats
        venue = 'home' if is_home else 'away'
        venue_stats = stats[venue]
        venue_stats['matches'] += 1
        venue_stats['goals_for'] += match_stats.goals
        venue_stats['goals_against'] += match_stats.goals
        
        # Update shooting stats
        shooting = stats['shooting']
        self._update_shooting_stats(shooting, match_stats)
        
        # Update passing stats
        passing = stats['passing']
        self._update_passing_stats(passing, match_stats)
        
        # Update possession stats
        possession = stats['possession']
        self._update_possession_stats(possession, match_stats)
        
        # Update defensive stats
        defense = stats['defense']
        self._update_defensive_stats(defense, match_stats)
        
        # Update pressure stats
        pressure = stats['pressure']
        self._update_pressure_stats(pressure, match_stats)
        
        # Update duels stats
        duels = stats['duels']
        self._update_duels_stats(duels, match_stats)
        
        # Update set pieces stats
        set_pieces = stats['set_pieces']
        self._update_set_piece_stats(set_pieces, match_stats)
        
        # Update discipline stats
        discipline = stats['discipline']
        self._update_discipline_stats(discipline, match_stats)
        
        # Update advanced metrics
        advanced = stats['advanced_metrics']
        self._update_advanced_match_metrics(advanced, match_stats)
        
        # Update derived stats
        self._update_team_derived_stats(team)

    def _update_shooting_stats(self, shooting: Dict, match_stats: MatchStats):
        """Update shooting statistics"""
        shooting['total_shots'] += match_stats.shots
        shooting['shots_on_target'] += match_stats.shots_on_target
        shooting['shots_off_target'] += match_stats.shots_off_target
        shooting['blocked_shots'] += match_stats.blocked_shots
        shooting['big_chances_created'] += match_stats.big_chances_created
        shooting['big_chances_missed'] += match_stats.big_chances_missed
        shooting['hit_woodwork'] += match_stats.hit_woodwork

    def _update_passing_stats(self, passing: Dict, match_stats: MatchStats):
        """Update passing statistics"""
        passing['total_passes'] += match_stats.passes
        passing['completed_passes'] += match_stats.passes_completed
        passing['key_passes'] += match_stats.key_passes
        passing['crosses'] += match_stats.crosses
        passing['crosses_completed'] += match_stats.crosses_completed
        passing['through_balls'] += match_stats.through_balls
        passing['through_balls_completed'] += match_stats.through_balls_completed
        passing['progressive_passes'] += match_stats.progressive_passes

    def _calculate_match_xG(self, match_data: Dict, is_home: bool) -> float:
        """Calculate expected goals for a match"""
        prefix = 'H' if is_home else 'A'
        shots = match_data[f'{prefix}S']
        shots_on_target = match_data[f'{prefix}ST']
        
        # Basic xG model
        base_xG = (shots_on_target * 0.3 + 
                  (shots - shots_on_target) * 0.1)
        
        # Adjust for big chances
        big_chances = match_data.get(f'{prefix}BC', 0)
        base_xG += big_chances * 0.3
        
        # Adjust for penalties
        penalties = match_data.get(f'{prefix}PS', 0) + match_data.get(f'{prefix}PM', 0)
        base_xG += penalties * 0.76
        
        return round(base_xG, 2)

    def analyze_team_performance(self, team: str, last_n_games: int = 5) -> Dict:
        """Comprehensive team performance analysis"""
        stats = self.current_season_stats[team]
        recent_matches = self.get_team_recent_matches(team, last_n_games)
        
        return {
            'overall_performance': self._analyze_overall_performance(stats),
            'recent_form': self._analyze_recent_form(recent_matches),
            'attacking_analysis': self._analyze_attacking_performance(stats),
            'defensive_analysis': self._analyze_defensive_performance(stats),
            'tactical_analysis': self._analyze_tactical_approach(stats),
            'physical_analysis': self._analyze_physical_performance(stats),
            'comparison_to_expected': self._analyze_performance_vs_expected(stats),
            'strengths_weaknesses': self._identify_strengths_weaknesses(stats)
        }

    def _analyze_overall_performance(self, stats: Dict) -> Dict:
        """Analyze overall team performance"""
        matches = stats['matches_played']
        
        return {
            'points_per_game': round(stats['points'] / matches, 2),
            'goal_difference_per_game': round(stats['goal_difference'] / matches, 2),
            'win_rate': round(stats['wins'] / matches * 100, 1),
            'loss_rate': round(stats['losses'] / matches * 100, 1),
            'clean_sheet_rate': round(stats['clean_sheets'] / matches * 100, 1),
            'scoring_rate': round(stats['goals_for'] / matches, 2),
            'conceding_rate': round(stats['goals_against'] / matches, 2),
            'performance_rating': self._calculate_performance_rating(stats),
            'form_trajectory': self._calculate_form_trajectory(stats['form']),
            'consistency_rating': self._calculate_consistency_rating(stats)
        }

    def _analyze_attacking_performance(self, stats: Dict) -> Dict:
        """Detailed analysis of attacking performance"""
        shooting = stats['shooting']
        passing = stats['passing']
        matches = stats['matches_played']
        
        return {
            'shooting_efficiency': {
                'shots_per_goal': round(shooting['total_shots'] / stats['goals_for'], 2) if stats['goals_for'] > 0 else float('inf'),
                'shot_accuracy': round(shooting['shots_on_target'] / shooting['total_shots'] * 100, 1) if shooting['total_shots'] > 0 else 0,
                'big_chance_conversion': round(
                    (shooting['big_chances_created'] - shooting['big_chances_missed']) / 
                    shooting['big_chances_created'] * 100, 1
                ) if shooting['big_chances_created'] > 0 else 0,
                'goals_per_shot': round(stats['goals_for'] / shooting['total_shots'], 3) if shooting['total_shots'] > 0 else 0
            },
            'chance_creation': {
                'chances_per_game': round(shooting['big_chances_created'] / matches, 2),
                'key_passes_per_game': round(passing['key_passes'] / matches, 2),
                'crosses_accuracy': round(passing['crosses_completed'] / passing['crosses'] * 100, 1) if passing['crosses'] > 0 else 0,
                'through_ball_accuracy': round(
                    passing['through_balls_completed'] / passing['through_balls'] * 100, 1
                ) if passing['through_balls'] > 0 else 0
            },
            'attacking_patterns': {
                'possession_attacks': self._analyze_possession_attacks(stats),
                'counter_attacks': self._analyze_counter_attacks(stats),
                'set_piece_effectiveness': self._analyze_set_pieces(stats)
            },
            'pressure_creation': {
                'high_press_effectiveness': self._analyze_high_press(stats),
                'territorial_dominance': self._analyze_territorial_dominance(stats),
                'attacking_third_entries': self._analyze_final_third_entries(stats)
            }
        }

    def _analyze_defensive_performance(self, stats: Dict) -> Dict:
        """Detailed analysis of defensive performance"""
        defense = stats['defense']
        matches = stats['matches_played']
        
        return {
            'defensive_solidity': {
                'goals_conceded_per_game': round(stats['goals_against'] / matches, 2),
                'clean_sheet_ratio': round(stats['clean_sheets'] / matches * 100, 1),
                'shots_faced_per_game': round(defense['shots_faced'] / matches, 2),
                'save_percentage': self._calculate_save_percentage(stats)
            },
            'defensive_actions': {
                'tackles_per_game': round(defense['tackles'] / matches, 2),
                'interceptions_per_game': round(defense['interceptions'] / matches, 2),
                'clearances_per_game': round(defense['clearances'] / matches, 2),
                'blocks_per_game': round(defense['blocks'] / matches, 2)
            },
            'pressing_efficiency': {
                'pressure_success_rate': round(
                    stats['pressure']['pressure_regains'] / 
                    stats['pressure']['pressures_applied'] * 100, 1
                ) if stats['pressure']['pressures_applied'] > 0 else 0,
                'defensive_third_pressures': round(stats['pressure']['pressures_in_def_third'] / matches, 2),
                'middle_third_pressures': round(stats['pressure']['pressures_in_mid_third'] / matches, 2),
                'attacking_third_pressures': round(stats['pressure']['pressures_in_atk_third'] / matches, 2)
            },
            'defensive_organization': {
                'defensive_line_height': self._calculate_defensive_line_height(stats),
                'compactness': self._calculate_team_compactness(stats),
                'defensive_vulnerability': self._analyze_defensive_vulnerabilities(stats)
            }
        }

    def _analyze_tactical_approach(self, stats: Dict) -> Dict:
        """Analysis of team's tactical approach"""
        return {
            'playing_style': {
                'possession_dominance': self._analyze_possession_dominance(stats),
                'passing_directness': self._analyze_passing_directness(stats),
                'pressing_intensity': self._analyze_pressing_style(stats),
                'build_up_speed': self._analyze_build_up_speed(stats)
            },
            'formation_flexibility': self._analyze_formation_usage(stats),
            'substitution_impact': self._analyze_substitution_effectiveness(stats),
            'game_management': {
                'leading_game_management': self._analyze_leading_management(stats),
                'trailing_game_management': self._analyze_trailing_management(stats),
                'game_state_adaptation': self._analyze_game_state_adaptation(stats)
            }
        }

    def _calculate_performance_rating(self, stats: Dict) -> float:
        """Calculate overall performance rating (0-100)"""
        weights = {
            'points_per_game': 0.3,
            'goal_difference': 0.2,
            'expected_performance': 0.15,
            'form': 0.15,
            'strength_of_schedule': 0.1,
            'consistency': 0.1
        }
        
        ppg_score = (stats['points'] / stats['matches_played']) * 25  # Max 3 points per game
        gd_score = ((stats['goal_difference'] + 20) / 40) * 20  # Normalize around ±20 GD
        xG_score = ((stats['advanced_metrics']['xG_difference'] + 15) / 30) * 15
        form_score = sum(1 for result in stats['form'][:5] if result == 'W') * 3
        schedule_score = self._calculate_schedule_strength(stats) * 10
        consistency_score = self._calculate_consistency_rating(stats) * 10
        
        total_score = (
            ppg_score * weights['points_per_game'] +
            gd_score * weights['goal_difference'] +
            xG_score * weights['expected_performance'] +
            form_score * weights['form'] +
            schedule_score * weights['strength_of_schedule'] +
            consistency_score * weights['consistency']
        )
        
        return round(total_score, 1)

    def _calculate_schedule_strength(self, stats: Dict) -> float:
        """Calculate strength of schedule (0-1)"""
        opponent_ratings = []
        for match in self.get_team_matches(stats['team']):
            opponent = match['AwayTeam'] if match['HomeTeam'] == stats['team'] else match['HomeTeam']
            opponent_stats = self.current_season_stats[opponent]
            opponent_ratings.append(opponent_stats['points'] / (opponent_stats['matches_played'] * 3))
        
        return sum(opponent_ratings) / len(opponent_ratings) if opponent_ratings else 0.5

    def get_match_prediction(self, home_team: str, away_team: str) -> Dict:
        """Generate comprehensive match prediction"""
        home_stats = self.analyze_team_performance(home_team)
        away_stats = self.analyze_team_performance(away_team)
        h2h_analysis = self._analyze_head_to_head(home_team, away_team)
        
        # Calculate various prediction factors
        attacking_factor = self._calculate_attacking_matchup(home_stats, away_stats)
        defensive_factor = self._calculate_defensive_matchup(home_stats, away_stats)
        form_factor = self._calculate_form_matchup(home_stats, away_stats)
        tactical_factor = self._calculate_tactical_matchup(home_stats, away_stats)
        
        # Generate score prediction
        score_prediction = self._predict_score(
            home_stats, away_stats, 
            attacking_factor, defensive_factor,
            form_factor, tactical_factor
        )
        
        return {
            'prediction': score_prediction,
            'analysis': {
                'attacking_matchup': attacking_factor,
                'defensive_matchup': defensive_factor,
                'form_comparison': form_factor,
                'tactical_analysis': tactical_factor,
                'head_to_head': h2h_analysis
            },
            'confidence': self._calculate_prediction_confidence(
                score_prediction, home_stats, away_stats
            ),
            'key_factors': self._identify_key_factors(
                home_stats, away_stats, score_prediction
            )
        }

   
   
    #EPLVisualizer Class for Match Visualizing

class EPLVisualizer:
    #Statistical Modelling Predictive Model
    def __init__(self, data_handler: EPLDataHandler):
        self.data = data_handler
        self.plt_style = {
            'figure.figsize': (12, 8),
            'axes.facecolor': '#f0f0f0',
            'axes.grid': True,
            'grid.alpha': 0.3,
            'font.family': 'sans-serif'
        }
        plt.style.use(self.plt_style)

    def create_team_performance_dashboard(self, team: str) -> None:
        """Create comprehensive team performance dashboard"""
        fig = plt.figure(figsize=(20, 12))
        fig.suptitle(f'{team} Performance Analysis Dashboard', fontsize=16)
        
        # Create grid for subplots
        gs = fig.add_gridspec(3, 3)
        
        # Form trend
        ax1 = fig.add_subplot(gs[0, 0])
        self._plot_form_trend(team, ax1)
        
        # Goal distribution
        ax2 = fig.add_subplot(gs[0, 1])
        self._plot_goal_distribution(team, ax2)
        
        # Shot map
        ax3 = fig.add_subplot(gs[0, 2])
        self._plot_shot_map(team, ax3)
        
        # Possession analysis
        ax4 = fig.add_subplot(gs[1, 0])
        self._plot_possession_analysis(team, ax4)
        
        # Defensive actions
        ax5 = fig.add_subplot(gs[1, 1])
        self._plot_defensive_actions(team, ax5)
        
        # Expected goals trend
        ax6 = fig.add_subplot(gs[1, 2])
        self._plot_xg_trend(team, ax6)
        
        # Team comparison radar
        ax7 = fig.add_subplot(gs[2, :])
        self._plot_team_comparison_radar(team, ax7)
        
        plt.tight_layout()
        plt.show()

    def _plot_form_trend(self, team: str, ax: plt.Axes) -> None:
        """Plot team's form trend"""
        stats = self.data.current_season_stats[team]
        form = stats['form']
        
        form_values = {'W': 3, 'D': 1, 'L': 0}
        form_colors = {'W': 'green', 'D': 'yellow', 'L': 'red'}
        
        y_values = [form_values[result] for result in form]
        colors = [form_colors[result] for result in form]
        
        ax.plot(range(len(y_values)), y_values, 'o-', color='blue')
        ax.scatter(range(len(y_values)), y_values, c=colors, s=100)
        
        ax.set_title('Recent Form Trend')
        ax.set_ylabel('Points')
        ax.set_xlabel('Last 5 Matches')
        ax.grid(True, alpha=0.3)

    def _plot_goal_distribution(self, team: str, ax: plt.Axes) -> None:
        """Plot team's goal distribution"""
        stats = self.data.current_season_stats[team]
        game_states = stats['game_states']
        
        periods = [
            '0-15', '15-30', '30-45',
            '45-60', '60-75', '75-90'
        ]
        goals = [
            game_states['goals_first_15'],
            game_states['goals_15_30'],
            game_states['goals_30_45'],
            game_states['goals_45_60'],
            game_states['goals_60_75'],
            game_states['goals_75_90']
        ]
        
        ax.bar(periods, goals, color='blue', alpha=0.6)
        ax.set_title('Goal Distribution by Time Period')
        ax.set_ylabel('Goals Scored')
        ax.tick_params(axis='x', rotation=45)

    def _plot_shot_map(self, team: str, ax: plt.Axes) -> None:
        """Create shot map visualization"""
        stats = self.data.current_season_stats[team]
        shooting = stats['shooting']
        
        # Create pitch outline
        pitch_length = 100
        pitch_width = 70
        
        ax.plot([0, pitch_length, pitch_length, 0, 0], 
                [0, 0, pitch_width, pitch_width, 0], 'k-')
        
        # Plot shots
        shots_on_target = shooting['shots_on_target']
        shots_off_target = shooting['shots_off_target']
        blocked_shots = shooting['blocked_shots']
        
        # Simulate shot positions (would be real data in practice)
        np.random.seed(42)
        for _ in range(shots_on_target):
            x = np.random.uniform(60, 90)
            y = np.random.uniform(20, 50)
            ax.plot(x, y, 'go', alpha=0.6)
            
        for _ in range(shots_off_target):
            x = np.random.uniform(60, 90)
            y = np.random.uniform(10, 60)
            ax.plot(x, y, 'ro', alpha=0.4)
            
        ax.set_title('Shot Map')
        ax.set_aspect('equal')

    def _plot_possession_analysis(self, team: str, ax: plt.Axes) -> None:
        """Plot possession analysis"""
        stats = self.data.current_season_stats[team]
        possession = stats['possession']
        
        categories = [
            'Own Third',
            'Middle Third',
            'Final Third'
        ]
        
        values = [
            possession['touches'] * 0.3,
            possession['touches'] * 0.4,
            possession['touches'] * 0.3
        ]
        
        colors = ['#ff9999', '#66b3ff', '#99ff99']
        
        ax.pie(values, labels=categories, colors=colors, 
               autopct='%1.1f%%', startangle=90)
        ax.set_title('Possession Distribution by Field Third')

    def create_match_analysis_visualization(self, 
                                         home_team: str, 
                                         away_team: str) -> None:
        """Create comprehensive match analysis visualization"""
        fig = plt.figure(figsize=(20, 12))
        fig.suptitle(f'Match Analysis: {home_team} vs {away_team}', fontsize=16)
        
        # Create grid for subplots
        gs = fig.add_gridspec(2, 3)
        
        # Head-to-head history
        ax1 = fig.add_subplot(gs[0, 0])
        self._plot_head_to_head_history(home_team, away_team, ax1)
        
        # Form comparison
        ax2 = fig.add_subplot(gs[0, 1])
        self._plot_form_comparison(home_team, away_team, ax2)
        
        # Expected goals comparison
        ax3 = fig.add_subplot(gs[0, 2])
        self._plot_xg_comparison(home_team, away_team, ax3)
        
        # Team strengths radar
        ax4 = fig.add_subplot(gs[1, :])
        self._plot_team_comparison_radar(home_team, away_team, ax4)
        
        plt.tight_layout()
        plt.show()

    def create_league_analysis_dashboard(self) -> None:
        """Create league-wide analysis dashboard"""
        fig = plt.figure(figsize=(20, 12))
        fig.suptitle('Premier League Analysis Dashboard', fontsize=16)
        
        # Create grid for subplots
        gs = fig.add_gridspec(2, 2)
        
        # League table visual
        ax1 = fig.add_subplot(gs[0, 0])
        self._plot_league_table_visual(ax1)
        
        # Goal distribution across league
        ax2 = fig.add_subplot(gs[0, 1])
        self._plot_league_goals_distribution(ax2)
        
        # Form trends
        ax3 = fig.add_subplot(gs[1, 0])
        self._plot_league_form_trends(ax3)
        
        # Performance metrics
        ax4 = fig.add_subplot(gs[1, 1])
        self._plot_league_performance_metrics(ax4)
        
        plt.tight_layout()
        plt.show()

    def _plot_league_table_visual(self, ax: plt.Axes) -> None:
        """Create visual representation of league table"""
        teams = sorted(
            self.data.current_season_stats.items(),
            key=lambda x: x[1]['points'],
            reverse=True
        )
        
        team_names = [team[0] for team in teams]
        points = [team[1]['points'] for team in teams]
        
        y_pos = np.arange(len(team_names))
        
        ax.barh(y_pos, points, align='center')
        ax.set_yticks(y_pos)
        ax.set_yticklabels(team_names)
        ax.invert_yaxis()
        ax.set_xlabel('Points')
        ax.set_title('Premier League Table')

    def generate_match_report(self, 
                            home_team: str, 
                            away_team: str,
                            include_visualizations: bool = True) -> str:
        """Generate comprehensive match report with optional visualizations"""
        prediction = self.data.get_match_prediction(home_team, away_team)
        home_stats = self.data.current_season_stats[home_team]
        away_stats = self.data.current_season_stats[away_team]
        
        report = self._format_match_report(
            home_team, away_team,
            prediction, home_stats, away_stats
        )
        
        if include_visualizations:
            self.create_match_analysis_visualization(home_team, away_team)
        
        return report

    def _format_match_report(self, 
                           home_team: str, 
                           away_team: str,
                           prediction: Dict,
                           home_stats: Dict,
                           away_stats: Dict) -> str:
        """Format detailed match report"""
        # This would be implemented to generate a formatted text report
        # based on all the analysis and prediction data
        pass

class EPLPredictiveModel:
    def __init__(self, data_handler: EPLDataHandler):
        self.data = data_handler
        self.scaler = StandardScaler()
        self.result_model = RandomForestClassifier(n_estimators=100)
        self.poisson_model = None
        self.feature_importance = {}
        self._initialize_models()

    def train(self):
        """Train the predictive model using historical data"""
        try:
            # Prepare training data
            X = []  # Feature matrix
            y = []  # Target variable
            
            # Process historical matches for training data
            for _, match in self.data.raw_data.iterrows():
                home_team = match['HomeTeam']
                away_team = match['AwayTeam']
                
                # Extract features
                home_features = self._extract_team_features(home_team)
                away_features = self._extract_team_features(away_team)
                
                # Combine features in the same order as feature_columns
                match_features = np.array([
                    home_features[0],  # home_form_score
                    away_features[0],  # away_form_score
                    home_features[1],  # home_goals_scored_avg
                    home_features[2],  # home_goals_conceded_avg
                    away_features[1],  # away_goals_scored_avg
                    away_features[2],  # away_goals_conceded_avg
                    home_features[3],  # home_win_rate
                    away_features[3]   # away_win_rate
                ])
                
                X.append(match_features)
                
                # Determine match result
                if match['FTHG'] > match['FTAG']:
                    result = 0  # Home win
                elif match['FTHG'] < match['FTAG']:
                    result = 2  # Away win
                else:
                    result = 1  # Draw
                    
                y.append(result)
            
            X = np.array(X)
            y = np.array(y)
            
            # Scale features
            X_scaled = self.scaler.fit_transform(X)
            
            # Train the model
            self.result_model.fit(X_scaled, y)
            
            print(f"{Fore.GREEN}Model trained successfully{Style.RESET_ALL}")
            
        except Exception as e:
            print(f"{Fore.RED}Error training model: {str(e)}{Style.RESET_ALL}")
            raise
    
    def _prepare_features(self, data):
        """Prepare feature matrix for training/prediction"""
        features = []
        for _, match in data.iterrows():
            home_team = match['HomeTeam']
            away_team = match['AwayTeam']
            
            home_stats = self.data.current_season_stats.get(home_team, {})
            away_stats = self.data.current_season_stats.get(away_team, {})
            
            match_features = [
                self._calculate_form_score(home_stats.get('form', [])),
                self._calculate_form_score(away_stats.get('form', [])),
                home_stats.get('goals_scored_avg', 0),
                home_stats.get('goals_conceded_avg', 0),
                away_stats.get('goals_scored_avg', 0),
                away_stats.get('goals_conceded_avg', 0),
                home_stats.get('win_rate', 0),
                away_stats.get('win_rate', 0)
            ]
            features.append(match_features)
            
        return np.array(features)

    def _prepare_labels(self, data):
        """Prepare target labels for training"""
        labels = []
        for _, match in data.iterrows():
            # Update these column names to match your CSV file
            # Common variations are 'FTHG'/'FTAG' or 'HomeGoals'/'AwayGoals'
            if match['FTHG'] > match['FTAG']:  # Change from 'HomeGoals'/'AwayGoals'
                result = 'H'
            elif match['FTHG'] < match['FTAG']:
                result = 'A'
            else:
                result = 'D'
            labels.append(result)
        return np.array(labels)

    def _initialize_models(self):
        """Initialize the prediction models"""
        try:
            X, y_result, y_goals = self._prepare_training_data()
            
            # Split data
            X_train, X_test, y_result_train, y_result_test = train_test_split(
                X, y_result, test_size=0.2, random_state=42
            )
            
            # Initialize and train result prediction model
            self.result_model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42
            )
            self.result_model = CalibratedClassifierCV(
                self.result_model, cv=5, method='sigmoid'
            )
            self.result_model.fit(X_train, y_result_train)
            
            # Train separate models for home and away goals
            self.goals_model_home = GradientBoostingRegressor(
                n_estimators=100,
                max_depth=5,
                random_state=42
            )
            self.goals_model_away = GradientBoostingRegressor(
                n_estimators=100,
                max_depth=5,
                random_state=42
            )
            
            self.goals_model_home.fit(X, y_goals[:, 0])  # Train on home goals
            self.goals_model_away.fit(X, y_goals[:, 1])  # Train on away goals
            
        except Exception as e:
            print(f"Error initializing models: {str(e)}")
            raise

    def _prepare_training_data(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Prepare training data for the models"""
        X = []
        y_result = []
        y_goals_home = []  # Separate arrays for home and away goals
        y_goals_away = []
        
        for _, match in self.data.raw_data.iterrows():
            # Extract features
            home_features = self._extract_team_features(match['HomeTeam'])
            away_features = self._extract_team_features(match['AwayTeam'])
            context_features = self._extract_match_context_features(match)
            
            features = np.concatenate([home_features, away_features, context_features])
            X.append(features)
            
            # Extract results
            if match['FTHG'] > match['FTAG']:
                result = 'H'
            elif match['FTHG'] < match['FTAG']:
                result = 'A'
            else:
                result = 'D'
                
            y_result.append(result)
            y_goals_home.append(match['FTHG'])
            y_goals_away.append(match['FTAG'])
        
        X = np.array(X)
        y_result = np.array(y_result)
        y_goals_home = np.array(y_goals_home)
        y_goals_away = np.array(y_goals_away)
        
        # Scale features
        X = self.scaler.fit_transform(X)
        
        return X, y_result, np.column_stack((y_goals_home, y_goals_away))

    def _extract_team_features(self, team: str) -> np.ndarray:
        """Extract only the required features for prediction"""
        stats = self.data.current_season_stats.get(team, {})
        matches_played = max(stats.get('matches_played', 1), 1)  # Avoid division by zero
        
        # Calculate form score from recent results
        form = stats.get('form', [])
        form_score = self._calculate_form_score(form)
        
        # Calculate basic averages
        goals_scored = stats.get('goals_for', 0)
        goals_conceded = stats.get('goals_against', 0)
        wins = stats.get('wins', 0)
        
        goals_scored_avg = goals_scored / matches_played
        goals_conceded_avg = goals_conceded / matches_played
        win_rate = wins / matches_played if matches_played > 0 else 0
        
        return np.array([
            form_score,
            goals_scored_avg,
            goals_conceded_avg,
            win_rate
        ])

    def _extract_match_context_features(self, match) -> np.ndarray:
        """Extract match context features"""
        try:
            match_date = pd.to_datetime(match['Date']) if isinstance(match['Date'], str) else match['Date']
            
            # Get previous matches for both teams
            home_team = match['HomeTeam']
            away_team = match['AwayTeam']
            
            rest_days = self._calculate_rest_days(home_team, away_team, match_date)
            return np.array([rest_days])
            
        except Exception as e:
            # Return default context features
            return np.array([7.0])  # Default rest days

    def _calculate_rest_days(self, home_team: str, away_team: str, match_date: datetime) -> float:
        """Calculate average rest days for both teams"""
        try:
            # Filter matches before the current match date
            previous_matches = self.data.raw_data[self.data.raw_data['Date'] < match_date]
            
            if previous_matches.empty:
                return 7.0  # Default for first matches of the season
            
            # Get last match dates for both teams
            home_last_match = previous_matches[
                (previous_matches['HomeTeam'] == home_team) | 
                (previous_matches['AwayTeam'] == home_team)
            ]['Date'].max()
            
            away_last_match = previous_matches[
                (previous_matches['HomeTeam'] == away_team) | 
                (previous_matches['AwayTeam'] == away_team)
            ]['Date'].max()
            
            # Calculate rest days
            if pd.isnull(home_last_match) and pd.isnull(away_last_match):
                return 7.0
            elif pd.isnull(home_last_match):
                away_rest = (match_date - away_last_match).days
                return min(max(away_rest, 2), 14)
            elif pd.isnull(away_last_match):
                home_rest = (match_date - home_last_match).days
                return min(max(home_rest, 2), 14)
            
            # Calculate average rest days
            home_rest = (match_date - home_last_match).days
            away_rest = (match_date - away_last_match).days
            avg_rest = (home_rest + away_rest) / 2
            
            # Bound rest days between 2 and 14
            return min(max(avg_rest, 2), 14)
            
        except Exception as e:
            print(f"Error in _calculate_rest_days: {str(e)}")
            return 7.0  # Default value on error

    def predict_match(self, home_team: str, away_team: str) -> Dict:
        """Predict match result and score"""
        try:
            # Extract features for both teams
            home_features = self._extract_team_features(home_team)
            away_features = self._extract_team_features(away_team)
            
            # Combine features in the correct order to match feature_columns
            features = np.array([
                home_features[0],  # home_form_score
                away_features[0],  # away_form_score
                home_features[1],  # home_goals_scored_avg
                home_features[2],  # home_goals_conceded_avg
                away_features[1],  # away_goals_scored_avg
                away_features[2],  # away_goals_conceded_avg
                home_features[3],  # home_win_rate
                away_features[3]   # away_win_rate
            ]).reshape(1, -1)
            
            # Scale features
            features_scaled = self.scaler.transform(features)
            
            # Get probabilities for each outcome
            result_probs = self.result_model.predict_proba(features_scaled)[0]
            
            # Predict goals (using basic heuristic based on averages)
            predicted_home_goals = (home_features[1] * 1.1)  # Slight home advantage
            predicted_away_goals = away_features[1]
            
            return {
                'home_win_prob': result_probs[0],
                'draw_prob': result_probs[1],
                'away_win_prob': result_probs[2],
                'predicted_home_goals': round(predicted_home_goals, 2),
                'predicted_away_goals': round(predicted_away_goals, 2)
            }
            
        except Exception as e:
            raise Exception(f"Error making prediction: {str(e)}")

    def _calculate_poisson_probabilities(self, 
                                       home_team: str, 
                                       away_team: str) -> Dict:
        """Calculate Poisson probabilities for different scorelines"""
        home_stats = self.data.current_season_stats[home_team]
        away_stats = self.data.current_season_stats[away_team]
        
        home_attack = home_stats['goals_for'] / home_stats['matches_played']
        home_defense = home_stats['goals_against'] / home_stats['matches_played']
        away_attack = away_stats['goals_for'] / away_stats['matches_played']
        away_defense = away_stats['goals_against'] / away_stats['matches_played']
        
        # Calculate lambda values
        home_lambda = home_attack * away_defense * 1.3  # Home advantage factor
        away_lambda = away_attack * home_defense
        
        # Calculate probabilities for scorelines
        max_goals = 5
        scoreline_probs = {}
        
        for i in range(max_goals + 1):
            for j in range(max_goals + 1):
                prob = (poisson.pmf(i, home_lambda) * 
                       poisson.pmf(j, away_lambda))
                scoreline_probs[f"{i}-{j}"] = prob
        
        return scoreline_probs

    def _combine_predictions(self, 
                           result_probs: np.ndarray,
                           predicted_goals: np.ndarray,
                           poisson_probs: Dict) -> Dict:
        """Combine different prediction models"""
        # Weights for different models
        result_weight = 0.4
        goals_weight = 0.3
        poisson_weight = 0.3
        
        # Calculate combined probabilities
        home_win_prob = (
            result_probs[0] * result_weight +
            self._get_poisson_result_prob('home_win', poisson_probs) * poisson_weight +
            self._get_goals_result_prob('home_win', predicted_goals) * goals_weight
        )
        
        draw_prob = (
            result_probs[1] * result_weight +
            self._get_poisson_result_prob('draw', poisson_probs) * poisson_weight +
            self._get_goals_result_prob('draw', predicted_goals) * goals_weight
        )
        
        away_win_prob = (
            result_probs[2] * result_weight +
            self._get_poisson_result_prob('away_win', poisson_probs) * poisson_weight +
            self._get_goals_result_prob('away_win', predicted_goals) * goals_weight
        )
        
        # Normalize probabilities
        total_prob = home_win_prob + draw_prob + away_win_prob
        home_win_prob /= total_prob
        draw_prob /= total_prob
        away_win_prob /= total_prob
        
        return {
            'home_win': round(home_win_prob, 3),
            'draw': round(draw_prob, 3),
            'away_win': round(away_win_prob, 3),
            'home_goals': round(predicted_goals[0], 1),
            'away_goals': round(predicted_goals[1], 1),
            'likely_score': self._get_most_likely_score(poisson_probs)
        }

    def _calculate_prediction_confidence(self, 
                                      prediction: Dict,
                                      home_team: str,
                                      away_team: str) -> float:
        """Calculate confidence level in prediction"""
        # Factors affecting confidence
        probability_margin = max(
            prediction['home_win'],
            prediction['draw'],
            prediction['away_win']
        ) - min(
            prediction['home_win'],
            prediction['draw'],
            prediction['away_win']
        )
        
        form_difference = abs(
            self._calculate_form_score(
                self.data.current_season_stats[home_team]['form']
            ) -
            self._calculate_form_score(
                self.data.current_season_stats[away_team]['form']
            )
        )
        historical_accuracy = self._get_historical_prediction_accuracy(
            home_team, away_team
        )
        
        # Combine factors
        confidence = (
            probability_margin * 0.4 +
            form_difference * 0.3 +
            historical_accuracy * 0.3
        )
        
        return min(0.95, round(confidence, 2))

    def _calculate_form_score(self, form_list: List[str]) -> float:
        """Calculate form score from recent results"""
        if not form_list:
            return 0.0
        
        # Take last 5 matches only
        recent_form = form_list[-5:]
        
        # Define points for each result
        form_points = {'W': 1.0, 'D': 0.5, 'L': 0.0}
        
        # Calculate weighted average (more recent games count more)
        weights = [1.0 + (i * 0.2) for i in range(len(recent_form))]
        form_values = [form_points.get(result, 0.0) * weight 
                      for result, weight in zip(recent_form, weights)]
        
        return sum(form_values) / sum(weights) if weights else 0.0

class EPLModelEvaluator:
    def __init__(self, predictive_model: EPLPredictiveModel, data_handler: EPLDataHandler):
        self.model = predictive_model
        self.data = data_handler
        self.evaluation_metrics = {}
        self.calibration_data = {}
        self.prediction_history = []
        self.model_weights = self._initialize_model_weights()

    def _initialize_model_weights(self) -> Dict[str, float]:
        """Initialize dynamic model weights based on performance"""
        return {
            'random_forest': 0.4,
            'gradient_boosting': 0.3,
            'poisson': 0.3,
            'last_update': datetime.now(),
            'performance_history': []
        }

    def evaluate_model_performance(self, evaluation_period: int = 30) -> Dict:
        """Comprehensive model evaluation"""
        recent_matches = self._get_recent_matches(evaluation_period)
        predictions = []
        actuals = []
        
        for match in recent_matches:
            pred = self.model.predict_match(match['HomeTeam'], match['AwayTeam'])
            actual = self._get_actual_result(match)
            
            predictions.append(pred)
            actuals.append(actual)

        evaluation = {
            'accuracy': self._calculate_prediction_accuracy(predictions, actuals),
            'calibration': self._evaluate_calibration(predictions, actuals),
            'brier_score': self._calculate_brier_score(predictions, actuals),
            'log_loss': self._calculate_log_loss(predictions, actuals),
            'goal_prediction_rmse': self._calculate_goal_prediction_rmse(
                predictions, actuals
            ),
            'model_contribution': self._analyze_model_contributions(
                predictions, actuals
            ),
            'feature_importance': self._analyze_feature_importance(),
            'bias_analysis': self._analyze_prediction_bias(predictions, actuals)
        }

        self.evaluation_metrics = evaluation
        self._update_model_weights(evaluation)
        
        return evaluation

    def _calculate_prediction_accuracy(self, 
                                    predictions: List[Dict], 
                                    actuals: List[Dict]) -> Dict:
        """Calculate various accuracy metrics"""
        correct_results = 0
        correct_scores = 0
        goal_difference_accuracy = 0
        total_matches = len(predictions)

        for pred, actual in zip(predictions, actuals):
            # Result accuracy
            if self._get_result_category(pred) == actual['result']:
                correct_results += 1

            # Score accuracy
            if (round(pred['prediction']['expected_home_goals']) == actual['home_goals'] and
                round(pred['prediction']['expected_away_goals']) == actual['away_goals']):
                correct_scores += 1

            # Goal difference accuracy
            predicted_gd = (pred['prediction']['expected_home_goals'] - 
                          pred['prediction']['expected_away_goals'])
            actual_gd = actual['home_goals'] - actual['away_goals']
            if round(predicted_gd) == actual_gd:
                goal_difference_accuracy += 1

        return {
            'result_accuracy': round(correct_results / total_matches * 100, 2),
            'score_accuracy': round(correct_scores / total_matches * 100, 2),
            'goal_diff_accuracy': round(goal_difference_accuracy / total_matches * 100, 2),
            'weighted_accuracy': self._calculate_weighted_accuracy(
                predictions, actuals
            )
        }

    def _evaluate_calibration(self, 
                            predictions: List[Dict], 
                            actuals: List[Dict]) -> Dict:
        """Evaluate prediction calibration"""
        probability_ranges = np.arange(0, 1.1, 0.1)
        calibration_scores = {
            'home_win': [],
            'draw': [],
            'away_win': []
        }

        for prob_min in probability_ranges[:-1]:
            prob_max = prob_min + 0.1
            
            # Evaluate each outcome
            for outcome in ['home_win', 'draw', 'away_win']:
                matches_in_range = [
                    (p, a) for p, a in zip(predictions, actuals)
                    if prob_min <= p['prediction'][f'{outcome}_probability'] < prob_max
                ]
                
                if matches_in_range:
                    actual_frequency = sum(
                        1 for _, a in matches_in_range if a['result'] == outcome
                    ) / len(matches_in_range)
                    
                    calibration_scores[outcome].append({
                        'predicted_prob': (prob_min + prob_max) / 2,
                        'actual_frequency': actual_frequency,
                        'sample_size': len(matches_in_range)
                    })

        return {
            'calibration_scores': calibration_scores,
            'reliability_score': self._calculate_reliability_score(
                calibration_scores
            )
        }

    def _analyze_model_contributions(self, 
                                   predictions: List[Dict], 
                                   actuals: List[Dict]) -> Dict:
        """Analyze contribution of each model component"""
        model_performances = {
            'random_forest': [],
            'gradient_boosting': [],
            'poisson': []
        }

        for pred, actual in zip(predictions, actuals):
            # Extract individual model predictions
            rf_pred = pred['model_components']['random_forest']
            gb_pred = pred['model_components']['gradient_boosting']
            poisson_pred = pred['model_components']['poisson']
            
            # Calculate accuracy for each model
            model_performances['random_forest'].append(
                self._calculate_prediction_accuracy_single(rf_pred, actual)
            )
            model_performances['gradient_boosting'].append(
                self._calculate_prediction_accuracy_single(gb_pred, actual)
            )
            model_performances['poisson'].append(
                self._calculate_prediction_accuracy_single(poisson_pred, actual)
            )

        return {
            'model_accuracies': {
                model: np.mean(scores) 
                for model, scores in model_performances.items()
            },
            'contribution_analysis': self._analyze_contribution_patterns(
                model_performances
            )
        }

    def _analyze_prediction_bias(self, 
                               predictions: List[Dict], 
                               actuals: List[Dict]) -> Dict:
        """Analyze various types of prediction bias"""
        biases = {
            'home_bias': self._calculate_home_bias(predictions, actuals),
            'favorite_bias': self._calculate_favorite_bias(predictions, actuals),
            'goal_bias': self._calculate_goal_prediction_bias(predictions, actuals),
            'form_bias': self._calculate_form_bias(predictions, actuals),
            'historical_bias': self._analyze_historical_bias(predictions, actuals)
        }

        return {
            'bias_metrics': biases,
            'bias_summary': self._summarize_biases(biases),
            'correction_factors': self._calculate_bias_correction_factors(biases)
        }

    def _calculate_form_bias(self, 
                           predictions: List[Dict], 
                           actuals: List[Dict]) -> Dict:
        """Calculate bias related to team form"""
        form_categories = {
            'excellent': [],  # Last 5 games: >= 12 points
            'good': [],      # Last 5 games: 9-11 points
            'average': [],   # Last 5 games: 6-8 points
            'poor': []       # Last 5 games: <= 5 points
        }

        for pred, actual in zip(predictions, actuals):
            home_form = self._calculate_recent_form(
                actual['home_team']
            )
            away_form = self._calculate_recent_form(
                actual['away_team']
            )

            # Categorize matches by form difference
            form_diff = home_form - away_form
            
            if form_diff >= 6:
                category = 'excellent'
            elif form_diff >= 3:
                category = 'good'
            elif form_diff >= -3:
                category = 'average'
            else:
                category = 'poor'

            form_categories[category].append({
                'prediction': pred,
                'actual': actual,
                'error': self._calculate_prediction_error(pred, actual)
            })

        return {
            'form_bias_metrics': {
                category: self._calculate_category_bias(matches)
                for category, matches in form_categories.items()
            },
            'form_adjustment_factors': self._calculate_form_adjustment_factors(
                form_categories
            )
        }

    def calibrate_model(self) -> None:
        """Calibrate model based on recent performance"""
        evaluation = self.evaluate_model_performance()
        
        # Update model weights
        self._update_model_weights(evaluation)
        
        # Apply bias corrections
        self._apply_bias_corrections(evaluation['bias_analysis'])
        
        # Recalibrate probability outputs
        self._recalibrate_probabilities(evaluation['calibration'])
        
        # Update feature importance
        self._update_feature_importance(evaluation['feature_importance'])

    def _update_model_weights(self, evaluation: Dict) -> None:
        """Update model component weights based on performance"""
        accuracies = evaluation['model_contribution']['model_accuracies']
        total_accuracy = sum(accuracies.values())
        
        # Calculate new weights
        new_weights = {
            model: acc / total_accuracy 
            for model, acc in accuracies.items()
        }
        
        # Apply smoothing to avoid dramatic changes
        alpha = 0.3  # Smoothing factor
        for model in self.model_weights:
            if model != 'last_update' and model != 'performance_history':
                self.model_weights[model] = (
                    alpha * new_weights[model] + 
                    (1 - alpha) * self.model_weights[model]
                )

        # Update metadata
        self.model_weights['last_update'] = datetime.now()
        self.model_weights['performance_history'].append({
            'date': datetime.now(),
            'weights': new_weights.copy(),
            'evaluation_metrics': evaluation.copy()
        })

    def get_model_insights(self) -> Dict:
        """Generate comprehensive model insights"""
        return {
            'performance_metrics': self.evaluation_metrics,
            'model_weights': self.model_weights,
            'calibration_status': self.calibration_data,
            'prediction_patterns': self._analyze_prediction_patterns(),
            'feature_importance': self._get_feature_importance_analysis(),
            'improvement_suggestions': self._generate_improvement_suggestions()
        }

class EPLBacktester:
    def __init__(self, data_handler: EPLDataHandler, 
                 predictive_model: EPLPredictiveModel):
        self.data = data_handler
        self.model = predictive_model
        self.backtest_results = {}
        self.performance_metrics = {}
        self.simulation_results = []
        self.optimization_history = []

    def run_backtest(self, 
                    start_date: datetime,
                    end_date: datetime,
                    strategy: str = 'standard',
                    rolling_window: int = 10) -> Dict:
        """Run comprehensive backtest of prediction model"""
        
        test_matches = self._get_test_matches(start_date, end_date)
        predictions = []
        results = []
        
        # Initialize tracking metrics
        metrics = {
            'accuracy': [],
            'roi': [],
            'kelly_criterion': [],
            'confidence_calibration': [],
            'goal_prediction_error': [],
            'market_comparison': []
        }

        # Run rolling window predictions
        for window in self._generate_rolling_windows(
            test_matches, rolling_window
        ):
            # Update model with window data
            self._update_model_with_window(window)
            
            # Get next match to predict
            target_match = window['target_match']
            
            # Generate prediction
            prediction = self._generate_prediction(
                target_match, strategy
            )
            predictions.append(prediction)
            
            # Record actual result
            result = self._get_actual_result(target_match)
            results.append(result)
            
            # Update metrics
            self._update_tracking_metrics(
                metrics, prediction, result
            )

        # Calculate final performance metrics
        performance = self._calculate_backtest_performance(
            predictions, results, metrics
        )
        
        # Store results
        self.backtest_results[datetime.now()] = {
            'period': (start_date, end_date),
            'strategy': strategy,
            'predictions': predictions,
            'results': results,
            'metrics': metrics,
            'performance': performance
        }
        
        return performance

    def _generate_rolling_windows(self, 
                                matches: pd.DataFrame,
                                window_size: int) -> Generator:
        """Generate rolling windows for backtesting"""
        for i in range(len(matches) - window_size):
            yield {
                'training_data': matches.iloc[i:i+window_size],
                'target_match': matches.iloc[i+window_size]
            }

    def simulate_betting_strategies(self, 
                                  backtest_id: datetime,
                                  initial_bankroll: float = 1000.0,
                                  strategies: List[str] = None) -> Dict:
        """Simulate different betting strategies on backtest results"""
        if not strategies:
            strategies = ['flat', 'kelly', 'proportional', 'martingale']
        
        backtest = self.backtest_results[backtest_id]
        results = {}
        
        for strategy in strategies:
            simulation = self._run_betting_simulation(
                backtest['predictions'],
                backtest['results'],
                strategy,
                initial_bankroll
            )
            results[strategy] = simulation
        
        self.simulation_results.append({
            'timestamp': datetime.now(),
            'backtest_id': backtest_id,
            'results': results
        })
        
        return results

    def _run_betting_simulation(self,
                              predictions: List[Dict],
                              results: List[Dict],
                              strategy: str,
                              initial_bankroll: float) -> Dict:
        """Run betting simulation with specified strategy"""
        bankroll = initial_bankroll
        bets = []
        roi_track = []
        
        for pred, result in zip(predictions, results):
            # Calculate bet size based on strategy
            bet_size = self._calculate_bet_size(
                strategy, bankroll, pred
            )
            
            # Place bet and update bankroll
            outcome = self._simulate_bet_outcome(
                pred, result, bet_size
            )
            bankroll += outcome['profit']
            
            bets.append({
                'prediction': pred,
                'bet_size': bet_size,
                'outcome': outcome,
                'bankroll': bankroll
            })
            
            roi_track.append(
                (bankroll - initial_bankroll) / initial_bankroll
            )

        return {
            'final_bankroll': bankroll,
            'roi': (bankroll - initial_bankroll) / initial_bankroll,
            'max_drawdown': self._calculate_max_drawdown(roi_track),
            'sharpe_ratio': self._calculate_sharpe_ratio(roi_track),
            'bet_history': bets,
            'roi_history': roi_track
        }

    def optimize_prediction_model(self,
                                param_grid: Dict,
                                optimization_metric: str = 'roi',
                                n_trials: int = 100) -> Dict:
        """Optimize model parameters using backtesting results"""
        best_params = None
        best_score = float('-inf')
        optimization_results = []
        
        for _ in range(n_trials):
            # Generate parameter combination
            params = self._sample_parameters(param_grid)
            
            # Update model with new parameters
            self.model.update_parameters(params)
            
            # Run backtest with new parameters
            backtest_results = self.run_backtest(
                start_date=datetime.now() - timedelta(days=90),
                end_date=datetime.now(),
                strategy='standard'
            )
            
            # Calculate optimization score
            score = self._calculate_optimization_score(
                backtest_results, optimization_metric
            )
            
            optimization_results.append({
                'parameters': params,
                'score': score,
                'results': backtest_results
            })
            
            # Update best parameters if necessary
            if score > best_score:
                best_score = score
                best_params = params

        # Save optimization history
        self.optimization_history.append({
            'timestamp': datetime.now(),
            'results': optimization_results,
            'best_params': best_params,
            'best_score': best_score
        })
        
        # Update model with best parameters
        self.model.update_parameters(best_params)
        
        return {
            'best_parameters': best_params,
            'best_score': best_score,
            'optimization_path': optimization_results
        }

    def analyze_model_strengths(self) -> Dict:
        """Analyze model strengths and weaknesses"""
        all_predictions = self._gather_all_predictions()
        
        return {
            'overall_performance': self._analyze_overall_performance(
                all_predictions
            ),
            'scenario_analysis': self._analyze_prediction_scenarios(
                all_predictions
            ),
            'market_efficiency': self._analyze_market_efficiency(
                all_predictions
            ),
            'improvement_areas': self._identify_improvement_areas(
                all_predictions
            )
        }

    def generate_performance_report(self,
                                  backtest_id: datetime = None) -> str:
        """Generate comprehensive performance report"""
        if backtest_id is None:
            backtest_id = max(self.backtest_results.keys())
        
        backtest = self.backtest_results[backtest_id]
        
        report = self._format_performance_report(backtest)
        self._save_performance_report(report, backtest_id)
        
        return report

    def _calculate_max_drawdown(self, roi_history: List[float]) -> float:
        """Calculate maximum drawdown from ROI history"""
        peak = float('-inf')
        max_drawdown = 0
        
        for roi in roi_history:
            if roi > peak:
                peak = roi
            drawdown = peak - roi
            max_drawdown = max(max_drawdown, drawdown)
        
        return max_drawdown

    def _calculate_sharpe_ratio(self, roi_history: List[float],
                              risk_free_rate: float = 0.02) -> float:
        """Calculate Sharpe ratio from ROI history"""
        returns = np.diff(roi_history)
        if len(returns) < 2:
            return 0.0
            
        excess_returns = returns - (risk_free_rate / 252)  # Daily risk-free rate
        return np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(252)

    def _format_performance_report(self, backtest: Dict) -> str:
        """Format detailed performance report"""
        # This would format a comprehensive report string
        # Implementation details would go here
        pass

    def save_model_state(self, filepath: str) -> None:
        """Save model state and backtesting results"""
        state = {
            'backtest_results': self.backtest_results,
            'performance_metrics': self.performance_metrics,
            'simulation_results': self.simulation_results,
            'optimization_history': self.optimization_history
        }
        joblib.dump(state, filepath)

    def load_model_state(self, filepath: str) -> None:
        """Load model state and backtesting results"""
        state = joblib.load(filepath)
        self.backtest_results = state['backtest_results']
        self.performance_metrics = state['performance_metrics']
        self.simulation_results = state['simulation_results']
        self.optimization_history = state['optimization_history']

@dataclass
class ModelMetrics:
    """Tracking metrics for model performance"""
    accuracy: float
    confidence: float
    calibration_score: float
    roi: float
    timestamp: datetime
    prediction_count: int
    error_rate: float
    bias_score: float
    market_efficiency: float

class EPLDeploymentManager:
    def __init__(self, 
                 data_handler: EPLDataHandler,
                 predictive_model: EPLPredictiveModel,
                 backtester: EPLBacktester,
                 config_path: str = 'config.yaml'):
        self.data = data_handler
        self.model = predictive_model
        self.backtester = backtester
        self.config = self._load_config(config_path)
        self.logger = self._setup_logging()
        self.metrics_queue = queue.Queue()
        self.alert_thresholds = self.config['monitoring']['thresholds']
        self.db = self._initialize_database()
        self.monitoring_thread = None
        self.is_running = False

    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from YAML file"""
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)

    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger('EPL_Predictor')
        logger.setLevel(logging.INFO)
        
        # File handler
        fh = logging.FileHandler('epl_predictor.log')
        fh.setLevel(logging.INFO)
        
        # Console handler
        ch = logging.StreamHandler()
        ch.setLevel(logging.INFO)
        
        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        fh.setFormatter(formatter)
        ch.setFormatter(formatter)
        
        logger.addHandler(fh)
        logger.addHandler(ch)
        
        return logger

    def _initialize_database(self) -> sqlite3.Connection:
        """Initialize SQLite database for metrics storage"""
        db_path = self.config['database']['path']
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create tables if they don't exist
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME,
                home_team TEXT,
                away_team TEXT,
                predicted_home_goals REAL,
                predicted_away_goals REAL,
                predicted_result TEXT,
                confidence REAL,
                actual_result TEXT,
                accuracy INTEGER
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME,
                accuracy REAL,
                confidence REAL,
                calibration_score REAL,
                roi REAL,
                prediction_count INTEGER,
                error_rate REAL,
                bias_score REAL,
                market_efficiency REAL
            )
        ''')
        
        conn.commit()
        return conn

    def start_monitoring(self):
        """Start the monitoring system"""
        self.is_running = True
        self.monitoring_thread = threading.Thread(
            target=self._monitoring_loop
        )
        self.monitoring_thread.start()
        self.logger.info("Monitoring system started")

    def stop_monitoring(self):
        """Stop the monitoring system"""
        self.is_running = False
        if self.monitoring_thread:
            self.monitoring_thread.join()
        self.logger.info("Monitoring system stopped")

    def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.is_running:
            try:
                # Collect metrics
                metrics = self._collect_metrics()
                
                # Store metrics
                self._store_metrics(metrics)
                
                # Check for alerts
                self._check_alerts(metrics)
                
                # Update model if needed
                self._check_model_update(metrics)
                
                # Sleep for monitoring interval
                time.sleep(self.config['monitoring']['interval'])
                
            except Exception as e:
                self.logger.error(f"Monitoring error: {str(e)}")

    def _collect_metrics(self) -> ModelMetrics:
        """Collect current model metrics"""
        current_metrics = {
            'accuracy': self._calculate_current_accuracy(),
            'confidence': self._calculate_current_confidence(),
            'calibration_score': self._calculate_calibration(),
            'roi': self._calculate_roi(),
            'timestamp': datetime.now(),
            'prediction_count': self._get_prediction_count(),
            'error_rate': self._calculate_error_rate(),
            'bias_score': self._calculate_bias_score(),
            'market_efficiency': self._calculate_market_efficiency()
        }
        
        return ModelMetrics(**current_metrics)

    def _store_metrics(self, metrics: ModelMetrics):
        """Store metrics in database"""
        cursor = self.db.cursor()
        cursor.execute('''
            INSERT INTO metrics (
                timestamp, accuracy, confidence, calibration_score,
                roi, prediction_count, error_rate, bias_score,
                market_efficiency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            metrics.timestamp, metrics.accuracy, metrics.confidence,
            metrics.calibration_score, metrics.roi, metrics.prediction_count,
            metrics.error_rate, metrics.bias_score, metrics.market_efficiency
        ))
        self.db.commit()

    def _check_alerts(self, metrics: ModelMetrics):
        """Check metrics against alert thresholds"""
        for metric_name, threshold in self.alert_thresholds.items():
            metric_value = getattr(metrics, metric_name)
            if metric_value < threshold['min'] or metric_value > threshold['max']:
                self._trigger_alert(metric_name, metric_value, threshold)

    def _trigger_alert(self, metric_name: str, 
                      value: float, threshold: Dict):
        """Trigger alert for metric threshold violation"""
        alert_message = (
            f"Alert: {metric_name} value {value:.2f} "
            f"outside threshold [{threshold['min']}, {threshold['max']}]"
        )
        self.logger.warning(alert_message)
        
        if self.config['notifications']['enabled']:
            self._send_notification(alert_message)

    def _check_model_update(self, metrics: ModelMetrics):
        """Check if model update is needed"""
        if (metrics.accuracy < self.config['model']['update_threshold'] or
            metrics.calibration_score < self.config['model']['calibration_threshold']):
            self._update_model()

    def _update_model(self):
        """Update model based on recent performance"""
        self.logger.info("Starting model update")
        
        try:
            # Run backtesting
            backtest_results = self.backtester.run_backtest(
                start_date=datetime.now() - timedelta(days=30),
                end_date=datetime.now()
            )
            
            # Optimize model
            optimization_results = self.backtester.optimize_prediction_model(
                param_grid=self.config['model']['param_grid']
            )
            
            # Update model parameters
            self.model.update_parameters(optimization_results['best_parameters'])
            
            # Log update results
            self.logger.info(
                f"Model updated successfully. "
                f"New performance score: {optimization_results['best_score']:.3f}"
            )
            
        except Exception as e:
            self.logger.error(f"Model update failed: {str(e)}")

    def generate_report(self, 
                       start_date: Optional[datetime] = None,
                       end_date: Optional[datetime] = None) -> Dict:
        """Generate comprehensive performance report"""
        if not start_date:
            start_date = datetime.now() - timedelta(days=30)
        if not end_date:
            end_date = datetime.now()
            
        cursor = self.db.cursor()
        
        # Get metrics for period
        cursor.execute('''
            SELECT * FROM metrics
            WHERE timestamp BETWEEN ? AND ?
            ORDER BY timestamp
        ''', (start_date, end_date))
        
        metrics_data = cursor.fetchall()
        
        # Get predictions for period
        cursor.execute('''
            SELECT * FROM predictions
            WHERE timestamp BETWEEN ? AND ?
            ORDER BY timestamp
        ''', (start_date, end_date))
        
        predictions_data = cursor.fetchall()
        
        return {
            'period': {
                'start': start_date,
                'end': end_date
            },
            'metrics_summary': self._summarize_metrics(metrics_data),
            'prediction_analysis': self._analyze_predictions(predictions_data),
            'performance_trends': self._analyze_trends(metrics_data),
            'recommendations': self._generate_recommendations(
                metrics_data, predictions_data
            )
        }

    def _send_notification(self, message: str):
        """Send notification through configured channels"""
        if self.config['notifications']['email']['enabled']:
            self._send_email_notification(message)
        
        if self.config['notifications']['slack']['enabled']:
            self._send_slack_notification(message)

    def save_state(self, filepath: str):
        """Save current system state"""
        state = {
            'timestamp': datetime.now().isoformat(),
            'metrics': self._get_recent_metrics(),
            'model_state': self.model.get_state(),
            'config': self.config
        }
        
        with open(filepath, 'w') as f:
            json.dump(state, f)
            
        self.logger.info(f"System state saved to {filepath}")

    def load_state(self, filepath: str):
        """Load system state"""
        with open(filepath, 'r') as f:
            state = json.load(f)
            
        self.model.load_state(state['model_state'])
        self.config.update(state['config'])
        
        self.logger.info(f"System state loaded from {filepath}")

