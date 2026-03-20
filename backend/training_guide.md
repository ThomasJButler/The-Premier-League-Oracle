# Free-Tier Model Training Guide

A practical guide to training, evaluating, and improving the Premier League Oracle's prediction model. Written for someone who knows the project inside out but wants a structured approach to ML experimentation.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Prerequisites](#2-prerequisites)
3. [Training Commands Reference](#3-training-commands-reference)
4. [Understanding the Output](#4-understanding-the-output)
5. [Key Metrics Explained](#5-key-metrics-explained)
6. [The Three Models](#6-the-three-models)
7. [How to Compare Models](#7-how-to-compare-models)
8. [Hyperparameter Tuning Guide](#8-hyperparameter-tuning-guide)
9. [Feature Engineering](#9-feature-engineering)
10. [The Draw Problem](#10-the-draw-problem)
11. [Calibration](#11-calibration)
12. [Common Experiments](#12-common-experiments)
13. [Troubleshooting](#13-troubleshooting)
14. [Current Baseline](#14-current-baseline)

---

## 1. Quick Start

Three commands you'll use 90% of the time:

```bash
# Activate the environment first (always)
conda activate anaconda-ml-ai
cd backend

# Standard training run — your bread and butter
python train_free_tier.py

# Training with hyperparameter search (slower, use when experimenting)
python train_free_tier.py --tune --tune-trials 25

# Full evaluation — rolling CV gives the most honest accuracy picture
python train_free_tier.py --cv
```

After any run, the key numbers to look at are printed at the end under `=== Model Comparison ===`. That's your headline result.

---

## 2. Prerequisites

### Environment

```bash
conda activate anaconda-ml-ai
```

All backend commands require this conda environment. If you get import errors, this is almost always the reason.

### Training Data

CSV files live in `backend/spreadsheets/KnowledgeFilesCSV/`:

```
EPL20202021.csv      — 2020/21 season (380 matches)
EPL20212022.csv      — 2021/22 season (380 matches)
EPL20222023.csv      — 2022/23 season (380 matches)
EPL20232024.csv      — 2023/24 season (380 matches)
EPL20242025.csv      — 2024/25 season (380 matches)
EPL20252026*.csv     — 2025/26 season (partial, matches to date)
```

**Total: ~2,191 matches** (6 seasons). After the warm-up filter strips matches where either team has fewer than 5 prior appearances, you end up with roughly 1,680 usable training samples.

### Required CSV Columns

```
Date, HomeTeam, AwayTeam, FTHG, FTAG, FTR, HTHG, HTAG, HTR,
HS, AS, HST, AST, HC, AC, HY, AY, HR, AR, HF, AF, Referee
```

The `FTR` column (Full Time Result) is the prediction target: `H` (home win), `D` (draw), `A` (away win).

### Output Files

Training produces two files in `backend/models/`:
- `xgboost_free_tier.joblib` — the trained model (used by the API server)
- `calibration_curve.png` — visual check of probability quality

---

## 3. Training Commands Reference

### Basic Training

```bash
python train_free_tier.py
```

The default run. Takes 1-3 minutes. Does:
1. Loads CSVs, builds 99 features per match
2. Splits data 80/20 chronologically (no shuffling — crucial)
3. Trains XGBoost on all features, then drops low-importance ones and retrains
4. Calibrates probabilities with isotonic regression
5. Trains logistic regression baseline (for comparison)
6. Trains stacked ensemble (3 One-vs-Rest classifiers + meta-learner)
7. Compares all three models
8. Saves the best configuration to `models/xgboost_free_tier.joblib`

### With Hyperparameter Tuning

```bash
python train_free_tier.py --tune                   # 25 random trials (default)
python train_free_tier.py --tune --tune-trials 50  # 50 trials (more thorough)
python train_free_tier.py --tune --tune-trials 100 # 100 trials (go get a coffee)
```

Runs a random search over 8 hyperparameters before training. Each trial trains a model with random settings and keeps the best. **Use this when you've changed features or data** and want the model to find optimal settings for the new configuration.

25 trials takes 3-5 minutes. 100 trials takes 10-20 minutes.

### Rolling Cross-Validation

```bash
python train_free_tier.py --cv
```

The most honest evaluation. Instead of a single 80/20 split, it trains on seasons 1..k and validates on season k+1 for each fold:

```
Fold 1: train 2020/21–2021/22, validate 2022/23
Fold 2: train 2020/21–2022/23, validate 2023/24
Fold 3: train 2020/21–2023/24, validate 2024/25
Fold 4: train 2020/21–2024/25, validate 2025/26
```

This tells you how your model performs across different seasons, not just whichever one happens to be the last 20%. **A model that scores 51% on the basic split but 45% mean on CV is overfitting** — it memorised recent patterns but doesn't generalise.

The CV results are for evaluation only — the final saved model is still trained on the full 80/20 split.

### Held-Out Test

```bash
python train_free_tier.py --test
```

Evaluates on the 2025/26 season data specifically. Useful if you want to see how the model performs on the current season. Can be combined with other flags:

```bash
python train_free_tier.py --tune --cv --test  # The full works
```

### Custom Data Directory

```bash
python train_free_tier.py --csv-dir /path/to/your/csvs
```

If your CSV files are somewhere else. Rarely needed.

---

## 4. Understanding the Output

The training script logs each stage. Here's what to look for.

### Stage: Data Loading

```
Loading CSV data from spreadsheets/KnowledgeFilesCSV
Class distribution: {'H': 989, 'D': 521, 'A': 681}
```

**What to check:** The class distribution. Home wins should be ~45%, draws ~24%, away wins ~31%. If these are wildly off, your CSV data might be corrupted or incomplete.

### Stage: Feature Matrix

```
Dataset built: 1684 samples, 507 skipped (warmup/invalid), 99 features
```

**What to check:** Sample count. If this drops significantly from a previous run, you've either lost CSV data or broken the feature engineer. The skipped count is normal — those are the first ~5 matches per team where there's not enough history to compute features.

### Stage: Train/Val Split

```
Split: 1347 training, 337 validation (80%/20%)
```

**What to check:** Roughly 80/20. The validation set is always the most recent matches (chronological split, no shuffling). This is critical — shuffled splits leak future information and give misleadingly high accuracy.

### Stage: XGBoost Training

```
Class weights: {'Home win': '0.877', 'Draw': '1.430', 'Away win': '1.010'}
Recency weights: {'2020/21': '0.444', '2021/22': '0.522', ..., '2024/25': '1.000'}
XGBoost trained: best iteration 187, val mlogloss 1.0341
```

**What to check:**
- **Class weights** — draws should have the highest weight (they're the minority class)
- **Recency weights** — oldest season should be lowest, most recent = 1.0
- **Best iteration** — how many boosting rounds were used before early stopping kicked in. If this hits the maximum (1000), the model wants more rounds. If it's very low (< 50), the model is struggling to learn

### Stage: Feature Selection

```
Feature selection: keeping 72/99 features (dropped 27 with importance < 0.0050)
```

**What to check:** How many features survived. Dropping 20-30 is typical. If nearly all are dropped, something is wrong with the features. If none are dropped, the threshold might be too low.

### Stage: Calibration

```
Calibration: log loss 1.0341 → 0.8512 (-0.1829)
```

**What to check:** The arrow should show a decrease (improvement). Calibration maps overconfident XGBoost probabilities to realistic ones. A big improvement here (like 1.03 → 0.85) means the raw model was quite overconfident. If calibration makes things worse, the validation set might be too small.

### Stage: Model Comparison (THE KEY OUTPUT)

```
=== Model Comparison ===
Stacked Ensemble: 51.0% | XGBoost (calibrated): 49.3% | LR baseline: 48.1%

  Per-class accuracy (Ensemble vs XGBoost):
    Home win    62.1% vs  60.3% (+1.8%)
    Draw         6.7% vs   4.2% (+2.5%)
    Away win    58.9% vs  57.1% (+1.8%)
```

**This is the section that matters most.** After every training run, check:
1. **Ensemble vs XGBoost** — the ensemble should beat or match XGBoost
2. **Per-class accuracy** — especially draw accuracy (see [The Draw Problem](#10-the-draw-problem))
3. **LR baseline** — if your fancy model can't beat logistic regression, something is wrong

### Stage: Top Features

```
=== Top 20 Features ===
   1. elo_difference                     0.0821
   2. home_elo                           0.0654
   3. position_difference                0.0532
   ...
```

**What to check:** Do the top features make intuitive sense? Elo difference, position difference, and form metrics should be near the top. If obscure features dominate, the model might be latching onto noise.

---

## 5. Key Metrics Explained

### Accuracy (Overall)

**What it is:** Percentage of matches where the predicted outcome (highest probability class) matched the actual result.

| Range | Interpretation |
|-------|---------------|
| > 55% | Excellent — you've probably found something real, or you're overfitting |
| 50-55% | Good — this is the realistic target range for free-tier data |
| 45-50% | Mediocre — about as good as always picking the most common result |
| < 45% | Bad — worse than a naive strategy; something is wrong |

**Context:** Random guessing on a 3-class problem gives 33%. Always predicting "home win" (the most common result at ~45%) gives ~45%. So our model needs to beat 45% to be useful. The current 51% baseline is decent for the data we have.

### Per-Class Accuracy

**What it is:** How often the model correctly identifies each outcome type.

| Class | Current | Target | Notes |
|-------|---------|--------|-------|
| Home win | ~62% | 60-70% | Easiest to predict — home advantage is real |
| Away win | ~59% | 55-65% | Second easiest |
| Draw | ~7% | 15-25% | The hard one — see [The Draw Problem](#10-the-draw-problem) |

**Why it matters:** A model can score 51% overall by being good at home/away wins and terrible at draws. Per-class accuracy tells you the full story.

### Log Loss

**What it is:** Measures how good the predicted probabilities are, not just the final prediction. A model that says "60% home win" and gets it right scores better than one that says "40% home win" and gets it right (because the first was more confident *and* correct).

| Range | Interpretation |
|-------|---------------|
| < 0.90 | Excellent calibration |
| 0.90 - 1.00 | Good |
| 1.00 - 1.05 | Average (this is where our model sits pre-calibration) |
| > 1.05 | Poor — probabilities are quite unreliable |
| > 1.10 | The model's confidence is actively misleading |

**For betting:** Log loss matters more than accuracy. A model with 49% accuracy but good log loss (well-calibrated probabilities) can still find value bets. A model with 52% accuracy but terrible log loss might cost you money because its confidence is unreliable.

### Brier Score

**What it is:** Average squared difference between predicted probabilities and actual outcomes. Lower is better.

| Range | Interpretation |
|-------|---------------|
| < 0.40 | Very good |
| 0.40 - 0.45 | Good |
| 0.45 - 0.50 | Average |
| > 0.50 | Poor |

**In practice:** Brier score and log loss usually tell the same story. If they disagree, pay more attention to log loss (it penalises confident wrong predictions more harshly).

### AUC-ROC (Per-Class)

**What it is:** How well the model separates one class from the others, regardless of the decision threshold. 0.5 = random coin flip, 1.0 = perfect separation.

| Range | Interpretation |
|-------|---------------|
| > 0.70 | Good discrimination |
| 0.60 - 0.70 | Moderate — the model has some signal |
| 0.50 - 0.60 | Barely better than random |
| = 0.50 | No discriminative ability at all |

**What to look for:** Home win and away win AUC should be 0.60+. Draw AUC is typically lower (0.50-0.55) — if you can push draw AUC above 0.60, that's a significant win.

---

## 6. The Three Models

The training script produces three models. Here's what each one is and why it exists.

### XGBoost (Primary Model)

**What:** Gradient-boosted decision trees. The main workhorse. Builds many small decision trees sequentially, each one learning from the previous one's mistakes.

**Why it's good:** Handles non-linear relationships, missing data, and feature interactions naturally. Doesn't need feature scaling. Generally the best out-of-the-box algorithm for tabular data.

**What gets saved:** This is the primary model in the `.joblib` file, along with its calibrators.

### Logistic Regression (Baseline)

**What:** The simplest reasonable model — a linear equation that maps features to probabilities. No trees, no complexity.

**Why it exists:** As a sanity check. If XGBoost can't beat logistic regression, your features are either too noisy or XGBoost is overfitting. The gap between them tells you how much the non-linear complexity is actually helping.

**Typical performance:** 2-4% below XGBoost. If XGBoost is at 51%, LR should be around 47-49%.

### Stacked Ensemble (Production Model)

**What:** Three separate XGBoost models, each specialising in one outcome (home win vs rest, draw vs rest, away win vs rest), feeding into a logistic regression "meta-learner" that combines their predictions.

**Why it exists:** The standard 3-class XGBoost optimises overall log loss, which means it under-invests in learning draws (the minority class). The ensemble gives draws their own dedicated model with custom hyperparameters (more conservative, higher regularisation).

**What gets deployed:** When both the ensemble and XGBoost are saved, the API server uses the ensemble by default. This is the model that actually makes predictions in production.

**Key detail:** The draw classifier in the ensemble uses different hyperparameters:
- `max_depth: 4` (vs 6 for home/away) — shallower trees, less overfitting
- `learning_rate: 0.03` (vs 0.05) — learns more carefully
- `min_child_weight: 5` (vs 3) — requires more evidence per leaf
- `reg_lambda: 2.0` (vs 1.0) — stronger regularisation

---

## 7. How to Compare Models

### The Comparison Workflow

Every time you make a change (features, hyperparameters, data), follow this process:

#### Step 1: Record Your Baseline

Before changing anything, do a training run and write down the results:

```bash
python train_free_tier.py --cv 2>&1 | tee baseline_run.log
```

(The `| tee baseline_run.log` saves the output to a file while still printing it.)

#### Step 2: Make Your Change

Edit the code. Change one thing at a time. Seriously — changing multiple things makes it impossible to know what helped.

#### Step 3: Re-run and Compare

```bash
python train_free_tier.py --cv 2>&1 | tee experiment_run.log
```

#### Step 4: Fill in the Comparison Table

Use this template to track experiments:

### Experiment Log Template

```
| # | Date | Change | Accuracy | Draw Acc | Log Loss | CV Mean | CV Std | Notes |
|---|------|--------|----------|----------|----------|---------|--------|-------|
| 0 | dd/mm | Baseline (no changes) | 51.0% | 6.7% | 1.034 | 48.2% | ±2.1% | Starting point |
| 1 | dd/mm | Description of change | ??% | ??% | ????? | ??% | ±??% | What happened |
```

**Columns explained:**
- **Accuracy** — overall accuracy from the 80/20 split
- **Draw Acc** — per-class accuracy for draws
- **Log Loss** — from the calibrated XGBoost (lower is better)
- **CV Mean** — mean accuracy from `--cv` (most reliable number)
- **CV Std** — standard deviation from `--cv` (lower = more consistent)

### What Counts as an Improvement?

| Metric | Meaningful improvement | Noise |
|--------|----------------------|-------|
| Accuracy (80/20) | > 1.5% change | < 1% change |
| Accuracy (CV mean) | > 1.0% change | < 0.5% change |
| Log Loss | > 0.02 change | < 0.01 change |
| Draw accuracy | > 3% change | < 2% change |

**Critical rule:** Always trust CV results over the single 80/20 split. A model that gains 2% on the 80/20 split but drops 1% on CV is probably overfitting to the validation set. CV gives you the honest picture.

### Red Flags

- **Accuracy goes up but log loss goes up too** — the model is getting luckier on the cut-off but its probabilities are worse. Not a real improvement.
- **80/20 accuracy up, CV accuracy down** — overfitting. Your change only helps on the specific validation set.
- **Draw accuracy jumps to 30%+ suddenly** — almost certainly overfitting. Real draw improvement is gradual.
- **LR baseline beats XGBoost** — your features might be too noisy, or XGBoost hyperparameters are wrong.
- **Very few features surviving selection** — you may have introduced many low-quality features.

---

## 8. Hyperparameter Tuning Guide

### What Each Hyperparameter Does

These are the knobs you can turn on the XGBoost model. Plain English explanations:

#### `max_depth` (Current: 6, Range: 3-8)

**What:** How deep each decision tree can grow. Deeper = more complex patterns, but also more risk of memorising noise.

- **Lower (3-4):** Simpler patterns, less overfitting, may miss real signal
- **Higher (7-8):** Complex patterns, more overfitting risk, especially with <2000 samples
- **Sweet spot:** 5-6 for our data size. Go lower if overfitting, higher only with more data

#### `learning_rate` (Current: 0.05, Range: 0.01-0.1)

**What:** How much each new tree contributes. Lower = more trees needed but usually better generalisation.

- **Lower (0.01-0.02):** Very cautious learning. Needs many more trees (increase `num_boost_round`). Often produces the best results but takes longer
- **Higher (0.08-0.1):** Faster convergence but can overshoot optimal values
- **Sweet spot:** 0.03-0.05. If you lower this, make sure early stopping doesn't kick in too soon (raise `num_boost_round`)

#### `min_child_weight` (Current: 3, Range: 1-7)

**What:** Minimum number of samples needed in a leaf node. Higher = the model needs more evidence before making a decision.

- **Lower (1-2):** Model can make decisions based on very few matches. Risks memorising rare cases
- **Higher (5-7):** Model needs substantial evidence. More robust but might miss real patterns
- **Sweet spot:** 3-5 for our ~1,680 samples

#### `subsample` (Current: 0.8, Range: 0.6-1.0)

**What:** Fraction of training data used for each tree. Like training on random subsets.

- **Lower (0.6-0.7):** More randomness = less overfitting, but may miss patterns
- **Higher (0.9-1.0):** Uses most/all data per tree. Better for small datasets
- **Sweet spot:** 0.7-0.85 for our data

#### `colsample_bytree` (Current: 0.8, Range: 0.6-1.0)

**What:** Fraction of features used for each tree. Forces the model to learn from different feature subsets.

- **Lower (0.6-0.7):** Good when you have many correlated features (which we do — home/away variants)
- **Higher (0.9-1.0):** Uses most features per tree
- **Sweet spot:** 0.7-0.8

#### `gamma` (Current: 0.1, Range: 0.0-0.5)

**What:** Minimum loss reduction required to make a further split. Higher = more conservative about adding complexity.

- **0.0:** No penalty for splitting — model grows freely
- **0.1-0.2:** Mild pruning — prevents the most pointless splits
- **0.5+:** Aggressive pruning — only very clear patterns survive
- **Sweet spot:** 0.05-0.2

#### `reg_alpha` (Current: 0.05, Range: 0.0-0.5)

**What:** L1 regularisation on leaf weights. Encourages sparsity — pushes unimportant feature contributions towards zero.

- **0.0:** No L1 regularisation
- **0.01-0.1:** Mild — good default range
- **0.5+:** Strong — many features effectively ignored
- **Sweet spot:** 0.01-0.1 for our feature set

#### `reg_lambda` (Current: 1.0, Range: 0.5-5.0)

**What:** L2 regularisation on leaf weights. Prevents any single feature from dominating predictions.

- **0.5:** Mild regularisation
- **1.0-2.0:** Standard range
- **5.0+:** Very strong — smooths out predictions significantly
- **Sweet spot:** 1.0-2.0

### Using the Tuner

```bash
# Standard search (25 trials, 3-5 min)
python train_free_tier.py --tune

# Thorough search (50 trials, 8-15 min)
python train_free_tier.py --tune --tune-trials 50

# Exhaustive search (100 trials, 15-25 min)
python train_free_tier.py --tune --tune-trials 100
```

The tuner uses random search — it picks random combinations from the search space and keeps the best. The output shows:

```
Trial  1/25: mlogloss=1.0412 (NEW BEST) — depth=5, lr=0.050, mcw=3
Trial  5/25: mlogloss=1.0341 (best=1.0341)
Trial  8/25: mlogloss=1.0289 (NEW BEST) — depth=4, lr=0.030, mcw=5
...
Top 5 parameter sets:
  1. mlogloss=1.0289 — depth=4, lr=0.030, mcw=5, sub=0.8, col=0.7, iters=342
```

**After tuning:** The best parameters are automatically used for the final training. If you want to hardcode them for future runs, update the `params` dict in `train_xgboost()` (line ~265 of `train_free_tier.py`).

### When to Tune

- **After changing features:** New features change what the optimal tree structure looks like
- **After adding data:** More data can support deeper trees and lower regularisation
- **After changing the feature selection threshold:** Different features = different optimal params
- **NOT after every small code change** — tuning is expensive and the results are noisy with 25 trials

---

## 9. Feature Engineering

### The 9 Feature Categories

All 99 features are computed in `app/features/free_tier_features.py`. Here's what each category captures:

| Category | Count | What It Captures | Key Features |
|----------|-------|-----------------|--------------|
| **Basic Stats** | 12 | Season averages (goals, points, win rates) | `home_goals_scored_avg`, `home_win_rate` |
| **Form & Momentum** | 20 | Recent performance (last 5/10 matches), streaks | `home_form_last_5`, `home_momentum`, `home_win_streak` |
| **Head-to-Head** | 15 | Historical matchups between the two teams | `h2h_home_wins`, `h2h_draw_tendency`, `h2h_over_2_5_rate` |
| **Contextual** | 12 | Rest days, derbies, congestion, league position | `rest_day_advantage`, `is_derby`, `position_difference` |
| **Time Series** | 9 | Trends and consistency over time | `home_trend_short`, `home_consistency` |
| **Derived** | 5 | Calculated probabilities (over 2.5, BTTS, conversion) | `over_2_5_probability`, `btts_probability` |
| **Half-Time** | 5 | HT scoring patterns | `home_ht_goals_scored_avg` |
| **Match Stats** | 8 | Shots, corners, yellows (10-match rolling averages) | `home_shots_on_target_avg`, `home_corners_avg` |
| **Draw Indicators** | 8 | Features targeting draw prediction specifically | `form_closeness`, `standings_closeness`, `low_scoring_indicator` |
| **Elo Ratings** | 5 | Running strength ratings from all historical results | `elo_difference`, `elo_expected_home` |

### How Feature Selection Works

After the first XGBoost pass, each feature gets an "importance" score (based on how much it improved predictions when used). Features with importance below 0.005 (0.5%) are dropped, and the model is retrained on the survivors.

**Typical result:** 72 of 99 features survive. The 27 dropped are usually niche features that are mostly zero (like `is_derby` for non-derby matches).

### Adding a New Feature

1. Add the feature name to `FEATURE_NAMES` in `free_tier_features.py` (line ~116)
2. Compute it in the appropriate `_category()` method
3. Ensure it returns `0.0` for missing data (never `None` or `NaN`)
4. Run training and check:
   - Does it appear in the top 20 features?
   - Did overall accuracy improve?
   - Did it survive feature selection?

**Rule of thumb:** If a new feature doesn't survive feature selection (importance < 0.005), it's not helping. Remove it — more features on a small dataset means more noise for the model to filter through.

### Modifying an Existing Feature

Same process as adding, but also check that features which previously depended on it still work. Run the full training to verify nothing broke.

---

## 10. The Draw Problem

### Why Draws Are Hard

Our model's biggest weakness: ~7% draw accuracy vs ~60% for home/away wins. This isn't a bug — it's a fundamental challenge:

1. **Class imbalance:** Draws are only ~24% of matches. The model learns that predicting home/away wins is usually right.

2. **Weak signal:** Draws are often "the absence of a decisive factor" rather than the presence of draw-specific factors. Two evenly-matched teams often produce a decisive result anyway.

3. **Data limitations:** Without xG, possession, shots-on-target trends (all paywalled), we're missing the features that best distinguish "two teams who will score" from "two teams who will cancel each other out."

### What's Already Been Done

- **Draw indicators (8 features):** `form_closeness`, `standings_closeness`, `draw_streak_proximity`, etc. — features designed to capture "these teams are similar"
- **Class weighting:** Draws get ~1.4x weight in training (inverse frequency)
- **Stacked ensemble:** Dedicated draw classifier with conservative hyperparameters
- **Elo ratings:** The `elo_expected_home` feature captures match evenness

### Ideas Worth Trying

| Idea | Effort | Expected Impact | How |
|------|--------|----------------|-----|
| Lower draw prediction threshold | Low | Medium | In the API, predict "draw" when P(draw) > 0.28 instead of requiring it to be the highest class |
| More draw indicator features | Medium | Low-Medium | Add features like "both teams drawn 2+ of last 5", "both teams' goal difference < 3" |
| Separate draw model | High | Medium | Train a completely separate binary model: draw vs not-draw |
| Tune ensemble draw classifier | Low | Low | Try different `max_depth`, `learning_rate` in the `class_configs` dict (line ~582) |
| Recency decay for draws | Low | Unknown | Draws may have different seasonal patterns — try a separate decay for the draw classifier |

### How to Measure Draw Improvement

Don't just look at draw accuracy — also check:
- **Draw precision:** Of the matches the model predicted as draws, how many actually were? (Check the confusion matrix)
- **Draw AUC-ROC:** Does the model at least rank draw-likely matches higher, even if it doesn't predict them outright?
- **Overall accuracy:** Improving draws shouldn't tank home/away accuracy by more than it gains

---

## 11. Calibration

### What It Is

Raw XGBoost outputs might say "55% chance of home win" when, historically, matches with that prediction were actually home wins 48% of the time. That's overconfidence. Calibration adjusts the probabilities to match reality.

### Why It Matters for Betting

The Kelly calculator and value bet detection rely on accurate probabilities. If the model says 60% but reality is 50%, the Kelly criterion will recommend oversized bets. Good calibration = safer bet sizing.

### How It Works in Our Pipeline

After XGBoost training, isotonic regression is fitted on the validation set for each class independently. It maps predicted probabilities to observed frequencies. Then the three calibrated probabilities are re-normalised to sum to 1.

**Training output:**
```
Calibration: log loss 1.0341 → 0.8512 (-0.1829)
```

A big improvement (0.18 reduction) means the raw model was quite overconfident. Small improvement (< 0.05) means the model was already reasonably calibrated.

### Reading the Calibration Curve

Open `backend/models/calibration_curve.png` after training. You'll see three plots (one per class).

- **Perfect calibration:** Points fall on the diagonal line (predicted 40% = actual 40%)
- **Overconfident:** Points below the diagonal (predicted 60% but actual 45%)
- **Underconfident:** Points above the diagonal (predicted 30% but actual 45%)

**What to look for:**
- Home win and away win should be reasonably close to the diagonal
- Draw calibration is usually messy (small sample size in each bin)
- S-shaped curves suggest the model is overconfident at high probabilities and underconfident at low ones — calibration helps a lot here

---

## 12. Common Experiments

A cookbook of things to try, ordered by effort and expected payoff.

### Quick Wins (< 30 minutes)

#### Experiment: Adjust Recency Decay

**Current:** 0.85 (each older season gets 15% less weight)

**Try:** Change the `recency_decay` parameter in `compute_sample_weights()` (line ~189):
- `0.75` — more aggressive decay (2020/21 season barely matters)
- `0.90` — less aggressive (all seasons roughly equal)
- `0.95` — almost no recency weighting

```bash
# After changing the value:
python train_free_tier.py --cv
```

**What you're testing:** Whether recent PL seasons are more predictive than older ones. If 0.75 improves CV, the league meta has shifted significantly.

#### Experiment: Change Feature Selection Threshold

**Current:** 0.005 (features with < 0.5% importance are dropped)

**Try:** Change `min_importance` in `select_features()` (line ~328):
- `0.003` — keep more features
- `0.01` — more aggressive pruning
- `0.02` — very aggressive (only top ~30 features survive)

**What you're testing:** Whether the model does better with fewer, stronger features. With only ~1,680 samples, aggressive pruning often helps.

#### Experiment: Adjust Training Rounds

**Current:** 1000 max rounds, 50-round early stopping patience

**Try:** Change `num_boost_round` and `early_stopping_rounds` in `train_xgboost()` (line ~291-296):
- `num_boost_round=2000, early_stopping_rounds=100` — allow longer training
- `num_boost_round=500, early_stopping_rounds=30` — shorter training

**What you're testing:** Whether the model stops too early or too late. Check the "best iteration" in the output — if it's near the max, you need more rounds.

### Medium Effort (1-2 hours)

#### Experiment: Tune the Draw Classifier Separately

Edit `class_configs` in `train_stacked_ensemble()` (line ~582). The draw classifier (index 1) currently uses:

```python
1: {  # Draw
    'max_depth': 4, 'learning_rate': 0.03, 'min_child_weight': 5,
    'subsample': 0.8, 'colsample_bytree': 0.7, 'gamma': 0.2,
    'reg_alpha': 0.1, 'reg_lambda': 2.0,
},
```

**Try variations:**
- Deeper trees: `max_depth: 5` or `6`
- Lower regularisation: `reg_lambda: 1.0`, `gamma: 0.1`
- Lower learning rate: `learning_rate: 0.02` (with more rounds)

**What you're testing:** Whether the draw classifier is too conservative (missing real patterns) or too aggressive (overfitting). Change one parameter at a time.

#### Experiment: Try Different Validation Split

**Current:** 80/20

**Try:** Change `val_fraction` in the `chronological_split()` call (line ~1147):
- `0.15` — 85/15 split (more training data)
- `0.25` — 75/25 split (more robust validation)

**What you're testing:** Whether the model benefits more from extra training data or a more representative validation set.

### Bigger Projects (Half a day+)

#### Experiment: Add New Data Sources

If you find additional CSV data for older seasons (2015-2020), add them to the `KnowledgeFilesCSV/` directory with the `EPL{start}{end}.csv` naming convention. More data = more robust model.

#### Experiment: Entirely New Feature Category

Design a new set of features — for example, referee-specific stats, or detailed goal-scoring patterns. Add them to `FEATURE_NAMES` and implement the computation method. Then train with `--tune` to let the model find optimal settings.

---

## 13. Troubleshooting

### Common Errors

#### `ModuleNotFoundError: No module named 'xgboost'`

You forgot to activate the conda environment:
```bash
conda activate anaconda-ml-ai
```

#### `FileNotFoundError: No CSV files found`

The training data CSVs aren't where the script expects them. Default location is `backend/spreadsheets/KnowledgeFilesCSV/`. Either:
- Put your CSVs there, or
- Use `--csv-dir /path/to/your/csvs`

#### `Too few samples (N) — need at least 50 to train`

The feature engineer couldn't produce enough valid training samples. This usually means:
- CSV data is corrupted or missing the `FTR` (result) column
- Team names in the CSV don't match what the feature engineer expects

#### Accuracy dropped significantly after a code change

1. Check you didn't introduce data leakage (using future data to predict past matches)
2. Check the class distribution output — is it still ~45/24/31?
3. Check feature count — did the dataset shrink?
4. Run with `--cv` to see if it's a real drop or just the 80/20 split being noisy

#### Calibration makes log loss worse

This happens when the validation set is too small or unrepresentative. The isotonic regression overfits to the val set. Try:
- Larger validation split (`val_fraction=0.25`)
- Check if the val set has a very different class distribution from training

#### Training takes much longer than usual

Usually caused by:
- Higher `num_boost_round` without early stopping kicking in
- `--tune` with many trials
- Many more features (each tree has to consider all of them)

### Interpreting Confusing Results

#### "My accuracy went up but my CV accuracy went down"

Your change overfits to the specific 80/20 split. Trust the CV number — it's more robust. Revert the change.

#### "Log loss improved but accuracy is the same"

This is actually good! It means the model's probability estimates are better even though the top-1 predictions didn't change. Better calibration = better betting decisions.

#### "The ensemble is worse than plain XGBoost"

This happens occasionally, especially if:
- The meta-learner training set is too small (it only gets 30% of the training data)
- The individual OvR classifiers aren't diverse enough

Try increasing the 70/30 meta-split to 60/40 (line ~601: `meta_split = int(len(X_train) * 0.6)`).

---

## 14. Current Baseline

Snapshot of model performance as of the last confirmed training run. **Update this after each significant change** so you always have a reference point.

### Baseline Metrics (March 2026)

| Metric | XGBoost (calibrated) | Stacked Ensemble | LR Baseline |
|--------|---------------------|-----------------|-------------|
| Overall accuracy | ~49% | ~51% | ~48% |
| Home win accuracy | ~60% | ~62% | ~55% |
| Draw accuracy | ~4% | ~7% | ~10% |
| Away win accuracy | ~57% | ~59% | ~54% |
| Log loss (raw) | ~1.034 | — | — |
| Log loss (calibrated) | ~0.85 | — | — |

### Model Configuration

| Setting | Value |
|---------|-------|
| Training samples | ~1,347 (80% of ~1,684) |
| Validation samples | ~337 (20%) |
| Features (after selection) | ~72 of 99 |
| XGBoost depth | 6 |
| Learning rate | 0.05 |
| Early stopping patience | 50 rounds |
| Recency decay | 0.85 per season |
| Feature selection threshold | 0.005 |

### Training Data

| Season | Matches |
|--------|---------|
| 2020/21 | 380 |
| 2021/22 | 380 |
| 2022/23 | 380 |
| 2023/24 | 380 |
| 2024/25 | 380 |
| 2025/26 | ~291 (partial) |
| **Total** | **~2,191** |

---

## Quick Reference Card

```
TRAIN:    python train_free_tier.py
TUNE:     python train_free_tier.py --tune --tune-trials 50
CV:       python train_free_tier.py --cv
FULL:     python train_free_tier.py --tune --cv --test
SAVE LOG: python train_free_tier.py --cv 2>&1 | tee run_$(date +%Y%m%d).log

KEY FILES:
  Model:    backend/models/xgboost_free_tier.joblib
  Cal plot: backend/models/calibration_curve.png
  Features: backend/app/features/free_tier_features.py
  Training: backend/train_free_tier.py
  Data:     backend/spreadsheets/KnowledgeFilesCSV/

GOOD SIGNS:
  Ensemble > XGBoost > LR
  Log loss < 1.00 (calibrated < 0.90)
  CV mean accuracy > 50%
  Top features are intuitively sensible

BAD SIGNS:
  LR beats XGBoost
  80/20 accuracy up but CV down
  Draw accuracy jumps to 30%+ (overfitting)
  Very few features surviving selection
```
