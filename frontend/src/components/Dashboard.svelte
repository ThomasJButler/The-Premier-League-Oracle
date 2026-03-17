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
  import { TrendingUp, Users, Target, BarChart2 } from 'lucide-svelte';
  ChartJS.register(
    Title,
    Tooltip,
    Legend,
    LineElement,
    LinearScale,
    CategoryScale,
    PointElement
  );

  let recentMatches: Match[] = [];
  let predictionAccuracy: number[] = [];
  let topPredictions: any[] = [];
  let loading = true;
  let error: string | null = null;
  let overallAccuracy = tweened(0, { duration: 1500, easing: cubicOut });
  let profitMargin = tweened(0, { duration: 1800, easing: cubicOut });
  let totalPredictions = tweened(0, { duration: 1200, easing: cubicOut });
  let betsPlaced = tweened(0, { duration: 1400, easing: cubicOut });

  let recentPerformance: ChartData<"line", number[], string> = {
    labels: [] as string[],
    datasets: [{
      label: 'Prediction Accuracy',
      data: [] as number[],
      borderColor: '#4299e1',
      tension: 0.4,
      fill: false
    }]
  };

  let upcomingPredictions = 0;
  let realMatchData: Match[] = [];
  let accuracyChange = '';
  let profitChange = '';
  let predictionsChange = '';
  let betsChange = '';
  
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

  // Reactive stats that update with animations
  $: stats = [
    {
      title: 'Prediction Accuracy',
      value: `${$overallAccuracy.toFixed(1)}%`,
      change: accuracyChange,
      icon: Target,
      color: 'text-primary dark:text-primary-light',
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
  }
  
  async function loadDashboardData() {
    try {
      loading = true;
      error = null;
      
      // Data provider is Football-Data.org (configured in Settings)

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
      } else {
        // Fallback: show recent predictions' confidence as a proxy until results settle
        const recentPreds = predictionTracker.getRecentPredictions(5);
        if (recentPreds.length > 0) {
          recentPerformance.labels = [...recentPreds]
            .reverse()
            .map(p => format(new Date(p.timestamp), 'MMM d'));
          recentPerformance.datasets[0].data = [...recentPreds].reverse().map(p => p.confidence * 100);
        } else {
          // No predictions at all — flat line at overall accuracy
          recentPerformance.labels = recentMatches
            .slice(0, 5)
            .map(match => format(new Date(match.date), 'MMM d'));
          recentPerformance.datasets[0].data = recentMatches.slice(0, 5).map(() => realAccuracy);
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
    if (!profitChartCanvas) return;

    const monthlyPL = betHistoryService.getMonthlyPL();
    const labels = monthlyPL.length > 0
      ? monthlyPL.map(m => m.month)
      : ['No data'];
    const data = monthlyPL.length > 0
      ? monthlyPL.map(m => m.profit)
      : [0];

    const ctx = profitChartCanvas.getContext('2d');
    if (ctx) {
      new ChartJS(ctx as ChartItem, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Monthly Profit (£)',
            data,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            fill: true,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(148, 163, 184, 0.1)' },
              ticks: { color: '#94a3b8' }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8' }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  onMount(() => {
    loadDashboardData().then(() => {
      // Initialise profit chart after data is loaded
      initProfitChart();
    });

    // Initialise date/time
    updateDateTime();

    // Update time every second
    const timeInterval = setInterval(updateDateTime, 1000);

    // Auto-retry if there's an error
    const retryInterval = setInterval(() => {
      if (error && !loading) {
        loadDashboardData();
      }
    }, 5000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(retryInterval);
    };
  });
</script>

<div class="space-y-6">
  <!-- Hero Section -->
  <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-6 sm:p-8 text-white animate-slide-in-up">
    <div class="relative z-10">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-2.5 h-2.5 bg-green-400 rounded-full live-pulse"></div>
        <span class="text-green-200 text-xs font-semibold tracking-wider uppercase">Live Predictions</span>
        <span class="text-blue-200 text-xs ml-auto hidden sm:inline">
          {formattedDate} &middot; {formattedTime}
        </span>
      </div>
      <h1 class="text-3xl sm:text-4xl font-display font-extrabold mb-2">
        Premier League Oracle
      </h1>
      <p class="text-blue-100 text-sm sm:text-base mb-6 max-w-xl">
        AI-powered predictions using ELO ratings, Poisson models, and real-time data analysis
      </p>

      <!-- Quick stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="text-center p-3 bg-white/10 rounded-lg">
          <div class="text-xl sm:text-2xl font-display font-bold">{$overallAccuracy.toFixed(1)}%</div>
          <div class="text-xs text-blue-200 mt-0.5">Accuracy</div>
        </div>
        <div class="text-center p-3 bg-white/10 rounded-lg">
          <div class="text-xl sm:text-2xl font-display font-bold">&pound;{$profitMargin.toFixed(0)}</div>
          <div class="text-xs text-blue-200 mt-0.5">Profit</div>
        </div>
        <div class="text-center p-3 bg-white/10 rounded-lg">
          <div class="text-xl sm:text-2xl font-display font-bold">{upcomingPredictions}</div>
          <div class="text-xs text-blue-200 mt-0.5">Upcoming</div>
        </div>
        <div class="text-center p-3 bg-white/10 rounded-lg">
          <div class="text-xl sm:text-2xl font-display font-bold">{recentMatches.length}</div>
          <div class="text-xs text-blue-200 mt-0.5">Matches</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Stats Grid -->
  {#if loading}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {#each Array(4) as _, i}
        <div class="rounded-xl border border-border bg-card p-5">
          <div class="skeleton w-10 h-10 rounded-lg mb-3"></div>
          <div class="skeleton h-3 w-20 mb-2"></div>
          <div class="skeleton h-7 w-28 mb-2"></div>
          <div class="skeleton h-3 w-16"></div>
        </div>
      {/each}
    </div>
  {:else if error}
    <div class="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
      <p class="text-destructive font-medium">{error}</p>
      <button on:click={loadDashboardData} class="btn btn-primary mt-4">Retry</button>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {#each stats as stat, i}
        <div
          class="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          style="animation-delay: {i * 80}ms"
        >
          <div class="flex items-center gap-3 mb-3">
            <div class="rounded-lg p-2 {stat.bgColor}">
              <svelte:component this={stat.icon} class="w-5 h-5 {stat.color}" />
            </div>
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</span>
          </div>
          <div class="text-2xl font-display font-bold text-foreground">{stat.value}</div>
          <div class="text-xs text-muted-foreground mt-1">{stat.change}</div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Charts Row -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div class="rounded-xl border border-border bg-card p-5 animate-slide-in-up" style="animation-delay: 200ms">
      <h3 class="text-sm font-display font-semibold text-foreground mb-4">Prediction Accuracy Trend</h3>
      <div class="h-56">
        <Line data={recentPerformance} options={{ responsive: true, maintainAspectRatio: false }} />
      </div>
    </div>
    <div class="rounded-xl border border-border bg-card p-5 animate-slide-in-up" style="animation-delay: 300ms">
      <h3 class="text-sm font-display font-semibold text-foreground mb-4">Profit/Loss Over Time</h3>
      <div class="h-56">
        <canvas bind:this={profitChartCanvas}></canvas>
      </div>
    </div>
  </div>

  <!-- How We Predict -->
  <div class="rounded-xl border border-border bg-card p-5 animate-slide-in-up" style="animation-delay: 400ms">
    <h3 class="text-sm font-display font-semibold text-foreground mb-4 flex items-center gap-2">
      <Target class="w-4 h-4 text-primary" />
      How We Predict
    </h3>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {#each [
        { icon: BarChart2, label: 'ELO Ratings', desc: 'Dynamic team strength', iconColor: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
        { icon: TrendingUp, label: 'Poisson Model', desc: 'Goal probability', iconColor: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
        { icon: Users, label: 'Form Analysis', desc: 'Recent trends', iconColor: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
        { icon: Target, label: 'Home Advantage', desc: 'Venue adjustments', iconColor: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
      ] as method}
        <div class="text-center p-3 rounded-lg bg-muted/50">
          <div class="w-8 h-8 {method.bgColor} rounded-lg mx-auto mb-2 flex items-center justify-center">
            <svelte:component this={method.icon} class="w-4 h-4 {method.iconColor}" />
          </div>
          <h4 class="font-semibold text-xs mb-0.5">{method.label}</h4>
          <p class="text-xs text-muted-foreground">{method.desc}</p>
        </div>
      {/each}
    </div>
    <div class="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
      <p class="text-xs text-muted-foreground">
        <strong class="text-foreground">Live Calculation:</strong> Processing {recentMatches.length} recent matches,
        current standings, and {upcomingPredictions} upcoming fixtures with statistical models.
      </p>
    </div>
  </div>

  <!-- Recent Predictions + Upcoming Matches -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <div class="lg:col-span-2 rounded-xl border border-border bg-card p-5 animate-slide-in-up" style="animation-delay: 500ms">
      <h3 class="text-sm font-display font-semibold text-foreground mb-4">Recent Predictions</h3>
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
        <div class="text-center py-8">
          <p class="text-sm text-muted-foreground">No predictions available yet</p>
        </div>
      {:else}
        <ul class="space-y-2">
          {#each topPredictions as prediction}
            <li class="flex justify-between items-center p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
              <span class="text-sm text-foreground">{prediction.match}</span>
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted-foreground">{prediction.confidence}%</span>
                {#if prediction.wasCorrect !== null}
                  <span class="badge {prediction.wasCorrect ? 'badge-success' : 'badge-error'}">
                    {prediction.wasCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                {:else}
                  <span class="badge badge-neutral">Pending</span>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    <div class="rounded-xl border border-border bg-card p-5 animate-slide-in-up" style="animation-delay: 600ms">
      <h3 class="text-sm font-display font-semibold text-foreground mb-4">Upcoming Matches</h3>
      <ul class="space-y-3">
        {#each realMatchData.slice(0, 5) as match}
          <li class="text-sm">
            <span class="text-foreground">{match.home_team} vs {match.away_team}</span>
            <span class="block text-xs text-muted-foreground mt-0.5">
              {format(new Date(match.date), 'EEE d MMM, HH:mm')}
            </span>
          </li>
        {/each}
        {#if realMatchData.length === 0}
          <li class="text-sm text-muted-foreground">No upcoming matches</li>
        {/if}
      </ul>
      <button class="btn btn-secondary btn-sm mt-4 w-full" on:click={() => dispatch('navigate', { view: 'Matches' })}>View All Matches</button>
    </div>
  </div>
</div>
