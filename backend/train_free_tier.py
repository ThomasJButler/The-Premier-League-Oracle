#!/usr/bin/env python3
"""
Free-tier ML training script for Premier League match prediction.

Trains an XGBoost model (+ logistic regression baseline) on ~86 features
derived from historical CSV data. No paid API data required.

Usage:
    python train_free_tier.py                # Train with 80/20 chronological split
    python train_free_tier.py --test         # Also evaluate on 2025/26 held-out data
    python train_free_tier.py --csv-dir DIR  # Custom CSV directory

Output:
    backend/models/xgboost_free_tier.joblib  — trained model with metadata
    backend/models/calibration_curve.png     — calibration plot (if matplotlib available)
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Tuple

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
    engineer: Optional[FreeTierFeatureEngineer] = None,
) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Build feature matrix from historical matches.

    Iterates chronologically. For each match, uses only prior data
    (no leakage). Skips matches where either team has < MIN_PRIOR_MATCHES.

    Returns:
        X: Feature matrix (n_samples, n_features)
        y: Labels (n_samples,) — 0=H, 1=D, 2=A
        feature_names: Ordered feature names
    """
    if engineer is None:
        engineer = FreeTierFeatureEngineer(df)

    feature_names = FreeTierFeatureEngineer.FEATURE_NAMES
    X_rows: List[np.ndarray] = []
    y_rows: List[int] = []
    skipped = 0

    # Track how many matches each team has played (for warmup filter)
    team_match_counts: Dict[str, int] = {}

    for idx, row in df.iterrows():
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
    return X, y, feature_names


def chronological_split(
    X: np.ndarray, y: np.ndarray, val_fraction: float = 0.2,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Split data chronologically (no shuffling — prevents future leakage).

    Returns: X_train, y_train, X_val, y_val
    """
    split_idx = int(len(X) * (1.0 - val_fraction))
    return X[:split_idx], y[:split_idx], X[split_idx:], y[split_idx:]


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def compute_sample_weights(y: np.ndarray) -> np.ndarray:
    """
    Compute inverse-frequency sample weights to address class imbalance.

    Draws are ~23% of PL data but equally important to predict. Without
    weighting, XGBoost optimises for the majority classes (H/A) and
    nearly ignores draws (6.7% draw accuracy in v1).
    """
    classes, counts = np.unique(y, return_counts=True)
    total = len(y)
    # Weight = total / (n_classes * count_for_class)
    class_weights = {c: total / (len(classes) * cnt) for c, cnt in zip(classes, counts)}
    weights = np.array([class_weights[label] for label in y])
    logger.info(
        'Class weights: %s',
        {LABEL_NAMES[c]: f'{w:.3f}' for c, w in class_weights.items()},
    )
    return weights


def train_xgboost(
    X_train: np.ndarray, y_train: np.ndarray,
    X_val: np.ndarray, y_val: np.ndarray,
    feature_names: List[str],
) -> dict:
    """Train XGBoost model with early stopping and class weighting."""
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

    # Compute sample weights to boost draw importance
    sample_weights = compute_sample_weights(y_train)

    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=feature_names,
                         weight=sample_weights)
    dval = xgb.DMatrix(X_val, label=y_val, feature_names=feature_names)

    evals_result: Dict = {}
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
    feature_names: List[str],
    importance: Dict[str, float],
    min_importance: float = 0.005,
) -> Tuple[np.ndarray, np.ndarray, List[str]]:
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
    feature_names: List[str],
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


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

def evaluate(
    y_true: np.ndarray, y_probs: np.ndarray, label: str = 'Model',
) -> Dict[str, float]:
    """Compute evaluation metrics."""
    from sklearn.metrics import (
        accuracy_score, confusion_matrix, log_loss,
    )

    y_pred = np.argmax(y_probs, axis=1)
    acc = accuracy_score(y_true, y_pred)
    logloss = log_loss(y_true, y_probs, labels=[0, 1, 2])

    # Brier score (multi-class: average squared error)
    n_classes = y_probs.shape[1]
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


def save_calibration_curve(y_true: np.ndarray, y_probs: np.ndarray,
                           output_path: str) -> None:
    """Save calibration curve as PNG (best-effort — skips if matplotlib unavailable)."""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        from sklearn.calibration import calibration_curve

        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
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

def save_model(xgb_result: dict, feature_names: List[str],
               metrics: Dict, training_info: Dict) -> str:
    """Save trained model with metadata to joblib."""
    import joblib

    os.makedirs(MODEL_DIR, exist_ok=True)

    payload = {
        'model': xgb_result['model'],
        'calibrators': xgb_result.get('calibrators'),
        'feature_names': feature_names,
        'params': xgb_result['params'],
        'feature_importance': xgb_result['importance'],
        'version': '2.0.0-free',
        'tier': 'free',
        'training_date': datetime.utcnow().isoformat(),
        'training_samples': training_info.get('training_samples', 0),
        'validation_accuracy': metrics.get('accuracy', 0.0),
        'validation_log_loss': metrics.get('log_loss', 0.0),
        'training_seasons': training_info.get('seasons', []),
        'metrics': metrics,
    }

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
    args = parser.parse_args()

    # 1. Load data
    df = load_data(args.csv_dir)
    seasons = sorted(df['season'].unique())

    # 2. Build feature matrix
    logger.info('Building feature matrix...')
    engineer = FreeTierFeatureEngineer(df)
    X, y, feature_names = build_dataset(df, engineer)

    if len(X) < 50:
        logger.error('Too few samples (%d) — need at least 50 to train', len(X))
        sys.exit(1)

    # 3. Chronological split
    X_train, y_train, X_val, y_val = chronological_split(X, y, val_fraction=0.2)
    logger.info(
        'Split: %d training, %d validation (%.0f%%/%.0f%%)',
        len(X_train), len(X_val),
        100 * len(X_train) / len(X), 100 * len(X_val) / len(X),
    )

    # 4. First XGBoost pass (all features — to get importance scores)
    logger.info('Training XGBoost (first pass — all %d features)...', len(feature_names))
    import xgboost as xgb
    xgb_result_v1 = train_xgboost(X_train, y_train, X_val, y_val, feature_names)

    # 5. Feature selection — drop low-importance features and retrain
    X_train_sel, X_val_sel, sel_feature_names = select_features(
        X_train, y_train, X_val, feature_names,
        importance=xgb_result_v1['importance'],
        min_importance=0.005,
    )

    if len(sel_feature_names) < len(feature_names):
        logger.info('Retraining XGBoost with %d selected features...', len(sel_feature_names))
        xgb_result = train_xgboost(X_train_sel, y_train, X_val_sel, y_val, sel_feature_names)
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
    xgb_metrics_raw = evaluate(y_val, xgb_probs_raw, label='XGBoost (raw)')

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

    # 9. Comparison
    xgb_acc = xgb_metrics['accuracy']
    lr_acc = lr_metrics['accuracy']
    lift = (xgb_acc - lr_acc) * 100
    logger.info(
        '\n=== Comparison ===\n'
        'XGBoost accuracy: %.1f%% vs Logistic Regression baseline: %.1f%% (%+.1f%% lift)',
        xgb_acc * 100, lr_acc * 100, lift,
    )
    if lift < 3.0:
        logger.warning(
            'XGBoost lift < 3%% over LR — investigate feature engineering quality',
        )

    # 10. Top features
    sorted_imp = sorted(
        xgb_result['importance'].items(), key=lambda x: x[1], reverse=True,
    )
    logger.info('\n=== Top 20 Features ===')
    for i, (name, imp) in enumerate(sorted_imp[:20], 1):
        logger.info('  %2d. %-35s %.4f', i, name, imp)

    # 11. Save model (with calibrators and selected features)
    training_info = {
        'training_samples': len(X_train_active),
        'seasons': seasons,
    }
    xgb_result['calibrators'] = cal_result['calibrators']
    save_model(xgb_result, active_feature_names, xgb_metrics, training_info)

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
