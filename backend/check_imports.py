"""Test if environment is properly set up"""

def test_imports():
    imports = []

    try:
        import xgboost
        imports.append(f"xgboost {xgboost.__version__}")
    except ImportError:
        imports.append("MISSING: xgboost")

    try:
        import torch
        label = f"torch {torch.__version__} ({'CUDA' if torch.cuda.is_available() else 'CPU'})"
        imports.append(label)
    except ImportError:
        imports.append("MISSING: torch")

    try:
        import sklearn
        imports.append(f"scikit-learn {sklearn.__version__}")
    except ImportError:
        imports.append("MISSING: scikit-learn")

    try:
        import langchain
        imports.append(f"langchain {langchain.__version__}")
    except ImportError:
        imports.append("MISSING: langchain (optional)")

    try:
        import mlflow
        imports.append(f"mlflow {mlflow.__version__}")
    except ImportError:
        imports.append("MISSING: mlflow")

    try:
        import fastapi
        imports.append(f"fastapi {fastapi.__version__}")
    except ImportError:
        imports.append("MISSING: fastapi")

    try:
        import shap
        imports.append(f"shap {shap.__version__}")
    except ImportError:
        imports.append("MISSING: shap")

    print("Premier League Oracle — Environment Check")
    print("=" * 45)
    for imp in imports:
        status = "✅" if "MISSING" not in imp else "❌"
        print(f"{status} {imp}")

    print("\nCustom modules:")
    try:
        import sys
        sys.path.append('.')
        from app.models.modern_oracle import ModernPremierLeagueOracle
        print("✅ ModernPremierLeagueOracle importable")
    except Exception as e:
        print(f"❌ ModernPremierLeagueOracle: {e}")

if __name__ == "__main__":
    test_imports()
