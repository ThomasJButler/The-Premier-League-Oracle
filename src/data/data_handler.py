# src/data/data_handler.py

import pandas as pd
import numpy as np
from pathlib import Path
import logging
import yaml
from typing import Dict, List, Optional, Union
from datetime import datetime
import hashlib
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class CSVUpdateHandler(FileSystemEventHandler):
    """Handler for CSV file updates"""
    def __init__(self, data_handler):
        self.data_handler = data_handler
        self.last_modified = datetime.now()
        # Debounce time of 1 second to prevent multiple updates
        self.debounce_time = 1

    def on_modified(self, event):
        """Handle file modification events"""
        if event.is_directory:
            return
            
        current_time = datetime.now()
        if (current_time - self.last_modified).total_seconds() < self.debounce_time:
            return

        if event.src_path.endswith(self.data_handler.current_season_file):
            print(f"Detected update to {event.src_path}")
            self.data_handler.load_current_season()
            self.last_modified = current_time

class EPLDataHandler:
    def __init__(self, config_path: str = "config/config.yaml"):
        self.config = self._load_config(config_path)
        self.logger = self._setup_logging()
        
        # Data storage
        self.historical_data: Dict[str, pd.DataFrame] = {}
        self.current_season: Optional[pd.DataFrame] = None
        self.current_season_file = self.config['paths']['current_season']
        
        # File monitoring
        self.observer = None
        self.is_watching = False
        
        # Initialize
        self._initialize_system()

    def _load_config(self, config_path: str) -> dict:
        """Load configuration from YAML file"""
        try:
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        except Exception as e:
            raise Exception(f"Error loading configuration: {str(e)}")

    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger('EPL_DataHandler')
        logger.setLevel(logging.INFO)
        
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # Console handler
        ch = logging.StreamHandler()
        ch.setFormatter(formatter)
        logger.addHandler(ch)
        
        return logger

    def _initialize_system(self):
        """Initialize the data handling system"""
        try:
            # Ensure directories exist
            Path(self.config['paths']['data_directory']).mkdir(parents=True, exist_ok=True)
            Path(self.config['paths']['processed_directory']).mkdir(parents=True, exist_ok=True)
            
            # Load historical data
            self._load_historical_data()
            
            # Load current season
            self.load_current_season()
            
            # Setup file monitoring if enabled
            if self.config['monitoring']['auto_update']:
                self._setup_file_watching()
                
        except Exception as e:
            self.logger.error(f"Initialization error: {str(e)}")
            raise

    def _load_historical_data(self):
        """Load historical season data"""
        data_dir = Path(self.config['paths']['data_directory'])
        
        for season_file in data_dir.glob("*.csv"):
            if season_file.name != self.current_season_file:
                try:
                    season_name = season_file.stem
                    self.logger.info(f"Loading historical data: {season_name}")
                    
                    df = pd.read_csv(season_file)
                    df['Date'] = pd.to_datetime(df['Date'], format='%d/%m/%Y')
                    self.historical_data[season_name] = df
                    
                except Exception as e:
                    self.logger.error(f"Error loading {season_file}: {str(e)}")

    def load_current_season(self):
        """Load current season data"""
        try:
            file_path = Path(self.config['paths']['data_directory']) / self.current_season_file
            
            if not file_path.exists():
                self.logger.warning(f"Current season file not found: {file_path}")
                return
            
            df = pd.read_csv(file_path)
            df['Date'] = pd.to_datetime(df['Date'], format='%d/%m/%Y')
            
            self.current_season = df
            self.logger.info("Current season data loaded successfully")
            
        except Exception as e:
            self.logger.error(f"Error loading current season: {str(e)}")
            raise

    def _setup_file_watching(self):
        """Setup file system observer for auto-updates"""
        try:
            self.observer = Observer()
            event_handler = CSVUpdateHandler(self)
            
            self.observer.schedule(
                event_handler,
                str(Path(self.config['paths']['data_directory'])),
                recursive=False
            )
            
            self.start_watching()
            
        except Exception as e:
            self.logger.error(f"Error setting up file watching: {str(e)}")
            raise

    def start_watching(self):
        """Start the file system observer"""
        if not self.is_watching and self.observer:
            self.observer.start()
            self.is_watching = True
            self.logger.info("Started watching for file updates")

    def stop_watching(self):
        """Stop the file system observer"""
        if self.is_watching and self.observer:
            self.observer.stop()
            self.observer.join()
            self.is_watching = False
            self.logger.info("Stopped watching for file updates")

    def get_team_matches(self, team: str, seasons: Optional[List[str]] = None) -> pd.DataFrame:
        """Get all matches for a specific team across specified seasons"""
        matches = []
        
        # Current season
        if self.current_season is not None:
            team_matches = self.current_season[
                (self.current_season['HomeTeam'] == team) |
                (self.current_season['AwayTeam'] == team)
            ]
            matches.append(team_matches)
        
        # Historical seasons
        if seasons is None:
            seasons = list(self.historical_data.keys())
            
        for season in seasons:
            if season in self.historical_data:
                season_data = self.historical_data[season]
                team_matches = season_data[
                    (season_data['HomeTeam'] == team) |
                    (season_data['AwayTeam'] == team)
                ]
                matches.append(team_matches)
        
        return pd.concat(matches) if matches else pd.DataFrame()

    def validate_data(self, df: pd.DataFrame) -> bool:
        """
        Validate data format and required columns
        Returns True if valid, raises exception if not
        """
        required_columns = [
            'Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG',
            'HTHG', 'HTAG', 'HS', 'AS', 'HST', 'AST',
            'HF', 'AF', 'HC', 'AC', 'HY', 'AY', 'HR', 'AR'
        ]
        
        # Check for missing columns
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")

        # Validate data types
        try:
            # Convert date strings to datetime
            df['Date'] = pd.to_datetime(df['Date'], format='%d/%m/%Y')
            
            # Validate numeric columns
            numeric_columns = ['FTHG', 'FTAG', 'HTHG', 'HTAG', 'HS', 'AS', 
                             'HST', 'AST', 'HF', 'AF', 'HC', 'AC', 'HY', 'AY', 'HR', 'AR']
            
            for col in numeric_columns:
                pd.to_numeric(df[col], errors='raise')
                
            return True
        except Exception as e:
            raise ValueError(f"Data validation error: {str(e)}")

    def get_head_to_head(self, team1: str, team2: str, last_n: Optional[int] = None) -> pd.DataFrame:
        """Get head-to-head matches between two teams"""
        try:
            all_matches = []
            
            # Function to filter head-to-head matches
            def filter_h2h(df):
                return df[
                    ((df['HomeTeam'] == team1) & (df['AwayTeam'] == team2)) |
                    ((df['HomeTeam'] == team2) & (df['AwayTeam'] == team1))
                ]
            
            # Current season
            if self.current_season is not None:
                h2h_current = filter_h2h(self.current_season)
                all_matches.append(h2h_current)
            
            # Historical seasons
            for season_data in self.historical_data.values():
                h2h_season = filter_h2h(season_data)
                all_matches.append(h2h_season)
            
            h2h_matches = pd.concat(all_matches) if all_matches else pd.DataFrame()
            h2h_matches = h2h_matches.sort_values('Date', ascending=False)
            
            # Return last n matches if specified
            if last_n is not None and not h2h_matches.empty:
                return h2h_matches.head(last_n)
                
            return h2h_matches
            
        except Exception as e:
            self.logger.error(f"Error getting head-to-head data: {str(e)}")
            raise
    def get_team_form(self, team: str, last_n: int = 5) -> List[Dict]:
        """Get recent form for a team"""
        try:
            matches = []
            
            # Get team matches from current season first
            if self.current_season is not None:
                team_matches = self._get_team_form_data(self.current_season, team)
                matches.extend(team_matches)
            
            # If we need more matches, get from historical data
            if len(matches) < last_n:
                for season_data in sorted(self.historical_data.values(), 
                                        key=lambda x: x['Date'].max(), 
                                        reverse=True):
                    if len(matches) >= last_n:
                        break
                        
                    team_matches = self._get_team_form_data(season_data, team)
                    matches.extend(team_matches)
            
            # Return last n matches
            return matches[:last_n]
            
        except Exception as e:
            self.logger.error(f"Error getting team form: {str(e)}")
            raise

    def _get_team_form_data(self, df: pd.DataFrame, team: str) -> List[Dict]:
        """Helper function to process form data for a team"""
        matches = []
        # Get home and away matches
        home_matches = df[df['HomeTeam'] == team]
        away_matches = df[df['AwayTeam'] == team]
        
        # Process home matches
        for _, match in home_matches.iterrows():
            result = 'W' if match['FTHG'] > match['FTAG'] else 'D' if match['FTHG'] == match['FTAG'] else 'L'
            matches.append({
                'date': match['Date'],
                'home': True,
                'opponent': match['AwayTeam'],
                'goals_for': match['FTHG'],
                'goals_against': match['FTAG'],
                'result': result,
                'shots': match['HS'],
                'shots_target': match['HST'],
                'corners': match['HC'],
                'fouls': match['HF'],
                'yellows': match['HY'],
                'reds': match['HR']
            })
        
        # Process away matches
        for _, match in away_matches.iterrows():
            result = 'W' if match['FTAG'] > match['FTHG'] else 'D' if match['FTAG'] == match['FTHG'] else 'L'
            matches.append({
                'date': match['Date'],
                'home': False,
                'opponent': match['HomeTeam'],
                'goals_for': match['FTAG'],
                'goals_against': match['FTHG'],
                'result': result,
                'shots': match['AS'],
                'shots_target': match['AST'],
                'corners': match['AC'],
                'fouls': match['AF'],
                'yellows': match['AY'],
                'reds': match['AR']
            })
        
        # Sort by date and return
        return sorted(matches, key=lambda x: x['date'], reverse=True)
    def get_team_stats(self, team: str, season: Optional[str] = None) -> Dict:
        """Get detailed team statistics for a specific season"""
        try:
            # Use current season if none specified
            if season is None and self.current_season is not None:
                df = self.current_season
                season_name = 'current'
            elif season in self.historical_data:
                df = self.historical_data[season]
                season_name = season
            else:
                raise ValueError(f"Invalid season specified: {season}")

            # Home and Away matches
            home_matches = df[df['HomeTeam'] == team]
            away_matches = df[df['AwayTeam'] == team]

            # Calculate metrics
            metrics = {
                'team': team,
                'season': season_name,
                'overall': {
                    'matches_played': len(home_matches) + len(away_matches),
                    'wins': sum((home_matches['FTHG'] > home_matches['FTAG'])) + 
                           sum((away_matches['FTAG'] > away_matches['FTHG'])),
                    'draws': sum((home_matches['FTHG'] == home_matches['FTAG'])) + 
                            sum((away_matches['FTAG'] == away_matches['FTHG'])),
                    'losses': sum((home_matches['FTHG'] < home_matches['FTAG'])) + 
                             sum((away_matches['FTAG'] < away_matches['FTHG'])),
                    'goals_scored': home_matches['FTHG'].sum() + away_matches['FTAG'].sum(),
                    'goals_conceded': home_matches['FTAG'].sum() + away_matches['FTHG'].sum(),
                    'clean_sheets': sum((home_matches['FTAG'] == 0)) + sum((away_matches['FTHG'] == 0)),
                    'failed_to_score': sum((home_matches['FTHG'] == 0)) + sum((away_matches['FTAG'] == 0))
                }
            }

            return metrics

        except Exception as e:
            self.logger.error(f"Error calculating team stats: {str(e)}")
            raise

    def get_league_table(self, season: Optional[str] = None) -> pd.DataFrame:
        """Generate league table for specified season or current season"""
        try:
            # Use current season if none specified
            if season is None and self.current_season is not None:
                df = self.current_season
            elif season in self.historical_data:
                df = self.historical_data[season]
            else:
                raise ValueError(f"Invalid season specified: {season}")
            
            # Get unique teams
            teams = pd.concat([df['HomeTeam'], df['AwayTeam']]).unique()
            
            # Initialize table data
            table_data = []
            
            for team in teams:
                home_matches = df[df['HomeTeam'] == team]
                away_matches = df[df['AwayTeam'] == team]
                
                # Calculate statistics
                stats = {
                    'Team': team,
                    'Played': len(home_matches) + len(away_matches),
                    'Won': sum((home_matches['FTHG'] > home_matches['FTAG'])) + 
                          sum((away_matches['FTAG'] > away_matches['FTHG'])),
                    'Drawn': sum((home_matches['FTHG'] == home_matches['FTAG'])) + 
                            sum((away_matches['FTAG'] == away_matches['FTHG'])),
                    'Lost': sum((home_matches['FTHG'] < home_matches['FTAG'])) + 
                           sum((away_matches['FTAG'] < away_matches['FTHG'])),
                    'GF': home_matches['FTHG'].sum() + away_matches['FTAG'].sum(),
                    'GA': home_matches['FTAG'].sum() + away_matches['FTHG'].sum(),
                }
                
                stats['GD'] = stats['GF'] - stats['GA']
                stats['Points'] = (stats['Won'] * 3) + stats['Drawn']
                
                table_data.append(stats)
            
            # Create DataFrame and sort by points and goal difference
            table = pd.DataFrame(table_data)
            table = table.sort_values(['Points', 'GD', 'GF'], 
                                    ascending=[False, False, False])
            table = table.reset_index(drop=True)
            
            return table
            
        except Exception as e:
            self.logger.error(f"Error generating league table: {str(e)}")
            raise
            season_name = 'current'

def _calculate_venue_metrics(self, matches: pd.DataFrame, is_home: bool) -> Dict:
    """Calculate metrics for home/away matches"""
    goals_for_col = 'FTHG' if is_home else 'FTAG'
    goals_against_col = 'FTAG' if is_home else 'FTHG'
    shots_col = 'HS' if is_home else 'AS'
    shots_target_col = 'HST' if is_home else 'AST'
    corners_col = 'HC' if is_home else 'AC'
    fouls_col = 'HF' if is_home else 'AF'
    
    metrics = {
        'matches_played': len(matches),
        'wins': sum((matches[goals_for_col] > matches[goals_against_col])),
        'draws': sum((matches[goals_for_col] == matches[goals_against_col])),
        'losses': sum((matches[goals_for_col] < matches[goals_against_col])),
        'goals_scored': matches[goals_for_col].sum(),
        'goals_conceded': matches[goals_against_col].sum(),
        'clean_sheets': sum((matches[goals_against_col] == 0)),
        'failed_to_score': sum((matches[goals_for_col] == 0)),
        'shots_total': matches[shots_col].sum(),
        'shots_on_target': matches[shots_target_col].sum(),
        'corners_total': matches[corners_col].sum(),
        'fouls_total': matches[fouls_col].sum(),
        'avg_shots': matches[shots_col].mean(),
        'avg_shots_on_target': matches[shots_target_col].mean(),
        'avg_corners': matches[corners_col].mean(),
        'shot_accuracy': (matches[shots_target_col].sum() / matches[shots_col].sum() * 100) if matches[shots_col].sum() > 0 else 0,
        'shot_conversion': (matches[goals_for_col].sum() / matches[shots_target_col].sum() * 100) if matches[shots_target_col].sum() > 0 else 0
    }

    metrics['points'] = (metrics['wins'] * 3) + metrics['draws']
    metrics['win_percentage'] = (metrics['wins'] / metrics['matches_played'] * 100) if metrics['matches_played'] > 0 else 0
    metrics['goals_per_game'] = metrics['goals_scored'] / metrics['matches_played'] if metrics['matches_played'] > 0 else 0
    metrics['goals_conceded_per_game'] = metrics['goals_conceded'] / metrics['matches_played'] if metrics['matches_played'] > 0 else 0

    return metrics

def _calculate_scoring_patterns(self, home_matches: pd.DataFrame, away_matches: pd.DataFrame) -> Dict:
    """Calculate detailed scoring patterns"""
    patterns = {
        'first_half_goals': {
            'scored': home_matches['HTHG'].sum() + away_matches['HTAG'].sum(),
            'conceded': home_matches['HTAG'].sum() + away_matches['HTHG'].sum()
        },
        'second_half_goals': {
            'scored': (home_matches['FTHG'].sum() - home_matches['HTHG'].sum()) + 
                     (away_matches['FTAG'].sum() - away_matches['HTAG'].sum()),
            'conceded': (home_matches['FTAG'].sum() - home_matches['HTAG'].sum()) + 
                       (away_matches['FTHG'].sum() - away_matches['HTHG'].sum())
        }
    }

    total_matches = len(home_matches) + len(away_matches)
    if total_matches > 0:
        patterns.update({
            'avg_first_half_goals_scored': patterns['first_half_goals']['scored'] / total_matches,
            'avg_second_half_goals_scored': patterns['second_half_goals']['scored'] / total_matches,
            'first_half_scoring_rate': (sum((home_matches['HTHG'] > 0)) + sum((away_matches['HTAG'] > 0))) / total_matches * 100,
            'second_half_scoring_rate': (sum((home_matches['FTHG'] > home_matches['HTHG'])) + 
                                       sum((away_matches['FTAG'] > away_matches['HTAG']))) / total_matches * 100
        })

    return patterns

def _calculate_form_patterns(self, home_matches: pd.DataFrame, away_matches: pd.DataFrame) -> Dict:
    """Calculate form patterns and trends"""
    # Combine home and away matches
    all_matches = pd.concat([
        home_matches.assign(
            is_home=True,
            team_goals=home_matches['FTHG'],
            opp_goals=home_matches['FTAG']
        ),
        away_matches.assign(
            is_home=False,
            team_goals=away_matches['FTAG'],
            opp_goals=away_matches['FTHG']
        )
    ]).sort_values('Date')

    # Calculate results
    all_matches['result'] = np.where(
        all_matches['team_goals'] > all_matches['opp_goals'], 'W',
        np.where(all_matches['team_goals'] == all_matches['opp_goals'], 'D', 'L')
    )

    patterns = {
        'longest_win_streak': self._get_longest_streak(all_matches['result'], 'W'),
        'longest_unbeaten_streak': self._get_longest_streak(all_matches['result'], ['W', 'D']),
        'longest_scoring_streak': self._get_longest_streak(all_matches['team_goals'] > 0, True),
        'longest_clean_sheet_streak': self._get_longest_streak(all_matches['opp_goals'] == 0, True),
        'comeback_wins': len(all_matches[
            (all_matches['result'] == 'W') & 
            ((all_matches['is_home'] & (all_matches['HTAG'] > all_matches['HTHG'])) |
             (~all_matches['is_home'] & (all_matches['HTHG'] > all_matches['HTAG'])))
        ]),
        'points_from_losing_positions': self._calculate_points_from_losing_positions(all_matches)
    }

    return patterns

def _get_longest_streak(self, series, value) -> int:
    """Calculate longest streak of specified value(s)"""
    if isinstance(value, list):
        mask = series.isin(value)
    else:
        mask = series == value
        
    streak = 0
    max_streak = 0
    
    for val in mask:
        if val:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 0
            
    return max_streak

def _calculate_points_from_losing_positions(self, matches: pd.DataFrame) -> int:
    """Calculate points gained from losing positions"""
    points = 0
    
    for _, match in matches.iterrows():
        if match['is_home']:
            if match['HTAG'] > match['HTHG']:  # Losing at half time
                if match['FTHG'] > match['FTAG']:  # Won
                    points += 3
                elif match['FTHG'] == match['FTAG']:  # Drew
                    points += 1
        else:
            if match['HTHG'] > match['HTAG']:  # Losing at half time
                if match['FTAG'] > match['FTHG']:  # Won
                    points += 3
                elif match['FTAG'] == match['FTHG']:  # Drew
                    points += 1
                    
    return points

# Continue adding to data_handler.py...

def compare_seasons(self, team: str, seasons: Optional[List[str]] = None) -> Dict:
    """Compare team performance across multiple seasons"""
    try:
        # If seasons not specified, use all available seasons
        if seasons is None:
            seasons = list(self.historical_data.keys())
            if self.current_season is not None:
                seasons.append('current')

        comparison = {
            'team': team,
            'seasons': {},
            'trends': {},
            'visualization_data': {}  # For Vizzu hooks
        }

        # Collect metrics for each season
        for season in seasons:
            metrics = self.get_team_performance_metrics(team, season)
            comparison['seasons'][season] = metrics

        # Calculate trends and changes
        comparison['trends'] = self._calculate_season_trends(comparison['seasons'])
        
        # Prepare visualization data
        comparison['visualization_data'] = self._prepare_visualization_data(comparison)

        return comparison

    except Exception as e:
        self.logger.error(f"Error comparing seasons: {str(e)}")
        raise

def _calculate_season_trends(self, season_data: Dict) -> Dict:
    """Calculate trends and changes across seasons"""
    seasons = list(season_data.keys())
    if len(seasons) < 2:
        return {}

    trends = {
        'points_trend': [],
        'goals_trend': [],
        'defense_trend': [],
        'home_performance_trend': [],
        'away_performance_trend': [],
        'year_on_year_changes': {}
    }

    # Calculate season-by-season changes
    for i in range(1, len(seasons)):
        current = season_data[seasons[i]]
        previous = season_data[seasons[i-1]]
        season_changes = {
            'points_change': current['overall']['points'] - previous['overall']['points'],
            'goals_scored_change': current['overall']['goals_scored'] - previous['overall']['goals_scored'],
            'goals_conceded_change': current['overall']['goals_conceded'] - previous['overall']['goals_conceded'],
            'win_rate_change': current['overall']['win_percentage'] - previous['overall']['win_percentage'],
            'home_points_change': current['home']['points'] - previous['home']['points'],
            'away_points_change': current['away']['points'] - previous['away']['points']
        }
        trends['year_on_year_changes'][seasons[i]] = season_changes

    # Calculate rolling averages and trends
    metrics_to_track = ['points', 'goals_scored', 'goals_conceded', 'clean_sheets']
    for metric in metrics_to_track:
        values = [season_data[season]['overall'].get(metric, 0) for season in seasons]
        trends[f'{metric}_trend'] = self._calculate_trend(values)

    return trends

def _calculate_trend(self, values: List[float]) -> Dict:
    """Calculate trend analysis for a series of values"""
    if not values:
        return {}

    trend = {
        'values': values,
        'direction': 'up' if values[-1] > values[0] else 'down' if values[-1] < values[0] else 'stable',
        'change_percentage': ((values[-1] - values[0]) / values[0] * 100) if values[0] != 0 else 0,
        'average': sum(values) / len(values),
        'max': max(values),
        'min': min(values)
    }

    # Calculate volatility (standard deviation)
    if len(values) > 1:
        trend['volatility'] = np.std(values)

    return trend

def _prepare_visualization_data(self, comparison: Dict) -> Dict:
    """Prepare data structures for Vizzu visualizations"""
    viz_data = {
        'season_comparison': {
            'labels': [],
            'points': [],
            'goals_scored': [],
            'goals_conceded': [],
            'clean_sheets': [],
            'win_rate': []
        },
        'home_away_split': {
            'labels': [],
            'home_points': [],
            'away_points': [],
            'home_goals': [],
            'away_goals': []
        },
        'form_trends': {
            'labels': [],
            'win_streaks': [],
            'unbeaten_streaks': [],
            'scoring_streaks': []
        }
    }

    # Populate visualization data
    for season, data in comparison['seasons'].items():
        # Season comparison data
        viz_data['season_comparison']['labels'].append(season)
        viz_data['season_comparison']['points'].append(data['overall']['points'])
        viz_data['season_comparison']['goals_scored'].append(data['overall']['goals_scored'])
        viz_data['season_comparison']['goals_conceded'].append(data['overall']['goals_conceded'])
        viz_data['season_comparison']['clean_sheets'].append(data['overall']['clean_sheets'])
        viz_data['season_comparison']['win_rate'].append(data['overall']['win_percentage'])

        # Home/Away split data
        viz_data['home_away_split']['labels'].append(season)
        viz_data['home_away_split']['home_points'].append(data['home']['points'])
        viz_data['home_away_split']['away_points'].append(data['away']['points'])
        viz_data['home_away_split']['home_goals'].append(data['home']['goals_scored'])
        viz_data['home_away_split']['away_goals'].append(data['away']['goals_scored'])

        # Form trends data
        viz_data['form_trends']['labels'].append(season)
        viz_data['form_trends']['win_streaks'].append(data['form_patterns']['longest_win_streak'])
        viz_data['form_trends']['unbeaten_streaks'].append(data['form_patterns']['longest_unbeaten_streak'])
        viz_data['form_trends']['scoring_streaks'].append(data['form_patterns']['longest_scoring_streak'])

    return viz_data

def get_visualization_data(self, data_type: str, team: str, seasons: Optional[List[str]] = None) -> Dict:
    """Get specific visualization data for Vizzu charts"""
    comparison = self.compare_seasons(team, seasons)
    
    if data_type not in comparison['visualization_data']:
        raise ValueError(f"Invalid visualization data type: {data_type}")
        
    return comparison['visualization_data'][data_type]

def get_scoring_distribution(self, team: str, season: Optional[str] = None) -> Dict:
    """Get scoring distribution data for visualizations"""
    try:
        df = self.current_season if season is None else self.historical_data[season]
        
        home_matches = df[df['HomeTeam'] == team]
        away_matches = df[df['AwayTeam'] == team]

        distribution = {
            'minute_ranges': {
                '0-15': {'scored': 0, 'conceded': 0},
                '16-30': {'scored': 0, 'conceded': 0},
                '31-45': {'scored': 0, 'conceded': 0},
                '46-60': {'scored': 0, 'conceded': 0},
                '61-75': {'scored': 0, 'conceded': 0},
                '76-90': {'scored': 0, 'conceded': 0}
            },
            'visualization_data': {
                'labels': [],
                'goals_scored': [],
                'goals_conceded': []
            }
        }

        # Calculate goals in each period (This is simplified as we don't have exact minute data)
        # You would need to modify this based on your actual data structure
        first_half_goals = {
            'scored': home_matches['HTHG'].sum() + away_matches['HTAG'].sum(),
            'conceded': home_matches['HTAG'].sum() + away_matches['HTHG'].sum()
        }
        
        second_half_goals = {
            'scored': (home_matches['FTHG'].sum() - home_matches['HTHG'].sum()) + 
                     (away_matches['FTAG'].sum() - away_matches['HTAG'].sum()),
            'conceded': (home_matches['FTAG'].sum() - home_matches['HTAG'].sum()) + 
                       (away_matches['FTHG'].sum() - away_matches['HTHG'].sum())
        }

        # Prepare visualization data
        for period in distribution['minute_ranges'].keys():
            distribution['visualization_data']['labels'].append(period)
            # This is an approximation - you'd need real minute-by-minute data for accuracy
            if period in ['0-15', '16-30', '31-45']:
                goals_scored = first_half_goals['scored'] / 3
                goals_conceded = first_half_goals['conceded'] / 3
            else:
                goals_scored = second_half_goals['scored'] / 3
                goals_conceded = second_half_goals['conceded'] / 3
                
            distribution['visualization_data']['goals_scored'].append(round(goals_scored, 2))
            distribution['visualization_data']['goals_conceded'].append(round(goals_conceded, 2))

        return distribution

    except Exception as e:
        self.logger.error(f"Error getting scoring distribution: {str(e)}")
        raise