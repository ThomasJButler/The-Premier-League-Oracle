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
    type ChartData // Import ChartData as type
  } from 'chart.js';
  import { getCurrentSeasonMatches, getTeamForm, type Match } from '../lib/supabase';
  import { format } from 'date-fns';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  // Register Chart.js components
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
  let overallAccuracy = tweened(0, { duration: 800, easing: cubicOut });
  let profitMargin = tweened(0, { duration: 1000, easing: cubicOut });
  let totalPredictions = tweened(0, { duration: 600, easing: cubicOut });

  let recentPerformance: ChartData<"line", number[], string> = { // Explicitly type labels and data
    labels: [] as string[],
    datasets: [{
      label: 'Prediction Accuracy',
      data: [] as number[],
      borderColor: '#4299e1',
      tension: 0.4,
      fill: false
    }]
  };

  async function loadDashboardData() {
    try {
      loading = true;
      error = null;

      // Fetch recent matches
      recentMatches = await getCurrentSeasonMatches();
      
      if (recentMatches.length === 0) {
        error = "No matches found for the current season";
        return;
      }

      // Calculate prediction accuracy (mock data for now)
      predictionAccuracy = [75, 82, 78, 85, 80];
      const avgAccuracy = predictionAccuracy.reduce((a, b) => a + b, 0) / predictionAccuracy.length;
      overallAccuracy.set(Math.round(avgAccuracy));
      
      // Mock profit margin and total predictions
      profitMargin.set(2451);
      totalPredictions.set(187);

      // Update chart data
      recentPerformance.labels = recentMatches
        .slice(0, 5)
        .map(match => format(new Date(match.date), 'MMM d'));
      recentPerformance.datasets[0].data = predictionAccuracy;

      // Get top predictions
      topPredictions = recentMatches.slice(0, 3).map(match => ({
        match: `${match.home_team} vs ${match.away_team}`,
        confidence: Math.round(Math.random() * 20 + 70), // Mock confidence scores
        prediction: match.result || 'Pending'
      }));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      error = "Failed to load dashboard data";
    } finally {
      loading = false;
    }
  }

  onMount(loadDashboardData);
</script>

<div class="space-y-8 animate-fade-in">
  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
    </div>
  {:else if error}
    <div class="card p-6 text-center">
      <p class="text-red-600 dark:text-red-400">{error}</p>
      <button class="btn btn-primary mt-4" on:click={loadDashboardData}>
        Retry
      </button>
    </div>
  {:else}
    <!-- Stats overview section -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="card-stats animate-float hover-glow" style="animation-delay: 0ms">
        <div class="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full mb-3">
          <svg class="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300">Prediction Accuracy</h3>
        <p class="stat-value animate-bounce-in">{$overallAccuracy}%</p>
        <p class="stat-trend-up text-sm font-medium">7% increase</p>
      </div>

      <div class="card-stats animate-float hover-glow" style="animation-delay: 150ms">
        <div class="bg-green-100 dark:bg-green-900/30 p-3 rounded-full mb-3">
          <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300">Profit Margin</h3>
        <p class="stat-value animate-bounce-in">£{$profitMargin.toFixed(0)}</p>
        <p class="stat-trend-up text-sm font-medium">£325 this month</p>
      </div>

      <div class="card-stats animate-float hover-glow" style="animation-delay: 300ms">
        <div class="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full mb-3">
          <svg class="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300">Total Predictions</h3>
        <p class="stat-value animate-bounce-in">{$totalPredictions}</p>
        <p class="text-sm font-medium text-purple-600 dark:text-purple-400">21 this week</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Top Predictions -->
      <div class="card card-glass lg:col-span-1 hover-scale">
        <h3 class="text-xl font-semibold mb-4 gradient-text">Top Predictions</h3>
        <div class="space-y-3">
          {#each topPredictions as prediction}
            <div class="flex justify-between items-center p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors duration-200">
              <span class="text-sm dark:text-slate-300">{prediction.match}</span>
              <div class="flex items-center space-x-2">
                <span class="text-xs font-semibold text-primary dark:text-primary-400">{prediction.confidence}%</span>
                <span class="badge {
                  prediction.prediction === 'H' ? 'badge-success' :
                  prediction.prediction === 'A' ? 'badge-error' :
                  prediction.prediction === 'D' ? 'badge-warning' :
                  'badge-neutral'
                } text-xs px-1.5 py-0.5">
                  {prediction.prediction === 'H' ? 'Home' :
                   prediction.prediction === 'A' ? 'Away' :
                   prediction.prediction === 'D' ? 'Draw' :
                   'Pending'}
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Performance Chart -->
      <div class="card card-glass lg:col-span-2 hover-scale">
        <h3 class="text-xl font-semibold mb-4 gradient-text">Performance Trend</h3>
        <div class="chart-container">
          <Line
            data={recentPerformance}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  grid: {
                    color: 'rgba(156, 163, 175, 0.1)'
                  },
                  ticks: {
                    color: 'rgb(107 114 128 / var(--tw-text-opacity))'
                  }
                },
                x: {
                  grid: {
                    color: 'rgba(156, 163, 175, 0.1)'
                  },
                  ticks: {
                    color: 'rgb(107 114 128 / var(--tw-text-opacity))'
                  }
                }
              },
              plugins: {
                legend: {
                  display: true,
                  position: 'top',
                  labels: {
                    color: 'rgb(107 114 128 / var(--tw-text-opacity))'
                  }
                }
              }
            }}
          />
        </div>
      </div>
    </div>

    <!-- Recent Matches Table -->
    <div class="card card-glass col-span-full hover-scale">
      <h3 class="text-xl font-semibold mb-4 gradient-text">Recent Matches</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead class="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Match</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Result</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Score</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-slate-900/30 divide-y divide-slate-200 dark:divide-slate-700/50">
            {#each recentMatches.slice(0, 5) as match}
              <tr class="hover:bg-slate-100/50 dark:hover:bg-slate-800/70 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-200">
                  {match.home_team} vs {match.away_team}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  {#if match.result}
                    <span class="badge {
                      match.result === 'H' ? 'badge-success' :
                      match.result === 'A' ? 'badge-error' :
                      'badge-warning'
                    }">
                      {match.result === 'H' ? 'Home Win' :
                       match.result === 'A' ? 'Away Win' :
                       'Draw'}
                    </span>
                  {:else}
                    <span class="badge badge-neutral">Upcoming</span>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                  {match.home_goals !== null ? `${match.home_goals} - ${match.away_goals}` : '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                  {format(new Date(match.date), 'MMM d, yyyy')}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>