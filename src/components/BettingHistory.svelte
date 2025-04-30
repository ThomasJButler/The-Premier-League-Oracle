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

  let bets = [
    {
      match: 'Manchester United vs Liverpool',
      prediction: 'Home Win',
      stake: 100,
      odds: 2.5,
      result: 'Won',
      profit: 150
    },
    {
      match: 'Arsenal vs Chelsea',
      prediction: 'Home Win',
      stake: 100,
      odds: 1.9,
      result: 'Lost',
      profit: -100
    }
  ];

  let totalProfit = tweened(0, { duration: 800, easing: cubicOut });
  let roi = tweened(0, { duration: 800, easing: cubicOut });

  let performanceData: ChartData<"line", number[], string> = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
    datasets: [{
      label: 'ROI %',
      data: [], // Explicitly typed as number[] now
      borderColor: 'var(--primary)', // Use CSS variable
      tension: 0.4,
      fill: true,
      backgroundColor: 'rgba(59, 130, 246, 0.1)' // Example light blue fill
    }]
  };

  onMount(() => {
    // Mock data update
    const profit = bets.reduce((sum, bet) => sum + bet.profit, 0);
    const totalStake = bets.reduce((sum, bet) => sum + bet.stake, 0);
    totalProfit.set(profit);
    roi.set(totalStake > 0 ? (profit / totalStake) * 100 : 0);
    performanceData.datasets[0].data = [10, 15, 8, 20, 12]; // Update chart data
  });
</script>

<div class="space-y-8 animate-fade-in">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <div>
      <h2 class="text-2xl font-bold gradient-text">Betting History</h2>
      <p class="text-slate-600 dark:text-slate-400 mt-1">Track your betting performance</p>
    </div>
    <div class="flex items-center space-x-4">
      <div class="card-stats !p-4 !flex-row items-center gap-3 hover-glow">
        <div class="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
          <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <div>
          <div class="stat-label !text-xs">Total Profit</div>
          <div class="stat-value !text-xl {$totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
            £{$totalProfit.toFixed(0)}
          </div>
        </div>
      </div>
      <div class="card-stats !p-4 !flex-row items-center gap-3 hover-glow">
        <div class="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-full">
           <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
        </div>
        <div>
          <div class="stat-label !text-xs">ROI</div>
          <div class="stat-value !text-xl {$roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
            {$roi.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="card card-glass hover-scale">
    <h3 class="text-xl font-semibold mb-4 gradient-text">Performance Trend (ROI %)</h3>
    <div class="chart-container h-64">
      <Line
        data={performanceData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
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
              display: false
            }
          }
        }}
      />
    </div>
  </div>

  <div class="card card-glass hover-scale">
    <h3 class="text-xl font-semibold mb-4 gradient-text">Recent Bets</h3>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead class="bg-slate-50 dark:bg-slate-800/50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Match</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prediction</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stake</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Odds</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Result</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Profit</th>
          </tr>
        </thead>
        <tbody class="bg-white/70 dark:bg-slate-900/30 divide-y divide-slate-200/70 dark:divide-slate-700/50">
          {#each bets as bet}
            <tr class="hover:bg-slate-100/50 dark:hover:bg-slate-800/70 transition-colors duration-150">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-200">{bet.match}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">{bet.prediction}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">£{bet.stake.toFixed(2)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">{bet.odds.toFixed(2)}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="badge {bet.result === 'Won' ? 'badge-success' : 'badge-error'}">
                  {bet.result}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {bet.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
                {bet.profit >= 0 ? '+' : ''}£{bet.profit.toFixed(2)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>