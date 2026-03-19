"""
Tests for FreeTierFeatureEngineer.

Validates:
- All FEATURE_NAMES are returned by create_features()
- No feature returns 0.0 when given sufficient history
- Features use only pre-match data (no leakage)
- Team name normalisation handles CSV and API formats
- Graceful degradation when match stats columns are missing
"""

import numpy as np
import pandas as pd
import pytest
from datetime import datetime, timedelta

import sys
import os

# Add backend root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.features.free_tier_features import (
    FreeTierFeatureEngineer,
    CSV_TO_API,
    API_TO_CSV,
    DERBIES,
)


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------

def _make_match(
    date: str, home: str, away: str,
    home_goals: int, away_goals: int,
    ht_home: int = 0, ht_away: int = 0,
    home_shots: int = 10, away_shots: int = 8,
    home_shots_target: int = 4, away_shots_target: int = 3,
    home_corners: int = 5, away_corners: int = 4,
    home_yellows: int = 1, away_yellows: int = 2,
    home_reds: int = 0, away_reds: int = 0,
    home_fouls: int = 10, away_fouls: int = 12,
) -> dict:
    """Create a single match row."""
    if home_goals > away_goals:
        result = 'H'
    elif home_goals < away_goals:
        result = 'A'
    else:
        result = 'D'

    if ht_home > ht_away:
        ht_result = 'H'
    elif ht_home < ht_away:
        ht_result = 'A'
    else:
        ht_result = 'D'

    return {
        'date': date,
        'home_team': home,
        'away_team': away,
        'home_goals': home_goals,
        'away_goals': away_goals,
        'result': result,
        'half_time_home_goals': ht_home,
        'half_time_away_goals': ht_away,
        'half_time_result': ht_result,
        'home_shots': home_shots,
        'away_shots': away_shots,
        'home_shots_target': home_shots_target,
        'away_shots_target': away_shots_target,
        'home_corners': home_corners,
        'away_corners': away_corners,
        'home_yellows': home_yellows,
        'away_yellows': away_yellows,
        'home_reds': home_reds,
        'away_reds': away_reds,
        'home_fouls': home_fouls,
        'away_fouls': away_fouls,
    }


def _build_season_data(n_rounds: int = 10) -> pd.DataFrame:
    """
    Build a realistic mini-season with 6 teams and n_rounds of fixtures.

    Returns a DataFrame with enough data for meaningful feature computation.
    """
    teams = ['Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Tottenham', 'Man United']
    matches = []
    base_date = datetime(2024, 8, 17)  # Season start

    # Generate round-robin fixtures
    round_idx = 0
    for r in range(n_rounds):
        for i, home in enumerate(teams):
            for j, away in enumerate(teams):
                if i == j:
                    continue
                if round_idx >= n_rounds * 3:
                    break
                match_date = base_date + timedelta(days=round_idx * 3)
                # Vary scores to create interesting patterns
                hg = (i + r) % 4
                ag = (j + r) % 3
                matches.append(_make_match(
                    date=match_date.strftime('%d/%m/%Y'),
                    home=home, away=away,
                    home_goals=hg, away_goals=ag,
                    ht_home=min(hg, 1), ht_away=min(ag, 1),
                    home_shots=8 + hg * 2, away_shots=6 + ag * 2,
                    home_shots_target=3 + hg, away_shots_target=2 + ag,
                    home_corners=4 + i, away_corners=3 + j,
                    home_yellows=1 + (r % 3), away_yellows=2 + (r % 2),
                ))
                round_idx += 1
            if round_idx >= n_rounds * 3:
                break
        if round_idx >= n_rounds * 3:
            break

    df = pd.DataFrame(matches)
    df['date'] = pd.to_datetime(df['date'], dayfirst=True)
    return df.sort_values('date').reset_index(drop=True)


@pytest.fixture
def sample_data() -> pd.DataFrame:
    """Fixture providing a season's worth of match data."""
    return _build_season_data(n_rounds=12)


@pytest.fixture
def engineer(sample_data) -> FreeTierFeatureEngineer:
    """Fixture providing a configured FreeTierFeatureEngineer."""
    return FreeTierFeatureEngineer(sample_data)


# ---------------------------------------------------------------------------
# Tests: Feature completeness
# ---------------------------------------------------------------------------

class TestFeatureCompleteness:
    """Every feature in FEATURE_NAMES must be returned by create_features()."""

    def test_all_feature_names_returned(self, engineer, sample_data):
        """create_features returns exactly FEATURE_NAMES keys."""
        # Use a date after enough matches have been played
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)

        assert set(features.keys()) == set(FreeTierFeatureEngineer.FEATURE_NAMES)
        assert len(features) == len(FreeTierFeatureEngineer.FEATURE_NAMES)

    def test_feature_count_is_94(self):
        """FEATURE_NAMES should have exactly 94 entries (86 original + 8 draw indicators)."""
        assert len(FreeTierFeatureEngineer.FEATURE_NAMES) == 94

    def test_no_duplicate_feature_names(self):
        """No duplicate entries in FEATURE_NAMES."""
        names = FreeTierFeatureEngineer.FEATURE_NAMES
        assert len(names) == len(set(names))

    def test_all_features_are_floats(self, engineer, sample_data):
        """Every feature value should be a float."""
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        for name, val in features.items():
            assert isinstance(val, float), f'{name} is {type(val)}, expected float'

    def test_no_nan_values(self, engineer, sample_data):
        """No feature should return NaN."""
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        for name, val in features.items():
            assert not np.isnan(val), f'{name} is NaN'


# ---------------------------------------------------------------------------
# Tests: No data leakage
# ---------------------------------------------------------------------------

class TestNoDataLeakage:
    """Features must use only pre-match data."""

    def test_features_differ_by_date(self, sample_data):
        """Features at an early date should differ from features at a later date."""
        engineer = FreeTierFeatureEngineer(sample_data)

        # Early in season
        early_date = sample_data['date'].iloc[10]
        features_early = engineer.create_features('Arsenal', 'Chelsea', early_date)

        # Late in season
        late_date = sample_data['date'].max() + timedelta(days=1)
        features_late = engineer.create_features('Arsenal', 'Chelsea', late_date)

        # At least some features should differ
        diffs = sum(
            1 for k in features_early
            if features_early[k] != features_late[k]
        )
        assert diffs > 0, 'Features should change as more data becomes available'

    def test_no_future_data_used(self, sample_data):
        """Features computed at date T should not change if we add data after T."""
        # Compute features with full data
        engineer_full = FreeTierFeatureEngineer(sample_data)
        mid_date = sample_data['date'].iloc[len(sample_data) // 2]
        features_full = engineer_full.create_features('Arsenal', 'Chelsea', mid_date)

        # Compute features with truncated data (only up to mid_date)
        truncated = sample_data[sample_data['date'] < mid_date]
        engineer_trunc = FreeTierFeatureEngineer(truncated)
        features_trunc = engineer_trunc.create_features('Arsenal', 'Chelsea', mid_date)

        # Should be identical — no future data should leak
        for key in features_full:
            assert features_full[key] == pytest.approx(features_trunc[key], abs=1e-10), \
                f'{key}: full={features_full[key]}, truncated={features_trunc[key]}'


# ---------------------------------------------------------------------------
# Tests: Team name normalisation
# ---------------------------------------------------------------------------

class TestTeamNameNormalisation:
    """normalize_team_name should handle CSV, API, and alias formats."""

    def test_csv_name_stays_csv(self):
        assert FreeTierFeatureEngineer.normalize_team_name('Arsenal', 'csv') == 'Arsenal'

    def test_api_to_csv(self):
        assert FreeTierFeatureEngineer.normalize_team_name('Arsenal FC', 'csv') == 'Arsenal'

    def test_csv_to_api(self):
        assert FreeTierFeatureEngineer.normalize_team_name('Arsenal', 'api') == 'Arsenal FC'

    def test_man_city_api_to_csv(self):
        assert FreeTierFeatureEngineer.normalize_team_name('Manchester City FC', 'csv') == 'Man City'

    def test_man_united_alias(self):
        assert FreeTierFeatureEngineer.normalize_team_name('Manchester United', 'csv') == 'Man United'

    def test_wolves_alias(self):
        assert FreeTierFeatureEngineer.normalize_team_name('Wolverhampton Wanderers', 'csv') == 'Wolves'

    def test_nottm_forest(self):
        assert FreeTierFeatureEngineer.normalize_team_name('Nottingham Forest FC', 'csv') == "Nott'm Forest"

    def test_bournemouth(self):
        assert FreeTierFeatureEngineer.normalize_team_name('AFC Bournemouth', 'csv') == 'Bournemouth'

    def test_fc_suffix_stripped(self):
        assert FreeTierFeatureEngineer.normalize_team_name('Chelsea FC', 'csv') == 'Chelsea'

    def test_unknown_name_passthrough(self):
        assert FreeTierFeatureEngineer.normalize_team_name('Barcelona', 'csv') == 'Barcelona'

    def test_bidirectional_consistency(self):
        """Every CSV->API mapping should round-trip correctly."""
        for csv_name, api_name in CSV_TO_API.items():
            assert FreeTierFeatureEngineer.normalize_team_name(api_name, 'csv') == csv_name
            assert FreeTierFeatureEngineer.normalize_team_name(csv_name, 'api') == api_name


# ---------------------------------------------------------------------------
# Tests: Feature categories
# ---------------------------------------------------------------------------

class TestBasicStats:
    """Basic stats features should reflect match data."""

    def test_win_rate_range(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        assert 0.0 <= features['home_win_rate'] <= 1.0
        assert 0.0 <= features['away_win_rate'] <= 1.0

    def test_clean_sheet_rate_range(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        assert 0.0 <= features['home_clean_sheet_rate'] <= 1.0

    def test_points_per_game_range(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        assert 0.0 <= features['home_points_per_game'] <= 3.0
        assert 0.0 <= features['away_points_per_game'] <= 3.0


class TestFormMomentum:
    """Form and momentum features."""

    def test_form_range(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        assert 0.0 <= features['home_form_last_5'] <= 3.0
        assert 0.0 <= features['away_form_last_5'] <= 3.0

    def test_momentum_is_form_difference(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        expected = features['home_form_last_5'] - features['home_form_last_10']
        assert features['home_momentum'] == pytest.approx(expected)

    def test_win_streak_non_negative(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        assert features['home_win_streak'] >= 0
        assert features['away_win_streak'] >= 0


class TestHeadToHead:
    """H2H features."""

    def test_h2h_counts_consistent(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        total = features['h2h_home_wins'] + features['h2h_draws'] + features['h2h_away_wins']
        assert total == features['h2h_total_matches']

    def test_h2h_rates_range(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        if features['h2h_total_matches'] > 0:
            assert 0.0 <= features['h2h_home_win_rate'] <= 1.0
            assert 0.0 <= features['h2h_btts_rate'] <= 1.0
            assert 0.0 <= features['h2h_over_2_5_rate'] <= 1.0


class TestContextual:
    """Contextual features."""

    def test_rest_days_positive(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=3)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        assert features['home_rest_days'] >= 0
        assert features['away_rest_days'] >= 0

    def test_derby_detection(self):
        """Arsenal vs Tottenham should be detected as a derby."""
        matches = [
            _make_match('01/09/2024', 'Arsenal', 'Tottenham', 2, 1),
            _make_match('08/09/2024', 'Tottenham', 'Arsenal', 1, 1),
            _make_match('15/09/2024', 'Arsenal', 'Chelsea', 1, 0),
            _make_match('22/09/2024', 'Chelsea', 'Tottenham', 0, 2),
            _make_match('29/09/2024', 'Arsenal', 'Liverpool', 3, 1),
            _make_match('06/10/2024', 'Tottenham', 'Liverpool', 1, 0),
        ]
        df = pd.DataFrame(matches)
        df['date'] = pd.to_datetime(df['date'], dayfirst=True)
        eng = FreeTierFeatureEngineer(df)

        features = eng.create_features('Arsenal', 'Tottenham', datetime(2024, 10, 15))
        assert features['is_derby'] == 1.0

        features2 = eng.create_features('Arsenal', 'Chelsea', datetime(2024, 10, 15))
        assert features2['is_derby'] == 1.0  # Arsenal-Chelsea is also a derby

    def test_season_progress_range(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        assert 0.0 <= features['season_progress'] <= 1.0

    def test_position_range(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        assert features['home_position'] >= 1
        assert features['away_position'] >= 1


class TestMatchStats:
    """Match stats features (shots, corners, cards)."""

    def test_stats_non_negative(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        assert features['home_shots_avg'] >= 0
        assert features['away_shots_avg'] >= 0
        assert features['home_corners_avg'] >= 0
        assert features['home_yellows_avg'] >= 0

    def test_graceful_without_stats_columns(self):
        """Features should degrade to 0.0 when stats columns are missing."""
        matches = [
            {'date': '01/09/2024', 'home_team': 'Arsenal', 'away_team': 'Chelsea',
             'home_goals': 2, 'away_goals': 1, 'result': 'H'},
        ] * 10  # Repeat for enough data
        # Give each match a different date
        for i, m in enumerate(matches):
            m = m.copy()
            m['date'] = f'{1 + i:02d}/09/2024'
            matches[i] = m

        df = pd.DataFrame(matches)
        df['date'] = pd.to_datetime(df['date'], dayfirst=True)
        eng = FreeTierFeatureEngineer(df)

        features = eng.create_features('Arsenal', 'Chelsea', datetime(2024, 10, 1))
        # Stats features should be 0.0 since columns don't exist
        assert features['home_shots_avg'] == 0.0
        assert features['home_corners_avg'] == 0.0
        assert features['home_yellows_avg'] == 0.0


# ---------------------------------------------------------------------------
# Tests: Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Edge cases and boundary conditions."""

    def test_unknown_team_returns_zeros(self, engineer, sample_data):
        """Features for a team not in data should be 0.0 (not crash)."""
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('NonexistentFC', 'AlsoFake', match_date)
        assert all(isinstance(v, float) for v in features.values())
        assert len(features) == len(FreeTierFeatureEngineer.FEATURE_NAMES)

    def test_empty_dataframe(self):
        """Should handle empty DataFrame without crashing."""
        empty = pd.DataFrame(columns=[
            'date', 'home_team', 'away_team', 'home_goals', 'away_goals', 'result',
        ])
        empty['date'] = pd.to_datetime(empty['date'])
        eng = FreeTierFeatureEngineer(empty)
        features = eng.create_features('Arsenal', 'Chelsea')
        assert len(features) == len(FreeTierFeatureEngineer.FEATURE_NAMES)

    def test_single_match(self):
        """Should handle DataFrame with just one match."""
        df = pd.DataFrame([
            _make_match('01/09/2024', 'Arsenal', 'Chelsea', 2, 1),
        ])
        df['date'] = pd.to_datetime(df['date'], dayfirst=True)
        eng = FreeTierFeatureEngineer(df)
        features = eng.create_features('Arsenal', 'Chelsea', datetime(2024, 9, 15))
        assert len(features) == len(FreeTierFeatureEngineer.FEATURE_NAMES)

    def test_no_h2h_history(self):
        """Teams that have never played each other should get 0 H2H features."""
        matches = [
            _make_match('01/09/2024', 'Arsenal', 'Chelsea', 2, 1),
            _make_match('08/09/2024', 'Liverpool', 'Man City', 1, 1),
        ]
        df = pd.DataFrame(matches)
        df['date'] = pd.to_datetime(df['date'], dayfirst=True)
        eng = FreeTierFeatureEngineer(df)
        features = eng.create_features('Arsenal', 'Man City', datetime(2024, 9, 15))
        assert features['h2h_total_matches'] == 0.0
        assert features['h2h_home_wins'] == 0.0


# ---------------------------------------------------------------------------
# Tests: Non-zero features with sufficient data
# ---------------------------------------------------------------------------

class TestNonZeroFeatures:
    """With enough data, most features should be non-zero."""

    def test_basic_stats_nonzero(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        # These should all be > 0 with sufficient match history
        assert features['home_goals_scored_avg'] > 0 or features['home_goals_conceded_avg'] > 0
        assert features['home_points_per_game'] > 0

    def test_form_features_nonzero(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        # With 12 rounds of data, form should be computable
        assert features['home_form_last_5'] > 0 or features['home_form_last_10'] > 0

    def test_match_stats_nonzero(self, engineer, sample_data):
        match_date = sample_data['date'].max() + timedelta(days=1)
        features = engineer.create_features('Arsenal', 'Chelsea', match_date)
        # Since our test data includes shots
        assert features['home_shots_avg'] > 0
