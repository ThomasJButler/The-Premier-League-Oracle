import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.feature_selection import SelectFromModel
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import brier_score_loss, log_loss
from scipy.stats import poisson
import joblib
import os

# Set matplotlib to non-interactive mode
plt.ioff()

# Load the data
file_path = r'Y:\Personal\AI\EPLpredictor\PremierLeagueResults.csv'
df = pd.read_csv(file_path)

# Data Preprocessing
def preprocess_data(df):
    # Convert 'Date' column to datetime format
    df['Date'] = pd.to_datetime(df['Date'], dayfirst=True)
    
    # Ensure 'FTHG' and 'FTAG' are numeric
    df['FTHG'] = pd.to_numeric(df['FTHG'], errors='coerce')
    df['FTAG'] = pd.to_numeric(df['FTAG'], errors='coerce')
    
    # Fill missing values
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())
    
    # Feature Engineering
    df['GoalDiff'] = df['FTHG'] - df['FTAG']
    
    home_goals = df.groupby('HomeTeam')['FTHG'].mean().reset_index().rename(columns={'FTHG': 'HomeAvgGoals'})
    away_goals = df.groupby('AwayTeam')['FTAG'].mean().reset_index().rename(columns={'FTAG': 'AwayAvgGoals'})
    df = df.merge(home_goals, on='HomeTeam')
    df = df.merge(away_goals, on='AwayTeam')
    
    df['HomePoints'] = df['FTR'].apply(lambda x: 3 if x == 'H' else 1 if x == 'D' else 0)
    df['AwayPoints'] = df['FTR'].apply(lambda x: 3 if x == 'A' else 1 if x == 'D' else 0)
    
    def create_lag_features(df, team_col, goals_col, points_col, lag=5):
        df = df.sort_values(by=['Date'])
        for i in range(1, lag+1):
            df[f'{team_col}_lag_{i}'] = df.groupby(team_col)[goals_col].shift(i)
            df[f'{team_col}_points_lag_{i}'] = df.groupby(team_col)[points_col].shift(i)
        return df
    
    df = create_lag_features(df, 'HomeTeam', 'FTHG', 'HomePoints')
    df = create_lag_features(df, 'AwayTeam', 'FTAG', 'AwayPoints')
    
    df.fillna(0, inplace=True)
    
    # Encode categorical variables
    le = LabelEncoder()
    df['HomeTeam'] = le.fit_transform(df['HomeTeam'])
    df['AwayTeam'] = le.fit_transform(df['AwayTeam'])
    
    return df, le

df, le = preprocess_data(df)

# Model Selection and Training
def train_model(df, le):
    features = ['HomeAvgGoals', 'AwayAvgGoals', 'GoalDiff', 'HomeTeam', 'AwayTeam'] + \
               [f'HomeTeam_lag_{i}' for i in range(1, 6)] + \
               [f'AwayTeam_lag_{i}' for i in range(1, 6)] + \
               [f'HomeTeam_points_lag_{i}' for i in range(1, 6)] + \
               [f'AwayTeam_points_lag_{i}' for i in range(1, 6)]
    target = 'FTR'
    
    df[target] = df[target].map({'H': 0, 'D': 1, 'A': 2})
    
    X = df[features]
    y = df[target]
    
    # TimeSeriesSplit for time-based cross-validation
    tscv = TimeSeriesSplit(n_splits=5)
    
    # Create a pipeline with feature selection and model
    pipeline = Pipeline([
        ('imputer', SimpleImputer(strategy='mean')),
        ('scaler', StandardScaler()),
        ('feature_selection', SelectFromModel(RandomForestClassifier(random_state=42))),
        ('pca', PCA(n_components=10)),
        ('classifier', GradientBoostingClassifier(random_state=42))
    ])
    
    param_grid = {
        'classifier__n_estimators': [100, 200],
        'classifier__max_depth': [3, 5, 10],
        'classifier__learning_rate': [0.01, 0.1, 0.2],
        'classifier__min_samples_split': [2, 5],
        'classifier__min_samples_leaf': [1, 2]
    }
    
    grid_search = GridSearchCV(pipeline, param_grid, cv=tscv, scoring='accuracy', n_jobs=-1)
    grid_search.fit(X, y)
    
    best_model = grid_search.best_estimator_
    
    # Calibrate the model for better probability estimates
    calibrated_model = CalibratedClassifierCV(best_model, cv=tscv, method='sigmoid')
    calibrated_model.fit(X, y)
    
    return calibrated_model, grid_search.best_params_

model, best_params = train_model(df, le)

# Save the model
model_path = r'Y:\Personal\AI\EPLpredictor\best_model.pkl'
joblib.dump(model, model_path)

# Prediction Functions
def predict_outcome(home_team, away_team, model, df, le):
    home_team_enc = le.transform([home_team])[0]
    away_team_enc = le.transform([away_team])[0]
    home_avg_goals = df[df['HomeTeam'] == home_team_enc]['HomeAvgGoals'].values[0]
    away_avg_goals = df[df['AwayTeam'] == away_team_enc]['AwayAvgGoals'].values[0]
    goal_diff = home_avg_goals - away_avg_goals

    home_lag_features = [df[df['HomeTeam'] == home_team_enc][f'HomeTeam_lag_{i}'].values[0] for i in range(1, 6)]
    away_lag_features = [df[df['AwayTeam'] == away_team_enc][f'AwayTeam_lag_{i}'].values[0] for i in range(1, 6)]
    home_points_lag_features = [df[df['HomeTeam'] == home_team_enc][f'HomeTeam_points_lag_{i}'].values[0] for i in range(1, 6)]
    away_points_lag_features = [df[df['AwayTeam'] == away_team_enc][f'AwayTeam_points_lag_{i}'].values[0] for i in range(1, 6)]

    features = [home_avg_goals, away_avg_goals, goal_diff, home_team_enc, away_team_enc] + home_lag_features + away_lag_features + home_points_lag_features + away_points_lag_features
    features = np.array(features).reshape(1, -1)
    
    # Predict probabilities
    probs = model.predict_proba(features)[0]
    result_map = {0: 'Home Win', 1: 'Draw', 2: 'Away Win'}
    predicted_result = result_map[np.argmax(probs)]
    
    return predicted_result, probs

def predict_outcomes(matches, model, df, le):
    results = []
    for match in matches:
        home_team, away_team = match
        result, probs = predict_outcome(home_team, away_team, model, df, le)
        results.append((home_team, away_team, result, probs))
    return results

def bet_builder(home_team, away_team, model, df, le):
    outcome, probs = predict_outcome(home_team, away_team, model, df, le)
    home_team_enc = le.transform([home_team])[0]
    away_team_enc = le.transform([away_team])[0]
    home_goals = df[df['HomeTeam'] == home_team_enc]['FTHG'].mean()
    away_goals = df[df['AwayTeam'] == away_team_enc]['FTAG'].mean()
    total_goals = home_goals + away_goals
    
    return {
        'Outcome': outcome,
        'Probabilities': probs,
        'Home Goals': home_goals,
        'Away Goals': away_goals,
        'Total Goals': total_goals
    }

# Customization Options
def customize_script(df, le, model):
    print("Available Teams: ", le.classes_)
    options = """
    Select an option:
    1. Predict the outcome of a specific match.
    2. Predict the outcomes of matches.
    3. Generate bet builder statistics for a match.
    4. Show the highest scoring games of the season.
    5. Show the games with the largest goal differences.
    6. Show the average goals per game for each team.
    7. Show the win/loss/draw ratio for each team.
    8. Show the distribution of full-time home and away goals.
    9. Show the correlation matrix of the dataset.
    10. Show the form (last 5 games) of a specific team.
    11. Show the head-to-head statistics between two teams.
    12. Show goals over 90 mins compared to the rest.
    """
    print(options)

    try:
        option = int(input("Enter the option number: "))

        if option == 1:
            home_team = input("Enter Home Team: ")
            away_team = input("Enter Away Team: ")
            result, probs = predict_outcome(home_team, away_team, model, df, le)
            print(f"Predicted Outcome: {result}")
            print(f"Probabilities: {probs}")
        elif option == 2:
            matches = []
            n = int(input("Enter number of matches to predict: "))
            for _ in range(n):
                home_team = input("Enter Home Team: ")
                away_team = input("Enter Away Team: ")
                matches.append((home_team, away_team))
            results = predict_outcomes(matches, model, df, le)
            for result in results:
                print(f"{result[0]} vs {result[1]}: {result[2]} (Probabilities: {result[3]})")
        elif option == 3:
            home_team = input("Enter Home Team: ")
            away_team = input("Enter Away Team: ")
            print(bet_builder(home_team, away_team, model, df, le))
        elif option == 4:
            print(highest_scoring_games(df))
        elif option == 5:
            print(largest_goal_differences(df))
        elif option == 6:
            print(average_goals_per_game(df))
        elif option == 7:
            print(win_loss_draw_ratio(df))
        elif option == 8:
            plot_goal_distribution(df)
        elif option == 9:
            plot_correlation_matrix(df)
        elif option == 10:
            team = input("Enter Team: ")
            print(team_form(team, df, le))
        elif option == 11:
            home_team = input("Enter Home Team: ")
            away_team = input("Enter Away Team: ")
            print(head_to_head(home_team, away_team, df, le))
        elif option == 12:
            print(goals_over_90(df))
        else:
            print("Invalid option selected.")
    except ValueError:
        print("Invalid input. Please enter a number between 1 and 12.")

customize_script(df, le, model)