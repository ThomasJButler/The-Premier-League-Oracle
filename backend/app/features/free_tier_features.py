"""
Free-tier feature engineering for Premier League match prediction.

Computes ~86 features from match data available on the Football-Data.org
free API tier + historical CSV data. No stubs — every feature computes
a real value from the data (0.0 only when insufficient history exists).

Standalone class, fully decoupled from AdvancedFeatureEngineer.
The 150-feature Pro-tier pipeline (advanced_engineering.py) is kept
separate for future paid API integration.

Data sources:
    - Match results (goals, half-time, result) — free API + CSVs
    - Match stats (shots, corners, cards, fouls) — CSVs only
    - Standings and dates — free API + CSVs
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Team name normalisation: CSV short names <-> Football-Data.org API names
# ---------------------------------------------------------------------------

CSV_TO_API: Dict[str, str] = {
    'Arsenal': 'Arsenal FC',
    'Aston Villa': 'Aston Villa FC',
    'Bournemouth': 'AFC Bournemouth',
    'Brentford': 'Brentford FC',
    'Brighton': 'Brighton and Hove Albion FC',
    'Burnley': 'Burnley FC',
    'Chelsea': 'Chelsea FC',
    'Crystal Palace': 'Crystal Palace FC',
    'Everton': 'Everton FC',
    'Fulham': 'Fulham FC',
    'Ipswich': 'Ipswich Town FC',
    'Leeds': 'Leeds United FC',
    'Leicester': 'Leicester City FC',
    'Liverpool': 'Liverpool FC',
    'Luton': 'Luton Town FC',
    'Man City': 'Manchester City FC',
    'Man United': 'Manchester United FC',
    'Newcastle': 'Newcastle United FC',
    'Norwich': 'Norwich City FC',
    "Nott'm Forest": 'Nottingham Forest FC',
    'Sheffield United': 'Sheffield United FC',
    'Southampton': 'Southampton FC',
    'Sunderland': 'Sunderland AFC',
    'Tottenham': 'Tottenham Hotspur FC',
    'Watford': 'Watford FC',
    'West Brom': 'West Bromwich Albion FC',
    'West Ham': 'West Ham United FC',
    'Wolves': 'Wolverhampton Wanderers FC',
}

API_TO_CSV: Dict[str, str] = {v: k for k, v in CSV_TO_API.items()}

# Additional aliases for flexible lookup
_ALIASES: Dict[str, str] = {
    'Manchester City': 'Man City',
    'Manchester United': 'Man United',
    'Nottingham Forest': "Nott'm Forest",
    'Wolverhampton Wanderers': 'Wolves',
    'Brighton and Hove Albion': 'Brighton',
    'AFC Bournemouth': 'Bournemouth',
    'Newcastle United': 'Newcastle',
    'Tottenham Hotspur': 'Tottenham',
    'Leicester City': 'Leicester',
    'Leeds United': 'Leeds',
    'Sheffield United': 'Sheffield United',
    'West Ham United': 'West Ham',
    'West Bromwich Albion': 'West Brom',
    'Ipswich Town': 'Ipswich',
    'Luton Town': 'Luton',
    'Norwich City': 'Norwich',
}

# Known Premier League derbies (CSV short names)
DERBIES = {
    frozenset({'Arsenal', 'Tottenham'}),
    frozenset({'Man United', 'Man City'}),
    frozenset({'Man United', 'Liverpool'}),
    frozenset({'Liverpool', 'Everton'}),
    frozenset({'Chelsea', 'Tottenham'}),
    frozenset({'Arsenal', 'Chelsea'}),
    frozenset({'Crystal Palace', 'Brighton'}),
    frozenset({'Newcastle', 'Sunderland'}),
    frozenset({'Aston Villa', 'Wolves'}),
    frozenset({'West Ham', 'Tottenham'}),
}


class FreeTierFeatureEngineer:
    """
    Compute ~86 match prediction features from free-tier data.

    All features use only data strictly before the match date (no leakage).
    Designed for both CSV training and live API prediction.

    Required DataFrame columns (normalised names):
        date, home_team, away_team, home_goals, away_goals, result,
        half_time_home_goals, half_time_away_goals, half_time_result,
        home_shots, away_shots, home_shots_target, away_shots_target,
        home_corners, away_corners, home_yellows, away_yellows,
        home_reds, away_reds, home_fouls, away_fouls

    Match stats columns (shots, corners, etc.) are optional — features
    degrade gracefully to 0.0 when missing.
    """

    FEATURE_NAMES: List[str] = [
        # Basic stats (12)
        'home_goals_scored_avg', 'home_goals_conceded_avg',
        'away_goals_scored_avg', 'away_goals_conceded_avg',
        'home_points_per_game', 'away_points_per_game',
        'home_win_rate', 'away_win_rate',
        'home_clean_sheet_rate', 'away_clean_sheet_rate',
        'home_home_win_rate', 'away_away_win_rate',
        # Form & momentum (20)
        'home_form_last_5', 'home_form_last_10',
        'away_form_last_5', 'away_form_last_10',
        'home_weighted_form', 'away_weighted_form',
        'home_momentum', 'away_momentum',
        'home_win_streak', 'away_win_streak',
        'home_unbeaten_streak', 'away_unbeaten_streak',
        'home_scoring_form', 'away_scoring_form',
        'home_defensive_form', 'away_defensive_form',
        'home_form_volatility', 'away_form_volatility',
        'home_bounce_back_rate', 'away_bounce_back_rate',
        # H2H (15)
        'h2h_total_matches', 'h2h_home_wins', 'h2h_draws', 'h2h_away_wins',
        'h2h_home_win_rate', 'h2h_home_goals_avg', 'h2h_away_goals_avg',
        'h2h_total_goals_avg', 'h2h_btts_rate', 'h2h_over_2_5_rate',
        'h2h_home_form_last_3', 'h2h_home_clean_sheet_rate',
        'h2h_dominance', 'h2h_goals_diff_avg', 'h2h_venue_advantage',
        # Contextual (12)
        'home_rest_days', 'away_rest_days', 'rest_day_advantage',
        'is_derby', 'home_fixture_congestion', 'away_fixture_congestion',
        'season_progress', 'home_position', 'away_position',
        'position_difference', 'is_six_pointer', 'home_goal_difference',
        # Time series (9)
        'home_trend_short', 'home_trend_long',
        'away_trend_short', 'away_trend_long',
        'home_consistency', 'away_consistency',
        'home_monthly_performance', 'away_monthly_performance',
        'home_mean_reversion',
        # Derived (5)
        'over_2_5_probability', 'btts_probability',
        'home_goal_conversion_rate', 'away_goal_conversion_rate',
        'home_defensive_efficiency',
        # Half-time (5)
        'home_ht_goals_scored_avg', 'away_ht_goals_scored_avg',
        'home_ht_goals_conceded_avg', 'away_ht_goals_conceded_avg',
        'ht_form_home',
        # Match stats (8)
        'home_shots_avg', 'away_shots_avg',
        'home_shots_on_target_avg', 'away_shots_on_target_avg',
        'home_corners_avg', 'away_corners_avg',
        'home_yellows_avg', 'away_yellows_avg',
    ]

    def __init__(self, data: pd.DataFrame):
        """
        Args:
            data: Historical match DataFrame with normalised column names.
                  Must be sorted chronologically (oldest first).
        """
        self.data = data.copy()
        if not pd.api.types.is_datetime64_any_dtype(self.data['date']):
            self.data['date'] = pd.to_datetime(self.data['date'], dayfirst=True)
        self.data = self.data.sort_values('date').reset_index(drop=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create_features(
        self,
        home_team: str,
        away_team: str,
        match_date: Optional[datetime] = None,
    ) -> Dict[str, float]:
        """
        Compute all ~86 features for a match prediction.

        Only data strictly before *match_date* is used (no leakage).
        Returns a dict keyed by FEATURE_NAMES with float values.
        """
        if match_date is not None:
            if isinstance(match_date, pd.Timestamp):
                match_date = match_date.to_pydatetime()
            pre_match = self.data[self.data['date'] < pd.Timestamp(match_date)]
        else:
            pre_match = self.data

        features: Dict[str, float] = {}
        features.update(self._basic_stats(home_team, away_team, pre_match))
        features.update(self._form_momentum(home_team, away_team, pre_match))
        features.update(self._head_to_head(home_team, away_team, pre_match))
        features.update(self._contextual(home_team, away_team, pre_match, match_date))
        features.update(self._time_series(home_team, away_team, pre_match))
        features.update(self._derived(home_team, away_team, pre_match))
        features.update(self._half_time(home_team, away_team, pre_match))
        features.update(self._match_stats(home_team, away_team, pre_match))

        # Ensure every feature present; replace NaN with 0.0
        result: Dict[str, float] = {}
        for name in self.FEATURE_NAMES:
            val = features.get(name, 0.0)
            result[name] = 0.0 if (val is None or np.isnan(val)) else float(val)
        return result

    @staticmethod
    def normalize_team_name(name: str, to: str = 'csv') -> str:
        """
        Convert a team name between formats.

        Args:
            name: Input team name (any format).
            to: Target format — 'csv' for short names, 'api' for canonical.

        Returns:
            Normalised name, or the input unchanged if no mapping found.
        """
        stripped = name.strip()

        if to == 'csv':
            # Already a CSV name?
            if stripped in CSV_TO_API:
                return stripped
            # API canonical name?
            if stripped in API_TO_CSV:
                return API_TO_CSV[stripped]
            # Alias?
            if stripped in _ALIASES:
                return _ALIASES[stripped]
            # Strip common suffixes (FC, AFC, CF)
            for suffix in (' FC', ' AFC', ' CF'):
                if stripped.endswith(suffix):
                    return FreeTierFeatureEngineer.normalize_team_name(
                        stripped[:-len(suffix)], to='csv'
                    )
            return stripped

        if to == 'api':
            csv_name = FreeTierFeatureEngineer.normalize_team_name(stripped, to='csv')
            return CSV_TO_API.get(csv_name, stripped)

        return stripped

    @staticmethod
    def load_csvs(csv_dir: str) -> pd.DataFrame:
        """
        Load and normalise all EPL CSV files from a directory.

        Returns a single DataFrame with standardised column names,
        sorted chronologically.
        """
        import glob
        import os

        files = sorted(glob.glob(os.path.join(csv_dir, 'EPL*.csv')))
        if not files:
            raise FileNotFoundError(f'No EPL*.csv files found in {csv_dir}')

        frames: List[pd.DataFrame] = []
        for f in files:
            df = pd.read_csv(f, encoding='utf-8-sig')
            # Extract season from filename (e.g. EPL20202021 -> 2020/21)
            basename = os.path.basename(f).replace('.csv', '')
            digits = ''.join(c for c in basename if c.isdigit())
            if len(digits) >= 8:
                df['season'] = f'{digits[:4]}/{digits[6:8]}'
            else:
                df['season'] = 'unknown'
            frames.append(df)

        combined = pd.concat(frames, ignore_index=True)

        # Rename columns to normalised names
        rename_map = {
            'Date': 'date',
            'HomeTeam': 'home_team',
            'AwayTeam': 'away_team',
            'FTHG': 'home_goals',
            'FTAG': 'away_goals',
            'FTR': 'result',
            'HTHG': 'half_time_home_goals',
            'HTAG': 'half_time_away_goals',
            'HTR': 'half_time_result',
            'HS': 'home_shots',
            'AS': 'away_shots',
            'HST': 'home_shots_target',
            'AST': 'away_shots_target',
            'HC': 'home_corners',
            'AC': 'away_corners',
            'HY': 'home_yellows',
            'AY': 'away_yellows',
            'HR': 'home_reds',
            'AR': 'away_reds',
            'HF': 'home_fouls',
            'AF': 'away_fouls',
            'Referee': 'referee',
        }
        combined.rename(columns=rename_map, inplace=True)

        # Parse dates
        combined['date'] = pd.to_datetime(combined['date'], dayfirst=True)
        combined = combined.sort_values('date').reset_index(drop=True)

        # Convert numeric columns
        numeric_cols = [
            'home_goals', 'away_goals',
            'half_time_home_goals', 'half_time_away_goals',
            'home_shots', 'away_shots', 'home_shots_target', 'away_shots_target',
            'home_corners', 'away_corners',
            'home_yellows', 'away_yellows', 'home_reds', 'away_reds',
            'home_fouls', 'away_fouls',
        ]
        for col in numeric_cols:
            if col in combined.columns:
                combined[col] = pd.to_numeric(combined[col], errors='coerce')

        logger.info(
            'Loaded %d matches from %d CSV files (%s)',
            len(combined), len(files),
            ', '.join(combined['season'].unique()),
        )
        return combined

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_team_matches(
        self, team: str, data: pd.DataFrame, venue: str = 'all',
    ) -> pd.DataFrame:
        """
        Get matches for *team* with results normalised to W/D/L.

        Adds columns: team_goals, opponent_goals, team_result, is_home.
        """
        home = data[data['home_team'] == team].copy()
        if not home.empty:
            home['team_goals'] = home['home_goals']
            home['opponent_goals'] = home['away_goals']
            home['team_result'] = home['result'].map({'H': 'W', 'D': 'D', 'A': 'L'})
            home['is_home'] = True

        away = data[data['away_team'] == team].copy()
        if not away.empty:
            away['team_goals'] = away['away_goals']
            away['opponent_goals'] = away['home_goals']
            away['team_result'] = away['result'].map({'H': 'L', 'D': 'D', 'A': 'W'})
            away['is_home'] = False

        if venue == 'home':
            result = home.sort_values('date') if not home.empty else home
        elif venue == 'away':
            result = away.sort_values('date') if not away.empty else away
        else:
            both = pd.concat([home, away])
            result = both.sort_values('date') if not both.empty else both

        # Ensure synthetic columns exist even on empty DataFrames,
        # so downstream code can safely access them without KeyError.
        for col in ('team_goals', 'opponent_goals', 'team_result', 'is_home'):
            if col not in result.columns:
                result[col] = pd.Series(dtype='object')

        return result

    def _get_h2h_matches(self, home_team: str, away_team: str,
                         data: pd.DataFrame) -> pd.DataFrame:
        """Get head-to-head matches between two teams."""
        mask = (
            ((data['home_team'] == home_team) & (data['away_team'] == away_team)) |
            ((data['home_team'] == away_team) & (data['away_team'] == home_team))
        )
        return data[mask].sort_values('date')

    @staticmethod
    def _result_to_points(result: str) -> int:
        return {'W': 3, 'D': 1, 'L': 0}.get(result, 0)

    @staticmethod
    def _form_last_n(matches: pd.DataFrame, n: int) -> float:
        """Average points per game over last n matches (0–3 scale)."""
        recent = matches.tail(n)
        if recent.empty:
            return 0.0
        points = recent['team_result'].map({'W': 3, 'D': 1, 'L': 0})
        return float(points.mean())

    @staticmethod
    def _weighted_form(matches: pd.DataFrame, n: int = 10,
                       decay: float = 0.85) -> float:
        """Exponentially-weighted form over last n matches."""
        recent = matches.tail(n)
        if recent.empty:
            return 0.0
        points = recent['team_result'].map({'W': 3, 'D': 1, 'L': 0}).values
        weights = np.array([decay ** i for i in range(len(points) - 1, -1, -1)])
        return float(np.average(points, weights=weights))

    @staticmethod
    def _count_streak(matches: pd.DataFrame, condition: str) -> int:
        """
        Count consecutive matches from the most recent satisfying condition.

        condition: 'W' for win streak, 'unbeaten' for W or D streak.
        """
        if matches.empty:
            return 0
        results = matches['team_result'].values[::-1]  # most recent first
        streak = 0
        for r in results:
            if condition == 'W' and r == 'W':
                streak += 1
            elif condition == 'unbeaten' and r in ('W', 'D'):
                streak += 1
            else:
                break
        return streak

    def _get_season_start(self, match_date: Optional[datetime]) -> datetime:
        """PL season starts in August."""
        if match_date is None:
            return datetime(2020, 8, 1)
        if match_date.month >= 8:
            return datetime(match_date.year, 8, 1)
        return datetime(match_date.year - 1, 8, 1)

    def _compute_standings(self, data: pd.DataFrame,
                           match_date: Optional[datetime] = None,
                           ) -> Dict[str, Dict]:
        """
        Compute league table from current-season data before match_date.

        Returns {team: {points, gd, played, position}}.
        """
        season_start = self._get_season_start(match_date)
        season_data = data[data['date'] >= pd.Timestamp(season_start)]

        teams: Dict[str, Dict] = {}
        for _, row in season_data.iterrows():
            ht = row['home_team']
            at = row['away_team']
            hg = int(row['home_goals']) if pd.notna(row['home_goals']) else 0
            ag = int(row['away_goals']) if pd.notna(row['away_goals']) else 0

            for t in (ht, at):
                if t not in teams:
                    teams[t] = {'points': 0, 'gd': 0, 'played': 0, 'gf': 0}

            teams[ht]['played'] += 1
            teams[at]['played'] += 1
            teams[ht]['gf'] += hg
            teams[at]['gf'] += ag
            teams[ht]['gd'] += hg - ag
            teams[at]['gd'] += ag - hg

            if row['result'] == 'H':
                teams[ht]['points'] += 3
            elif row['result'] == 'A':
                teams[at]['points'] += 3
            else:
                teams[ht]['points'] += 1
                teams[at]['points'] += 1

        # Assign positions by (points desc, gd desc, gf desc)
        sorted_teams = sorted(
            teams.keys(),
            key=lambda t: (teams[t]['points'], teams[t]['gd'], teams[t]['gf']),
            reverse=True,
        )
        for pos, t in enumerate(sorted_teams, 1):
            teams[t]['position'] = pos

        return teams

    # ------------------------------------------------------------------
    # Feature categories
    # ------------------------------------------------------------------

    def _basic_stats(self, home_team: str, away_team: str,
                     data: pd.DataFrame) -> Dict[str, float]:
        """12 features: goals, points, win rates, clean sheets, venue splits."""
        f: Dict[str, float] = {}

        hm = self._get_team_matches(home_team, data)
        am = self._get_team_matches(away_team, data)
        hh = self._get_team_matches(home_team, data, 'home')
        aa = self._get_team_matches(away_team, data, 'away')

        f['home_goals_scored_avg'] = float(hm['team_goals'].mean()) if len(hm) else 0.0
        f['home_goals_conceded_avg'] = float(hm['opponent_goals'].mean()) if len(hm) else 0.0
        f['away_goals_scored_avg'] = float(am['team_goals'].mean()) if len(am) else 0.0
        f['away_goals_conceded_avg'] = float(am['opponent_goals'].mean()) if len(am) else 0.0

        f['home_points_per_game'] = float(
            hm['team_result'].map(self._result_to_points).mean()
        ) if len(hm) else 0.0
        f['away_points_per_game'] = float(
            am['team_result'].map(self._result_to_points).mean()
        ) if len(am) else 0.0

        f['home_win_rate'] = float((hm['team_result'] == 'W').mean()) if len(hm) else 0.0
        f['away_win_rate'] = float((am['team_result'] == 'W').mean()) if len(am) else 0.0

        f['home_clean_sheet_rate'] = float((hm['opponent_goals'] == 0).mean()) if len(hm) else 0.0
        f['away_clean_sheet_rate'] = float((am['opponent_goals'] == 0).mean()) if len(am) else 0.0

        f['home_home_win_rate'] = float((hh['team_result'] == 'W').mean()) if len(hh) else 0.0
        f['away_away_win_rate'] = float((aa['team_result'] == 'W').mean()) if len(aa) else 0.0

        return f

    def _form_momentum(self, home_team: str, away_team: str,
                       data: pd.DataFrame) -> Dict[str, float]:
        """20 features: recent form, weighted form, momentum, streaks, volatility."""
        f: Dict[str, float] = {}

        hm = self._get_team_matches(home_team, data)
        am = self._get_team_matches(away_team, data)

        # Recent form (points per game, 0–3 scale)
        f['home_form_last_5'] = self._form_last_n(hm, 5)
        f['home_form_last_10'] = self._form_last_n(hm, 10)
        f['away_form_last_5'] = self._form_last_n(am, 5)
        f['away_form_last_10'] = self._form_last_n(am, 10)

        # Exponentially-weighted form (most recent = highest weight)
        f['home_weighted_form'] = self._weighted_form(hm, 10)
        f['away_weighted_form'] = self._weighted_form(am, 10)

        # Momentum = short-term form minus long-term form
        f['home_momentum'] = f['home_form_last_5'] - f['home_form_last_10']
        f['away_momentum'] = f['away_form_last_5'] - f['away_form_last_10']

        # Win streaks
        f['home_win_streak'] = float(self._count_streak(hm, 'W'))
        f['away_win_streak'] = float(self._count_streak(am, 'W'))
        f['home_unbeaten_streak'] = float(self._count_streak(hm, 'unbeaten'))
        f['away_unbeaten_streak'] = float(self._count_streak(am, 'unbeaten'))

        # Scoring and defensive form (last 5 matches)
        h5 = hm.tail(5)
        a5 = am.tail(5)
        f['home_scoring_form'] = float(h5['team_goals'].mean()) if len(h5) else 0.0
        f['away_scoring_form'] = float(a5['team_goals'].mean()) if len(a5) else 0.0
        f['home_defensive_form'] = float(h5['opponent_goals'].mean()) if len(h5) else 0.0
        f['away_defensive_form'] = float(a5['opponent_goals'].mean()) if len(a5) else 0.0

        # Form volatility: std of points over last 10 matches
        def _volatility(matches: pd.DataFrame, n: int = 10) -> float:
            recent = matches.tail(n)
            if len(recent) < 3:
                return 0.0
            pts = recent['team_result'].map({'W': 3, 'D': 1, 'L': 0})
            return float(pts.std())

        f['home_form_volatility'] = _volatility(hm)
        f['away_form_volatility'] = _volatility(am)

        # Bounce-back rate: proportion of wins after a loss
        def _bounce_back(matches: pd.DataFrame) -> float:
            results = matches['team_result'].values
            losses = 0
            bounces = 0
            for i in range(len(results) - 1):
                if results[i] == 'L':
                    losses += 1
                    if results[i + 1] == 'W':
                        bounces += 1
            return bounces / losses if losses > 0 else 0.0

        f['home_bounce_back_rate'] = _bounce_back(hm)
        f['away_bounce_back_rate'] = _bounce_back(am)

        return f

    def _head_to_head(self, home_team: str, away_team: str,
                      data: pd.DataFrame) -> Dict[str, float]:
        """15 features: H2H record, goals, BTTS, recent form, dominance."""
        f: Dict[str, float] = {}

        h2h = self._get_h2h_matches(home_team, away_team, data)
        n = len(h2h)
        f['h2h_total_matches'] = float(n)

        if n == 0:
            for key in self.FEATURE_NAMES:
                if key.startswith('h2h_') and key != 'h2h_total_matches':
                    f[key] = 0.0
            return f

        # Count results from home_team's perspective
        home_wins = 0
        away_wins = 0
        draws = 0
        home_goals_total = 0.0
        away_goals_total = 0.0
        btts_count = 0
        over_2_5_count = 0

        for _, row in h2h.iterrows():
            hg = float(row['home_goals'])
            ag = float(row['away_goals'])
            total_goals = hg + ag

            if row['home_team'] == home_team:
                # home_team was at home in this H2H match
                home_goals_total += hg
                away_goals_total += ag
                if row['result'] == 'H':
                    home_wins += 1
                elif row['result'] == 'A':
                    away_wins += 1
                else:
                    draws += 1
            else:
                # home_team was away in this H2H match
                home_goals_total += ag
                away_goals_total += hg
                if row['result'] == 'A':
                    home_wins += 1
                elif row['result'] == 'H':
                    away_wins += 1
                else:
                    draws += 1

            if hg > 0 and ag > 0:
                btts_count += 1
            if total_goals > 2.5:
                over_2_5_count += 1

        f['h2h_home_wins'] = float(home_wins)
        f['h2h_draws'] = float(draws)
        f['h2h_away_wins'] = float(away_wins)
        f['h2h_home_win_rate'] = home_wins / n
        f['h2h_home_goals_avg'] = home_goals_total / n
        f['h2h_away_goals_avg'] = away_goals_total / n
        f['h2h_total_goals_avg'] = (home_goals_total + away_goals_total) / n
        f['h2h_btts_rate'] = btts_count / n
        f['h2h_over_2_5_rate'] = over_2_5_count / n

        # Recent H2H form (last 3 meetings, from home_team's perspective)
        recent_h2h = h2h.tail(3)
        recent_pts = 0.0
        for _, row in recent_h2h.iterrows():
            if row['home_team'] == home_team:
                if row['result'] == 'H':
                    recent_pts += 3
                elif row['result'] == 'D':
                    recent_pts += 1
            else:
                if row['result'] == 'A':
                    recent_pts += 3
                elif row['result'] == 'D':
                    recent_pts += 1
        f['h2h_home_form_last_3'] = recent_pts / max(len(recent_h2h), 1)

        # Clean sheet rate in H2H (home_team keeping clean sheets)
        cs_count = 0
        for _, row in h2h.iterrows():
            if row['home_team'] == home_team and row['away_goals'] == 0:
                cs_count += 1
            elif row['away_team'] == home_team and row['home_goals'] == 0:
                cs_count += 1
        f['h2h_home_clean_sheet_rate'] = cs_count / n

        # Dominance: home win rate minus away win rate
        f['h2h_dominance'] = (home_wins - away_wins) / n

        # Average goal difference from home_team's perspective
        f['h2h_goals_diff_avg'] = (home_goals_total - away_goals_total) / n

        # Venue advantage: home_team's win rate when hosting this opponent
        venue_h2h = h2h[h2h['home_team'] == home_team]
        if len(venue_h2h) > 0:
            f['h2h_venue_advantage'] = float(
                (venue_h2h['result'] == 'H').mean()
            )
        else:
            f['h2h_venue_advantage'] = 0.0

        return f

    def _contextual(self, home_team: str, away_team: str,
                    data: pd.DataFrame,
                    match_date: Optional[datetime]) -> Dict[str, float]:
        """12 features: rest days, derby, congestion, position, season progress."""
        f: Dict[str, float] = {}

        # Rest days since last match
        def _rest_days(team: str) -> float:
            tm = self._get_team_matches(team, data)
            if tm.empty or match_date is None:
                return 7.0  # default assumption: one week
            last_date = tm['date'].max()
            if isinstance(last_date, pd.Timestamp):
                last_date = last_date.to_pydatetime()
            md = match_date if isinstance(match_date, datetime) else datetime.now()
            delta = (md - last_date).days
            return max(float(delta), 0.0)

        f['home_rest_days'] = _rest_days(home_team)
        f['away_rest_days'] = _rest_days(away_team)
        f['rest_day_advantage'] = f['home_rest_days'] - f['away_rest_days']

        # Derby
        csv_home = self.normalize_team_name(home_team, 'csv')
        csv_away = self.normalize_team_name(away_team, 'csv')
        f['is_derby'] = 1.0 if frozenset({csv_home, csv_away}) in DERBIES else 0.0

        # Fixture congestion: matches in last 14 days
        def _congestion(team: str) -> float:
            if match_date is None:
                return 0.0
            cutoff = pd.Timestamp(match_date) - pd.Timedelta(days=14)
            tm = self._get_team_matches(team, data)
            return float(len(tm[tm['date'] >= cutoff]))

        f['home_fixture_congestion'] = _congestion(home_team)
        f['away_fixture_congestion'] = _congestion(away_team)

        # Season progress (0.0 = start, 1.0 = end)
        if match_date is not None:
            season_start = self._get_season_start(match_date)
            season_end = datetime(season_start.year + 1, 5, 31)
            total_days = (season_end - season_start).days
            elapsed = (match_date - season_start).days
            f['season_progress'] = min(max(elapsed / total_days, 0.0), 1.0)
        else:
            f['season_progress'] = 0.5

        # League positions from current season
        standings = self._compute_standings(data, match_date)
        h_pos = standings.get(home_team, {}).get('position', 10.0)
        a_pos = standings.get(away_team, {}).get('position', 10.0)
        f['home_position'] = float(h_pos)
        f['away_position'] = float(a_pos)
        f['position_difference'] = float(h_pos - a_pos)

        # Six-pointer: both teams within 3 positions of each other
        f['is_six_pointer'] = 1.0 if abs(h_pos - a_pos) <= 3 else 0.0

        # Home team goal difference
        h_gd = standings.get(home_team, {}).get('gd', 0)
        f['home_goal_difference'] = float(h_gd)

        return f

    def _time_series(self, home_team: str, away_team: str,
                     data: pd.DataFrame) -> Dict[str, float]:
        """9 features: trends, consistency, monthly performance, mean reversion."""
        f: Dict[str, float] = {}

        def _trend(matches: pd.DataFrame, window: int) -> float:
            """Linear regression slope of points over last *window* matches."""
            recent = matches.tail(window)
            if len(recent) < 3:
                return 0.0
            pts = recent['team_result'].map({'W': 3, 'D': 1, 'L': 0}).values.astype(float)
            x = np.arange(len(pts), dtype=float)
            try:
                slope, _ = np.polyfit(x, pts, 1)
                return float(slope)
            except (np.linalg.LinAlgError, ValueError):
                return 0.0

        hm = self._get_team_matches(home_team, data)
        am = self._get_team_matches(away_team, data)

        f['home_trend_short'] = _trend(hm, 5)
        f['home_trend_long'] = _trend(hm, 15)
        f['away_trend_short'] = _trend(am, 5)
        f['away_trend_long'] = _trend(am, 15)

        # Consistency: std of points per game (lower = more consistent)
        def _consistency(matches: pd.DataFrame, n: int = 15) -> float:
            recent = matches.tail(n)
            if len(recent) < 3:
                return 0.0
            pts = recent['team_result'].map({'W': 3, 'D': 1, 'L': 0})
            return float(pts.std())

        f['home_consistency'] = _consistency(hm)
        f['away_consistency'] = _consistency(am)

        # Monthly performance: average PPG in this calendar month (historical)
        def _monthly_perf(matches: pd.DataFrame, month: Optional[int]) -> float:
            if month is None or matches.empty:
                return 0.0
            month_matches = matches[matches['date'].dt.month == month]
            if month_matches.empty:
                return 0.0
            pts = month_matches['team_result'].map({'W': 3, 'D': 1, 'L': 0})
            return float(pts.mean())

        current_month = None
        if not data.empty:
            current_month = data['date'].max().month
        f['home_monthly_performance'] = _monthly_perf(hm, current_month)
        f['away_monthly_performance'] = _monthly_perf(am, current_month)

        # Mean reversion: distance from long-term average
        def _mean_reversion(matches: pd.DataFrame) -> float:
            if len(matches) < 10:
                return 0.0
            pts = matches['team_result'].map({'W': 3, 'D': 1, 'L': 0})
            long_avg = pts.mean()
            recent_avg = pts.tail(5).mean()
            return float(long_avg - recent_avg)

        f['home_mean_reversion'] = _mean_reversion(hm)

        return f

    def _derived(self, home_team: str, away_team: str,
                 data: pd.DataFrame) -> Dict[str, float]:
        """5 features: over 2.5 prob, BTTS prob, goal conversion, def efficiency."""
        f: Dict[str, float] = {}

        hm = self._get_team_matches(home_team, data)
        am = self._get_team_matches(away_team, data)

        # Over 2.5 goals probability (from recent matches)
        def _over_2_5_rate(matches: pd.DataFrame, n: int = 10) -> float:
            recent = matches.tail(n)
            if recent.empty:
                return 0.0
            total_goals = recent['team_goals'] + recent['opponent_goals']
            return float((total_goals > 2.5).mean())

        home_rate = _over_2_5_rate(hm)
        away_rate = _over_2_5_rate(am)
        f['over_2_5_probability'] = (home_rate + away_rate) / 2.0

        # BTTS probability
        def _btts_rate(matches: pd.DataFrame, n: int = 10) -> float:
            recent = matches.tail(n)
            if recent.empty:
                return 0.0
            btts = (recent['team_goals'] > 0) & (recent['opponent_goals'] > 0)
            return float(btts.mean())

        home_btts = _btts_rate(hm)
        away_btts = _btts_rate(am)
        f['btts_probability'] = (home_btts + away_btts) / 2.0

        # Goal conversion rate (goals / shots, or goals / matches if no shots)
        def _conversion(team: str) -> float:
            tm = self._get_team_matches(team, data).tail(10)
            if tm.empty:
                return 0.0
            goals = tm['team_goals'].sum()
            if 'home_shots' in data.columns:
                # Sum shots (need to map correctly based on home/away)
                shots = 0.0
                for _, row in tm.iterrows():
                    if row.get('is_home', False) and pd.notna(row.get('home_shots')):
                        shots += row['home_shots']
                    elif not row.get('is_home', True) and pd.notna(row.get('away_shots')):
                        shots += row['away_shots']
                if shots > 0:
                    return float(goals / shots)
            # Fallback: goals per match
            return float(goals / len(tm))

        f['home_goal_conversion_rate'] = _conversion(home_team)
        f['away_goal_conversion_rate'] = _conversion(away_team)

        # Defensive efficiency (clean sheet rate, last 10)
        h10 = hm.tail(10)
        f['home_defensive_efficiency'] = float(
            (h10['opponent_goals'] == 0).mean()
        ) if len(h10) else 0.0

        return f

    def _half_time(self, home_team: str, away_team: str,
                   data: pd.DataFrame) -> Dict[str, float]:
        """5 features: half-time goals averages and form."""
        f: Dict[str, float] = {}

        has_ht = 'half_time_home_goals' in data.columns

        def _ht_goals(team: str, scored: bool) -> float:
            """Average HT goals scored or conceded over last 10 matches."""
            if not has_ht:
                return 0.0
            tm = self._get_team_matches(team, data).tail(10)
            if tm.empty:
                return 0.0
            total = 0.0
            count = 0
            for _, row in tm.iterrows():
                ht_home = row.get('half_time_home_goals')
                ht_away = row.get('half_time_away_goals')
                if pd.isna(ht_home) or pd.isna(ht_away):
                    continue
                if row.get('is_home', False):
                    total += float(ht_home) if scored else float(ht_away)
                else:
                    total += float(ht_away) if scored else float(ht_home)
                count += 1
            return total / count if count > 0 else 0.0

        f['home_ht_goals_scored_avg'] = _ht_goals(home_team, scored=True)
        f['away_ht_goals_scored_avg'] = _ht_goals(away_team, scored=True)
        f['home_ht_goals_conceded_avg'] = _ht_goals(home_team, scored=False)
        f['away_ht_goals_conceded_avg'] = _ht_goals(away_team, scored=False)

        # Half-time form: average HT result points (last 5)
        def _ht_form(team: str) -> float:
            if not has_ht or 'half_time_result' not in data.columns:
                return 0.0
            tm = self._get_team_matches(team, data).tail(5)
            if tm.empty:
                return 0.0
            pts = 0.0
            count = 0
            for _, row in tm.iterrows():
                htr = row.get('half_time_result')
                if pd.isna(htr):
                    continue
                if row.get('is_home', False):
                    pts += {'H': 3, 'D': 1, 'A': 0}.get(htr, 0)
                else:
                    pts += {'A': 3, 'D': 1, 'H': 0}.get(htr, 0)
                count += 1
            return pts / count if count > 0 else 0.0

        f['ht_form_home'] = _ht_form(home_team)

        return f

    def _match_stats(self, home_team: str, away_team: str,
                     data: pd.DataFrame) -> Dict[str, float]:
        """8 features: rolling averages for shots, corners, yellow cards."""
        f: Dict[str, float] = {}

        def _rolling_stat(team: str, stat_home: str, stat_away: str,
                          n: int = 10) -> float:
            """Average of a match stat over last n matches for a team."""
            if stat_home not in data.columns:
                return 0.0
            tm = self._get_team_matches(team, data).tail(n)
            if tm.empty:
                return 0.0
            total = 0.0
            count = 0
            for _, row in tm.iterrows():
                if row.get('is_home', False):
                    val = row.get(stat_home)
                else:
                    val = row.get(stat_away)
                if pd.notna(val):
                    total += float(val)
                    count += 1
            return total / count if count > 0 else 0.0

        f['home_shots_avg'] = _rolling_stat(home_team, 'home_shots', 'away_shots')
        f['away_shots_avg'] = _rolling_stat(away_team, 'home_shots', 'away_shots')
        f['home_shots_on_target_avg'] = _rolling_stat(
            home_team, 'home_shots_target', 'away_shots_target',
        )
        f['away_shots_on_target_avg'] = _rolling_stat(
            away_team, 'home_shots_target', 'away_shots_target',
        )
        f['home_corners_avg'] = _rolling_stat(home_team, 'home_corners', 'away_corners')
        f['away_corners_avg'] = _rolling_stat(away_team, 'home_corners', 'away_corners')
        f['home_yellows_avg'] = _rolling_stat(home_team, 'home_yellows', 'away_yellows')
        f['away_yellows_avg'] = _rolling_stat(away_team, 'home_yellows', 'away_yellows')

        return f
