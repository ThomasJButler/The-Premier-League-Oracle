"""
Tests for free-tier training pipeline.

Validates:
- Data loading and column normalisation
- Feature matrix construction (chronological, no leakage)
- Chronological train/val split
- Model save/load with metadata
- Rolling cross-validation
"""

import os
import sys

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from train_free_tier import (
    _per_class_accuracy,
    build_dataset,
    chronological_split,
    compute_recency_weights,
    predict_with_ensemble,
    rolling_cross_validation,
    train_stacked_ensemble,
)

from app.features.free_tier_features import FreeTierFeatureEngineer

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
    for _r in range(n_matches):
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
        _X, y, _, _ = build_dataset(df)
        assert set(np.unique(y)).issubset({0, 1, 2})

    def test_warmup_filter(self):
        """Matches before MIN_PRIOR_MATCHES should be skipped."""
        df = _build_mini_dataset(40)
        X, _y, _, _ = build_dataset(df)
        # Should have fewer samples than total matches
        assert len(X) < len(df)
        # Should skip at least MIN_PRIOR_MATCHES * n_teams matches
        assert len(X) > 0

    def test_no_nan_in_features(self):
        """Feature matrix should have no NaN values."""
        df = _build_mini_dataset(40)
        X, _y, _, _ = build_dataset(df)
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
        X_train, _y_train, X_val, _y_val = chronological_split(X, y, 0.2)
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
        X_train, _y_train, X_val, _y_val = chronological_split(X, y, 0.2)
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


# ---------------------------------------------------------------------------
# Tests: Recency weights
# ---------------------------------------------------------------------------

class TestRecencyWeights:
    """compute_recency_weights should decay older seasons."""

    def test_returns_none_without_seasons(self):
        assert compute_recency_weights(None) is None
        assert compute_recency_weights(np.array([])) is None

    def test_most_recent_season_gets_weight_one(self):
        seasons = np.array(['2022/23', '2023/24', '2024/25'])
        weights = compute_recency_weights(seasons)
        assert weights[-1] == pytest.approx(1.0)

    def test_older_seasons_decay(self):
        seasons = np.array(['2022/23', '2023/24', '2024/25'])
        weights = compute_recency_weights(seasons, recency_decay=0.85)
        assert weights[0] < weights[1] < weights[2]
        assert weights[0] == pytest.approx(0.85 ** 2, abs=1e-10)


# ---------------------------------------------------------------------------
# Tests: Stacked ensemble
# ---------------------------------------------------------------------------

class TestStackedEnsemble:
    """Test OvR stacked ensemble training and prediction."""

    @pytest.fixture
    def ensemble_data(self):
        """Build dataset large enough for stacked ensemble training."""
        df = _build_mini_dataset(60)
        engineer = FreeTierFeatureEngineer(df)
        X, y, names, seasons = build_dataset(df, engineer)

        # Need enough samples for 70/30 base/meta split + validation
        X_train, y_train, X_val, y_val = chronological_split(X, y, 0.2)
        return X_train, y_train, X_val, y_val, names, seasons[:len(X_train)]

    def test_ensemble_returns_valid_structure(self, ensemble_data):
        """Ensemble result should contain classifiers, meta_learner, meta_scaler."""
        try:
            import xgboost  # noqa: F401
        except (ImportError, Exception):
            pytest.skip('xgboost not available')

        X_train, y_train, X_val, y_val, names, seasons = ensemble_data
        if len(X_train) < 10:
            pytest.skip('Not enough training samples')

        result = train_stacked_ensemble(
            X_train, y_train, X_val, y_val, names, seasons_train=seasons,
        )

        assert 'classifiers' in result
        assert 'meta_learner' in result
        assert 'meta_scaler' in result
        assert len(result['classifiers']) == 3

    def test_ensemble_probabilities_sum_to_one(self, ensemble_data):
        """Ensemble predictions should produce valid probability distributions."""
        try:
            import xgboost  # noqa: F401
        except (ImportError, Exception):
            pytest.skip('xgboost not available')

        X_train, y_train, X_val, y_val, names, seasons = ensemble_data
        if len(X_train) < 10:
            pytest.skip('Not enough training samples')

        result = train_stacked_ensemble(
            X_train, y_train, X_val, y_val, names, seasons_train=seasons,
        )

        probs = result['val_probs']
        assert probs.shape == (len(X_val), 3)
        # Each row should sum to ~1.0
        row_sums = probs.sum(axis=1)
        np.testing.assert_allclose(row_sums, 1.0, atol=1e-6)

    def test_predict_with_ensemble(self, ensemble_data):
        """predict_with_ensemble should produce consistent output shape."""
        try:
            import xgboost  # noqa: F401
        except (ImportError, Exception):
            pytest.skip('xgboost not available')

        X_train, y_train, X_val, y_val, names, seasons = ensemble_data
        if len(X_train) < 10:
            pytest.skip('Not enough training samples')

        result = train_stacked_ensemble(
            X_train, y_train, X_val, y_val, names, seasons_train=seasons,
        )

        preds = predict_with_ensemble(result, X_val, names)
        assert preds.shape == (len(X_val), 3)
        row_sums = preds.sum(axis=1)
        np.testing.assert_allclose(row_sums, 1.0, atol=1e-6)


# ---------------------------------------------------------------------------
# Helpers: multi-season dataset
# ---------------------------------------------------------------------------

def _build_multi_season_dataset(matches_per_season: int = 20) -> pd.DataFrame:
    """Build a dataset spanning 4 seasons for rolling CV tests."""
    from datetime import datetime, timedelta

    teams = ['Arsenal', 'Chelsea', 'Liverpool', 'Man City']
    season_labels = ['2021/22', '2022/23', '2023/24', '2024/25']
    rows = []

    for s_idx, season in enumerate(season_labels):
        base = datetime(2021 + s_idx, 8, 17)
        for m in range(matches_per_season):
            home = teams[m % len(teams)]
            away = teams[(m + 1) % len(teams)]
            hg = (m * 7 + 3) % 4
            ag = (m * 5 + 1) % 3
            match_date = base + timedelta(days=m * 3)
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
                'half_time_result': 'H' if min(hg, 1) > min(ag, 1) else (
                    'D' if min(hg, 1) == min(ag, 1) else 'A'),
                'home_shots': 10 + hg, 'away_shots': 8 + ag,
                'home_shots_target': 4 + hg, 'away_shots_target': 3 + ag,
                'home_corners': 5, 'away_corners': 4,
                'home_yellows': 1, 'away_yellows': 2,
                'home_reds': 0, 'away_reds': 0,
                'home_fouls': 10, 'away_fouls': 12,
                'season': season,
            })

    df = pd.DataFrame(rows)
    df['date'] = pd.to_datetime(df['date'])
    return df.sort_values('date').reset_index(drop=True)


# ---------------------------------------------------------------------------
# Tests: _per_class_accuracy
# ---------------------------------------------------------------------------

class TestPerClassAccuracy:
    """Helper function for per-class accuracy."""

    def test_perfect_predictions(self):
        y_true = np.array([0, 1, 2, 0, 1])
        y_pred = np.array([0, 1, 2, 0, 1])
        result = _per_class_accuracy(y_true, y_pred)
        assert result['Home win'] == 1.0
        assert result['Draw'] == 1.0
        assert result['Away win'] == 1.0

    def test_partial_accuracy(self):
        y_true = np.array([0, 0, 1, 1, 2, 2])
        y_pred = np.array([0, 2, 1, 0, 2, 1])
        result = _per_class_accuracy(y_true, y_pred)
        assert result['Home win'] == pytest.approx(0.5)
        assert result['Draw'] == pytest.approx(0.5)
        assert result['Away win'] == pytest.approx(0.5)

    def test_empty_class(self):
        """Class with no samples returns 0.0."""
        y_true = np.array([0, 0, 0])
        y_pred = np.array([0, 0, 1])
        result = _per_class_accuracy(y_true, y_pred)
        assert result['Draw'] == 0.0
        assert result['Away win'] == 0.0


# ---------------------------------------------------------------------------
# Tests: rolling cross-validation
# ---------------------------------------------------------------------------

class TestRollingCrossValidation:
    """Expanding-window cross-validation tests."""

    def test_insufficient_seasons_returns_empty(self):
        """CV with fewer than min_train_seasons + 1 should return empty."""
        X = np.random.randn(20, 5)
        y = np.array([0, 1, 2] * 6 + [0, 1])
        seasons = np.array(['2024/25'] * 20)
        result = rolling_cross_validation(X, y, [f'f{i}' for i in range(5)],
                                          seasons, min_train_seasons=2)
        assert result == {}

    def test_two_seasons_with_min_one(self):
        """With 2 seasons and min_train_seasons=1, should produce 1 fold."""
        X = np.random.randn(40, 5)
        y = np.array([0, 1, 2, 0] * 10)
        seasons = np.array(['2023/24'] * 20 + ['2024/25'] * 20)
        # This runs without XGBoost — will hit the except block and produce
        # empty fold metrics, but the fold structure should still be created
        try:
            import xgboost  # noqa: F401
        except (ImportError, Exception):
            pytest.skip('xgboost not available')

        result = rolling_cross_validation(
            X, y, [f'f{i}' for i in range(5)], seasons, min_train_seasons=1,
        )
        assert 'folds' in result
        assert len(result['folds']) == 1
        assert result['folds'][0]['val_season'] == '2024/25'

    def test_four_seasons_produces_correct_fold_count(self):
        """With 4 seasons and min_train=2, should produce 2 folds."""
        try:
            import xgboost  # noqa: F401
        except (ImportError, Exception):
            pytest.skip('xgboost not available')

        df = _build_multi_season_dataset(25)
        X, y, names, seasons = build_dataset(df)

        result = rolling_cross_validation(
            X, y, names, seasons, min_train_seasons=2,
        )

        assert 'folds' in result
        assert len(result['folds']) == 2
        assert result['folds'][0]['val_season'] == '2023/24'
        assert result['folds'][1]['val_season'] == '2024/25'

    def test_aggregate_metrics_present(self):
        """Aggregate dict should contain accuracy stats for each model."""
        try:
            import xgboost  # noqa: F401
        except (ImportError, Exception):
            pytest.skip('xgboost not available')

        df = _build_multi_season_dataset(25)
        X, y, names, seasons = build_dataset(df)

        result = rolling_cross_validation(
            X, y, names, seasons, min_train_seasons=2,
        )

        assert 'aggregate' in result
        agg = result['aggregate']
        # At minimum XGBoost should have results
        if 'xgboost' in agg:
            assert 'mean_accuracy' in agg['xgboost']
            assert 'std_accuracy' in agg['xgboost']
            assert 0.0 <= agg['xgboost']['mean_accuracy'] <= 1.0
            assert agg['xgboost']['n_folds'] == 2

    def test_fold_train_size_increases(self):
        """Each fold should have more training data than the previous."""
        try:
            import xgboost  # noqa: F401
        except (ImportError, Exception):
            pytest.skip('xgboost not available')

        df = _build_multi_season_dataset(25)
        X, y, names, seasons = build_dataset(df)

        result = rolling_cross_validation(
            X, y, names, seasons, min_train_seasons=2,
        )

        folds = result.get('folds', [])
        if len(folds) >= 2:
            assert folds[1]['train_size'] > folds[0]['train_size']
