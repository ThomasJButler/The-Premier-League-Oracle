<script lang="ts">
  import { Bar } from 'svelte-chartjs';
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
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { TrendingUp, TrendingDown, Download, PoundSterling, Minus, Trophy, Percent } from 'lucide-svelte';
  import { formatDistanceToNow } from 'date-fns';
  import { betHistoryService, type StoredBet } from '../services/betting/betHistoryService';

  ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

  let bets: StoredBet[] = [];
  let loading = true;
  let filterResult: 'all' | 'win' | 'loss' | 'pending' = 'all';

  let totalWagered = tweened(0, { duration: 800, easing: cubicOut });
  let totalProfitLoss = tweened(0, { duration: 1000, easing: cubicOut });
  let roiTweened = tweened(0, { duration: 1200, easing: cubicOut });
  let winRateTweened = tweened(0, { duration: 1000, easing: cubicOut });
  let totalBetsTweened = tweened(0, { duration: 800, easing: cubicOut });

  let monthlyPerformance: ChartData<"bar", number[], string> = {
    labels: [],
    datasets: [{
      label: 'Monthly Profit/Loss',
      data: [],
      backgroundColor: [],
      borderColor: [],
      borderWidth: 1
    }]
  };

  function loadBettingHistory() {
    loading = true;

    bets = betHistoryService.getAllBets();

    const roiData = betHistoryService.getROI();
    totalWagered.set(roiData.totalStaked);
    totalProfitLoss.set(roiData.totalReturn - roiData.totalStaked);
    roiTweened.set(roiData.roi);
    totalBetsTweened.set(roiData.totalBets);

    winRateTweened.set(betHistoryService.getWinRate());

    buildMonthlyChart();

    loading = false;
  }

  function buildMonthlyChart() {
    const monthly = betHistoryService.getMonthlyPL();

    if (monthly.length === 0) {
      monthlyPerformance = {
        labels: [],
        datasets: [{
          label: 'Monthly Profit/Loss',
          data: [],
          backgroundColor: [],
          borderColor: [],
          borderWidth: 1
        }]
      };
      return;
    }

    const labels = monthly.map(m => m.month);
    const data = monthly.map(m => m.profit);
    const bgColours = data.map(v =>
      v >= 0
        ? 'rgba(16, 185, 129, 0.6)'   // emerald for profit
        : 'rgba(244, 63, 94, 0.6)'     // rose for loss
    );
    const borderColours = data.map(v =>
      v >= 0
        ? 'rgba(16, 185, 129, 1)'
        : 'rgba(244, 63, 94, 1)'
    );

    monthlyPerformance = {
      labels,
      datasets: [{
        label: 'Monthly Profit/Loss',
        data,
        backgroundColor: bgColours,
        borderColor: borderColours,
        borderWidth: 1
      }]
    };
  }

  $: filteredBets = bets.filter(bet => {
    if (filterResult === 'all') return true;
    if (filterResult === 'pending') return !bet.result;
    return bet.result === filterResult;
  });

  function formatMarket(market: string): string {
    switch (market) {
      case 'match_result': return '1X2';
      case 'btts': return 'BTTS';
      case 'over_2_5': return 'O2.5';
      case 'over_3_5': return 'O3.5';
      case 'combo': return 'Combo';
      default: return market;
    }
  }

  function formatSelection(bet: StoredBet): string {
    if (bet.market === 'match_result') {
      if (bet.selection === 'home') return 'Home';
      if (bet.selection === 'draw') return 'Draw';
      if (bet.selection === 'away') return 'Away';
    }
    if (bet.market === 'btts') {
      return bet.selection === 'yes' ? 'Yes' : 'No';
    }
    if (bet.market === 'over_2_5' || bet.market === 'over_3_5') {
      return bet.selection === 'over' ? 'Over' : 'Under';
    }
    return bet.selection;
  }

  function getResultIcon(result?: string) {
    switch (result) {
      case 'win': return TrendingUp;
      case 'loss': return TrendingDown;
      default: return Minus;
    }
  }

  function getResultColour(result?: string): string {
    switch (result) {
      case 'win': return 'text-emerald-600 dark:text-emerald-400';
      case 'loss': return 'text-rose-600 dark:text-rose-400';
      default: return 'text-muted-foreground';
    }
  }

  function getResultLabel(result?: string): string {
    if (!result) return 'Pending';
    if (result === 'void') return 'Void';
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  function handleExport() {
    const json = betHistoryService.exportBets();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pl-oracle-bets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Load immediately — data sources are synchronous (localStorage)
  loadBettingHistory();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'hsla(var(--muted-foreground) / 0.1)'
        },
        ticks: {
          color: 'hsl(var(--muted-foreground))',
          callback: (value: number | string) => `£${value}`
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: 'hsl(var(--muted-foreground))'
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `£${ctx.parsed.y.toFixed(2)}`
        }
      }
    }
  };

  export function refresh() {
    loadBettingHistory();
  }
</script>

<div class="space-y-6 animate-fade-in">
  <h2 class="text-2xl font-bold font-display text-foreground">Betting History</h2>

  <!-- Summary Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5">
      <div class="stat-icon-wrapper bg-blue-100 dark:bg-blue-900/30">
        <PoundSterling class="w-5 h-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div class="stat-label">Total Staked</div>
      <div class="stat-value">£{$totalWagered.toFixed(2)}</div>
    </div>

    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5" style="animation-delay: 100ms">
      <div class="stat-icon-wrapper {$totalProfitLoss >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}">
        {#if $totalProfitLoss >= 0}
          <TrendingUp class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        {:else}
          <TrendingDown class="w-5 h-5 text-rose-600 dark:text-rose-400" />
        {/if}
      </div>
      <div class="stat-label">Total Profit/Loss</div>
      <div class="stat-value {$totalProfitLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
        {$totalProfitLoss >= 0 ? '+' : ''}£{$totalProfitLoss.toFixed(2)}
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5" style="animation-delay: 200ms">
      <div class="stat-icon-wrapper {$roiTweened >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}">
        <Percent class="w-5 h-5 {$roiTweened >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}" />
      </div>
      <div class="stat-label">ROI</div>
      <div class="stat-value {$roiTweened >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
        {$roiTweened.toFixed(1)}%
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5" style="animation-delay: 300ms">
      <div class="stat-icon-wrapper bg-teal-100 dark:bg-teal-900/30">
        <Trophy class="w-5 h-5 text-teal-600 dark:text-teal-400" />
      </div>
      <div class="stat-label">Win Rate</div>
      <div class="stat-value">{$winRateTweened.toFixed(1)}%</div>
    </div>

    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5" style="animation-delay: 400ms">
      <div class="stat-icon-wrapper bg-amber-100 dark:bg-amber-900/30">
        <PoundSterling class="w-5 h-5 text-amber-600 dark:text-amber-400" />
      </div>
      <div class="stat-label">Total Bets</div>
      <div class="stat-value">{Math.round($totalBetsTweened)}</div>
    </div>
  </div>

  <!-- Profit/Loss Chart -->
  <div class="rounded-xl border border-border bg-card p-5" style="animation-delay: 300ms">
    <h3 class="text-lg font-semibold font-display text-foreground mb-3">Monthly Profit/Loss</h3>
    {#if monthlyPerformance.labels && monthlyPerformance.labels.length > 0}
      <div class="h-64">
        <Bar data={monthlyPerformance} options={chartOptions} />
      </div>
    {:else}
      <div class="h-64 flex items-center justify-center text-muted-foreground">
        <p>No resolved bets yet — place and resolve bets to see monthly performance.</p>
      </div>
    {/if}
  </div>

  <!-- Bet History Table -->
  <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5" style="animation-delay: 400ms">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-semibold font-display text-foreground">Detailed History</h3>
      <div class="flex space-x-2">
        <select
          bind:value={filterResult}
          class="text-sm rounded-lg border border-border bg-card text-foreground px-3 py-1.5 focus:ring-2 focus:ring-primary"
        >
          <option value="all">All</option>
          <option value="win">Wins</option>
          <option value="loss">Losses</option>
          <option value="pending">Pending</option>
        </select>
        <button class="px-3 py-1 text-sm rounded-lg font-medium transition-colors bg-muted text-foreground hover:bg-muted/80 flex items-center" on:click={handleExport}>
          <Download class="w-4 h-4 mr-1" /> Export
        </button>
      </div>
    </div>

    {#if loading}
      <div class="flex-grow flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    {:else if bets.length === 0}
      <div class="flex-grow flex flex-col justify-center items-center text-center text-muted-foreground py-12">
        <PoundSterling class="w-12 h-12 mb-2 opacity-50" />
        <p>No betting history found.</p>
        <p class="text-sm">Place some bets via the Kelly Calculator or Value Bets page to see them here.</p>
      </div>
    {:else if filteredBets.length === 0}
      <div class="flex-grow flex flex-col justify-center items-center text-center text-muted-foreground py-8">
        <p>No bets match the current filter.</p>
      </div>
    {:else}
      <div class="overflow-x-auto flex-grow">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Match</th>
              <th>Market</th>
              <th>Selection</th>
              <th>Odds</th>
              <th>Stake</th>
              <th>Result</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredBets as bet (bet.id)}
              <tr class="hover:bg-muted/50 transition-colors duration-150">
                <td class="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(bet.createdAt), { addSuffix: true })}
                </td>
                <td class="whitespace-nowrap">{bet.homeTeam} vs {bet.awayTeam}</td>
                <td>
                  <span class="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-foreground">
                    {formatMarket(bet.market)}
                  </span>
                </td>
                <td>{formatSelection(bet)}</td>
                <td>@{bet.odds.toFixed(2)}</td>
                <td>£{bet.stake.toFixed(2)}</td>
                <td>
                  <span class="flex items-center {getResultColour(bet.result)}">
                    <svelte:component this={getResultIcon(bet.result)} class="w-4 h-4 mr-1" />
                    {getResultLabel(bet.result)}
                  </span>
                </td>
                <td class="{bet.profit != null ? (bet.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400') : 'text-muted-foreground'}">
                  {#if bet.profit != null}
                    {bet.profit >= 0 ? '+' : '-'}£{Math.abs(bet.profit).toFixed(2)}
                  {:else}
                    -
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

