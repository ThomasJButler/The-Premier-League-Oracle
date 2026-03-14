# Anaconda Setup Guide

## Prerequisites

1. **Install Anaconda** (if not already installed):
   - Download from: https://www.anaconda.com/download

2. **Verify Installation**:
   ```bash
   conda --version
   # Should show: conda 23.x.x or higher
   ```

---

## Quick Setup (Recommended)

### Option 1: From environment.yml (Easiest)

```bash
cd The-Premier-League-Oracle/backend

conda env create -f environment.yml
conda activate premier-league-oracle

# Verify
python -c "import torch; import xgboost; print('Environment ready')"
```

### Option 2: Manual Setup (Step by Step)

```bash
# 1. Create environment (Python 3.13 or 3.11 both work)
conda create -n premier-league-oracle python=3.11 -y
conda activate premier-league-oracle

# 2. Install core packages from conda
conda install -c conda-forge \
    pandas numpy scipy \
    scikit-learn xgboost \
    matplotlib seaborn \
    jupyter notebook ipywidgets \
    fastapi uvicorn redis-py \
    requests pyyaml -y

# 3. Install PyTorch
# CPU only:
conda install pytorch torchvision torchaudio cpuonly -c pytorch -y

# CUDA 12.1 (NVIDIA GPU):
conda install pytorch torchvision torchaudio pytorch-cuda=12.1 -c pytorch -c nvidia -y

# 4. Install remaining pip packages
pip install \
    shap==0.46.0 \
    optuna==4.0.0 \
    mlflow==2.17.2 \
    langchain==0.3.7 \
    langchain-openai==0.2.9 \
    chromadb==0.5.20 \
    openai \
    python-dotenv==1.0.1 \
    websockets==13.1
```

---

## Environment Management

```bash
conda activate premier-league-oracle   # Activate
conda deactivate                        # Deactivate
conda env list                          # List all environments
conda env remove -n premier-league-oracle  # Remove

# Export current environment
conda env export > my_environment.yml
conda env export --from-history > environment_minimal.yml
```

---

## Verify Your Setup

Create a test file `test_setup.py`:

```python
#!/usr/bin/env python
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
```

```bash
python test_setup.py
```

---

## Start Using the Backend

### Run the API
```bash
conda activate premier-league-oracle
cd backend
uvicorn app.api.main:app --reload --port 8000
```

### Start Jupyter
```bash
conda activate premier-league-oracle
jupyter notebook
```

### Register Jupyter Kernel
```bash
conda activate premier-league-oracle
python -m ipykernel install --user --name premier-league-oracle --display-name "Premier League Oracle"
```

---

## Pro Tips

### GPU Acceleration
```bash
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}')"
```

### Memory Management
```bash
export PYTHONHASHSEED=0
export OMP_NUM_THREADS=4
```

---

## Troubleshooting

**PackageNotFoundError:**
```bash
conda install -c conda-forge package_name
```

**Conflict errors:**
```bash
conda create -n oracle-fresh python=3.11
conda activate oracle-fresh
# Install packages one by one
```

**Import errors in Jupyter:**
```bash
conda activate premier-league-oracle
pip install ipykernel
python -m ipykernel install --user --name premier-league-oracle
```

**CUDA not available:**
```bash
conda install pytorch torchvision torchaudio pytorch-cuda=12.1 -c pytorch -c nvidia
```

---

## Resource Requirements

- **Minimum**: 8GB RAM, 4 CPU cores
- **Recommended**: 16GB RAM, 8 CPU cores, NVIDIA GPU
- **Optimal**: 32GB RAM, 16 CPU cores, NVIDIA RTX 3080+

---

## Next Steps

1. Add your API keys to `.env`
2. Run `test_setup.py` to verify
3. Start the API: `uvicorn app.api.main:app --reload`
4. Open `http://localhost:8000/docs` to explore the API
