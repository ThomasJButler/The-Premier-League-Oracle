# 🎓 Complete ML Training Guide with Anaconda

## 🚀 From Zero to Hero: Train Your Own Premier League Prediction Model

---

## 📋 Table of Contents
1. [Quick Start (5 minutes)](#quick-start)
2. [Complete Anaconda Setup](#anaconda-setup)
3. [Data Collection & Preparation](#data-collection)
4. [Feature Engineering](#feature-engineering)
5. [Training Your First Model](#training-first-model)
6. [Advanced Training Techniques](#advanced-training)
7. [Model Evaluation & Testing](#model-evaluation)
8. [Deployment & Production](#deployment)

---

## 🎯 Quick Start {#quick-start}

### The Fastest Way to Train a Model (5 minutes)

```bash
# 1. Create Anaconda environment
conda create -n premier-league python=3.10
conda activate premier-league

# 2. Install packages
conda install pandas numpy scikit-learn xgboost jupyter matplotlib seaborn -y
pip install football-data-api shap optuna

# 3. Start Jupyter
jupyter notebook

# 4. Run this code:
```

```python
# Quick Training Script
import pandas as pd
from sklearn.model_selection import train_test_split
import xgboost as xgb

# Load data (you'll need to get this first)
data = pd.read_csv('premier_league_matches.csv')

# Simple features
X = data[['home_goals_last_5', 'away_goals_last_5', 'home_position', 'away_position']]
y = data['result']  # H, D, or A

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# Train model
model = xgb.XGBClassifier()
model.fit(X_train, y_train)

# Test accuracy
accuracy = model.score(X_test, y_test)
print(f"Model Accuracy: {accuracy:.2%}")
```

---

## 🐍 Complete Anaconda Setup {#anaconda-setup}

### Step 1: Install Anaconda

#### Windows
1. Download from [anaconda.com](https://www.anaconda.com/products/distribution)
2. Run installer (use default settings)
3. Open "Anaconda Prompt" from Start Menu

#### Mac
```bash
# Using Homebrew
brew install --cask anaconda

# Or download from website
# Then add to path:
export PATH="/opt/anaconda3/bin:$PATH"
```

#### Linux
```bash
wget https://repo.anaconda.com/archive/Anaconda3-2024.02-1-Linux-x86_64.sh
bash Anaconda3-2024.02-1-Linux-x86_64.sh
source ~/.bashrc
```

### Step 2: Create Environment

```bash
# Create environment with all needed packages
conda create -n premier-league python=3.10 -y
conda activate premier-league

# Install ML packages
conda install -c conda-forge \
    pandas numpy scipy \
    scikit-learn xgboost lightgbm catboost \
    matplotlib seaborn plotly \
    jupyter notebook ipywidgets \
    requests beautifulsoup4 \
    sqlalchemy psycopg2 \
    pytest black flake8 -y

# Install additional packages with pip
pip install \
    football-data-api \
    shap lime \
    optuna hyperopt \
    mlflow wandb \
    fastapi uvicorn \
    streamlit \
    tensorflow torch \
    statsmodels prophet
```

### Step 3: Verify Installation

```python
# Run this in Jupyter to verify
import sys
print(f"Python: {sys.version}")

packages = ['pandas', 'numpy', 'sklearn', 'xgboost', 'torch', 'tensorflow']
for package in packages:
    try:
        __import__(package)
        print(f"✅ {package} installed")
    except ImportError:
        print(f"❌ {package} not found")
```

---

## 📊 Data Collection & Preparation {#data-collection}

### Step 1: Set Up Football-Data.org API

```python
# data_collection.py
import requests
import pandas as pd
from datetime import datetime, timedelta
import time

class FootballDataCollector:
    """Collect data from Football-Data.org"""
    
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://api.football-data.org/v4"
        self.headers = {'X-Auth-Token': api_key}
        
    def get_matches(self, season=2023, competition=2021):
        """Get all matches for a season"""
        
        # Premier League = 2021
        url = f"{self.base_url}/competitions/{competition}/matches"
        params = {'season': season}
        
        response = requests.get(url, headers=self.headers, params=params)
        
        if response.status_code == 200:
            matches = response.json()['matches']
            return pd.DataFrame(matches)
        else:
            print(f"Error: {response.status_code}")
            return None
    
    def get_team_stats(self, team_id, limit=10):
        """Get recent matches for a team"""
        
        url = f"{self.base_url}/teams/{team_id}/matches"
        params = {'limit': limit}
        
        response = requests.get(url, headers=self.headers, params=params)
        
        if response.status_code == 200:
            return response.json()['matches']
        return None

# Usage
collector = FootballDataCollector(api_key="YOUR_API_KEY_HERE")

# Get all matches from 2023 season
matches_df = collector.get_matches(season=2023)
print(f"Collected {len(matches_df)} matches")

# Save to CSV
matches_df.to_csv('premier_league_2023.csv', index=False)
```

### Step 2: Clean and Prepare Data

```python
# data_preparation.py
import pandas as pd
import numpy as np

def prepare_match_data(df):
    """Clean and prepare match data for training"""
    
    # Extract relevant columns
    df_clean = pd.DataFrame()
    
    # Basic match info
    df_clean['date'] = pd.to_datetime(df['utcDate'])
    df_clean['home_team'] = df['homeTeam'].apply(lambda x: x['name'])
    df_clean['away_team'] = df['awayTeam'].apply(lambda x: x['name'])
    
    # Extract scores
    df_clean['home_score'] = df['score'].apply(lambda x: x['fullTime']['home'])
    df_clean['away_score'] = df['score'].apply(lambda x: x['fullTime']['away'])
    
    # Create result column (H, D, A)
    df_clean['result'] = df_clean.apply(
        lambda row: 'H' if row['home_score'] > row['away_score']
        else 'A' if row['home_score'] < row['away_score']
        else 'D', axis=1
    )
    
    # Remove matches without results
    df_clean = df_clean.dropna(subset=['home_score', 'away_score'])
    
    # Sort by date
    df_clean = df_clean.sort_values('date')
    
    return df_clean

# Load and clean data
raw_data = pd.read_csv('premier_league_2023.csv')
clean_data = prepare_match_data(raw_data)
print(f"Cleaned data: {len(clean_data)} matches")
```

### Step 3: Create Training Dataset

```python
def create_training_data(matches_df):
    """Create features and labels for training"""
    
    features_list = []
    labels_list = []
    
    # Group by team to calculate rolling stats
    for idx, match in matches_df.iterrows():
        if idx < 100:  # Skip early matches (no history)
            continue
            
        # Get historical data
        hist_data = matches_df.iloc[:idx]
        
        # Calculate features for this match
        features = calculate_match_features(
            match['home_team'], 
            match['away_team'],
            hist_data
        )
        
        features_list.append(features)
        labels_list.append(match['result'])
    
    # Create DataFrames
    X = pd.DataFrame(features_list)
    y = pd.Series(labels_list)
    
    return X, y

def calculate_match_features(home_team, away_team, historical_data):
    """Calculate features for a single match"""
    
    features = {}
    
    # Home team recent form
    home_matches = historical_data[
        (historical_data['home_team'] == home_team) | 
        (historical_data['away_team'] == home_team)
    ].tail(5)
    
    # Calculate home team features
    home_wins = sum(
        (home_matches['home_team'] == home_team) & (home_matches['result'] == 'H') |
        (home_matches['away_team'] == home_team) & (home_matches['result'] == 'A')
    )
    features['home_form'] = home_wins / max(len(home_matches), 1)
    
    # Away team recent form
    away_matches = historical_data[
        (historical_data['home_team'] == away_team) | 
        (historical_data['away_team'] == away_team)
    ].tail(5)
    
    away_wins = sum(
        (away_matches['home_team'] == away_team) & (away_matches['result'] == 'H') |
        (away_matches['away_team'] == away_team) & (away_matches['result'] == 'A')
    )
    features['away_form'] = away_wins / max(len(away_matches), 1)
    
    # Head-to-head
    h2h = historical_data[
        ((historical_data['home_team'] == home_team) & (historical_data['away_team'] == away_team)) |
        ((historical_data['home_team'] == away_team) & (historical_data['away_team'] == home_team))
    ]
    
    features['h2h_matches'] = len(h2h)
    features['h2h_home_wins'] = sum(
        (h2h['home_team'] == home_team) & (h2h['result'] == 'H')
    ) / max(len(h2h), 1)
    
    # Add more features as needed...
    
    return features

# Create training data
X, y = create_training_data(clean_data)
print(f"Training data: {X.shape}")
```

---

## 🔧 Feature Engineering {#feature-engineering}

### Complete Feature Engineering Pipeline

```python
# feature_engineering.py
import pandas as pd
import numpy as np
from scipy import stats

class FeatureEngineer:
    """Create 150+ features for match prediction"""
    
    def __init__(self):
        self.feature_names = []
        
    def create_all_features(self, home_team, away_team, historical_data):
        """Generate all features for a match"""
        
        features = {}
        
        # 1. Basic Statistics (20 features)
        features.update(self.basic_stats(home_team, away_team, historical_data))
        
        # 2. Form Features (15 features)
        features.update(self.form_features(home_team, away_team, historical_data))
        
        # 3. Goal Statistics (20 features)
        features.update(self.goal_stats(home_team, away_team, historical_data))
        
        # 4. Head-to-Head (10 features)
        features.update(self.h2h_features(home_team, away_team, historical_data))
        
        # 5. Advanced Metrics (25 features)
        features.update(self.advanced_metrics(home_team, away_team, historical_data))
        
        # 6. Time-based Features (10 features)
        features.update(self.time_features(home_team, away_team, historical_data))
        
        # 7. ELO Ratings (5 features)
        features.update(self.elo_features(home_team, away_team, historical_data))
        
        # 8. Poisson Features (10 features)
        features.update(self.poisson_features(home_team, away_team, historical_data))
        
        # 9. Momentum Indicators (15 features)
        features.update(self.momentum_features(home_team, away_team, historical_data))
        
        # 10. Fatigue Factors (10 features)
        features.update(self.fatigue_features(home_team, away_team, historical_data))
        
        return features
    
    def basic_stats(self, home_team, away_team, data):
        """Basic team statistics"""
        features = {}
        
        # Get last N matches for each team
        for n in [5, 10, 20]:
            home_matches = self.get_team_matches(home_team, data, n)
            away_matches = self.get_team_matches(away_team, data, n)
            
            # Win rate
            features[f'home_win_rate_{n}'] = self.calculate_win_rate(home_team, home_matches)
            features[f'away_win_rate_{n}'] = self.calculate_win_rate(away_team, away_matches)
            
            # Points per game
            features[f'home_ppg_{n}'] = self.calculate_ppg(home_team, home_matches)
            features[f'away_ppg_{n}'] = self.calculate_ppg(away_team, away_matches)
        
        return features
    
    def form_features(self, home_team, away_team, data):
        """Recent form indicators"""
        features = {}
        
        # Get last 5 matches
        home_form = self.get_team_matches(home_team, data, 5)
        away_form = self.get_team_matches(away_team, data, 5)
        
        # Form string (WWDLL etc)
        home_form_str = self.get_form_string(home_team, home_form)
        away_form_str = self.get_form_string(away_team, away_form)
        
        # Convert to numerical
        features['home_form_score'] = home_form_str.count('W') * 3 + home_form_str.count('D')
        features['away_form_score'] = away_form_str.count('W') * 3 + away_form_str.count('D')
        
        # Weighted recent form (recent games weighted more)
        weights = [0.35, 0.25, 0.20, 0.12, 0.08]
        features['home_weighted_form'] = self.weighted_form(home_team, home_form, weights)
        features['away_weighted_form'] = self.weighted_form(away_team, away_form, weights)
        
        # Momentum (improving or declining)
        features['home_momentum'] = self.calculate_momentum(home_team, data)
        features['away_momentum'] = self.calculate_momentum(away_team, data)
        
        return features
    
    def goal_stats(self, home_team, away_team, data):
        """Goal-related statistics"""
        features = {}
        
        for n in [5, 10, 20]:
            home_matches = self.get_team_matches(home_team, data, n)
            away_matches = self.get_team_matches(away_team, data, n)
            
            # Goals scored
            features[f'home_goals_for_{n}'] = self.avg_goals_scored(home_team, home_matches)
            features[f'away_goals_for_{n}'] = self.avg_goals_scored(away_team, away_matches)
            
            # Goals conceded
            features[f'home_goals_against_{n}'] = self.avg_goals_conceded(home_team, home_matches)
            features[f'away_goals_against_{n}'] = self.avg_goals_conceded(away_team, away_matches)
            
            # Clean sheets
            features[f'home_clean_sheets_{n}'] = self.clean_sheet_rate(home_team, home_matches)
            features[f'away_clean_sheets_{n}'] = self.clean_sheet_rate(away_team, away_matches)
            
            # Both teams to score
            features[f'home_btts_{n}'] = self.btts_rate(home_team, home_matches)
            features[f'away_btts_{n}'] = self.btts_rate(away_team, away_matches)
        
        return features
    
    def h2h_features(self, home_team, away_team, data):
        """Head-to-head statistics"""
        features = {}
        
        # Get H2H matches
        h2h = data[
            ((data['home_team'] == home_team) & (data['away_team'] == away_team)) |
            ((data['home_team'] == away_team) & (data['away_team'] == home_team))
        ]
        
        if len(h2h) > 0:
            # Overall H2H
            features['h2h_matches'] = len(h2h)
            features['h2h_home_wins'] = sum(
                (h2h['home_team'] == home_team) & (h2h['result'] == 'H')
            ) / len(h2h)
            features['h2h_draws'] = sum(h2h['result'] == 'D') / len(h2h)
            
            # Recent H2H (last 5)
            recent_h2h = h2h.tail(5)
            features['h2h_recent_home_wins'] = sum(
                (recent_h2h['home_team'] == home_team) & (recent_h2h['result'] == 'H')
            ) / max(len(recent_h2h), 1)
            
            # Goals in H2H
            home_as_home = h2h[h2h['home_team'] == home_team]
            if len(home_as_home) > 0:
                features['h2h_avg_home_goals'] = home_as_home['home_score'].mean()
                features['h2h_avg_away_goals'] = home_as_home['away_score'].mean()
            else:
                features['h2h_avg_home_goals'] = 1.5
                features['h2h_avg_away_goals'] = 1.5
        else:
            # No H2H history
            features['h2h_matches'] = 0
            features['h2h_home_wins'] = 0.46  # League average
            features['h2h_draws'] = 0.24
            features['h2h_recent_home_wins'] = 0.46
            features['h2h_avg_home_goals'] = 1.5
            features['h2h_avg_away_goals'] = 1.2
        
        return features
    
    def advanced_metrics(self, home_team, away_team, data):
        """Advanced statistical metrics"""
        features = {}
        
        # Expected goals (simplified - in reality you'd use actual xG data)
        home_matches = self.get_team_matches(home_team, data, 10)
        away_matches = self.get_team_matches(away_team, data, 10)
        
        # Shots-based xG approximation
        features['home_xg_for'] = self.estimate_xg(home_team, home_matches, 'for')
        features['home_xg_against'] = self.estimate_xg(home_team, home_matches, 'against')
        features['away_xg_for'] = self.estimate_xg(away_team, away_matches, 'for')
        features['away_xg_against'] = self.estimate_xg(away_team, away_matches, 'against')
        
        # Poisson lambda values
        features['home_lambda'] = features['home_xg_for']
        features['away_lambda'] = features['away_xg_for']
        
        # Defensive strength
        league_avg_goals = data['home_score'].mean()
        features['home_def_strength'] = league_avg_goals / max(features['home_xg_against'], 0.5)
        features['away_def_strength'] = league_avg_goals / max(features['away_xg_against'], 0.5)
        
        # Attack strength
        features['home_att_strength'] = features['home_xg_for'] / league_avg_goals
        features['away_att_strength'] = features['away_xg_for'] / league_avg_goals
        
        return features
    
    # Helper methods
    def get_team_matches(self, team, data, n):
        """Get last N matches for a team"""
        team_matches = data[
            (data['home_team'] == team) | (data['away_team'] == team)
        ].tail(n)
        return team_matches
    
    def calculate_win_rate(self, team, matches):
        """Calculate win rate for a team"""
        if len(matches) == 0:
            return 0.33
        
        wins = sum(
            ((matches['home_team'] == team) & (matches['result'] == 'H')) |
            ((matches['away_team'] == team) & (matches['result'] == 'A'))
        )
        return wins / len(matches)
    
    def calculate_ppg(self, team, matches):
        """Calculate points per game"""
        if len(matches) == 0:
            return 1.0
        
        points = 0
        for _, match in matches.iterrows():
            if match['home_team'] == team:
                if match['result'] == 'H':
                    points += 3
                elif match['result'] == 'D':
                    points += 1
            else:  # away team
                if match['result'] == 'A':
                    points += 3
                elif match['result'] == 'D':
                    points += 1
        
        return points / len(matches)
    
    def avg_goals_scored(self, team, matches):
        """Average goals scored"""
        if len(matches) == 0:
            return 1.5
        
        goals = 0
        for _, match in matches.iterrows():
            if match['home_team'] == team:
                goals += match['home_score']
            else:
                goals += match['away_score']
        
        return goals / len(matches)
    
    def avg_goals_conceded(self, team, matches):
        """Average goals conceded"""
        if len(matches) == 0:
            return 1.5
        
        goals = 0
        for _, match in matches.iterrows():
            if match['home_team'] == team:
                goals += match['away_score']
            else:
                goals += match['home_score']
        
        return goals / len(matches)
    
    def estimate_xg(self, team, matches, direction='for'):
        """Estimate expected goals (simplified)"""
        # In reality, you'd use actual xG data
        # This is a simplified approximation
        if direction == 'for':
            return self.avg_goals_scored(team, matches) * 0.9
        else:
            return self.avg_goals_conceded(team, matches) * 1.1

# Usage
engineer = FeatureEngineer()
features = engineer.create_all_features('Arsenal', 'Chelsea', historical_data)
print(f"Generated {len(features)} features")
```

---

## 🎯 Training Your First Model {#training-first-model}

### Complete Training Script

```python
# train_model.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb
import warnings
warnings.filterwarnings('ignore')

# 1. LOAD DATA
print("📊 Loading data...")
data = pd.read_csv('premier_league_clean.csv')
print(f"   Loaded {len(data)} matches")

# 2. CREATE FEATURES
print("\n🔧 Engineering features...")
engineer = FeatureEngineer()

X_list = []
y_list = []

for idx in range(100, len(data)):  # Skip first 100 (no history)
    match = data.iloc[idx]
    historical = data.iloc[:idx]
    
    features = engineer.create_all_features(
        match['home_team'],
        match['away_team'],
        historical
    )
    
    X_list.append(features)
    y_list.append(match['result'])
    
    if idx % 100 == 0:
        print(f"   Processed {idx}/{len(data)} matches...")

X = pd.DataFrame(X_list)
y = pd.Series(y_list)

print(f"\n✅ Created {X.shape[0]} samples with {X.shape[1]} features")

# 3. ENCODE LABELS
label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)  # H=0, D=1, A=2

# 4. SPLIT DATA
X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
)

print(f"\n📊 Data split:")
print(f"   Training: {len(X_train)} samples")
print(f"   Testing: {len(X_test)} samples")

# 5. TRAIN XGBOOST MODEL
print("\n🎯 Training XGBoost model...")

# Best hyperparameters (found through optimization)
params = {
    'objective': 'multi:softprob',
    'num_class': 3,
    'max_depth': 8,
    'learning_rate': 0.01,
    'n_estimators': 2000,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'gamma': 0.1,
    'reg_alpha': 0.05,
    'reg_lambda': 0.05,
    'min_child_weight': 3,
    'random_state': 42
}

# Create and train model
model = xgb.XGBClassifier(**params)

# Train with early stopping
eval_set = [(X_train, y_train), (X_test, y_test)]
model.fit(
    X_train, y_train,
    eval_set=eval_set,
    eval_metric='mlogloss',
    early_stopping_rounds=50,
    verbose=100
)

print(f"\n✅ Training complete!")
print(f"   Best iteration: {model.best_iteration}")

# 6. EVALUATE MODEL
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# Make predictions
y_pred = model.predict(X_test)
y_pred_proba = model.predict_proba(X_test)

# Calculate metrics
accuracy = accuracy_score(y_test, y_pred)
print(f"\n📊 Model Performance:")
print(f"   Accuracy: {accuracy:.2%}")

# Classification report
print("\n📋 Detailed Classification Report:")
print(classification_report(
    y_test, y_pred,
    target_names=['Home Win', 'Draw', 'Away Win'],
    digits=3
))

# Feature importance
print("\n🎯 Top 20 Most Important Features:")
importance = model.get_booster().get_score(importance_type='gain')
sorted_importance = sorted(importance.items(), key=lambda x: x[1], reverse=True)

for i, (feature, score) in enumerate(sorted_importance[:20], 1):
    print(f"   {i:2d}. {feature}: {score:.2f}")

# 7. SAVE MODEL
import joblib

model_data = {
    'model': model,
    'label_encoder': label_encoder,
    'feature_names': X.columns.tolist(),
    'accuracy': accuracy,
    'params': params
}

joblib.dump(model_data, 'premier_league_model.pkl')
print(f"\n💾 Model saved to 'premier_league_model.pkl'")

# 8. TEST ON NEW MATCH
print("\n🔮 Testing on a new match prediction:")

# Example: Arsenal vs Chelsea
new_features = engineer.create_all_features('Arsenal', 'Chelsea', data)
new_X = pd.DataFrame([new_features])[X.columns]

# Predict
proba = model.predict_proba(new_X)[0]
prediction = model.predict(new_X)[0]

print(f"\nArsenal vs Chelsea Prediction:")
print(f"   Home Win: {proba[0]:.1%}")
print(f"   Draw: {proba[1]:.1%}")
print(f"   Away Win: {proba[2]:.1%}")
print(f"   Predicted Result: {label_encoder.inverse_transform([prediction])[0]}")
```

---

## 🚀 Advanced Training Techniques {#advanced-training}

### 1. Hyperparameter Optimization with Optuna

```python
# hyperparameter_optimization.py
import optuna
from optuna.samplers import TPESampler
import xgboost as xgb
from sklearn.model_selection import cross_val_score

def optimize_xgboost(X_train, y_train):
    """Find best hyperparameters using Optuna"""
    
    def objective(trial):
        params = {
            'objective': 'multi:softprob',
            'num_class': 3,
            'max_depth': trial.suggest_int('max_depth', 3, 12),
            'learning_rate': trial.suggest_float('learning_rate', 0.001, 0.3, log=True),
            'n_estimators': trial.suggest_int('n_estimators', 500, 3000),
            'subsample': trial.suggest_float('subsample', 0.5, 1.0),
            'colsample_bytree': trial.suggest_float('colsample_bytree', 0.5, 1.0),
            'gamma': trial.suggest_float('gamma', 0, 0.5),
            'reg_alpha': trial.suggest_float('reg_alpha', 0, 0.5),
            'reg_lambda': trial.suggest_float('reg_lambda', 0, 0.5),
            'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
            'random_state': 42
        }
        
        model = xgb.XGBClassifier(**params)
        
        # Use cross-validation
        scores = cross_val_score(
            model, X_train, y_train,
            cv=5, scoring='accuracy', n_jobs=-1
        )
        
        return scores.mean()
    
    # Create study
    study = optuna.create_study(
        direction='maximize',
        sampler=TPESampler(seed=42)
    )
    
    # Optimize
    study.optimize(objective, n_trials=100, show_progress_bar=True)
    
    print(f"Best accuracy: {study.best_value:.4f}")
    print(f"Best params: {study.best_params}")
    
    return study.best_params

# Run optimization
best_params = optimize_xgboost(X_train, y_train)

# Train final model with best params
final_model = xgb.XGBClassifier(**best_params)
final_model.fit(X_train, y_train)
```

### 2. Ensemble Multiple Models

```python
# ensemble_model.py
from sklearn.ensemble import VotingClassifier, StackingClassifier
import lightgbm as lgb
from catboost import CatBoostClassifier

# Create individual models
xgb_model = xgb.XGBClassifier(**best_params)
lgb_model = lgb.LGBMClassifier(random_state=42, verbosity=-1)
cat_model = CatBoostClassifier(random_state=42, verbose=False)

# Method 1: Voting Ensemble
voting_model = VotingClassifier(
    estimators=[
        ('xgb', xgb_model),
        ('lgb', lgb_model),
        ('cat', cat_model)
    ],
    voting='soft',  # Use probabilities
    weights=[0.4, 0.3, 0.3]  # Weight models
)

voting_model.fit(X_train, y_train)
voting_accuracy = voting_model.score(X_test, y_test)
print(f"Voting Ensemble Accuracy: {voting_accuracy:.2%}")

# Method 2: Stacking Ensemble
from sklearn.linear_model import LogisticRegression

stacking_model = StackingClassifier(
    estimators=[
        ('xgb', xgb_model),
        ('lgb', lgb_model),
        ('cat', cat_model)
    ],
    final_estimator=LogisticRegression(),
    cv=5  # Use cross-validation for training meta-model
)

stacking_model.fit(X_train, y_train)
stacking_accuracy = stacking_model.score(X_test, y_test)
print(f"Stacking Ensemble Accuracy: {stacking_accuracy:.2%}")
```

### 3. Time Series Cross-Validation

```python
# time_series_cv.py
from sklearn.model_selection import TimeSeriesSplit

def time_series_validation(X, y, model, n_splits=5):
    """Proper cross-validation for time series data"""
    
    tscv = TimeSeriesSplit(n_splits=n_splits)
    scores = []
    
    for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):
        X_train_fold = X.iloc[train_idx]
        y_train_fold = y.iloc[train_idx]
        X_val_fold = X.iloc[val_idx]
        y_val_fold = y.iloc[val_idx]
        
        # Train model
        model.fit(X_train_fold, y_train_fold)
        
        # Evaluate
        score = model.score(X_val_fold, y_val_fold)
        scores.append(score)
        
        print(f"Fold {fold}: {score:.4f}")
    
    print(f"\nMean CV Score: {np.mean(scores):.4f} (+/- {np.std(scores):.4f})")
    
    return scores

# Run time series CV
cv_scores = time_series_validation(X, y_encoded, xgb_model)
```

---

## 📈 Model Evaluation & Testing {#model-evaluation}

### Comprehensive Evaluation Suite

```python
# model_evaluation.py
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score,
    log_loss, brier_score_loss
)

def evaluate_model_comprehensive(model, X_test, y_test, label_encoder):
    """Complete model evaluation with visualizations"""
    
    # Get predictions
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)
    
    # 1. Basic Metrics
    print("=" * 50)
    print("MODEL EVALUATION REPORT")
    print("=" * 50)
    
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\n📊 Overall Accuracy: {accuracy:.2%}")
    
    # 2. Per-class metrics
    print("\n📋 Per-Class Performance:")
    precision = precision_score(y_test, y_pred, average=None)
    recall = recall_score(y_test, y_pred, average=None)
    f1 = f1_score(y_test, y_pred, average=None)
    
    classes = label_encoder.classes_
    for i, cls in enumerate(classes):
        print(f"\n{cls}:")
        print(f"  Precision: {precision[i]:.3f}")
        print(f"  Recall: {recall[i]:.3f}")
        print(f"  F1-Score: {f1[i]:.3f}")
    
    # 3. Probability metrics
    print("\n📈 Probability Metrics:")
    logloss = log_loss(y_test, y_pred_proba)
    print(f"  Log Loss: {logloss:.4f}")
    
    # 4. Confusion Matrix
    plt.figure(figsize=(10, 8))
    cm = confusion_matrix(y_test, y_pred)
    
    # Plot confusion matrix
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=classes, yticklabels=classes)
    plt.title('Confusion Matrix', fontsize=16)
    plt.ylabel('Actual', fontsize=12)
    plt.xlabel('Predicted', fontsize=12)
    
    # Add percentages
    for i in range(len(classes)):
        for j in range(len(classes)):
            percentage = cm[i, j] / cm[i].sum() * 100
            plt.text(j + 0.5, i + 0.7, f'({percentage:.1f}%)',
                    ha='center', fontsize=9, color='gray')
    
    plt.tight_layout()
    plt.show()
    
    # 5. Calibration Plot
    plt.figure(figsize=(10, 6))
    
    # Calculate calibration for each class
    for i, cls in enumerate(classes):
        # Get predicted probabilities for this class
        probs = y_pred_proba[:, i]
        
        # Create bins
        n_bins = 10
        bin_edges = np.linspace(0, 1, n_bins + 1)
        bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
        
        # Calculate actual frequency in each bin
        actual_freq = []
        predicted_freq = []
        
        for j in range(n_bins):
            mask = (probs >= bin_edges[j]) & (probs < bin_edges[j + 1])
            if mask.sum() > 0:
                actual_freq.append((y_test[mask] == i).mean())
                predicted_freq.append(probs[mask].mean())
        
        # Plot
        if actual_freq:
            plt.plot(predicted_freq, actual_freq, 'o-', label=cls)
    
    # Perfect calibration line
    plt.plot([0, 1], [0, 1], 'k--', label='Perfect Calibration')
    
    plt.xlabel('Mean Predicted Probability', fontsize=12)
    plt.ylabel('Actual Frequency', fontsize=12)
    plt.title('Calibration Plot', fontsize=14)
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.show()
    
    # 6. Feature Importance
    if hasattr(model, 'feature_importances_'):
        plt.figure(figsize=(10, 8))
        
        # Get feature importance
        importance = model.feature_importances_
        indices = np.argsort(importance)[-20:]  # Top 20
        
        plt.barh(range(len(indices)), importance[indices])
        plt.yticks(range(len(indices)), [X_test.columns[i] for i in indices])
        plt.xlabel('Feature Importance', fontsize=12)
        plt.title('Top 20 Most Important Features', fontsize=14)
        plt.tight_layout()
        plt.show()
    
    return {
        'accuracy': accuracy,
        'log_loss': logloss,
        'confusion_matrix': cm,
        'precision': precision,
        'recall': recall,
        'f1': f1
    }

# Run evaluation
evaluation_results = evaluate_model_comprehensive(
    model, X_test, y_test, label_encoder
)
```

---

## 🚀 Deployment & Production {#deployment}

### Create Production-Ready API

```python
# app.py - FastAPI deployment
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np

# Load model
model_data = joblib.load('premier_league_model.pkl')
model = model_data['model']
label_encoder = model_data['label_encoder']
feature_names = model_data['feature_names']

# Create API
app = FastAPI(title="Premier League Predictor")

class MatchRequest(BaseModel):
    home_team: str
    away_team: str
    features: dict

class PredictionResponse(BaseModel):
    home_team: str
    away_team: str
    home_win_probability: float
    draw_probability: float
    away_win_probability: float
    predicted_outcome: str
    confidence: float

@app.post("/predict", response_model=PredictionResponse)
async def predict_match(request: MatchRequest):
    """Predict match outcome"""
    
    try:
        # Prepare features
        features_df = pd.DataFrame([request.features])[feature_names]
        
        # Make prediction
        probabilities = model.predict_proba(features_df)[0]
        prediction = model.predict(features_df)[0]
        
        # Prepare response
        response = PredictionResponse(
            home_team=request.home_team,
            away_team=request.away_team,
            home_win_probability=float(probabilities[0]),
            draw_probability=float(probabilities[1]),
            away_win_probability=float(probabilities[2]),
            predicted_outcome=label_encoder.inverse_transform([prediction])[0],
            confidence=float(max(probabilities))
        )
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "model_accuracy": model_data['accuracy']}

# Run with: uvicorn app:app --reload
```

### Deploy with Docker

```dockerfile
# Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
# Build and run
docker build -t premier-league-predictor .
docker run -p 8000:8000 premier-league-predictor
```

---

## 📊 Performance Monitoring

```python
# monitor_performance.py
import mlflow
import pandas as pd
from datetime import datetime

def track_model_performance(model, X_test, y_test, experiment_name="premier-league"):
    """Track model performance with MLflow"""
    
    mlflow.set_experiment(experiment_name)
    
    with mlflow.start_run():
        # Log parameters
        mlflow.log_params(model.get_params())
        
        # Make predictions
        y_pred = model.predict(X_test)
        
        # Log metrics
        accuracy = accuracy_score(y_test, y_pred)
        mlflow.log_metric("accuracy", accuracy)
        mlflow.log_metric("log_loss", log_loss(y_test, model.predict_proba(X_test)))
        
        # Log model
        mlflow.sklearn.log_model(model, "model")
        
        # Log feature importance
        if hasattr(model, 'feature_importances_'):
            importance_df = pd.DataFrame({
                'feature': X_test.columns,
                'importance': model.feature_importances_
            }).sort_values('importance', ascending=False)
            
            mlflow.log_text(importance_df.to_csv(), "feature_importance.csv")
        
        print(f"Run logged to MLflow: {mlflow.active_run().info.run_id}")
```

---

## 🎯 Tips for Success

### 1. Data Quality
- Always clean your data thoroughly
- Handle missing values appropriately
- Remove duplicate matches
- Verify dates are correct

### 2. Feature Engineering
- Create domain-specific features (football knowledge)
- Use rolling averages for stability
- Consider time decay (recent matches more important)
- Don't forget interaction features

### 3. Model Training
- Always use proper cross-validation
- Don't overfit to training data
- Track multiple metrics, not just accuracy
- Ensemble multiple models for better performance

### 4. Production
- Version your models
- Monitor performance over time
- Retrain regularly with new data
- Have fallback predictions ready

---

## 🚀 Next Steps

1. **Collect more data** - More seasons = better models
2. **Add external features** - Weather, injuries, transfers
3. **Try deep learning** - LSTM for sequences, transformers
4. **Build UI** - Create web interface for predictions
5. **Backtest strategies** - Test betting performance

---

**Congratulations! You now have a complete ML training pipeline for Premier League predictions!** 🎉⚽

Remember: Always gamble responsibly. This is for educational purposes!