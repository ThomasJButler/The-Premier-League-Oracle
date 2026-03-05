<script lang="ts">
  import { onMount } from 'svelte';
  import { Bar, Line } from 'svelte-chartjs';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale,
    type ChartData
  } from 'chart.js';
  import { format } from 'date-fns';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { TrendingUp, TrendingDown, Scale, Filter, Download, DollarSign, Minus } from 'lucide-svelte';
  import { formatDistanceToNow } from 'date-fns';

  ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

  let bets: any[] = []; // TODO: replace with BetHistoryService — see specs/04-betting-intelligence.md
  let loading = true;
  let error: string | null = null;

  let totalWagered = tweened(0, { duration: 800, easing: cubicOut });
  let totalProfitLoss = tweened(0, { duration: 1000, easing: cubicOut });
  let roi = tweened(0, { duration: 1200, easing: cubicOut });

  let monthlyPerformance: ChartData<"bar", number[], string> = {
    labels: [] as string[],
    datasets: [{
      label: 'Monthly Profit/Loss',
      data: [] as number[],
      backgroundColor: [],
      borderColor: [],
      borderWidth: 1
    }]
  };

  let performanceData: ChartData<"line", number[], string> = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
    datasets: [{
      label: 'ROI %',
      data: [] as number[],
      borderColor: 'hsl(var(--primary-hsl) 50%)',
      tension: 0.4,
      fill: true,
      backgroundColor: 'hsla(var(--primary-hsl), 50%, 0.1)'
    }]
  };

  async function loadBettingHistory() {
    loading = true;
    error = null;
    try {
      // bets = await getBettingHistory(); // Commented out
      // Mock data for now:
      bets = [
        { id: 1, match_description: 'Man City vs Liverpool', bet_type: 'Home Win', stake: 10, odds: 2.5, result: 'win', payout: 25, date: new Date(Date.now() - 86400000 * 2) },
        { id: 2, match_description: 'Arsenal vs Chelsea', bet_type: 'Draw', stake: 5, odds: 3.1, result: 'loss', payout: 0, date: new Date(Date.now() - 86400000 * 5) },
        { id: 3, match_description: 'Spurs vs Man United', bet_type: 'Away Win', stake: 20, odds: 2.8, result: 'pending', payout: null, date: new Date(Date.now() - 86400000 * 1) },
      ];
      await new Promise(resolve => setTimeout(resolve, 700)); // Simulate loading
    } catch (err) {
      error = 'Failed to load betting history.';
      // Error loading betting history
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadBettingHistory();
  });

  function getResultIcon(result: string) {
    switch (result) {
      case 'win': return TrendingUp;
      case 'loss': return TrendingDown;
      default: return Minus;
    }
  }

  function getResultColor(result: string) {
    switch (result) {
      case 'win': return 'text-success';
      case 'loss': return 'text-error';
      default: return 'text-slate-500 dark:text-slate-400'; // Corrected class
    }
  }

  const chartOptions = {
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
  };

</script>

<div class="space-y-6 animate-fade-in">
  <h2 class="text-2xl font-bold gradient-text">Betting History</h2>

  <!-- Summary Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="card-stats animate-float-subtle">
      <div class="stat-label">Total Wagered</div>
      <div class="stat-value">£{$totalWagered.toFixed(2)}</div>
    </div>
    <div class="card-stats animate-float-subtle" style="animation-delay: 150ms">
      <div class="stat-label">Total Profit/Loss</div>
      <div class="stat-value {$totalProfitLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
        {$totalProfitLoss >= 0 ? '+' : ''}£{$totalProfitLoss.toFixed(2)}
      </div>
    </div>
    <div class="card-stats animate-float-subtle" style="animation-delay: 300ms">
      <div class="stat-label">ROI</div>
      <div class="stat-value {$roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
        {$roi.toFixed(1)}%
      </div>
    </div>
  </div>

  <!-- Profit/Loss Chart -->
  <div class="chart-container animate-slide-in-up" style="animation-delay: 300ms">
    <h3 class="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Monthly Profit/Loss</h3>
    <div class="h-64">
      <Bar data={monthlyPerformance} options={chartOptions} />
    </div>
  </div>

  <!-- Bet History Table -->
  <div class="card card-glass animate-slide-in-up" style="animation-delay: 400ms">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-semibold text-slate-800 dark:text-slate-200">Detailed History</h3>
      <div class="flex space-x-2">
        <button class="btn btn-secondary btn-sm">
          <Filter class="w-4 h-4 mr-1" /> Filter
        </button>
        <button class="btn btn-secondary btn-sm">
          <Download class="w-4 h-4 mr-1" /> Export
        </button>
      </div>
    </div>

    {#if loading}
      <div class="flex-grow flex justify-center items-center">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    {:else if error}
      <div class="flex-grow flex justify-center items-center">
        <p class="text-error">{error}</p>
      </div>
    {:else if bets.length === 0}
      <div class="flex-grow flex flex-col justify-center items-center text-center text-slate-500 dark:text-slate-400">
        <DollarSign class="w-12 h-12 mb-2 opacity-50" />
        <p>No betting history found.</p>
        <p class="text-sm">Place some bets on predictions to see them here.</p>
      </div>
    {:else}
      <div class="overflow-x-auto flex-grow">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Match</th>
              <th>Bet</th>
              <th>Stake</th>
              <th>Odds</th>
              <th>Result</th>
              <th>Payout</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {#each bets as bet (bet.id)}
              <tr class="hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors duration-150">
                <td>{bet.match_description}</td>
                <td>{bet.bet_type}</td>
                <td>£{bet.stake.toFixed(2)}</td>
                <td>@{bet.odds.toFixed(2)}</td>
                <td>
                  <span class="flex items-center {getResultColor(bet.result)}">
                    <svelte:component this={getResultIcon(bet.result)} class="w-4 h-4 mr-1" />
                    {bet.result}
                  </span>
                </td>
                <td>{bet.payout != null ? `£${bet.payout.toFixed(2)}` : '-'}</td>
                <td class="text-xs text-slate-500 dark:text-slate-400">{formatDistanceToNow(new Date(bet.date), { addSuffix: true })}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style global lang="postcss">
  .shadow-glow-success-sm {
    box-shadow: 0 0 8px hsla(var(--success-hsl) / 0.3), inset 0 0 10px hsla(var(--success-hsl) / 0.05);
  }
  .shadow-glow-success-md {
    box-shadow: 0 0 15px hsla(var(--success-hsl) / 0.4), inset 0 0 15px hsla(var(--success-hsl) / 0.1);
  }
  .shadow-glow-error-sm {
    box-shadow: 0 0 8px hsla(var(--error-hsl) / 0.3), inset 0 0 10px hsla(var(--error-hsl) / 0.05);
  }
  .shadow-glow-error-md {
    box-shadow: 0 0 15px hsla(var(--error-hsl) / 0.4), inset 0 0 15px hsla(var(--error-hsl) / 0.1);
  }

  .th {
    @apply px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider;
  }
  .td {
    @apply px-4 py-3 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300;
  }
</style>