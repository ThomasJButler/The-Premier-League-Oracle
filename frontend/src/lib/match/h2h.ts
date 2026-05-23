import type { Match } from '../../types';

export interface H2HMeeting {
  id: string;
  date: string;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  /** Winner relative to the *queried* pairing — 'home' = first-arg team won. */
  winner: 'home' | 'away' | 'draw';
}

/**
 * Walk `matches` for prior completed meetings between `teamA` and `teamB`,
 * strictly before `beforeDate`, newest-first, capped at `limit`.
 *
 * Pairing order matters: `winner` is reported relative to `teamA`. That makes
 * the result safe to feed straight into UI like "Arsenal 3 wins, Liverpool 1
 * win" without callers having to re-pivot the comparison.
 */
export function recentH2H(
  matches: Match[],
  teamA: string,
  teamB: string,
  beforeDate: string,
  limit = 5,
): H2HMeeting[] {
  const cutoff = new Date(beforeDate).getTime();
  if (!Number.isFinite(cutoff)) return [];

  return matches
    .filter((m) => {
      if (m.home_goals === null || m.away_goals === null) return false;
      const isMeeting =
        (m.home_team === teamA && m.away_team === teamB) ||
        (m.home_team === teamB && m.away_team === teamA);
      if (!isMeeting) return false;
      const t = new Date(m.date).getTime();
      return Number.isFinite(t) && t < cutoff;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
    .map((m) => {
      const homeGoals = m.home_goals as number;
      const awayGoals = m.away_goals as number;
      let winner: H2HMeeting['winner'];
      if (homeGoals === awayGoals) winner = 'draw';
      else {
        const homeWon = homeGoals > awayGoals;
        const homeIsTeamA = m.home_team === teamA;
        winner = homeWon === homeIsTeamA ? 'home' : 'away';
      }
      return {
        id: m.id,
        date: m.date,
        home: m.home_team,
        away: m.away_team,
        homeGoals,
        awayGoals,
        winner,
      };
    });
}
