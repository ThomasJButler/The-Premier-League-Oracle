# Premier League Data Sourcing Guide

> Your competitive advantage: this model is **Premier League only**. While others spread thin across dozens of leagues, every byte of data you collect deepens your understanding of one competition.

---

## What You Already Have

**12,535 matches** across 33 seasons (1993/94–2025/26) from [football-data.co.uk](https://www.football-data.co.uk). Columns include: results, half-time scores, shots, corners, cards, fouls, referee, and bookmaker odds (2002+).

---

## Free Data You Can Add

### 1. Player-Level Stats (High Impact)

| Source | Data | Format | Effort |
|--------|------|--------|--------|
| [FBref.com](https://fbref.com/en/comps/9/Premier-League-Stats) | Per-player xG, xA, minutes, goals, assists, progressive passes/carries | CSV export per season | Medium |
| [Transfermarkt](https://www.transfermarkt.co.uk/premier-league/startseite/wettbewerb/GB1) | Squad market values, injuries, suspensions, transfer history | Scrape or manual | High |
| [Understat](https://understat.com/league/EPL) | Per-match xG, per-player xG, shot maps | JSON API | Medium |

**Why it matters:** Player injuries are one of the biggest prediction gaps. If Harry Kane misses a match, the team's expected goals drop significantly. Market values proxy squad quality better than ELO for newly-promoted teams.

**Feature ideas:**
- `star_player_absent` — xG contribution of missing players
- `squad_value_ratio` — home squad value / away squad value
- `key_player_minutes_last_30d` — fatigue for crucial players

### 2. Expected Goals (xG) Data (High Impact)

| Source | Data | Seasons | Format |
|--------|------|---------|--------|
| [Understat](https://understat.com/league/EPL) | Per-match xG, xGA for every PL match | 2014/15+ | JSON |
| [FBref](https://fbref.com) | xG, xGA, npxG per match | 2017/18+ | HTML tables |
| Your CSV data | Shots on target (HST/AST) already exists | 2000/01+ | Already loaded |

**Why it matters:** xG is the single most predictive metric in football. A team that creates 2.5 xG but scores 1 goal is underperforming — they'll regress upward. Your current Poisson model uses actual goals (noisy) instead of xG (signal).

**Feature ideas:**
- Replace `home_goals_scored_avg` with `home_xG_avg` in Poisson lambda
- `xG_overperformance` — actual goals minus xG (regression signal)
- `xG_trend` — slope of xG over last 10 matches

### 3. Tactical & Formation Data (Medium Impact)

| Source | Data | Format |
|--------|------|--------|
| [WhoScored](https://www.whoscored.com/Regions/252/Tournaments/2/England-Premier-League) | Formations, possession %, pass completion, PPDA | Scrape |
| [FBref](https://fbref.com) | Possession, pressing stats, progressive actions | CSV export |

**Why it matters:** Some tactical matchups produce more draws (two defensive teams), while others produce goals (attacking vs leaky defence). Currently your model can't distinguish these.

**Feature ideas:**
- `formation_matchup` — e.g., "4-3-3 vs 3-5-2" encoded categorically
- `pressing_intensity_ratio` — PPDA comparison
- `possession_dominance` — expected possession % from season averages

### 4. Venue & Weather Data (Low-Medium Impact)

| Source | Data | Format |
|--------|------|--------|
| [Open-Meteo](https://open-meteo.com) | Historical weather (temp, rain, wind) by date/location | Free API |
| Your CSV data | Stadium is implicit from home team | Already available |

**Why it matters:** Heavy rain → fewer goals → more draws. Strong wind at open stadiums (e.g., the old Boleyn Ground) affects long balls. Temperature affects stamina.

**Feature ideas:**
- `rain_intensity` — mm of rain on match day
- `temperature` — Celsius
- `wind_speed` — km/h

### 5. Managerial Data (Medium Impact)

| Source | Data | Format |
|--------|------|--------|
| [Transfermarkt](https://www.transfermarkt.co.uk) | Manager appointment/sacking dates, tenure | Manual/scrape |
| Wikipedia | Manager changes per club per season | Manual |

**Why it matters:** The "new manager bounce" is real — teams often win their first 2-3 matches under a new manager. Also, experienced managers (Klopp, Guardiola) have different patterns than rookie managers.

**Feature ideas:**
- `manager_tenure_days` — days since appointment
- `is_new_manager` — within first 5 matches
- `manager_experience` — total PL matches managed

### 6. Betting Market Movement (Medium Impact)

| Source | Data | Format |
|--------|------|--------|
| [Odds Portal](https://www.oddsportal.com/football/england/premier-league/) | Opening vs closing odds, line movements | Scrape |
| [football-data.co.uk](https://www.football-data.co.uk) | Opening + closing odds already in your CSVs | Already loaded |

**Why it matters:** When odds move significantly between opening and closing, it means sharp money (professional bettors) has arrived. The direction of movement is highly predictive.

**Feature ideas:**
- `odds_movement_home` — closing odds / opening odds (< 1 = money on home)
- `sharp_money_direction` — which outcome the smart money favours

**Note:** You already have some of this — `odds_sharp_divergence` compares Pinnacle (sharp) to market average. Opening vs closing odds would add another dimension.

### 7. Match Scheduling & Context (Low Impact, Easy to Add)

| Source | Data | Format |
|--------|------|--------|
| Your CSV data | Match date, time | Already loaded |
| [Premier League API](https://www.premierleague.com) | TV scheduling, kick-off times | Manual/API |

**Feature ideas:**
- `is_monday_night` — Monday night games have different dynamics
- `is_early_kickoff` — Saturday 12:30 (teams travel, less prep)
- `days_since_international_break` — teams disrupted by international duty
- `is_cup_week` — midweek cup matches affect weekend form

---

## Priority Order (What to Add First)

| Priority | Data | Expected Gain | Effort |
|----------|------|---------------|--------|
| **1** | xG per match (Understat/FBref, 2014+) | +1-3% | Medium |
| **2** | Player injuries/suspensions (Transfermarkt) | +0.5-1% | High |
| **3** | Squad market values (Transfermarkt) | +0.3-0.5% | Medium |
| **4** | Manager changes (Wikipedia/Transfermarkt) | +0.2-0.5% | Low |
| **5** | Opening vs closing odds movement | +0.2-0.5% | Low (already in CSVs) |
| **6** | Weather data (Open-Meteo) | +0.1-0.3% | Low |
| **7** | Match scheduling context | +0.1-0.2% | Low |

---

## How to Integrate New Data

1. **CSV format preferred** — one file per season, same naming convention (`EPL20242025.csv`)
2. **Add new columns** to existing CSVs, or create supplementary files keyed by match date + teams
3. **Update `free_tier_features.py`** — add new feature methods and extend `FEATURE_NAMES`
4. **Retrain** — `python3 train_free_tier.py --tune --tune-trials 100`
5. **Evaluate** — compare accuracy before/after with rolling CV

### Data Quality Checklist

- Date formats consistent (DD/MM/YYYY preferred)
- Team names match your existing CSVs (e.g., "Man City" not "Manchester City FC")
- No future data leakage (all features must be known before kick-off)
- Missing values → use 0.0 or NaN (XGBoost handles both)

---

## Pro API Tier (Future)

When you upgrade to the Football-Data.org paid tier, you'll get:
- **Per-match xG** (eliminates need for Understat scraping)
- **Lineups and formations** (player-level features at inference time)
- **Live odds** (real-time betting market integration)
- **Cards, corners, shots at inference time** (currently training-only features)

This closes the training/inference gap — features that are currently 0.0 at prediction time would have real values.

---

## The Big Picture

Your model currently uses **121 features** from historical match data. The features above could add 20-30 more, pushing toward **150 features** with xG, player data, and contextual signals. The key insight is that **PL-specific data is more valuable than generic football data** — you don't need La Liga or Bundesliga patterns to predict Arsenal vs Chelsea.

**Data credits:** Historical match data from [football-data.co.uk](https://www.football-data.co.uk), maintained by volunteers for 30+ years. Consider supporting their work if this project generates value.

---

*Last updated: 22 March 2026*
