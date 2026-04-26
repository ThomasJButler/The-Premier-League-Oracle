import type { Match } from '../types';

/**
 * Find the current gameweek number from a list of season matches.
 *
 * Returns the matchday of the next non-FINISHED fixture (chronologically
 * earliest), or `null` if every match is finished or no matches have a
 * matchday set.
 */
export function findCurrentGameweek(matches: Match[]): number | null {
  const upcoming = matches
    .filter((m) => m.status !== 'FINISHED' && typeof m.matchday === 'number')
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  return upcoming.length > 0 ? (upcoming[0].matchday as number) : null;
}

/**
 * Filter matches to a given gameweek's not-yet-played fixtures, sorted by
 * kickoff time. Used by Today's predictions grid.
 */
export function fixturesForGameweek(matches: Match[], matchday: number): Match[] {
  return matches
    .filter((m) => m.matchday === matchday && m.status !== 'FINISHED')
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

/**
 * Earliest upcoming match (any matchday). Used to pick Today's hero fixture.
 */
export function nextKickoff(matches: Match[]): Match | null {
  const upcoming = matches
    .filter((m) => m.status !== 'FINISHED')
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  return upcoming[0] ?? null;
}
