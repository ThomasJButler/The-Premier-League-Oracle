#!/usr/bin/env python3
"""
Free-tier ML training script for Premier League match prediction.

Trains an XGBoost model (+ logistic regression baseline) on ~94 features
derived from historical CSV data. No paid API data required.

Usage:
    python train_free_tier.py                # Train with 80/20 chronological split
    python train_free_tier.py --tune         # Run hyperparameter tuning first (25 trials)
    python train_free_tier.py --tune --tune-trials 50  # More thorough search
    python train_free_tier.py --cv           # Rolling cross-validation across seasons
    python train_free_tier.py --test         # Also evaluate on 2025/26 held-out data
    python train_free_tier.py --csv-dir DIR  # Custom CSV directory

Output:
    backend/models/xgboost_free_tier.joblib  — trained model with metadata
    backend/models/calibration_curve.png     — calibration plot (if matplotlib available)
"""

import argparse
import logging
import os
import sys
from datetime import datetime

import numpy as np
import pandas as pd

# Add backend to path so we can import the feature engineer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.features.free_tier_features import FreeTierFeatureEngineer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_CSV_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    'spreadsheets', 'KnowledgeFilesCSV',
)
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'xgboost_free_tier.joblib')

LABEL_MAP = {'H': 0, 'D': 1, 'A': 2}
LABEL_NAMES = ['Home win', 'Draw', 'Away win']

# Minimum prior matches for a team before we include a match in training
MIN_PRIOR_MATCHES = 5


# ---------------------------------------------------------------------------
# Data loading and quality checks
# ---------------------------------------------------------------------------

def load_data(csv_dir: str) -> pd.DataFrame:
    """Load and validate CSV data."""
    logger.info('Loading CSV data from %s', csv_dir)
    df = FreeTierFeatureEngineer.load_csvs(csv_dir)

    # Data quality checks
    total = len(df)
    dropped = df['result'].isna().sum()
    if dropped > 0:
        logger.warning('%d rows have missing result (%.1f%%) — dropping', dropped, 100 * dropped / total)
        df = df.dropna(subset=['result'])

    # Class distribution
    dist = df['result'].value_counts()
    logger.info('Class distribution: %s', dict(dist))
    draw_pct = dist.get('D', 0) / len(df) * 100
    if draw_pct < 20 or draw_pct > 35:
        logger.warning('Draw percentage %.1f%% outside expected 20-35%% range', draw_pct)

    # Season counts
    season_counts = df['season'].value_counts().sort_index()
    logger.info('Matches per season:\n%s', season_counts.to_string())

    return df


def build_dataset(
    df: pd.DataFrame,
    engineer: FreeTierFeatureEngineer | None = None,
) -> tuple[np.ndarray, np.ndarray, list[str], np.ndarray]:
    """
    Build feature matrix from historical matches.

    Iterates chronologically. For each match, uses only prior data
    (no leakage). Skips matches where either team has < MIN_PRIOR_MATCHES.

    Returns:
        X: Feature matrix (n_samples, n_features)
        y: Labels (n_samples,) — 0=H, 1=D, 2=A
        feature_names: Ordered feature names
        seasons: Season identifier per sample (for recency weighting)
    """
    if engineer is None:
        engineer = FreeTierFeatureEngineer(df)

    feature_names = FreeTierFeatureEngineer.FEATURE_NAMES
    X_rows: list[np.ndarray] = []
    y_rows: list[int] = []
    season_rows: list[str] = []
    skipped = 0

    # Track how many matches each team has played (for warmup filter)
    team_match_counts: dict[str, int] = {}

    for _idx, row in df.iterrows():
        ht = row['home_team']
        at = row['away_team']

        # Check warmup: both teams need enough prior matches
        ht_count = team_match_counts.get(ht, 0)
        at_count = team_match_counts.get(at, 0)

        # Update counts (this match counts for future iterations)
        team_match_counts[ht] = ht_count + 1
        team_match_counts[at] = at_count + 1

        if ht_count < MIN_PRIOR_MATCHES or at_count < MIN_PRIOR_MATCHES:
            skipped += 1
            continue

        result = row.get('result')
        if result not in LABEL_MAP:
            skipped += 1
            continue

        # Compute features using only pre-match data
        match_date = row['date']
        if isinstance(match_date, pd.Timestamp):
            match_date = match_date.to_pydatetime()

        try:
            features = engineer.create_features(ht, at, match_date)
            feature_vec = np.array([features[name] for name in feature_names])
            X_rows.append(feature_vec)
            y_rows.append(LABEL_MAP[result])
            season_rows.append(str(row.get('season', '')))
        except Exception as e:
            logger.warning('Failed to compute features for %s vs %s: %s', ht, at, e)
            skipped += 1
            continue

        if len(X_rows) % 200 == 0:
            logger.info('Processed %d matches (%d skipped)...', len(X_rows), skipped)

    logger.info(
        'Dataset built: %d samples, %d skipped (warmup/invalid), %d features',
        len(X_rows), skipped, len(feature_names),
    )

    X = np.array(X_rows)
    y = np.array(y_rows)
    seasons = np.array(season_rows)
    return X, y, feature_names, seasons


def chronological_split(
    X: np.ndarray, y: np.ndarray, val_fraction: float = 0.2,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Split data chronologically (no shuffling — prevents future leakage).

    Returns: X_train, y_train, X_val, y_val
    """
    split_idx = int(len(X) * (1.0 - val_fraction))
    return X[:split_idx], y[:split_idx], X[split_idx:], y[split_idx:]


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def compute_sample_weights(
    y: np.ndarray,
    seasons: np.ndarray | None = None,
    recency_decay: float = 0.85,
) -> np.ndarray:
    """
    Compute combined sample weights: class balance × recency.

    Class weighting: inverse-frequency so draws (~23%) get higher weight.
    Recency weighting: recent seasons weighted more heavily. Each older
    season decays by `recency_decay` (0.85 = 15% less per season).

    The PL meta shifts over 5 seasons — tactics evolve, teams change
    strength, rules get updated. A 2024/25 match is more predictive
    of current outcomes than a 2020/21 match.
    """
    # 1. Class imbalance weights
    classes, counts = np.unique(y, return_counts=True)
    total = len(y)
    class_weights = {c: total / (len(classes) * cnt) for c, cnt in zip(classes, counts)}
    weights = np.array([class_weights[label] for label in y])
    logger.info(
        'Class weights: %s',
        {LABEL_NAMES[c]: f'{w:.3f}' for c, w in class_weights.items()},
    )

    # 2. Recency weights (if seasons provided)
    if seasons is not None and len(seasons) > 0:
        unique_seasons = sorted(set(seasons))
        n_seasons = len(unique_seasons)
        # Most recent season gets weight 1.0, each older season decays
        season_weight_map = {}
        for i, season in enumerate(unique_seasons):
            age = n_seasons - 1 - i  # 0 for most recent
            season_weight_map[season] = recency_decay ** age

        recency_weights = np.array([season_weight_map.get(s, 1.0) for s in seasons])
        weights = weights * recency_weights

        logger.info(
            'Recency weights: %s',
            {s: f'{w:.3f}' for s, w in season_weight_map.items()},
        )

    return weights


def compute_recency_weights(
    seasons: np.ndarray | None = None,
    recency_decay: float = 0.85,
) -> np.ndarray | None:
    """
    Compute recency-only sample weights (no class balancing).

    Used by OvR binary classifiers where class imbalance is handled via
    XGBoost's `scale_pos_weight` instead of sample weights.
    """
    if seasons is None or len(seasons) == 0:
        return None

    unique_seasons = sorted(set(seasons))
    n_seasons = len(unique_seasons)
    season_weight_map = {}
    for i, season in enumerate(unique_seasons):
        age = n_seasons - 1 - i
        season_weight_map[season] = recency_decay ** age

    return np.array([season_weight_map.get(s, 1.0) for s in seasons])


def train_xgboost(
    X_train: np.ndarray, y_train: np.ndarray,
    X_val: np.ndarray, y_val: np.ndarray,
    feature_names: list[str],
    seasons_train: np.ndarray | None = None,
    params_override: dict | None = None,
) -> dict:
    """Train XGBoost model with early stopping, class weighting, and recency weighting."""
    import xgboost as xgb

    params = {
        'objective': 'multi:softprob',
        'num_class': 3,
        'max_depth': 6,
        'learning_rate': 0.05,
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'gamma': 0.1,
        'reg_alpha': 0.05,
        'reg_lambda': 1.0,
        'min_child_weight': 3,
        'seed': 42,
        'eval_metric': 'mlogloss',
        'verbosity': 0,
    }
    if params_override:
        params.update(params_override)

    # Compute sample weights: class balance × recency
    sample_weights = compute_sample_weights(y_train, seasons=seasons_train)

    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=feature_names,
                         weight=sample_weights)
    dval = xgb.DMatrix(X_val, label=y_val, feature_names=feature_names)

    evals_result: dict = {}
    model = xgb.train(
        params,
        dtrain,
        num_boost_round=1000,
        evals=[(dtrain, 'train'), (dval, 'val')],
        early_stopping_rounds=50,
        evals_result=evals_result,
        verbose_eval=False,
    )

    best_iteration = model.best_iteration
    best_score = evals_result['val']['mlogloss'][best_iteration]

    # Feature importance
    importance = model.get_score(importance_type='gain')
    # Normalise importance values
    total_imp = sum(importance.values()) if importance else 1.0
    importance = {k: v / total_imp for k, v in importance.items()}

    logger.info('XGBoost trained: best iteration %d, val mlogloss %.4f', best_iteration, best_score)

    return {
        'model': model,
        'params': params,
        'best_iteration': best_iteration,
        'best_score': best_score,
        'importance': importance,
        'evals_result': evals_result,
    }


def select_features(
    X_train: np.ndarray, y_train: np.ndarray,
    X_val: np.ndarray,
    feature_names: list[str],
    importance: dict[str, float],
    min_importance: float = 0.005,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """
    Drop features with importance below threshold.

    With 86 features for ~1,680 training samples, low-importance features
    are noise that the model memorises (overfitting). Pruning improves
    generalisation on unseen data.

    Returns filtered X_train, X_val, and feature_names.
    """
    keep_indices = []
    keep_names = []
    dropped = []

    for i, name in enumerate(feature_names):
        imp = importance.get(name, 0.0)
        if imp >= min_importance:
            keep_indices.append(i)
            keep_names.append(name)
        else:
            dropped.append(name)

    if not keep_indices:
        logger.warning('Feature selection would drop ALL features — skipping')
        return X_train, X_val, feature_names

    logger.info(
        'Feature selection: keeping %d/%d features (dropped %d with importance < %.4f)',
        len(keep_indices), len(feature_names), len(dropped), min_importance,
    )
    if dropped:
        logger.info('Dropped features: %s', ', '.join(sorted(dropped)[:10]))
        if len(dropped) > 10:
            logger.info('  ... and %d more', len(dropped) - 10)

    X_train_sel = X_train[:, keep_indices]
    X_val_sel = X_val[:, keep_indices]
    return X_train_sel, X_val_sel, keep_names


def calibrate_probabilities(
    model, X_val: np.ndarray, y_val: np.ndarray,
    feature_names: list[str],
) -> dict:
    """
    Calibrate XGBoost probabilities using isotonic regression.

    Raw XGBoost probabilities are often overconfident — log loss was 1.034
    for 51% accuracy (well-calibrated would be ~0.95). Calibration maps
    predicted probabilities to observed frequencies using a held-out set.

    Uses a simple wrapper that calibrates each class independently with
    isotonic regression, then re-normalises to sum to 1.
    """
    import xgboost as xgb
    from sklearn.isotonic import IsotonicRegression

    dval = xgb.DMatrix(X_val, feature_names=feature_names)
    raw_probs = model.predict(dval)

    calibrators = []
    for class_idx in range(3):
        binary_target = (y_val == class_idx).astype(float)
        ir = IsotonicRegression(out_of_bounds='clip')
        ir.fit(raw_probs[:, class_idx], binary_target)
        calibrators.append(ir)

    # Verify calibration improves on val set
    cal_probs = np.column_stack([
        cal.predict(raw_probs[:, i]) for i, cal in enumerate(calibrators)
    ])
    # Re-normalise rows to sum to 1
    row_sums = cal_probs.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0  # prevent division by zero
    cal_probs = cal_probs / row_sums

    from sklearn.metrics import log_loss
    raw_ll = log_loss(y_val, raw_probs, labels=[0, 1, 2])
    cal_ll = log_loss(y_val, cal_probs, labels=[0, 1, 2])
    logger.info(
        'Calibration: log loss %.4f → %.4f (%+.4f)',
        raw_ll, cal_ll, cal_ll - raw_ll,
    )

    return {
        'calibrators': calibrators,
        'raw_log_loss': raw_ll,
        'calibrated_log_loss': cal_ll,
    }


def tune_hyperparameters(
    X_train: np.ndarray, y_train: np.ndarray,
    X_val: np.ndarray, y_val: np.ndarray,
    feature_names: list[str],
    seasons_train: np.ndarray | None = None,
    n_trials: int = 25,
    seed: int = 42,
) -> dict:
    """
    Random search over XGBoost hyperparameters.

    Uses chronological train/val split (no shuffled CV) to avoid data leakage.
    Evaluates `n_trials` random parameter combinations and returns the best.

    No additional dependencies required — uses numpy random sampling.
    """
    import xgboost as xgb

    rng = np.random.RandomState(seed)

    # Search space
    search_space = {
        'max_depth': [3, 4, 5, 6, 7, 8],
        'learning_rate': [0.01, 0.02, 0.05, 0.08, 0.1],
        'min_child_weight': [1, 2, 3, 5, 7],
        'subsample': [0.6, 0.7, 0.8, 0.9, 1.0],
        'colsample_bytree': [0.6, 0.7, 0.8, 0.9, 1.0],
        'gamma': [0.0, 0.05, 0.1, 0.2, 0.5],
        'reg_alpha': [0.0, 0.01, 0.05, 0.1, 0.5],
        'reg_lambda': [0.5, 1.0, 2.0, 5.0],
    }

    sample_weights = compute_sample_weights(y_train, seasons=seasons_train)
    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=feature_names,
                         weight=sample_weights)
    dval = xgb.DMatrix(X_val, label=y_val, feature_names=feature_names)

    best_score = float('inf')
    best_params: dict = {}
    results = []

    logger.info('Hyperparameter tuning: %d trials...', n_trials)

    for trial in range(n_trials):
        params = {
            'objective': 'multi:softprob',
            'num_class': 3,
            'eval_metric': 'mlogloss',
            'verbosity': 0,
            'seed': seed,
        }
        for key, choices in search_space.items():
            params[key] = choices[rng.randint(len(choices))]

        evals_result: dict = {}
        model = xgb.train(
            params,
            dtrain,
            num_boost_round=500,
            evals=[(dval, 'val')],
            early_stopping_rounds=30,
            evals_result=evals_result,
            verbose_eval=False,
        )

        score = evals_result['val']['mlogloss'][model.best_iteration]
        results.append({'params': params.copy(), 'score': score, 'iterations': model.best_iteration})

        if score < best_score:
            best_score = score
            best_params = params.copy()
            logger.info(
                '  Trial %d/%d: mlogloss=%.4f (NEW BEST) — depth=%d, lr=%.3f, mcw=%d',
                trial + 1, n_trials, score,
                params['max_depth'], params['learning_rate'], params['min_child_weight'],
            )
        elif (trial + 1) % 5 == 0:
            logger.info('  Trial %d/%d: mlogloss=%.4f (best=%.4f)', trial + 1, n_trials, score, best_score)

    # Sort by score and show top 5
    results.sort(key=lambda r: r['score'])
    logger.info('\nTop 5 parameter sets:')
    for i, r in enumerate(results[:5], 1):
        p = r['params']
        logger.info(
            '  %d. mlogloss=%.4f — depth=%d, lr=%.3f, mcw=%d, sub=%.1f, col=%.1f, iters=%d',
            i, r['score'], p['max_depth'], p['learning_rate'],
            p['min_child_weight'], p['subsample'], p['colsample_bytree'],
            r['iterations'],
        )

    # Remove non-XGBoost keys from best_params (keep only training params)
    logger.info('\nBest params (mlogloss=%.4f): %s', best_score, {
        k: v for k, v in best_params.items()
        if k not in ('objective', 'num_class', 'eval_metric', 'verbosity', 'seed')
    })

    return best_params


def train_logistic_baseline(
    X_train: np.ndarray, y_train: np.ndarray,
    X_val: np.ndarray, y_val: np.ndarray,
) -> dict:
    """Train logistic regression baseline for comparison."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_val_s = scaler.transform(X_val)

    lr = LogisticRegression(
        max_iter=1000, multi_class='multinomial', solver='lbfgs',
        random_state=42,
    )
    lr.fit(X_train_s, y_train)

    val_preds = lr.predict(X_val_s)
    val_probs = lr.predict_proba(X_val_s)
    accuracy = float(np.mean(val_preds == y_val))

    logger.info('Logistic Regression baseline: val accuracy %.4f', accuracy)

    return {
        'model': lr,
        'scaler': scaler,
        'accuracy': accuracy,
        'val_probs': val_probs,
    }


def train_stacked_ensemble(
    X_train: np.ndarray, y_train: np.ndarray,
    X_val: np.ndarray, y_val: np.ndarray,
    feature_names: list[str],
    seasons_train: np.ndarray | None = None,
) -> dict:
    """
    Train a stacked ensemble of 3 One-vs-Rest binary classifiers + meta-learner.

    Architecture:
      Level 0: Three XGBoost binary classifiers (Home-vs-rest, Draw-vs-rest, Away-vs-rest)
      Level 1: Logistic regression meta-learner on OvR probability triplets

    Why this works for draws:
      The multi:softprob model minimises overall log loss, which under-predicts
      the minority class (draws ~23%). A dedicated draw binary classifier with
      tuned scale_pos_weight and conservative hyperparameters can learn subtle
      draw patterns that get lost in the 3-class optimisation.

    To avoid data leakage in meta-learner training, training data is split
    chronologically: first 70% trains base classifiers, last 30% generates
    predictions for meta-learner training. Final base classifiers are then
    retrained on the full training set.

    Returns dict with classifiers, meta_learner, meta_scaler, and val_probs.
    """
    import xgboost as xgb
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    # Per-class hyperparameters — draw classifier is more conservative
    class_configs = {
        0: {  # Home win
            'max_depth': 6, 'learning_rate': 0.05, 'min_child_weight': 3,
            'subsample': 0.8, 'colsample_bytree': 0.8, 'gamma': 0.1,
            'reg_alpha': 0.05, 'reg_lambda': 1.0,
        },
        1: {  # Draw — shallower trees, lower LR, more regularisation
            'max_depth': 4, 'learning_rate': 0.03, 'min_child_weight': 5,
            'subsample': 0.8, 'colsample_bytree': 0.7, 'gamma': 0.2,
            'reg_alpha': 0.1, 'reg_lambda': 2.0,
        },
        2: {  # Away win
            'max_depth': 6, 'learning_rate': 0.05, 'min_child_weight': 3,
            'subsample': 0.8, 'colsample_bytree': 0.8, 'gamma': 0.1,
            'reg_alpha': 0.05, 'reg_lambda': 1.0,
        },
    }

    # Chronological split of training data for meta-learner
    meta_split = int(len(X_train) * 0.7)
    X_base = X_train[:meta_split]
    y_base = y_train[:meta_split]
    X_meta_train = X_train[meta_split:]
    y_meta_train = y_train[meta_split:]
    seasons_base = seasons_train[:meta_split] if seasons_train is not None else None
    recency_base = compute_recency_weights(seasons_base)

    logger.info(
        'Stacked ensemble: %d base-train, %d meta-train, %d validation',
        len(X_base), len(X_meta_train), len(X_val),
    )

    # ---- Stage 1: Train base classifiers on base-split for OOF predictions ----
    meta_probs = np.zeros((len(X_meta_train), 3))

    for class_idx, class_name in enumerate(LABEL_NAMES):
        y_bin_base = (y_base == class_idx).astype(int)
        y_bin_meta = (y_meta_train == class_idx).astype(int)

        n_pos = int(y_bin_base.sum())
        n_neg = len(y_bin_base) - n_pos
        spw = n_neg / max(n_pos, 1)

        config = class_configs[class_idx]
        params = {
            'objective': 'binary:logistic',
            'eval_metric': 'logloss',
            'scale_pos_weight': spw,
            'seed': 42,
            'verbosity': 0,
            **config,
        }

        dtrain = xgb.DMatrix(X_base, label=y_bin_base, feature_names=feature_names,
                             weight=recency_base)
        dmeta = xgb.DMatrix(X_meta_train, label=y_bin_meta, feature_names=feature_names)

        model = xgb.train(
            params, dtrain, num_boost_round=500,
            evals=[(dmeta, 'val')],
            early_stopping_rounds=30,
            verbose_eval=False,
        )

        meta_probs[:, class_idx] = model.predict(dmeta)
        logger.info(
            '  Base %s classifier (stage 1): best iter %d, scale_pos_weight=%.2f',
            class_name, model.best_iteration, spw,
        )

    # ---- Stage 2: Train meta-learner on OOF predictions ----
    scaler = StandardScaler()
    meta_probs_scaled = scaler.fit_transform(meta_probs)

    meta_learner = LogisticRegression(
        max_iter=1000, multi_class='multinomial', solver='lbfgs',
        random_state=42,
    )
    meta_learner.fit(meta_probs_scaled, y_meta_train)

    meta_train_acc = float(np.mean(
        meta_learner.predict(meta_probs_scaled) == y_meta_train
    ))
    logger.info('  Meta-learner accuracy on meta-train: %.1f%%', meta_train_acc * 100)

    # ---- Stage 3: Retrain base classifiers on FULL training data ----
    recency_full = compute_recency_weights(seasons_train)
    final_classifiers = []

    for class_idx, class_name in enumerate(LABEL_NAMES):
        y_bin_full = (y_train == class_idx).astype(int)
        y_bin_val = (y_val == class_idx).astype(int)

        n_pos = int(y_bin_full.sum())
        n_neg = len(y_bin_full) - n_pos
        spw = n_neg / max(n_pos, 1)

        config = class_configs[class_idx]
        params = {
            'objective': 'binary:logistic',
            'eval_metric': 'logloss',
            'scale_pos_weight': spw,
            'seed': 42,
            'verbosity': 0,
            **config,
        }

        evals_result: dict = {}
        dtrain = xgb.DMatrix(X_train, label=y_bin_full, feature_names=feature_names,
                             weight=recency_full)
        dval = xgb.DMatrix(X_val, label=y_bin_val, feature_names=feature_names)

        model = xgb.train(
            params, dtrain, num_boost_round=500,
            evals=[(dtrain, 'train'), (dval, 'val')],
            early_stopping_rounds=30,
            evals_result=evals_result,
            verbose_eval=False,
        )

        val_loss = evals_result['val']['logloss'][model.best_iteration]
        final_classifiers.append(model)
        logger.info(
            '  Final %s classifier: best iter %d, val logloss %.4f',
            class_name, model.best_iteration, val_loss,
        )

    # ---- Generate ensemble predictions on validation set ----
    dval = xgb.DMatrix(X_val, feature_names=feature_names)
    ovr_probs = np.column_stack([
        clf.predict(dval) for clf in final_classifiers
    ])

    ovr_scaled = scaler.transform(ovr_probs)
    ensemble_probs = meta_learner.predict_proba(ovr_scaled)

    return {
        'classifiers': final_classifiers,
        'meta_learner': meta_learner,
        'meta_scaler': scaler,
        'class_configs': class_configs,
        'val_probs': ensemble_probs,
    }


def predict_with_ensemble(
    ensemble: dict,
    X: np.ndarray,
    feature_names: list[str],
) -> np.ndarray:
    """
    Generate predictions from the stacked ensemble.

    Takes the ensemble dict (classifiers, meta_learner, meta_scaler) and
    returns an (n_samples, 3) probability matrix.
    """
    import xgboost as xgb

    dmatrix = xgb.DMatrix(X, feature_names=feature_names)
    ovr_probs = np.column_stack([
        clf.predict(dmatrix) for clf in ensemble['classifiers']
    ])
    ovr_scaled = ensemble['meta_scaler'].transform(ovr_probs)
    return ensemble['meta_learner'].predict_proba(ovr_scaled)


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

def evaluate(
    y_true: np.ndarray, y_probs: np.ndarray, label: str = 'Model',
) -> dict[str, float]:
    """Compute evaluation metrics."""
    from sklearn.metrics import (
        accuracy_score,
        confusion_matrix,
        log_loss,
    )

    y_pred = np.argmax(y_probs, axis=1)
    acc = accuracy_score(y_true, y_pred)
    logloss = log_loss(y_true, y_probs, labels=[0, 1, 2])

    # Brier score (multi-class: average squared error)
    y_onehot = np.zeros_like(y_probs)
    y_onehot[np.arange(len(y_true)), y_true] = 1
    brier = float(np.mean(np.sum((y_probs - y_onehot) ** 2, axis=1)))

    # Per-class accuracy
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1, 2])
    per_class_acc = {}
    for i, name in enumerate(LABEL_NAMES):
        total = cm[i].sum()
        correct = cm[i][i]
        per_class_acc[name] = correct / total if total > 0 else 0.0

    logger.info('\n=== %s Evaluation ===', label)
    logger.info('Overall accuracy: %.4f (%.1f%%)', acc, acc * 100)
    logger.info('Log loss: %.4f', logloss)
    logger.info('Brier score: %.4f', brier)
    for name, pacc in per_class_acc.items():
        logger.info('  %s accuracy: %.1f%%', name, pacc * 100)
    logger.info('Confusion matrix:\n%s', cm)

    # Per-class AUC-ROC
    auc_scores = {}
    try:
        from sklearn.metrics import roc_auc_score
        for i, name in enumerate(LABEL_NAMES):
            binary = (y_true == i).astype(int)
            if binary.sum() > 0 and binary.sum() < len(binary):
                auc = roc_auc_score(binary, y_probs[:, i])
                auc_scores[name] = float(auc)
                logger.info('  %s AUC-ROC: %.4f', name, auc)
    except Exception:
        pass

    return {
        'accuracy': float(acc),
        'log_loss': float(logloss),
        'brier_score': brier,
        'per_class_accuracy': per_class_acc,
        'auc_scores': auc_scores,
    }


def rolling_cross_validation(
    X: np.ndarray, y: np.ndarray,
    feature_names: list[str],
    seasons: np.ndarray,
    min_train_seasons: int = 2,
) -> dict:
    """
    Expanding-window cross-validation, split by season.

    Instead of a single 80/20 split (which can be misleading if that
    particular validation season is atypical), this trains on seasons
    1..k and validates on season k+1 for each fold.

    For 6 seasons (2020/21-2025/26) with min_train_seasons=2, this
    produces 4 folds:
      Fold 1: train 2020/21-2021/22, validate 2022/23
      Fold 2: train 2020/21-2022/23, validate 2023/24
      Fold 3: train 2020/21-2023/24, validate 2024/25
      Fold 4: train 2020/21-2024/25, validate 2025/26

    Returns aggregate and per-fold metrics for XGBoost (calibrated),
    logistic regression, and stacked ensemble.
    """
    from sklearn.metrics import accuracy_score, log_loss

    unique_seasons = sorted(set(seasons))
    n_seasons = len(unique_seasons)

    if n_seasons < min_train_seasons + 1:
        logger.warning(
            'Not enough seasons for CV (%d seasons, need %d + 1)',
            n_seasons, min_train_seasons,
        )
        return {}

    fold_results = []

    for fold_idx in range(min_train_seasons, n_seasons):
        train_seasons = set(unique_seasons[:fold_idx])
        val_season = unique_seasons[fold_idx]

        train_mask = np.array([s in train_seasons for s in seasons])
        val_mask = seasons == val_season

        X_train_fold = X[train_mask]
        y_train_fold = y[train_mask]
        X_val_fold = X[val_mask]
        y_val_fold = y[val_mask]
        seasons_train_fold = seasons[train_mask]

        if len(X_val_fold) == 0:
            logger.warning('Fold %d: no validation samples for %s — skipping', fold_idx, val_season)
            continue

        logger.info(
            '\n=== Rolling CV Fold %d/%d: train %s, validate %s (%d→%d samples) ===',
            fold_idx - min_train_seasons + 1,
            n_seasons - min_train_seasons,
            f'{unique_seasons[0]}–{unique_seasons[fold_idx - 1]}',
            val_season,
            len(X_train_fold), len(X_val_fold),
        )

        fold_metrics: dict[str, dict] = {}

        # --- XGBoost (with calibration) ---
        try:
            xgb_res = train_xgboost(
                X_train_fold, y_train_fold,
                X_val_fold, y_val_fold,
                feature_names,
                seasons_train=seasons_train_fold,
            )
            import xgboost as xgb
            dval = xgb.DMatrix(X_val_fold, feature_names=feature_names)
            raw_probs = xgb_res['model'].predict(dval)

            # Calibrate
            cal_res = calibrate_probabilities(
                xgb_res['model'], X_val_fold, y_val_fold, feature_names,
            )
            cal_probs = np.column_stack([
                cal.predict(raw_probs[:, i])
                for i, cal in enumerate(cal_res['calibrators'])
            ])
            row_sums = cal_probs.sum(axis=1, keepdims=True)
            row_sums[row_sums == 0] = 1.0
            cal_probs = cal_probs / row_sums

            xgb_preds = np.argmax(cal_probs, axis=1)
            fold_metrics['xgboost'] = {
                'accuracy': float(accuracy_score(y_val_fold, xgb_preds)),
                'log_loss': float(log_loss(y_val_fold, cal_probs, labels=[0, 1, 2])),
                'per_class': _per_class_accuracy(y_val_fold, xgb_preds),
            }
        except Exception as e:
            logger.warning('Fold %d XGBoost failed: %s', fold_idx, e)

        # --- Logistic Regression baseline ---
        try:
            lr_res = train_logistic_baseline(
                X_train_fold, y_train_fold, X_val_fold, y_val_fold,
            )
            lr_preds = np.argmax(lr_res['val_probs'], axis=1)
            fold_metrics['lr'] = {
                'accuracy': float(accuracy_score(y_val_fold, lr_preds)),
                'log_loss': float(log_loss(y_val_fold, lr_res['val_probs'], labels=[0, 1, 2])),
                'per_class': _per_class_accuracy(y_val_fold, lr_preds),
            }
        except Exception as e:
            logger.warning('Fold %d LR failed: %s', fold_idx, e)

        # --- Stacked Ensemble ---
        try:
            if len(X_train_fold) >= 30:
                ens_res = train_stacked_ensemble(
                    X_train_fold, y_train_fold,
                    X_val_fold, y_val_fold,
                    feature_names,
                    seasons_train=seasons_train_fold,
                )
                ens_preds = np.argmax(ens_res['val_probs'], axis=1)
                fold_metrics['ensemble'] = {
                    'accuracy': float(accuracy_score(y_val_fold, ens_preds)),
                    'log_loss': float(log_loss(y_val_fold, ens_res['val_probs'], labels=[0, 1, 2])),
                    'per_class': _per_class_accuracy(y_val_fold, ens_preds),
                }
            else:
                logger.info('  Skipping ensemble — too few training samples (%d)', len(X_train_fold))
        except Exception as e:
            logger.warning('Fold %d Ensemble failed: %s', fold_idx, e)

        # Log fold summary
        for model_name, m in fold_metrics.items():
            pc = m['per_class']
            logger.info(
                '  %-12s acc=%.1f%% | H=%.1f%% D=%.1f%% A=%.1f%% | logloss=%.3f',
                model_name, m['accuracy'] * 100,
                pc.get('Home win', 0) * 100, pc.get('Draw', 0) * 100,
                pc.get('Away win', 0) * 100, m['log_loss'],
            )

        fold_results.append({
            'fold': fold_idx - min_train_seasons + 1,
            'val_season': val_season,
            'train_size': len(X_train_fold),
            'val_size': len(X_val_fold),
            'metrics': fold_metrics,
        })

    # --- Aggregate ---
    if not fold_results:
        logger.warning('No CV folds completed')
        return {}

    logger.info('\n=== Rolling CV Summary ===')

    aggregate: dict[str, dict] = {}
    for model_name in ('xgboost', 'lr', 'ensemble'):
        accs = [f['metrics'][model_name]['accuracy']
                for f in fold_results if model_name in f['metrics']]
        lls = [f['metrics'][model_name]['log_loss']
               for f in fold_results if model_name in f['metrics']]

        if not accs:
            continue

        draw_accs = [f['metrics'][model_name]['per_class'].get('Draw', 0)
                     for f in fold_results if model_name in f['metrics']]

        agg = {
            'mean_accuracy': float(np.mean(accs)),
            'std_accuracy': float(np.std(accs)),
            'mean_log_loss': float(np.mean(lls)),
            'mean_draw_accuracy': float(np.mean(draw_accs)),
            'n_folds': len(accs),
            'per_fold_accuracy': accs,
        }
        aggregate[model_name] = agg

        logger.info(
            '  %-12s mean_acc=%.1f%% (±%.1f%%) | draw=%.1f%% | logloss=%.3f | %d folds',
            model_name, agg['mean_accuracy'] * 100, agg['std_accuracy'] * 100,
            agg['mean_draw_accuracy'] * 100, agg['mean_log_loss'],
            agg['n_folds'],
        )

    return {
        'folds': fold_results,
        'aggregate': aggregate,
    }


def _per_class_accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    """Compute per-class accuracy from predictions."""
    from sklearn.metrics import confusion_matrix
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1, 2])
    result = {}
    for i, name in enumerate(LABEL_NAMES):
        total = cm[i].sum()
        result[name] = cm[i][i] / total if total > 0 else 0.0
    return result


def save_calibration_curve(y_true: np.ndarray, y_probs: np.ndarray,
                           output_path: str) -> None:
    """Save calibration curve as PNG (best-effort — skips if matplotlib unavailable)."""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        from sklearn.calibration import calibration_curve

        _fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        for i, (name, ax) in enumerate(zip(LABEL_NAMES, axes)):
            binary = (y_true == i).astype(int)
            if binary.sum() == 0:
                continue
            prob_true, prob_pred = calibration_curve(
                binary, y_probs[:, i], n_bins=10, strategy='uniform',
            )
            ax.plot(prob_pred, prob_true, 's-', label=name)
            ax.plot([0, 1], [0, 1], 'k--', alpha=0.5)
            ax.set_xlabel('Predicted probability')
            ax.set_ylabel('Actual frequency')
            ax.set_title(f'{name} calibration')
            ax.legend()

        plt.tight_layout()
        plt.savefig(output_path, dpi=150)
        plt.close()
        logger.info('Calibration curve saved to %s', output_path)
    except ImportError:
        logger.warning('matplotlib not available — skipping calibration curve')
    except Exception as e:
        logger.warning('Failed to save calibration curve: %s', e)


# ---------------------------------------------------------------------------
# Model saving
# ---------------------------------------------------------------------------

def save_model(xgb_result: dict, feature_names: list[str],
               metrics: dict, training_info: dict,
               ensemble_result: dict | None = None,
               ensemble_metrics: dict | None = None,
               ) -> str:
    """Save trained model with metadata to joblib."""
    import joblib

    os.makedirs(MODEL_DIR, exist_ok=True)

    payload = {
        'model': xgb_result['model'],
        'calibrators': xgb_result.get('calibrators'),
        'feature_names': feature_names,
        'params': xgb_result['params'],
        'feature_importance': xgb_result['importance'],
        'version': '3.0.0-free',
        'tier': 'free',
        'training_date': datetime.utcnow().isoformat(),
        'training_samples': training_info.get('training_samples', 0),
        'validation_accuracy': metrics.get('accuracy', 0.0),
        'validation_log_loss': metrics.get('log_loss', 0.0),
        'training_seasons': training_info.get('seasons', []),
        'metrics': metrics,
    }

    # Include stacked ensemble if trained
    if ensemble_result is not None:
        payload['stacked_ensemble'] = {
            'classifiers': ensemble_result['classifiers'],
            'meta_learner': ensemble_result['meta_learner'],
            'meta_scaler': ensemble_result['meta_scaler'],
        }
        if ensemble_metrics is not None:
            payload['ensemble_metrics'] = ensemble_metrics
        logger.info('Stacked ensemble included in model file')

    joblib.dump(payload, MODEL_PATH)
    logger.info('Model saved to %s', MODEL_PATH)
    return MODEL_PATH


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Train free-tier ML model')
    parser.add_argument(
        '--csv-dir', default=os.environ.get('CSV_DIR', DEFAULT_CSV_DIR),
        help='Directory containing EPL*.csv files',
    )
    parser.add_argument(
        '--test', action='store_true',
        help='Also evaluate on 2025/26 held-out data',
    )
    parser.add_argument(
        '--tune', action='store_true',
        help='Run hyperparameter tuning before final training (random search, ~25 trials)',
    )
    parser.add_argument(
        '--tune-trials', type=int, default=25,
        help='Number of hyperparameter search trials (default: 25)',
    )
    parser.add_argument(
        '--cv', action='store_true',
        help='Run rolling (expanding-window) cross-validation across seasons',
    )
    args = parser.parse_args()

    # 1. Load data
    df = load_data(args.csv_dir)
    seasons = sorted(df['season'].unique())

    # 2. Build feature matrix
    logger.info('Building feature matrix...')
    engineer = FreeTierFeatureEngineer(df)
    X, y, feature_names, sample_seasons = build_dataset(df, engineer)

    if len(X) < 50:
        logger.error('Too few samples (%d) — need at least 50 to train', len(X))
        sys.exit(1)

    # 2b. Optional rolling cross-validation (evaluation only — does not affect
    #     the final model, just gives robust accuracy estimates across seasons)
    if args.cv:
        logger.info('\n' + '=' * 60)
        logger.info('ROLLING CROSS-VALIDATION')
        logger.info('=' * 60)
        cv_results = rolling_cross_validation(
            X, y, feature_names, sample_seasons, min_train_seasons=2,
        )
        if cv_results:
            logger.info('\nCV complete — proceeding with final model training...\n')

    # 3. Chronological split (also split seasons array for recency weighting)
    X_train, y_train, X_val, y_val = chronological_split(X, y, val_fraction=0.2)
    split_idx = int(len(X) * 0.8)
    seasons_train = sample_seasons[:split_idx]
    logger.info(
        'Split: %d training, %d validation (%.0f%%/%.0f%%)',
        len(X_train), len(X_val),
        100 * len(X_train) / len(X), 100 * len(X_val) / len(X),
    )

    # 4. Optional hyperparameter tuning
    tuned_params: dict | None = None
    if args.tune:
        logger.info('Running hyperparameter tuning (%d trials)...', args.tune_trials)
        tuned_params = tune_hyperparameters(
            X_train, y_train, X_val, y_val, feature_names,
            seasons_train=seasons_train, n_trials=args.tune_trials,
        )

    # 5. First XGBoost pass (all features — to get importance scores)
    logger.info('Training XGBoost (first pass — all %d features)...', len(feature_names))
    import xgboost as xgb
    xgb_result_v1 = train_xgboost(X_train, y_train, X_val, y_val, feature_names,
                                   seasons_train=seasons_train,
                                   params_override=tuned_params)

    # 5. Feature selection — drop low-importance features and retrain
    X_train_sel, X_val_sel, sel_feature_names = select_features(
        X_train, y_train, X_val, feature_names,
        importance=xgb_result_v1['importance'],
        min_importance=0.005,
    )

    if len(sel_feature_names) < len(feature_names):
        logger.info('Retraining XGBoost with %d selected features...', len(sel_feature_names))
        xgb_result = train_xgboost(X_train_sel, y_train, X_val_sel, y_val, sel_feature_names,
                                   seasons_train=seasons_train,
                                   params_override=tuned_params)
        active_feature_names = sel_feature_names
        X_train_active, X_val_active = X_train_sel, X_val_sel
    else:
        logger.info('No features dropped — using first-pass model')
        xgb_result = xgb_result_v1
        active_feature_names = feature_names
        X_train_active, X_val_active = X_train, X_val

    # 6. Evaluate raw XGBoost
    dval = xgb.DMatrix(X_val_active, feature_names=active_feature_names)
    xgb_probs_raw = xgb_result['model'].predict(dval)
    evaluate(y_val, xgb_probs_raw, label='XGBoost (raw)')

    # 7. Probability calibration
    logger.info('Calibrating probabilities...')
    cal_result = calibrate_probabilities(
        xgb_result['model'], X_val_active, y_val, active_feature_names,
    )

    # Use calibrated probabilities for final evaluation
    cal_probs = np.column_stack([
        cal.predict(xgb_probs_raw[:, i])
        for i, cal in enumerate(cal_result['calibrators'])
    ])
    row_sums = cal_probs.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    cal_probs = cal_probs / row_sums

    xgb_metrics = evaluate(y_val, cal_probs, label='XGBoost (calibrated)')
    xgb_probs = cal_probs

    # 8. Train and evaluate logistic regression baseline
    logger.info('Training logistic regression baseline...')
    lr_result = train_logistic_baseline(X_train_active, y_train, X_val_active, y_val)
    lr_metrics = evaluate(y_val, lr_result['val_probs'], label='Logistic Regression')

    # 9. Train stacked ensemble (OvR binary classifiers + meta-learner)
    logger.info('\n=== Training Stacked Ensemble ===')
    ensemble_result = train_stacked_ensemble(
        X_train_active, y_train, X_val_active, y_val,
        active_feature_names, seasons_train=seasons_train,
    )
    ensemble_metrics = evaluate(y_val, ensemble_result['val_probs'], label='Stacked Ensemble')

    # 10. Comparison (all three models)
    xgb_acc = xgb_metrics['accuracy']
    lr_acc = lr_metrics['accuracy']
    ens_acc = ensemble_metrics['accuracy']
    logger.info(
        '\n=== Model Comparison ===\n'
        'Stacked Ensemble: %.1f%% | XGBoost (calibrated): %.1f%% | LR baseline: %.1f%%',
        ens_acc * 100, xgb_acc * 100, lr_acc * 100,
    )
    logger.info(
        'Ensemble vs XGBoost: %+.1f%% | Ensemble vs LR: %+.1f%%',
        (ens_acc - xgb_acc) * 100, (ens_acc - lr_acc) * 100,
    )

    # Per-class comparison
    xgb_per = xgb_metrics.get('per_class_accuracy', {})
    ens_per = ensemble_metrics.get('per_class_accuracy', {})
    logger.info('\n  Per-class accuracy (Ensemble vs XGBoost):')
    for name in LABEL_NAMES:
        e = ens_per.get(name, 0) * 100
        x = xgb_per.get(name, 0) * 100
        logger.info('    %-10s %5.1f%% vs %5.1f%% (%+.1f%%)', name, e, x, e - x)

    # 11. Top features
    sorted_imp = sorted(
        xgb_result['importance'].items(), key=lambda x: x[1], reverse=True,
    )
    logger.info('\n=== Top 20 Features ===')
    for i, (name, imp) in enumerate(sorted_imp[:20], 1):
        logger.info('  %2d. %-35s %.4f', i, name, imp)

    # 12. Save model (with calibrators, selected features, and stacked ensemble)
    training_info = {
        'training_samples': len(X_train_active),
        'seasons': seasons,
    }
    xgb_result['calibrators'] = cal_result['calibrators']
    save_model(
        xgb_result, active_feature_names, xgb_metrics, training_info,
        ensemble_result=ensemble_result,
        ensemble_metrics=ensemble_metrics,
    )

    # 12. Calibration curve
    cal_path = os.path.join(MODEL_DIR, 'calibration_curve.png')
    save_calibration_curve(y_val, xgb_probs, cal_path)

    # 13. Optional: held-out test on 2025/26 season
    if args.test:
        test_mask = df['season'].str.startswith('2025')
        if test_mask.any():
            logger.info('\n=== Held-out test: 2025/26 season ===')
            test_df = df[test_mask]
            # Build test features using ALL prior data
            test_engineer = FreeTierFeatureEngineer(df)
            all_feature_names = FreeTierFeatureEngineer.FEATURE_NAMES
            X_test_rows = []
            y_test_rows = []
            for _, row in test_df.iterrows():
                result = row.get('result')
                if result not in LABEL_MAP:
                    continue
                match_date = row['date']
                if isinstance(match_date, pd.Timestamp):
                    match_date = match_date.to_pydatetime()
                try:
                    features = test_engineer.create_features(
                        row['home_team'], row['away_team'], match_date,
                    )
                    vec = [features[name] for name in all_feature_names]
                    X_test_rows.append(vec)
                    y_test_rows.append(LABEL_MAP[result])
                except Exception:
                    continue

            if X_test_rows:
                X_test = np.array(X_test_rows)
                y_test = np.array(y_test_rows)
                # Apply same feature selection as training
                sel_indices = [all_feature_names.index(n) for n in active_feature_names]
                X_test_sel = X_test[:, sel_indices]
                dtest = xgb.DMatrix(X_test_sel, feature_names=active_feature_names)
                test_probs_raw = xgb_result['model'].predict(dtest)
                # Apply calibration
                test_probs = np.column_stack([
                    cal.predict(test_probs_raw[:, i])
                    for i, cal in enumerate(cal_result['calibrators'])
                ])
                row_sums = test_probs.sum(axis=1, keepdims=True)
                row_sums[row_sums == 0] = 1.0
                test_probs = test_probs / row_sums
                evaluate(y_test, test_probs, label='Held-out 2025/26')
            else:
                logger.warning('No test samples from 2025/26 season')
        else:
            logger.warning('No 2025/26 data found for held-out test')

    logger.info('\nTraining complete.')


if __name__ == '__main__':
    main()
