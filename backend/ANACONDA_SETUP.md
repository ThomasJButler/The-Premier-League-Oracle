# 🐍 Anaconda Setup Guide - God Mode Environment

## 📋 Prerequisites

1. **Install Anaconda** (if not already installed):
   - Download from: https://www.anaconda.com/download
   - Follow installation instructions for your OS

2. **Verify Installation**:
   ```bash
   conda --version
   # Should show: conda 23.x.x or higher
   ```

## 🚀 Quick Setup (Recommended)

### Option 1: From environment.yml (Easiest)

```bash
# 1. Navigate to backend directory
cd The-Premier-League-Oracle/backend

# 2. Create environment from file
conda env create -f environment.yml

# 3. Activate the environment
conda activate premier-league-oracle

# 4. Verify installation
python -c "import torch; import xgboost; print('✅ God Mode Ready!')"
```

### Option 2: Manual Setup (Step by Step)

```bash
# 1. Create new environment
conda create -n premier-league-oracle python=3.11 -y

# 2. Activate environment
conda activate premier-league-oracle

# 3. Install core packages from conda
conda install -c conda-forge \
    pandas numpy scipy \
    scikit-learn xgboost lightgbm \
    matplotlib seaborn plotly \
    jupyter notebook ipywidgets \
    fastapi uvicorn redis-py \
    requests pyyaml -y

# 4. Install PyTorch (choose your version)
# For CPU only:
conda install pytorch torchvision torchaudio cpuonly -c pytorch -y

# For CUDA 12.1 (if you have NVIDIA GPU):
conda install pytorch torchvision torchaudio pytorch-cuda=12.1 -c pytorch -c nvidia -y

# 5. Install pip packages
pip install \
    catboost==1.2.2 \
    shap==0.44.0 \
    optuna==3.5.0 \
    mlflow==2.9.2 \
    langchain==0.1.0 \
    langchain-openai==0.0.2 \
    chromadb==0.4.22 \
    openai==1.6.1 \
    feature-engine==1.6.2 \
    python-dotenv==1.0.0 \
    websockets==12.0
```

## 🔧 Environment Management

### Activate Environment
```bash
conda activate premier-league-oracle
```

### Deactivate Environment
```bash
conda deactivate
```

### List All Environments
```bash
conda env list
```

### Update Environment
```bash
# Update all packages
conda update --all

# Update specific package
conda update xgboost
```

### Export Environment
```bash
# Export current environment
conda env export > my_environment.yml

# Export with only explicitly installed packages
conda env export --from-history > environment_minimal.yml
```

### Remove Environment (if needed)
```bash
conda env remove -n premier-league-oracle
```

## 🎯 Verify Your Setup

Create a test file `test_setup.py`:

```python
#!/usr/bin/env python
"""Test if God Mode environment is properly set up"""

def test_imports():
    """Test all critical imports"""
    imports = []
    
    # Core ML
    try:
        import xgboost
        imports.append("✅ XGBoost")
    except:
        imports.append("❌ XGBoost")
    
    try:
        import torch
        imports.append(f"✅ PyTorch ({'CUDA' if torch.cuda.is_available() else 'CPU'})")
    except:
        imports.append("❌ PyTorch")
    
    try:
        import lightgbm
        imports.append("✅ LightGBM")
    except:
        imports.append("❌ LightGBM")
    
    try:
        import catboost
        imports.append("✅ CatBoost")
    except:
        imports.append("❌ CatBoost")
    
    # Deep Learning
    try:
        import transformers
        imports.append("✅ Transformers")
    except:
        imports.append("❌ Transformers")
    
    # LangChain
    try:
        import langchain
        imports.append("✅ LangChain")
    except:
        imports.append("❌ LangChain")
    
    # MLflow
    try:
        import mlflow
        imports.append("✅ MLflow")
    except:
        imports.append("❌ MLflow")
    
    # API
    try:
        import fastapi
        imports.append("✅ FastAPI")
    except:
        imports.append("❌ FastAPI")
    
    # Feature Engineering
    try:
        import shap
        imports.append("✅ SHAP")
    except:
        imports.append("❌ SHAP")
    
    print("🔮 God Mode Environment Check")
    print("=" * 40)
    for imp in imports:
        print(imp)
    
    # Check our custom modules
    print("\n📦 Custom Modules:")
    try:
        import sys
        sys.path.append('.')
        from app.models.modern_oracle import ModernPremierLeagueOracle
        print("✅ God Mode Oracle accessible")
    except Exception as e:
        print(f"❌ God Mode Oracle: {e}")

if __name__ == "__main__":
    test_imports()
    print("\n🎉 Setup complete! You're ready for god mode predictions!")
```

Run the test:
```bash
python test_setup.py
```

## 🚀 Start Using God Mode

### 1. Start Jupyter
```bash
conda activate premier-league-oracle
jupyter notebook
# or
jupyter lab
```

### 2. Run the API
```bash
conda activate premier-league-oracle
cd backend
python -m app.api.main
```

### 3. Quick Test
```python
# In Python or Jupyter
from app.models.modern_oracle import ModernPremierLeagueOracle

oracle = ModernPremierLeagueOracle(
    api_key="YOUR_FOOTBALL_DATA_KEY"
)

result = oracle.predict_match_ensemble("Arsenal FC", "Chelsea FC")
print(f"🎯 Prediction: {result['ensemble_prediction']}")
```

## 💡 Pro Tips

### 1. GPU Acceleration
If you have an NVIDIA GPU:
```bash
# Check CUDA availability
python -c "import torch; print(f'CUDA Available: {torch.cuda.is_available()}')"
python -c "import torch; print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None\"}')"
```

### 2. Jupyter Kernel
Make sure Jupyter uses the right environment:
```bash
conda activate premier-league-oracle
python -m ipykernel install --user --name premier-league-oracle --display-name "Premier League Oracle"
```

### 3. Memory Management
For large datasets:
```bash
# Increase memory limits
export PYTHONHASHSEED=0
export OMP_NUM_THREADS=4
```

### 4. Parallel Processing
```python
# Use all CPU cores
import os
os.environ['NUMEXPR_MAX_THREADS'] = str(os.cpu_count())
```

## 🆘 Troubleshooting

### Issue: "PackageNotFoundError"
```bash
# Try conda-forge channel
conda install -c conda-forge package_name
```

### Issue: "Conflict errors"
```bash
# Create fresh environment
conda create -n oracle-fresh python=3.11
conda activate oracle-fresh
# Install packages one by one
```

### Issue: "Import errors in Jupyter"
```bash
# Reinstall kernel
conda activate premier-league-oracle
pip install ipykernel
python -m ipykernel install --user --name premier-league-oracle
```

### Issue: "CUDA not available"
```bash
# Reinstall PyTorch with CUDA
conda install pytorch torchvision torchaudio pytorch-cuda=12.1 -c pytorch -c nvidia
```

## 📊 Resource Requirements

- **Minimum**: 8GB RAM, 4 CPU cores
- **Recommended**: 16GB RAM, 8 CPU cores, NVIDIA GPU
- **Optimal**: 32GB RAM, 16 CPU cores, NVIDIA RTX 3080+

## 🎉 Success!

You now have a complete Anaconda environment for the God Mode Premier League Oracle!

Next steps:
1. Add your API keys to `.env`
2. Run the test script to verify
3. Open Jupyter and try the notebooks
4. Make your first prediction!

**Happy Predicting with Anaconda! 🐍🔮**