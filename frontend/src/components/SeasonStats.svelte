<script lang="ts">
  import { onMount } from 'svelte';
  import { Calendar, Target, TrendingUp, Award, Users, Zap, Shield, AlertTriangle, Percent, Activity, Timer, Home } from 'lucide-svelte';
  import { dataService } from '../services/dataService';
  import type { Match } from '../types';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  async function loadSeasonStats() {
    try {
      loading = true;
      error = null;
      matches = await dataService.getCurrentSeasonMatches();

      if (matches.length > 0) {
        stats = calculateInterestingStats(matches);
        additionalStats = calculateAdditionalStats(matches);
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
    let currentStreak = 0;
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
        icon: Calendar,
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
    let cleanSheets: { [team: string]: number } = {};
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
    let highestScoringMatch = completedMatches.reduce((prev, curr) => {
      const currGoals = (curr.home_goals || 0) + (curr.away_goals || 0);
      const prevGoals = (prev.home_goals || 0) + (prev.away_goals || 0);
      return currGoals > prevGoals ? curr : prev;
    }, completedMatches[0] || {});
    
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
    let currentUnbeaten = 0;
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
        value: secondHalfGoals > firstHalfGoals ? `${((secondHalfGoals/totalGoals)*100).toFixed(0)}%` : `${((firstHalfGoals/totalGoals)*100).toFixed(0)}%`,
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

  onMount(() => {
    loadSeasonStats();
  });
</script>

<div class="season-stats">
  <div class="mb-8">
    <h2 class="text-2xl font-bold font-display text-foreground mb-2">Season Stats</h2>
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
            class="stat-card rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 hover:scale-105 transition-all duration-300"
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
      <div class="mb-8">
        <h3 class="text-lg font-semibold font-display text-foreground mb-4">Extended Analytics</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" aria-label="Extended season analytics">
          {#each additionalStats as stat, i}
            <div 
              class="stat-card-small rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4 hover:scale-105 transition-all duration-300"
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

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
