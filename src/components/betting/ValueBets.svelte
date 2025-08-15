<script lang="ts">
  import { onMount } from 'svelte';
  import { TrendingUp, AlertTriangle, DollarSign, Target, RefreshCw, Filter } from 'lucide-svelte';
  import { ValueBettingEngine, type ValueBet, type MarketOdds } from '../../services/betting/value';
  import { dataService } from '../../services/dataService';
  import { fade, slide } from 'svelte/transition';
  
  let valueBets: ValueBet[] = [];
  let loading = true;
  let error: string | null = null;
  let selectedMarket: 'all' | '1X2' | 'goals' | 'btts' = 'all';
  let minEdge: number = 3;
  let bankroll: number = 1000;
  let lastRefresh: Date = new Date();
  
  async function loadValueBets() {
    loading = true;
    error = null;
    
    try {
      // Get upcoming matches
      const matches = await dataService.getMatches({ upcoming: true, days: 7 });
      
      if (!matches || matches.length === 0) {
        valueBets = [];
        return;
      }
      
      // For each match, identify value bets
      const allValueBets: ValueBet[] = [];
      
      for (const match of matches.slice(0, 10)) { // Limit to next 10 matches
        // Mock odds for demonstration (in production, fetch from odds API)
        const mockOdds: MarketOdds = {
          home: 2.1 + Math.random(),
          draw: 3.2 + Math.random() * 0.5,
          away: 3.5 + Math.random() * 0.8,
          over25: 1.8 + Math.random() * 0.4,
          under25: 2.0 + Math.random() * 0.3,
          btts: 1.9 + Math.random() * 0.3,
          bttsNo: 1.95 + Math.random() * 0.2
        };
        
        const matchBets = await ValueBettingEngine.identifyValueBets(
          match.home_team,
          match.away_team,
          new Date(match.date),
          mockOdds,
          bankroll
        );
        
        allValueBets.push(...matchBets);
      }
      
      // Filter by minimum edge
      valueBets = allValueBets.filter(bet => bet.edge * 100 >= minEdge);
      
      // Sort by expected value
      valueBets.sort((a, b) => b.expectedValue - a.expectedValue);
      
      lastRefresh = new Date();
    } catch (err) {
      console.error('Error loading value bets:', err);
      error = 'Failed to load value bets. Please check your API connection.';
    } finally {
      loading = false;
    }
  }
  
  function filterBets(bets: ValueBet[]): ValueBet[] {
    if (selectedMarket === 'all') return bets;
    if (selectedMarket === '1X2') return bets.filter(b => ['home', 'draw', 'away'].includes(b.market));
    if (selectedMarket === 'goals') return bets.filter(b => b.market.includes('2.5'));
    if (selectedMarket === 'btts') return bets.filter(b => b.market === 'btts');
    return bets;
  }
  
  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
  
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(value);
  }
  
  function getMarketLabel(market: string): string {
    const labels: Record<string, string> = {
      'home': 'Home Win',
      'draw': 'Draw',
      'away': 'Away Win',
      'over2.5': 'Over 2.5 Goals',
      'under2.5': 'Under 2.5 Goals',
      'btts': 'Both Teams to Score'
    };
    return labels[market] || market;
  }
  
  function getConfidenceColor(confidence: string): string {
    switch (confidence) {
      case 'high': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'low': return 'text-orange-600 dark:text-orange-400';
      default: return 'text-slate-600 dark:text-slate-400';
    }
  }
  
  onMount(() => {
    loadValueBets();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadValueBets, 5 * 60 * 1000);
    return () => clearInterval(interval);
  });
  
  $: filteredBets = filterBets(valueBets);
</script>

<div class="value-bets-container">
  <!-- Header -->
  <div class="bg-gradient-to-r from-green-500/10 to-emerald-600/10 dark:from-green-500/20 dark:to-emerald-600/20 rounded-xl p-6 mb-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
          <TrendingUp class="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Value Bets</h1>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            Identified betting opportunities with positive expected value
          </p>
        </div>
      </div>
      
      <button
        on:click={loadValueBets}
        disabled={loading}
        class="btn btn-primary flex items-center space-x-2"
      >
        <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
        <span>Refresh</span>
      </button>
    </div>
    
    <div class="mt-4 flex items-center text-sm text-slate-600 dark:text-slate-400">
      <span>Last updated: {formatDate(lastRefresh)}</span>
      <span class="mx-2">•</span>
      <span>{filteredBets.length} opportunities found</span>
      <span class="mx-2">•</span>
      <span>Bankroll: {formatCurrency(bankroll)}</span>
    </div>
  </div>
  
  <!-- Filters -->
  <div class="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-4 mb-6">
    <div class="flex flex-wrap items-center gap-4">
      <div class="flex items-center space-x-2">
        <Filter class="w-4 h-4 text-slate-500" />
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Filters:</span>
      </div>
      
      <!-- Market Filter -->
      <div class="flex space-x-2">
        {#each ['all', '1X2', 'goals', 'btts'] as market}
          <button
            on:click={() => selectedMarket = market}
            class="px-3 py-1 rounded-lg text-sm font-medium transition-colors {
              selectedMarket === market
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }"
          >
            {market === 'all' ? 'All' : market.toUpperCase()}
          </button>
        {/each}
      </div>
      
      <!-- Min Edge Filter -->
      <div class="flex items-center space-x-2">
        <label class="text-sm text-slate-600 dark:text-slate-400">Min Edge:</label>
        <input
          type="range"
          bind:value={minEdge}
          min="1"
          max="10"
          step="0.5"
          class="w-24"
        />
        <span class="text-sm font-medium text-primary">{minEdge}%</span>
      </div>
      
      <!-- Bankroll Input -->
      <div class="flex items-center space-x-2">
        <label class="text-sm text-slate-600 dark:text-slate-400">Bankroll:</label>
        <input
          type="number"
          bind:value={bankroll}
          min="100"
          max="100000"
          step="100"
          class="w-24 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
        />
      </div>
    </div>
  </div>
  
  <!-- Value Bets List -->
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="text-center">
        <RefreshCw class="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p class="text-slate-600 dark:text-slate-400">Analysing matches for value...</p>
      </div>
    </div>
  {:else if error}
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
      <div class="flex items-center space-x-3">
        <AlertTriangle class="w-6 h-6 text-red-600 dark:text-red-400" />
        <p class="text-red-800 dark:text-red-300">{error}</p>
      </div>
    </div>
  {:else if filteredBets.length === 0}
    <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-12 text-center">
      <Target class="w-12 h-12 text-slate-400 mx-auto mb-4" />
      <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No Value Bets Found</h3>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        No betting opportunities meet your criteria. Try adjusting filters or check back later.
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each filteredBets as bet, index}
        <div 
          class="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
          transition:slide={{ delay: index * 50 }}
        >
          <!-- Match Header -->
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">
                {bet.homeTeam} vs {bet.awayTeam}
              </h3>
              <p class="text-sm text-slate-600 dark:text-slate-400">
                {formatDate(bet.matchDate)}
              </p>
            </div>
            
            <div class="text-right">
              <span class="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                {getMarketLabel(bet.market)}
              </span>
            </div>
          </div>
          
          <!-- Betting Details -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p class="text-xs text-slate-500 dark:text-slate-400">Our Probability</p>
              <p class="text-lg font-bold text-slate-900 dark:text-white">
                {(bet.ourProbability * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p class="text-xs text-slate-500 dark:text-slate-400">Bookmaker Odds</p>
              <p class="text-lg font-bold text-slate-900 dark:text-white">
                {bet.bookmakerOdds.toFixed(2)}
              </p>
            </div>
            <div>
              <p class="text-xs text-slate-500 dark:text-slate-400">Edge</p>
              <p class="text-lg font-bold text-green-600 dark:text-green-400">
                +{(bet.edge * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p class="text-xs text-slate-500 dark:text-slate-400">Expected Value</p>
              <p class="text-lg font-bold text-green-600 dark:text-green-400">
                +{(bet.expectedValue * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          
          <!-- Kelly Recommendation -->
          <div class="bg-gradient-to-r from-primary/10 to-accent/10 dark:from-primary/20 dark:to-accent/20 rounded-lg p-4 mb-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <DollarSign class="w-5 h-5 text-primary" />
                <span class="font-semibold text-slate-800 dark:text-slate-200">Recommended Stake</span>
              </div>
              <div class="text-right">
                <p class="text-xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(bet.kellyStake.recommendedStake)}
                </p>
                <p class="text-xs text-slate-600 dark:text-slate-400">
                  {(bet.kellyStake.halfKelly * 100).toFixed(2)}% of bankroll
                </p>
              </div>
            </div>
          </div>
          
          <!-- Confidence & Warnings -->
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <span class="text-sm">
                Confidence: 
                <span class={`font-semibold ${getConfidenceColor(bet.confidence)}`}>
                  {bet.confidence.toUpperCase()}
                </span>
              </span>
              <span class="text-sm">
                Risk: 
                <span class={`font-semibold ${bet.kellyStake.risk === 'high' ? 'text-red-600' : bet.kellyStake.risk === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                  {bet.kellyStake.risk.toUpperCase()}
                </span>
              </span>
            </div>
            
            {#if bet.warnings.length > 0}
              <div class="flex items-center space-x-1 text-orange-600 dark:text-orange-400">
                <AlertTriangle class="w-4 h-4" />
                <span class="text-xs">{bet.warnings.length} warning{bet.warnings.length > 1 ? 's' : ''}</span>
              </div>
            {/if}
          </div>
          
          <!-- Reasoning -->
          {#if bet.reasoning.length > 0}
            <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Analysis:</p>
              <ul class="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                {#each bet.reasoning.slice(0, 3) as reason}
                  <li>• {reason}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  input[type="range"] {
    @apply h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer;
  }
  
  input[type="range"]::-webkit-slider-thumb {
    @apply appearance-none w-4 h-4 bg-primary rounded-full cursor-pointer;
  }
  
  input[type="range"]::-moz-range-thumb {
    @apply w-4 h-4 bg-primary rounded-full cursor-pointer border-0;
  }
</style>