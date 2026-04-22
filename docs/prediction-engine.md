# Premier League Oracle — Prediction Engine Maximisation Strategy

> **Goal:** Push prediction accuracy as high as possible within free-tier data constraints.
> **Realistic target:** 55–56% overall accuracy (from current 53.3%).
> **Ceiling:** 55–58% (bookmaker-implied accuracy with full data access).

---

## 1. Where We Are Now

### Current Architecture

The Oracle runs two independent prediction systems that can reinforce each other:

| System | Technology | Accuracy | Strengths |
|--------|-----------|----------|-----------|
| **Frontend ensemble** | TypeScript (browser) | ~52–53% (backtest) | Fast, transparent, self-updating ELO, always available |
| **Backend ML** | Python XGBoost | 53.3% (validation) | 114 features, bookmaker odds in training, draw-specific features |

**Frontend ensemble** combines 5 models:
- ELO rating system (25%) — long-term team strength
- Poisson/Dixon-Coles (30%) — expected goals from attack/defence ratios
- Recent form (20%) — last 5 matches, recency-weighted
- Head-to-head (10%) — historical matchup with shrinkage
- Standings position (15%) — league table gap

**Backend XGBoost** uses 114 hand-engineered features across 11 categories: basic stats, form/momentum, H2H, contextual, time series, derived, half-time, match stats, draw indicators, ELO, and bookmaker odds.

### Known Weaknesses

| Issue | Impact | Details |
|-------|--------|---------|
| **Draw calibration paradox** | Critical | Raw model: 16.3% draw accuracy, AUC 0.601. After isotonic calibration: **0.0%**. Calibrator learns "suppress draws" because the model's draw confidence is poorly calibrated |
| **Odds–inference mismatch** | High | 10 odds features dominate training (53.3%) but are all 0.0 at inference (free API). True inference accuracy likely ~51% |
| **Small dataset** | Medium | 2,191 matches (6 seasons). Industry models use 10,000+ |
| **Form double-counts ELO** | Low | ELO (25%) and form (20%) are correlated — both measure team quality |
| **Static home advantage** | Low | All teams get the same +33 ELO points, but home advantage varies by club |

### Benchmarking Context

| Strategy | Expected Accuracy |
|----------|-------------------|
| Random guess (3-class) | ~33% |
| Always predict home win | ~43% |
| Logistic regression baseline | 47.9% |
| XGBoost v1 (no odds) | 51.0% |
| XGBoost v2 (with odds) | 51.9% |
| **XGBoost v3 (draw features + calibration)** | **53.3%** |
| **Our target (all improvements)** | **55–56%** |
| Good PL models (industry) | 52–58% |
| Bookmaker-implied | 55–58% |

---

## 2. What 10 More Seasons of Data Will Do

### The Case For More Data

Adding 10 seasons (2010/11–2019/20) would give us **~6,000 total matches** (from 2,191). This helps in several concrete ways:

**Feature learning:** XGBoost needs enough examples to learn complex interactions. With 2,100 usable samples, the model has ~700 draws to learn from. With 6,000 matches, that becomes ~1,600 draws — dramatically improving the draw classifier.

**ELO warm-up:** The ELO system currently takes ~5 matches per team to stabilise from seed ratings. With 10 extra seasons, ELO ratings are fully converged by the time training data starts. Better ELO = better ELO features.

**Rolling feature stability:** Last-5, last-10, and trend features need historical matches to compute. Earlier seasons in the current dataset have many 0.0 features because there's insufficient prior data. More history means fewer sparse rows.

**Cross-validation robustness:** 4-fold rolling CV with 6 seasons means ~300 matches per validation fold. With 16 seasons, each fold has ~600+ matches — more reliable accuracy estimates.

### The Risks

**Tactical evolution:** Football has changed significantly since 2010. High-press systems, false 9s, and inverted full-backs are more prevalent now. Features trained on 2010-era football may not generalise.

**Mitigated by:** Recency weighting (already implemented — 0.85× per older season). A 2012 match contributes only 0.85^8 ≈ 27% of a 2024 match's weight.

**Squad turnover:** Teams like Leicester City (promoted 2014, champions 2016, relegated 2023) have completely different squads and identities across 15 seasons.

**Mitigated by:** ELO ratings track this naturally — a team's rating reflects their current form, not their history.

### Recommendation

**Add the data.** The benefits (more draws to learn from, better feature coverage, smoother ELO warm-up) outweigh the risks. The existing recency weighting ensures old data doesn't dominate.

**Expected gain:** +0.5–1.0% accuracy, primarily from draw and away-win classification.

### How to Add the Data

1. Download CSV files from the same source (football-data.co.uk) for seasons 2010/11 through 2019/20
2. Name them consistently: `EPL20102011.csv`, `EPL20112012.csv`, etc.
3. Place in `backend/spreadsheets/KnowledgeFilesCSV/`
4. The existing `FreeTierFeatureEngineer.load_csvs()` will pick them up automatically (it globs `EPL*.csv`)
5. Retrain: `python train_free_tier.py --tune-trials 100`

---

## 3. Quick Wins — Implement Now

### 3a. Fix Draw Calibration Paradox (+1–2% overall)

**The problem:** Isotonic calibration learns "when the model predicts draw, it's usually wrong" and maps all draw probabilities toward zero. This kills 100% of draw predictions even though the model correctly **ranks** draw-prone matches (AUC-ROC 0.601).

**The fix:** Add a post-calibration draw recovery step:

```python
def recover_draws(calibrated_probs, raw_probs, threshold=0.22):
    """
    After calibration suppresses draws, restore them where the raw
    model was confident about a draw.

    threshold: if raw draw probability exceeds this, override the
    calibrated argmax with 'draw' — calibration preserves ranking
    but destroys the decision boundary.
    """
    recovered = calibrated_probs.copy()
    for i in range(len(recovered)):
        if raw_probs[i, 1] > threshold:  # Class 1 = Draw
            # Boost calibrated draw prob to match raw ranking
            recovered[i, 1] = max(recovered[i, 1], raw_probs[i, 1] * 0.8)
            # Renormalise
            recovered[i] /= recovered[i].sum()
    return recovered
```

**Implementation:** In `train_free_tier.py`, after calibration (line ~465), apply this recovery and evaluate. The threshold (0.22) should be tuned via cross-validation.

**Why this works:** The model's draw AUC is 0.601 — it correctly identifies which matches are draw-prone. Calibration destroys the *confidence* but preserves the *ranking*. We use the ranking to recover draw predictions that calibration suppressed.

**Priority: 1 (highest)** — This is the single biggest accuracy gain available.

### 3b. Larger Hyperparameter Search (+0.5–1%)

**Current:** 25 random trials. This barely scratches the surface of an 8-dimensional search space.

**Fix:** Switch to Bayesian optimisation with Optuna (100–200 trials):

```python
import optuna

def objective(trial):
    params = {
        'max_depth': trial.suggest_int('max_depth', 3, 8),
        'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.15, log=True),
        'min_child_weight': trial.suggest_int('min_child_weight', 1, 7),
        'subsample': trial.suggest_float('subsample', 0.6, 0.95),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 0.9),
        'gamma': trial.suggest_float('gamma', 0.0, 0.5),
        'reg_alpha': trial.suggest_float('reg_alpha', 1e-3, 1.0, log=True),
        'reg_lambda': trial.suggest_float('reg_lambda', 0.5, 5.0),
    }
    # Train and evaluate with rolling CV
    return mean_cv_logloss(params)

study = optuna.create_study(direction='minimize')
study.optimize(objective, n_trials=150)
```

**Why Bayesian > Random:** Bayesian optimisation learns which regions of hyperparameter space are promising and concentrates trials there. With 150 trials, it typically finds parameters 0.5–1% better than 25 random trials.

**Priority: 2** — Low effort, meaningful gain.

### 3c. Train Without Odds to Establish True Baseline

**Why:** We report 53.3% accuracy, but that includes odds features in training that are 0.0 at inference. The true inference accuracy is unknown — likely ~51%.

**How:** Retrain with `--no-odds` flag (add to training script):
```bash
python train_free_tier.py --no-odds --tune-trials 100
```

This tells us:
1. How much accuracy we lose without odds (quantifies the gap)
2. Whether a no-odds model is more honest (trains on what it'll see at inference)
3. Which non-odds features matter most (better feature selection)

**Two models going forward:**
- `xgboost_free_tier.joblib` — trained WITH odds (53.3%, used when odds available)
- `xgboost_free_tier_no_odds.joblib` — trained WITHOUT odds (~51%, used at inference from free API)

**Priority: 3** — Understanding the gap is essential before investing in other improvements.

### 3d. Feature Interaction Engineering (+0.3–0.7%)

Add interaction features that capture non-linear relationships:

```python
# In free_tier_features.py, add to feature computation:

# Strong teams with good form are MORE predictable
features['elo_x_form'] = features.get('elo_difference', 0) * features.get('form_closeness', 0)

# Derby matches with close standings → draw-prone
features['derby_x_closeness'] = features.get('is_derby', 0) * features.get('standings_closeness', 0)

# Fatigued favourites underperform more than fatigued underdogs
features['elo_x_rest'] = features.get('elo_difference', 0) * features.get('rest_advantage', 0)

# Recent form trend × current form (accelerating vs decelerating)
features['trend_x_form'] = features.get('home_trend_short', 0) * features.get('home_form_last5', 0)

# H2H draw history × current form closeness
features['h2h_draw_x_closeness'] = features.get('h2h_draw_tendency', 0) * features.get('form_closeness', 0)
```

**Why these help:** XGBoost can learn interactions, but explicit features make them easier to find — especially with limited data.

**Priority: 4** — Low effort, stacks with other improvements.

---

## 4. Medium-Term Improvements

### 4a. Dedicated Draw Model (+0.5–1.5%)

Draws are the weakest prediction class across both systems. A dedicated draw classifier can outperform the general 3-class model for this specific outcome.

**Architecture:**

```
Input features → Binary classifier: "Draw vs Not-Draw"
                  ↓
              If P(draw) > threshold → Predict Draw
              Else → Use main 3-class model for H/A
```

**Draw-specific feature set (13 existing + new):**
- Form closeness, standings closeness, combined defensive strength
- H2H draw tendency, draw streak proximity, goal difference symmetry
- Mid-table indicator, ELO draw band, low-scoring indicator
- **New:** Time-of-season (draws more common late season when results matter less for mid-table)
- **New:** Home team's draw rate at home × away team's draw rate away
- **New:** Recent goals-per-game trend (declining → more draws)
- **New:** Referee-specific draw rate (some refs produce more draws)

**Training:**
- Binary labels: 1 = Draw, 0 = Home/Away
- Class weighting: draws (~23%) upweighted to 50%
- Separate hyperparameter search optimised for draw AUC-ROC
- Threshold tuned via CV to maximise draw F1 without destroying overall accuracy

**Integration with main model:**
- If draw model P(draw) > 0.30 AND main model's draw probability is in top 2: predict draw
- Otherwise: use main model's prediction
- Confidence penalised when models disagree

**Priority: 5** — Medium effort, high draw-specific gain.

### 4b. Orthogonalise Form from ELO (+0.3–0.5%)

**Problem:** ELO (25% weight) and form (20% weight) both measure team quality. When a team wins, both their ELO and form improve — the ensemble partially double-counts.

**Fix — Frontend:** Replace "form score" with "form residual vs ELO expectation":

```typescript
// Current: form score = weighted sum of W/D/L in last 5
// New: form residual = actual form - expected form from ELO

const expectedFormScore = eloExpectedScore * 5; // What ELO says they "should" have scored
const actualFormScore = calculateFormScore(form);
const formResidual = actualFormScore - expectedFormScore;
// Positive = outperforming ELO expectation (hot streak)
// Negative = underperforming (cold streak)
```

**Fix — Backend:** Add `form_vs_elo_residual` feature:

```python
features['home_form_vs_elo'] = features.get('home_form_last5', 0) - features.get('elo_expected_home', 0)
features['away_form_vs_elo'] = features.get('away_form_last5', 0) - (1 - features.get('elo_expected_home', 0))
```

**Why this helps:** Isolates the "recent momentum" signal from the "overall quality" signal. A team rated 1800 ELO on a 3-match losing streak is genuinely different from one rated 1400 on a 3-match losing streak.

**Priority: 6** — Clean improvement, affects both systems.

### 4c. Temporal ELO Decay (+0.5%)

**Problem:** Current ELO treats a match from 2020 the same as one from 2025. Over time, ratings become stale (squads change, managers change, playing styles evolve).

**Fix:** Apply exponential decay to rating changes over time:

```python
# Instead of: new_rating = old_rating + K * (actual - expected)
# Use:        new_rating = old_rating * decay + K * (actual - expected)

DECAY_PER_SEASON = 0.97  # 3% regression toward mean per season
MEAN_RATING = 1500

# At the start of each new season:
for team in ratings:
    ratings[team] = MEAN_RATING + (ratings[team] - MEAN_RATING) * DECAY_PER_SEASON
```

**Why this helps:** Prevents "legacy" ratings from dominating. A team that was great in 2020 but mediocre now should regress toward 1500, not carry inflated ratings.

**Priority: 7** — Especially important when adding 10 extra seasons of data.

### 4d. Ensemble-of-Ensembles (+0.5–1%)

**Current:** Backend ML contributes a fixed 30% weight to the frontend ensemble. This is hardcoded — the backend's contribution doesn't adapt to match context.

**Better:** Train a meta-learner that learns WHEN to trust each system:

```
Match features → Frontend ensemble → P_ts(H, D, A)
               → Backend XGBoost   → P_ml(H, D, A)
               → Meta-learner      → P_final(H, D, A)
```

**Meta-learner features:**
- P_ts(H), P_ts(D), P_ts(A) — frontend predictions
- P_ml(H), P_ml(D), P_ml(A) — backend predictions
- Confidence_ts, Confidence_ml — model confidence
- Agreement flag (do they predict the same outcome?)
- ELO difference (absolute team quality gap)
- Form closeness (even matchup indicator)

**Training:** Use cross-validated predictions from both systems on historical data. Meta-learner is a simple logistic regression or shallow XGBoost.

**Priority: 8** — Requires both systems to produce predictions on historical data first.

### 4e. Match-Type-Specific Weights (+0.5–1%)

**Insight:** Different types of matches have different dynamics:
- "Big 6" clashes → ELO dominates (quality gap known)
- Mid-table "six-pointer" → Form dominates (motivation matters)
- Top vs bottom → Standings dominates (position gap obvious)
- Relegation battle → Draw probability elevated (both teams play cautiously)

**Implementation:**

```typescript
// Classify match into categories
const matchType = classifyMatch(homePosition, awayPosition, homeElo, awayElo);

// Use category-specific weights (learned from backtest)
const weights = MATCH_TYPE_WEIGHTS[matchType] ?? DEFAULT_WEIGHTS;
```

**Categories:**
1. **Top 6 clash** (both top 6) — ELO: 35%, Poisson: 25%, Form: 15%, H2H: 15%, Standings: 10%
2. **Top vs bottom** (position gap > 12) — ELO: 20%, Poisson: 35%, Form: 10%, H2H: 5%, Standings: 30%
3. **Mid-table** (both 7–14) — ELO: 15%, Poisson: 25%, Form: 30%, H2H: 15%, Standings: 15%
4. **Relegation** (either bottom 5) — ELO: 20%, Poisson: 25%, Form: 25%, H2H: 10%, Standings: 20%

**Priority: 9** — Needs backtest analysis to determine optimal per-category weights.

---

## 5. Pro-Tier Roadmap (Future — Paid Data)

These improvements require paid Football-Data.org API access or alternative data sources. They build on the free-tier foundation.

### 5a. xG-Based Poisson Lambda (+1–3%)

**What changes:** Replace goals-based attack/defence ratios with expected goals (xG).

**Why it matters:** Goals are noisy — a team can play brilliantly and lose 0-1 to a deflection. xG captures shot quality and quantity, which are far more predictive of future performance than actual goals.

**Implementation:** Replace `team.avgGoalsScored` with `team.avgXG` in Dixon-Coles lambda calculation. Requires `xG` column in match data.

### 5b. Real-Time Bookmaker Odds (+2–3%)

**What changes:** Integrate live bookmaker odds as features at inference time (not just training).

**Why it matters:** Bookmakers aggregate massive information (lineups, injuries, team news, weather, sharp money) into a single number. Their odds are the strongest single predictor of match outcomes.

**Implementation:** Odds API subscription → odds-as-features at inference time → model trained on both scenarios (with/without odds) → use odds model when available.

### 5c. Player-Level Data (+1–2%)

**What changes:** Track key player availability, fitness, and impact.

**Features:**
- Star player absence (xG contribution of missing players)
- Squad rotation index (how many changes from last match)
- Accumulated fatigue (minutes played in last 30 days)
- Suspension risk (yellow card accumulation)

### 5d. Tactical Model (+0.5–1%)

**What changes:** Classify teams into playing styles and model style matchups.

**Features:**
- Possession % (high vs low block)
- Pressing intensity (PPDA — passes per defensive action)
- Formation tendencies (4-3-3 vs 3-5-2)
- Counter-attacking efficiency

### 5e. Weather and Venue Factors (+0.2–0.5%)

**What changes:** Weather API integration for wind, rain, temperature, pitch conditions.

**Why:** Heavy rain reduces goals (correlates with draws). Strong wind at open stadiums affects long balls.

---

## 6. Implementation Priority Matrix

Ordered by expected accuracy gain per unit of effort:

| # | Improvement | Estimated Gain | Effort | System | Prerequisite |
|---|------------|---------------|--------|--------|-------------|
| **1** | Fix draw calibration paradox | +1.0–2.0% | Low | Backend | None |
| **2** | Larger hyperparameter search (Optuna, 150 trials) | +0.5–1.0% | Low | Backend | None |
| **3** | Train without odds (establish true baseline) | Diagnostic | Low | Backend | None |
| **4** | Add 10 more seasons of CSV data | +0.5–1.0% | Low | Data | Download CSVs |
| **5** | Feature interactions (elo×form, derby×closeness) | +0.3–0.7% | Low | Backend | None |
| **6** | Dedicated draw model (binary classifier) | +0.5–1.5% | Medium | Backend | #1, #4 |
| **7** | Orthogonalise form from ELO | +0.3–0.5% | Medium | Both | None |
| **8** | Temporal ELO decay | +0.5% | Medium | Both | #4 (benefits more with more data) |
| **9** | Match-type-specific weights | +0.5–1.0% | Medium | Frontend | Backtest analysis |
| **10** | Ensemble-of-ensembles meta-learner | +0.5–1.0% | High | Both | #3, #7 |
| **11** | xG-based Poisson (pro-tier) | +1.0–3.0% | High | Both | Paid API |
| **12** | Real-time odds integration (pro-tier) | +2.0–3.0% | High | Both | Odds API |
| **13** | Player-level data (pro-tier) | +1.0–2.0% | High | Backend | Paid API |

**Cumulative free-tier estimate:** Items 1–10 could yield +3–5% total, bringing us from ~51% (true inference) to **54–56%**.

---

## 7. Concrete Next Steps

### Phase 1: Quick Wins (1–2 sessions)

1. **Download 10 extra seasons** of EPL CSV data (2010/11–2019/20) from football-data.co.uk
2. **Fix draw calibration** — add post-calibration draw recovery in `train_free_tier.py`
3. **Add Optuna** — replace random hyperparameter search with Bayesian optimisation
4. **Add `--no-odds` flag** — train a separate no-odds model for honest inference accuracy
5. **Add feature interactions** — 5 new interaction features in `free_tier_features.py`
6. **Retrain** — run full pipeline with expanded data + fixes

### Phase 2: Draw Specialisation (1 session)

7. **Implement dedicated draw model** — binary classifier with draw-specific features
8. **Integrate into training pipeline** — cascade: draw model → 3-class model
9. **Evaluate** — measure draw accuracy, overall accuracy, and log loss vs baseline

### Phase 3: Ensemble Refinement (1–2 sessions)

10. **Orthogonalise form** — replace form score with form-vs-ELO residual (frontend + backend)
11. **Add temporal ELO decay** — season-boundary regression toward mean
12. **Implement match-type weights** — category-specific ensemble weights
13. **Train meta-learner** — ensemble-of-ensembles combining frontend and backend

### Phase 4: Evaluation & Deployment

14. **Rolling CV** on expanded dataset — compare all models across 10+ seasons
15. **Update model files** — save best models to `backend/models/`
16. **Update frontend constants** — recompute ELO parameters, form weights, etc.
17. **Deploy and monitor** — track live prediction accuracy over the rest of the 2025/26 season

---

## 8. Technical Notes

### Training Command Reference

```bash
# Current (default)
cd backend && python train_free_tier.py

# With expanded data + more tuning
python train_free_tier.py --tune-trials 150

# Without odds (honest inference model)
python train_free_tier.py --no-odds --tune-trials 150

# With draw recovery (after implementing 3a)
python train_free_tier.py --tune-trials 150 --draw-threshold 0.22

# Full pipeline (all improvements)
python train_free_tier.py --tune-trials 200 --draw-recovery --no-odds --save-both
```

### Model File Naming

```
backend/models/
├── xgboost_free_tier.joblib          # Current model (v3, with odds)
├── xgboost_free_tier_no_odds.joblib  # No-odds model (for free API inference)
├── xgboost_draw_model.joblib         # Dedicated draw classifier
└── xgboost_meta_learner.joblib       # Ensemble-of-ensembles (future)
```

### Feature Count Progression

| Phase | Features | Description |
|-------|----------|-------------|
| Current | 114 | 12 basic + 20 form + 15 H2H + 12 contextual + 9 time + 5 derived + 5 HT + 8 match + 13 draw + 5 ELO + 10 odds |
| +Interactions | ~120 | +5 interaction features (elo×form, derby×closeness, etc.) |
| +Draw-specific | ~125 | +5 new draw features (season phase, venue draw rate, referee draw rate) |
| +Residuals | ~127 | +2 form-vs-ELO residual features |

### CSV Data Requirements

For the 10 additional seasons, ensure the CSVs contain at minimum:
- `Date`, `HomeTeam`, `AwayTeam` — match identification
- `FTHG`, `FTAG`, `FTR` — full-time goals and result
- `HTHG`, `HTAG`, `HTR` — half-time goals and result
- `HS`, `AS`, `HST`, `AST` — shots and shots on target
- `HC`, `AC` — corners
- `HY`, `AY`, `HR`, `AR` — yellow and red cards
- `HF`, `AF` — fouls
- `Referee` — referee name
- Bookmaker odds columns (PSCH, PSCD, PSCA or AvgH, AvgD, AvgA at minimum)

These are all standard columns in the football-data.co.uk format.

---

## 9. What We Cannot Improve (Free-Tier Constraints)

Being honest about our ceiling:

| Limitation | Impact | Why It's Hard |
|-----------|--------|--------------|
| No xG data | Cannot model shot quality | Free API only has match results |
| No possession data | Cannot detect playing style | Not available without paid tier |
| No player-level data | Cannot model injuries/suspensions | Requires per-player APIs |
| No live odds at inference | Cannot use strongest predictor | Free API has no odds data |
| No formation data | Cannot model tactical matchups | Requires advanced stats provider |
| Small user base | Cannot learn from crowd wisdom | No market-making mechanism |

**The hard truth:** Bookmakers achieve 55–58% because they have all of the above, plus teams of quantitative analysts, plus real money providing a continuous calibration signal. Our free-tier model competes by being transparent, educational, and surprisingly close to that ceiling (~54–56% is achievable with the improvements above).

---

*Last updated: 21 March 2026*
*Active branch: `v3.0-MVP-UX`*
