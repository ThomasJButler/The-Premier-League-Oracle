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
from collections import defaultdict
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

        def _match_goals(r):
            return r['home_goals'] if r['home_team'] == team else r['away_goals']

        def _match_conceded(r):
            return r['away_goals'] if r['home_team'] == team else r['home_goals']

        if total_matches:
            goals_series = all_rows['home_goals'].where(
                all_rows['home_team'] == team, all_rows['away_goals']
            )
            conc_series = all_rows['away_goals'].where(
                all_rows['home_team'] == team, all_rows['home_goals']
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
        else:
            over_25 = 0
            btts = 0
            recent_scoring_trend = 1.0

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

        pairs[key] = {
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
        }

    return pairs


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

    print('Computing pair stats…')
    pairs = compute_pair_stats(df)
    print(f'  → {len(pairs)} ordered (home, away) pairs')

    print('Computing league-era aggregates…')
    league_era = compute_league_era(df)

    pack = {
        'generatedAt': datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        'eraDecay': ERA_DECAY,
        'referenceYear': CURRENT_YEAR,
        'totalMatches': int(len(df)),
        'totalSeasons': int(df['season'].nunique()),
        'seasons': sorted(df['season'].unique().tolist()),
        'leagueEra': league_era,
        'teams': teams,
        'pairs': pairs,
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
