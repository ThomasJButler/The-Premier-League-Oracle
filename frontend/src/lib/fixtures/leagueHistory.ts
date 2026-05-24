// Static Premier League champions (1993/94 -> 2025/26) for the Insights archive.
// Bundled with the app: zero-runtime, immune to API outages. Mirrors the season
// list emitted by the backend stats-pack generator (`statsPack.seasons`).

export interface SeasonRecord {
  season: string;
  champion: { team: string; points: number; goalDifference: number } | null;
  runnerUp: { team: string; points: number } | null;
  inProgress?: boolean;
}

export const LEAGUE_HISTORY: readonly SeasonRecord[] = [
  { season: '1993/94', champion: { team: 'Manchester United', points: 92, goalDifference: 46 }, runnerUp: { team: 'Blackburn Rovers', points: 84 } },
  { season: '1994/95', champion: { team: 'Blackburn Rovers', points: 89, goalDifference: 41 }, runnerUp: { team: 'Manchester United', points: 88 } },
  { season: '1995/96', champion: { team: 'Manchester United', points: 82, goalDifference: 38 }, runnerUp: { team: 'Newcastle United', points: 78 } },
  { season: '1996/97', champion: { team: 'Manchester United', points: 75, goalDifference: 32 }, runnerUp: { team: 'Newcastle United', points: 68 } },
  { season: '1997/98', champion: { team: 'Arsenal', points: 78, goalDifference: 35 }, runnerUp: { team: 'Manchester United', points: 77 } },
  { season: '1998/99', champion: { team: 'Manchester United', points: 79, goalDifference: 37 }, runnerUp: { team: 'Arsenal', points: 78 } },
  { season: '1999/00', champion: { team: 'Manchester United', points: 91, goalDifference: 52 }, runnerUp: { team: 'Arsenal', points: 73 } },
  { season: '2000/01', champion: { team: 'Manchester United', points: 80, goalDifference: 48 }, runnerUp: { team: 'Arsenal', points: 70 } },
  { season: '2001/02', champion: { team: 'Arsenal', points: 87, goalDifference: 43 }, runnerUp: { team: 'Liverpool', points: 80 } },
  { season: '2002/03', champion: { team: 'Manchester United', points: 83, goalDifference: 40 }, runnerUp: { team: 'Arsenal', points: 78 } },
  { season: '2003/04', champion: { team: 'Arsenal', points: 90, goalDifference: 47 }, runnerUp: { team: 'Chelsea', points: 79 } },
  { season: '2004/05', champion: { team: 'Chelsea', points: 95, goalDifference: 57 }, runnerUp: { team: 'Arsenal', points: 83 } },
  { season: '2005/06', champion: { team: 'Chelsea', points: 91, goalDifference: 50 }, runnerUp: { team: 'Manchester United', points: 83 } },
  { season: '2006/07', champion: { team: 'Manchester United', points: 89, goalDifference: 56 }, runnerUp: { team: 'Chelsea', points: 83 } },
  { season: '2007/08', champion: { team: 'Manchester United', points: 87, goalDifference: 58 }, runnerUp: { team: 'Chelsea', points: 85 } },
  { season: '2008/09', champion: { team: 'Manchester United', points: 90, goalDifference: 44 }, runnerUp: { team: 'Liverpool', points: 86 } },
  { season: '2009/10', champion: { team: 'Chelsea', points: 86, goalDifference: 71 }, runnerUp: { team: 'Manchester United', points: 85 } },
  { season: '2010/11', champion: { team: 'Manchester United', points: 80, goalDifference: 41 }, runnerUp: { team: 'Chelsea', points: 71 } },
  { season: '2011/12', champion: { team: 'Manchester City', points: 89, goalDifference: 64 }, runnerUp: { team: 'Manchester United', points: 89 } },
  { season: '2012/13', champion: { team: 'Manchester United', points: 89, goalDifference: 43 }, runnerUp: { team: 'Manchester City', points: 78 } },
  { season: '2013/14', champion: { team: 'Manchester City', points: 86, goalDifference: 37 }, runnerUp: { team: 'Liverpool', points: 84 } },
  { season: '2014/15', champion: { team: 'Chelsea', points: 87, goalDifference: 41 }, runnerUp: { team: 'Manchester City', points: 79 } },
  { season: '2015/16', champion: { team: 'Leicester City', points: 81, goalDifference: 32 }, runnerUp: { team: 'Arsenal', points: 71 } },
  { season: '2016/17', champion: { team: 'Chelsea', points: 93, goalDifference: 52 }, runnerUp: { team: 'Tottenham Hotspur', points: 86 } },
  { season: '2017/18', champion: { team: 'Manchester City', points: 100, goalDifference: 79 }, runnerUp: { team: 'Manchester United', points: 81 } },
  { season: '2018/19', champion: { team: 'Manchester City', points: 98, goalDifference: 72 }, runnerUp: { team: 'Liverpool', points: 97 } },
  { season: '2019/20', champion: { team: 'Liverpool', points: 99, goalDifference: 52 }, runnerUp: { team: 'Manchester City', points: 81 } },
  { season: '2020/21', champion: { team: 'Manchester City', points: 86, goalDifference: 51 }, runnerUp: { team: 'Manchester United', points: 74 } },
  { season: '2021/22', champion: { team: 'Manchester City', points: 93, goalDifference: 73 }, runnerUp: { team: 'Liverpool', points: 92 } },
  { season: '2022/23', champion: { team: 'Manchester City', points: 89, goalDifference: 61 }, runnerUp: { team: 'Arsenal', points: 84 } },
  { season: '2023/24', champion: { team: 'Manchester City', points: 91, goalDifference: 62 }, runnerUp: { team: 'Arsenal', points: 89 } },
  { season: '2024/25', champion: { team: 'Liverpool', points: 84, goalDifference: 45 }, runnerUp: { team: 'Arsenal', points: 74 } },
  { season: '2025/26', champion: null, runnerUp: null, inProgress: true }
];

const BY_SEASON = new Map(LEAGUE_HISTORY.map((r) => [r.season, r]));

export function getSeasonRecord(season: string): SeasonRecord | undefined {
  return BY_SEASON.get(season);
}

export function seasonStartYear(season: string): number | null {
  const match = /^(\d{4})\/\d{2}$/.exec(season);
  return match ? Number(match[1]) : null;
}
