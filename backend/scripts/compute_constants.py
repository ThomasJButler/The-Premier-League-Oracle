#!/usr/bin/env python3
"""
Compute empirical values for frontend prediction constants from CSV match data.

Outputs values for:
  1. ELO_HOME_ADVANTAGE — ELO points derived from observed home performance
  2. DEFAULT_REFEREE_AVG_YELLOWS / DEFAULT_REFEREE_AVG_REDS — card averages
  3. HT_FT_CORRELATION and HT prior distribution — half-time/full-time relationship

Run from backend/:
  conda activate anaconda-ml-ai
  python scripts/compute_constants.py
"""

import math
import os
import sys

# Add parent to path so we can import the feature engineer
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.features.free_tier_features import FreeTierFeatureEngineer


def main():
    csv_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'spreadsheets', 'KnowledgeFilesCSV',
    )

    print(f'Loading CSVs from {csv_dir}...')
    df = FreeTierFeatureEngineer.load_csvs(csv_dir)
    total = len(df)
    print(f'Loaded {total} matches\n')

    # ─── 1. ELO HOME ADVANTAGE ─────────────────────────────────────────
    home_wins = (df['result'] == 'H').sum()
    draws = (df['result'] == 'D').sum()
    away_wins = (df['result'] == 'A').sum()

    home_win_rate = home_wins / total
    draw_rate = draws / total
    away_win_rate = away_wins / total

    # ELO expected score: W=1, D=0.5, L=0
    home_expected_score = (home_wins + 0.5 * draws) / total
    # Solve: expected_score = 1 / (1 + 10^(-HOME_ADV / 400))
    # HOME_ADV = -400 * log10(1 / expected_score - 1)
    home_advantage_elo = -400 * math.log10(1 / home_expected_score - 1)

    print('═══ 1. ELO HOME ADVANTAGE ═══')
    print(f'  Home wins:  {home_wins} ({home_win_rate:.1%})')
    print(f'  Draws:      {draws} ({draw_rate:.1%})')
    print(f'  Away wins:  {away_wins} ({away_win_rate:.1%})')
    print(f'  Home expected score (ELO): {home_expected_score:.4f}')
    print(f'  ➜ ELO_HOME_ADVANTAGE = {home_advantage_elo:.1f}')
    print()

    # ─── 2. REFEREE / CARD AVERAGES ─────────────────────────────────────
    yellows_per_match = (df['home_yellows'] + df['away_yellows']).mean()
    reds_per_match = (df['home_reds'] + df['away_reds']).mean()

    # Check for NaN (columns might be missing in some CSVs)
    if math.isnan(yellows_per_match):
        print('⚠ Yellow card columns contain NaN — some CSVs may lack card data')
        # Filter to rows with card data
        card_df = df.dropna(subset=['home_yellows', 'away_yellows'])
        yellows_per_match = (card_df['home_yellows'] + card_df['away_yellows']).mean()
        reds_per_match = (card_df['home_reds'] + card_df['away_reds']).mean()
        print(f'  (Using {len(card_df)} matches with card data)')

    print('═══ 2. REFEREE CARD AVERAGES ═══')
    print(f'  Avg yellow cards per match: {yellows_per_match:.2f}')
    print(f'  Avg red cards per match:    {reds_per_match:.3f}')
    print(f'  ➜ DEFAULT_REFEREE_AVG_YELLOWS = {yellows_per_match:.1f}')
    print(f'  ➜ DEFAULT_REFEREE_AVG_REDS = {reds_per_match:.2f}')
    print()

    # ─── 3. HT-FT CORRELATION ──────────────────────────────────────────
    ht_ft_df = df.dropna(subset=['half_time_result', 'result'])
    ht_ft_total = len(ht_ft_df)

    # How often does the HT result match the FT result?
    ht_ft_match_rate = (ht_ft_df['half_time_result'] == ht_ft_df['result']).mean()

    # HT result prior distribution
    ht_home = (ht_ft_df['half_time_result'] == 'H').mean()
    ht_draw = (ht_ft_df['half_time_result'] == 'D').mean()
    ht_away = (ht_ft_df['half_time_result'] == 'A').mean()

    # The ftBias represents how much FT probabilities should weight the HT prediction.
    # If FT result perfectly predicted HT result, ftBias would be 1.0.
    # If there were no correlation, ftBias would be 0.0.
    # We derive it from the match rate relative to the baseline (random would be ~33%).
    # ftBias = (match_rate - baseline) / (1 - baseline)
    baseline = (ht_home ** 2 + ht_draw ** 2 + ht_away ** 2)  # expected match rate if independent
    ft_bias = (ht_ft_match_rate - baseline) / (1 - baseline)
    ft_bias = max(0.0, min(1.0, ft_bias))  # clamp to [0, 1]

    print('═══ 3. HT-FT CORRELATION ═══')
    print(f'  Matches with HT data: {ht_ft_total}')
    print(f'  HT result matches FT: {ht_ft_match_rate:.1%}')
    print(f'  Baseline (independent): {baseline:.1%}')
    print(f'  HT prior: Home {ht_home:.2f}, Draw {ht_draw:.2f}, Away {ht_away:.2f}')
    print(f'  ➜ HT_FT_CORRELATION = {ft_bias:.2f}')
    print(f'  ➜ HT_PRIOR_HOME = {ht_home:.2f}')
    print(f'  ➜ HT_PRIOR_DRAW = {ht_draw:.2f}')
    print(f'  ➜ HT_PRIOR_AWAY = {ht_away:.2f}')
    print()

    # ─── SUMMARY FOR constants.ts ───────────────────────────────────────
    print('═══ CONSTANTS FOR frontend/src/lib/constants.ts ═══')
    print(f'export const ELO_HOME_ADVANTAGE = {round(home_advantage_elo)};')
    print(f'export const DEFAULT_REFEREE_AVG_YELLOWS = {yellows_per_match:.1f};')
    print(f'export const DEFAULT_REFEREE_AVG_REDS = {reds_per_match:.2f};')
    print(f'export const HT_FT_CORRELATION = {ft_bias:.2f};')
    print(f'export const HT_PRIOR_HOME = {ht_home:.2f};')
    print(f'export const HT_PRIOR_DRAW = {ht_draw:.2f};')
    print(f'export const HT_PRIOR_AWAY = {ht_away:.2f};')


if __name__ == '__main__':
    main()
