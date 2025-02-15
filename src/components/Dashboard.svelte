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
    PointElement
  } from 'chart.js';
  import { getCurrentSeasonMatches, getTeamForm, type Match } from '../lib/supabase';
  import { format } from 'date-fns';

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

  let recentPerformance = {
    labels: [],
    datasets: [{
      label: 'Prediction Accuracy',
      data: [],
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

<div class="space-y-6">
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
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- AI Confidence Score -->
      <div class="card">
        <h3 class="text-xl font-semibold mb-4 gradient-text">AI Confidence Score</h3>
        <div class="flex items-center justify-center">
          <div class="relative w-32 h-32">
            <svg class="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
              <circle
                class="text-gray-200 dark:text-dark-bg"
                stroke-width="8"
                stroke="currentColor"
                fill="transparent"
                r="40"
                cx="50"
                cy="50"
              />
              <circle
                class="text-primary transition-all duration-1000"
                stroke-width="8"
                stroke="currentColor"
                fill="transparent"
                r="40"
                cx="50"
                cy="50"
                stroke-dasharray="251.2"
                stroke-dashoffset="50.24"
              />
            </svg>
            <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <span class="text-2xl font-bold gradient-text">80%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Predictions -->
      <div class="card">
        <h3 class="text-xl font-semibold mb-4 gradient-text">Top Predictions</h3>
        <div class="space-y-4">
          {#each topPredictions as prediction}
            <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
              <span class="dark:text-dark-text">{prediction.match}</span>
              <div class="flex items-center">
                <span class="text-sm font-semibold text-primary dark:text-primary-400">{prediction.confidence}%</span>
                <span class="ml-2 badge {
                  prediction.prediction === 'H' ? 'badge-success' :
                  prediction.prediction === 'A' ? 'badge-error' :
                  prediction.prediction === 'D' ? 'badge-warning' :
                  'badge-warning'
                }">
                  {prediction.prediction === 'H' ? 'Home Win' :
                   prediction.prediction === 'A' ? 'Away Win' :
                   prediction.prediction === 'D' ? 'Draw' :
                   'Pending'}
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Performance Chart -->
      <div class="card">
        <h3 class="text-xl font-semibold mb-4 gradient-text">Performance Trend</h3>
        <div class="chart-container">
          <Line
            data={recentPerformance}
            options={{
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  grid: {
                    color: 'rgba(156, 163, 175, 0.1)'
                  },
                  ticks: {
                    color: '#6B7280'
                  }
                },
                x: {
                  grid: {
                    color: 'rgba(156, 163, 175, 0.1)'
                  },
                  ticks: {
                    color: '#6B7280'
                  }
                }
              },
              plugins: {
                legend: {
                  display: true,
                  position: 'top',
                  labels: {
                    color: '#6B7280'
                  }
                }
              }
            }}
          />
        </div>
      </div>

      <!-- Recent Matches -->
      <div class="card col-span-full">
        <h3 class="text-xl font-semibold mb-4 gradient-text">Recent Matches</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr class="bg-gray-50 dark:bg-dark-bg">
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Match</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Result</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Score</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-dark-border">
              {#each recentMatches.slice(0, 5) as match}
                <tr class="hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors duration-150">
                  <td class="px-6 py-4 whitespace-nowrap dark:text-dark-text">
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
                      <span class="badge badge-warning">Upcoming</span>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap dark:text-dark-text">
                    {match.home_goals !== null ? `${match.home_goals} - ${match.away_goals}` : '-'}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {format(new Date(match.date), 'MMM d, yyyy')}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>