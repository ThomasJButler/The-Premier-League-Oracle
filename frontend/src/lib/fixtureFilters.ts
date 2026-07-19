import type { Match, Standing } from '../types';

/**
 * Team names sitting in the top eight of the table.
 *
 * This is the broadcast-marquee heuristic (both sides in the top eight)
 * standing in until real TV listings data exists. Deliberately distinct
 * from TOP 6 (fixtures/+page.svelte), which matches either side being
 * top-6 — TV PICKS is stricter: it requires BOTH sides to be top-8.
 */
export function tvTeamsFrom(standings: Standing[]): string[] {
  return standings.filter((s) => s.position <= 8).map((s) => s.team.name);
}

/**
 * True only when both the home and away side are in the TV-picks team list.
 */
export function isTvPick(match: Match, tvTeams: string[]): boolean {
  return tvTeams.includes(match.home_team) && tvTeams.includes(match.away_team);
}
