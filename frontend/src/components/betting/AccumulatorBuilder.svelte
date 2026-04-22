<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Layers, RefreshCw, Trash2, BookmarkPlus, Check, AlertTriangle, ChevronDown, ChevronUp, Shield, TrendingUp, Flame } from 'lucide-svelte';
  import { BetBuilderPredictor } from '../../lib/betBuilder';
  import type { BetBuilderPrediction, BetBuilderCombo } from '../../lib/betBuilder';
  import { OptimizedPredictor } from '../../lib/optimizedPredictions';
  import { dataService } from '../../services/dataService';
  import { betHistoryService } from '../../services/betting/betHistoryService';
  import type { Match } from '../../types';
  import { getTeamLogo } from '../../utils/teamLogos';
  import { Button } from '$lib/components/ui/button';

  interface MatchComboData {
    match: Match;
    betBuilder: BetBuilderPrediction;
    expanded: boolean;
  }

  interface AccumulatorLeg {
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    matchDate: string;
    selection: string;
    probability: number;
    fairOdds: number;
  }

  interface AutoAccumulator {
    name: string;
    description: string;
    icon: typeof Shield;
    accent: 'emerald' | 'amber' | 'red';
    legs: AccumulatorLeg[];
    combinedOdds: number;
    combinedProbability: number;
    kellyStake: number;
  }

  let matchCombos: MatchComboData[] = [];
  let loading = true;
  let error = '';
  let accumulatorLegs: AccumulatorLeg[] = [];
  let bankroll = 100;
  let trackedBets = new Set<string>();
  let autoAccumulators: { safe: AutoAccumulator; risky: AutoAccumulator; favourites: AutoAccumulator } | null = null;
  let autoLoading = true;
  let autoError = '';

  // Derived accumulator calculations
  $: combinedProbability = accumulatorLegs.reduce((acc, leg) => acc * leg.probability, 1);
  $: combinedOdds = accumulatorLegs.reduce((acc, leg) => acc * leg.fairOdds, 1);
  $: kellyFraction = combinedOdds > 1 ? ((combinedOdds - 1) * combinedProbability - (1 - combinedProbability)) / (combinedOdds - 1) : 0;
  $: recommendedStake = Math.max(0, kellyFraction * 0.25 * bankroll); // Quarter Kelly
  $: expectedValue = (combinedProbability * combinedOdds) - 1;
  $: accumulatorKey = accumulatorLegs.map(l => `${l.matchId}_${l.selection}`).sort().join('|');

  /**
   * Auto-build three preset accumulators from the current gameweek's
   * predictions. Runs on mount in parallel with `loadMatches` (which powers
   * the per-match bet-builder combos below the strip).
   *
   *  - Safe Builder: up to 5 legs, confidence ≥ 0.65 (falls back to ≥ 0.55
   *    if fewer than 3 matches clear the high bar).
   *  - Risky Builder: up to 6 legs in the 0.45 ≤ conf < 0.65 band, sorted
   *    by expected value (`prob × fairOdds − 1`), for longer-odds value bets.
   *  - Favourites Accumulator: every upcoming matchday fixture (up to 10),
   *    each leg = the model's predictedResult regardless of confidence.
   */
  export async function buildAutoAccumulators() {
    autoLoading = true;
    autoError = '';
    autoAccumulators = null;

    try {
      const season = await dataService.getCurrentSeason();
      const currentMatchday = season?.currentMatchday;
      const allMatches = await dataService.getCurrentSeasonMatches();

      // Candidate set: matches in the current matchday that haven't been
      // played yet. If the matchday is thin (e.g. < 3 fixtures left), fall
      // back to the next 14 days so the auto-build still has something to
      // work with on off-week days.
      let candidates = allMatches.filter(
        (m) => m.matchday === currentMatchday && !m.result,
      );
      if (candidates.length < 3) {
        const fourteen = await dataService.getMatches({ upcoming: true, days: 14 });
        candidates = fourteen.filter((m: Match) => !m.result).slice(0, 10);
      }
      if (candidates.length === 0) {
        autoLoading = false;
        return;
      }

      // Predict each candidate match. Cap at 10 for performance — the
      // Favourites Accumulator only uses 10 anyway.
      const picks: Array<{ match: Match; leg: AccumulatorLeg; ev: number }> = [];
      for (const match of candidates.slice(0, 10)) {
        try {
          const pred = await OptimizedPredictor.predictMatch(
            match.home_team,
            match.away_team,
            undefined,
            match.referee ?? null,
            match.date,
          );
          const outcomeKey: 'home' | 'draw' | 'away' =
            pred.predictedResult === 'H' ? 'home'
            : pred.predictedResult === 'A' ? 'away'
            : 'draw';
          const fairOdds = pred.valueOdds?.[outcomeKey] ?? 2.0;
          const selectionLabel =
            pred.predictedResult === 'H' ? `${match.home_team} to win`
            : pred.predictedResult === 'A' ? `${match.away_team} to win`
            : 'Draw';
          const leg: AccumulatorLeg = {
            matchId: match.id,
            homeTeam: match.home_team,
            awayTeam: match.away_team,
            matchDate: match.date,
            selection: selectionLabel,
            probability: pred.confidence,
            fairOdds,
          };
          const ev = pred.confidence * fairOdds - 1;
          picks.push({ match, leg, ev });
        } catch {
          // Skip matches that fail to predict — non-critical
        }
      }

      if (picks.length === 0) {
        autoError = 'No predictions available yet.';
        autoLoading = false;
        return;
      }

      // Safe: confidence ≥ 0.65, top 5 by confidence. Fall back to ≥ 0.55 if
      // fewer than 3 clear the high bar.
      const sortedByConfidence = [...picks].sort((a, b) => b.leg.probability - a.leg.probability);
      let safePicks = sortedByConfidence.filter((p) => p.leg.probability >= 0.65).slice(0, 5);
      if (safePicks.length < 3) {
        safePicks = sortedByConfidence.filter((p) => p.leg.probability >= 0.55).slice(0, 5);
      }
      if (safePicks.length < 3) {
        // Not enough data — take top 3 regardless.
        safePicks = sortedByConfidence.slice(0, 3);
      }

      // Risky: 0.45 ≤ conf < 0.65, sorted by EV, top 6.
      const riskyPicks = [...picks]
        .filter((p) => p.leg.probability >= 0.45 && p.leg.probability < 0.65)
        .sort((a, b) => b.ev - a.ev)
        .slice(0, 6);

      // Favourites: every candidate, model's top outcome regardless.
      const favouritePicks = picks.slice(0, 10);

      const buildAcc = (
        name: string,
        description: string,
        icon: typeof Shield,
        accent: 'emerald' | 'amber' | 'red',
        legPicks: typeof picks,
      ): AutoAccumulator => {
        const legs = legPicks.map((p) => p.leg);
        const combinedProb = legs.reduce((acc, l) => acc * l.probability, 1);
        const combinedO = legs.reduce((acc, l) => acc * l.fairOdds, 1);
        const kelly =
          combinedO > 1
            ? Math.max(0, ((combinedO - 1) * combinedProb - (1 - combinedProb)) / (combinedO - 1))
            : 0;
        return {
          name,
          description,
          icon,
          accent,
          legs,
          combinedOdds: combinedO,
          combinedProbability: combinedProb,
          kellyStake: kelly * 0.25 * bankroll,
        };
      };

      autoAccumulators = {
        safe: buildAcc(
          'Safe Builder',
          `${safePicks.length} high-confidence picks`,
          Shield,
          'emerald',
          safePicks,
        ),
        risky: buildAcc(
          'Risky Builder',
          `${riskyPicks.length} value picks (mid-confidence, higher payout)`,
          TrendingUp,
          'amber',
          riskyPicks.length >= 3 ? riskyPicks : sortedByConfidence.slice(0, 4),
        ),
        favourites: buildAcc(
          'Favourites Accumulator',
          `${favouritePicks.length} games — every fixture, model's top pick`,
          Flame,
          'red',
          favouritePicks,
        ),
      };
    } catch (err) {
      autoError = err instanceof Error ? err.message : 'Failed to build auto-accumulators.';
    } finally {
      autoLoading = false;
    }
  }

  /**
   * Load the auto-accumulator's legs into the manual-builder state so the
   * user can tweak (remove a leg, add a different market) before tracking.
   */
  function useAutoAccumulator(acc: AutoAccumulator) {
    accumulatorLegs = [...acc.legs];
  }

  /**
   * Save the auto-accumulator directly to betting history without moving
   * through the manual builder.
   */
  function saveAutoAccumulator(acc: AutoAccumulator) {
    if (acc.legs.length < 2) return;
    const firstLeg = acc.legs[0];
    const selectionSummary = acc.legs
      .map((l) => `${l.homeTeam} v ${l.awayTeam}: ${l.selection}`)
      .join(' | ');
    betHistoryService.storeBet({
      matchId: firstLeg.matchId,
      matchDate: firstLeg.matchDate,
      homeTeam: acc.legs.map((l) => l.homeTeam).join(', '),
      awayTeam: acc.legs.map((l) => l.awayTeam).join(', '),
      market: 'combo',
      selection: `${acc.name}: ${selectionSummary}`,
      odds: Math.round(acc.combinedOdds * 100) / 100,
      stake: Math.round(acc.kellyStake * 100) / 100,
      kellyFraction: 0.25,
      confidence: acc.combinedProbability,
    });
    trackedBets = new Set([...trackedBets, `auto_${acc.name}`]);
  }

  export async function loadMatches() {
    loading = true;
    error = '';
    matchCombos = [];

    try {
      const matches = await dataService.getMatches({ upcoming: true, days: 14 });
      const upcoming = matches.filter((m: Match) => !m.result);

      if (upcoming.length === 0) {
        loading = false;
        return;
      }

      // Generate bet builder data for each match (limit to 10 for performance)
      const matchesToProcess = upcoming.slice(0, 10);
      const results: MatchComboData[] = [];

      for (const match of matchesToProcess) {
        try {
          // Pass matchDate + referee so the internal predictMatch measures
          // fatigue from kickoff (not "now") — prevents the degenerate grid
          // that caused BTTS No = 100% on every card (Bug 0.2/0.4).
          const betBuilder = await BetBuilderPredictor.generateBetBuilder(
            match.home_team,
            match.away_team,
            match.id,
            undefined,
            match.date,
            match.referee
          );
          if (betBuilder.suggestedCombos.length > 0) {
            results.push({ match, betBuilder, expanded: false });
          }
        } catch {
          // Skip matches that fail to generate — non-critical
        }
      }

      matchCombos = results;
    } catch (err) {
      error = 'Failed to load upcoming matches. Please check your API key.';
    } finally {
      loading = false;
    }
  }

  function addLeg(match: Match, combo: BetBuilderCombo, selectionIndex: number) {
    const selection = combo.selections[selectionIndex];
    const probability = combo.confidence;
    const fairOdds = probability > 0 ? (1 / probability) * 1.05 : 2.0;

    // Don't add duplicate legs for the same match + selection
    const existing = accumulatorLegs.find(
      l => l.matchId === match.id && l.selection === selection
    );
    if (existing) return;

    accumulatorLegs = [...accumulatorLegs, {
      matchId: match.id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      matchDate: match.date,
      selection,
      probability,
      fairOdds
    }];
  }

  function addComboAsLegs(match: Match, combo: BetBuilderCombo) {
    // Add the entire combo as a single accumulator leg
    const existing = accumulatorLegs.find(
      l => l.matchId === match.id && l.selection === combo.selections.join(' + ')
    );
    if (existing) return;

    accumulatorLegs = [...accumulatorLegs, {
      matchId: match.id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      matchDate: match.date,
      selection: combo.selections.join(' + '),
      probability: combo.confidence,
      fairOdds: combo.combinedOdds
    }];
  }

  function removeLeg(index: number) {
    accumulatorLegs = accumulatorLegs.filter((_, i) => i !== index);
  }

  function clearAccumulator() {
    accumulatorLegs = [];
  }

  function trackAccumulator() {
    if (accumulatorLegs.length < 2) return;

    const firstLeg = accumulatorLegs[0];
    const selectionSummary = accumulatorLegs
      .map(l => `${l.homeTeam} v ${l.awayTeam}: ${l.selection}`)
      .join(' | ');

    betHistoryService.storeBet({
      matchId: firstLeg.matchId,
      matchDate: firstLeg.matchDate,
      homeTeam: accumulatorLegs.map(l => l.homeTeam).join(', '),
      awayTeam: accumulatorLegs.map(l => l.awayTeam).join(', '),
      market: 'combo',
      selection: selectionSummary,
      odds: Math.round(combinedOdds * 100) / 100,
      stake: Math.round(recommendedStake * 100) / 100,
      kellyFraction: 0.25,
      confidence: combinedProbability
    });

    trackedBets = new Set([...trackedBets, accumulatorKey]);
  }

  function trackSuggestedCombo(match: Match, combo: BetBuilderCombo) {
    const comboKey = `${match.id}_${combo.name}`;
    if (trackedBets.has(comboKey)) return;

    betHistoryService.storeBet({
      matchId: match.id,
      matchDate: match.date,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      market: 'combo',
      selection: combo.selections.join(' + '),
      odds: Math.round(combo.combinedOdds * 100) / 100,
      stake: Math.round(Math.max(0, ((combo.combinedOdds - 1) * combo.confidence - (1 - combo.confidence)) / (combo.combinedOdds - 1)) * 0.25 * bankroll * 100) / 100,
      kellyFraction: 0.25,
      confidence: combo.confidence
    });

    trackedBets = new Set([...trackedBets, comboKey]);
  }

  function toggleExpanded(index: number) {
    matchCombos = matchCombos.map((mc, i) => ({
      ...mc,
      expanded: i === index ? !mc.expanded : mc.expanded
    }));
  }

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  }

  function formatCurrency(amount: number): string {
    return `£${amount.toFixed(2)}`;
  }

  function confidenceColour(confidence: number): string {
    if (confidence >= 0.65) return 'text-emerald-600 dark:text-emerald-400';
    if (confidence >= 0.5) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-500 dark:text-red-400';
  }

  function confidenceBg(confidence: number): string {
    if (confidence >= 0.65) return 'bg-emerald-100 dark:bg-emerald-900/30';
    if (confidence >= 0.5) return 'bg-amber-100 dark:bg-amber-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  }

  onMount(() => {
    loadMatches();
    buildAutoAccumulators();
  });
</script>

<div class="max-w-2xl mx-auto space-y-6" data-testid="accumulator-builder">
  <!-- Auto-built accumulator presets (Safe / Risky / Favourites).
       Computed on mount from the current gameweek's predictions. Each card
       has "Use this" (loads legs into the manual builder below) and "Save"
       (tracks directly into Betting History). -->
  <div class="card-glass p-4 sm:p-6" data-testid="auto-accumulators">
    <div class="flex items-center gap-3 mb-4">
      <div class="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700">
        <Layers class="w-5 h-5 text-white" />
      </div>
      <div>
        <h2 class="font-bold font-display text-foreground">Auto-built accumulators</h2>
        <p class="text-xs text-muted-foreground">Three preset slips from this gameweek's predictions — pick one or tweak below.</p>
      </div>
    </div>

    {#if autoLoading}
      <div class="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <RefreshCw class="w-4 h-4 animate-spin" />
        Building accumulators from this week's predictions…
      </div>
    {:else if autoError}
      <div class="flex items-center gap-2 p-4 text-sm text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <AlertTriangle class="w-4 h-4" />
        {autoError}
      </div>
    {:else if autoAccumulators}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="auto-accumulator-strip">
        {#each [autoAccumulators.safe, autoAccumulators.risky, autoAccumulators.favourites] as acc}
          {@const accentClasses =
            acc.accent === 'emerald'
              ? { text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: 'from-emerald-500 to-emerald-700' }
              : acc.accent === 'amber'
              ? { text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: 'from-amber-500 to-amber-700' }
              : { text: 'text-red-600 dark:text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: 'from-red-500 to-red-700' }}
          <div
            class="flex flex-col gap-2 p-4 rounded-xl border {accentClasses.border} {accentClasses.bg}"
            data-testid="auto-accumulator-card-{acc.accent}"
          >
            <div class="flex items-center gap-2 mb-1">
              <div class="p-1.5 rounded-lg bg-gradient-to-br {accentClasses.icon}">
                <svelte:component this={acc.icon} class="w-4 h-4 text-white" />
              </div>
              <h3 class="font-bold text-sm {accentClasses.text}">{acc.name}</h3>
            </div>
            <p class="text-[11px] text-muted-foreground mb-1">{acc.description}</p>

            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <div class="text-muted-foreground">Combined</div>
                <div class="font-bold font-mono text-sm {accentClasses.text}">@{acc.combinedOdds.toFixed(2)}</div>
              </div>
              <div>
                <div class="text-muted-foreground">Win prob</div>
                <div class="font-bold text-sm text-foreground">{(acc.combinedProbability * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div class="text-muted-foreground">¼ Kelly</div>
                <div class="font-bold text-sm text-foreground">{formatCurrency(acc.kellyStake)}</div>
              </div>
              <div>
                <div class="text-muted-foreground">Legs</div>
                <div class="font-bold text-sm text-foreground">{acc.legs.length}</div>
              </div>
            </div>

            <!-- Collapsed leg list (always visible — important for trust) -->
            <ul class="text-[11px] text-muted-foreground mt-1 space-y-0.5 max-h-32 overflow-y-auto pr-1">
              {#each acc.legs as leg}
                <li class="truncate">
                  <span class="font-medium text-foreground/80">{leg.selection}</span>
                  <span class="text-muted-foreground/70"> · @{leg.fairOdds.toFixed(2)}</span>
                </li>
              {/each}
            </ul>

            <div class="flex gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                class="flex-1 text-xs"
                on:click={() => useAutoAccumulator(acc)}
                data-testid="auto-accumulator-use-{acc.accent}"
              >
                Use this
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="flex-1 text-xs"
                on:click={() => saveAutoAccumulator(acc)}
                disabled={trackedBets.has(`auto_${acc.name}`) || acc.legs.length < 2}
                data-testid="auto-accumulator-save-{acc.accent}"
              >
                {#if trackedBets.has(`auto_${acc.name}`)}
                  <Check class="w-3 h-3 mr-1" /> Saved
                {:else}
                  <BookmarkPlus class="w-3 h-3 mr-1" /> Save
                {/if}
              </Button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Custom Accumulator Builder -->
  {#if accumulatorLegs.length > 0}
    <div class="card-glass p-6" data-testid="custom-accumulator" transition:fade={{ duration: 200 }}>
      <div class="flex items-start gap-3 mb-4">
        <div class="p-2 rounded-lg" style="background: linear-gradient(135deg, #0ea5e9, #0284c7);">
          <Layers class="w-5 h-5 text-white" />
        </div>
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-bold font-display text-foreground">Your Accumulator</h2>
              <p class="text-xs text-muted-foreground">{accumulatorLegs.length} leg{accumulatorLegs.length !== 1 ? 's' : ''} selected</p>
            </div>
            <button
              class="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
              on:click={clearAccumulator}
              aria-label="Clear accumulator"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Legs list -->
      <div class="space-y-2 mb-4">
        {#each accumulatorLegs as leg, i}
          <div class="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm" transition:fade={{ duration: 150 }}>
            <span class="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
            <div class="flex-1 min-w-0">
              <div class="text-xs text-muted-foreground truncate">{leg.homeTeam} v {leg.awayTeam}</div>
              <div class="font-medium text-foreground truncate">{leg.selection}</div>
            </div>
            <span class="text-xs font-mono text-muted-foreground">@{leg.fairOdds.toFixed(2)}</span>
            <button
              class="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
              on:click={() => removeLeg(i)}
              aria-label="Remove leg {i + 1}"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        {/each}
      </div>

      <!-- Accumulator summary -->
      <div class="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
        <div class="grid grid-cols-3 gap-3 text-center text-sm mb-3">
          <div>
            <div class="text-xs text-muted-foreground">Combined Odds</div>
            <div class="font-bold font-mono text-foreground">@{combinedOdds.toFixed(2)}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Win Prob</div>
            <div class="font-bold {confidenceColour(combinedProbability)}">{(combinedProbability * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Expected Value</div>
            <div class="font-bold {expectedValue > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}">
              {expectedValue > 0 ? '+' : ''}{(expectedValue * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <!-- Stake & return -->
        <div class="flex items-center gap-3 mb-3">
          <div class="flex-1">
            <label class="text-xs text-muted-foreground block mb-1" for="acca-bankroll">Bankroll</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
              <input
                id="acca-bankroll"
                type="number"
                bind:value={bankroll}
                min="1"
                class="w-full pl-7 pr-3 py-2 rounded-lg border border-border bg-muted text-foreground text-sm"
              />
            </div>
          </div>
          <div class="flex-1">
            <div class="text-xs text-muted-foreground mb-1">¼ Kelly Stake</div>
            <div class="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(recommendedStake)}
            </div>
          </div>
          <div class="flex-1">
            <div class="text-xs text-muted-foreground mb-1">Potential Return</div>
            <div class="text-lg font-bold text-foreground">
              {formatCurrency(recommendedStake * combinedOdds)}
            </div>
          </div>
        </div>

        {#if expectedValue <= 0}
          <div class="flex items-center gap-2 p-2 rounded bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs mb-3">
            <AlertTriangle class="w-3.5 h-3.5 flex-shrink-0" />
            <span>Negative expected value — this accumulator is unlikely to be profitable long-term.</span>
          </div>
        {/if}

        {#if accumulatorLegs.length >= 2}
          <div class="border-t border-border/30 pt-3">
            {#if trackedBets.has(accumulatorKey)}
              <div class="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm">
                <Check class="w-4 h-4" />
                <span class="font-medium">Tracked</span>
              </div>
            {:else}
              <Button variant="default" class="w-full" on:click={trackAccumulator}>
                <BookmarkPlus class="w-4 h-4 mr-2" />
                Track Accumulator
              </Button>
            {/if}
          </div>
        {:else}
          <p class="text-xs text-muted-foreground text-center">Add at least 2 legs to track this accumulator.</p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Suggested Combos per Match -->
  <div class="card-glass p-6" data-testid="suggested-combos">
    <div class="flex items-start gap-3 mb-4">
      <div class="p-2 rounded-lg" style="background: linear-gradient(135deg, #14b8a6, #0d9488);">
        <Layers class="w-5 h-5 text-white" />
      </div>
      <div class="flex-1">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-bold font-display text-foreground">Accumulator Builder</h2>
            <p class="text-xs text-muted-foreground">Pre-built combos and custom accumulator selection</p>
          </div>
          <button
            class="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            on:click={loadMatches}
            aria-label="Refresh suggestions"
          >
            <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
          </button>
        </div>
      </div>
    </div>

    {#if loading}
      <div class="flex flex-col items-center justify-center py-12" data-testid="loading">
        <div class="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3"></div>
        <p class="text-sm text-muted-foreground">Analysing upcoming matches…</p>
      </div>
    {:else if error}
      <div class="text-center py-8">
        <AlertTriangle class="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p class="text-sm text-muted-foreground mb-3">{error}</p>
        <Button variant="ghost" on:click={loadMatches}>Try again</Button>
      </div>
    {:else if matchCombos.length === 0}
      <div class="text-center py-8">
        <Layers class="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p class="text-sm text-muted-foreground">No upcoming matches with combo suggestions found.</p>
        <p class="text-xs text-muted-foreground mt-1">Combos are generated for matches in the next 14 days.</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each matchCombos as { match, betBuilder, expanded }, matchIndex}
          <div class="rounded-lg border border-border bg-card/50 overflow-hidden" transition:fade={{ duration: 200 }}>
            <!-- Match header -->
            <button
              class="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
              on:click={() => toggleExpanded(matchIndex)}
              aria-expanded={expanded}
            >
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <img src={getTeamLogo(match.home_team)} alt="" class="w-5 h-5 object-contain" />
                <span class="text-sm font-medium text-foreground truncate">{match.home_team}</span>
                <span class="text-xs text-muted-foreground">v</span>
                <span class="text-sm font-medium text-foreground truncate">{match.away_team}</span>
                <img src={getTeamLogo(match.away_team)} alt="" class="w-5 h-5 object-contain" />
              </div>
              <span class="text-xs text-muted-foreground flex-shrink-0">{formatDate(match.date)}</span>
              <span class="text-xs font-medium text-primary flex-shrink-0">{betBuilder.suggestedCombos.length} combo{betBuilder.suggestedCombos.length !== 1 ? 's' : ''}</span>
              {#if expanded}
                <ChevronUp class="w-4 h-4 text-muted-foreground flex-shrink-0" />
              {:else}
                <ChevronDown class="w-4 h-4 text-muted-foreground flex-shrink-0" />
              {/if}
            </button>

            <!-- Combos (expanded) -->
            {#if expanded}
              <div class="border-t border-border/50 p-3 space-y-3" transition:fade={{ duration: 150 }}>
                {#each betBuilder.suggestedCombos as combo}
                  <div class="rounded-lg border border-border bg-muted/30 p-3">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-foreground">{combo.name}</span>
                        <span class="text-xs font-mono px-1.5 py-0.5 rounded {confidenceBg(combo.confidence)} {confidenceColour(combo.confidence)}">
                          {(combo.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <span class="text-xs font-mono bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                        @{combo.combinedOdds.toFixed(2)}
                      </span>
                    </div>

                    <!-- Selections -->
                    <div class="flex flex-wrap gap-1.5 mb-2">
                      {#each combo.selections as selection, selIdx}
                        <button
                          class="text-xs px-2 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors"
                          on:click={() => addLeg(match, combo, selIdx)}
                          aria-label="Add '{selection}' to your accumulator"
                        >
                          + {selection}
                        </button>
                      {/each}
                    </div>

                    <!-- Reasoning -->
                    <p class="text-xs text-muted-foreground leading-relaxed mb-2">{combo.reasoning}</p>

                    <!-- Actions -->
                    <div class="flex items-center justify-between border-t border-border/30 pt-2 mt-2">
                      <button
                        class="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                        on:click={() => addComboAsLegs(match, combo)}
                      >
                        + Add full combo to accumulator
                      </button>
                      {#if trackedBets.has(`${match.id}_${combo.name}`)}
                        <span class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs">
                          <Check class="w-3.5 h-3.5" />
                          <span class="font-medium">Tracked</span>
                        </span>
                      {:else}
                        <button
                          class="flex items-center gap-1 text-muted-foreground hover:text-primary text-xs transition-colors"
                          on:click={() => trackSuggestedCombo(match, combo)}
                        >
                          <BookmarkPlus class="w-3.5 h-3.5" />
                          <span>Track Bet</span>
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <p class="text-xs text-muted-foreground text-center mt-4">
        Showing combos for {matchCombos.length} upcoming match{matchCombos.length !== 1 ? 'es' : ''}.
        Click individual selections or full combos to build a cross-match accumulator.
      </p>
    {/if}
  </div>
</div>
