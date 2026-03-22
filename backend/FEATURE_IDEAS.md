# Feature Ideas Catalogue — The Premier League Oracle

> **XGBoost ≠ xG!**
> - **xG (expected goals)** — a football statistic measuring shot quality (0.05 for a speculative 30-yarder, 0.78 for a tap-in from 3 yards)
> - **XGBoost (eXtreme Gradient Boosting)** — a machine learning algorithm that builds thousands of decision trees to find patterns in data. Used across medicine, finance, insurance, fraud detection — and football prediction. Has nothing to do with goals specifically.
>
> Our model uses XGBoost (the algorithm) and would love to have xG (the stat) as a feature!

---

## What We Already Have (121 features)

### Basic Stats (12)
| Feature | Description |
|---------|-------------|
| `home_goals_scored_avg` | Average goals scored per match (home venue) |
| `home_goals_conceded_avg` | Average goals conceded per match (home venue) |
| `away_goals_scored_avg` / `away_goals_conceded_avg` | Same for away |
| `home_points_per_game` / `away_points_per_game` | PPG by venue |
| `home_win_rate` / `away_win_rate` | Overall win % |
| `home_clean_sheet_rate` / `away_clean_sheet_rate` | % matches with 0 conceded |
| `home_home_win_rate` / `away_away_win_rate` | Venue-specific win % |

### Form & Momentum (20)
| Feature | Description |
|---------|-------------|
| `home_form_last_5` / `home_form_last_10` | PPG over last 5/10 matches |
| `home_weighted_form` | Exponentially-decayed form (recent = higher weight) |
| `home_momentum` | Short form minus long form (accelerating or declining) |
| `home_win_streak` / `home_unbeaten_streak` | Current streak lengths |
| `home_scoring_form` / `home_defensive_form` | Goals scored/conceded trends |
| `home_form_volatility` | Standard deviation of recent results (inconsistency) |
| `home_bounce_back_rate` | % of wins immediately after a loss |
| *(All duplicated for away team)* | |

### Head-to-Head (15)
| Feature | Description |
|---------|-------------|
| `h2h_total_matches` | Total historical meetings |
| `h2h_home_wins` / `h2h_draws` / `h2h_away_wins` | H2H result breakdown |
| `h2h_home_win_rate` | Home team's H2H win % |
| `h2h_home_goals_avg` / `h2h_away_goals_avg` / `h2h_total_goals_avg` | Scoring patterns |
| `h2h_btts_rate` / `h2h_over_2_5_rate` | Both teams to score / high-scoring tendency |
| `h2h_dominance` | How one-sided the H2H is |
| `h2h_venue_advantage` | Does the home team always win at this ground? |

### Contextual (12)
| Feature | Description |
|---------|-------------|
| `home_rest_days` / `away_rest_days` | Days since last match |
| `rest_day_advantage` | Relative rest advantage |
| `is_derby` | Local rivalry flag |
| `home_fixture_congestion` / `away_fixture_congestion` | Matches in last 14 days |
| `season_progress` | % of season elapsed (0.0 = August, 1.0 = May) |
| `home_position` / `away_position` | League table positions |
| `position_difference` | Gap in positions |
| `is_six_pointer` | Both teams in same zone (relegation/title/Europe) |
| `home_goal_difference` | Goal difference (proxy for quality) |

### Draw Indicators (13)
| Feature | Description |
|---------|-------------|
| `form_closeness` | How similar the two teams' recent form is |
| `standings_closeness` | How close in the table |
| `home_draw_rate` / `away_draw_rate` | % of recent matches ending in draws |
| `combined_defensive_strength` | Both teams keep clean sheets → likely draw |
| `low_scoring_indicator` | Both teams score few goals |
| `h2h_draw_tendency` | Historical draw rate in this fixture |
| `draw_streak_proximity` | Either team drawn recently |
| `goal_difference_symmetry` | Similar GD → evenly matched |
| `mid_table_indicator` | Both teams ranked 8-14 (less motivation) |
| `elo_draw_band` | ELO closeness × form closeness |

### ELO Ratings (5)
| Feature | Description |
|---------|-------------|
| `home_elo` / `away_elo` | Normalised ELO ratings |
| `elo_difference` | Rating gap (strongest predictor) |
| `elo_expected_home` | ELO-derived win probability |
| `elo_home_advantage` | Home boost magnitude |

### Form-vs-ELO Residuals (2) — *NEW in P8*
| Feature | Description |
|---------|-------------|
| `home_form_vs_elo` | Recent form minus ELO expectation (hot/cold streak) |
| `away_form_vs_elo` | Same for away team |

### Interaction Features (5) — *NEW in P8*
| Feature | Description |
|---------|-------------|
| `elo_x_form` | ELO difference × form closeness (**#3 most important feature!**) |
| `derby_x_closeness` | Derby flag × standings closeness |
| `elo_x_rest` | ELO difference × rest advantage |
| `trend_x_form` | Short-term trend × recent form |
| `h2h_draw_x_closeness` | H2H draw tendency × form closeness |

### Bookmaker Odds (10) — *training only, 0.0 at inference*
| Feature | Description |
|---------|-------------|
| `odds_pinnacle_home/draw/away` | Sharp bookmaker implied probabilities |
| `odds_avg_home/draw/away` | Market consensus |
| `odds_overround` | Bookmaker margin (market confidence) |
| `odds_asian_handicap` | Implied goal margin |
| `odds_over_2_5_prob` | Over/Under 2.5 goals |
| `odds_sharp_divergence` | Smart money vs market consensus |

### Match Stats (8) + Half-time (5) + Time Series (9) + Derived (5)
27 additional features covering shots, corners, cards, half-time patterns, trends, and derived probabilities.

---

## The "Banana Test" — Your Feature Ideas as Proper Features

Your late-night brainstorm identified four genuinely important signals. Here's how each translates to XGBoost features:

### 1. Injury Depletion (ID) → Squad Availability Features

**Your idea:** `injured_players / 25 × 100 = % value`

**As XGBoost features:**

| Feature | Description | Source | Maintainability |
|---------|-------------|--------|-----------------|
| `squad_availability_pct` | % of first-team squad available (25 - injured) / 25 | Transfermarkt | **Hard** — needs weekly manual update or scraper |
| `key_player_absent` | Binary: is a top-3 player (by minutes/xG) missing? | Transfermarkt | Hard |
| `injury_impact_xg` | Sum of injured players' xG per 90 contributions | FBref + Transfermarkt | Hard |
| `days_since_last_injury_update` | Staleness indicator (how fresh is the injury data?) | Internal | Easy |

**The hard truth about injury data:**
- It needs updating before EVERY matchday (Friday/Saturday typically)
- Players get injured in training (Tuesday announcement) or recover unexpectedly
- Transfermarkt updates are 24-48 hours behind
- **Best approach:** Maintain a simple CSV (`date, team, n_injuries, key_absences`) updated weekly. Accept it won't be perfect — even imperfect injury data is better than none.
- **Alternative proxy:** Use squad rotation detection (if 5+ changes from last match, something's up — but this only works post-match, not for prediction)

### 2. Pressure Factor (PF) → Match Context Features

**Your idea:** Importance of the fixture — title race, relegation, revenge

**As XGBoost features:**

| Feature | Description | Source | Maintainability |
|---------|-------------|--------|-----------------|
| `points_to_safety` | Points above relegation zone (negative = in danger) | Standings | **Easy** — computed from data we have |
| `points_to_title` | Points behind leader | Standings | Easy |
| `points_to_europe` | Points to/from European qualification spot | Standings | Easy |
| `lost_last_match` | Binary: did they lose their previous game? | Results | Easy |
| `home_after_away_loss` | Coming home after an away defeat (bounce-back scenario) | Results | Easy |
| `end_of_season_pressure` | `season_progress > 0.8 AND (points_to_safety < 6 OR points_to_title < 9)` | Computed | Easy |
| `nothing_to_play_for` | Mid-table, safe from relegation, can't reach Europe | Computed | Easy |

**Good news:** Most of these can be computed from data we already have (standings + results). No manual updates needed!

### 3. Fixture History (FH) → Already Have This!

**Your idea:** `0 if never won at that ground, 1 if always won`

**Already implemented as:**
- `h2h_venue_advantage` — home team's H2H win rate at this specific ground
- `h2h_home_win_rate` — win rate in this fixture overall
- `h2h_dominance` — how one-sided the matchup is

**Could add:**
| Feature | Description | Source | Maintainability |
|---------|-------------|--------|-----------------|
| `h2h_recent_3_venue` | Last 3 H2H results at this venue (more recent = more relevant) | Results | Easy |
| `away_team_never_won_here` | Binary: has the away team EVER won at this ground? | Results | Easy |
| `h2h_goals_trend` | Are H2H matches getting higher/lower scoring over time? | Results | Easy |

### 4. Average Player Form (APF) → Player-Level xG/xA Features

**Your idea:** If 5-6 players play 10/10, the team wins

**As XGBoost features:**

| Feature | Description | Source | Maintainability |
|---------|-------------|--------|-----------------|
| `squad_avg_xg_per90` | Mean xG per 90 for regular starters (last 5 matches) | FBref/Understat | **Medium** — update monthly |
| `top_scorer_xg_form` | Main striker's xG per 90 over last 5 (in form or cold?) | FBref | Medium |
| `creative_xg_form` | Total xA per 90 from midfielders (creating chances?) | FBref | Medium |
| `defensive_xga_form` | Defensive xGA (how much the backline is conceding) | FBref | Medium |
| `squad_consistency` | Std deviation of player ratings (all good = low variance) | WhoScored | Medium |
| `goal_drought_matches` | Consecutive matches without scoring (team or player) | Results | **Easy** |

**The practical approach:** Start with `goal_drought_matches` (computable from existing data) and `squad_avg_xg_per90` (from FBref, updated monthly). Don't try to track individual player ratings — aggregate xG is enough.

---

## Feature Priority Matrix

### Tier 1: Easy Wins (computable from existing data)

| Feature | Expected Impact | Effort | Already Have Data? |
|---------|----------------|--------|-------------------|
| `points_to_safety` | Medium | 1 hour | Yes — from standings |
| `points_to_title` | Medium | 1 hour | Yes |
| `points_to_europe` | Medium | 1 hour | Yes |
| `lost_last_match` | Low-Medium | 30 min | Yes — from results |
| `home_after_away_loss` | Low | 30 min | Yes |
| `goal_drought_matches` | Low-Medium | 30 min | Yes |
| `away_team_never_won_here` | Low | 30 min | Yes |
| `end_of_season_pressure` | Medium | 1 hour | Yes — computed |

### Tier 2: Needs New Data (free, periodic updates)

| Feature | Expected Impact | Effort | Data Source |
|---------|----------------|--------|-------------|
| `squad_avg_xg_per90` | **High** | 3 hours | FBref CSV export |
| `top_scorer_xg_form` | Medium-High | 2 hours | FBref |
| `xg_overperformance` | **High** | 3 hours | Understat JSON |
| `manager_tenure_days` | Medium | 2 hours | Wikipedia/Transfermarkt |
| `is_new_manager` | Medium | 1 hour | Manual list |

### Tier 3: Needs Manual Curation (hard to maintain)

| Feature | Expected Impact | Effort | Challenge |
|---------|----------------|--------|-----------|
| `squad_availability_pct` | **High** | Ongoing | Weekly manual updates |
| `key_player_absent` | **High** | Ongoing | Need to know who's key |
| `injury_impact_xg` | Very High | Ongoing | Needs player xG data + injury data |

### Tier 4: Needs Pro API

| Feature | Expected Impact | Effort | Requires |
|---------|----------------|--------|----------|
| `live_xg` | Very High | API integration | Paid Football-Data.org |
| `pre_match_odds` at inference | Very High | API integration | Odds API subscription |
| `lineup_changes` | High | API integration | Paid Football-Data.org |
| `formation` | Medium | API integration | Paid Football-Data.org |

---

## Implementation Strategy

**Phase 1 (now — no new data needed):**
Add Tier 1 features from existing data. These are all computable from standings and results we already have in the 12,535-match dataset. Estimated gain: +0.3-0.7%.

**Phase 2 (when you have time to collect data):**
Add xG data from FBref/Understat. This is the single highest-impact addition. Download season-by-season, merge by match date + teams. Estimated gain: +1-3%.

**Phase 3 (ongoing maintenance):**
Add injury data from Transfermarkt. Maintain a simple CSV updated before each gameweek. Accept it won't be perfect — even 70% accurate injury data helps. Estimated gain: +0.5-1%.

**Phase 4 (pro API):**
Upgrade to paid Football-Data.org tier. Get xG, lineups, and live odds at inference time. This closes the training/inference gap and is the single biggest architectural improvement available. Estimated gain: +2-4%.

---

## How XGBoost Uses These Features

XGBoost doesn't use a formula like the Banana Test. Instead, it builds **decision trees** — think of them as flowcharts:

```
Is elo_x_form > 0.15?
├─ YES: Is home_form_last_5 > 2.0?
│   ├─ YES: Is h2h_venue_advantage > 0.6?
│   │   ├─ YES: Predict HOME WIN (85% confident)
│   │   └─ NO:  Predict HOME WIN (65% confident)
│   └─ NO:  Is form_closeness > 0.8?
│       ├─ YES: Predict DRAW (40% confident)
│       └─ NO:  Predict HOME WIN (55% confident)
└─ NO:  Is away_win_streak > 3?
    ├─ YES: Predict AWAY WIN (60% confident)
    └─ NO:  Is standings_closeness > 0.7?
        ├─ YES: Predict DRAW (35% confident)
        └─ NO:  Predict HOME WIN (50% confident)
```

It builds **hundreds** of these trees, each slightly different, and averages their predictions. The model discovers which features matter, what thresholds to use, and how features interact — all from the data. Your job is to feed it the right signals; the model figures out the formula.

---

*Last updated: 22 March 2026*
*Total features: 121 current + ~25 proposed = ~146 potential*
