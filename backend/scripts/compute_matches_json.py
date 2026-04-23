#!/usr/bin/env python3
"""
Build `frontend/src/lib/data/completedMatches.json` — a compact per-match
index covering every season in `backend/spreadsheets/KnowledgeFilesCSV/`.

The frontend Oracle Chat uses this bundle for historical-match queries
("Liverpool's away wins in 2023/24", "last five meetings between Arsenal
and Chelsea", etc.) without requiring a running Python backend — the data
ships with the SPA and queries run client-side.

Output schema (one object per match):

    { "s": "2023/24", "d": "2023-08-11", "h": "Burnley",
      "a": "Manchester City", "hg": 0, "ag": 3, "r": "A" }

Fields are abbreviated to keep the bundle small — ~12,500 rows × ~60 bytes
gzipped ≈ 120 KB over the wire.

Usage:

    /opt/anaconda3/envs/anaconda-ml-ai/bin/python \\
        backend/scripts/compute_matches_json.py

Idempotent — re-running produces byte-identical output (sorted by date).
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path
from typing import Any

# Resolve paths relative to repo root no matter where the script is run from.
REPO_ROOT = Path(__file__).resolve().parents[2]
CSV_DIR = REPO_ROOT / 'backend' / 'spreadsheets' / 'KnowledgeFilesCSV'
OUT_PATH = REPO_ROOT / 'frontend' / 'src' / 'lib' / 'data' / 'completedMatches.json'

# Season filename: EPL20222023.csv → 2022/23
SEASON_PATTERN = re.compile(r'EPL(\d{4})(\d{4})\.csv$')


def parse_season(csv_name: str) -> str | None:
    """EPL20222023.csv → '2022/23'. Returns None for non-matching names."""
    match = SEASON_PATTERN.match(csv_name)
    if not match:
        return None
    start_year = int(match.group(1))
    return f'{start_year}/{str(start_year + 1)[-2:]}'


def parse_date(raw: str) -> str | None:
    """
    Normalise '05/08/2022' (DD/MM/YYYY) → '2022-08-05' (ISO).
    Older seasons sometimes use 2-digit years ('05/08/22'); handle both.
    """
    parts = raw.strip().split('/')
    if len(parts) != 3:
        return None
    day, month, year = parts
    if len(year) == 2:
        # 2-digit year: 90s seasons get '19NN', 00-25 get '20NN'.
        y_int = int(year)
        year = f'19{year}' if y_int >= 90 else f'20{year.zfill(2)}'
    try:
        return f'{int(year):04d}-{int(month):02d}-{int(day):02d}'
    except ValueError:
        return None


def is_completed(row: dict[str, str]) -> bool:
    """A row counts as a completed match if FTHG/FTAG/FTR are all present."""
    return all(row.get(col, '').strip() != '' for col in ('FTHG', 'FTAG', 'FTR'))


def extract_rows(csv_path: Path, season: str) -> list[dict[str, Any]]:
    """Read one season CSV and return the compact-match rows for it."""
    rows: list[dict[str, Any]] = []
    # Older CSVs (90s/2000s seasons) contain Windows-1252 bytes like 0xa0
    # (non-breaking space) that aren't valid UTF-8. latin-1 can't raise on
    # any byte sequence, so it's the pragmatic choice for a heterogeneous
    # multi-decade archive where only the team-name / date / score columns
    # need to round-trip and those stay in ASCII.
    with csv_path.open(newline='', encoding='latin-1') as f:
        reader = csv.DictReader(f)
        for raw in reader:
            if not is_completed(raw):
                continue
            iso_date = parse_date(raw.get('Date', ''))
            home = raw.get('HomeTeam', '').strip()
            away = raw.get('AwayTeam', '').strip()
            result = raw.get('FTR', '').strip().upper()
            if not (iso_date and home and away and result in ('H', 'D', 'A')):
                continue
            try:
                home_goals = int(float(raw['FTHG']))
                away_goals = int(float(raw['FTAG']))
            except (ValueError, TypeError):
                continue
            rows.append({
                's': season,
                'd': iso_date,
                'h': home,
                'a': away,
                'hg': home_goals,
                'ag': away_goals,
                'r': result,
            })
    return rows


def main() -> int:
    if not CSV_DIR.is_dir():
        print(f'error: CSV directory not found: {CSV_DIR}', file=sys.stderr)
        return 1

    all_rows: list[dict[str, Any]] = []
    csv_files = sorted(CSV_DIR.glob('EPL*.csv'))
    if not csv_files:
        print(f'error: no EPL*.csv files in {CSV_DIR}', file=sys.stderr)
        return 1

    for csv_path in csv_files:
        season = parse_season(csv_path.name)
        if season is None:
            print(f'warn: skipping unrecognised filename: {csv_path.name}', file=sys.stderr)
            continue
        rows = extract_rows(csv_path, season)
        all_rows.extend(rows)
        print(f'{season}: {len(rows)} matches from {csv_path.name}')

    # Deterministic order for byte-stable output: primary key date, secondary
    # by home team so same-date fixtures sort the same on every run.
    all_rows.sort(key=lambda r: (r['d'], r['h']))

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open('w', encoding='utf-8') as f:
        json.dump(all_rows, f, separators=(',', ':'), ensure_ascii=False)
        f.write('\n')

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f'\nWrote {len(all_rows):,} matches to {OUT_PATH.relative_to(REPO_ROOT)} ({size_kb:.1f} KB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
