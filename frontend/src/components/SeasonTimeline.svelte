<script lang="ts">
  import { onMount } from 'svelte';
  import { Line } from 'svelte-chartjs';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    LineElement,
    LinearScale,
    CategoryScale,
    PointElement,
    Filler,
    type ChartData,
    type ChartOptions
  } from 'chart.js';
  import { dataService } from '../services/dataService';
  import type { Match, Standing } from '../types';
  import { getTeamColor } from '../utils/teamLogos';
  import { PREMIER_LEAGUE_GAMEWEEKS } from '../lib/constants';
  import { Card } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { Trophy, TrendingUp, AlertTriangle, Flame, Target, Calendar, ChevronDown, ChevronUp, Zap, Shield, ArrowDownUp } from 'lucide-svelte';

  ChartJS.register(
    Title,
    Tooltip,
    Legend,
    LineElement,
    LinearScale,
    CategoryScale,
    PointElement,
    Filler
  );

  let loading = true;
  let error: string | null = null;
  let matches: Match[] = [];
  let standings: Standing[] = [];

  // Computed data
  let titleRaceData: ChartData<'line', number[], string> | null = null;
  let relegationData: ChartData<'line', number[], string> | null = null;
  let keyResults: KeyResult[] = [];
  let narrativeEntries: NarrativeEntry[] = [];
  let currentMatchday = 0;
  const totalMatchdays = PREMIER_LEAGUE_GAMEWEEKS;

  // View controls
  let showAllTitleTeams = false;
  let showAllKeyResults = false;
  const TITLE_RACE_COUNT = 6;
  const RELEGATION_COUNT = 6;
  const KEY_RESULTS_PREVIEW = 8;

  interface MatchdayPoints {
    [team: string]: number[];
  }

  interface KeyResult {
    matchday: number;
    date: string;
    type: 'upset' | 'thriller' | 'record' | 'comeback' | 'clean-sweep';
    headline: string;
    detail: string;
    match: Match;
  }

  interface NarrativeEntry {
    matchday: number;
    title: string;
    body: string;
    mood: 'dramatic' | 'routine' | 'shock' | 'celebration';
  }

  // Chart theme options (matches Dashboard pattern)
  const themeScaleOptions = {
    x: {
      ticks: { color: 'hsl(var(--muted-foreground))' },
      grid: { color: 'hsl(var(--border) / 0.3)' }
    },
    y: {
      ticks: { color: 'hsl(var(--muted-foreground))' },
      grid: { color: 'hsl(var(--border) / 0.3)' }
    }
  };

  onMount(() => {
    loadTimeline();
  });

  export async function loadTimeline() {
    try {
      loading = true;
      error = null;

      const [matchData, standingsData] = await Promise.allSettled([
        dataService.getCurrentSeasonMatches(),
        dataService.getStandings()
      ]);

      matches = matchData.status === 'fulfilled' ? matchData.value : [];
      standings = standingsData.status === 'fulfilled' ? standingsData.value : [];

      if (matches.length === 0) {
        error = 'No match data available. Please check your API key in Settings.';
        return;
      }

      const completedMatches = matches.filter(m => m.result && m.matchday);
      if (completedMatches.length === 0) {
        error = 'No completed matches yet this season.';
        return;
      }

      currentMatchday = Math.max(...completedMatches.map(m => m.matchday!));
      const cumulativePoints = buildCumulativePoints(completedMatches);

      titleRaceData = buildTitleRaceChart(cumulativePoints);
      relegationData = buildRelegationChart(cumulativePoints);
      keyResults = detectKeyResults(completedMatches);
      narrativeEntries = buildNarrative(completedMatches, cumulativePoints);
    } catch (err) {
      console.warn('Failed to load season timeline:', err);
      error = 'Unable to load season timeline. Please check your API key in Settings.';
    } finally {
      loading = false;
    }
  }

  function buildCumulativePoints(completedMatches: Match[]): MatchdayPoints {
    const points: MatchdayPoints = {};
    const allTeams = new Set<string>();

    completedMatches.forEach(m => {
      allTeams.add(m.home_team);
      allTeams.add(m.away_team);
    });

    // Initialise each team with empty arrays
    allTeams.forEach(team => {
      points[team] = [];
    });

    // Group matches by matchday
    const matchesByDay: Record<number, Match[]> = {};
    completedMatches.forEach(m => {
      const md = m.matchday!;
      if (!matchesByDay[md]) matchesByDay[md] = [];
      matchesByDay[md].push(m);
    });

    const matchdays = Object.keys(matchesByDay).map(Number).sort((a, b) => a - b);

    // Build cumulative points matchday by matchday
    const runningTotal: Record<string, number> = {};
    allTeams.forEach(team => { runningTotal[team] = 0; });

    matchdays.forEach(md => {
      matchesByDay[md].forEach(m => {
        if (m.result === 'H') {
          runningTotal[m.home_team] += 3;
        } else if (m.result === 'A') {
          runningTotal[m.away_team] += 3;
        } else if (m.result === 'D') {
          runningTotal[m.home_team] += 1;
          runningTotal[m.away_team] += 1;
        }
      });

      // Snapshot cumulative points for all teams at this matchday
      allTeams.forEach(team => {
        points[team].push(runningTotal[team]);
      });
    });

    return points;
  }

  function buildTitleRaceChart(cumulativePoints: MatchdayPoints): ChartData<'line', number[], string> {
    // Sort teams by final points (descending)
    const sorted = Object.entries(cumulativePoints)
      .sort(([, a], [, b]) => (b[b.length - 1] || 0) - (a[a.length - 1] || 0));

    const teamsToShow = showAllTitleTeams ? sorted : sorted.slice(0, TITLE_RACE_COUNT);
    const matchdayLabels = teamsToShow[0]?.[1].map((_, i) => `MD ${i + 1}`) || [];

    return {
      labels: matchdayLabels,
      datasets: teamsToShow.map(([team, points], i) => ({
        label: team,
        data: points,
        borderColor: getTeamColor(team),
        backgroundColor: 'transparent',
        borderWidth: i < 2 ? 3 : 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.3
      }))
    };
  }

  function buildRelegationChart(cumulativePoints: MatchdayPoints): ChartData<'line', number[], string> {
    // Sort teams by final points (ascending) — bottom teams
    const sorted = Object.entries(cumulativePoints)
      .sort(([, a], [, b]) => (a[a.length - 1] || 0) - (b[b.length - 1] || 0));

    const bottomTeams = sorted.slice(0, RELEGATION_COUNT);
    const matchdayLabels = bottomTeams[0]?.[1].map((_, i) => `MD ${i + 1}`) || [];

    // Also add the "safety line" — 17th place team
    const safetyTeam = sorted[RELEGATION_COUNT] || sorted[sorted.length - 1];

    const datasets = bottomTeams.map(([team, points], i) => ({
      label: team,
      data: points,
      borderColor: getTeamColor(team),
      backgroundColor: 'transparent',
      borderWidth: i < 3 ? 3 : 2,  // Bottom 3 are bolder (relegation zone)
      pointRadius: 0,
      pointHoverRadius: 5,
      tension: 0.3,
      borderDash: [] as number[]
    }));

    // Safety line (17th place)
    if (safetyTeam) {
      datasets.push({
        label: `${safetyTeam[0]} (safety)`,
        data: safetyTeam[1],
        borderColor: 'hsl(var(--muted-foreground))',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.3,
        borderDash: [6, 4]
      });
    }

    return {
      labels: matchdayLabels,
      datasets
    };
  }

  function detectKeyResults(completedMatches: Match[]): KeyResult[] {
    const results: KeyResult[] = [];
    const topTeams = standings.slice(0, 6).map(s => s.team.name);
    const bottomTeams = standings.slice(-3).map(s => s.team.name);

    completedMatches.forEach(m => {
      const totalGoals = (m.home_goals || 0) + (m.away_goals || 0);
      const homeTeam = m.home_team;
      const awayTeam = m.away_team;
      const dateStr = formatMatchDate(m.date);

      // Thrillers — 5+ goals
      if (totalGoals >= 5) {
        results.push({
          matchday: m.matchday!,
          date: dateStr,
          type: 'thriller',
          headline: `${homeTeam} ${m.home_goals}–${m.away_goals} ${awayTeam}`,
          detail: `${totalGoals}-goal thriller on matchday ${m.matchday}`,
          match: m
        });
      }

      // Upsets — bottom-3 beating top-6
      if (m.result === 'H' && bottomTeams.includes(homeTeam) && topTeams.includes(awayTeam)) {
        results.push({
          matchday: m.matchday!,
          date: dateStr,
          type: 'upset',
          headline: `${homeTeam} ${m.home_goals}–${m.away_goals} ${awayTeam}`,
          detail: `${homeTeam} stun ${awayTeam} at home`,
          match: m
        });
      } else if (m.result === 'A' && bottomTeams.includes(awayTeam) && topTeams.includes(homeTeam)) {
        results.push({
          matchday: m.matchday!,
          date: dateStr,
          type: 'upset',
          headline: `${homeTeam} ${m.home_goals}–${m.away_goals} ${awayTeam}`,
          detail: `${awayTeam} shock ${homeTeam} away from home`,
          match: m
        });
      }

      // Comebacks — losing at half-time but winning at full-time
      if (m.first_half_home_goals !== null && m.first_half_away_goals !== null) {
        if (m.first_half_home_goals < m.first_half_away_goals && m.result === 'H') {
          results.push({
            matchday: m.matchday!,
            date: dateStr,
            type: 'comeback',
            headline: `${homeTeam} ${m.home_goals}–${m.away_goals} ${awayTeam}`,
            detail: `${homeTeam} come from ${m.first_half_home_goals}–${m.first_half_away_goals} down at half-time to win`,
            match: m
          });
        } else if (m.first_half_away_goals < m.first_half_home_goals && m.result === 'A') {
          results.push({
            matchday: m.matchday!,
            date: dateStr,
            type: 'comeback',
            headline: `${homeTeam} ${m.home_goals}–${m.away_goals} ${awayTeam}`,
            detail: `${awayTeam} come from ${m.first_half_away_goals}–${m.first_half_home_goals} down at half-time to win`,
            match: m
          });
        }
      }
    });

    // Sort by matchday descending (most recent first)
    results.sort((a, b) => b.matchday - a.matchday);
    return results;
  }

  function buildNarrative(completedMatches: Match[], cumulativePoints: MatchdayPoints): NarrativeEntry[] {
    const entries: NarrativeEntry[] = [];
    const matchesByDay: Record<number, Match[]> = {};

    completedMatches.forEach(m => {
      const md = m.matchday!;
      if (!matchesByDay[md]) matchesByDay[md] = [];
      matchesByDay[md].push(m);
    });

    const matchdays = Object.keys(matchesByDay).map(Number).sort((a, b) => a - b);

    // Get sorted teams at each matchday
    matchdays.forEach((md, idx) => {
      const dayMatches = matchesByDay[md];
      const totalGoals = dayMatches.reduce((sum, m) => sum + (m.home_goals || 0) + (m.away_goals || 0), 0);
      const avgGoals = totalGoals / dayMatches.length;
      const upsets = dayMatches.filter(m => {
        const topTeams = standings.slice(0, 6).map(s => s.team.name);
        const bottomTeams = standings.slice(-6).map(s => s.team.name);
        return (m.result === 'H' && bottomTeams.includes(m.home_team) && topTeams.includes(m.away_team)) ||
               (m.result === 'A' && bottomTeams.includes(m.away_team) && topTeams.includes(m.home_team));
      });

      // Determine the leader at this matchday
      const sortedAtMd = Object.entries(cumulativePoints)
        .map(([team, pts]) => ({ team, points: pts[idx] || 0 }))
        .sort((a, b) => b.points - a.points);

      const leader = sortedAtMd[0];
      const second = sortedAtMd[1];
      const gap = leader && second ? leader.points - second.points : 0;

      let mood: NarrativeEntry['mood'] = 'routine';
      let title = `Matchday ${md}`;
      let body = '';

      if (upsets.length >= 2) {
        mood = 'shock';
        title = `Matchday ${md} — Upset Weekend`;
        body = `The form book was torn up as ${upsets.length} upsets rocked the league. `;
      } else if (avgGoals >= 3.5) {
        mood = 'dramatic';
        title = `Matchday ${md} — Goals Galore`;
        body = `A thrilling round of fixtures produced ${totalGoals} goals across ${dayMatches.length} matches (${avgGoals.toFixed(1)} per game). `;
      } else if (md === 1) {
        mood = 'celebration';
        title = 'Matchday 1 — The Season Begins';
        body = 'The curtain rises on a new Premier League campaign. ';
      } else if (gap >= 8) {
        mood = 'celebration';
        title = `Matchday ${md} — ${leader.team} Pull Clear`;
        body = `${leader.team} open up a ${gap}-point gap at the summit. `;
      } else if (gap <= 2 && md >= 10) {
        mood = 'dramatic';
        title = `Matchday ${md} — Title Race Tightens`;
        body = `Just ${gap} point${gap !== 1 ? 's' : ''} separate ${leader.team} and ${second.team} at the top. `;
      }

      if (leader && md >= 5) {
        body += `${leader.team} lead with ${leader.points} points. `;
      }

      // Only include narrative entries that have something interesting to say
      if (mood !== 'routine' || md === 1 || md === currentMatchday || md % 5 === 0) {
        entries.push({ matchday: md, title, body: body.trim(), mood });
      }
    });

    return entries.reverse(); // Most recent first
  }

  function formatMatchDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return dateStr;
    }
  }

  function getResultTypeIcon(type: KeyResult['type']) {
    switch (type) {
      case 'upset': return AlertTriangle;
      case 'thriller': return Flame;
      case 'comeback': return ArrowDownUp;
      case 'record': return Trophy;
      case 'clean-sweep': return Shield;
      default: return Zap;
    }
  }

  function getResultTypeBadge(type: KeyResult['type']): string {
    switch (type) {
      case 'upset': return 'Upset';
      case 'thriller': return 'Thriller';
      case 'comeback': return 'Comeback';
      case 'record': return 'Record';
      case 'clean-sweep': return 'Clean Sweep';
      default: return type;
    }
  }

  function getMoodColour(mood: NarrativeEntry['mood']): string {
    switch (mood) {
      case 'dramatic': return 'border-l-amber-500';
      case 'shock': return 'border-l-red-500';
      case 'celebration': return 'border-l-emerald-500';
      default: return 'border-l-muted-foreground/30';
    }
  }

  // Chart options
  const titleChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: themeScaleOptions,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: 'hsl(var(--muted-foreground))',
          boxWidth: 12,
          padding: 12,
          font: { size: 11 }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (items) => items[0]?.label || '',
          label: (item) => `${item.dataset.label}: ${item.parsed.y} pts`
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  const relegationChartOptions: ChartOptions<'line'> = {
    ...titleChartOptions,
    plugins: {
      ...titleChartOptions.plugins,
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (items) => items[0]?.label || '',
          label: (item) => `${item.dataset.label}: ${item.parsed.y} pts`
        }
      }
    }
  };

  // Reactive title race chart update when toggle changes
  $: if (!loading && matches.length > 0) {
    const completedMatches = matches.filter(m => m.result && m.matchday);
    if (completedMatches.length > 0) {
      const cp = buildCumulativePoints(completedMatches);
      titleRaceData = buildTitleRaceChart(cp);
    }
  }
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-display font-bold text-foreground flex items-center gap-2">
        <Calendar class="w-6 h-6 text-primary" />
        Season Timeline
      </h1>
      <p class="text-sm text-muted-foreground mt-1">
        The story of the 2024/25 Premier League season, told through data
      </p>
    </div>
    {#if !loading && currentMatchday > 0}
      <Badge variant="outline" class="self-start sm:self-auto">
        Matchday {currentMatchday} of {totalMatchdays}
      </Badge>
    {/if}
  </div>

  {#if loading}
    <!-- Loading skeleton — content-shaped for chart + event cards -->
    <div class="space-y-6">
      <Card class="p-6">
        <div class="skeleton h-6 w-40 rounded mb-4"></div>
        <div class="skeleton h-64 w-full rounded-lg"></div>
      </Card>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each [1, 2, 3, 4] as _, i}
          <Card class="p-4 space-y-2" style="animation-delay: {i * 60}ms">
            <div class="flex items-center gap-2">
              <div class="skeleton h-5 w-5 rounded-full"></div>
              <div class="skeleton h-4 w-32 rounded"></div>
            </div>
            <div class="skeleton h-4 w-48 rounded"></div>
          </Card>
        {/each}
      </div>
    </div>
  {:else if error}
    <Card class="p-8 text-center">
      <AlertTriangle class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p class="text-muted-foreground">{error}</p>
    </Card>
  {:else}
    <!-- Title Race Chart -->
    {#if titleRaceData}
      <Card class="p-4 sm:p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-display font-semibold text-foreground flex items-center gap-2">
            <Trophy class="w-5 h-5 text-amber-500" />
            Title Race
          </h2>
          <button
            class="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            on:click={() => showAllTitleTeams = !showAllTitleTeams}
          >
            {showAllTitleTeams ? 'Top 6 only' : 'All teams'}
            {#if showAllTitleTeams}
              <ChevronUp class="w-3 h-3" />
            {:else}
              <ChevronDown class="w-3 h-3" />
            {/if}
          </button>
        </div>
        <div class="h-64 sm:h-80" role="img" aria-label="Line chart showing cumulative points for the title race">
          <Line data={titleRaceData} options={titleChartOptions} />
        </div>
      </Card>
    {/if}

    <!-- Relegation Battle Chart -->
    {#if relegationData}
      <Card class="p-4 sm:p-6">
        <h2 class="text-lg font-display font-semibold text-foreground flex items-center gap-2 mb-4">
          <AlertTriangle class="w-5 h-5 text-red-500" />
          Relegation Battle
        </h2>
        <div class="h-64 sm:h-80" role="img" aria-label="Line chart showing cumulative points for the relegation battle">
          <Line data={relegationData} options={relegationChartOptions} />
        </div>
        <p class="text-xs text-muted-foreground mt-2">
          Dashed line shows the team just above the relegation zone (safety benchmark)
        </p>
      </Card>
    {/if}

    <!-- Key Results -->
    {#if keyResults.length > 0}
      <Card class="p-4 sm:p-6">
        <h2 class="text-lg font-display font-semibold text-foreground flex items-center gap-2 mb-4">
          <Zap class="w-5 h-5 text-primary" />
          Key Results
        </h2>
        <div class="space-y-3">
          {#each (showAllKeyResults ? keyResults : keyResults.slice(0, KEY_RESULTS_PREVIEW)) as result}
            <div class="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div class="mt-0.5 flex-shrink-0">
                <svelte:component this={getResultTypeIcon(result.type)} class="w-4 h-4 text-muted-foreground" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-semibold text-sm text-foreground">{result.headline}</span>
                  <Badge variant="outline" class="text-xs">{getResultTypeBadge(result.type)}</Badge>
                </div>
                <p class="text-xs text-muted-foreground mt-0.5">{result.detail}</p>
              </div>
              <div class="text-xs text-muted-foreground flex-shrink-0 text-right">
                <div>MD {result.matchday}</div>
                <div>{result.date}</div>
              </div>
            </div>
          {/each}
        </div>
        {#if keyResults.length > KEY_RESULTS_PREVIEW}
          <button
            class="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
            on:click={() => showAllKeyResults = !showAllKeyResults}
          >
            {showAllKeyResults ? 'Show fewer' : `Show all ${keyResults.length} results`}
            {#if showAllKeyResults}
              <ChevronUp class="w-3 h-3" />
            {:else}
              <ChevronDown class="w-3 h-3" />
            {/if}
          </button>
        {/if}
      </Card>
    {/if}

    <!-- Season Narrative -->
    {#if narrativeEntries.length > 0}
      <Card class="p-4 sm:p-6">
        <h2 class="text-lg font-display font-semibold text-foreground flex items-center gap-2 mb-4">
          <TrendingUp class="w-5 h-5 text-primary" />
          The Story So Far
        </h2>
        <div class="space-y-3">
          {#each narrativeEntries as entry}
            <div class="border-l-2 pl-4 py-1 {getMoodColour(entry.mood)}">
              <h3 class="text-sm font-semibold text-foreground">{entry.title}</h3>
              <p class="text-xs text-muted-foreground mt-0.5">{entry.body}</p>
            </div>
          {/each}
        </div>
      </Card>
    {/if}
  {/if}
</div>
