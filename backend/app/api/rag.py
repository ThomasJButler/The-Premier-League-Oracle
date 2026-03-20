"""
Oracle Chat RAG — DataFrame-grounded query engine.

Parses user intent from natural language, queries the in-memory
historical match DataFrame (2,191+ matches) and player statistics,
and builds an augmented system prompt so the LLM can give
data-grounded responses instead of hallucinating statistics.

Design:
    - No embeddings needed — structured tabular data suits exact queries
    - Intent parser uses keyword/pattern matching + team name extraction
    - Query functions return markdown tables (max 20 rows) for the prompt
    - System prompt includes persona + retrieved data context
    - Player data loaded from CSV (fact_player_stats.csv) and/or API scorers
"""

import logging
import re
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Player data storage (populated by init_player_data at startup)
# ---------------------------------------------------------------------------

_PLAYER_STATS: pd.DataFrame = pd.DataFrame()  # from fact_player_stats.csv
_API_SCORERS: pd.DataFrame = pd.DataFrame()    # from Football-Data.org /scorers
_PLAYER_NAMES: list[tuple[str, str]] = []       # (name_lower, canonical_name) sorted longest-first

# ---------------------------------------------------------------------------
# Team name extraction
# ---------------------------------------------------------------------------

# (pattern_lower, csv_name) — populated by init_team_patterns()
_TEAM_PATTERNS: list[tuple[str, str]] = []


def init_team_patterns(csv_to_api: dict[str, str], aliases: dict[str, str]) -> None:
    """Build sorted team name patterns for extraction (longest first).

    Must be called once at startup after CSV_TO_API and _ALIASES are
    available from free_tier_features.
    """
    global _TEAM_PATTERNS
    patterns: set[tuple[str, str]] = set()

    # CSV short names
    for csv_name in csv_to_api:
        patterns.add((csv_name.lower(), csv_name))

    # API full names → CSV short names
    api_to_csv = {v: k for k, v in csv_to_api.items()}
    for api_name, csv_name in api_to_csv.items():
        patterns.add((api_name.lower(), csv_name))

    # User-friendly aliases
    for alias, csv_name in aliases.items():
        patterns.add((alias.lower(), csv_name))

    # Extra common aliases that users might type in chat
    _extra: dict[str, str] = {
        'spurs': 'Tottenham',
        'forest': "Nott'm Forest",
        'nottingham forest': "Nott'm Forest",
        'palace': 'Crystal Palace',
        'city': 'Man City',
        'united': 'Man United',
        'toon': 'Newcastle',
        'the toffees': 'Everton',
        'toffees': 'Everton',
        'the gunners': 'Arsenal',
        'gunners': 'Arsenal',
        'the reds': 'Liverpool',
        'hammers': 'West Ham',
        'saints': 'Southampton',
        'foxes': 'Leicester',
        'bees': 'Brentford',
        'cherries': 'Bournemouth',
        'villa': 'Aston Villa',
        'wolves': 'Wolves',
        'wolverhampton': 'Wolves',
    }
    for alias, csv_name in _extra.items():
        patterns.add((alias, csv_name))

    # Sort longest-first so "Manchester United" matches before "United"
    _TEAM_PATTERNS = sorted(patterns, key=lambda x: len(x[0]), reverse=True)


def init_player_data(
    csv_path: Path | None = None,
    api_scorers: list[dict] | None = None,
) -> None:
    """Load player data from CSV and/or API scorers into module state.

    Called once at startup from the lifespan handler. Both sources are
    optional — the RAG module degrades gracefully if neither is available.
    """
    global _PLAYER_STATS, _API_SCORERS, _PLAYER_NAMES

    # 1. Load CSV player stats (fact_player_stats.csv)
    if csv_path and csv_path.exists():
        try:
            df = pd.read_csv(csv_path)
            # Only keep PL players
            if 'league' in df.columns:
                df = df[df['league'] == 'Premier League'].copy()
            _PLAYER_STATS = df
            logger.info("Loaded %d player records from CSV", len(df))
        except Exception as e:
            logger.warning("Could not load player CSV: %s", e)

    # 2. Load API top scorers
    if api_scorers:
        rows = []
        for scorer in api_scorers:
            player = scorer.get('player', {})
            team = scorer.get('team', {})
            rows.append({
                'name': player.get('name', ''),
                'team': team.get('name', ''),
                'goals': scorer.get('goals', 0),
                'assists': scorer.get('assists', 0),
                'penalties': scorer.get('penalties', 0),
                'matches_played': scorer.get('playedMatches', 0),
            })
        if rows:
            _API_SCORERS = pd.DataFrame(rows)
            logger.info("Loaded %d API top scorers", len(rows))

    # 3. Build player name lookup (longest-first, like team patterns)
    names: set[tuple[str, str]] = set()
    if not _PLAYER_STATS.empty and 'name' in _PLAYER_STATS.columns:
        for name in _PLAYER_STATS['name'].dropna().unique():
            names.add((name.lower(), name))
            # Also add surname only for common lookups like "Salah"
            parts = name.split()
            if len(parts) > 1:
                names.add((parts[-1].lower(), name))
    if not _API_SCORERS.empty and 'name' in _API_SCORERS.columns:
        for name in _API_SCORERS['name'].dropna().unique():
            names.add((name.lower(), name))
            parts = name.split()
            if len(parts) > 1:
                names.add((parts[-1].lower(), name))

    _PLAYER_NAMES = sorted(names, key=lambda x: len(x[0]), reverse=True)
    logger.info("Built %d player name patterns for RAG", len(_PLAYER_NAMES))


def extract_players(text: str) -> list[str]:
    """Extract player names from natural language text.

    Returns canonical player names matched greedily (longest first).
    """
    text_lower = text.lower()
    found: list[str] = []
    used_positions: set[int] = set()

    for pattern, canonical in _PLAYER_NAMES:
        if canonical in found:
            continue

        idx = text_lower.find(pattern)
        while idx != -1:
            before_ok = idx == 0 or not text_lower[idx - 1].isalpha()
            after_idx = idx + len(pattern)
            after_ok = after_idx >= len(text_lower) or not text_lower[after_idx].isalpha()

            if before_ok and after_ok:
                positions = set(range(idx, after_idx))
                if not positions & used_positions:
                    found.append(canonical)
                    used_positions.update(positions)
                    break

            idx = text_lower.find(pattern, idx + 1)

    return found


def extract_teams(text: str) -> list[str]:
    """Extract team names from natural language text.

    Returns a list of CSV short names found in the text, matched
    greedily (longest pattern first) with word-boundary checks.
    """
    text_lower = text.lower()
    found: list[str] = []
    used_positions: set[int] = set()

    for pattern, csv_name in _TEAM_PATTERNS:
        if csv_name in found:
            continue

        idx = text_lower.find(pattern)
        while idx != -1:
            # Word-boundary check
            before_ok = idx == 0 or not text_lower[idx - 1].isalpha()
            after_idx = idx + len(pattern)
            after_ok = after_idx >= len(text_lower) or not text_lower[after_idx].isalpha()

            if before_ok and after_ok:
                positions = set(range(idx, after_idx))
                if not positions & used_positions:
                    found.append(csv_name)
                    used_positions.update(positions)
                    break

            idx = text_lower.find(pattern, idx + 1)

    return found


# ---------------------------------------------------------------------------
# Intent parsing
# ---------------------------------------------------------------------------

class QueryIntent:
    """Parsed intent from a user message."""

    __slots__ = ('last_n', 'players', 'query_type', 'season', 'stat_type', 'teams')

    def __init__(self) -> None:
        self.teams: list[str] = []
        self.players: list[str] = []
        self.query_type: str = 'general'
        self.season: str | None = None
        self.last_n: int | None = None
        self.stat_type: str | None = None


def parse_intent(text: str) -> QueryIntent:
    """Parse user message to extract intent, teams, and parameters."""
    intent = QueryIntent()
    intent.teams = extract_teams(text)
    intent.players = extract_players(text)
    lower = text.lower()

    # Detect query type (ordered by specificity)
    # Player queries trigger when a player name was detected or scorer-specific
    # keywords appear. Avoid overly broad keywords like "goals" which could
    # refer to team-level stats.
    _player_keywords = [
        'top scorer', 'top scorers', 'golden boot', 'who scored the most',
        'player stats', 'players', 'squad', 'assists leader',
        'most assists', 'most goals', 'who is the top', 'leading scorer',
        'xg', 'expected goals',
    ]
    if intent.players or any(kw in lower for kw in _player_keywords):
        intent.query_type = 'player'
    elif any(kw in lower for kw in ['vs', 'versus', 'against', 'head to head', 'h2h', 'record against']):
        intent.query_type = 'h2h'
    elif any(kw in lower for kw in ['draw', 'draws', 'drawing']):
        intent.query_type = 'draws'
    elif any(kw in lower for kw in ['goal', 'goals', 'scoring', 'score', 'clean sheet',
                                     'clean sheets', 'concede', 'conceding', 'btts',
                                     'over 2.5', 'under 2.5']):
        intent.query_type = 'goals'
    elif any(kw in lower for kw in ['shot', 'shots', 'corner', 'corners', 'card', 'cards',
                                     'foul', 'fouls', 'yellow', 'red card']):
        intent.query_type = 'stats'
        if 'shot' in lower:
            intent.stat_type = 'shots'
        elif 'corner' in lower:
            intent.stat_type = 'corners'
        elif any(kw in lower for kw in ['card', 'yellow', 'red']):
            intent.stat_type = 'cards'
        elif 'foul' in lower:
            intent.stat_type = 'fouls'
    elif any(kw in lower for kw in ['form', 'recent', 'run of', 'streak', 'last few',
                                     'momentum', 'how are', 'how is', 'how have']):
        intent.query_type = 'form'
    elif any(kw in lower for kw in ['season', 'this year', 'campaign', 'table', 'standing',
                                     'standings', 'league table', 'position']):
        intent.query_type = 'season'
    elif (any(kw in lower for kw in ['predict', 'prediction', 'who will win', 'who wins',
                                      'chances', 'likely', 'probability', 'odds',
                                      'will they win', 'can they win', 'can they beat'])
          or ('will' in lower and 'win' in lower)):
        intent.query_type = 'prediction'

    # Detect "last N"
    last_n_match = re.search(r'last\s+(\d+)', lower)
    if last_n_match:
        intent.last_n = min(int(last_n_match.group(1)), 20)

    # Detect season (e.g. "2023/24", "2024-25", "2024")
    season_match = re.search(r'20(\d{2})[/-]?(\d{2})', lower)
    if season_match:
        intent.season = f"20{season_match.group(1)}"

    return intent


# ---------------------------------------------------------------------------
# DataFrame query functions
# ---------------------------------------------------------------------------

def query_dataframe(df: pd.DataFrame, intent: QueryIntent) -> str:
    """Query the match DataFrame based on parsed intent. Returns markdown context."""
    sections: list[str] = []

    # Player queries can work even without match data
    if intent.query_type == 'player':
        sections.extend(_query_player_data(intent))
        # Also add team form if teams were mentioned alongside player queries
        if df is not None and not df.empty and intent.teams:
            for team in intent.teams[:2]:
                sections.append(_query_form(df, team, 5))
        if sections:
            return "\n\n".join(s for s in sections if s)

    if df is None or df.empty:
        return ""

    if intent.query_type == 'h2h' and len(intent.teams) >= 2:
        sections.append(_query_h2h(df, intent.teams[0], intent.teams[1], intent.last_n or 10))

    elif intent.query_type == 'form':
        for team in intent.teams[:2]:
            sections.append(_query_form(df, team, intent.last_n or 5))

    elif intent.query_type == 'goals':
        for team in intent.teams[:2]:
            sections.append(_query_goals(df, team, intent.last_n or 10))

    elif intent.query_type == 'draws':
        if intent.teams:
            for team in intent.teams[:2]:
                sections.append(_query_draws(df, team, intent.last_n or 10))
        else:
            sections.append(_query_draw_trends(df))

    elif intent.query_type == 'stats' and intent.teams:
        for team in intent.teams[:2]:
            sections.append(_query_stats(df, team, intent.stat_type or 'shots', intent.last_n or 10))

    elif intent.query_type == 'season':
        sections.append(_query_season_table(df, intent.season, intent.teams))

    elif intent.query_type == 'prediction' and intent.teams:
        for team in intent.teams[:2]:
            sections.append(_query_form(df, team, 5))
        if len(intent.teams) >= 2:
            sections.append(_query_h2h(df, intent.teams[0], intent.teams[1], 5))

    # Fallback: if we have teams but nothing matched, show form + H2H
    if not sections and intent.teams:
        for team in intent.teams[:2]:
            sections.append(_query_form(df, team, 5))
        if len(intent.teams) >= 2:
            sections.append(_query_h2h(df, intent.teams[0], intent.teams[1], 5))

    return "\n\n".join(s for s in sections if s)


def _team_matches(df: pd.DataFrame, team: str) -> pd.DataFrame:
    """Get all matches involving a team, sorted by date descending."""
    mask = (df['home_team'] == team) | (df['away_team'] == team)
    matches = df.loc[mask].copy()
    if 'date' in matches.columns:
        matches = matches.sort_values('date', ascending=False)
    return matches


def _query_h2h(df: pd.DataFrame, team1: str, team2: str, n: int = 10) -> str:
    """Head-to-head record between two teams."""
    h2h = df[
        ((df['home_team'] == team1) & (df['away_team'] == team2)) |
        ((df['home_team'] == team2) & (df['away_team'] == team1))
    ].copy()

    if h2h.empty:
        return f"No head-to-head data found for {team1} vs {team2}."

    if 'date' in h2h.columns:
        h2h = h2h.sort_values('date', ascending=False)

    recent = h2h.head(n)

    t1_wins = t2_wins = draws = 0
    t1_goals = t2_goals = 0

    for _, row in h2h.iterrows():
        hg = int(row.get('home_goals', 0))
        ag = int(row.get('away_goals', 0))
        if row['home_team'] == team1:
            t1_goals += hg
            t2_goals += ag
            if row.get('result') == 'H':
                t1_wins += 1
            elif row.get('result') == 'A':
                t2_wins += 1
            else:
                draws += 1
        else:
            t2_goals += hg
            t1_goals += ag
            if row.get('result') == 'H':
                t2_wins += 1
            elif row.get('result') == 'A':
                t1_wins += 1
            else:
                draws += 1

    lines = [f"**{team1} vs {team2} — Head-to-Head ({len(h2h)} matches)**"]
    lines.append(f"Record: {team1} {t1_wins}W, Draws {draws}, {team2} {t2_wins}W")
    lines.append(f"Goals: {team1} {t1_goals} — {team2} {t2_goals}")
    lines.append("")
    lines.append(f"Last {len(recent)} meetings:")
    lines.append("| Date | Home | Score | Away |")
    lines.append("|------|------|-------|------|")

    for _, row in recent.iterrows():
        date_str = _format_date(row.get('date'))
        score = f"{int(row.get('home_goals', 0))}-{int(row.get('away_goals', 0))}"
        lines.append(f"| {date_str} | {row['home_team']} | {score} | {row['away_team']} |")

    return "\n".join(lines)


def _query_form(df: pd.DataFrame, team: str, n: int = 5) -> str:
    """Recent form for a team."""
    matches = _team_matches(df, team).head(n)

    if matches.empty:
        return f"No recent data for {team}."

    results: list[str] = []
    goals_scored = 0
    goals_conceded = 0

    for _, row in matches.iterrows():
        hg = int(row.get('home_goals', 0))
        ag = int(row.get('away_goals', 0))
        if row['home_team'] == team:
            goals_scored += hg
            goals_conceded += ag
            r = 'W' if row.get('result') == 'H' else ('L' if row.get('result') == 'A' else 'D')
        else:
            goals_scored += ag
            goals_conceded += hg
            r = 'W' if row.get('result') == 'A' else ('L' if row.get('result') == 'H' else 'D')
        results.append(r)

    form_str = ''.join(results)
    wins = results.count('W')
    draws = results.count('D')
    losses = results.count('L')

    lines = [f"**{team} — Last {len(matches)} Matches**"]
    lines.append(f"Form: {form_str} ({wins}W {draws}D {losses}L)")
    lines.append(f"Goals: {goals_scored} scored, {goals_conceded} conceded")
    lines.append("")
    lines.append("| Date | Opponent | H/A | Result | Score |")
    lines.append("|------|----------|-----|--------|-------|")

    for _, row in matches.iterrows():
        date_str = _format_date(row.get('date'))
        hg = int(row.get('home_goals', 0))
        ag = int(row.get('away_goals', 0))
        if row['home_team'] == team:
            opponent = row['away_team']
            venue = 'H'
            score = f"{hg}-{ag}"
            res = 'W' if row.get('result') == 'H' else ('L' if row.get('result') == 'A' else 'D')
        else:
            opponent = row['home_team']
            venue = 'A'
            score = f"{ag}-{hg}"
            res = 'W' if row.get('result') == 'A' else ('L' if row.get('result') == 'H' else 'D')
        lines.append(f"| {date_str} | {opponent} | {venue} | {res} | {score} |")

    return "\n".join(lines)


def _query_goals(df: pd.DataFrame, team: str, n: int = 10) -> str:
    """Goal statistics for a team."""
    matches = _team_matches(df, team).head(n)

    if matches.empty:
        return f"No goal data for {team}."

    goals_scored: list[int] = []
    goals_conceded: list[int] = []

    for _, row in matches.iterrows():
        hg = int(row.get('home_goals', 0))
        ag = int(row.get('away_goals', 0))
        if row['home_team'] == team:
            goals_scored.append(hg)
            goals_conceded.append(ag)
        else:
            goals_scored.append(ag)
            goals_conceded.append(hg)

    clean_sheets = sum(1 for gc in goals_conceded if gc == 0)
    over_25 = sum(1 for gs, gc in zip(goals_scored, goals_conceded) if gs + gc > 2.5)
    btts = sum(1 for gs, gc in zip(goals_scored, goals_conceded) if gs > 0 and gc > 0)
    total = len(matches)
    avg_scored = sum(goals_scored) / total
    avg_conceded = sum(goals_conceded) / total

    lines = [f"**{team} — Goal Stats (Last {total} Matches)**"]
    lines.append(f"Total: {sum(goals_scored)} scored, {sum(goals_conceded)} conceded")
    lines.append(f"Average: {avg_scored:.1f} scored, {avg_conceded:.1f} conceded per match")
    lines.append(f"Clean sheets: {clean_sheets}/{total}")
    lines.append(f"Over 2.5 goals: {over_25}/{total} ({over_25 / total * 100:.0f}%)")
    lines.append(f"BTTS: {btts}/{total} ({btts / total * 100:.0f}%)")

    return "\n".join(lines)


def _query_draws(df: pd.DataFrame, team: str, n: int = 10) -> str:
    """Draw statistics for a team."""
    matches = _team_matches(df, team).head(n)

    if matches.empty:
        return f"No draw data for {team}."

    draws = matches[matches['result'] == 'D']
    draw_rate = len(draws) / len(matches) * 100

    lines = [f"**{team} — Draw Stats (Last {len(matches)} Matches)**"]
    lines.append(f"Draws: {len(draws)}/{len(matches)} ({draw_rate:.0f}%)")

    if not draws.empty:
        lines.append("")
        lines.append("Drawn matches:")
        lines.append("| Date | Home | Score | Away |")
        lines.append("|------|------|-------|------|")
        for _, row in draws.head(5).iterrows():
            date_str = _format_date(row.get('date'))
            score = f"{int(row.get('home_goals', 0))}-{int(row.get('away_goals', 0))}"
            lines.append(f"| {date_str} | {row['home_team']} | {score} | {row['away_team']} |")

    return "\n".join(lines)


def _query_draw_trends(df: pd.DataFrame) -> str:
    """League-wide draw trends by season."""
    if 'season' not in df.columns or df.empty:
        return "No draw trend data available."

    lines = ["**Premier League Draw Trends by Season**"]

    for season in sorted(df['season'].unique()):
        season_df = df[df['season'] == season]
        total = len(season_df)
        draws = len(season_df[season_df['result'] == 'D'])
        rate = draws / total * 100 if total > 0 else 0
        lines.append(f"  {season}: {draws}/{total} draws ({rate:.1f}%)")

    # Overall
    total_all = len(df)
    draws_all = len(df[df['result'] == 'D'])
    overall_rate = draws_all / total_all * 100 if total_all > 0 else 0
    lines.append(f"  Overall: {draws_all}/{total_all} ({overall_rate:.1f}%)")

    return "\n".join(lines)


def _query_stats(df: pd.DataFrame, team: str, stat_type: str, n: int = 10) -> str:
    """Match statistics (shots, corners, cards, fouls) for a team."""
    matches = _team_matches(df, team).head(n)

    if matches.empty:
        return f"No stats data for {team}."

    col_map = {
        'shots': [('home_shots', 'away_shots'), ('home_shots_target', 'away_shots_target')],
        'corners': [('home_corners', 'away_corners')],
        'cards': [('home_yellows', 'away_yellows'), ('home_reds', 'away_reds')],
        'fouls': [('home_fouls', 'away_fouls')],
    }

    pairs = col_map.get(stat_type, col_map['shots'])

    # Check data availability
    flat_cols = [c for pair in pairs for c in pair]
    available = [c for c in flat_cols if c in matches.columns and matches[c].notna().any()]
    if not available:
        return f"No {stat_type} data available for {team} (CSV stats columns may be missing)."

    lines = [f"**{team} — {stat_type.title()} Stats (Last {len(matches)} Matches)**"]

    def _team_vals(row: pd.Series, home_col: str, away_col: str) -> float:
        if row['home_team'] == team:
            return float(row.get(home_col, 0) or 0)
        return float(row.get(away_col, 0) or 0)

    if stat_type == 'shots':
        shots = [_team_vals(r, 'home_shots', 'away_shots') for _, r in matches.iterrows()]
        sot = [_team_vals(r, 'home_shots_target', 'away_shots_target') for _, r in matches.iterrows()]
        avg_s = sum(shots) / len(shots)
        avg_sot = sum(sot) / len(sot)
        lines.append(f"Average shots: {avg_s:.1f} per match")
        lines.append(f"Average shots on target: {avg_sot:.1f} per match")
        if avg_s > 0:
            lines.append(f"Shot accuracy: {avg_sot / avg_s * 100:.0f}%")

    elif stat_type == 'corners':
        vals = [_team_vals(r, 'home_corners', 'away_corners') for _, r in matches.iterrows()]
        avg_c = sum(vals) / len(vals)
        lines.append(f"Average corners: {avg_c:.1f} per match")
        lines.append(f"Total corners: {int(sum(vals))} in {len(matches)} matches")

    elif stat_type == 'cards':
        yellows = [_team_vals(r, 'home_yellows', 'away_yellows') for _, r in matches.iterrows()]
        reds = [_team_vals(r, 'home_reds', 'away_reds') for _, r in matches.iterrows()]
        lines.append(f"Average yellow cards: {sum(yellows) / len(yellows):.1f} per match")
        lines.append(f"Average red cards: {sum(reds) / len(reds):.2f} per match")
        lines.append(f"Total: {int(sum(yellows))} yellows, {int(sum(reds))} reds in {len(matches)} matches")

    elif stat_type == 'fouls':
        vals = [_team_vals(r, 'home_fouls', 'away_fouls') for _, r in matches.iterrows()]
        avg_f = sum(vals) / len(vals)
        lines.append(f"Average fouls: {avg_f:.1f} per match")
        lines.append(f"Total fouls: {int(sum(vals))} in {len(matches)} matches")

    return "\n".join(lines)


def _query_season_table(df: pd.DataFrame, season: str | None, teams: list[str]) -> str:
    """Season standings computed from match data."""
    if season and 'season' in df.columns:
        season_df = df[df['season'] == season]
    elif 'season' in df.columns and not df.empty:
        season = str(df['season'].max())
        season_df = df[df['season'] == season]
    else:
        season_df = df
        season = 'all'

    if season_df.empty:
        return f"No data for season {season}."

    # Build standings table from match results
    table: dict[str, dict[str, int]] = {}
    all_teams = set(season_df['home_team'].unique()) | set(season_df['away_team'].unique())

    for team in all_teams:
        table[team] = {'played': 0, 'won': 0, 'drawn': 0, 'lost': 0, 'gf': 0, 'ga': 0, 'points': 0}

    for _, row in season_df.iterrows():
        ht = row['home_team']
        at = row['away_team']
        hg = int(row.get('home_goals', 0))
        ag = int(row.get('away_goals', 0))

        table[ht]['played'] += 1
        table[at]['played'] += 1
        table[ht]['gf'] += hg
        table[ht]['ga'] += ag
        table[at]['gf'] += ag
        table[at]['ga'] += hg

        if row.get('result') == 'H':
            table[ht]['won'] += 1
            table[ht]['points'] += 3
            table[at]['lost'] += 1
        elif row.get('result') == 'A':
            table[at]['won'] += 1
            table[at]['points'] += 3
            table[ht]['lost'] += 1
        else:
            table[ht]['drawn'] += 1
            table[at]['drawn'] += 1
            table[ht]['points'] += 1
            table[at]['points'] += 1

    sorted_teams = sorted(
        table.items(),
        key=lambda x: (x[1]['points'], x[1]['gf'] - x[1]['ga'], x[1]['gf']),
        reverse=True,
    )

    # If specific teams requested, show their neighbourhood (±2 positions)
    if teams:
        team_positions = {t: i for i, (t, _) in enumerate(sorted_teams)}
        show_positions: set[int] = set()
        for team in teams:
            if team in team_positions:
                pos = team_positions[team]
                for p in range(max(0, pos - 2), min(len(sorted_teams), pos + 3)):
                    show_positions.add(p)
        filtered = [(i, t, s) for i, (t, s) in enumerate(sorted_teams) if i in show_positions]
    else:
        filtered = [(i, t, s) for i, (t, s) in enumerate(sorted_teams)]

    lines = [f"**Season {season} Standings**"]
    lines.append("| # | Team | P | W | D | L | GF | GA | GD | Pts |")
    lines.append("|---|------|---|---|---|---|----|----|-----|-----|")

    for pos, team, stats in filtered[:20]:
        gd = stats['gf'] - stats['ga']
        gd_str = f"+{gd}" if gd > 0 else str(gd)
        lines.append(
            f"| {pos + 1} | {team} | {stats['played']} | {stats['won']} "
            f"| {stats['drawn']} | {stats['lost']} | {stats['gf']} "
            f"| {stats['ga']} | {gd_str} | {stats['points']} |"
        )

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Player query functions
# ---------------------------------------------------------------------------

def _query_player_data(intent: QueryIntent) -> list[str]:
    """Query player data based on intent. Returns list of markdown sections."""
    sections: list[str] = []

    if intent.players:
        # Specific player lookup
        for player_name in intent.players[:3]:
            section = _query_player_profile(player_name, intent.teams)
            if section:
                sections.append(section)
    elif intent.teams:
        # Team-scoped: show that team's top players
        for team in intent.teams[:2]:
            section = _query_team_players(team)
            if section:
                sections.append(section)
    else:
        # Generic top scorers
        section = _query_top_scorers()
        if section:
            sections.append(section)

    return sections


def _query_player_profile(player_name: str, teams: list[str]) -> str:
    """Build a profile for a specific player from available data sources."""
    lines: list[str] = []

    # Search CSV data first (richer: xG, per-90 metrics)
    if not _PLAYER_STATS.empty and 'name' in _PLAYER_STATS.columns:
        name_lower = player_name.lower()
        matches = _PLAYER_STATS[_PLAYER_STATS['name'].str.lower() == name_lower]

        # Fallback: surname match
        if matches.empty:
            parts = player_name.split()
            if parts:
                surname = parts[-1].lower()
                matches = _PLAYER_STATS[
                    _PLAYER_STATS['name'].str.lower().str.endswith(surname)
                ]

        if not matches.empty:
            row = matches.iloc[0]
            lines.append(f"**{row['name']}** — Player Profile (CSV Data)")
            if 'position' in row and pd.notna(row['position']):
                lines.append(f"Position: {row['position']}")
            if 'minutes_played' in row and pd.notna(row['minutes_played']):
                lines.append(f"Minutes played: {int(row['minutes_played'])}")
            if 'goals' in row and pd.notna(row['goals']):
                lines.append(f"Goals: {int(row['goals'])}")
            if 'assists' in row and pd.notna(row['assists']):
                lines.append(f"Assists: {int(row['assists'])}")
            if 'expected_goals' in row and pd.notna(row['expected_goals']):
                lines.append(f"Expected goals (xG): {row['expected_goals']:.2f}")
            if 'goals_per90' in row and pd.notna(row['goals_per90']):
                lines.append(f"Goals per 90: {row['goals_per90']:.2f}")
            if 'assists_per90' in row and pd.notna(row['assists_per90']):
                lines.append(f"Assists per 90: {row['assists_per90']:.2f}")
            if 'goals_minus_xg' in row and pd.notna(row['goals_minus_xg']):
                diff = row['goals_minus_xg']
                sign = '+' if diff > 0 else ''
                lines.append(f"Goals minus xG: {sign}{diff:.2f}")
            return "\n".join(lines)

    # Fall back to API scorer data
    if not _API_SCORERS.empty and 'name' in _API_SCORERS.columns:
        name_lower = player_name.lower()
        matches = _API_SCORERS[_API_SCORERS['name'].str.lower() == name_lower]

        if matches.empty:
            parts = player_name.split()
            if parts:
                surname = parts[-1].lower()
                matches = _API_SCORERS[
                    _API_SCORERS['name'].str.lower().str.endswith(surname)
                ]

        if not matches.empty:
            row = matches.iloc[0]
            lines.append(f"**{row['name']}** — Player Profile (Current Season)")
            lines.append(f"Team: {row['team']}")
            lines.append(f"Goals: {row['goals']}")
            if row.get('assists', 0):
                lines.append(f"Assists: {row['assists']}")
            if row.get('penalties', 0):
                lines.append(f"Penalties: {row['penalties']}")
            if row.get('matches_played', 0):
                lines.append(f"Matches played: {row['matches_played']}")
            return "\n".join(lines)

    return f"No player data found for {player_name}."


def _query_team_players(team: str) -> str:
    """Show top players for a team from available data."""
    lines: list[str] = []

    # Try CSV data first
    if not _PLAYER_STATS.empty and 'name' in _PLAYER_STATS.columns:
        # The CSV doesn't have a 'team' column — match by checking API scorers
        pass

    # Use API scorer data (has team column)
    if not _API_SCORERS.empty and 'team' in _API_SCORERS.columns:
        # Match team name loosely (API uses full names like "Arsenal FC")
        team_lower = team.lower()
        team_players = _API_SCORERS[
            _API_SCORERS['team'].str.lower().str.contains(team_lower, na=False)
        ].sort_values('goals', ascending=False)

        if not team_players.empty:
            lines.append(f"**{team} — Top Scorers (Current Season)**")
            lines.append("| Player | Goals | Assists | Penalties | Played |")
            lines.append("|--------|-------|---------|-----------|--------|")
            for _, row in team_players.head(5).iterrows():
                lines.append(
                    f"| {row['name']} | {row['goals']} | {row.get('assists', 0)} "
                    f"| {row.get('penalties', 0)} | {row.get('matches_played', '-')} |"
                )
            return "\n".join(lines)

    return ""


def _query_top_scorers(n: int = 15) -> str:
    """Show league-wide top scorers from available data."""
    lines: list[str] = []

    # Prefer API scorers (current season, official)
    if not _API_SCORERS.empty:
        lines.append("**Premier League Top Scorers (Current Season)**")
        lines.append("| # | Player | Team | Goals | Assists | Played |")
        lines.append("|---|--------|------|-------|---------|--------|")
        for i, (_, row) in enumerate(_API_SCORERS.head(n).iterrows(), 1):
            lines.append(
                f"| {i} | {row['name']} | {row['team']} | {row['goals']} "
                f"| {row.get('assists', 0)} | {row.get('matches_played', '-')} |"
            )
        return "\n".join(lines)

    # Fall back to CSV data
    if not _PLAYER_STATS.empty and 'goals' in _PLAYER_STATS.columns:
        top = _PLAYER_STATS.nlargest(n, 'goals')
        lines.append("**Premier League Top Scorers (Historical CSV)**")
        lines.append("| # | Player | Goals | Assists | xG | Per 90 |")
        lines.append("|---|--------|-------|---------|-----|--------|")
        for i, (_, row) in enumerate(top.iterrows(), 1):
            xg = f"{row['expected_goals']:.1f}" if pd.notna(row.get('expected_goals')) else '-'
            per90 = f"{row['goals_per90']:.2f}" if pd.notna(row.get('goals_per90')) else '-'
            assists = int(row['assists']) if pd.notna(row.get('assists')) else 0
            lines.append(
                f"| {i} | {row['name']} | {int(row['goals'])} "
                f"| {assists} | {xg} | {per90} |"
            )
        return "\n".join(lines)

    return "No player data available."


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _format_date(date_val: object) -> str:
    """Format a date value for display."""
    if pd.isna(date_val):
        return "—"
    try:
        if isinstance(date_val, str):
            date_val = pd.to_datetime(date_val)
        return date_val.strftime('%d %b %Y')  # type: ignore[union-attr]
    except Exception:
        return str(date_val)[:10]


def build_rag_prompt(
    df: pd.DataFrame | None,
    user_message: str,
) -> tuple[str, bool]:
    """Build a data-grounded system prompt for Oracle Chat.

    Returns (system_prompt, has_data_context) so the caller knows
    whether relevant match data was found and injected.
    """
    intent = parse_intent(user_message)

    # Query match DataFrame + player data for relevant context
    data_context = query_dataframe(df, intent)
    total_matches = 0
    seasons: list[str] = []

    if df is not None and not df.empty:
        total_matches = len(df)
        if 'season' in df.columns:
            seasons = sorted(df['season'].unique())

    # Count available player records for the persona prompt
    player_count = len(_PLAYER_STATS) + len(_API_SCORERS)

    prompt = (
        "You are the Premier League Oracle, an expert football analyst with access to "
        "historical Premier League match data"
    )
    if player_count > 0:
        prompt += " and player statistics"
    prompt += (
        ".\n"
        "You provide insightful, data-driven analysis for Premier League matches. Use UK English.\n"
        "Be concise and confident. Reference the data provided below when answering.\n"
        "Never give financial advice — only discuss statistical probabilities.\n"
        "Format responses with markdown: use **bold** for emphasis, bullet points for lists, "
        "and `code` for statistics.\n\n"
    )

    if total_matches > 0:
        prompt += f"You have access to {total_matches} historical Premier League matches"
        if seasons:
            prompt += f" spanning seasons {seasons[0]}–{seasons[-1]}"
        prompt += ".\n"
    if player_count > 0:
        prompt += f"You also have data on {player_count} player records with goals, assists, and performance metrics.\n"
    if total_matches > 0 or player_count > 0:
        prompt += "\n"

    if data_context:
        prompt += "RELEVANT DATA:\n\n"
        prompt += data_context
        prompt += "\n\nUse the data above to ground your response. "
        prompt += "Cite specific numbers from the data when possible.\n"
    else:
        prompt += (
            "No specific match data was retrieved for this query. "
            "Provide general Premier League analysis based on your knowledge, "
            "but note that you are not referencing specific match data.\n"
        )

    return prompt, bool(data_context)
