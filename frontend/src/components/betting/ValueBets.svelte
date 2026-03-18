<script lang="ts">
  import { onMount } from 'svelte';
  import { Search, AlertTriangle, TrendingUp, CheckCircle, BookmarkPlus, Check } from 'lucide-svelte';
  import { dataService } from '../../services/dataService';
  import { ValueBettingEngine, type ValueBet, type MarketOdds } from '../../services/betting/value';
  import { betHistoryService } from '../../services/betting/betHistoryService';
  import type { Match } from '../../types';
  import { fade } from 'svelte/transition';
  import { getTeamLogo } from '../../utils/teamLogos';

  let upcomingMatches: Match[] = [];
  let selectedMatchId = '';
  let loading = false;
  let matchesLoading = true;
  let error: string | null = null;
  let valueBets: ValueBet[] = [];
  let hasScanned = false;

  // User-entered bookmaker odds
  let homeOdds: number = 0;
  let drawOdds: number = 0;
  let awayOdds: number = 0;
  let over25Odds: number = 0;
  let under25Odds: number = 0;
  let bttsOdds: number = 0;
  let bttsNoOdds: number = 0;
  let bankroll: number = 100;

  $: selectedMatch = upcomingMatches.find(m => m.id === selectedMatchId) ?? null;
  $: hasBasicOdds = homeOdds > 1 && drawOdds > 1 && awayOdds > 1;

  let trackedBets: Set<string> = new Set();

  /** Map ValueBet market format to StoredBet market format */
  function mapMarket(market: ValueBet['market']): 'match_result' | 'btts' | 'over_2_5' | 'over_3_5' | 'combo' {
    switch (market) {
      case 'home': case 'draw': case 'away': return 'match_result';
      case 'over2.5': case 'under2.5': return 'over_2_5';
      case 'btts': return 'btts';
      default: return 'match_result';
    }
  }

  function mapSelection(market: ValueBet['market']): string {
    switch (market) {
      case 'home': return 'home';
      case 'draw': return 'draw';
      case 'away': return 'away';
      case 'over2.5': return 'over';
      case 'under2.5': return 'under';
      case 'btts': return 'yes';
      default: return market;
    }
  }

  function trackValueBet(bet: ValueBet) {
    if (!selectedMatch) return;

    betHistoryService.storeBet({
      matchId: selectedMatch.id,
      matchDate: selectedMatch.date,
      homeTeam: selectedMatch.home_team,
      awayTeam: selectedMatch.away_team,
      market: mapMarket(bet.market),
      selection: mapSelection(bet.market),
      odds: bet.bookmakerOdds,
      stake: bet.kellyStake.recommendedStake,
      kellyFraction: bet.kellyStake.halfKelly,
      confidence: bet.ourProbability
    });

    trackedBets = new Set([...trackedBets, `${selectedMatch.id}_${bet.market}`]);
  }

  /**
   * Load upcoming matches from the data service.
   * Exported for testability (onMount doesn't fire in jsdom).
   */
  export async function loadMatches() {
    matchesLoading = true;
    error = null;

    try {
      const matches = await dataService.getMatches({ upcoming: true, days: 14 });
      upcomingMatches = matches.filter(m => !m.result);

      // Auto-select first match if available
      if (upcomingMatches.length > 0 && !selectedMatchId) {
        selectedMatchId = upcomingMatches[0].id;
      }
    } catch {
      error = 'Could not load upcoming matches. Check your API key in Settings.';
    } finally {
      matchesLoading = false;
    }
  }

  /**
   * Run the value bet scanner with user-entered odds.
   * Exported for testability.
   */
  export async function scanForValue() {
    if (!selectedMatch || !hasBasicOdds) return;

    loading = true;
    hasScanned = true;
    valueBets = [];
    error = null;

    try {
      const marketOdds: MarketOdds = {
        home: homeOdds,
        draw: drawOdds,
        away: awayOdds,
        ...(over25Odds > 1 && under25Odds > 1 ? { over25: over25Odds, under25: under25Odds } : {}),
        ...(bttsOdds > 1 && bttsNoOdds > 1 ? { btts: bttsOdds, bttsNo: bttsNoOdds } : {})
      };

      valueBets = await ValueBettingEngine.identifyValueBets(
        selectedMatch.id,
        selectedMatch.home_team,
        selectedMatch.away_team,
        new Date(selectedMatch.date),
        marketOdds,
        bankroll
      );
    } catch {
      error = 'Failed to analyse odds. Please try again.';
    } finally {
      loading = false;
    }
  }

  function marketLabel(market: string): string {
    switch (market) {
      case 'home': return 'Home Win';
      case 'draw': return 'Draw';
      case 'away': return 'Away Win';
      case 'over2.5': return 'Over 2.5 Goals';
      case 'under2.5': return 'Under 2.5 Goals';
      case 'btts': return 'Both Teams to Score';
      default: return market;
    }
  }

  function confidenceColour(c: string): string {
    return c === 'high' ? 'text-emerald-400' : c === 'medium' ? 'text-amber-400' : 'text-red-400';
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
  }

  onMount(() => {
    loadMatches();
  });
</script>

<div class="max-w-lg mx-auto" data-testid="value-bets">
  <div class="card-glass p-6">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <div class="p-2 rounded-lg" style="background: linear-gradient(135deg, #7c3aed, #6d28d9);">
        <Search class="w-5 h-5 text-white" />
      </div>
      <div>
        <h2 class="text-lg font-bold font-display text-foreground">Value Bet Scanner</h2>
        <p class="text-xs text-muted-foreground">Enter bookmaker odds to find edges in the market</p>
      </div>
    </div>

    {#if matchesLoading}
      <div class="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <div class="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
        <span class="text-sm">Loading matches...</span>
      </div>
    {:else if error && upcomingMatches.length === 0}
      <div class="text-center py-6">
        <p class="text-sm text-red-400">{error}</p>
      </div>
    {:else if upcomingMatches.length === 0}
      <div class="text-center py-6">
        <TrendingUp class="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
        <p class="text-sm text-muted-foreground">No upcoming matches found</p>
      </div>
    {:else}
      <!-- Match selector -->
      <div class="mb-4">
        <label for="match-select" class="block text-sm font-medium text-foreground mb-1.5">
          Select Match
        </label>
        <select
          id="match-select"
          bind:value={selectedMatchId}
          class="w-full px-3 py-2.5 rounded-lg border border-border bg-muted text-foreground text-sm"
        >
          {#each upcomingMatches as match (match.id)}
            <option value={match.id}>
              {match.home_team} vs {match.away_team}
            </option>
          {/each}
        </select>
      </div>

      {#if selectedMatch}
        <!-- Match preview -->
        <div class="flex items-center justify-center gap-3 mb-4 py-2">
          <div class="flex items-center gap-2">
            <img src={getTeamLogo(selectedMatch.home_team)} alt="" class="w-6 h-6" />
            <span class="font-medium text-foreground text-sm">{selectedMatch.home_team}</span>
          </div>
          <span class="text-xs text-muted-foreground">vs</span>
          <div class="flex items-center gap-2">
            <span class="font-medium text-foreground text-sm">{selectedMatch.away_team}</span>
            <img src={getTeamLogo(selectedMatch.away_team)} alt="" class="w-6 h-6" />
          </div>
        </div>

        <!-- Odds inputs -->
        <div class="space-y-4 mb-5">
          <!-- 1X2 Market (required) -->
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Match Result (1X2)</p>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label for="home-odds" class="block text-xs text-muted-foreground mb-1">Home</label>
                <input id="home-odds" type="number" bind:value={homeOdds} min="1.01" step="0.01" placeholder="e.g. 2.10"
                  class="w-full px-2 py-2 rounded-lg border border-border bg-muted text-foreground text-sm text-center" />
              </div>
              <div>
                <label for="draw-odds" class="block text-xs text-muted-foreground mb-1">Draw</label>
                <input id="draw-odds" type="number" bind:value={drawOdds} min="1.01" step="0.01" placeholder="e.g. 3.40"
                  class="w-full px-2 py-2 rounded-lg border border-border bg-muted text-foreground text-sm text-center" />
              </div>
              <div>
                <label for="away-odds" class="block text-xs text-muted-foreground mb-1">Away</label>
                <input id="away-odds" type="number" bind:value={awayOdds} min="1.01" step="0.01" placeholder="e.g. 3.60"
                  class="w-full px-2 py-2 rounded-lg border border-border bg-muted text-foreground text-sm text-center" />
              </div>
            </div>
          </div>

          <!-- Goals Market (optional) -->
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Over/Under 2.5 Goals <span class="text-muted-foreground/60">(optional)</span></p>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label for="over25-odds" class="block text-xs text-muted-foreground mb-1">Over 2.5</label>
                <input id="over25-odds" type="number" bind:value={over25Odds} min="1.01" step="0.01" placeholder="e.g. 1.85"
                  class="w-full px-2 py-2 rounded-lg border border-border bg-muted text-foreground text-sm text-center" />
              </div>
              <div>
                <label for="under25-odds" class="block text-xs text-muted-foreground mb-1">Under 2.5</label>
                <input id="under25-odds" type="number" bind:value={under25Odds} min="1.01" step="0.01" placeholder="e.g. 2.00"
                  class="w-full px-2 py-2 rounded-lg border border-border bg-muted text-foreground text-sm text-center" />
              </div>
            </div>
          </div>

          <!-- BTTS Market (optional) -->
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Both Teams to Score <span class="text-muted-foreground/60">(optional)</span></p>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label for="btts-yes-odds" class="block text-xs text-muted-foreground mb-1">BTTS Yes</label>
                <input id="btts-yes-odds" type="number" bind:value={bttsOdds} min="1.01" step="0.01" placeholder="e.g. 1.70"
                  class="w-full px-2 py-2 rounded-lg border border-border bg-muted text-foreground text-sm text-center" />
              </div>
              <div>
                <label for="btts-no-odds" class="block text-xs text-muted-foreground mb-1">BTTS No</label>
                <input id="btts-no-odds" type="number" bind:value={bttsNoOdds} min="1.01" step="0.01" placeholder="e.g. 2.10"
                  class="w-full px-2 py-2 rounded-lg border border-border bg-muted text-foreground text-sm text-center" />
              </div>
            </div>
          </div>

          <!-- Bankroll -->
          <div>
            <label for="value-bankroll" class="block text-sm font-medium text-foreground mb-1.5">Bankroll</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
              <input id="value-bankroll" type="number" bind:value={bankroll} min="1" step="10"
                class="w-full pl-7 pr-3 py-2.5 rounded-lg border border-border bg-muted text-foreground text-sm" />
            </div>
          </div>
        </div>

        <!-- Scan button -->
        <button
          on:click={scanForValue}
          disabled={!hasBasicOdds || loading}
          class="w-full py-2.5 rounded-lg font-medium text-sm transition-all
            {hasBasicOdds ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed'}"
        >
          {#if loading}
            <span class="inline-flex items-center gap-2">
              <span class="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
              Analysing...
            </span>
          {:else}
            Scan for Value
          {/if}
        </button>

        <!-- Results -->
        {#if error && !matchesLoading}
          <div class="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <p class="text-sm text-red-400">{error}</p>
          </div>
        {/if}

        {#if !loading && hasScanned && valueBets.length === 0 && !error}
          <div class="mt-4 text-center py-4">
            <p class="text-sm text-muted-foreground">No value found at these odds — the market looks efficient here</p>
          </div>
        {/if}

        {#if valueBets.length > 0}
          <div class="mt-4 space-y-3" aria-live="polite" aria-label="Value bet results">
            {#each valueBets as bet (bet.market)}
              <div class="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4" transition:fade>
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <CheckCircle class="w-4 h-4 text-emerald-500" />
                    <span class="font-medium text-foreground text-sm">{marketLabel(bet.market)}</span>
                  </div>
                  <span class="text-xs font-medium {confidenceColour(bet.confidence)} uppercase">{bet.confidence}</span>
                </div>

                <div class="grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <p class="text-xs text-muted-foreground">Edge</p>
                    <p class="text-sm font-bold text-emerald-400">+{(bet.edge * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">EV</p>
                    <p class="text-sm font-bold text-emerald-400">+{(bet.expectedValue * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Stake</p>
                    <p class="text-sm font-bold text-primary">{formatCurrency(bet.kellyStake.recommendedStake)}</p>
                  </div>
                </div>

                <!-- Reasoning -->
                <div class="space-y-1 mb-2">
                  {#each bet.reasoning as reason}
                    <p class="text-xs text-muted-foreground">{reason}</p>
                  {/each}
                </div>

                <!-- Warnings -->
                {#if bet.warnings.length > 0}
                  <div class="flex items-start gap-1.5 mt-2 pt-2 border-t border-border/30">
                    <AlertTriangle class="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div class="space-y-0.5">
                      {#each bet.warnings as warning}
                        <p class="text-xs text-amber-400">{warning}</p>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Track Bet button -->
                <div class="mt-2 pt-2 border-t border-border/30">
                  {#if trackedBets.has(`${selectedMatch?.id}_${bet.market}`)}
                    <span class="inline-flex items-center gap-1 text-xs text-emerald-500">
                      <Check class="w-3.5 h-3.5" /> Tracked
                    </span>
                  {:else}
                    <button
                      class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      on:click={() => trackValueBet(bet)}
                    >
                      <BookmarkPlus class="w-3.5 h-3.5" /> Track Bet
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</div>
