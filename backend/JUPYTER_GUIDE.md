# 📓 Jupyter Notebook Guide - God Mode Premier League Oracle 🔮

## 🚀 Quick Start (2 Minutes!)

### Step 1: Install Jupyter & Dependencies
```bash
# If you have Anaconda (recommended):
conda install jupyter notebook

# Install all requirements
pip install -r requirements.txt

# Or with conda:
conda env create -f environment.yml
conda activate premier-league-oracle
```

### Step 2: Start Services
```bash
# Start MLflow tracking server (in separate terminal)
mlflow ui --port 5000

# Start Redis (if using Docker)
docker run -d -p 6379:6379 redis

# Navigate to backend folder
cd backend

# Start Jupyter
jupyter notebook
```

### Step 3: Create Your First God Mode Notebook
Click "New" → "Python 3" to create a new notebook and start predicting!

---

## 🔮 God Mode Features in Jupyter

### 🧠 Complete ML Ensemble System

```python
# Cell 1: Initialize the God Mode Oracle
import sys
sys.path.append('/path/to/The-Premier-League-Oracle/backend')

from app.models.modern_oracle import ModernPremierLeagueOracle

# Initialize with your API keys
oracle = ModernPremierLeagueOracle(
    api_key="YOUR_FOOTBALL_DATA_KEY",
    openai_api_key="YOUR_OPENAI_KEY",  # Optional for LangChain
    mlflow_tracking_uri="http://localhost:5000"
)

# Cell 2: Make ensemble prediction with all models
result = oracle.predict_match_ensemble("Arsenal FC", "Chelsea FC")
print(f"🎯 Prediction: {result['ensemble_prediction']['predicted_outcome']}")
print(f"📊 Confidence: {result['ensemble_prediction']['confidence']:.1%}")
print(f"💰 Best Bet: {result['betting_value']['best_value']}")
```

### 💬 Natural Language Predictions with LangChain

```python
# Cell 1: Ask questions in plain English!
query = "Who will win between Arsenal and Chelsea this weekend?"
response = await oracle.predict_match_natural_language(query)
print(response['response'])

# Cell 2: Complex queries
queries = [
    "What's Liverpool's current form?",
    "Find matches similar to Man City vs Liverpool",
    "Is there betting value in the Manchester derby?",
    "Which team has the best defence this season?"
]

for q in queries:
    result = await oracle.predict_match_natural_language(q)
    print(f"Q: {q}")
    print(f"A: {result['response']}\n")
```

---

## 📊 God Mode Notebooks Collection

### 🎯 Notebook 1: Complete Ensemble Predictions

```python
# Cell 1: Setup God Mode Environment
import sys
import os
sys.path.append(os.path.abspath('.'))

import pandas as pd
import numpy as np
import torch
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Import our god mode modules
from app.models.modern_oracle import ModernPremierLeagueOracle
from app.models.xgboost_model import XGBoostPredictor
from app.models.lstm_predictor import LSTMPredictor
from app.models.transformer_model import TransformerPredictor
from app.features.advanced_engineering import AdvancedFeatureEngineer

# Initialize MLflow
import mlflow
mlflow.set_tracking_uri("http://localhost:5000")

print("🔮 God Mode Premier League Oracle")
print("=" * 50)
print("✅ All systems loaded!")
print(f"🔥 PyTorch using: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")

# Cell 2: Test Data Collector
from app.data.football_data_collector import FootballDataCollector

# Initialize collector (you'll need an API key)
collector = FootballDataCollector(api_key="YOUR_API_KEY")

# Get current Premier League standings
standings = collector.get_standings()
print(f"📊 Current Top 5:")
for i, team in enumerate(standings[:5], 1):
    print(f"{i}. {team['team']['name']} - {team['points']} pts")

# Cell 3: Test Feature Engineering
from app.features.engineering import FeatureEngineer

# Create sample match data
match_data = {
    'home_team': 'Arsenal',
    'away_team': 'Chelsea',
    'date': '2024-01-15'
}

# Generate features
engineer = FeatureEngineer()
features = engineer.create_features(match_data)

print(f"📈 Generated {len(features)} features!")
print("\nTop 10 features:")
for key, value in list(features.items())[:10]:
    print(f"  {key}: {value:.3f}")

# Cell 4: Make Prediction
from app.models.xgboost_model import XGBoostPredictor

# Create predictor
predictor = XGBoostPredictor()

# For demo, we'll use mock trained model
# In reality, you'd load a trained model
result = predictor.predict_single_match(
    "Arsenal", "Chelsea", 
    features
)

print("\n🎯 PREDICTION RESULT:")
print("=" * 50)
print(result['summary'])
print(f"\nConfidence: {result['confidence']:.1%}")

# Cell 5: Visualize Prediction
import matplotlib.pyplot as plt

# Create bar chart
outcomes = ['Arsenal Win', 'Draw', 'Chelsea Win']
probabilities = [result['home_win'], result['draw'], result['away_win']]
colors = ['#EF0107', '#CCCCCC', '#034694']  # Team colors

plt.figure(figsize=(10, 6))
bars = plt.bar(outcomes, probabilities, color=colors, edgecolor='black', linewidth=2)

# Add percentage labels
for bar, prob in zip(bars, probabilities):
    plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
             f'{prob:.1%}', ha='center', fontsize=12, fontweight='bold')

plt.title('Match Prediction: Arsenal vs Chelsea', fontsize=16, fontweight='bold')
plt.ylabel('Probability', fontsize=12)
plt.ylim(0, 1)
plt.grid(axis='y', alpha=0.3)

# Add confidence indicator
confidence_text = f"Model Confidence: {result['confidence']:.1%}"
plt.text(0.5, 0.95, confidence_text, transform=plt.gca().transAxes,
         ha='center', fontsize=11, bbox=dict(boxstyle='round', facecolor='wheat'))

plt.tight_layout()
plt.show()

# Cell 6: Feature Importance Analysis
# Show which features matter most
if hasattr(predictor, 'feature_importance'):
    importance = predictor.get_top_features(15)
    
    plt.figure(figsize=(10, 8))
    features_names = [f[0] for f in importance]
    features_values = [f[1] for f in importance]
    
    plt.barh(features_names, features_values, color='skyblue', edgecolor='navy')
    plt.xlabel('Importance Score', fontsize=12)
    plt.title('Top 15 Most Important Features', fontsize=14, fontweight='bold')
    plt.gca().invert_yaxis()
    
    for i, v in enumerate(features_values):
        plt.text(v + 0.01, i, f'{v:.2f}', va='center')
    
    plt.tight_layout()
    plt.show()
```

### Notebook 2: Train Your Own Model

```python
# Cell 1: Load Historical Data
import pandas as pd
from app.data.football_data_collector import FootballDataCollector

collector = FootballDataCollector(api_key="YOUR_API_KEY")

# Get last 100 matches
matches = collector.get_matches(limit=100)
df = pd.DataFrame(matches)

print(f"📊 Loaded {len(df)} matches")
print(df.head())

# Cell 2: Prepare Training Data
from app.features.engineering import FeatureEngineer

engineer = FeatureEngineer()
X_list = []
y_list = []

for _, match in df.iterrows():
    # Create features for this match
    features = engineer.create_features(match)
    X_list.append(features)
    
    # Create label (H=0, D=1, A=2)
    if match['home_score'] > match['away_score']:
        y_list.append(0)  # Home win
    elif match['home_score'] < match['away_score']:
        y_list.append(2)  # Away win
    else:
        y_list.append(1)  # Draw

X = pd.DataFrame(X_list)
y = pd.Series(y_list)

print(f"✅ Prepared {len(X)} training samples")
print(f"   Features: {X.shape[1]}")
print(f"   Class distribution: {y.value_counts().to_dict()}")

# Cell 3: Split Data
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print(f"📊 Training set: {len(X_train)} samples")
print(f"📊 Test set: {len(X_test)} samples")

# Cell 4: Train Model
from app.models.xgboost_model import XGBoostPredictor

predictor = XGBoostPredictor()

# Train with progress tracking
print("🎯 Training XGBoost model...")
results = predictor.train(
    X_train, y_train,
    X_test, y_test,
    optimize_hyperparams=False  # Set True for better performance (slower)
)

print(f"\n✅ Training complete!")
print(f"   Best iteration: {results['best_iteration']}")
print(f"   Best score: {results['best_score']:.4f}")

# Cell 5: Evaluate Model
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import seaborn as sns

# Make predictions on test set
predictions = predictor.predict(X_test, return_probabilities=False)
y_pred = predictions['predictions']

# Calculate accuracy
accuracy = accuracy_score(y_test, y_pred)
print(f"🎯 Test Accuracy: {accuracy:.2%}")

# Classification report
print("\n📊 Classification Report:")
print(classification_report(y_test, y_pred, 
                          target_names=['Home Win', 'Draw', 'Away Win']))

# Confusion matrix
plt.figure(figsize=(8, 6))
cm = confusion_matrix(y_test, y_pred)
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=['Home', 'Draw', 'Away'],
            yticklabels=['Home', 'Draw', 'Away'])
plt.title('Confusion Matrix')
plt.ylabel('Actual')
plt.xlabel('Predicted')
plt.show()

# Cell 6: Save Model
model_path = 'models/my_predictor.pkl'
predictor.save_model(model_path)
print(f"💾 Model saved to {model_path}")

# Cell 7: Test on New Match
# Load saved model
new_predictor = XGBoostPredictor(model_path=model_path)

# Predict upcoming match
upcoming_match = {
    'home_team': 'Manchester United',
    'away_team': 'Liverpool'
}

features = engineer.create_features(upcoming_match)
result = new_predictor.predict_single_match(
    upcoming_match['home_team'],
    upcoming_match['away_team'],
    features
)

print("\n🔮 Upcoming Match Prediction:")
print("=" * 50)
print(result['summary'])
```

---

## 🎨 Interactive Visualizations

### Create Beautiful Prediction Dashboards

```python
# Cell 1: Interactive Prediction Dashboard
import plotly.graph_objects as go
from plotly.subplots import make_subplots

def create_prediction_dashboard(home_team, away_team, prediction):
    """Create interactive dashboard for match prediction"""
    
    # Create subplots
    fig = make_subplots(
        rows=2, cols=2,
        subplot_titles=('Outcome Probabilities', 'Confidence Meter',
                       'Historical Performance', 'Key Factors'),
        specs=[[{'type': 'bar'}, {'type': 'indicator'}],
               [{'type': 'scatter'}, {'type': 'bar'}]]
    )
    
    # 1. Outcome probabilities
    fig.add_trace(
        go.Bar(x=['Home Win', 'Draw', 'Away Win'],
               y=[prediction['home_win'], prediction['draw'], prediction['away_win']],
               marker_color=['green', 'gray', 'red'],
               text=[f"{p:.1%}" for p in [prediction['home_win'], 
                                          prediction['draw'], 
                                          prediction['away_win']]],
               textposition='auto'),
        row=1, col=1
    )
    
    # 2. Confidence meter
    fig.add_trace(
        go.Indicator(
            mode="gauge+number",
            value=prediction['confidence'] * 100,
            title={'text': "Confidence"},
            gauge={'axis': {'range': [0, 100]},
                   'bar': {'color': "darkblue"},
                   'steps': [
                       {'range': [0, 50], 'color': "lightgray"},
                       {'range': [50, 80], 'color': "gray"}],
                   'threshold': {'line': {'color': "red", 'width': 4},
                                'thickness': 0.75, 'value': 90}}),
        row=1, col=2
    )
    
    # Update layout
    fig.update_layout(
        title=f"🎯 {home_team} vs {away_team} - Match Prediction Dashboard",
        showlegend=False,
        height=600
    )
    
    return fig

# Use it
result = predictor.predict_single_match("Arsenal", "Chelsea", features)
fig = create_prediction_dashboard("Arsenal", "Chelsea", result)
fig.show()
```

---

## 🧪 Testing Best Practices

### 1. Test Data Collection
```python
def test_data_collection():
    """Test that we can fetch data from API"""
    collector = FootballDataCollector(api_key="YOUR_KEY")
    
    # Test each endpoint
    tests = {
        'standings': collector.get_standings,
        'matches': lambda: collector.get_matches(limit=10),
        'teams': collector.get_teams
    }
    
    for name, func in tests.items():
        try:
            result = func()
            print(f"✅ {name}: Success ({len(result)} items)")
        except Exception as e:
            print(f"❌ {name}: Failed - {e}")

test_data_collection()
```

### 2. Test Feature Engineering
```python
def test_features():
    """Test feature generation"""
    engineer = FeatureEngineer()
    
    test_match = {
        'home_team': 'Arsenal',
        'away_team': 'Chelsea',
        'date': '2024-01-15'
    }
    
    features = engineer.create_features(test_match)
    
    # Check we have all expected features
    expected_features = [
        'home_form', 'away_form', 'home_goals_avg',
        'away_goals_avg', 'h2h_home_wins', 'days_rest'
    ]
    
    for feat in expected_features:
        assert feat in features, f"Missing feature: {feat}"
    
    print(f"✅ All {len(features)} features generated correctly!")

test_features()
```

### 3. Test Model Predictions
```python
def test_predictions():
    """Test that predictions make sense"""
    predictor = XGBoostPredictor()
    
    # Test edge cases
    test_cases = [
        ("Manchester City", "Sheffield United"),  # Strong vs weak
        ("Arsenal", "Tottenham"),  # Derby
        ("Brighton", "Brentford"),  # Mid-table clash
    ]
    
    for home, away in test_cases:
        result = predictor.predict_single_match(home, away, features)
        
        # Check probabilities sum to 1
        total = result['home_win'] + result['draw'] + result['away_win']
        assert abs(total - 1.0) < 0.01, f"Probabilities don't sum to 1: {total}"
        
        # Check confidence is reasonable
        assert 0 < result['confidence'] < 1, f"Invalid confidence: {result['confidence']}"
        
        print(f"✅ {home} vs {away}: {result['summary']}")

test_predictions()
```

---

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Issue: "ModuleNotFoundError"
```python
# Solution: Add backend to path
import sys
sys.path.append('/path/to/backend')
```

#### Issue: "No API Key"
```python
# Solution: Set environment variable
import os
os.environ['FOOTBALL_DATA_API_KEY'] = 'your_key_here'
```

#### Issue: "Memory Error with Large Datasets"
```python
# Solution: Process in chunks
chunk_size = 1000
for chunk in pd.read_csv('data.csv', chunksize=chunk_size):
    process(chunk)
```

#### Issue: "Slow Training"
```python
# Solution: Use subset for testing
X_small = X_train.sample(n=1000)
y_small = y_train.loc[X_small.index]
```

---

## 📚 Jupyter Tips & Tricks

### Magic Commands
```python
# Time your code
%%time
model.train(X_train, y_train)

# Profile memory usage
%load_ext memory_profiler
%memit model.predict(X_test)

# Auto-reload modules
%load_ext autoreload
%autoreload 2
```

### Keyboard Shortcuts
- `Shift + Enter`: Run cell and go to next
- `Ctrl + Enter`: Run cell and stay
- `A`: Insert cell above
- `B`: Insert cell below
- `DD`: Delete cell
- `M`: Change to Markdown
- `Y`: Change to Code

### Export Notebooks
```python
# As Python script
!jupyter nbconvert --to script my_notebook.ipynb

# As HTML report
!jupyter nbconvert --to html my_notebook.ipynb

# As PDF (needs LaTeX)
!jupyter nbconvert --to pdf my_notebook.ipynb
```

---

## 🔮 God Mode Notebook 2: MLflow Experiment Tracking

```python
# Cell 1: Setup MLflow tracking
import mlflow
import mlflow.sklearn
import mlflow.pytorch

mlflow.set_experiment("premier_league_predictions")

# Cell 2: Train and track multiple models
with mlflow.start_run(run_name="god_mode_ensemble"):
    
    # Train XGBoost with tracking
    with mlflow.start_run(run_name="xgboost", nested=True):
        xgb_model = XGBoostPredictor()
        results = xgb_model.train(X_train, y_train, X_val, y_val)
        
        mlflow.log_metrics({
            "accuracy": results['final_train_accuracy'],
            "best_score": results['best_score']
        })
        mlflow.xgboost.log_model(xgb_model.model, "model")
    
    # Train LSTM with tracking
    with mlflow.start_run(run_name="lstm", nested=True):
        lstm_model = LSTMPredictor()
        results = lstm_model.train(X_train, y_train, X_val, y_val)
        
        mlflow.log_metrics({
            "val_loss": results['best_val_loss'],
            "val_accuracy": results['final_val_accuracy']
        })
        mlflow.pytorch.log_model(lstm_model.model, "model")
    
    # Train Transformer with tracking
    with mlflow.start_run(run_name="transformer", nested=True):
        transformer_model = TransformerPredictor()
        results = transformer_model.train(X_train, y_train, X_val, y_val)
        
        mlflow.log_metrics({
            "val_accuracy": results['best_val_accuracy']
        })
        mlflow.pytorch.log_model(transformer_model.model, "model")

# Cell 3: Compare model performance
runs = mlflow.search_runs(experiment_names=["premier_league_predictions"])
print(runs[['run_name', 'metrics.accuracy', 'metrics.val_accuracy']].head(10))
```

## 🤖 God Mode Notebook 3: AutoML Model Comparison

```python
# Cell 1: AutoML setup with multiple algorithms
from sklearn.model_selection import cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from lightgbm import LGBMClassifier
from catboost import CatBoostClassifier
import optuna

# Cell 2: Compare all models automatically
models = {
    'XGBoost': XGBoostPredictor(),
    'LightGBM': LGBMClassifier(verbose=-1),
    'CatBoost': CatBoostClassifier(verbose=False),
    'RandomForest': RandomForestClassifier(n_estimators=100),
    'GradientBoosting': GradientBoostingClassifier(),
    'LSTM': LSTMPredictor(),
    'Transformer': TransformerPredictor()
}

results = {}
for name, model in models.items():
    print(f"Training {name}...")
    
    if name in ['LSTM', 'Transformer', 'XGBoost']:
        # Custom training for our models
        model.train(X_train, y_train, X_val, y_val)
        # Get validation accuracy
        preds = model.predict(X_val)
        accuracy = (preds['predictions'] == y_val).mean()
    else:
        # Sklearn-compatible models
        scores = cross_val_score(model, X_train, y_train, cv=5, scoring='accuracy')
        accuracy = scores.mean()
    
    results[name] = accuracy
    print(f"{name}: {accuracy:.4f}")

# Cell 3: Visualize model comparison
import plotly.graph_objects as go

fig = go.Figure(data=[
    go.Bar(
        x=list(results.keys()),
        y=list(results.values()),
        text=[f"{v:.2%}" for v in results.values()],
        textposition='auto',
        marker_color=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2']
    )
])

fig.update_layout(
    title="🏆 Model Performance Comparison",
    xaxis_title="Model",
    yaxis_title="Accuracy",
    showlegend=False,
    height=500
)

fig.show()

# Cell 4: Optimize ensemble weights
def optimize_ensemble_weights(models, X_val, y_val):
    def objective(trial):
        weights = []
        for i, name in enumerate(models.keys()):
            if i < len(models) - 1:
                weights.append(trial.suggest_float(f'weight_{name}', 0.0, 1.0))
        
        # Last weight is 1 - sum of others
        weights.append(1.0 - sum(weights))
        
        if weights[-1] < 0:
            return 0.0
        
        # Calculate ensemble prediction
        ensemble_pred = np.zeros((len(X_val), 3))
        for (name, model), weight in zip(models.items(), weights):
            pred = model.predict(X_val)['probabilities']
            ensemble_pred += pred * weight
        
        # Calculate accuracy
        predictions = np.argmax(ensemble_pred, axis=1)
        accuracy = (predictions == y_val).mean()
        
        return accuracy
    
    study = optuna.create_study(direction='maximize')
    study.optimize(objective, n_trials=100)
    
    return study.best_params

best_weights = optimize_ensemble_weights(models, X_val, y_val)
print(f"🎯 Optimal ensemble weights: {best_weights}")
```

## 🔍 God Mode Notebook 4: Feature Importance & Explainability

```python
# Cell 1: Generate 150+ features
engineer = AdvancedFeatureEngineer()
features = engineer.create_all_features("Arsenal FC", "Chelsea FC")

print(f"📊 Generated {len(features)} features!")

# Categorize features
categories = {
    'Basic Stats': [f for f in features if 'goals' in f or 'points' in f],
    'Advanced Metrics': [f for f in features if 'xg' in f or 'pressure' in f],
    'Form & Momentum': [f for f in features if 'form' in f or 'momentum' in f],
    'Head-to-Head': [f for f in features if 'h2h' in f],
    'Contextual': [f for f in features if 'derby' in f or 'fatigue' in f],
    'Betting': [f for f in features if 'odds' in f or 'value' in f],
    'Tactical': [f for f in features if 'style' in f or 'tactical' in f]
}

for category, feats in categories.items():
    print(f"\n{category}: {len(feats)} features")

# Cell 2: SHAP explanations for XGBoost
import shap

# Train model
xgb_model = XGBoostPredictor()
xgb_model.train(X_train, y_train)

# Create SHAP explainer
explainer = shap.TreeExplainer(xgb_model.model)
shap_values = explainer.shap_values(X_test[:100])

# Cell 3: Visualize feature importance
# Summary plot
shap.summary_plot(shap_values, X_test[:100], plot_type="bar", class_names=['Home', 'Draw', 'Away'])

# Force plot for single prediction
shap.force_plot(
    explainer.expected_value[0],
    shap_values[0][0],
    X_test.iloc[0],
    feature_names=X_test.columns.tolist()
)

# Cell 4: Transformer attention visualization
transformer = TransformerPredictor()
result = transformer.predict_single_match(
    "Arsenal FC", "Chelsea FC",
    recent_features,
    explain=True
)

# Plot attention weights
import seaborn as sns
import matplotlib.pyplot as plt

attention_scores = [f['attention_score'] for f in result['key_factors']]
feature_names = [f['feature'] for f in result['key_factors']]

plt.figure(figsize=(12, 6))
sns.barplot(x=attention_scores, y=feature_names, palette='viridis')
plt.title('🧠 Transformer Model - Feature Attention Scores')
plt.xlabel('Attention Weight')
plt.tight_layout()
plt.show()
```

## 💰 God Mode Notebook 5: Betting Intelligence & Value Analysis

```python
# Cell 1: Initialize betting analysis system
oracle = ModernPremierLeagueOracle(
    api_key="YOUR_KEY",
    openai_api_key="YOUR_OPENAI_KEY"
)

# Cell 2: Analyze entire gameweek for value bets
gameweek_matches = [
    ("Arsenal FC", "Chelsea FC"),
    ("Liverpool FC", "Manchester City FC"),
    ("Manchester United FC", "Tottenham Hotspur FC"),
    ("Newcastle United FC", "Brighton & Hove Albion FC"),
    ("Aston Villa FC", "West Ham United FC")
]

value_bets = []

for home, away in gameweek_matches:
    result = oracle.predict_match_ensemble(home, away)
    betting = result['betting_value']
    
    # Find positive expected value bets
    for outcome, data in betting['outcomes'].items():
        if data['has_value']:
            value_bets.append({
                'match': f"{home} vs {away}",
                'bet': outcome,
                'odds': data['odds'],
                'probability': data['probability'],
                'expected_value': data['expected_value'],
                'confidence': result['ensemble_prediction']['confidence']
            })

# Sort by expected value
value_bets = sorted(value_bets, key=lambda x: x['expected_value'], reverse=True)

# Display top value bets
import pandas as pd
df_values = pd.DataFrame(value_bets)
print("💎 Top Value Bets:")
print(df_values.head(10))

# Cell 3: Kelly Criterion for optimal bet sizing
def kelly_criterion(probability, odds, kelly_fraction=0.25):
    """Calculate optimal bet size using Kelly Criterion"""
    q = 1 - probability
    kelly = (probability * odds - q) / odds
    return max(0, kelly * kelly_fraction)  # Use fractional Kelly for safety

# Calculate optimal bet sizes
bankroll = 1000  # Example bankroll
for bet in value_bets[:5]:
    bet_size = kelly_criterion(bet['probability'], bet['odds'])
    amount = bankroll * bet_size
    bet['kelly_size'] = bet_size
    bet['bet_amount'] = amount
    print(f"Match: {bet['match']}")
    print(f"Bet: {bet['bet']} @ {bet['odds']}")
    print(f"Optimal bet: ${amount:.2f} ({bet_size:.1%} of bankroll)")
    print(f"Expected profit: ${amount * (bet['odds'] - 1):.2f}\n")

# Cell 4: Historical backtesting
def backtest_strategy(historical_matches, strategy='value_betting'):
    initial_bankroll = 1000
    bankroll = initial_bankroll
    bet_history = []
    
    for match in historical_matches:
        # Get prediction
        result = oracle.predict_match_ensemble(
            match['home_team'],
            match['away_team']
        )
        
        # Find best value bet
        betting = result['betting_value']
        best_bet = betting['best_value']
        best_ev = betting['best_expected_value']
        
        if best_ev > 0.05:  # Only bet if EV > 5%
            # Calculate bet size
            bet_size = kelly_criterion(
                result['ensemble_prediction'][best_bet],
                betting['outcomes'][best_bet]['odds']
            )
            bet_amount = bankroll * bet_size
            
            # Simulate bet outcome (would use actual result in real backtesting)
            actual_outcome = match['actual_outcome']
            if best_bet == actual_outcome:
                profit = bet_amount * (betting['outcomes'][best_bet]['odds'] - 1)
            else:
                profit = -bet_amount
            
            bankroll += profit
            
            bet_history.append({
                'match': f"{match['home_team']} vs {match['away_team']}",
                'bet': best_bet,
                'amount': bet_amount,
                'profit': profit,
                'bankroll': bankroll
            })
    
    return {
        'final_bankroll': bankroll,
        'total_profit': bankroll - initial_bankroll,
        'roi': (bankroll - initial_bankroll) / initial_bankroll,
        'bet_history': bet_history
    }

# Run backtest (would need historical data)
# backtest_result = backtest_strategy(historical_matches)
# print(f"ROI: {backtest_result['roi']:.1%}")
```

## 🌐 God Mode Notebook 6: FastAPI Integration

```python
# Cell 1: Test API endpoints
import requests
import asyncio

API_URL = "http://localhost:8000"
API_KEY = "your_api_key"

headers = {
    "Authorization": f"Bearer {API_KEY}"
}

# Cell 2: Make prediction via API
response = requests.post(
    f"{API_URL}/predict",
    json={
        "home_team": "Arsenal FC",
        "away_team": "Chelsea FC",
        "include_details": True
    },
    headers=headers
)

prediction = response.json()
print(f"🎯 API Prediction: {prediction['prediction']}")
print(f"💰 Betting Value: {prediction['betting_value']}")

# Cell 3: Natural language query
response = requests.post(
    f"{API_URL}/predict/natural",
    json={
        "query": "What are the chances of Liverpool beating Man City?"
    },
    headers=headers
)

print(response.json()['response'])

# Cell 4: WebSocket for live updates
import websockets
import json

async def subscribe_to_predictions():
    uri = "ws://localhost:8000/ws/predictions"
    
    async with websockets.connect(uri) as websocket:
        # Subscribe to a match
        await websocket.send(json.dumps({
            "action": "subscribe",
            "match": "Arsenal FC vs Chelsea FC"
        }))
        
        # Receive updates
        while True:
            message = await websocket.recv()
            data = json.loads(message)
            print(f"📡 Live Update: {data}")

# Run WebSocket client
# asyncio.run(subscribe_to_predictions())
```

## 🎯 Next Steps with God Mode

1. **Train the ensemble** with real historical data
2. **Optimize model weights** using Optuna
3. **Deploy to production** with Docker and Kubernetes
4. **Set up real-time data pipeline** for live predictions
5. **Create betting bot** with automated value betting
6. **Build web dashboard** for visualization
7. **Add more models** (Neural Networks, Time Series)
8. **Implement reinforcement learning** for continuous improvement

---

## 📖 God Mode Resources

- [MLflow Documentation](https://mlflow.org/docs/latest/index.html)
- [LangChain Guide](https://python.langchain.com/docs/get_started/introduction)
- [PyTorch Lightning](https://lightning.ai/docs/pytorch/stable/)
- [Optuna Hyperparameter Optimization](https://optuna.org/)
- [SHAP Explanations](https://shap.readthedocs.io/)
- [FastAPI Production](https://fastapi.tiangolo.com/deployment/)

---

**🔮 Welcome to God Mode - The Ultimate Premier League Oracle! ⚽**