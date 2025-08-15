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
    type ChartData
  } from 'chart.js';
  import { dataService } from '../services/dataService';
  import type { Match } from '../types';
  import { format } from 'date-fns';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { TrendingUp, Users, Target, BarChart2 } from 'lucide-svelte';
  import DataFreshness from './DataFreshness.svelte';
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

  let totalProfit = 1250.50;
  let winRate = 62.5;
  let upcomingPredictions = 5;
  let highRiskBets = 2;

  let profitChartCanvas: HTMLCanvasElement;

  // Reactive stats that update with animations
  $: stats = [
    {
      title: 'Prediction Accuracy',
      value: `${$overallAccuracy.toFixed(1)}%`,
      change: '+2.1%',
      icon: Target,
      color: 'text-primary dark:text-primary-light',
      bgColor: 'bg-primary/10 dark:bg-primary/20'
    },
    {
      title: 'Total Profit',
      value: `£${$profitMargin.toLocaleString()}`,
      change: '+£150 this week',
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20'
    },
    {
      title: 'Active Users',
      value: $totalPredictions.toLocaleString(),
      change: '+50 today',
      icon: Users,
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-500/10 dark:bg-sky-500/20'
    },
    {
      title: 'Bets Placed',
      value: $betsPlaced.toLocaleString(),
      change: '+120 this week',
      icon: BarChart2,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10 dark:bg-amber-500/20'
    }
  ];

  async function loadDashboardData() {
    try {
      loading = true;
      error = null;

      recentMatches = await dataService.getCurrentSeasonMatches();
      
      if (recentMatches.length === 0) {
        error = "No matches found for the current season";
        return;
      }

      predictionAccuracy = [75, 82, 78, 85, 80];
      const avgAccuracy = predictionAccuracy.reduce((a, b) => a + b, 0) / predictionAccuracy.length;
      
      // Animate counters with staggered timing for epic effect
      setTimeout(() => overallAccuracy.set(avgAccuracy), 300);
      setTimeout(() => profitMargin.set(1280), 600);
      setTimeout(() => totalPredictions.set(1450), 900);
      setTimeout(() => betsPlaced.set(3210), 1200);

      recentPerformance.labels = recentMatches
        .slice(0, 5)
        .map(match => format(new Date(match.date), 'MMM d'));
      recentPerformance.datasets[0].data = predictionAccuracy;

      topPredictions = recentMatches.slice(0, 3).map(match => ({
        match: `${match.home_team} vs ${match.away_team}`,
        confidence: Math.round(Math.random() * 20 + 70),
        prediction: match.result || 'Pending'
      }));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      error = "Failed to load dashboard data";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadDashboardData();

    const ctx = profitChartCanvas.getContext('2d');
    if (ctx) {
      new ChartJS(ctx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            label: 'Monthly Profit',
            data: [150, 220, 180, 300, 250, 400],
            borderColor: 'hsl(var(--primary-hsl) 50%)',
            backgroundColor: 'hsla(var(--primary-hsl) 50% / 0.1)',
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
              grid: {
                color: 'hsla(var(--text-base) / 0.1)'
              },
              ticks: {
                 color: 'hsl(var(--text-muted))'
              }
            },
            x: {
               grid: {
                display: false
              },
              ticks: {
                 color: 'hsl(var(--text-muted))'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }
  });
</script>

<div class="space-y-8 animate-fade-in">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <h1 class="text-3xl font-bold gradient-text">Dashboard Overview</h1>
    <DataFreshness />
  </div>

  <!-- Stats Grid -->
  {#if loading}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {#each Array(4) as _, i}
        <div class="card-stats">
          <div class="skeleton w-12 h-12 rounded-lg mb-3"></div>
          <div class="skeleton h-4 w-24 mb-2"></div>
          <div class="skeleton h-8 w-32 mb-2"></div>
          <div class="skeleton h-3 w-20"></div>
        </div>
      {/each}
    </div>
  {:else if error}
    <div class="p-8 text-center bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
      <p class="text-red-600 dark:text-red-400">{error}</p>
      <button on:click={loadDashboardData} class="btn btn-primary mt-4">Retry</button>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {#each stats as stat, i}
        <div class="card-stats animate-float-subtle" style="animation-delay: {i * 100}ms">
          <div class="stat-icon-wrapper {stat.bgColor}">
            <svelte:component this={stat.icon} class="w-6 h-6 {stat.color}" />
          </div>
          <div class="stat-label">{stat.title}</div>
          <div class="stat-value">{stat.value}</div>
          <div class="stat-change {stat.change.startsWith('+') ? 'text-success dark:text-success-light' : 'text-error dark:text-error-light'}">
            {stat.change}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Charts Row -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="chart-container animate-slide-in-up" style="animation-delay: 400ms">
      <h3 class="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Prediction Accuracy Trend</h3>
      <div class="h-64">
        <Line data={recentPerformance} options={{ responsive: true, maintainAspectRatio: false }} />
      </div>
    </div>
    <div class="chart-container animate-slide-in-up" style="animation-delay: 500ms">
      <h3 class="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Profit/Loss Over Time</h3>
      <div class="h-64">
        <canvas bind:this={profitChartCanvas}></canvas>
      </div>
    </div>
  </div>

  <!-- Recent Activity/Matches -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2 card card-glass animate-slide-in-up" style="animation-delay: 600ms">
      <h3 class="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Recent Predictions</h3>
      {#if loading}
        <div class="space-y-3">
          {#each Array(3) as _}
            <div class="flex justify-between items-center p-2">
              <div class="skeleton h-4 w-48"></div>
              <div class="skeleton h-6 w-20 rounded-full"></div>
            </div>
          {/each}
        </div>
      {:else if topPredictions.length === 0}
        <div class="text-center py-8 text-slate-500 dark:text-slate-400">
          <p>No predictions available yet</p>
        </div>
      {:else}
        <ul class="space-y-3">
          <li class="flex justify-between items-center p-2 rounded hover:bg-primary/5">
            <span>Man City vs Arsenal (Prediction: H)</span>
            <span class="badge badge-success">Correct</span>
          </li>
          <li class="flex justify-between items-center p-2 rounded hover:bg-primary/5">
            <span>Liverpool vs Chelsea (Prediction: D)</span>
            <span class="badge badge-error">Incorrect</span>
          </li>
          <li class="flex justify-between items-center p-2 rounded hover:bg-primary/5">
            <span>Spurs vs Man Utd (Prediction: A)</span>
            <span class="badge badge-success">Correct</span>
          </li>
        </ul>
      {/if}
    </div>
    <div class="card card-glass animate-slide-in-up" style="animation-delay: 700ms">
      <h3 class="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Upcoming Matches</h3>
      <ul class="space-y-2">
        <li class="text-sm text-slate-500 dark:text-slate-400">Everton vs Brighton</li>
        <li class="text-sm text-slate-500 dark:text-slate-400">Fulham vs Wolves</li>
        <li class="text-sm text-slate-500 dark:text-slate-400">West Ham vs Aston Villa</li>
      </ul>
      <button class="btn btn-secondary btn-sm mt-4 w-full">View All Matches</button>
    </div>
  </div>
</div>

<style global lang="postcss">
  .shadow-glow-warning-sm {
    box-shadow: 0 0 8px hsla(39, 90%, 55%, 0.3), inset 0 0 10px hsla(39, 90%, 55%, 0.05);
  }
  .shadow-glow-warning-md {
    box-shadow: 0 0 15px hsla(39, 90%, 55%, 0.4), inset 0 0 15px hsla(39, 90%, 55%, 0.1);
  }
</style>