import type { Match } from '../../types';

export interface DerivedStandingRow {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface Accumulator {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function blank(): Accumulator {
  return { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

export function deriveStandings(matches: Match[], topN: number = 6): DerivedStandingRow[] {
  if (matches.length === 0) return [];

  const table = new Map<string, Accumulator>();

  function row(team: string): Accumulator {
    if (!table.has(team)) table.set(team, blank());
    return table.get(team)!;
  }

  for (const m of matches) {
    if (m.result === null || m.home_goals === null || m.away_goals === null) continue;

    const home = row(m.home_team);
    const away = row(m.away_team);

    home.played++;
    away.played++;
    home.goalsFor += m.home_goals;
    home.goalsAgainst += m.away_goals;
    away.goalsFor += m.away_goals;
    away.goalsAgainst += m.home_goals;

    if (m.result === 'H') {
      home.won++;   home.points += 3;
      away.lost++;
    } else if (m.result === 'A') {
      away.won++;   away.points += 3;
      home.lost++;
    } else {
      home.drawn++; home.points += 1;
      away.drawn++; away.points += 1;
    }
  }

  const sorted = [...table.entries()]
    .map(([team, s]) => ({ team, ...s, goalDifference: s.goalsFor - s.goalsAgainst }))
    .sort((a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.team.localeCompare(b.team)
    )
    .slice(0, topN);

  return sorted.map((r, i) => ({ position: i + 1, ...r }));
}
