"""
Environment check — verifies that required and optional dependencies are importable.

Run manually: python check_imports.py
NOT collected by pytest (no test_ prefix / Test class) by design.
"""


def check_imports():
    imports = []

    # --- Required for free-tier pipeline ---
    try:
        import xgboost
        imports.append(f"xgboost {xgboost.__version__}")
    except ImportError:
        imports.append("MISSING: xgboost (required)")

    try:
        import sklearn
        imports.append(f"scikit-learn {sklearn.__version__}")
    except ImportError:
        imports.append("MISSING: scikit-learn (required)")

    try:
        import fastapi
        imports.append(f"fastapi {fastapi.__version__}")
    except ImportError:
        imports.append("MISSING: fastapi (required)")

    try:
        import joblib
        imports.append(f"joblib {joblib.__version__}")
    except ImportError:
        imports.append("MISSING: joblib (required)")

    try:
        import httpx
        imports.append(f"httpx {httpx.__version__}")
    except ImportError:
        imports.append("MISSING: httpx (required for tests)")

    try:
        import pandas
        imports.append(f"pandas {pandas.__version__}")
    except ImportError:
        imports.append("MISSING: pandas (required)")

    try:
        import numpy
        imports.append(f"numpy {numpy.__version__}")
    except ImportError:
        imports.append("MISSING: numpy (required)")

    # --- Optional (Pro-tier) ---
    try:
        import torch
        label = f"torch {torch.__version__} ({'CUDA' if torch.cuda.is_available() else 'CPU'})"
        imports.append(label)
    except ImportError:
        imports.append("MISSING: torch (optional — Pro-tier LSTM/Transformer)")

    try:
        import shap
        imports.append(f"shap {shap.__version__}")
    except ImportError:
        imports.append("MISSING: shap (optional — Pro-tier feature analysis)")

    try:
        import langchain
        imports.append(f"langchain {langchain.__version__}")
    except ImportError:
        imports.append("MISSING: langchain (optional — Pro-tier NL queries)")

    try:
        import mlflow
        imports.append(f"mlflow {mlflow.__version__}")
    except ImportError:
        imports.append("MISSING: mlflow (optional — Pro-tier experiment tracking)")

    print("Premier League Oracle — Environment Check")
    print("=" * 45)
    print("\nRequired (free-tier):")
    for imp in imports[:7]:
        status = "✅" if "MISSING" not in imp else "❌"
        print(f"  {status} {imp}")

    print("\nOptional (Pro-tier):")
    for imp in imports[7:]:
        status = "✅" if "MISSING" not in imp else "⚠️"
        print(f"  {status} {imp}")

    # Custom modules
    print("\nCustom modules:")
    try:
        import sys
        sys.path.append('.')
        from app.features.free_tier_features import FreeTierFeatureEngineer
        print(f"  ✅ FreeTierFeatureEngineer ({len(FreeTierFeatureEngineer.FEATURE_NAMES)} features)")
    except Exception as e:
        print(f"  ❌ FreeTierFeatureEngineer: {e}")

    try:
        from app.models.modern_oracle import ModernPremierLeagueOracle  # noqa: F401
        print("  ✅ ModernPremierLeagueOracle (Pro-tier)")
    except Exception as e:
        print(f"  ⚠️ ModernPremierLeagueOracle (Pro-tier): {e}")


if __name__ == "__main__":
    check_imports()
