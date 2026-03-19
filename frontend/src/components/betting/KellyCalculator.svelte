<script lang="ts" context="module">
  import type { KellyCalculation } from '../../services/betting/kelly';

  export interface KellySuggestion {
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    date: string;
    predictedResult: 'H' | 'D' | 'A';
    confidence: number;
    ourProbability: number;
    bookmakerOdds: number;
    kelly: KellyCalculation;
    stake: number;
    insights: string[];
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { Calculator, AlertTriangle, TrendingUp, Zap, RefreshCw, BookmarkPlus, Check } from 'lucide-svelte';
  import { KellyCalculator } from '../../services/betting/kelly';
  import { dataService } from '../../services/dataService';
  import { OptimizedPredictor, type EnhancedPredictionModel } from '../../lib/optimizedPredictions';
  import { betHistoryService } from '../../services/betting/betHistoryService';
  import { fade } from 'svelte/transition';
  import { getTeamLogo } from '../../utils/teamLogos';

  // --- Manual calculator inputs ---
  let bankroll: number = 100;
  let bookmakerOdds: number = 2.0;
  let ourProbability: number = 55;
  let calculation: KellyCalculation | null = null;

  let suggestions: KellySuggestion[] = [];
  let suggestionsLoading = false;
  let suggestionsError: string | null = null;
  let confidenceThreshold = 65; // percentage, spec says >= 65%
  let trackedBets: Set<string> = new Set();

  function trackBet(suggestion: KellySuggestion) {
    const selection = suggestion.predictedResult === 'H' ? 'home'
      : suggestion.predictedResult === 'A' ? 'away' : 'draw';

    betHistoryService.storeBet({
      matchId: suggestion.matchId,
      matchDate: suggestion.date,
      homeTeam: suggestion.homeTeam,
      awayTeam: suggestion.awayTeam,
      market: 'match_result',
      selection,
      odds: suggestion.bookmakerOdds,
      stake: suggestion.stake,
      kellyFraction: suggestion.kelly.halfKelly,
      confidence: suggestion.confidence
    });

    trackedBets = new Set([...trackedBets, suggestion.matchId]);
  }

  /**
   * Load upcoming matches, predict each, and generate Kelly suggestions.
   * Exported for testability (onMount doesn't fire in jsdom).
   */
  export async function loadSuggestions() {
    suggestionsLoading = true;
    suggestionsError = null;
    suggestions = [];

    try {
      const upcomingMatches = await dataService.getMatches({ upcoming: true, days: 14 });

      if (upcomingMatches.length === 0) {
        suggestionsLoading = false;
        return;
      }

      const results: KellySuggestion[] = [];

      for (const match of upcomingMatches) {
        // Skip matches that already have a result
        if (match.result) continue;

        let prediction: EnhancedPredictionModel;
        try {
          prediction = await OptimizedPredictor.predictMatch(
            match.home_team,
            match.away_team,
            undefined,
            match.referee
          );
        } catch {
          continue; // Skip matches where prediction fails
        }

        const confidencePercent = prediction.confidence * 100;

        // Filter: confidence must meet threshold
        if (confidencePercent < confidenceThreshold) continue;

        // Kelly compares OUR model's probability against the bookmaker's odds.
        // ourProbability = model confidence; bookmakerOdds = valueOdds for the outcome.
        // Edge exists when confidence > implied probability (1/odds).
        const prob = prediction.confidence;
        let odds: number;

        if (prediction.valueOdds) {
          odds = prediction.predictedResult === 'H' ? prediction.valueOdds.home
            : prediction.predictedResult === 'A' ? prediction.valueOdds.away
              : prediction.valueOdds.draw;
        } else {
          // No external odds available — no edge can be detected
          odds = 1 / prob;
        }

        // Compute Kelly
        const kelly = KellyCalculator.calculate({
          outcome: `${match.home_team} vs ${match.away_team}`,
          ourProbability: prob,
          bookmakerOdds: odds,
          bankroll
        });

        // Filter: must be a positive EV bet
        if (kelly.expectedValue <= 0) continue;

        results.push({
          matchId: match.id,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          date: match.date,
          predictedResult: prediction.predictedResult,
          confidence: prediction.confidence,
          ourProbability: prob,
          bookmakerOdds: odds,
          kelly,
          stake: Math.max(0, kelly.halfKelly * bankroll),
          insights: prediction.insights.slice(0, 2) // Top 2 insights
        });
      }

      // Sort by edge (highest first)
      results.sort((a, b) => b.kelly.edgePercentage - a.kelly.edgePercentage);
      suggestions = results;
    } catch (err) {
      suggestionsError = 'Could not load suggestions. Check your API key in Settings.';
    } finally {
      suggestionsLoading = false;
    }
  }

  // Recalculate suggestion stakes when bankroll changes
  $: if (suggestions.length > 0 && bankroll > 0) {
    suggestions = suggestions.map(s => {
      const kelly = KellyCalculator.calculate({
        outcome: `${s.homeTeam} vs ${s.awayTeam}`,
        ourProbability: s.ourProbability,
        bookmakerOdds: s.bookmakerOdds,
        bankroll
      });
      return { ...s, kelly, stake: Math.max(0, kelly.halfKelly * bankroll) };
    });
  }

  function resultLabel(result: 'H' | 'D' | 'A'): string {
    return result === 'H' ? 'Home Win' : result === 'A' ? 'Away Win' : 'Draw';
  }

  // --- Manual calculator ---
  function calculate() {
    calculation = KellyCalculator.calculate({
      outcome: 'Manual Calculation',
      ourProbability: ourProbability / 100,
      bookmakerOdds,
      bankroll
    });
  }

  function getStake(): number {
    if (!calculation) return 0;
    return Math.max(0, calculation.halfKelly * bankroll);
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(value);
  }

  // Auto-recalculate when inputs change
  $: if (ourProbability && bookmakerOdds && bankroll) {
    calculate();
  }

  onMount(() => {
    loadSuggestions();
  });
</script>

<div class="max-w-lg mx-auto space-y-6" data-testid="kelly-calculator">
  <!-- Suggested Bets Section -->
  <div class="card-glass p-6" data-testid="kelly-suggestions">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-lg bg-gradient-to-br from-emerald-800 to-emerald-700 dark:from-emerald-900 dark:to-emerald-800">
          <Zap class="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 class="text-lg font-bold font-display text-foreground">Suggested Bets</h2>
          <p class="text-xs text-muted-foreground">Auto-generated from upcoming match predictions</p>
        </div>
      </div>
      <button
        on:click={loadSuggestions}
        disabled={suggestionsLoading}
        class="p-2 rounded-lg hover:bg-muted transition-colors"
        title="Refresh suggestions"
        aria-label="Refresh suggestions"
      >
        <RefreshCw class="w-4 h-4 text-muted-foreground {suggestionsLoading ? 'animate-spin' : ''}" />
      </button>
    </div>

    <!-- Confidence threshold slider -->
    <div class="mb-4">
      <label for="confidence-threshold" class="flex items-center justify-between text-sm text-muted-foreground mb-1.5">
        <span>Min. Confidence</span>
        <span class="font-mono text-foreground">{confidenceThreshold}%</span>
      </label>
      <input
        id="confidence-threshold"
        type="range"
        bind:value={confidenceThreshold}
        min="40"
        max="90"
        step="5"
        class="w-full accent-primary"
        on:input={loadSuggestions}
      />
      <div class="flex justify-between text-xs text-muted-foreground mt-0.5">
        <span>More bets</span>
        <span>Higher quality</span>
      </div>
    </div>

    <!-- Loading state -->
    {#if suggestionsLoading}
      <div class="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <RefreshCw class="w-4 h-4 animate-spin" />
        <span class="text-sm">Analysing upcoming matches...</span>
      </div>
    {:else if suggestionsError}
      <div class="text-center py-6">
        <p class="text-sm text-red-400">{suggestionsError}</p>
        <button
          on:click={loadSuggestions}
          class="mt-2 text-xs text-primary hover:underline"
        >Try again</button>
      </div>
    {:else if suggestions.length === 0}
      <div class="text-center py-6">
        <TrendingUp class="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
        <p class="text-sm text-muted-foreground">No value bets found at {confidenceThreshold}% confidence</p>
        <p class="text-xs text-muted-foreground mt-1">Try lowering the threshold or check back before the next gameweek</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each suggestions as suggestion (suggestion.matchId)}
          <div class="rounded-lg border border-border bg-muted/30 p-3" transition:fade>
            <!-- Match header -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2 text-sm">
                <img src={getTeamLogo(suggestion.homeTeam)} alt="" class="w-4 h-4" />
                <span class="font-medium text-foreground">{suggestion.homeTeam}</span>
                <span class="text-muted-foreground">vs</span>
                <span class="font-medium text-foreground">{suggestion.awayTeam}</span>
                <img src={getTeamLogo(suggestion.awayTeam)} alt="" class="w-4 h-4" />
              </div>
            </div>

            <!-- Prediction + Kelly result -->
            <div class="flex items-center justify-between">
              <div>
                <span class="inline-block px-2 py-0.5 text-xs font-medium rounded-full
                  {suggestion.predictedResult === 'H' ? 'bg-blue-500/20 text-blue-400' :
                   suggestion.predictedResult === 'A' ? 'bg-orange-500/20 text-orange-400' :
                   'bg-purple-500/20 text-purple-400'}">
                  {resultLabel(suggestion.predictedResult)}
                </span>
                <span class="text-xs text-muted-foreground ml-2">
                  {(suggestion.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
              <div class="text-right">
                <p class="text-sm font-bold text-emerald-500">{formatCurrency(suggestion.stake)}</p>
                <p class="text-xs text-muted-foreground">
                  Edge: <span class="font-mono text-emerald-400">+{suggestion.kelly.edgePercentage.toFixed(1)}%</span>
                </p>
              </div>
            </div>

            <!-- Insight (top one) -->
            {#if suggestion.insights.length > 0}
              <p class="text-xs text-muted-foreground mt-1.5 truncate">{suggestion.insights[0]}</p>
            {/if}

            <!-- Track Bet button -->
            <div class="mt-2 pt-2 border-t border-border/30">
              {#if trackedBets.has(suggestion.matchId)}
                <span class="inline-flex items-center gap-1 text-xs text-emerald-500">
                  <Check class="w-3.5 h-3.5" /> Tracked
                </span>
              {:else}
                <button
                  class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  on:click={() => trackBet(suggestion)}
                >
                  <BookmarkPlus class="w-3.5 h-3.5" /> Track Bet
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <p class="text-xs text-muted-foreground text-center mt-3">
        {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} · stakes based on £{bankroll} bankroll
      </p>
    {/if}
  </div>

  <!-- Manual Calculator Section -->
  <div class="card-glass p-6">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <div class="p-2 rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 dark:from-slate-900 dark:to-slate-800">
        <Calculator class="w-5 h-5 text-white" />
      </div>
      <div>
        <h2 class="text-lg font-bold font-display text-foreground">Kelly Calculator</h2>
        <p class="text-xs text-muted-foreground">Half-Kelly stake sizing for sensible bankroll growth</p>
      </div>
    </div>

    <!-- Inputs -->
    <div class="space-y-4 mb-6">
      <div>
        <label for="bankroll" class="block text-sm font-medium text-foreground mb-1.5">
          Your Bankroll
        </label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
          <input
            id="bankroll"
            type="number"
            bind:value={bankroll}
            min="1"
            step="10"
            class="w-full pl-7 pr-3 py-2.5 rounded-lg border border-border bg-muted text-foreground text-sm"
          />
        </div>
      </div>

      <div>
        <label for="odds" class="block text-sm font-medium text-foreground mb-1.5">
          Bookmaker Odds (Decimal)
        </label>
        <input
          id="odds"
          type="number"
          bind:value={bookmakerOdds}
          min="1.01"
          max="100"
          step="0.01"
          class="w-full px-3 py-2.5 rounded-lg border border-border bg-muted text-foreground text-sm"
        />
        <p class="text-xs text-muted-foreground mt-1">
          Implied probability: {((1 / bookmakerOdds) * 100).toFixed(1)}%
        </p>
      </div>

      <div>
        <label for="probability" class="block text-sm font-medium text-foreground mb-1.5">
          Your Win Probability (%)
        </label>
        <input
          id="probability"
          type="number"
          bind:value={ourProbability}
          min="1"
          max="99"
          step="1"
          class="w-full px-3 py-2.5 rounded-lg border border-border bg-muted text-foreground text-sm"
        />
      </div>
    </div>

    <!-- Results -->
    {#if calculation}
      <div class="rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 p-5" data-testid="kelly-results" transition:fade aria-live="polite" aria-label="Kelly calculation results">
        <!-- Primary result -->
        <div class="text-center mb-4 pb-4 border-b border-border/30">
          <p class="text-xs text-muted-foreground uppercase tracking-wider mb-1">Stake Amount</p>
          <p class="text-2xl sm:text-3xl font-bold font-display text-primary">
            {formatCurrency(getStake())}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            {bankroll > 0 ? ((getStake() / bankroll) * 100).toFixed(1) : '0.0'}% of bankroll
          </p>
        </div>

        <!-- Secondary results -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div class="text-center">
            <p class="text-xs text-muted-foreground mb-0.5">Expected Value</p>
            <p class="text-lg font-bold {calculation.expectedValue > 0 ? 'text-emerald-500' : 'text-red-500'}">
              {calculation.expectedValue > 0 ? '+' : ''}{(calculation.expectedValue * 100).toFixed(1)}%
            </p>
          </div>
          <div class="text-center">
            <p class="text-xs text-muted-foreground mb-0.5">Potential Return</p>
            <p class="text-lg font-bold text-accent">
              {formatCurrency(getStake() * bookmakerOdds)}
            </p>
          </div>
        </div>

        <!-- Edge indicator -->
        <div class="mt-4 pt-3 border-t border-border/30 flex justify-between text-xs text-muted-foreground">
          <span>Your edge: <span class="font-mono {calculation.edgePercentage > 0 ? 'text-emerald-500' : 'text-red-400'}">{(calculation.edgePercentage * 100).toFixed(1)}%</span></span>
          <span>{calculation.isValueBet ? '✓ Value bet' : '✗ No value'}</span>
        </div>

        <!-- Warning if no value -->
        {#if calculation.edgePercentage < 0}
          <div class="mt-3 p-2.5 bg-red-500/10 rounded-lg border border-red-500/20 flex items-start gap-2">
            <AlertTriangle class="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p class="text-xs text-red-400">
              The odds don't offer value at this probability. Consider passing.
            </p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
