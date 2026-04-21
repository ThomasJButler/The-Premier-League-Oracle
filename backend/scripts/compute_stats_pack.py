#!/usr/bin/env python3
"""
Compute a 33-season goal-driven stats pack from the EPL CSV archive and write
it to a JSON artefact the frontend ships with its bundle.

The frontend imports the JSON at build time (no runtime HTTP), and the
ensemble's Poisson, team-stats, and H2H paths blend this historical data
with current-season signal to produce per-fixture goal tempo informed by
decades of history rather than five seasons of API-fetched matches.

Output artefact: frontend/src/lib/data/statsPack.json

Sections:
  - teams   : per-team goal profile (home/away splits, clean-sheet rates,
              era-weighted variants, recent trend vs all-time)
  - pairs   : per ordered (home, away) team pair — totals, avg goals,
              over-thresholds, recent-10 weighting, variance
  - leagueEra : decade and month aggregates for era-drift correction

Team names in the output use the CSV-native canonical form (e.g. "Arsenal",
"Man United"). The frontend maintains a small alias map from
Football-Data.org API names (e.g. "Arsenal FC") to these CSV names when
looking up entries.

Run from backend/:
  conda activate anaconda-ml-ai
  python scripts/compute_stats_pack.py

Idempotent: sorts all keys alphabetically before writing so re-runs produce
byte-identical output.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

# Add parent to path so we can import the feature engineer's CSV loader
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.features.free_tier_features import FreeTierFeatureEngineer  # noqa: E402


# Exponential decay: a fixture's weight = ERA_DECAY ** (current_year - season_year).
# At 0.85, 2025/26 = 1.0, 2014/15 ≈ 0.17, 1993/94 ≈ 0.02 — recent seasons
# dominate the era-weighted means without silencing the older data entirely.
ERA_DECAY = 0.85
CURRENT_YEAR = 2026  # match the user's reference year for era weighting

# Derby fixtures flagged with `isDerby=True` in pair stats. Uses CSV canonical
# names (no "FC" suffix). Both direction orderings are treated as derbies.
# Extend this list for newly promoted rivalries — pair stats pick it up on
# the next regeneration run.
DERBY_PAIRS: list[tuple[str, str]] = [
    # North London
    ('Arsenal', 'Tottenham'),
    # Merseyside
    ('Liverpool', 'Everton'),
    # Manchester
    ('Man United', 'Man City'),
    # Tyne-Wear
    ('Newcastle', 'Sunderland'),
    # West London
    ('Chelsea', 'Fulham'),
    ('Chelsea', 'QPR'),
    ('Fulham', 'QPR'),
    # North West rivalry
    ('Liverpool', 'Man United'),
    # East Midlands
    ("Nott'm Forest", 'Leicester'),
    ("Nott'm Forest", 'Derby'),
    ('Leicester', 'Derby'),
    # South Coast / M23
    ('Brighton', 'Crystal Palace'),
    # Yorkshire
    ('Leeds', 'Sheffield United'),
    # Lancashire
    ('Burnley', 'Blackburn'),
]

# Build a directional lookup set so both orderings register as derbies.
DERBY_LOOKUP: set[tuple[str, str]] = {
    (a, b) for a, b in DERBY_PAIRS
} | {
    (b, a) for a, b in DERBY_PAIRS
}

OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'frontend', 'src', 'lib', 'data', 'statsPack.json',
)


def season_start_year(season_str: str) -> int:
    """'2023/24' -> 2023, '1993/94' -> 1993."""
    try:
        return int(season_str.split('/')[0])
    except (ValueError, IndexError):
        return CURRENT_YEAR


def era_weight(season_str: str) -> float:
    return ERA_DECAY ** max(0, CURRENT_YEAR - season_start_year(season_str))


def decade_label(year: int) -> str:
    return f'{(year // 10) * 10}s'


def weighted_mean(values: list[float], weights: list[float]) -> float:
    total_w = sum(weights)
    if total_w == 0 or not values:
        return 0.0
    return sum(v * w for v, w in zip(values, weights)) / total_w


def safe_div(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def compute_team_stats(df) -> dict[str, Any]:
    """Per-team goal profile with home/away splits and era-weighted variants."""
    teams: dict[str, Any] = {}
    all_teams = set(df['home_team'].dropna().unique()) | set(df['away_team'].dropna().unique())

    for team in all_teams:
        home_rows = df[df['home_team'] == team]
        away_rows = df[df['away_team'] == team]

        home_goals = home_rows['home_goals'].to_numpy(dtype=float)
        home_conc = home_rows['away_goals'].to_numpy(dtype=float)
        away_goals = away_rows['away_goals'].to_numpy(dtype=float)
        away_conc = away_rows['home_goals'].to_numpy(dtype=float)

        home_n = len(home_rows)
        away_n = len(away_rows)

        # Era-weighted means — recent matches dominate
        home_weights = [era_weight(s) for s in home_rows['season']]
        away_weights = [era_weight(s) for s in away_rows['season']]

        # Clean-sheet / failed-to-score rates
        home_clean_sheets = int((home_conc == 0).sum()) if home_n else 0
        home_failed_to_score = int((home_goals == 0).sum()) if home_n else 0
        away_clean_sheets = int((away_conc == 0).sum()) if away_n else 0
        away_failed_to_score = int((away_goals == 0).sum()) if away_n else 0

        # Combined match-level rates
        all_rows = df[(df['home_team'] == team) | (df['away_team'] == team)]
        total_matches = len(all_rows)

        if total_matches:
            goals_series = all_rows['home_goals'].where(
                all_rows['home_team'] == team, all_rows['away_goals']
            )
            total_goals_per_match = all_rows['home_goals'] + all_rows['away_goals']
            over_25 = int((total_goals_per_match >= 3).sum())
            btts = int(((all_rows['home_goals'] >= 1) & (all_rows['away_goals'] >= 1)).sum())
            # Recent trend: last 100 matches vs all-time
            recent_rows = all_rows.sort_values('date').tail(100)
            recent_avg_scored = (
                recent_rows['home_goals'].where(
                    recent_rows['home_team'] == team, recent_rows['away_goals']
                )
            ).mean()
            all_time_avg_scored = goals_series.mean()
            recent_scoring_trend = (
                safe_div(recent_avg_scored, all_time_avg_scored)
                if all_time_avg_scored
                else 1.0
            )
            # Goal variance — spread of goals scored per match across all appearances
            goals_scored_array = goals_series.to_numpy(dtype=float)
            goal_variance = float(goals_scored_array.var()) if len(goals_scored_array) > 1 else 0.0
            # Over/under rates on total match goals
            over15 = int((total_goals_per_match >= 2).sum())
            over35 = int((total_goals_per_match >= 4).sum())
            over45 = int((total_goals_per_match >= 5).sum())
            under15 = int((total_goals_per_match <= 1).sum())
            under25 = int((total_goals_per_match <= 2).sum())
            over_rates = {
                'over15': round(safe_div(over15, total_matches), 4),
                'over25': round(safe_div(over_25, total_matches), 4),
                'over35': round(safe_div(over35, total_matches), 4),
                'over45': round(safe_div(over45, total_matches), 4),
                'under15': round(safe_div(under15, total_matches), 4),
                'under25': round(safe_div(under25, total_matches), 4),
            }
        else:
            over_25 = 0
            btts = 0
            recent_scoring_trend = 1.0
            goal_variance = 0.0
            over_rates = {
                'over15': 0.0, 'over25': 0.0, 'over35': 0.0, 'over45': 0.0,
                'under15': 0.0, 'under25': 0.0,
            }

        # Home advantage — venue split comparisons. Skip deltas if either side
        # has no matches (lower-division throwbacks or misspelled names).
        if home_n and away_n:
            home_wins = int((home_rows['result'] == 'H').sum())
            away_wins_on_road = int((away_rows['result'] == 'A').sum())
            home_win_rate = safe_div(home_wins, home_n)
            away_win_rate = safe_div(away_wins_on_road, away_n)
            home_advantage = {
                'homeWinRate': round(home_win_rate, 4),
                'awayWinRate': round(away_win_rate, 4),
                'homeAwayWinDelta': round(home_win_rate - away_win_rate, 4),
                'homeAwayGoalsScoredDelta': round(
                    float(home_goals.mean()) - float(away_goals.mean()), 4
                ),
                'homeAwayGoalsConcededDelta': round(
                    float(home_conc.mean()) - float(away_conc.mean()), 4
                ),
            }
        else:
            home_advantage = None

        # Common final scorelines by venue (home-goals-first notation in both)
        common_scorelines: dict[str, Any] = {}
        if home_n >= 20:
            home_scores = list(zip(
                home_rows['home_goals'].astype(int).tolist(),
                home_rows['away_goals'].astype(int).tolist(),
            ))
            common_scorelines['atHome'] = _top_scorelines(home_scores, home_n)
        if away_n >= 20:
            away_scores = list(zip(
                away_rows['home_goals'].astype(int).tolist(),
                away_rows['away_goals'].astype(int).tolist(),
            ))
            common_scorelines['awayFrom'] = _top_scorelines(away_scores, away_n)

        teams[team] = {
            'totalMatches': int(total_matches),
            'homeGoalsScored': float(home_goals.mean()) if home_n else 0.0,
            'homeGoalsConceded': float(home_conc.mean()) if home_n else 0.0,
            'awayGoalsScored': float(away_goals.mean()) if away_n else 0.0,
            'awayGoalsConceded': float(away_conc.mean()) if away_n else 0.0,
            'cleanSheetRateHome': safe_div(home_clean_sheets, home_n),
            'cleanSheetRateAway': safe_div(away_clean_sheets, away_n),
            'failedToScoreRateHome': safe_div(home_failed_to_score, home_n),
            'failedToScoreRateAway': safe_div(away_failed_to_score, away_n),
            'over25Rate': safe_div(over_25, total_matches),
            'bttsRate': safe_div(btts, total_matches),
            'recentScoringTrend': round(float(recent_scoring_trend), 4),
            'goalVariance': round(goal_variance, 4),
            'overRates': over_rates,
            'eraWeighted': {
                'homeGoalsScored': round(
                    weighted_mean(home_goals.tolist(), home_weights), 4
                ),
                'homeGoalsConceded': round(
                    weighted_mean(home_conc.tolist(), home_weights), 4
                ),
                'awayGoalsScored': round(
                    weighted_mean(away_goals.tolist(), away_weights), 4
                ),
                'awayGoalsConceded': round(
                    weighted_mean(away_conc.tolist(), away_weights), 4
                ),
            },
        }

        if home_advantage is not None:
            teams[team]['homeAdvantage'] = home_advantage
        if common_scorelines:
            teams[team]['commonScorelines'] = common_scorelines

        # Round top-level floats for JSON compactness
        for k in (
            'homeGoalsScored', 'homeGoalsConceded',
            'awayGoalsScored', 'awayGoalsConceded',
            'cleanSheetRateHome', 'cleanSheetRateAway',
            'failedToScoreRateHome', 'failedToScoreRateAway',
            'over25Rate', 'bttsRate',
        ):
            teams[team][k] = round(teams[team][k], 4)

    return teams


def _top_scorelines(scores: list[tuple[int, int]], total: int, top_n: int = 3) -> list[dict[str, Any]]:
    """Top-N most-frequent scorelines with count + rate. Scores in (home, away) order."""
    from collections import Counter
    counter = Counter(scores)
    top = counter.most_common(top_n)
    return [
        {
            'score': f'{h}-{a}',
            'count': int(c),
            'rate': round(safe_div(c, total), 4),
        }
        for (h, a), c in top
    ]


def compute_pair_stats(df) -> dict[str, Any]:
    """Per ordered (home, away) team pair stats."""
    pairs: dict[str, Any] = {}

    grouped = df.groupby(['home_team', 'away_team'], sort=False)
    for (home, away), rows in grouped:
        key = f'{home}|{away}'
        rows = rows.sort_values('date')

        total = len(rows)
        home_wins = int((rows['result'] == 'H').sum())
        draws = int((rows['result'] == 'D').sum())
        away_wins = int((rows['result'] == 'A').sum())

        hg = rows['home_goals'].to_numpy(dtype=float)
        ag = rows['away_goals'].to_numpy(dtype=float)
        total_goals = hg + ag

        over_25 = int((total_goals >= 3).sum())
        over_35 = int((total_goals >= 4).sum())
        btts = int(((hg >= 1) & (ag >= 1)).sum())

        recent = rows.tail(10)
        recent_avg_total = float(
            (recent['home_goals'] + recent['away_goals']).mean()
        ) if len(recent) else 0.0

        # Variance of total goals — captures "swingy vs always-tight"
        if total > 1:
            mean_tg = total_goals.mean()
            variance = float(((total_goals - mean_tg) ** 2).mean())
        else:
            variance = 0.0

        entry: dict[str, Any] = {
            'totalMatches': total,
            'homeWins': home_wins,
            'draws': draws,
            'awayWins': away_wins,
            'avgHomeGoals': round(float(hg.mean()), 4) if total else 0.0,
            'avgAwayGoals': round(float(ag.mean()), 4) if total else 0.0,
            'avgTotalGoals': round(float(total_goals.mean()), 4) if total else 0.0,
            'over25Rate': round(safe_div(over_25, total), 4),
            'over35Rate': round(safe_div(over_35, total), 4),
            'bttsRate': round(safe_div(btts, total), 4),
            'recentTenAvgTotal': round(recent_avg_total, 4),
            'historicalVariance': round(variance, 4),
            'isDerby': (home, away) in DERBY_LOOKUP,
        }

        # HT × FT outcome matrix — only populated when the pair has ≥5 meetings
        # and half-time columns are available (post-~1995 seasons).
        ht_ft = _ht_ft_matrix(rows)
        if ht_ft is not None:
            entry['htFtMatrix'] = ht_ft

        pairs[key] = entry

    return pairs


def _ht_ft_matrix(rows) -> dict[str, int] | None:
    """9-key matrix counting HT×FT outcomes. Keys: HH, HD, HA, DH, DD, DA, AH, AD, AA.

    Returns None when:
      - the pair has fewer than 5 meetings with HT data, or
      - the CSV lacks half-time goal columns.
    """
    if 'half_time_home_goals' not in rows.columns or 'half_time_away_goals' not in rows.columns:
        return None
    ht_rows = rows.dropna(subset=['half_time_home_goals', 'half_time_away_goals', 'result'])
    if len(ht_rows) < 5:
        return None

    keys = ['HH', 'HD', 'HA', 'DH', 'DD', 'DA', 'AH', 'AD', 'AA']
    matrix = {k: 0 for k in keys}
    hthg = ht_rows['half_time_home_goals'].to_numpy(dtype=float)
    htag = ht_rows['half_time_away_goals'].to_numpy(dtype=float)
    ftr = ht_rows['result'].tolist()
    for hh, ha, ft in zip(hthg, htag, ftr):
        if hh > ha:
            ht = 'H'
        elif hh < ha:
            ht = 'A'
        else:
            ht = 'D'
        if ft not in ('H', 'D', 'A'):
            continue
        matrix[ht + ft] += 1
    return matrix


def compute_season_stats(df) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Per-season aggregates + anomaly flags.

    Returns a tuple of (season_stats_dict, anomalies_list). A season is flagged
    as anomalous when any of its headline rates lies more than 2 standard
    deviations from the 33-season mean. The 2020/21 COVID empty-stadium season
    is the canonical example — expected to show a notable drop in home-win
    rate that we can surface as context in the UI.
    """
    import math

    season_raw: dict[str, dict[str, Any]] = {}
    home_win_rates: list[float] = []
    draw_rates: list[float] = []
    away_win_rates: list[float] = []
    avg_total_goals: list[float] = []

    for season, group in df.groupby('season'):
        n = len(group)
        if n == 0:
            continue

        hg = group['home_goals'].to_numpy(dtype=float)
        ag = group['away_goals'].to_numpy(dtype=float)
        total = hg + ag

        home_wins = int((group['result'] == 'H').sum())
        draws = int((group['result'] == 'D').sum())
        away_wins = int((group['result'] == 'A').sum())
        over_25 = int((total >= 3).sum())
        btts = int(((hg >= 1) & (ag >= 1)).sum())

        hw_rate = safe_div(home_wins, n)
        d_rate = safe_div(draws, n)
        aw_rate = safe_div(away_wins, n)
        avg_total = float(total.mean())

        season_raw[str(season)] = {
            'matches': int(n),
            'homeWinRate': round(hw_rate, 4),
            'drawRate': round(d_rate, 4),
            'awayWinRate': round(aw_rate, 4),
            'avgHomeGoals': round(float(hg.mean()), 4),
            'avgAwayGoals': round(float(ag.mean()), 4),
            'avgTotalGoals': round(avg_total, 4),
            'over25Rate': round(safe_div(over_25, n), 4),
            'bttsRate': round(safe_div(btts, n), 4),
        }
        home_win_rates.append(hw_rate)
        draw_rates.append(d_rate)
        away_win_rates.append(aw_rate)
        avg_total_goals.append(avg_total)

    # Compute means and stdevs across the 33 seasons, then flag outliers.
    def _stdev(values: list[float]) -> float:
        if len(values) < 2:
            return 0.0
        mean_v = sum(values) / len(values)
        var = sum((v - mean_v) ** 2 for v in values) / len(values)
        return math.sqrt(var)

    hw_mean = sum(home_win_rates) / max(1, len(home_win_rates))
    d_mean = sum(draw_rates) / max(1, len(draw_rates))
    aw_mean = sum(away_win_rates) / max(1, len(away_win_rates))
    tg_mean = sum(avg_total_goals) / max(1, len(avg_total_goals))
    hw_sd = _stdev(home_win_rates)
    d_sd = _stdev(draw_rates)
    aw_sd = _stdev(away_win_rates)
    tg_sd = _stdev(avg_total_goals)

    anomalies: list[dict[str, Any]] = []
    for season, s in sorted(season_raw.items()):
        reasons: list[str] = []
        if hw_sd and abs(s['homeWinRate'] - hw_mean) > 2 * hw_sd:
            delta = s['homeWinRate'] - hw_mean
            reasons.append(
                f"homeWinRate {s['homeWinRate']:.1%} is {delta:+.1%} vs 33-season mean {hw_mean:.1%}"
            )
        if d_sd and abs(s['drawRate'] - d_mean) > 2 * d_sd:
            delta = s['drawRate'] - d_mean
            reasons.append(
                f"drawRate {s['drawRate']:.1%} is {delta:+.1%} vs mean {d_mean:.1%}"
            )
        if aw_sd and abs(s['awayWinRate'] - aw_mean) > 2 * aw_sd:
            delta = s['awayWinRate'] - aw_mean
            reasons.append(
                f"awayWinRate {s['awayWinRate']:.1%} is {delta:+.1%} vs mean {aw_mean:.1%}"
            )
        if tg_sd and abs(s['avgTotalGoals'] - tg_mean) > 2 * tg_sd:
            delta = s['avgTotalGoals'] - tg_mean
            reasons.append(
                f"avgTotalGoals {s['avgTotalGoals']:.2f} is {delta:+.2f} vs mean {tg_mean:.2f}"
            )
        s['isAnomalous'] = bool(reasons)
        s['anomalyReasons'] = reasons
        if reasons:
            anomalies.append({'season': season, 'reasons': reasons})

    return season_raw, anomalies


def compute_referee_stats(df) -> dict[str, Any]:
    """Referee-level goal tendency. Only referees with >=50 matches retained."""
    if 'referee' not in df.columns:
        return {}
    ref_rows = df.dropna(subset=['referee'])
    if len(ref_rows) == 0:
        return {}

    league_avg = float((ref_rows['home_goals'] + ref_rows['away_goals']).mean())

    refs: dict[str, Any] = {}
    for referee, group in ref_rows.groupby('referee'):
        n = len(group)
        if n < 50:
            continue
        hg = group['home_goals'].to_numpy(dtype=float)
        ag = group['away_goals'].to_numpy(dtype=float)
        total = hg + ag

        home_wins = int((group['result'] == 'H').sum())
        draws = int((group['result'] == 'D').sum())
        away_wins = int((group['result'] == 'A').sum())
        over_25 = int((total >= 3).sum())
        btts = int(((hg >= 1) & (ag >= 1)).sum())

        avg_total = float(total.mean())
        entry: dict[str, Any] = {
            'matches': int(n),
            'avgGoalsPerMatch': round(avg_total, 4),
            'goalsVsLeagueAvg': round(avg_total - league_avg, 4),
            'homeWinRate': round(safe_div(home_wins, n), 4),
            'drawRate': round(safe_div(draws, n), 4),
            'awayWinRate': round(safe_div(away_wins, n), 4),
            'over25Rate': round(safe_div(over_25, n), 4),
            'bttsRate': round(safe_div(btts, n), 4),
        }

        # Discipline / set-piece averages — populated only where the CSV
        # supplies the columns and they aren't all NaN (older seasons may lack
        # any of them). `pd.to_numeric` coerces stray strings to NaN.
        import pandas as pd
        discipline_mapping = [
            ('avgYellowsPerMatch', ['home_yellows', 'away_yellows']),
            ('avgRedsPerMatch', ['home_reds', 'away_reds']),
            ('avgFoulsPerMatch', ['home_fouls', 'away_fouls']),
            ('avgCornersPerMatch', ['home_corners', 'away_corners']),
        ]
        for out_key, source_cols in discipline_mapping:
            if not all(c in group.columns for c in source_cols):
                continue
            series_sum = None
            for c in source_cols:
                coerced = pd.to_numeric(group[c], errors='coerce')
                series_sum = coerced if series_sum is None else series_sum + coerced
            if series_sum is None:
                continue
            mean_val = series_sum.mean()
            if pd.isna(mean_val):
                continue
            entry[out_key] = round(float(mean_val), 4)

        refs[str(referee)] = entry
    return refs


def compute_matchday_stats(df) -> dict[str, Any]:
    """Per-matchday league aggregates.

    Matchday is inferred as the Nth chronological league match each team plays
    within a season — we group by season + team, number fixtures 1..38, then
    take the max number across the two sides of each fixture to assign a
    canonical matchday. This handles rescheduled matches where the two clubs'
    counts temporarily diverge.

    Returns `{matchday: {matches, avgTotalGoals, homeWinRate, drawRate,
    awayWinRate, over25Rate}}` keyed by the matchday integer as a string.
    Empty dict if the input lacks required columns.
    """
    import pandas as pd

    required = {'season', 'home_team', 'away_team', 'date', 'home_goals', 'away_goals', 'result'}
    if not required.issubset(df.columns):
        return {}

    work = df.dropna(subset=['season', 'home_team', 'away_team', 'date']).copy()
    if len(work) == 0:
        return {}

    work = work.sort_values('date').reset_index(drop=True)
    work['row_id'] = work.index

    # Build per-(season, team) ordinal: each club's Nth league match of the
    # season. Then the fixture's matchday = max(home ordinal, away ordinal).
    home_long = work[['row_id', 'season', 'home_team', 'date']].rename(
        columns={'home_team': 'team'}
    )
    away_long = work[['row_id', 'season', 'away_team', 'date']].rename(
        columns={'away_team': 'team'}
    )
    long = pd.concat([home_long, away_long], ignore_index=True)
    long = long.sort_values(['season', 'team', 'date', 'row_id'])
    long['ordinal'] = long.groupby(['season', 'team']).cumcount() + 1
    md_per_row = long.groupby('row_id')['ordinal'].max()
    work['matchday'] = work['row_id'].map(md_per_row)

    out: dict[str, Any] = {}
    # Cap at 38 — some seasons contain a handful of rows beyond that when
    # replays/rescheduling push a team above 38 league fixtures in the data.
    for md, group in work.groupby('matchday'):
        md_int = int(md)
        if md_int < 1 or md_int > 38:
            continue
        n = len(group)
        if n == 0:
            continue
        hg = group['home_goals'].to_numpy(dtype=float)
        ag = group['away_goals'].to_numpy(dtype=float)
        total = hg + ag
        home_wins = int((group['result'] == 'H').sum())
        draws = int((group['result'] == 'D').sum())
        away_wins = int((group['result'] == 'A').sum())
        over_25 = int((total >= 3).sum())
        out[str(md_int)] = {
            'matches': int(n),
            'avgTotalGoals': round(float(total.mean()), 4),
            'homeWinRate': round(safe_div(home_wins, n), 4),
            'drawRate': round(safe_div(draws, n), 4),
            'awayWinRate': round(safe_div(away_wins, n), 4),
            'over25Rate': round(safe_div(over_25, n), 4),
        }
    return out


def augment_team_half_time(df, teams: dict[str, Any]) -> None:
    """Mutate the teams dict in-place to add half-time tempo + comeback rates.

    Skipped for teams where the CSV data doesn't carry half-time columns (1993
    and earlier). Most of the 33-season archive has it from ~1995 onward.
    """
    if 'half_time_home_goals' not in df.columns or 'half_time_away_goals' not in df.columns:
        return
    ht_rows = df.dropna(subset=['half_time_home_goals', 'half_time_away_goals', 'result']).copy()
    if len(ht_rows) == 0:
        return

    # Compute half-specific goal counts once across the whole DataFrame
    ht_rows['first_half_home'] = ht_rows['half_time_home_goals']
    ht_rows['first_half_away'] = ht_rows['half_time_away_goals']
    ht_rows['second_half_home'] = ht_rows['home_goals'] - ht_rows['first_half_home']
    ht_rows['second_half_away'] = ht_rows['away_goals'] - ht_rows['first_half_away']

    # Half-time result derived — defensive: handle missing half_time_result
    def _ht_result(r):
        if r['first_half_home'] > r['first_half_away']:
            return 'H'
        if r['first_half_home'] < r['first_half_away']:
            return 'A'
        return 'D'

    ht_rows['ht_outcome'] = ht_rows.apply(_ht_result, axis=1)

    for team, profile in teams.items():
        team_rows = ht_rows[(ht_rows['home_team'] == team) | (ht_rows['away_team'] == team)]
        if len(team_rows) < 10:
            continue

        first_half_scored = team_rows.apply(
            lambda r: r['first_half_home'] if r['home_team'] == team else r['first_half_away'],
            axis=1,
        )
        second_half_scored = team_rows.apply(
            lambda r: r['second_half_home'] if r['home_team'] == team else r['second_half_away'],
            axis=1,
        )

        first_half_total = float(first_half_scored.sum())
        second_half_total = float(second_half_scored.sum())
        total_goals = first_half_total + second_half_total

        # Comeback: team was trailing at HT but won at FT
        # Capitulation: team was leading at HT but lost at FT
        def _comeback(r):
            if r['home_team'] == team:
                return (r['ht_outcome'] == 'A' and r['result'] == 'H')
            return (r['ht_outcome'] == 'H' and r['result'] == 'A')

        def _capitulation(r):
            if r['home_team'] == team:
                return (r['ht_outcome'] == 'H' and r['result'] == 'A')
            return (r['ht_outcome'] == 'A' and r['result'] == 'H')

        comebacks = int(team_rows.apply(_comeback, axis=1).sum())
        capitulations = int(team_rows.apply(_capitulation, axis=1).sum())

        profile['halfTime'] = {
            'matches': int(len(team_rows)),
            'avgFirstHalfGoalsScored': round(float(first_half_scored.mean()), 4),
            'avgSecondHalfGoalsScored': round(float(second_half_scored.mean()), 4),
            'firstHalfShare': round(safe_div(first_half_total, total_goals), 4) if total_goals else 0.0,
            'comebackWinRate': round(safe_div(comebacks, len(team_rows)), 4),
            'capitulationLossRate': round(safe_div(capitulations, len(team_rows)), 4),
        }


def compute_league_era(df) -> dict[str, Any]:
    """League-wide aggregates for normalisation and era-drift correction."""
    df = df.copy()
    df['year'] = df['date'].dt.year
    df['month'] = df['date'].dt.strftime('%b')
    df['decade'] = df['year'].apply(decade_label)

    by_decade: dict[str, float] = {}
    for decade, group in df.groupby('decade'):
        by_decade[str(decade)] = round(float(group['home_goals'].mean()), 4)

    by_month: dict[str, float] = {}
    months_order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    for m in months_order:
        mrows = df[df['month'] == m]
        by_month[m] = round(float(mrows['home_goals'].mean()), 4) if len(mrows) else 0.0

    total_matches = len(df)
    total_goals = df['home_goals'] + df['away_goals']
    over_25 = int((total_goals >= 3).sum())
    btts = int(((df['home_goals'] >= 1) & (df['away_goals'] >= 1)).sum())

    return {
        'avgHomeGoalsOverall': round(float(df['home_goals'].mean()), 4),
        'avgAwayGoalsOverall': round(float(df['away_goals'].mean()), 4),
        'avgTotalGoalsOverall': round(float(total_goals.mean()), 4),
        'avgOver25Overall': round(safe_div(over_25, total_matches), 4),
        'avgBTTSOverall': round(safe_div(btts, total_matches), 4),
        'avgHomeGoalsByDecade': dict(sorted(by_decade.items())),
        'avgHomeGoalsByMonth': by_month,
    }


def sort_dict_recursive(obj):
    """Recursively sort dict keys so JSON output is byte-stable."""
    if isinstance(obj, dict):
        return {k: sort_dict_recursive(obj[k]) for k in sorted(obj.keys())}
    if isinstance(obj, list):
        return [sort_dict_recursive(v) for v in obj]
    return obj


def main():
    csv_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'spreadsheets', 'KnowledgeFilesCSV',
    )

    print(f'Loading CSVs from {csv_dir}…')
    df = FreeTierFeatureEngineer.load_csvs(csv_dir)
    print(f'Loaded {len(df)} matches across {df["season"].nunique()} seasons')

    print('Computing team profiles…')
    teams = compute_team_stats(df)
    print(f'  → {len(teams)} teams')

    print('Adding half-time tempo + comeback rates to team profiles…')
    augment_team_half_time(df, teams)
    with_ht = sum(1 for t in teams.values() if 'halfTime' in t)
    print(f'  → {with_ht}/{len(teams)} teams have half-time data')

    print('Computing pair stats…')
    pairs = compute_pair_stats(df)
    print(f'  → {len(pairs)} ordered (home, away) pairs')

    print('Computing per-season aggregates + anomaly detection…')
    season_stats, anomalies = compute_season_stats(df)
    print(f'  → {len(season_stats)} seasons, {len(anomalies)} flagged as anomalous')
    for a in anomalies:
        print(f'    • {a["season"]}: {"; ".join(a["reasons"])}')

    print('Computing referee stats…')
    referees = compute_referee_stats(df)
    print(f'  → {len(referees)} referees with ≥50 matches')

    print('Computing league-era aggregates…')
    league_era = compute_league_era(df)

    print('Computing per-matchday league aggregates…')
    matchday_stats = compute_matchday_stats(df)
    print(f'  → {len(matchday_stats)} matchday entries')

    pack = {
        'generatedAt': datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        'eraDecay': ERA_DECAY,
        'referenceYear': CURRENT_YEAR,
        'totalMatches': int(len(df)),
        'totalSeasons': int(df['season'].nunique()),
        'seasons': sorted(df['season'].unique().tolist()),
        'leagueEra': league_era,
        'seasonStats': season_stats,
        'anomalies': anomalies,
        'referees': referees,
        'teams': teams,
        'pairs': pairs,
        'matchdayStats': matchday_stats,
    }

    pack = sort_dict_recursive(pack)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(pack, f, indent=2, ensure_ascii=False, sort_keys=True)
        f.write('\n')  # trailing newline — git-friendly

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f'\nWrote {OUTPUT_PATH} ({size_kb:.1f} KB)')
    print('Done.')


if __name__ == '__main__':
    main()
