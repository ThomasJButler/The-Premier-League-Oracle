<script lang="ts">
  import { onMount } from 'svelte';
  import { TrendingUp, AlertTriangle, DollarSign, Target, RefreshCw, Filter, Info, Trophy, ChevronRight, Check } from 'lucide-svelte';
  import { ValueBettingEngine, type ValueBet, type MarketOdds } from '../../services/betting/value';
  import { dataService } from '../../services/dataService';
  import type { Match } from '../../types';
  import { fade, slide } from 'svelte/transition';
  import { getTeamLogo } from '../../utils/teamLogos';
  
  let valueBets: Array<ValueBet & { 
    match?: Match;
    teamStats?: {
      homeForm?: string;
      awayForm?: string;
      h2hRecord?: string;
      homeAvgGoals?: number;
      awayAvgGoals?: number;
      homeCleanSheets?: number;
      awayCleanSheets?: number;
    };
  }> = [];
  let loading = true;
  let error: string | null = null;
  let selectedMarket: 'all' | '1X2' | 'goals' | 'btts' = 'all';
  let minEdge: number = 5;
  let bankroll: number = 100;
  let lastRefresh: Date = new Date();
  let expandedBet: number | null = null;
  
  // Load personal limits
  let maxStakeAmount = 50;
  onMount(() => {
    const saved = localStorage.getItem('betting_limits');
    if (saved) {
      const limits = JSON.parse(saved);
      maxStakeAmount = limits.maxStakeAmount || 50;
      bankroll = Math.min(limits.maxBankroll || 500, bankroll);
    }
  });
  
  function selectMarket(market: string) {
    selectedMarket = market as 'all' | '1X2' | 'goals' | 'btts';
  }
  
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
      const allValueBets: Array<ValueBet & { match?: Match; teamStats?: any }> = [];
      
      for (const match of matches.slice(0, 10)) { // Limit to next 10 matches
        // Mock odds for demonstration (in production, fetch from odds API)
        const mockOdds: MarketOdds = {
          home: 1.8 + Math.random() * 1.5,
          draw: 3.2 + Math.random() * 0.5,
          away: 2.5 + Math.random() * 2,
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
        
        // Add match and team stats to each bet
        for (const bet of matchBets) {
          // Get team stats
          const homeStats = await dataService.getTeamStats(match.home_team);
          const awayStats = await dataService.getTeamStats(match.away_team);
          
          allValueBets.push({
            ...bet,
            match,
            teamStats: {
              homeForm: homeStats?.form || 'N/A',
              awayForm: awayStats?.form || 'N/A',
              h2hRecord: 'W2 D1 L2', // Mock H2H
              homeAvgGoals: homeStats ? homeStats.goalsFor / Math.max(homeStats.played, 1) : 0,
              awayAvgGoals: awayStats ? awayStats.goalsFor / Math.max(awayStats.played, 1) : 0,
              homeCleanSheets: Math.floor(Math.random() * 5),
              awayCleanSheets: Math.floor(Math.random() * 5)
            }
          });
        }
      }
      
      // Filter by minimum edge
      valueBets = allValueBets.filter(bet => bet.edge * 100 >= minEdge);
      
      // Sort by expected value
      valueBets.sort((a, b) => b.expectedValue - a.expectedValue);
      
      lastRefresh = new Date();
    } catch (err) {
      // Error loading value bets
      error = 'Failed to load value bets. Please check your API connection.';
    } finally {
      loading = false;
    }
  }
  
  function filterBets(bets: typeof valueBets): typeof valueBets {
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
      'btts': 'Both Teams to Score - Yes',
      'bttsNo': 'Both Teams to Score - No'
    };
    return labels[market] || market;
  }
  
  function getBettingInstruction(market: string, home: string, away: string): string {
    switch (market) {
      case 'home': return `Back ${home} to Win`;
      case 'away': return `Back ${away} to Win`;
      case 'draw': return `Back the Draw`;
      case 'over2.5': return `Back Over 2.5 Goals`;
      case 'under2.5': return `Back Under 2.5 Goals`;
      case 'btts': return `Back Both Teams to Score`;
      case 'bttsNo': return `Back No Goals for One Team`;
      default: return 'Place Bet';
    }
  }
  
  function getConfidenceColor(confidence: string): string {
    switch (confidence) {
      case 'high': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'low': return 'text-orange-600 dark:text-orange-400';
      default: return 'text-slate-600 dark:text-slate-400';
    }
  }
  
  function getFormClass(result: string): string {
    switch (result) {
      case 'W': return 'bg-green-500 text-white';
      case 'D': return 'bg-slate-400 text-white';
      case 'L': return 'bg-red-500 text-white';
      default: return 'bg-slate-200 dark:bg-slate-700';
    }
  }
  
  onMount(() => {
    loadValueBets();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadValueBets, 5 * 60 * 1000);
    return () => clearInterval(interval);
  });
  
  $: filteredBets = filterBets(valueBets);
  $: effectiveStake = (bet: ValueBet) => Math.min(bet.recommendedStake, maxStakeAmount);
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
  </div>
  
  <!-- Info Bar -->
  <div class="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-4 mb-6">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center space-x-6 text-sm">
        <div>
          <span class="text-slate-500 dark:text-slate-400">Last updated:</span>
          <span class="font-medium ml-1">{formatDate(lastRefresh)}</span>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">Opportunities found:</span>
          <span class="font-medium ml-1 text-green-600">{filteredBets.length}</span>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">Bankroll:</span>
          <span class="font-medium ml-1">{formatCurrency(bankroll)}</span>
        </div>
      </div>
      
      <!-- Filters -->
      <div class="flex items-center space-x-4">
        <div class="flex items-center space-x-2">
          <Filter class="w-4 h-4 text-slate-400" />
          <span class="text-sm text-slate-500 dark:text-slate-400">Filters:</span>
        </div>
        <div class="flex space-x-2">
          {#each ['all', '1X2', 'goals', 'btts'] as market}
            <button
              on:click={() => selectMarket(market)}
              class="px-3 py-1 text-xs rounded-lg font-medium transition-colors {
                selectedMarket === market
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }"
            >
              {market === 'all' ? 'All' : market.toUpperCase()}
            </button>
          {/each}
        </div>
        
        <!-- Min Edge -->
        <div class="flex items-center space-x-2">
          <span class="text-sm text-slate-500 dark:text-slate-400">Min Edge:</span>
          <input
            type="range"
            bind:value={minEdge}
            min="0"
            max="20"
            step="1"
            class="w-24"
          />
          <span class="text-sm font-medium text-primary">{minEdge}%</span>
        </div>
      </div>
    </div>
  </div>
  
  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  {:else if error}
    <div class="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-6 rounded-xl text-center">
      <p>{error}</p>
      <button 
        on:click={loadValueBets}
        class="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  {:else if filteredBets.length === 0}
    <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-12 text-center">
      <DollarSign class="w-12 h-12 mx-auto mb-4 text-slate-400" />
      <p class="text-slate-600 dark:text-slate-400">No value bets found matching your criteria</p>
      <p class="text-sm text-slate-500 dark:text-slate-500 mt-2">Try adjusting your filters or check back later</p>
    </div>
  {:else}
    <div class="grid gap-4">
      {#each filteredBets as bet, i (i)}
        <div class="bg-white dark:bg-slate-900 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
          <!-- Main Bet Card -->
          <div class="p-6">
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <img src={getTeamLogo(bet.homeTeam)} alt="" class="w-8 h-8 object-contain" />
                  <h3 class="text-lg font-bold text-slate-900 dark:text-white">
                    {bet.homeTeam} vs {bet.awayTeam}
                  </h3>
                  <img src={getTeamLogo(bet.awayTeam)} alt="" class="w-8 h-8 object-contain" />
                </div>
                <p class="text-sm text-slate-600 dark:text-slate-400">
                  {formatDate(bet.matchTime)}
                </p>
              </div>
              
              <!-- Quick Stats -->
              <div class="flex items-center space-x-4">
                <div class="text-center">
                  <p class="text-xs text-slate-500 dark:text-slate-400">Edge</p>
                  <p class="text-lg font-bold text-green-600">+{(bet.edge * 100).toFixed(1)}%</p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-slate-500 dark:text-slate-400">EV</p>
                  <p class="text-lg font-bold text-primary">+{(bet.expectedValue * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>
            
            <!-- Betting Instruction -->
            <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 mb-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Recommended Bet:</p>
                  <p class="text-xl font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                    <ChevronRight class="w-5 h-5" />
                    {getBettingInstruction(bet.market, bet.homeTeam, bet.awayTeam)}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-sm text-slate-600 dark:text-slate-400">Bookmaker Odds</p>
                  <p class="text-2xl font-bold text-slate-900 dark:text-white">{bet.odds.toFixed(2)}</p>
                </div>
              </div>
            </div>
            
            <!-- Stake Recommendation -->
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Recommended Stake</p>
                  <p class="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {formatCurrency(effectiveStake(bet))}
                  </p>
                  <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {((effectiveStake(bet) / bankroll) * 100).toFixed(1)}% of bankroll
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-sm text-slate-600 dark:text-slate-400">Potential Return</p>
                  <p class="text-xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(effectiveStake(bet) * bet.odds)}
                  </p>
                  <p class="text-xs text-green-600 dark:text-green-400 mt-1">
                    Profit: {formatCurrency(effectiveStake(bet) * (bet.odds - 1))}
                  </p>
                </div>
              </div>
            </div>
            
            <!-- Expand Button -->
            <button
              on:click={() => expandedBet = expandedBet === i ? null : i}
              class="w-full py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-1"
            >
              <Info class="w-4 h-4" />
              {expandedBet === i ? 'Hide' : 'Show'} Detailed Analysis
            </button>
            
            <!-- Expanded Stats -->
            {#if expandedBet === i}
              <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4" transition:slide>
                <!-- Team Form -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Recent Form</h4>
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-slate-600 dark:text-slate-400">{bet.homeTeam}:</span>
                        <div class="flex gap-1">
                          {#each (bet.teamStats?.homeForm || '?????').split('') as result}
                            <span class="w-6 h-6 rounded text-xs font-bold flex items-center justify-center {getFormClass(result)}">
                              {result}
                            </span>
                          {/each}
                        </div>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-slate-600 dark:text-slate-400">{bet.awayTeam}:</span>
                        <div class="flex gap-1">
                          {#each (bet.teamStats?.awayForm || '?????').split('') as result}
                            <span class="w-6 h-6 rounded text-xs font-bold flex items-center justify-center {getFormClass(result)}">
                              {result}
                            </span>
                          {/each}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Key Stats</h4>
                    <div class="space-y-1 text-sm">
                      <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400">H2H Record:</span>
                        <span class="font-medium">{bet.teamStats?.h2hRecord || 'W2 D1 L2'}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400">Home Avg Goals:</span>
                        <span class="font-medium">{bet.teamStats?.homeAvgGoals?.toFixed(1) || '1.5'}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400">Away Avg Goals:</span>
                        <span class="font-medium">{bet.teamStats?.awayAvgGoals?.toFixed(1) || '1.2'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Analysis Points -->
                <div>
                  <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Why This is a Value Bet</h4>
                  <div class="space-y-2">
                    <div class="flex items-start gap-2">
                      <Check class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <p class="text-sm text-slate-600 dark:text-slate-400">
                        Our model gives {bet.ourProbability * 100}% probability vs bookmaker's implied {((1/bet.odds) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div class="flex items-start gap-2">
                      <Check class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <p class="text-sm text-slate-600 dark:text-slate-400">
                        Confidence level: <span class="{getConfidenceColor(bet.confidence)} font-medium uppercase">{bet.confidence}</span>
                      </p>
                    </div>
                    <div class="flex items-start gap-2">
                      <Check class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <p class="text-sm text-slate-600 dark:text-slate-400">
                        Expected ROI on this bet: {(bet.expectedValue * 100).toFixed(1)}%
                      </p>
                    </div>
                    {#if bet.warnings && bet.warnings.length > 0}
                      {#each bet.warnings as warning}
                        <div class="flex items-start gap-2">
                          <AlertTriangle class="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p class="text-sm text-amber-700 dark:text-amber-400">{warning}</p>
                        </div>
                      {/each}
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          </div>
          
          <!-- Confidence Indicator Bar -->
          <div class="h-2 bg-gradient-to-r {
            bet.confidence === 'high' ? 'from-green-400 to-emerald-500' :
            bet.confidence === 'medium' ? 'from-yellow-400 to-amber-500' :
            'from-orange-400 to-red-500'
          }"></div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-colors;
  }
  
  .btn-primary {
    @apply bg-primary text-white hover:bg-primary/90;
  }
</style>