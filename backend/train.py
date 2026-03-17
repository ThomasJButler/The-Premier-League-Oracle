"""
Training script for the Premier League Oracle XGBoost model.

Loads 6 seasons of match data from local CSVs in spreadsheets/KnowledgeFilesCSV/,
engineers features from real match results, and trains an XGBoost classifier to
predict H/D/A outcomes. No API key required.

Usage:
    cd backend
    python train.py

Requirements:
    - conda activate anaconda-ml-ai (or equivalent env with all deps)
    - EPL*.csv files present in ../spreadsheets/KnowledgeFilesCSV/

Output:
    - models/xgboost_model.pkl  (saved model)
    - Validation accuracy printed to stdout
    - Top 20 feature importances printed to stdout
"""

import sys
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

# Make sure backend/ is on sys.path when running as a script
sys.path.insert(0, str(Path(__file__).parent))

from app.features.advanced_engineering import AdvancedFeatureEngineer
from app.models.xgboost_model import XGBoostPredictor

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MIN_PRIOR_MATCHES = 5      # Skip match if either team has fewer past games
TRAIN_SPLIT = 0.80         # Chronological split — no shuffling
MODELS_DIR = Path(__file__).parent / "models"
MODEL_PATH = MODELS_DIR / "xgboost_model.pkl"
LABEL_MAP = {"H": 0, "D": 1, "A": 2}
LABEL_NAMES = {0: "Home win", 1: "Draw", 2: "Away win"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_match_counts(df: pd.DataFrame) -> pd.DataFrame:
    """Pre-compute cumulative match count for each team at each row.

    Returns the input DataFrame (sorted chronologically) with two new
    columns: ``home_prior`` and ``away_prior`` containing the number
    of matches each team has played prior to that row.

    Single O(n) pass instead of per-row DataFrame scans.
    """
    df = df.sort_values("date").reset_index(drop=True)
    counts: dict[str, int] = {}
    home_prior: list[int] = []
    away_prior: list[int] = []

    for _, row in df.iterrows():
        home = row["home_team"]
        away = row["away_team"]
        home_prior.append(counts.get(home, 0))
        away_prior.append(counts.get(away, 0))
        counts[home] = counts.get(home, 0) + 1
        counts[away] = counts.get(away, 0) + 1

    df["home_prior"] = home_prior
    df["away_prior"] = away_prior
    return df


def build_dataset(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """
    Iterate over every match in chronological order and compute features.

    Returns (X, y) where X is a DataFrame of floats and y is a Series of
    integer labels (0=Home, 1=Draw, 2=Away).
    """
    df = _build_match_counts(df)
    engineer = AdvancedFeatureEngineer(historical_data=df)

    rows: list[dict] = []
    labels: list[int] = []
    skipped = 0

    total = len(df)
    for idx, row in df.iterrows():
        home = row["home_team"]
        away = row["away_team"]
        match_date = pd.Timestamp(row["date"])
        result = row["result"]

        if result not in LABEL_MAP:
            skipped += 1
            continue

        # Warmup — skip if insufficient history for either team
        if row["home_prior"] < MIN_PRIOR_MATCHES or row["away_prior"] < MIN_PRIOR_MATCHES:
            skipped += 1
            continue

        try:
            features = engineer.create_all_features(
                home,
                away,
                match_date=match_date.to_pydatetime(),
            )
        except Exception as e:
            logger.warning(f"Feature error for {home} vs {away} ({match_date.date()}): {e}")
            skipped += 1
            continue

        rows.append(features)
        labels.append(LABEL_MAP[result])

        if (idx + 1) % 200 == 0:
            logger.info(f"  Processed {idx + 1}/{total} matches …")

    logger.info(f"Dataset built: {len(rows)} usable rows, {skipped} skipped")

    X = pd.DataFrame(rows)  # XGBoost handles NaN natively — do not fill
    y = pd.Series(labels, dtype=int, name="result")
    return X, y


def chronological_split(
    X: pd.DataFrame, y: pd.Series, train_frac: float = TRAIN_SPLIT
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """
    Split (X, y) in time order — first `train_frac` for training, rest for
    validation.  Never shuffle: future leaking into training would inflate
    accuracy and produce a model that cannot generalise.
    """
    n = len(X)
    split = int(n * train_frac)
    return X.iloc[:split], X.iloc[split:], y.iloc[:split], y.iloc[split:]


def print_class_accuracy(y_true: pd.Series, y_pred: np.ndarray) -> None:
    for label, name in LABEL_NAMES.items():
        mask = y_true == label
        if mask.sum() == 0:
            continue
        acc = (y_pred[mask] == label).mean()
        count = mask.sum()
        print(f"    {name:<12}  {acc:.1%}  ({count} samples)")


# ---------------------------------------------------------------------------
# CSV loader — uses local season files instead of the Football-Data.org API
# ---------------------------------------------------------------------------

CSV_DIR = Path(__file__).parent.parent / "spreadsheets" / "KnowledgeFilesCSV"


def load_csv_data() -> pd.DataFrame:
    """Load all season CSVs and normalise to the format expected by AdvancedFeatureEngineer."""
    files = sorted(CSV_DIR.glob("EPL*.csv"))
    if not files:
        return pd.DataFrame()

    frames = []
    for f in files:
        df = pd.read_csv(f)
        df = df.rename(columns={
            "HomeTeam": "home_team",
            "AwayTeam": "away_team",
            "FTHG": "home_score",
            "FTAG": "away_score",
            "FTR": "result",
        })
        df["date"] = pd.to_datetime(df["Date"], dayfirst=True, utc=True)
        df = df.dropna(subset=["result", "home_score", "away_score"])
        frames.append(df[["date", "home_team", "away_team", "home_score", "away_score", "result"]])

    return pd.concat(frames, ignore_index=True).sort_values("date").reset_index(drop=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    # ------------------------------------------------------------------
    # 1. Load historical data from local CSVs
    # ------------------------------------------------------------------
    logger.info(f"Loading match data from {CSV_DIR} ...")
    df = load_csv_data()

    if df is None or df.empty:
        logger.error(f"No CSV data found. Expected EPL*.csv files in {CSV_DIR}")
        sys.exit(1)

    logger.info(f"Raw dataset: {len(df)} matches across {len(df['home_team'].unique())} teams")

    # ------------------------------------------------------------------
    # 2. Build feature matrix
    # ------------------------------------------------------------------
    logger.info("Engineering features (this takes a few minutes) …")
    X, y = build_dataset(df)

    if len(X) == 0:
        logger.error("Feature matrix is empty — check your data.")
        sys.exit(1)

    logger.info(f"Feature matrix shape: {X.shape}  |  Label distribution: {dict(y.value_counts().sort_index())}")

    # ------------------------------------------------------------------
    # 3. Chronological train / val split
    # ------------------------------------------------------------------
    X_train, X_val, y_train, y_val = chronological_split(X, y)
    logger.info(f"Train: {len(X_train)} rows  |  Val: {len(X_val)} rows")

    # ------------------------------------------------------------------
    # 4. Train XGBoost
    # ------------------------------------------------------------------
    logger.info("Training XGBoost …")
    predictor = XGBoostPredictor()
    training_result = predictor.train(
        X_train, y_train,
        X_val, y_val,
        optimize_hyperparams=False,
    )

    logger.info(f"Best iteration: {training_result['best_iteration']}")
    logger.info(f"Best val score (mlogloss): {training_result['best_score']:.4f}")

    # ------------------------------------------------------------------
    # 5. Validate
    # ------------------------------------------------------------------
    import xgboost as xgb
    dval = xgb.DMatrix(X_val, feature_names=predictor.feature_names)
    probs = predictor.model.predict(dval)
    y_pred = np.argmax(probs, axis=1)
    overall_acc = (y_pred == y_val.values).mean()

    print("\n" + "=" * 50)
    print("  VALIDATION RESULTS")
    print("=" * 50)
    print(f"\n  Overall accuracy:  {overall_acc:.1%}  (random baseline ~33%)")
    print("\n  Per-class accuracy:")
    print_class_accuracy(y_val, y_pred)

    print("\n  Top 20 most important features:")
    top_features = training_result["feature_importance"][:20]
    for rank, (feat, importance) in enumerate(top_features, 1):
        print(f"    {rank:2d}. {feat:<45}  {importance:.1f}")

    print("=" * 50)

    # ------------------------------------------------------------------
    # 6. Save model
    # ------------------------------------------------------------------
    MODELS_DIR.mkdir(exist_ok=True)
    predictor.save_model(str(MODEL_PATH))
    logger.info(f"Model saved → {MODEL_PATH}")
    print(f"\n  Model saved to: {MODEL_PATH}")
    print("  Restart uvicorn to load it automatically.\n")


if __name__ == "__main__":
    main()
