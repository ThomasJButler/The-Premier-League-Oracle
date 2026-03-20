<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { Line } from 'svelte-chartjs';

  const dispatch = createEventDispatcher<{ navigate: { view: string } }>();
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
    type ChartItem
  } from 'chart.js';
  import { dataService } from '../services/dataService';
  import { predictionTracker } from '../services/predictionTracker';
  import { betHistoryService } from '../services/betting/betHistoryService';
  import type { Match } from '../types';
  import { format } from 'date-fns';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { TrendingUp, Users, Target, BarChart2, Trophy, ChevronDown, Calendar } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
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

  let recentMatches: Match[] = [];
  let topPredictions: Array<{ match: string; confidence: number; prediction: string; wasCorrect: boolean | null }> = [];
  let loading = true;
  let error: string | null = null;
  const overallAccuracy = tweened(0, { duration: 1500, easing: cubicOut });
  const profitMargin = tweened(0, { duration: 1800, easing: cubicOut });
  const totalPredictions = tweened(0, { duration: 1200, easing: cubicOut });
  const betsPlaced = tweened(0, { duration: 1400, easing: cubicOut });

  const recentPerformance: ChartData<"line", number[], string> = {
    labels: [] as string[],
    datasets: [{
      label: 'Prediction Accuracy',
      data: [] as number[],
      borderColor: 'hsl(var(--primary))',
      tension: 0.4,
      fill: false
    }]
  };

  /** Chart scale options — uses CSS variables so they adapt to light/dark theme */
  const themeScaleOptions = {
    y: {
      beginAtZero: true,
      grid: { color: 'hsla(var(--muted-foreground) / 0.1)' },
      ticks: { color: 'hsl(var(--muted-foreground))' }
    },
    x: {
      grid: { display: false },
      ticks: { color: 'hsl(var(--muted-foreground))' }
    }
  };

  let upcomingPredictions = 0;
  let realMatchData: Match[] = [];
  let accuracyChange = '';
  let profitChange = '';
  let predictionsChange = '';
  let betsChange = '';
  let activityTab: 'predictions' | 'upcoming' = 'predictions';
  let hasAccuracyData = false;
  let hasProfitData = false;
  let rawTotalPredictions = 0;
  let rawTotalBets = 0;
  $: hasActivity = rawTotalPredictions > 0 || rawTotalBets > 0;
  
  // Current date and time
  let currentDateTime = new Date();
  let formattedDate = '';
  let formattedTime = '';
  
  function updateDateTime() {
    currentDateTime = new Date();
    formattedDate = format(currentDateTime, 'EEEE, dd MMMM yyyy');
    formattedTime = format(currentDateTime, 'HH:mm:ss');
  }

  let profitChartCanvas: HTMLCanvasElement;
  let profitChartInstance: ChartJS | null = null;

  // Reactive stats that update with animations
  $: stats = [
    {
      title: 'Prediction Accuracy',
      value: `${$overallAccuracy.toFixed(1)}%`,
      change: accuracyChange,
      icon: Target,
      color: 'text-primary',
      bgColor: 'bg-primary/10 dark:bg-primary/20'
    },
    {
      title: 'Total Profit',
      value: `£${$profitMargin.toFixed(2)}`,
      change: profitChange,
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20'
    },
    {
      title: 'Total Predictions',
      value: Math.round($totalPredictions).toLocaleString(),
      change: predictionsChange,
      icon: Target,
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-500/10 dark:bg-sky-500/20'
    },
    {
      title: 'Bets Placed',
      value: Math.round($betsPlaced).toLocaleString(),
      change: betsChange,
      icon: BarChart2,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10 dark:bg-amber-500/20'
    }
  ];

  export async function refresh() {
    await loadDashboardData();
    initProfitChart();
  }
  
  async function loadDashboardData() {
    try {
      loading = true;
      error = null;
      
      // Get recent and upcoming matches from API
      const [recent, upcoming] = await Promise.all([
        dataService.getMatches({ recent: true, days: 30 }),
        dataService.getMatches({ upcoming: true, days: 7 })
      ]);
      
      recentMatches = recent;
      realMatchData = upcoming;
      
      if (recentMatches.length === 0) {
        error = "No matches found for the current season";
        return;
      }

      // Reconcile predictions with actual match results
      const matchesWithResults = recentMatches.filter(m => m.result);
      matchesWithResults.forEach(match => {
        if (match.result && match.home_goals !== null && match.away_goals !== null) {
          predictionTracker.updateWithResult(
            match.id,
            match.result,
            match.home_goals,
            match.away_goals
          );
          // Also resolve any placed bets for this match
          betHistoryService.resolveMatchBets(
            match.id,
            match.result,
            match.home_goals,
            match.away_goals
          );
        }
      });

      // Get real prediction accuracy from PredictionTracker
      const accuracyStats = predictionTracker.getAccuracyStats(30);
      const accuracyStats60 = predictionTracker.getAccuracyStats(60);
      const realAccuracy = accuracyStats.totalPredictions > 0 ? accuracyStats.accuracy : 0;

      // Compute change strings from real data
      const accuracyDelta = accuracyStats.accuracy - accuracyStats60.accuracy;
      accuracyChange = accuracyStats.totalPredictions > 0
        ? `${accuracyDelta >= 0 ? '+' : ''}${accuracyDelta.toFixed(1)}% vs last 60d`
        : 'No predictions yet';

      // Get real betting stats from BetHistoryService
      const roi = betHistoryService.getROI();
      const allBets = betHistoryService.getAllBets();
      const winRate = betHistoryService.getWinRate();

      profitChange = roi.totalBets > 0
        ? `${winRate.toFixed(0)}% win rate`
        : 'No bets placed yet';
      predictionsChange = accuracyStats.totalPredictions > 0
        ? `${accuracyStats.correctPredictions} correct`
        : 'Generate predictions to start';
      betsChange = allBets.length > 0
        ? `${betHistoryService.getPendingBets().length} pending`
        : 'Place bets to track';

      // Track raw counts for empty state detection
      rawTotalPredictions = accuracyStats.totalPredictions;
      rawTotalBets = allBets.length;

      // Set real stats with smooth animations
      setTimeout(() => overallAccuracy.set(realAccuracy), 300);
      setTimeout(() => profitMargin.set(roi.totalReturn - roi.totalStaked), 600);
      setTimeout(() => totalPredictions.set(accuracyStats.totalPredictions), 900);
      setTimeout(() => betsPlaced.set(allBets.length), 1200);

      // Build accuracy trend from per-gameweek accuracy (real settled predictions)
      const gameweekAccuracy = predictionTracker.getAccuracyByGameweek();
      if (gameweekAccuracy.length > 0) {
        // Show the most recent gameweeks (up to 10)
        const recentGameweeks = gameweekAccuracy.slice(-10);
        recentPerformance.labels = recentGameweeks.map(gw => `GW ${gw.matchday}`);
        recentPerformance.datasets[0].data = recentGameweeks.map(gw => gw.accuracy);
        hasAccuracyData = true;
      } else {
        // Fallback: show recent predictions' confidence as a proxy until results settle
        const recentPreds = predictionTracker.getRecentPredictions(5);
        if (recentPreds.length > 0) {
          recentPerformance.labels = [...recentPreds]
            .reverse()
            .map(p => p.matchday ? `GW ${p.matchday}` : format(new Date(p.matchDate), 'MMM d'));
          recentPerformance.datasets[0].data = [...recentPreds].reverse().map(p => p.confidence * 100);
          // Label correctly — this is confidence, not measured accuracy
          recentPerformance.datasets[0].label = 'Model Confidence (awaiting results)';
          hasAccuracyData = true;
        } else {
          hasAccuracyData = false;
        }
      }

      // Top predictions from PredictionTracker (real stored predictions)
      const storedRecent = predictionTracker.getRecentPredictions(3);
      if (storedRecent.length > 0) {
        topPredictions = storedRecent.map(pred => ({
          match: `${pred.homeTeam} vs ${pred.awayTeam}`,
          confidence: Math.round(pred.confidence * 100),
          prediction: pred.predictedResult === 'H' ? 'Home Win' :
                     pred.predictedResult === 'A' ? 'Away Win' : 'Draw',
          wasCorrect: pred.isCorrect !== undefined ? pred.isCorrect : null
        }));
      } else {
        // Fallback: show recent matches without prediction data
        topPredictions = recentMatches.slice(0, 3).map(match => ({
          match: `${match.home_team} vs ${match.away_team}`,
          confidence: 0,
          prediction: match.result === 'H' ? 'Home Win' :
                     match.result === 'A' ? 'Away Win' :
                     match.result === 'D' ? 'Draw' : 'Pending',
          wasCorrect: null
        }));
      }

      // Count upcoming predictions
      upcomingPredictions = realMatchData.length;
      
    } catch (err) {
      // Error loading dashboard data
      error = "Failed to load dashboard data";
    } finally {
      loading = false;
    }
  }

  function initProfitChart() {
    const monthlyPL = betHistoryService.getMonthlyPL();
    hasProfitData = monthlyPL.length > 0;

    if (!profitChartCanvas) return;

    const labels = monthlyPL.length > 0
      ? monthlyPL.map(m => m.month)
      : ['No data'];
    const data = monthlyPL.length > 0
      ? monthlyPL.map(m => m.profit)
      : [0];

    const ctx = profitChartCanvas.getContext('2d');
    if (ctx) {
      // Destroy any previous instance to prevent memory leaks on re-render
      if (profitChartInstance) {
        profitChartInstance.destroy();
      }
      profitChartInstance = new ChartJS(ctx as ChartItem, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Monthly Profit (£)',
            data,
            borderColor: 'hsl(var(--accent))',
            backgroundColor: 'hsla(var(--accent) / 0.1)',
            tension: 0.4,
            fill: true,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: themeScaleOptions,
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  onMount(() => {
    // Initialise date/time
    updateDateTime();
    const timeInterval = setInterval(updateDateTime, 1000);

    // Auto-retry with exponential backoff (max 3 attempts)
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function scheduleRetry() {
      if (retryCount >= MAX_RETRIES || !error || loading) return;
      const delay = 5000 * Math.pow(2, retryCount); // 5s, 10s, 20s
      retryTimeout = setTimeout(() => {
        if (error && !loading) {
          retryCount++;
          loadDashboardData().then(() => {
            initProfitChart();
            if (error) scheduleRetry();
          });
        }
      }, delay);
    }

    // Initial load
    loadDashboardData().then(() => {
      initProfitChart();
      if (error) scheduleRetry();
    });

    return () => {
      clearInterval(timeInterval);
      if (retryTimeout) clearTimeout(retryTimeout);
      if (profitChartInstance) {
        profitChartInstance.destroy();
        profitChartInstance = null;
      }
    };
  });
</script>

<div class="space-y-4">
  <!-- Hero Section (streamlined — stats moved to Stats Grid below) -->
  <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 via-white to-blue-50 dark:from-slate-950 dark:via-gray-950 dark:to-slate-900 p-5 sm:p-6 text-slate-900 dark:text-white animate-slide-in-up">
    <div class="absolute inset-0 dot-pattern opacity-[0.03] dark:opacity-[0.03]"></div>
    <div class="absolute -top-20 -right-20 w-64 h-64 bg-emerald-400/5 dark:bg-emerald-400/10 rounded-full blur-3xl"></div>
    <div class="absolute -bottom-16 -left-16 w-48 h-48 bg-blue-200/30 dark:bg-slate-800/40 rounded-full blur-3xl"></div>

    <div class="relative z-10">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-2.5 h-2.5 bg-emerald-500 dark:bg-emerald-400 rounded-full live-pulse"></div>
        <span class="text-emerald-600/80 dark:text-emerald-400/80 text-xs font-semibold tracking-wider uppercase">Match Predictions</span>
        <span class="text-slate-400 dark:text-white/50 text-xs ml-auto hidden sm:inline">
          {formattedDate} &middot; {formattedTime}
        </span>
      </div>
      <h1 class="text-2xl sm:text-3xl font-display font-extrabold mb-1 tracking-tight">
        Premier League Oracle
      </h1>
      <p class="text-slate-500 dark:text-white/60 text-sm max-w-xl">
        Five-component ensemble: ELO, Poisson, Form, H2H, and Standings
      </p>
    </div>
  </div>

  <!-- Stats Grid -->
  {#if loading}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {#each Array(4) as _, i}
        <Card class="card-glass p-4 animate-stagger" style="animation-delay: {i * 100}ms">
          <div class="skeleton w-8 h-8 rounded-lg mb-2"></div>
          <div class="skeleton h-3 w-20 mb-2"></div>
          <div class="skeleton h-6 w-24 mb-1"></div>
          <div class="skeleton h-3 w-16"></div>
        </Card>
      {/each}
    </div>
  {:else if error}
    <Card class="card-glass p-8 text-center border-destructive/20 animate-stagger">
      <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
        <Target class="w-6 h-6 text-destructive" />
      </div>
      <p class="text-destructive font-medium mb-1">{error}</p>
      <p class="text-sm text-muted-foreground mb-4">Check your API connection or try again</p>
      <Button on:click={loadDashboardData}>Retry</Button>
    </Card>
  {:else if !hasActivity}
    <!-- Onboarding state — shown when user has no predictions or bets yet -->
    <Card class="card-glass p-6 sm:p-8 animate-stagger" style="animation-delay: 200ms" data-testid="onboarding-card">
      <div class="max-w-lg mx-auto text-center">
        <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/20 flex items-center justify-center">
          <Target class="w-7 h-7 text-primary" />
        </div>
        <h3 class="text-lg font-display font-bold text-foreground mb-2">Ready to predict?</h3>
        <p class="text-sm text-muted-foreground mb-5 leading-relaxed">
          Generate match predictions using the Oracle's five-model ensemble — ELO ratings, Poisson distribution, form analysis, head-to-head records, and league standings. Track your accuracy over time.
        </p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <Button on:click={() => dispatch('navigate', { view: 'Predictions' })} data-testid="onboarding-cta">
            Generate Your First Prediction
          </Button>
          <Button variant="secondary" on:click={() => dispatch('navigate', { view: 'Standings' })}>
            View Standings
          </Button>
        </div>
      </div>
    </Card>
  {:else}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="stat-cards">
      {#each stats as stat, i}
        <Card
          class="card-glass p-4 hover:-translate-y-1 hover:shadow-glow-primary-sm animate-stagger"
          style="animation-delay: {200 + i * 80}ms"
          data-testid="stat-card"
        >
          <div class="flex items-center gap-2 mb-2">
            <div class="rounded-lg p-1.5 {stat.bgColor}">
              <svelte:component this={stat.icon} class="w-4 h-4 {stat.color}" />
            </div>
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</span>
          </div>
          <div class="text-xl font-display font-bold text-foreground">{stat.value}</div>
          <div class="text-xs text-muted-foreground mt-0.5">{stat.change}</div>
        </Card>
      {/each}
    </div>
  {/if}

  <!-- Charts Row -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
    <Card class="card-glass p-4 animate-stagger" style="animation-delay: 400ms">
      <h3 class="text-sm font-display font-semibold text-foreground mb-3">Prediction Accuracy Trend</h3>
      {#if !loading && !error && hasAccuracyData}
        <div class="h-44 sm:h-52" role="img" aria-label="Line chart showing prediction accuracy trend over recent matchdays">
          <Line data={recentPerformance} options={{ responsive: true, maintainAspectRatio: false, scales: themeScaleOptions, plugins: { legend: { labels: { color: 'hsl(var(--muted-foreground))' } } } }} />
        </div>
      {:else if !loading && !error}
        <div class="h-44 sm:h-52 flex flex-col items-center justify-center text-center" data-testid="accuracy-empty-state">
          <Target class="w-8 h-8 text-muted-foreground/30 mb-2" />
          <p class="text-sm font-medium text-foreground mb-1">No accuracy data yet</p>
          <p class="text-xs text-muted-foreground mb-3">Generate predictions and wait for results to track accuracy over time.</p>
          <Button variant="secondary" size="sm" on:click={() => dispatch('navigate', { view: 'Predictions' })}>Go to Predictions</Button>
        </div>
      {:else}
        <div class="h-44 sm:h-52 flex items-center justify-center">
          <div class="skeleton h-full w-full rounded-lg"></div>
        </div>
      {/if}
    </Card>
    <Card class="card-glass p-4 animate-stagger" style="animation-delay: 500ms">
      <h3 class="text-sm font-display font-semibold text-foreground mb-3">Profit/Loss Over Time</h3>
      {#if !loading && !error && hasProfitData}
        <div class="h-44 sm:h-52" role="img" aria-label="Line chart showing monthly profit and loss from tracked bets">
          <canvas bind:this={profitChartCanvas}></canvas>
        </div>
      {:else if !loading && !error}
        <div class="h-44 sm:h-52 flex flex-col items-center justify-center text-center" data-testid="profit-empty-state">
          <TrendingUp class="w-8 h-8 text-muted-foreground/30 mb-2" />
          <p class="text-sm font-medium text-foreground mb-1">Place your first bet to track P&L</p>
          <p class="text-xs text-muted-foreground mb-3">Use the Kelly Calculator or Value Bets to place tracked bets.</p>
          <Button variant="secondary" size="sm" on:click={() => dispatch('navigate', { view: 'Kelly Calculator' })}>Open Kelly Calculator</Button>
        </div>
      {:else}
        <div class="h-44 sm:h-52 flex items-center justify-center">
          <div class="skeleton h-full w-full rounded-lg"></div>
        </div>
      {/if}
    </Card>
  </div>

  <!-- How We Predict (collapsible) -->
  <Card class="card-glass p-4 animate-stagger" style="animation-delay: 600ms">
    <details>
      <summary class="cursor-pointer select-none list-none">
        <div class="flex items-center gap-2">
          <Target class="w-4 h-4 text-accent" />
          <span class="text-sm font-display font-semibold text-foreground">How We Predict</span>
          <ChevronDown class="w-4 h-4 text-muted-foreground ml-auto transition-transform details-chevron" />
        </div>
      </summary>
      <div class="mt-4">
        <div class="grid grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {#each [
            { icon: BarChart2, label: 'ELO Ratings', desc: '25% weight', iconColor: 'text-teal-400 dark:text-teal-300', bgColor: 'bg-teal-500/10 dark:bg-teal-500/20' },
            { icon: TrendingUp, label: 'Poisson Model', desc: '30% weight', iconColor: 'text-emerald-400 dark:text-emerald-300', bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20' },
            { icon: Users, label: 'Form Analysis', desc: '20% weight', iconColor: 'text-cyan-400 dark:text-cyan-300', bgColor: 'bg-cyan-500/10 dark:bg-cyan-500/20' },
            { icon: Target, label: 'Head-to-Head', desc: '10% weight', iconColor: 'text-purple-400 dark:text-purple-300', bgColor: 'bg-purple-500/10 dark:bg-purple-500/20' },
            { icon: Trophy, label: 'Standings', desc: '15% weight', iconColor: 'text-amber-400 dark:text-amber-300', bgColor: 'bg-amber-500/10 dark:bg-amber-500/20' },
          ] as method}
            <div class="text-center p-3 rounded-lg bg-muted/30 border border-border/30 transition-all duration-200 hover:bg-muted/50">
              <div class="w-8 h-8 {method.bgColor} rounded-lg mx-auto mb-2 flex items-center justify-center">
                <svelte:component this={method.icon} class="w-4 h-4 {method.iconColor}" />
              </div>
              <h4 class="font-semibold text-xs mb-0.5">{method.label}</h4>
              <p class="text-xs text-muted-foreground">{method.desc}</p>
            </div>
          {/each}
        </div>
        <div class="mt-3 p-3 bg-accent/5 rounded-lg border border-accent/10">
          <p class="text-xs text-muted-foreground">
            <strong class="text-accent">Ensemble Model:</strong> Combining {recentMatches.length} recent matches,
            current standings, and {upcomingPredictions} upcoming fixtures across five weighted components.
          </p>
        </div>
      </div>
    </details>
  </Card>

  <!-- Activity (tabbed: Predictions | Upcoming) -->
  <Card class="card-glass p-4 animate-stagger" style="animation-delay: 700ms">
    <div class="flex items-center gap-1 mb-4 border-b border-border/50">
      <button
        class="px-3 py-2 text-sm font-medium transition-colors relative {activityTab === 'predictions' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
        on:click={() => activityTab = 'predictions'}
        data-testid="tab-predictions"
      >
        Predictions
        {#if activityTab === 'predictions'}
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
        {/if}
      </button>
      <button
        class="px-3 py-2 text-sm font-medium transition-colors relative {activityTab === 'upcoming' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
        on:click={() => activityTab = 'upcoming'}
        data-testid="tab-upcoming"
      >
        Upcoming
        {#if realMatchData.length > 0}
          <span class="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{realMatchData.length}</span>
        {/if}
        {#if activityTab === 'upcoming'}
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
        {/if}
      </button>
    </div>

    {#if activityTab === 'predictions'}
      {#if loading}
        <div class="space-y-3">
          {#each Array(3) as _}
            <div class="flex justify-between items-center p-2">
              <div class="skeleton h-4 w-48"></div>
              <div class="skeleton h-5 w-16 rounded-full"></div>
            </div>
          {/each}
        </div>
      {:else if topPredictions.length === 0}
        <div class="text-center py-6">
          <Target class="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p class="text-sm font-medium text-foreground mb-1">No predictions yet</p>
          <p class="text-xs text-muted-foreground mb-3">Generate your first predictions to see them here.</p>
          <Button variant="secondary" size="sm" on:click={() => dispatch('navigate', { view: 'Predictions' })}>
            Go to Predictions
          </Button>
        </div>
      {:else}
        <ul class="space-y-2">
          {#each topPredictions as prediction}
            <li class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
              <span class="text-sm text-foreground truncate">{prediction.match}</span>
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted-foreground">{prediction.confidence}%</span>
                {#if prediction.wasCorrect !== null}
                  <Badge variant={prediction.wasCorrect ? 'success' : 'destructive'}>
                    {prediction.wasCorrect ? 'Correct' : 'Incorrect'}
                  </Badge>
                {:else}
                  <Badge variant="neutral">Pending</Badge>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      {#if realMatchData.length === 0}
        <div class="text-center py-6">
          <Calendar class="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p class="text-sm font-medium text-foreground mb-1">No upcoming matches</p>
          <p class="text-xs text-muted-foreground mb-3">Check back closer to the next matchday.</p>
          <Button variant="secondary" size="sm" on:click={() => dispatch('navigate', { view: 'Matches' })}>
            View All Matches
          </Button>
        </div>
      {:else}
        <ul class="space-y-2">
          {#each realMatchData.slice(0, 5) as match}
            <li class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
              <span class="text-sm text-foreground">{match.home_team} vs {match.away_team}</span>
              <span class="text-xs text-muted-foreground">
                {format(new Date(match.date), 'EEE d MMM, HH:mm')}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
      <Button variant="secondary" size="sm" class="mt-3 w-full" data-testid="view-all-matches" on:click={() => dispatch('navigate', { view: 'Matches' })}>View All Matches</Button>
    {/if}
  </Card>
</div>

<style>
  details[open] .details-chevron {
    transform: rotate(180deg);
  }
</style>
