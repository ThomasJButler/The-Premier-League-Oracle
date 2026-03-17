<script lang="ts">
  import { onMount } from 'svelte';
  import { TrendingUp, AlertTriangle, DollarSign, RefreshCw, Filter, Info, ChevronRight, Check, Search } from 'lucide-svelte';
  import { ValueBettingEngine, type ValueBet, type MarketOdds } from '../../services/betting/value';
  import { dataService } from '../../services/dataService';
  import type { Match } from '../../types';
  import { slide } from 'svelte/transition';
  import { getTeamLogo } from '../../utils/teamLogos';

  // Match with user-entered odds fields
  interface MatchOddsEntry {
    match: Match;
    home: string;
    draw: string;
    away: string;
    over25: string;
    under25: string;
    btts: string;
    bttsNo: string;
    showAdvanced: boolean;
  }

  let matchEntries: MatchOddsEntry[] = [];
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
  let analysing = false;
  let error: string | null = null;
  let selectedMarket: 'all' | '1X2' | 'goals' | 'btts' = 'all';
  let minEdge: number = 5;
  let bankroll: number = 100;
  let lastAnalysis: Date | null = null;
  let expandedBet: number | null = null;
  let teamForms: Record<string, string> = {};

  // Load personal limits
  let maxStakeAmount = 50;

  onMount(async () => {
    const saved = localStorage.getItem('betting_limits');
    if (saved) {
      const limits = JSON.parse(saved);
      maxStakeAmount = limits.maxStakeAmount || 50;
      bankroll = Math.min(limits.maxBankroll || 500, bankroll);
    }
    await loadUpcomingMatches();
  });

  async function loadUpcomingMatches() {
    loading = true;
    error = null;
    matchEntries = [];
    valueBets = [];

    try {
      const matches = await dataService.getMatches({ upcoming: true, days: 7 });

      if (!matches || matches.length === 0) {
        loading = false;
        return;
      }

      // Load standings for team form data
      try {
        const standings = await dataService.getStandings();
        for (const s of standings) {
          if (s.form) {
            teamForms[s.team.name] = s.form.replace(/,/g, '');
          }
        }
      } catch {
        // Standings not critical for value bet analysis
      }

      matchEntries = matches.slice(0, 10).map(m => ({
        match: m,
        home: '',
        draw: '',
        away: '',
        over25: '',
        under25: '',
        btts: '',
        bttsNo: '',
        showAdvanced: false
      }));
    } catch (err) {
      error = 'Failed to load upcoming matches. Please check your API connection.';
    } finally {
      loading = false;
    }
  }

  function hasValidOdds(entry: MatchOddsEntry): boolean {
    const h = parseFloat(entry.home);
    const d = parseFloat(entry.draw);
    const a = parseFloat(entry.away);
    return h > 1 && d > 1 && a > 1;
  }

  function buildMarketOdds(entry: MatchOddsEntry): MarketOdds {
    const odds: MarketOdds = {
      home: parseFloat(entry.home),
      draw: parseFloat(entry.draw),
      away: parseFloat(entry.away)
    };
    const o25 = parseFloat(entry.over25);
    const u25 = parseFloat(entry.under25);
    const bt = parseFloat(entry.btts);
    const btNo = parseFloat(entry.bttsNo);
    if (o25 > 1) odds.over25 = o25;
    if (u25 > 1) odds.under25 = u25;
    if (bt > 1) odds.btts = bt;
    if (btNo > 1) odds.bttsNo = btNo;
    return odds;
  }

  async function analyseValueBets() {
    const entriesWithOdds = matchEntries.filter(hasValidOdds);

    if (entriesWithOdds.length === 0) {
      error = 'Please enter bookmaker odds for at least one match. All three main odds (Home, Draw, Away) must be greater than 1.0.';
      return;
    }

    analysing = true;
    error = null;
    valueBets = [];

    try {
      const allValueBets: typeof valueBets = [];

      for (const entry of entriesWithOdds) {
        const { match } = entry;
        const marketOdds = buildMarketOdds(entry);

        const matchBets = await ValueBettingEngine.identifyValueBets(
          match.id,
          match.home_team,
          match.away_team,
          new Date(match.date),
          marketOdds,
          bankroll
        );

        // Get team stats for enrichment
        const homeStats = await dataService.getTeamStats(match.home_team);
        const awayStats = await dataService.getTeamStats(match.away_team);

        for (const bet of matchBets) {
          allValueBets.push({
            ...bet,
            match,
            teamStats: {
              homeForm: teamForms[match.home_team] || '?????',
              awayForm: teamForms[match.away_team] || '?????',
              h2hRecord: 'No data available',
              homeAvgGoals: homeStats ? homeStats.goals_for / Math.max(homeStats.matches_played, 1) : 0,
              awayAvgGoals: awayStats ? awayStats.goals_for / Math.max(awayStats.matches_played, 1) : 0,
              homeCleanSheets: homeStats?.clean_sheets ?? 0,
              awayCleanSheets: awayStats?.clean_sheets ?? 0
            }
          });
        }
      }

      // Filter by minimum edge and sort by expected value
      valueBets = allValueBets.filter(bet => bet.edge * 100 >= minEdge);
      valueBets.sort((a, b) => b.expectedValue - a.expectedValue);
      lastAnalysis = new Date();

      if (valueBets.length === 0) {
        error = 'No value bets found. The bookmaker prices may already reflect fair value, or try lowering the minimum edge filter.';
      }
    } catch (err) {
      error = 'Failed to analyse value bets. Please try again.';
    } finally {
      analysing = false;
    }
  }

  function selectMarket(market: string) {
    selectedMarket = market as 'all' | '1X2' | 'goals' | 'btts';
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
      default: return 'text-muted-foreground';
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

  function filterBets(bets: typeof valueBets): typeof valueBets {
    if (selectedMarket === 'all') return bets;
    if (selectedMarket === '1X2') return bets.filter(b => ['home', 'draw', 'away'].includes(b.market));
    if (selectedMarket === 'goals') return bets.filter(b => b.market.includes('2.5'));
    if (selectedMarket === 'btts') return bets.filter(b => b.market === 'btts');
    return bets;
  }

  $: filteredBets = filterBets(valueBets);
  $: effectiveStake = (bet: ValueBet) => Math.min(bet.kellyStake.recommendedStake, maxStakeAmount);
  $: matchesWithOddsCount = matchEntries.filter(hasValidOdds).length;
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
          <h1 class="text-2xl font-bold font-display text-foreground">Value Bets</h1>
          <p class="text-sm text-muted-foreground">
            Enter bookmaker odds to find positive expected value opportunities
          </p>
        </div>
      </div>

      <button
        on:click={loadUpcomingMatches}
        disabled={loading}
        class="px-4 py-2 rounded-lg font-medium transition-colors bg-primary text-white hover:bg-primary/90 flex items-center space-x-2"
      >
        <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
        <span>Refresh Matches</span>
      </button>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  {:else if matchEntries.length === 0 && !error}
    <div class="bg-muted rounded-xl p-12 text-center">
      <DollarSign class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <p class="text-muted-foreground">No upcoming matches found</p>
      <p class="text-sm text-muted-foreground mt-2">Check back when matches are scheduled</p>
    </div>
  {:else}
    <!-- Odds Entry Section -->
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5 mb-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-2">
          <Search class="w-5 h-5 text-primary" />
          <h2 class="text-lg font-bold font-display text-foreground">Enter Bookmaker Odds</h2>
        </div>
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <span class="text-sm text-muted-foreground">Bankroll:</span>
            <div class="relative">
              <span class="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
              <input
                type="number"
                bind:value={bankroll}
                min="1"
                class="w-24 pl-6 pr-2 py-1.5 text-sm bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          <span class="text-sm text-muted-foreground">
            {matchesWithOddsCount} of {matchEntries.length} matches ready
          </span>
        </div>
      </div>

      <p class="text-xs text-muted-foreground mb-4">
        Enter decimal odds from your bookmaker for each match you want to analyse. All three 1X2 odds are required; goals and BTTS markets are optional.
      </p>

      <div class="space-y-3">
        {#each matchEntries as entry, idx}
          <div class="bg-muted rounded-lg p-4">
            <div class="flex flex-col lg:flex-row lg:items-center gap-4">
              <!-- Match Info -->
              <div class="flex items-center gap-2 lg:w-72 flex-shrink-0">
                <img src={getTeamLogo(entry.match.home_team)} alt="" class="w-6 h-6 object-contain" />
                <span class="text-sm font-medium text-foreground truncate">
                  {entry.match.home_team}
                </span>
                <span class="text-xs text-muted-foreground">vs</span>
                <span class="text-sm font-medium text-foreground truncate">
                  {entry.match.away_team}
                </span>
                <img src={getTeamLogo(entry.match.away_team)} alt="" class="w-6 h-6 object-contain" />
              </div>

              <!-- Date -->
              <div class="text-xs text-muted-foreground lg:w-24 flex-shrink-0">
                {formatDate(new Date(entry.match.date))}
              </div>

              <!-- 1X2 Odds Inputs -->
              <div class="flex items-center gap-2 flex-shrink-0" data-testid="odds-inputs">
                <div class="flex flex-col items-center">
                  <label class="text-xs text-muted-foreground mb-1">Home</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    placeholder="0.00"
                    bind:value={entry.home}
                    class="w-16 px-2 py-1.5 text-sm text-center bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div class="flex flex-col items-center">
                  <label class="text-xs text-muted-foreground mb-1">Draw</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    placeholder="0.00"
                    bind:value={entry.draw}
                    class="w-16 px-2 py-1.5 text-sm text-center bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div class="flex flex-col items-center">
                  <label class="text-xs text-muted-foreground mb-1">Away</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    placeholder="0.00"
                    bind:value={entry.away}
                    class="w-16 px-2 py-1.5 text-sm text-center bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                <!-- Toggle Advanced Markets -->
                <button
                  on:click={() => { entry.showAdvanced = !entry.showAdvanced; matchEntries = matchEntries; }}
                  class="ml-2 px-2 py-1.5 text-xs rounded-lg transition-colors {
                    entry.showAdvanced
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }"
                  title="Show goals and BTTS markets"
                >
                  More
                </button>

                <!-- Valid Indicator -->
                {#if hasValidOdds(entry)}
                  <div class="ml-1">
                    <Check class="w-4 h-4 text-green-500" />
                  </div>
                {/if}
              </div>
            </div>

            <!-- Advanced Markets (Goals + BTTS) -->
            {#if entry.showAdvanced}
              <div class="mt-3 pt-3 border-t border-border flex items-center gap-3 flex-wrap" transition:slide>
                <div class="flex flex-col items-center">
                  <label class="text-xs text-muted-foreground mb-1">Over 2.5</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    placeholder="0.00"
                    bind:value={entry.over25}
                    class="w-16 px-2 py-1.5 text-sm text-center bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div class="flex flex-col items-center">
                  <label class="text-xs text-muted-foreground mb-1">Under 2.5</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    placeholder="0.00"
                    bind:value={entry.under25}
                    class="w-16 px-2 py-1.5 text-sm text-center bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div class="flex flex-col items-center">
                  <label class="text-xs text-muted-foreground mb-1">BTTS Yes</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    placeholder="0.00"
                    bind:value={entry.btts}
                    class="w-16 px-2 py-1.5 text-sm text-center bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div class="flex flex-col items-center">
                  <label class="text-xs text-muted-foreground mb-1">BTTS No</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    placeholder="0.00"
                    bind:value={entry.bttsNo}
                    class="w-16 px-2 py-1.5 text-sm text-center bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Analyse Button -->
      <div class="mt-6 flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <!-- Min Edge Filter -->
          <div class="flex items-center space-x-2">
            <Filter class="w-4 h-4 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">Min Edge:</span>
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

        <button
          on:click={analyseValueBets}
          disabled={analysing || matchesWithOddsCount === 0}
          class="px-6 py-2 rounded-lg font-medium transition-colors bg-primary text-white hover:bg-primary/90 flex items-center space-x-2"
        >
          {#if analysing}
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Analysing...</span>
          {:else}
            <Search class="w-4 h-4" />
            <span>Find Value Bets ({matchesWithOddsCount} {matchesWithOddsCount === 1 ? 'match' : 'matches'})</span>
          {/if}
        </button>
      </div>
    </div>

    <!-- Results Section -->
    {#if error}
      <div class="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 p-6 rounded-xl text-center mb-6">
        <AlertTriangle class="w-6 h-6 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    {/if}

    {#if filteredBets.length > 0}
      <!-- Info Bar -->
      <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4 mb-6">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div class="flex items-center space-x-6 text-sm">
            {#if lastAnalysis}
              <div>
                <span class="text-muted-foreground">Last analysis:</span>
                <span class="font-medium ml-1">{formatDate(lastAnalysis)}</span>
              </div>
            {/if}
            <div>
              <span class="text-muted-foreground">Value bets found:</span>
              <span class="font-medium ml-1 text-green-600">{filteredBets.length}</span>
            </div>
            <div>
              <span class="text-muted-foreground">Bankroll:</span>
              <span class="font-medium ml-1">{formatCurrency(bankroll)}</span>
            </div>
          </div>

          <!-- Market Filters -->
          <div class="flex items-center space-x-2">
            <span class="text-sm text-muted-foreground">Market:</span>
            <div class="flex space-x-2">
              {#each ['all', '1X2', 'goals', 'btts'] as market}
                <button
                  on:click={() => selectMarket(market)}
                  class="px-3 py-1 text-xs rounded-lg font-medium transition-colors {
                    selectedMarket === market
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }"
                >
                  {market === 'all' ? 'All' : market.toUpperCase()}
                </button>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <!-- Value Bet Cards -->
      <div class="grid gap-4">
        {#each filteredBets as bet, i (i)}
          <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            <!-- Main Bet Card -->
            <div class="p-6">
              <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <img src={getTeamLogo(bet.homeTeam)} alt="" class="w-8 h-8 object-contain" />
                    <h3 class="text-lg font-bold font-display text-foreground">
                      {bet.homeTeam} vs {bet.awayTeam}
                    </h3>
                    <img src={getTeamLogo(bet.awayTeam)} alt="" class="w-8 h-8 object-contain" />
                  </div>
                  <p class="text-sm text-muted-foreground">
                    {formatDate(bet.matchDate)}
                  </p>
                </div>

                <!-- Quick Stats -->
                <div class="flex items-center space-x-4">
                  <div class="text-center">
                    <p class="text-xs text-muted-foreground">Edge</p>
                    <p class="text-lg font-bold text-green-600">+{(bet.edge * 100).toFixed(1)}%</p>
                  </div>
                  <div class="text-center">
                    <p class="text-xs text-muted-foreground">EV</p>
                    <p class="text-lg font-bold text-primary">+{(bet.expectedValue * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              <!-- Betting Instruction -->
              <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 mb-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-semibold text-foreground mb-1">Recommended Bet:</p>
                    <p class="text-xl font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                      <ChevronRight class="w-5 h-5" />
                      {getBettingInstruction(bet.market, bet.homeTeam, bet.awayTeam)}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm text-muted-foreground">Bookmaker Odds</p>
                    <p class="text-2xl font-bold text-foreground">{bet.bookmakerOdds.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <!-- Stake Recommendation -->
              <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-semibold text-foreground">Kelly Recommended Stake</p>
                    <p class="text-2xl font-bold text-blue-700 dark:text-blue-400">
                      {formatCurrency(effectiveStake(bet))}
                    </p>
                    <p class="text-xs text-muted-foreground mt-1">
                      {((effectiveStake(bet) / bankroll) * 100).toFixed(1)}% of bankroll (half-Kelly)
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm text-muted-foreground">Potential Return</p>
                    <p class="text-xl font-bold text-foreground">
                      {formatCurrency(effectiveStake(bet) * bet.bookmakerOdds)}
                    </p>
                    <p class="text-xs text-green-600 dark:text-green-400 mt-1">
                      Profit: {formatCurrency(effectiveStake(bet) * (bet.bookmakerOdds - 1))}
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
                <div class="mt-4 pt-4 border-t border-border space-y-4" transition:slide>
                  <!-- Team Form -->
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 class="text-sm font-semibold font-display text-foreground mb-2">Recent Form</h4>
                      <div class="space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-sm text-muted-foreground">{bet.homeTeam}:</span>
                          <div class="flex gap-1">
                            {#each (bet.teamStats?.homeForm || '?????').split('') as result}
                              <span class="w-6 h-6 rounded text-xs font-bold flex items-center justify-center {getFormClass(result)}">
                                {result}
                              </span>
                            {/each}
                          </div>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-sm text-muted-foreground">{bet.awayTeam}:</span>
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
                      <h4 class="text-sm font-semibold font-display text-foreground mb-2">Key Stats</h4>
                      <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                          <span class="text-muted-foreground">H2H Record:</span>
                          <span class="font-medium">{bet.teamStats?.h2hRecord || 'No data available'}</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-muted-foreground">Home Avg Goals:</span>
                          <span class="font-medium">{bet.teamStats?.homeAvgGoals?.toFixed(1) || '—'}</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-muted-foreground">Away Avg Goals:</span>
                          <span class="font-medium">{bet.teamStats?.awayAvgGoals?.toFixed(1) || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Analysis Points -->
                  <div>
                    <h4 class="text-sm font-semibold font-display text-foreground mb-2">Why This is a Value Bet</h4>
                    <div class="space-y-2">
                      <div class="flex items-start gap-2">
                        <Check class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <p class="text-sm text-muted-foreground">
                          Our model gives {(bet.ourProbability * 100).toFixed(1)}% probability vs bookmaker's implied {((1/bet.bookmakerOdds) * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div class="flex items-start gap-2">
                        <Check class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <p class="text-sm text-muted-foreground">
                          Confidence level: <span class="{getConfidenceColor(bet.confidence)} font-medium uppercase">{bet.confidence}</span>
                        </p>
                      </div>
                      <div class="flex items-start gap-2">
                        <Check class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <p class="text-sm text-muted-foreground">
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
  {/if}
</div>
