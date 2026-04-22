/**
 * Client-side access to the 33-season completed-match index bundled in
 * `completedMatches.json`. The Oracle Chat uses these helpers to ground
 * historical queries (e.g. "Liverpool's away wins in 2023/24") without
 * requiring a running Python backend.
 *
 * The JSON uses abbreviated keys (`s`, `d`, `h`, `a`, `hg`, `ag`, `r`) to
 * keep bundle size down; this module expands them into a readable shape
 * at the public API surface. Consumers should never touch the raw JSON
 * directly — go through the helpers below.
 *
 * All helpers normalise team names via `canonicalTeam()` (from
 * `statsPack.ts`) so API-style names like "Liverpool FC" resolve to the
 * CSV's "Liverpool" before filtering.
 */

import rawMatches from './completedMatches.json';
import { canonicalTeam } from './statsPack';

interface RawCompletedMatch {
  s: string;   // season, e.g. "2023/24"
  d: string;   // ISO date, YYYY-MM-DD
  h: string;   // home team (CSV-canonical name)
  a: string;   // away team (CSV-canonical name)
  hg: number;  // full-time home goals
  ag: number;  // full-time away goals
  r: 'H' | 'D' | 'A';
}

export interface CompletedMatch {
  season: string;
  date: string;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  result: 'H' | 'D' | 'A';
}

const MATCHES: readonly RawCompletedMatch[] = rawMatches as RawCompletedMatch[];

function expand(raw: RawCompletedMatch): CompletedMatch {
  return {
    season: raw.s,
    date: raw.d,
    home: raw.h,
    away: raw.a,
    homeGoals: raw.hg,
    awayGoals: raw.ag,
    result: raw.r,
  };
}

/**
 * Matches played by a specific team, optionally filtered by season,
 * venue (home / away), or outcome from that team's perspective (W / D / L).
 */
export function getMatchesForTeam(
  team: string,
  opts: { season?: string; venue?: 'home' | 'away'; result?: 'W' | 'D' | 'L' } = {},
): CompletedMatch[] {
  const canonical = canonicalTeam(team);
  const { season, venue, result } = opts;

  const rows = MATCHES.filter((m) => {
    if (season && m.s !== season) return false;

    const isHome = m.h === canonical;
    const isAway = m.a === canonical;
    if (!isHome && !isAway) return false;
    if (venue === 'home' && !isHome) return false;
    if (venue === 'away' && !isAway) return false;

    if (result) {
      const won = (isHome && m.r === 'H') || (isAway && m.r === 'A');
      const drew = m.r === 'D';
      const lost = (isHome && m.r === 'A') || (isAway && m.r === 'H');
      if (result === 'W' && !won) return false;
      if (result === 'D' && !drew) return false;
      if (result === 'L' && !lost) return false;
    }

    return true;
  });

  return rows.map(expand);
}

/**
 * Head-to-head meetings between two teams. Order-agnostic — matches with
 * `teamA` at home OR away are both returned. Defaults to most-recent-first.
 * Pass `limit` to cap the number of returned rows.
 */
export function getHeadToHead(
  teamA: string,
  teamB: string,
  opts: { season?: string; limit?: number } = {},
): CompletedMatch[] {
  const a = canonicalTeam(teamA);
  const b = canonicalTeam(teamB);
  const { season, limit } = opts;

  const rows = MATCHES.filter((m) => {
    if (season && m.s !== season) return false;
    return (m.h === a && m.a === b) || (m.h === b && m.a === a);
  });

  // Most recent first — the JSON is stored oldest-first for deterministic
  // builds, so reverse here rather than changing the on-disk order.
  rows.sort((x, y) => (x.d < y.d ? 1 : x.d > y.d ? -1 : 0));
  const sliced = typeof limit === 'number' ? rows.slice(0, limit) : rows;
  return sliced.map(expand);
}

/** Every completed match in a season, ordered earliest-first. */
export function getSeasonMatches(season: string): CompletedMatch[] {
  return MATCHES.filter((m) => m.s === season).map(expand);
}

/**
 * Aggregate summary for a team's season — played, wins, draws, losses,
 * goals scored, goals conceded. Returns null if the team didn't feature
 * in that season (e.g. Championship clubs in a pre-promotion year).
 */
export function getTeamSeasonSummary(
  team: string,
  season: string,
): { played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number } | null {
  const canonical = canonicalTeam(team);
  const rows = MATCHES.filter(
    (m) => m.s === season && (m.h === canonical || m.a === canonical),
  );
  if (rows.length === 0) return null;

  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
  for (const m of rows) {
    const isHome = m.h === canonical;
    const teamScored = isHome ? m.hg : m.ag;
    const teamConceded = isHome ? m.ag : m.hg;
    goalsFor += teamScored;
    goalsAgainst += teamConceded;
    if (m.r === 'D') draws++;
    else if ((isHome && m.r === 'H') || (!isHome && m.r === 'A')) wins++;
    else losses++;
  }

  return { played: rows.length, wins, draws, losses, goalsFor, goalsAgainst };
}

/** Low-level: total match count in the bundle (useful for diagnostics). */
export function getTotalMatchCount(): number {
  return MATCHES.length;
}

/** Low-level: sorted list of every season present in the bundle. */
export function getAllSeasons(): string[] {
  const seen = new Set<string>();
  for (const m of MATCHES) seen.add(m.s);
  return Array.from(seen).sort();
}
