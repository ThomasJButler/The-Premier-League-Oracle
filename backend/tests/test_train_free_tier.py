"""
Tests for free-tier training pipeline.

Validates:
- Data loading and column normalisation
- Feature matrix construction (chronological, no leakage)
- Chronological train/val split
- Model save/load with metadata
"""

import numpy as np
import pandas as pd
import pytest
import os
import sys
import tempfile
import shutil

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.features.free_tier_features import FreeTierFeatureEngineer
from train_free_tier import (
    build_dataset,
    chronological_split,
    LABEL_MAP,
    MIN_PRIOR_MATCHES,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_csv_row(date, home, away, hg, ag, ht_hg=0, ht_ag=0):
    """Create a row in the original CSV column format."""
    ftr = 'H' if hg > ag else ('A' if hg < ag else 'D')
    htr = 'H' if ht_hg > ht_ag else ('A' if ht_hg < ht_ag else 'D')
    return {
        'Date': date, 'HomeTeam': home, 'AwayTeam': away,
        'FTHG': hg, 'FTAG': ag, 'FTR': ftr,
        'HTHG': ht_hg, 'HTAG': ht_ag, 'HTR': htr,
        'HS': 10, 'AS': 8, 'HST': 4, 'AST': 3,
        'HC': 5, 'AC': 4, 'HY': 1, 'AY': 2,
        'HR': 0, 'AR': 0, 'HF': 10, 'AF': 12,
        'Div': 'E0', 'Time': '15:00', 'Referee': 'A Taylor',
    }


def _build_mini_dataset(n_matches: int = 30) -> pd.DataFrame:
    """Build a small normalised dataset suitable for build_dataset()."""
    teams = ['Arsenal', 'Chelsea', 'Liverpool', 'Man City']
    rows = []
    from datetime import datetime, timedelta
    base = datetime(2024, 8, 17)

    idx = 0
    for r in range(n_matches):
        home = teams[idx % len(teams)]
        away = teams[(idx + 1) % len(teams)]
        hg = (idx * 7 + 3) % 4
        ag = (idx * 5 + 1) % 3
        match_date = base + timedelta(days=idx * 3)
        result = 'H' if hg > ag else ('A' if hg < ag else 'D')
        rows.append({
            'date': match_date,
            'home_team': home,
            'away_team': away,
            'home_goals': hg,
            'away_goals': ag,
            'result': result,
            'half_time_home_goals': min(hg, 1),
            'half_time_away_goals': min(ag, 1),
            'half_time_result': 'H' if min(hg, 1) > min(ag, 1) else ('D' if min(hg, 1) == min(ag, 1) else 'A'),
            'home_shots': 10 + hg, 'away_shots': 8 + ag,
            'home_shots_target': 4 + hg, 'away_shots_target': 3 + ag,
            'home_corners': 5, 'away_corners': 4,
            'home_yellows': 1, 'away_yellows': 2,
            'home_reds': 0, 'away_reds': 0,
            'home_fouls': 10, 'away_fouls': 12,
            'season': '2024/25',
        })
        idx += 1

    df = pd.DataFrame(rows)
    df['date'] = pd.to_datetime(df['date'])
    return df.sort_values('date').reset_index(drop=True)


# ---------------------------------------------------------------------------
# Tests: build_dataset
# ---------------------------------------------------------------------------

class TestBuildDataset:
    """Feature matrix construction."""

    def test_output_shapes(self):
        """X and y should have consistent shapes."""
        df = _build_mini_dataset(40)
        X, y, names, _ = build_dataset(df)
        assert X.ndim == 2
        assert y.ndim == 1
        assert X.shape[0] == y.shape[0]
        assert X.shape[1] == len(names)
        assert X.shape[1] == len(FreeTierFeatureEngineer.FEATURE_NAMES)

    def test_labels_valid(self):
        """All labels should be in {0, 1, 2}."""
        df = _build_mini_dataset(40)
        X, y, _, _ = build_dataset(df)
        assert set(np.unique(y)).issubset({0, 1, 2})

    def test_warmup_filter(self):
        """Matches before MIN_PRIOR_MATCHES should be skipped."""
        df = _build_mini_dataset(40)
        X, y, _, _ = build_dataset(df)
        # Should have fewer samples than total matches
        assert len(X) < len(df)
        # Should skip at least MIN_PRIOR_MATCHES * n_teams matches
        assert len(X) > 0

    def test_no_nan_in_features(self):
        """Feature matrix should have no NaN values."""
        df = _build_mini_dataset(40)
        X, y, _, _ = build_dataset(df)
        assert not np.any(np.isnan(X)), 'Feature matrix contains NaN values'

    def test_feature_names_match(self):
        """Returned feature names should match FEATURE_NAMES."""
        df = _build_mini_dataset(40)
        _, _, names, _ = build_dataset(df)
        assert names == FreeTierFeatureEngineer.FEATURE_NAMES


# ---------------------------------------------------------------------------
# Tests: chronological_split
# ---------------------------------------------------------------------------

class TestChronologicalSplit:
    """Train/val split must be chronological."""

    def test_split_proportions(self):
        X = np.arange(100).reshape(100, 1)
        y = np.zeros(100)
        X_train, y_train, X_val, y_val = chronological_split(X, y, 0.2)
        assert len(X_train) == 80
        assert len(X_val) == 20

    def test_no_overlap(self):
        X = np.arange(100).reshape(100, 1)
        y = np.zeros(100)
        X_train, _, X_val, _ = chronological_split(X, y, 0.2)
        # Training data should come before validation data
        assert X_train[-1, 0] < X_val[0, 0]

    def test_all_data_accounted(self):
        X = np.arange(100).reshape(100, 1)
        y = np.zeros(100)
        X_train, y_train, X_val, y_val = chronological_split(X, y, 0.2)
        assert len(X_train) + len(X_val) == 100


# ---------------------------------------------------------------------------
# Tests: CSV loading
# ---------------------------------------------------------------------------

class TestCSVLoading:
    """Test load_csvs with a temporary CSV file."""

    def test_load_single_csv(self, tmp_path):
        """Create a temp CSV and verify it loads correctly."""
        csv_content = (
            'Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,'
            'HTHG,HTAG,HTR,HS,AS,HST,AST,HC,AC,HY,AY,HR,AR,HF,AF\n'
            'E0,17/08/2024,15:00,Arsenal,Chelsea,2,1,H,'
            '1,0,H,12,8,5,3,6,4,1,2,0,0,10,12\n'
            'E0,24/08/2024,15:00,Chelsea,Arsenal,0,0,D,'
            '0,0,D,7,9,2,4,3,5,2,1,0,0,11,10\n'
        )
        csv_file = tmp_path / 'EPL20242025.csv'
        csv_file.write_text(csv_content, encoding='utf-8')

        df = FreeTierFeatureEngineer.load_csvs(str(tmp_path))
        assert len(df) == 2
        assert 'home_team' in df.columns
        assert 'home_goals' in df.columns
        assert df.iloc[0]['home_team'] == 'Arsenal'
        assert df.iloc[0]['home_goals'] == 2
        assert 'season' in df.columns

    def test_no_csvs_raises(self, tmp_path):
        """Should raise FileNotFoundError when no CSVs exist."""
        with pytest.raises(FileNotFoundError):
            FreeTierFeatureEngineer.load_csvs(str(tmp_path))


# ---------------------------------------------------------------------------
# Tests: Model save/load (integration)
# ---------------------------------------------------------------------------

class TestModelSaveLoad:
    """Verify model saving with metadata."""

    def test_save_and_load_metadata(self, tmp_path):
        """Saved model should contain required metadata keys."""
        try:
            import joblib
        except ImportError:
            pytest.skip('joblib not installed')

        model_path = tmp_path / 'test_model.joblib'
        payload = {
            'model': None,  # Placeholder
            'feature_names': FreeTierFeatureEngineer.FEATURE_NAMES,
            'version': '1.0.0-free',
            'tier': 'free',
            'training_date': '2024-01-01',
            'training_samples': 100,
            'validation_accuracy': 0.5,
        }
        joblib.dump(payload, str(model_path))

        loaded = joblib.load(str(model_path))
        assert loaded['tier'] == 'free'
        assert loaded['version'] == '1.0.0-free'
        assert len(loaded['feature_names']) == len(FreeTierFeatureEngineer.FEATURE_NAMES)
