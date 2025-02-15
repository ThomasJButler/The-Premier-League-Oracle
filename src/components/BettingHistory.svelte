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

  let performanceData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
    datasets: [{
      label: 'ROI %',
      data: [10, 15, 8, 20, 12],
      borderColor: '#4299e1',
      tension: 0.4,
      fill: false
    }]
  };

  onMount(() => {
    // Initialize betting history data
  });
</script>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h2 class="text-2xl font-bold">Betting History</h2>
    <div class="flex items-center space-x-4">
      <div class="stat-card">
        <div class="stat-label">Total Profit</div>
        <div class="stat-value">$50</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">ROI</div>
        <div class="stat-value">12.5%</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h3 class="text-xl font-semibold mb-4">Performance Trend</h3>
    <Line
      data={performanceData}
      options={{
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            type: 'linear'
          },
          x: {
            type: 'category'
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        }
      }}
    />
  </div>

  <div class="card">
    <h3 class="text-xl font-semibold mb-4">Recent Bets</h3>
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead>
          <tr class="bg-gray-50">
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Match</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prediction</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stake</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Odds</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each bets as bet}
            <tr>
              <td class="px-6 py-4 whitespace-nowrap">{bet.match}</td>
              <td class="px-6 py-4 whitespace-nowrap">{bet.prediction}</td>
              <td class="px-6 py-4 whitespace-nowrap">${bet.stake}</td>
              <td class="px-6 py-4 whitespace-nowrap">{bet.odds}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full {bet.result === 'Won' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                  {bet.result}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap {bet.profit > 0 ? 'text-green-600' : 'text-red-600'}">
                ${bet.profit}
              </td>
            </tr>
          {/each}
          }
        </tbody>
      </table>
    </div>
  </div>
</div>