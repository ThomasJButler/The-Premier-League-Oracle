<script lang="ts">
  import { onMount } from 'svelte';
  import { Calendar, Target, TrendingUp, Award, Users, Zap, Shield, AlertTriangle, Percent, Activity, Timer, Home, BarChart3, Trophy, Crosshair, ArrowDownUp, Flame, Swords } from 'lucide-svelte';
  import { dataService } from '../services/dataService';
  import type { Match, Standing } from '../types';

  // Svelte 4 component constructor typing is limited — any is required for icon components
   
  type IconComponent = new (...args: any[]) => any;

  interface SeasonStat {
    label: string;
    value: string | number;
    icon: IconComponent;
    color: string;
    description: string;
  }

  let loading = true;
  let error: string | null = null;
  let matches: Match[] = [];
  let stats: SeasonStat[] = [];
  let additionalStats: SeasonStat[] = [];
  let bettingStats: SeasonStat[] = [];

  export async function loadSeasonStats() {
    try {
      loading = true;
      error = null;

      // Fetch matches first (required), then standings and scorers (optional extras)
      matches = await dataService.getCurrentSeasonMatches();

      // Standings and scorers are optional — don't fail the page if they error
      const [standingsData, scorersData] = await Promise.allSettled([
        dataService.getStandings(),
        dataService.getTopScorers()
      ]);

      const standings = standingsData.status === 'fulfilled' ? standingsData.value : [];
      const scorers = scorersData.status === 'fulfilled' ? scorersData.value : [];

      if (matches.length > 0) {
        stats = calculateInterestingStats(matches);
        additionalStats = calculateAdditionalStats(matches);
        bettingStats = calculateBettingStats(matches, standings, scorers);
      }
    } catch (err) {
      console.warn('Failed to load season stats:', err);
      error = 'Unable to load season statistics. Please check your API key in Settings.';
    } finally {
      loading = false;
    }
  }

  function calculateInterestingStats(matches: Match[]): SeasonStat[] {
    const completedMatches = matches.filter(m => m.result);
    
    // Calculate various statistics
    const totalGoals = completedMatches.reduce((sum, m) => sum + (m.home_goals || 0) + (m.away_goals || 0), 0);
    const avgGoalsPerMatch = completedMatches.length > 0 ? (totalGoals / completedMatches.length).toFixed(2) : 0;
    
    // Find biggest comeback
    let biggestComeback = { team: '', deficit: 0, match: null as Match | null };
    completedMatches.forEach(match => {
      if (match.first_half_home_goals !== null && match.first_half_away_goals !== null && match.home_goals !== null && match.away_goals !== null) {
        // Home team comeback
        if (match.first_half_home_goals < match.first_half_away_goals && match.home_goals > match.away_goals) {
          const deficit = match.first_half_away_goals - match.first_half_home_goals;
          if (deficit > biggestComeback.deficit) {
            biggestComeback = { team: match.home_team, deficit, match };
          }
        }
        // Away team comeback
        if (match.first_half_away_goals < match.first_half_home_goals && match.away_goals > match.home_goals) {
          const deficit = match.first_half_home_goals - match.first_half_away_goals;
          if (deficit > biggestComeback.deficit) {
            biggestComeback = { team: match.away_team, deficit, match };
          }
        }
      }
    });

    // Matches where the result changed between halftime and fulltime
    // (best proxy for drama without minute-by-minute event data from the free API tier)
    const lateDramaMatches = completedMatches.filter(match => {
      return match.full_time_result !== null &&
        match.half_time_result !== null &&
        match.full_time_result !== match.half_time_result;
    }).length;

    // Find most cards in a match (free-tier API returns null for card data)
    const hasCardData = completedMatches.some(m =>
      m.home_yellows !== null || m.away_yellows !== null ||
      m.home_reds !== null || m.away_reds !== null
    );
    let mostCardsMatch = completedMatches[0] || ({} as Match);
    let mostCards = 0;
    if (hasCardData) {
      mostCardsMatch = completedMatches.reduce((prev, curr) => {
        const currCards = (curr.home_yellows || 0) + (curr.away_yellows || 0) + (curr.home_reds || 0) + (curr.away_reds || 0);
        const prevCards = (prev.home_yellows || 0) + (prev.away_yellows || 0) + (prev.home_reds || 0) + (prev.away_reds || 0);
        return currCards > prevCards ? curr : prev;
      });
      mostCards = (mostCardsMatch.home_yellows || 0) + (mostCardsMatch.away_yellows || 0) + (mostCardsMatch.home_reds || 0) + (mostCardsMatch.away_reds || 0);
    }

    // Find longest winning streak
    let longestStreak = 0;
    let streakTeam = '';
    const teamResults: { [team: string]: string[] } = {};
    
    completedMatches.forEach(match => {
      if (!teamResults[match.home_team]) teamResults[match.home_team] = [];
      if (!teamResults[match.away_team]) teamResults[match.away_team] = [];
      
      if (match.result === 'H') {
        teamResults[match.home_team].push('W');
        teamResults[match.away_team].push('L');
      } else if (match.result === 'A') {
        teamResults[match.home_team].push('L');
        teamResults[match.away_team].push('W');
      } else {
        teamResults[match.home_team].push('D');
        teamResults[match.away_team].push('D');
      }
    });

    Object.entries(teamResults).forEach(([team, results]) => {
      let streak = 0;
      results.forEach(result => {
        if (result === 'W') {
          streak++;
          if (streak > longestStreak) {
            longestStreak = streak;
            streakTeam = team;
          }
        } else {
          streak = 0;
        }
      });
    });

    // Calculate home fortress (best home record)
    const homeRecords: { [team: string]: { played: number, won: number, percentage: number } } = {};
    completedMatches.forEach(match => {
      if (!homeRecords[match.home_team]) {
        homeRecords[match.home_team] = { played: 0, won: 0, percentage: 0 };
      }
      homeRecords[match.home_team].played++;
      if (match.result === 'H') {
        homeRecords[match.home_team].won++;
      }
    });

    let bestHomeTeam = '';
    let bestHomePercentage = 0;
    Object.entries(homeRecords).forEach(([team, record]) => {
      record.percentage = record.played > 0 ? (record.won / record.played) * 100 : 0;
      if (record.percentage > bestHomePercentage && record.played >= 5) {
        bestHomePercentage = record.percentage;
        bestHomeTeam = team;
      }
    });

    return [
      {
        label: 'Average Goals',
        value: avgGoalsPerMatch,
        icon: Target,
        color: 'from-teal-500 to-emerald-400',
        description: 'Goals per match this season'
      },
      {
        label: 'Biggest Comeback',
        value: biggestComeback.team ? `${biggestComeback.team} (${biggestComeback.deficit} goals)` : 'None yet',
        icon: TrendingUp,
        color: 'from-green-500 to-emerald-500',
        description: 'Most goals overcome to win'
      },
      {
        label: 'Second-Half Turnarounds',
        value: `${lateDramaMatches} matches`,
        icon: Zap,
        color: 'from-yellow-500 to-orange-500',
        description: 'Result changed between halftime and fulltime'
      },
      {
        label: 'Most Cards',
        value: hasCardData ? `${mostCards} cards` : 'N/A',
        icon: AlertTriangle,
        color: 'from-red-500 to-pink-500',
        description: hasCardData && mostCardsMatch.home_team
          ? `${mostCardsMatch.home_team} vs ${mostCardsMatch.away_team}`
          : 'Card data unavailable on free tier'
      },
      {
        label: 'Win Streak',
        value: longestStreak > 0 ? `${streakTeam} (${longestStreak})` : 'None',
        icon: Award,
        color: 'from-slate-500 to-slate-400',
        description: 'Longest winning streak'
      },
      {
        label: 'Home Fortress',
        value: bestHomeTeam ? `${bestHomeTeam} (${bestHomePercentage.toFixed(0)}%)` : 'TBD',
        icon: Users,
        color: 'from-cyan-500 to-blue-500',
        description: 'Best home win percentage'
      }
    ];
  }

  function calculateAdditionalStats(matches: Match[]): SeasonStat[] {
    const completedMatches = matches.filter(m => m.result);
    
    // Clean sheets tracking
    const cleanSheets: { [team: string]: number } = {};
    completedMatches.forEach(match => {
      if (!cleanSheets[match.home_team]) cleanSheets[match.home_team] = 0;
      if (!cleanSheets[match.away_team]) cleanSheets[match.away_team] = 0;
      
      if (match.away_goals === 0) {
        cleanSheets[match.home_team]++;
      }
      if (match.home_goals === 0) {
        cleanSheets[match.away_team]++;
      }
    });
    
    const topCleanSheetTeam = Object.entries(cleanSheets).reduce((a, b) => 
      cleanSheets[a[0]] > cleanSheets[b[0]] ? a : b, ['', 0]);
    
    // Draw percentage
    const draws = completedMatches.filter(m => m.result === 'D').length;
    const drawPercentage = completedMatches.length > 0 
      ? ((draws / completedMatches.length) * 100).toFixed(1) 
      : 0;
    
    // High scoring games (4+ goals)
    const highScoringGames = completedMatches.filter(m => 
      (m.home_goals || 0) + (m.away_goals || 0) >= 4
    ).length;
    
    // Away wins percentage
    const awayWins = completedMatches.filter(m => m.result === 'A').length;
    const awayWinPercentage = completedMatches.length > 0 
      ? ((awayWins / completedMatches.length) * 100).toFixed(1) 
      : 0;
    
    // Red cards total (free-tier API returns null for card data)
    const hasRedCardData = completedMatches.some(m =>
      m.home_reds !== null || m.away_reds !== null
    );
    const totalRedCards = hasRedCardData
      ? completedMatches.reduce((sum, m) => sum + (m.home_reds || 0) + (m.away_reds || 0), 0)
      : -1; // Sentinel: -1 means no data available
    
    // Most goals in a single match
    const highestScoringMatch = completedMatches.length > 0
      ? completedMatches.reduce((prev, curr) => {
          const currGoals = (curr.home_goals || 0) + (curr.away_goals || 0);
          const prevGoals = (prev.home_goals || 0) + (prev.away_goals || 0);
          return currGoals > prevGoals ? curr : prev;
        })
      : null;

    const mostGoalsInMatch = highestScoringMatch
      ? (highestScoringMatch.home_goals || 0) + (highestScoringMatch.away_goals || 0)
      : 0;
    
    // Both teams to score percentage
    const bttsMatches = completedMatches.filter(m => 
      (m.home_goals || 0) > 0 && (m.away_goals || 0) > 0
    ).length;
    const bttsPercentage = completedMatches.length > 0
      ? ((bttsMatches / completedMatches.length) * 100).toFixed(1)
      : 0;
    
    // Over 2.5 goals percentage
    const over25Matches = completedMatches.filter(m => 
      (m.home_goals || 0) + (m.away_goals || 0) > 2.5
    ).length;
    const over25Percentage = completedMatches.length > 0
      ? ((over25Matches / completedMatches.length) * 100).toFixed(1)
      : 0;
    
    // First half goals vs second half
    const firstHalfGoals = completedMatches.reduce((sum, m) => 
      sum + (m.first_half_home_goals || 0) + (m.first_half_away_goals || 0), 0
    );
    const totalGoals = completedMatches.reduce((sum, m) => 
      sum + (m.home_goals || 0) + (m.away_goals || 0), 0
    );
    const secondHalfGoals = totalGoals - firstHalfGoals;
    
    // Unbeaten runs
    let longestUnbeaten = 0;
    let unbeatenTeam = '';
    const teamUnbeaten: { [team: string]: number } = {};
    
    completedMatches.forEach(match => {
      if (!teamUnbeaten[match.home_team]) teamUnbeaten[match.home_team] = 0;
      if (!teamUnbeaten[match.away_team]) teamUnbeaten[match.away_team] = 0;

      if (match.result === 'H') {
        // Home win: home team extends streak, away team's streak is broken
        teamUnbeaten[match.home_team]++;
        teamUnbeaten[match.away_team] = 0;
      } else if (match.result === 'A') {
        // Away win: away team extends streak, home team's streak is broken
        teamUnbeaten[match.away_team]++;
        teamUnbeaten[match.home_team] = 0;
      } else {
        // Draw: BOTH teams extend their unbeaten runs
        teamUnbeaten[match.home_team]++;
        teamUnbeaten[match.away_team]++;
      }

      Object.entries(teamUnbeaten).forEach(([team, streak]) => {
        if (streak > longestUnbeaten) {
          longestUnbeaten = streak;
          unbeatenTeam = team;
        }
      });
    });

    return [
      {
        label: 'Clean Sheets Leader',
        value: topCleanSheetTeam[0] ? `${topCleanSheetTeam[0]} (${topCleanSheetTeam[1]})` : 'N/A',
        icon: Shield,
        color: 'from-teal-500 to-cyan-500',
        description: 'Most shutouts this season'
      },
      {
        label: 'Draw Rate',
        value: `${drawPercentage}%`,
        icon: Percent,
        color: 'from-gray-500 to-slate-500',
        description: 'Matches ending in draws'
      },
      {
        label: 'High-Scoring Games',
        value: `${highScoringGames} matches`,
        icon: Activity,
        color: 'from-orange-500 to-red-500',
        description: 'Games with 4+ goals'
      },
      {
        label: 'Away Win Rate',
        value: `${awayWinPercentage}%`,
        icon: Home,
        color: 'from-cyan-500 to-teal-500',
        description: 'Visitor victory percentage'
      },
      {
        label: 'Red Cards',
        value: totalRedCards >= 0 ? totalRedCards : 'N/A',
        icon: AlertTriangle,
        color: 'from-red-600 to-rose-600',
        description: totalRedCards >= 0 ? 'Total dismissals this season' : 'Card data unavailable on free tier'
      },
      {
        label: 'Goal Fest',
        value: `${mostGoalsInMatch} goals`,
        icon: Target,
        color: 'from-amber-500 to-yellow-500',
        description: highestScoringMatch ? `${highestScoringMatch.home_team} vs ${highestScoringMatch.away_team}` : 'Highest scoring match'
      },
      {
        label: 'BTTS Rate',
        value: `${bttsPercentage}%`,
        icon: Users,
        color: 'from-green-500 to-teal-500',
        description: 'Both teams score frequency'
      },
      {
        label: 'Over 2.5 Goals',
        value: `${over25Percentage}%`,
        icon: TrendingUp,
        color: 'from-emerald-500 to-teal-400',
        description: 'Matches with 3+ goals'
      },
      {
        label: 'Second Half Goals',
        value: totalGoals > 0
          ? (secondHalfGoals > firstHalfGoals ? `${((secondHalfGoals/totalGoals)*100).toFixed(0)}%` : `${((firstHalfGoals/totalGoals)*100).toFixed(0)}%`)
          : 'N/A',
        icon: Timer,
        color: 'from-slate-500 to-cyan-500',
        description: secondHalfGoals > firstHalfGoals ? 'More goals after halftime' : 'More goals before halftime'
      },
      {
        label: 'Unbeaten Run',
        value: unbeatenTeam ? `${unbeatenTeam} (${longestUnbeaten})` : 'N/A',
        icon: Award,
        color: 'from-emerald-500 to-green-500',
        description: 'Longest unbeaten run this season'
      },
      {
        label: 'Total Matches',
        value: completedMatches.length,
        icon: Calendar,
        color: 'from-slate-500 to-gray-500',
        description: 'Games played this season'
      }
    ];
  }

  interface FDScorer {
    player?: { id?: number; name?: string; position?: string; nationality?: string };
    team?: { id?: number; name?: string; shortName?: string; crest?: string };
    goals: number;
    assists?: number | null;
    penalties?: number | null;
  }

  function calculateBettingStats(matches: Match[], standings: Standing[], scorers: FDScorer[]): SeasonStat[] {
    const completedMatches = matches.filter(m => m.result);
    if (completedMatches.length === 0) return [];

    // --- Per-team betting metrics ---
    const teamBtts: { [team: string]: { total: number; btts: number } } = {};
    const teamOver25: { [team: string]: { total: number; over: number } } = {};
    const teamDraws: { [team: string]: { total: number; draws: number } } = {};

    completedMatches.forEach(match => {
      const teams = [match.home_team, match.away_team];
      const homeGoals = match.home_goals || 0;
      const awayGoals = match.away_goals || 0;
      const isBtts = homeGoals > 0 && awayGoals > 0;
      const isOver25 = homeGoals + awayGoals > 2.5;
      const isDraw = match.result === 'D';

      teams.forEach(team => {
        if (!teamBtts[team]) teamBtts[team] = { total: 0, btts: 0 };
        if (!teamOver25[team]) teamOver25[team] = { total: 0, over: 0 };
        if (!teamDraws[team]) teamDraws[team] = { total: 0, draws: 0 };

        teamBtts[team].total++;
        if (isBtts) teamBtts[team].btts++;

        teamOver25[team].total++;
        if (isOver25) teamOver25[team].over++;

        teamDraws[team].total++;
        if (isDraw) teamDraws[team].draws++;
      });
    });

    // Top BTTS teams (min 5 matches)
    const bttsRanked = Object.entries(teamBtts)
      .filter(([, v]) => v.total >= 5)
      .map(([team, v]) => ({ team, rate: (v.btts / v.total) * 100 }))
      .sort((a, b) => b.rate - a.rate);

    const topBtts = bttsRanked.slice(0, 3).map(t => `${t.team} ${t.rate.toFixed(0)}%`).join(', ');

    // Top Over 2.5 teams
    const over25Ranked = Object.entries(teamOver25)
      .filter(([, v]) => v.total >= 5)
      .map(([team, v]) => ({ team, rate: (v.over / v.total) * 100 }))
      .sort((a, b) => b.rate - a.rate);

    const topOver25 = over25Ranked.slice(0, 3).map(t => `${t.team} ${t.rate.toFixed(0)}%`).join(', ');

    // Most draws team
    const drawsRanked = Object.entries(teamDraws)
      .filter(([, v]) => v.total >= 5)
      .map(([team, v]) => ({ team, count: v.draws, rate: (v.draws / v.total) * 100 }))
      .sort((a, b) => b.count - a.count);

    const drawKing = drawsRanked[0];

    // Biggest win margin
    let biggestWin = { margin: 0, home: '', away: '', homeGoals: 0, awayGoals: 0 };
    completedMatches.forEach(m => {
      const margin = Math.abs((m.home_goals || 0) - (m.away_goals || 0));
      if (margin > biggestWin.margin) {
        biggestWin = { margin, home: m.home_team, away: m.away_team, homeGoals: m.home_goals || 0, awayGoals: m.away_goals || 0 };
      }
    });

    // Late equalisers (led at HT, drew at FT)
    const lateEqualisers = completedMatches.filter(m => {
      if (m.half_time_result === null || m.full_time_result === null) return false;
      return m.half_time_result !== 'D' && m.full_time_result === 'D';
    }).length;

    // Home win percentage (league-wide)
    const homeWins = completedMatches.filter(m => m.result === 'H').length;
    const homeWinPct = ((homeWins / completedMatches.length) * 100).toFixed(1);

    // Current form streaks (live — from end of results array)
    let currentLongestWin = 0;
    let currentWinTeam = '';
    let currentLongestLosing = 0;
    let currentLosingTeam = '';
    const currentStreaks: { [team: string]: { wins: number; losses: number } } = {};

    // Process in chronological order to get current streaks
    completedMatches.forEach(match => {
      [match.home_team, match.away_team].forEach(team => {
        if (!currentStreaks[team]) currentStreaks[team] = { wins: 0, losses: 0 };
      });

      if (match.result === 'H') {
        currentStreaks[match.home_team].wins++;
        currentStreaks[match.home_team].losses = 0;
        currentStreaks[match.away_team].wins = 0;
        currentStreaks[match.away_team].losses++;
      } else if (match.result === 'A') {
        currentStreaks[match.away_team].wins++;
        currentStreaks[match.away_team].losses = 0;
        currentStreaks[match.home_team].wins = 0;
        currentStreaks[match.home_team].losses++;
      } else {
        Object.keys(currentStreaks).forEach(team => {
          if (team === match.home_team || team === match.away_team) {
            currentStreaks[team].wins = 0;
            currentStreaks[team].losses = 0;
          }
        });
      }
    });

    Object.entries(currentStreaks).forEach(([team, s]) => {
      if (s.wins > currentLongestWin) { currentLongestWin = s.wins; currentWinTeam = team; }
      if (s.losses > currentLongestLosing) { currentLongestLosing = s.losses; currentLosingTeam = team; }
    });

    // --- Standings-derived stats ---
    let titleRace = 'N/A';
    let relegationBattle = 'N/A';
    if (standings.length >= 3) {
      const top = standings.slice(0, 3);
      const gap1 = top[0].points - top[1].points;
      const gap2 = top[0].points - top[2].points;
      titleRace = `${top[0].team.shortName || top[0].team.name} (${top[0].points}pts)`;
      if (gap1 > 0) titleRace += ` +${gap1}`;

      if (standings.length >= 20) {
        const safetyLine = standings[16]; // 17th place (0-indexed)
        const bottom3 = standings.slice(-3);
        const safetyGap = safetyLine.points - bottom3[0].points;
        relegationBattle = bottom3.map(s => `${s.team.shortName || s.team.name} ${s.points}pts`).join(', ');
        if (safetyGap > 0) relegationBattle += ` (${safetyGap}pts to safety)`;
      }
    }

    // --- Golden Boot ---
    let goldenBoot = 'N/A';
    if (scorers.length >= 3) {
      goldenBoot = scorers.slice(0, 3)
        .map(s => `${s.player?.name || 'Unknown'} (${s.goals})`)
        .join(', ');
    } else if (scorers.length > 0) {
      goldenBoot = `${scorers[0].player?.name || 'Unknown'} (${scorers[0].goals})`;
    }

    const results: SeasonStat[] = [
      {
        label: 'Home Win Rate',
        value: `${homeWinPct}%`,
        icon: Home,
        color: 'from-blue-500 to-indigo-500',
        description: 'League-wide home advantage this season'
      },
      {
        label: 'Draw Magnets',
        value: drawKing ? `${drawKing.team} (${drawKing.count})` : 'N/A',
        icon: ArrowDownUp,
        color: 'from-gray-500 to-zinc-500',
        description: drawKing ? `${drawKing.rate.toFixed(0)}% of their matches end level` : 'Team with most draws'
      },
      {
        label: 'BTTS Leaders',
        value: bttsRanked[0] ? `${bttsRanked[0].team} (${bttsRanked[0].rate.toFixed(0)}%)` : 'N/A',
        icon: Swords,
        color: 'from-green-500 to-emerald-500',
        description: topBtts ? `Top 3: ${topBtts}` : 'Both teams to score frequency'
      },
      {
        label: 'Over 2.5 Leaders',
        value: over25Ranked[0] ? `${over25Ranked[0].team} (${over25Ranked[0].rate.toFixed(0)}%)` : 'N/A',
        icon: Flame,
        color: 'from-orange-500 to-amber-500',
        description: topOver25 ? `Top 3: ${topOver25}` : 'Matches with 3+ goals'
      },
      {
        label: 'Biggest Win',
        value: biggestWin.margin > 0 ? `${biggestWin.margin} goals` : 'N/A',
        icon: Target,
        color: 'from-purple-500 to-violet-500',
        description: biggestWin.margin > 0 ? `${biggestWin.home} ${biggestWin.homeGoals}-${biggestWin.awayGoals} ${biggestWin.away}` : 'Largest victory margin'
      },
      {
        label: 'Late Equalisers',
        value: lateEqualisers,
        icon: Timer,
        color: 'from-rose-500 to-pink-500',
        description: 'Teams that led at HT but only drew — live betting insight'
      },
      {
        label: 'Hot Streak',
        value: currentWinTeam ? `${currentWinTeam} (${currentLongestWin}W)` : 'None',
        icon: Flame,
        color: 'from-red-500 to-orange-500',
        description: 'Current longest winning run right now'
      },
      {
        label: 'Cold Streak',
        value: currentLosingTeam && currentLongestLosing > 0 ? `${currentLosingTeam} (${currentLongestLosing}L)` : 'None',
        icon: TrendingUp,
        color: 'from-slate-600 to-gray-600',
        description: 'Current longest losing run right now'
      },
    ];

    // Standings-based stats (only if standings loaded)
    if (standings.length >= 3) {
      results.push({
        label: 'Title Race',
        value: titleRace,
        icon: Trophy,
        color: 'from-yellow-500 to-amber-500',
        description: standings.length >= 2 ? `${standings[1].team.shortName || standings[1].team.name} (${standings[1].points}pts), ${standings[2].team.shortName || standings[2].team.name} (${standings[2].points}pts)` : 'Top of the table'
      });
    }

    if (standings.length >= 20) {
      results.push({
        label: 'Relegation Zone',
        value: relegationBattle,
        icon: AlertTriangle,
        color: 'from-red-600 to-red-500',
        description: 'Bottom 3 teams and gap to safety'
      });
    }

    // Golden Boot (only if scorers loaded)
    if (scorers.length > 0) {
      results.push({
        label: 'Golden Boot',
        value: `${scorers[0].player?.name || 'Unknown'} (${scorers[0].goals})`,
        icon: Trophy,
        color: 'from-amber-400 to-yellow-500',
        description: scorers.length >= 3 ? `Top 3: ${goldenBoot}` : 'Leading scorer'
      });
    }

    return results;
  }

  onMount(() => {
    loadSeasonStats();
  });
</script>

<div class="season-stats">
  <div class="mb-8">
    <h1 class="text-2xl font-bold font-display text-foreground mb-2">Season Stats</h1>
    <p class="text-muted-foreground">Discover unique insights from this season's data</p>
  </div>

  {#if loading}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each Array(6) as _}
        <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 animate-pulse">
          <div class="w-12 h-12 bg-muted rounded-full mb-4"></div>
          <div class="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div class="h-6 bg-muted rounded w-1/2"></div>
        </div>
      {/each}
    </div>
  {:else if error}
    <div class="rounded-xl border border-destructive/50 bg-destructive/10 p-8 text-center">
      <AlertTriangle class="w-12 h-12 mx-auto mb-3 text-destructive" />
      <p class="text-destructive font-medium">{error}</p>
    </div>
  {:else}
    <!-- Primary Stats -->
    <div class="mb-12">
      <h3 class="text-lg font-semibold font-display text-foreground mb-4">Key Insights</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-label="Key season statistics">
        {#each stats as stat, i}
          <div 
            class="stat-card rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 motion-safe:hover:scale-105 transition-colors duration-300 motion-safe:transition-all"
            style="animation-delay: {i * 100}ms"
          >
            <div class="flex items-start justify-between mb-4">
              <div class="p-3 rounded-xl bg-gradient-to-br {stat.color} bg-opacity-10">
                <svelte:component this={stat.icon} class="w-6 h-6 text-white drop-shadow-lg" />
              </div>
            </div>
            
            <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {stat.label}
            </h3>
            
            <p class="text-2xl font-bold text-foreground mb-2">
              {stat.value}
            </p>
            
            <p class="text-xs text-muted-foreground">
              {stat.description}
            </p>
          </div>
        {/each}
      </div>
    </div>

    <!-- Additional Stats -->
    {#if additionalStats.length > 0}
      <div class="mb-12">
        <h3 class="text-lg font-semibold font-display text-foreground mb-4">Extended Analytics</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" aria-label="Extended season analytics">
          {#each additionalStats as stat, i}
            <div
              class="stat-card-small rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4 motion-safe:hover:scale-105 transition-colors duration-300 motion-safe:transition-all"
              style="animation-delay: {(stats.length + i) * 50}ms"
            >
              <div class="flex items-center gap-3 mb-2">
                <div class="p-2 rounded-lg bg-gradient-to-br {stat.color} bg-opacity-10">
                  <svelte:component this={stat.icon} class="w-4 h-4 text-white drop-shadow-lg" />
                </div>
                <h4 class="text-xs font-semibold text-muted-foreground uppercase">
                  {stat.label}
                </h4>
              </div>

              <p class="text-lg font-bold text-foreground mb-1">
                {stat.value}
              </p>

              <p class="text-xs text-muted-foreground line-clamp-2">
                {stat.description}
              </p>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Betting Intelligence -->
    {#if bettingStats.length > 0}
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-4">
          <BarChart3 class="w-5 h-5 text-accent" />
          <h3 class="text-lg font-semibold font-display text-foreground">Betting Intelligence</h3>
        </div>
        <p class="text-sm text-muted-foreground mb-4">Per-team trends for BTTS, Over 2.5, draws, form streaks, and market context</p>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" aria-label="Betting intelligence statistics">
          {#each bettingStats as stat, i}
            <div
              class="stat-card-small rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4 motion-safe:hover:scale-105 transition-colors duration-300 motion-safe:transition-all"
              style="animation-delay: {(stats.length + additionalStats.length + i) * 50}ms"
            >
              <div class="flex items-center gap-3 mb-2">
                <div class="p-2 rounded-lg bg-gradient-to-br {stat.color} bg-opacity-10">
                  <svelte:component this={stat.icon} class="w-4 h-4 text-white drop-shadow-lg" />
                </div>
                <h4 class="text-xs font-semibold text-muted-foreground uppercase">
                  {stat.label}
                </h4>
              </div>

              <p class="text-lg font-bold text-foreground mb-1">
                {stat.value}
              </p>

              <p class="text-xs text-muted-foreground line-clamp-2">
                {stat.description}
              </p>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}

  <div class="mt-8 p-6 rounded-xl border border-border bg-card text-card-foreground shadow-sm text-center">
    <p class="text-sm text-muted-foreground">
      <span class="font-semibold">Did you know?</span> These statistics are refreshed each time you visit this page.
      Check back regularly for the latest insights!
    </p>
  </div>
</div>

<style>
  .stat-card, .stat-card-small {
    animation: fadeInUp 0.6s ease-out forwards;
    opacity: 0;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .stat-card:hover, .stat-card-small:hover {
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

</style>
