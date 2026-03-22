<script lang="ts">
  import { onMount } from 'svelte';
  import { Calculator, AlertTriangle } from 'lucide-svelte';
  import { KellyCalculator, type KellyCalculation } from '../../services/betting/kelly';
  import { fade } from 'svelte/transition';

  const BANKROLL_KEY = 'kelly_bankroll';

  // --- Manual calculator inputs ---
  let bankroll: number = 100;
  let bookmakerOdds: number = 2.0;
  let ourProbability: number = 55;
  let calculation: KellyCalculation | null = null;

  function saveBankroll() {
    localStorage.setItem(BANKROLL_KEY, String(bankroll));
  }

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
    saveBankroll();
  }

  onMount(() => {
    const saved = localStorage.getItem(BANKROLL_KEY);
    if (saved) bankroll = parseFloat(saved) || 100;
  });
</script>

<div class="max-w-lg mx-auto space-y-6" data-testid="kelly-calculator">
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
        <p class="text-xs text-muted-foreground mt-1">Shared with Suggested Bets</p>
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
          <span>Your edge: <span class="font-mono {calculation.edgePercentage > 0 ? 'text-emerald-500' : 'text-red-400'}">{calculation.edgePercentage.toFixed(1)}%</span></span>
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
