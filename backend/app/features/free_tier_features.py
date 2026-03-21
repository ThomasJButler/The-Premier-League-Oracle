"""
Free-tier feature engineering for Premier League match prediction.

Computes ~109 features from match data available on the Football-Data.org
free API tier + historical CSV data. No stubs — every feature computes
a real value from the data (0.0 only when insufficient history exists).

Standalone class, fully decoupled from AdvancedFeatureEngineer.
The 150-feature Pro-tier pipeline (advanced_engineering.py) is kept
separate for future paid API integration.

Data sources:
    - Match results (goals, half-time, result) — free API + CSVs
    - Match stats (shots, corners, cards, fouls) — CSVs only
    - Bookmaker odds (Pinnacle, market average) — CSVs only
    - Standings and dates — free API + CSVs
"""

import logging
from datetime import datetime

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Team name normalisation: CSV short names <-> Football-Data.org API names
# ---------------------------------------------------------------------------

CSV_TO_API: dict[str, str] = {
    'Arsenal': 'Arsenal FC',
    'Aston Villa': 'Aston Villa FC',
    'Bournemouth': 'AFC Bournemouth',
    'Brentford': 'Brentford FC',
    'Brighton': 'Brighton & Hove Albion FC',
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

API_TO_CSV: dict[str, str] = {v: k for k, v in CSV_TO_API.items()}

# Additional aliases for flexible lookup
_ALIASES: dict[str, str] = {
    'Manchester City': 'Man City',
    'Manchester United': 'Man United',
    'Nottingham Forest': "Nott'm Forest",
    'Wolverhampton Wanderers': 'Wolves',
    'Brighton and Hove Albion': 'Brighton',
    'Brighton & Hove Albion': 'Brighton',
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
    Compute ~109 match prediction features from free-tier data.

    All features use only data strictly before the match date (no leakage).
    Designed for both CSV training and live API prediction.
    Odds features are optional — 0.0 when unavailable (inference without odds).

    Required DataFrame columns (normalised names):
        date, home_team, away_team, home_goals, away_goals, result,
        half_time_home_goals, half_time_away_goals, half_time_result,
        home_shots, away_shots, home_shots_target, away_shots_target,
        home_corners, away_corners, home_yellows, away_yellows,
        home_reds, away_reds, home_fouls, away_fouls

    Match stats columns (shots, corners, etc.) are optional — features
    degrade gracefully to 0.0 when missing.
    """

    FEATURE_NAMES: list[str] = [
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
        # Draw indicators (13) — target the model's weakest class
        'form_closeness', 'standings_closeness',
        'home_draw_rate', 'away_draw_rate',
        'combined_defensive_strength', 'low_scoring_indicator',
        'h2h_draw_tendency', 'draw_streak_proximity',
        'goal_difference_symmetry', 'season_ppg_closeness',
        'mid_table_indicator', 'elo_draw_band',
        'goals_per_game_combined',
        # Elo ratings (5) — running team strength from historical results
        'home_elo', 'away_elo', 'elo_difference',
        'elo_expected_home', 'elo_home_advantage',
        # Interaction features (5) — non-linear relationships between base features
        'elo_x_form', 'derby_x_closeness', 'elo_x_rest',
        'trend_x_form', 'h2h_draw_x_closeness',
        # Bookmaker odds (10) — strongest predictor; 0.0 when unavailable
        # Pinnacle closing implied probabilities (sharpest market)
        'odds_pinnacle_home', 'odds_pinnacle_draw', 'odds_pinnacle_away',
        # Market average implied probabilities (always available in CSVs)
        'odds_avg_home', 'odds_avg_draw', 'odds_avg_away',
        # Market overround (measures bookmaker confidence/liquidity)
        'odds_overround',
        # Asian handicap line (encodes implied goal margin)
        'odds_asian_handicap',
        # Over/Under 2.5 implied probability
        'odds_over_2_5_prob',
        # Pinnacle-vs-average divergence (sharp money signal)
        'odds_sharp_divergence',
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
        self._elo_ratings = self._precompute_elo()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create_features(
        self,
        home_team: str,
        away_team: str,
        match_date: datetime | None = None,
        odds: dict[str, float] | None = None,
        skip_odds: bool = False,
    ) -> dict[str, float]:
        """
        Compute all features for a match prediction.

        Only data strictly before *match_date* is used (no leakage).
        Returns a dict keyed by FEATURE_NAMES with float values.

        Args:
            home_team: Home team name (CSV or API format).
            away_team: Away team name (CSV or API format).
            match_date: Match datetime — only prior data used. None = all data.
            odds: Optional bookmaker odds dict. Keys are raw CSV column names
                  (e.g. 'PSCH', 'PSCD', 'PSCA', 'AvgH', 'AvgD', 'AvgA',
                  'AHCh', 'Avg>2.5', 'Avg<2.5'). When None, odds features
                  are 0.0 — XGBoost handles this gracefully.
            skip_odds: When True, odds features are zeroed even if odds data
                       is available. Used with --no-odds training to produce
                       a model that reflects honest inference accuracy (free
                       API provides no odds at prediction time).
        """
        if match_date is not None:
            if isinstance(match_date, pd.Timestamp):
                match_date = match_date.to_pydatetime()
            pre_match = self.data[self.data['date'] < pd.Timestamp(match_date)]
        else:
            pre_match = self.data

        features: dict[str, float] = {}
        features.update(self._basic_stats(home_team, away_team, pre_match))
        features.update(self._form_momentum(home_team, away_team, pre_match))
        features.update(self._head_to_head(home_team, away_team, pre_match))
        features.update(self._contextual(home_team, away_team, pre_match, match_date))
        features.update(self._time_series(home_team, away_team, pre_match))
        features.update(self._derived(home_team, away_team, pre_match))
        features.update(self._half_time(home_team, away_team, pre_match))
        features.update(self._match_stats(home_team, away_team, pre_match))
        features.update(self._draw_indicators(home_team, away_team, pre_match, match_date))
        features.update(self._elo_features(home_team, away_team, match_date))
        features.update(self._interaction_features(features))
        features.update(self._odds_features(None if skip_odds else odds))

        # Ensure every feature present; replace NaN with 0.0
        result: dict[str, float] = {}
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
            # Strip common suffixes (FC, AFC, CF, F.C.)
            for suffix in (' FC', ' AFC', ' CF', ' F.C.'):
                if stripped.endswith(suffix):
                    return FreeTierFeatureEngineer.normalize_team_name(
                        stripped[:-len(suffix)], to='csv'
                    )
            # Case-insensitive fallback: check all maps with lowered keys
            lower = stripped.lower()
            for csv_name in CSV_TO_API:
                if csv_name.lower() == lower:
                    return csv_name
            for api_name, csv_name in API_TO_CSV.items():
                if api_name.lower() == lower:
                    return csv_name
            for alias, csv_name in _ALIASES.items():
                if alias.lower() == lower:
                    return csv_name
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

        frames: list[pd.DataFrame] = []
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
            if (condition == 'W' and r == 'W') or (condition == 'unbeaten' and r in ('W', 'D')):
                streak += 1
            else:
                break
        return streak

    def _get_season_start(self, match_date: datetime | None) -> datetime:
        """PL season starts in August."""
        if match_date is None:
            return datetime(2020, 8, 1)
        if match_date.month >= 8:
            return datetime(match_date.year, 8, 1)
        return datetime(match_date.year - 1, 8, 1)

    def _compute_standings(self, data: pd.DataFrame,
                           match_date: datetime | None = None,
                           ) -> dict[str, dict]:
        """
        Compute league table from current-season data before match_date.

        Returns {team: {points, gd, played, position}}.
        """
        season_start = self._get_season_start(match_date)
        season_data = data[data['date'] >= pd.Timestamp(season_start)]

        teams: dict[str, dict] = {}
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
                     data: pd.DataFrame) -> dict[str, float]:
        """12 features: goals, points, win rates, clean sheets, venue splits."""
        f: dict[str, float] = {}

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
                       data: pd.DataFrame) -> dict[str, float]:
        """20 features: recent form, weighted form, momentum, streaks, volatility."""
        f: dict[str, float] = {}

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
                      data: pd.DataFrame) -> dict[str, float]:
        """15 features: H2H record, goals, BTTS, recent form, dominance."""
        f: dict[str, float] = {}

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
            if (row['home_team'] == home_team and row['away_goals'] == 0) or (row['away_team'] == home_team and row['home_goals'] == 0):
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
                    match_date: datetime | None) -> dict[str, float]:
        """12 features: rest days, derby, congestion, position, season progress."""
        f: dict[str, float] = {}

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
                     data: pd.DataFrame) -> dict[str, float]:
        """9 features: trends, consistency, monthly performance, mean reversion."""
        f: dict[str, float] = {}

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
        def _monthly_perf(matches: pd.DataFrame, month: int | None) -> float:
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
                 data: pd.DataFrame) -> dict[str, float]:
        """5 features: over 2.5 prob, BTTS prob, goal conversion, def efficiency."""
        f: dict[str, float] = {}

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
                   data: pd.DataFrame) -> dict[str, float]:
        """5 features: half-time goals averages and form."""
        f: dict[str, float] = {}

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
                     data: pd.DataFrame) -> dict[str, float]:
        """8 features: rolling averages for shots, corners, yellow cards."""
        f: dict[str, float] = {}

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

    def _draw_indicators(self, home_team: str, away_team: str,
                         data: pd.DataFrame,
                         match_date: datetime | None = None,
                         ) -> dict[str, float]:
        """
        13 features: explicit draw-prediction signals.

        Draws are ~23% of PL outcomes but are the hardest to predict.
        These features capture patterns that correlate with drawn matches:
        evenly-matched teams, defensive setups, historical draw tendencies,
        goal difference symmetry, mid-table matchups, and combined scoring rate.
        """
        f: dict[str, float] = {}
        hm = self._get_team_matches(home_team, data)
        am = self._get_team_matches(away_team, data)

        # 1. Form closeness: absolute difference in recent PPG (lower = more likely draw)
        def _ppg(matches: pd.DataFrame, n: int = 10) -> float:
            recent = matches.tail(n)
            if recent.empty:
                return 1.0  # neutral default
            pts = recent['team_result'].map({'W': 3, 'D': 1, 'L': 0})
            return float(pts.mean())

        h_ppg = _ppg(hm)
        a_ppg = _ppg(am)
        # Invert so higher = more likely draw (closer teams)
        f['form_closeness'] = 1.0 / (1.0 + abs(h_ppg - a_ppg))

        # 2. Standings closeness: inverse of position gap (higher = closer)
        standings = self._compute_standings(data, match_date)
        h_pos = standings.get(home_team, {}).get('position', 10)
        a_pos = standings.get(away_team, {}).get('position', 10)
        f['standings_closeness'] = 1.0 / (1.0 + abs(h_pos - a_pos))

        # 3-4. Draw rates: proportion of draws in recent matches per team
        def _draw_rate(matches: pd.DataFrame, n: int = 15) -> float:
            recent = matches.tail(n)
            if recent.empty:
                return 0.0
            return float((recent['team_result'] == 'D').mean())

        f['home_draw_rate'] = _draw_rate(hm)
        f['away_draw_rate'] = _draw_rate(am)

        # 5. Combined defensive strength: average clean sheet rate (higher = more defensive)
        def _cs_rate(matches: pd.DataFrame, n: int = 10) -> float:
            recent = matches.tail(n)
            if recent.empty:
                return 0.0
            return float((recent['opponent_goals'] == 0).mean())

        f['combined_defensive_strength'] = (_cs_rate(hm) + _cs_rate(am)) / 2.0

        # 6. Low-scoring indicator: average total goals in recent matches (lower = more likely draw)
        def _avg_total_goals(matches: pd.DataFrame, n: int = 10) -> float:
            recent = matches.tail(n)
            if recent.empty:
                return 2.5  # PL average
            return float((recent['team_goals'] + recent['opponent_goals']).mean())

        avg_goals = (_avg_total_goals(hm) + _avg_total_goals(am)) / 2.0
        # Invert: lower total goals → higher draw probability
        f['low_scoring_indicator'] = max(0.0, 3.0 - avg_goals)

        # 7. H2H draw tendency: draw rate in head-to-head matches
        h2h = self._get_h2h_matches(home_team, away_team, data)
        if len(h2h) >= 2:
            h2h_draws = 0
            for _, row in h2h.iterrows():
                if row.get('result') == 'D':
                    h2h_draws += 1
            f['h2h_draw_tendency'] = h2h_draws / len(h2h)
        else:
            f['h2h_draw_tendency'] = 0.0

        # 8. Draw streak proximity: are either team on a sequence close to drawing?
        #    (teams that recently drew are slightly more likely to draw again in close matchups)
        def _recent_draw_count(matches: pd.DataFrame, n: int = 5) -> float:
            recent = matches.tail(n)
            if recent.empty:
                return 0.0
            return float((recent['team_result'] == 'D').sum())

        h_recent = _recent_draw_count(hm)
        a_recent = _recent_draw_count(am)
        f['draw_streak_proximity'] = (h_recent + a_recent) / 10.0  # normalise to 0-1 range

        # 9. Goal difference symmetry: similar GD/GP → evenly matched → draw-prone
        h_stats = standings.get(home_team, {})
        a_stats = standings.get(away_team, {})
        h_played = max(h_stats.get('played', 1), 1)
        a_played = max(a_stats.get('played', 1), 1)
        h_gd_pg = h_stats.get('gd', 0) / h_played
        a_gd_pg = a_stats.get('gd', 0) / a_played
        f['goal_difference_symmetry'] = 1.0 / (1.0 + abs(h_gd_pg - a_gd_pg))

        # 10. Season PPG closeness: overall season PPG similarity (not just recent form)
        h_ppg_season = h_stats.get('points', 0) / h_played
        a_ppg_season = a_stats.get('points', 0) / a_played
        f['season_ppg_closeness'] = 1.0 / (1.0 + abs(h_ppg_season - a_ppg_season))

        # 11. Mid-table indicator: both teams in positions 8-14 → higher draw rate
        h_pos_val = h_stats.get('position', 10)
        a_pos_val = a_stats.get('position', 10)
        h_mid = 1.0 if 8 <= h_pos_val <= 14 else 0.0
        a_mid = 1.0 if 8 <= a_pos_val <= 14 else 0.0
        f['mid_table_indicator'] = h_mid * a_mid  # 1.0 only when both are mid-table

        # 12. Elo draw band: small Elo difference → draw zone
        # Uses the already-computed elo_difference from _elo_features (but that's
        # normalised by /400). Recompute from raw standings closeness as proxy:
        # When form + standings are both close, draws are most likely.
        f['elo_draw_band'] = f['form_closeness'] * f['standings_closeness']

        # 13. Goals per game combined: low combined goals → draw-prone
        h_gpg = h_stats.get('gf', 0) / h_played
        a_gpg = a_stats.get('gf', 0) / a_played
        combined_gpg = (h_gpg + a_gpg) / 2.0
        # Invert: lower goals → higher draw probability (capped at 2.0)
        f['goals_per_game_combined'] = max(0.0, 2.0 - combined_gpg)

        return f

    # ------------------------------------------------------------------
    # Elo rating features
    # ------------------------------------------------------------------

    # Constants matching the frontend EloRatingSystem
    _ELO_K = 32         # Rating sensitivity
    _ELO_HOME = 65      # Home advantage in Elo points
    _ELO_DEFAULT = 1500 # Default rating for unseen teams

    def _precompute_elo(self) -> dict[int, dict[str, float]]:
        """
        Walk the match DataFrame chronologically, maintaining running Elo
        ratings for every team. Store the *pre-match* ratings keyed by
        DataFrame index so that ``_elo_features`` can look them up in O(1).

        Returns:
            Dict mapping row index → {home_team: rating, away_team: rating}
            (ratings BEFORE the match was played).
        """
        ratings: dict[str, float] = {}   # team → current Elo
        snapshot: dict[int, dict[str, float]] = {}

        for idx, row in self.data.iterrows():
            ht = row['home_team']
            at = row['away_team']

            home_r = ratings.get(ht, self._ELO_DEFAULT)
            away_r = ratings.get(at, self._ELO_DEFAULT)

            # Store pre-match ratings
            snapshot[idx] = {ht: home_r, at: away_r}

            # Update ratings from the result
            result = row.get('result')
            if result in ('H', 'D', 'A'):
                adj_home = home_r + self._ELO_HOME
                exp_home = 1.0 / (1.0 + 10.0 ** ((away_r - adj_home) / 400.0))
                actual_home = 1.0 if result == 'H' else 0.5 if result == 'D' else 0.0
                ratings[ht] = home_r + self._ELO_K * (actual_home - exp_home)
                ratings[at] = away_r + self._ELO_K * ((1.0 - actual_home) - (1.0 - exp_home))

        return snapshot

    def _elo_features(
        self,
        home_team: str,
        away_team: str,
        match_date: datetime | None,
    ) -> dict[str, float]:
        """
        Return Elo-based features for a given match.

        For training (match exists in the data), uses precomputed pre-match
        ratings. For live inference (match_date in the future / not in data),
        uses the latest known ratings for each team.
        """
        f: dict[str, float] = {}

        # Try to find the exact match in the precomputed snapshot
        home_elo = self._ELO_DEFAULT
        away_elo = self._ELO_DEFAULT

        if match_date is not None:
            # Look for matching row by teams + date
            mask = (
                (self.data['home_team'] == home_team)
                & (self.data['away_team'] == away_team)
                & (self.data['date'] == pd.Timestamp(match_date))
            )
            matches = self.data[mask]
            if not matches.empty:
                idx = matches.index[0]
                snap = self._elo_ratings.get(idx, {})
                home_elo = snap.get(home_team, self._ELO_DEFAULT)
                away_elo = snap.get(away_team, self._ELO_DEFAULT)
            else:
                # Match not in data — use latest ratings before match_date
                home_elo, away_elo = self._latest_elo(
                    home_team, away_team, before_date=match_date,
                )
        else:
            home_elo, away_elo = self._latest_elo(home_team, away_team)

        # Normalise to roughly [0, 1] range for ML: (rating - 1000) / 1000
        f['home_elo'] = (home_elo - 1000.0) / 1000.0
        f['away_elo'] = (away_elo - 1000.0) / 1000.0
        f['elo_difference'] = (home_elo - away_elo) / 400.0  # ~[-2, +2]

        # Expected score with home advantage
        adj_home = home_elo + self._ELO_HOME
        exp_home = 1.0 / (1.0 + 10.0 ** ((away_elo - adj_home) / 400.0))
        f['elo_expected_home'] = exp_home  # already [0, 1]

        # Home advantage magnitude: how much the home advantage shifts expectation
        exp_neutral = 1.0 / (1.0 + 10.0 ** ((away_elo - home_elo) / 400.0))
        f['elo_home_advantage'] = exp_home - exp_neutral

        return f

    @staticmethod
    def _interaction_features(features: dict[str, float]) -> dict[str, float]:
        """
        Interaction features that capture non-linear relationships between
        base features. XGBoost can learn interactions, but explicit features
        make them easier to find — especially with limited training data.
        """
        def _get(name: str) -> float:
            val = features.get(name, 0.0)
            return 0.0 if val is None or np.isnan(val) else float(val)

        return {
            # Strong teams with close form are more predictable
            'elo_x_form': _get('elo_difference') * _get('form_closeness'),
            # Derby matches between closely-ranked teams → draw-prone
            'derby_x_closeness': _get('is_derby') * _get('standings_closeness'),
            # Fatigued favourites underperform more than fatigued underdogs
            'elo_x_rest': _get('elo_difference') * _get('rest_day_advantage'),
            # Accelerating form (positive trend × high recent form)
            'trend_x_form': _get('home_trend_short') * _get('home_form_last_5'),
            # H2H draw history amplified by current form similarity
            'h2h_draw_x_closeness': _get('h2h_draw_tendency') * _get('form_closeness'),
        }

    @staticmethod
    def _odds_features(
        odds: dict[str, float] | None,
    ) -> dict[str, float]:
        """
        Compute bookmaker-odds features from raw CSV odds columns.

        Bookmaker odds are the single strongest predictor of match outcomes.
        Pinnacle odds are the "sharpest" (lowest margin, accepts sharp bettors).
        Market average odds provide a consensus view (available for all matches).

        When odds are None (no odds available at inference time), all features
        return 0.0. XGBoost handles this gracefully — tree splits on odds
        features simply take the "no information" branch, and the model falls
        back to the remaining 99 non-odds features.

        Args:
            odds: Dict of raw CSV column values, e.g.
                  {'PSCH': 2.10, 'PSCD': 3.50, 'PSCA': 3.80,
                   'AvgH': 2.05, 'AvgD': 3.45, 'AvgA': 3.75,
                   'AHCh': -0.5, 'Avg>2.5': 1.85, 'Avg<2.5': 2.10}
                  Opening odds (PSH/PSD/PSA) used as fallback for missing
                  closing odds. AvgH/AvgD/AvgA used as fallback for Pinnacle.
        """
        f: dict[str, float] = {}

        if odds is None:
            f['odds_pinnacle_home'] = 0.0
            f['odds_pinnacle_draw'] = 0.0
            f['odds_pinnacle_away'] = 0.0
            f['odds_avg_home'] = 0.0
            f['odds_avg_draw'] = 0.0
            f['odds_avg_away'] = 0.0
            f['odds_overround'] = 0.0
            f['odds_asian_handicap'] = 0.0
            f['odds_over_2_5_prob'] = 0.0
            f['odds_sharp_divergence'] = 0.0
            return f

        def _safe_float(key: str, fallback_key: str | None = None) -> float:
            """Extract a float from odds dict, falling back to alternate key."""
            val = odds.get(key)
            if val is not None and not (isinstance(val, float) and np.isnan(val)):
                try:
                    return float(val)
                except (ValueError, TypeError):
                    pass
            if fallback_key is not None:
                val = odds.get(fallback_key)
                if val is not None and not (isinstance(val, float) and np.isnan(val)):
                    try:
                        return float(val)
                    except (ValueError, TypeError):
                        pass
            return 0.0

        def _odds_to_prob(decimal_odds: float) -> float:
            """Convert decimal odds to implied probability."""
            return 1.0 / decimal_odds if decimal_odds > 1.0 else 0.0

        # Pinnacle closing odds (sharpest market), falling back to opening
        ps_h = _safe_float('PSCH', 'PSH')
        ps_d = _safe_float('PSCD', 'PSD')
        ps_a = _safe_float('PSCA', 'PSA')

        # Market average closing odds, falling back to opening
        avg_h = _safe_float('AvgCH', 'AvgH')
        avg_d = _safe_float('AvgCD', 'AvgD')
        avg_a = _safe_float('AvgCA', 'AvgA')

        # Convert to implied probabilities
        ps_h_prob = _odds_to_prob(ps_h)
        ps_d_prob = _odds_to_prob(ps_d)
        ps_a_prob = _odds_to_prob(ps_a)

        avg_h_prob = _odds_to_prob(avg_h)
        avg_d_prob = _odds_to_prob(avg_d)
        avg_a_prob = _odds_to_prob(avg_a)

        # Normalise Pinnacle probs to remove overround (sum to 1.0)
        ps_total = ps_h_prob + ps_d_prob + ps_a_prob
        if ps_total > 0:
            f['odds_pinnacle_home'] = ps_h_prob / ps_total
            f['odds_pinnacle_draw'] = ps_d_prob / ps_total
            f['odds_pinnacle_away'] = ps_a_prob / ps_total
        else:
            # Pinnacle unavailable — fall back to market average
            avg_total = avg_h_prob + avg_d_prob + avg_a_prob
            if avg_total > 0:
                f['odds_pinnacle_home'] = avg_h_prob / avg_total
                f['odds_pinnacle_draw'] = avg_d_prob / avg_total
                f['odds_pinnacle_away'] = avg_a_prob / avg_total
            else:
                f['odds_pinnacle_home'] = 0.0
                f['odds_pinnacle_draw'] = 0.0
                f['odds_pinnacle_away'] = 0.0

        # Normalise market average probs
        avg_total = avg_h_prob + avg_d_prob + avg_a_prob
        if avg_total > 0:
            f['odds_avg_home'] = avg_h_prob / avg_total
            f['odds_avg_draw'] = avg_d_prob / avg_total
            f['odds_avg_away'] = avg_a_prob / avg_total
        else:
            f['odds_avg_home'] = 0.0
            f['odds_avg_draw'] = 0.0
            f['odds_avg_away'] = 0.0

        # Overround: how much above 100% the raw probs sum to.
        # Lower = sharper market. Pinnacle ~2.5%, Bet365 ~5.5%.
        # Scaled to roughly [0, 0.1] range.
        if ps_total > 0:
            f['odds_overround'] = ps_total - 1.0
        elif avg_total > 0:
            f['odds_overround'] = avg_total - 1.0
        else:
            f['odds_overround'] = 0.0

        # Asian handicap line: negative = home favoured, positive = away
        # Scaled to roughly [-3, +3] range — no normalisation needed.
        ah_line = _safe_float('AHCh', 'AHh')
        f['odds_asian_handicap'] = ah_line

        # Over/Under 2.5 goals implied probability
        ou_over = _safe_float('Avg>2.5')
        ou_under = _safe_float('Avg<2.5')
        ou_over_prob = _odds_to_prob(ou_over)
        ou_under_prob = _odds_to_prob(ou_under)
        ou_total = ou_over_prob + ou_under_prob
        f['odds_over_2_5_prob'] = ou_over_prob / ou_total if ou_total > 0 else 0.0

        # Sharp money divergence: how much Pinnacle deviates from market avg.
        # Positive = Pinnacle gives higher home probability than market consensus.
        # This captures "sharp money" movement on Pinnacle that recreational
        # bookmakers haven't fully adjusted for.
        if ps_total > 0 and avg_total > 0:
            ps_home_norm = ps_h_prob / ps_total
            avg_home_norm = avg_h_prob / avg_total
            f['odds_sharp_divergence'] = ps_home_norm - avg_home_norm
        else:
            f['odds_sharp_divergence'] = 0.0

        return f

    def _latest_elo(
        self,
        home_team: str,
        away_team: str,
        before_date: datetime | None = None,
    ) -> tuple[float, float]:
        """
        Get the latest known Elo ratings, optionally only from matches
        before a given date (prevents future data leakage).

        When ``before_date`` is None (live inference), all data is used.
        When provided, only matches strictly before that date contribute.
        """
        home_elo = self._ELO_DEFAULT
        away_elo = self._ELO_DEFAULT
        found_home = False
        found_away = False

        cutoff = pd.Timestamp(before_date) if before_date is not None else None

        for idx in reversed(self.data.index):
            # Skip matches at or after the cutoff date
            if cutoff is not None:
                row_date = self.data.at[idx, 'date']
                if pd.Timestamp(row_date) >= cutoff:
                    continue

            snap = self._elo_ratings.get(idx, {})
            if not found_home and home_team in snap:
                home_elo = snap[home_team]
                found_home = True
            if not found_away and away_team in snap:
                away_elo = snap[away_team]
                found_away = True
            if found_home and found_away:
                break

        # Snapshot stores pre-match ratings, so the returned value is
        # the rating before the team's last match prior to cutoff.
        # The post-match rating is implicitly encoded in the *next*
        # match's pre-match snapshot. For live inference (no cutoff)
        # this is close enough — at most one K-factor update (~32 points).

        return home_elo, away_elo
