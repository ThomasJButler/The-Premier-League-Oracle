<script lang="ts">
  import { KellyCalculator, type KellyCalculation } from '../../services/betting/kelly';

  const BANKROLL_KEY = 'kelly_bankroll';

  function readSavedBankroll(): number {
    if (typeof localStorage === 'undefined') return 100;
    const saved = localStorage.getItem(BANKROLL_KEY);
    if (!saved) return 100;
    const parsed = parseFloat(saved);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
  }

  let bankroll: number = readSavedBankroll();
  let bookmakerOdds: number = 2.0;
  let ourProbability: number = 55;
  let calculation: KellyCalculation | null = null;

  function saveBankroll(): void {
    localStorage.setItem(BANKROLL_KEY, String(bankroll));
  }

  function recalculate(): void {
    calculation = KellyCalculator.calculate({
      outcome: 'Manual Calculation',
      ourProbability: ourProbability / 100,
      bookmakerOdds,
      bankroll,
    });
  }

  function handleBankrollInput(): void {
    saveBankroll();
    recalculate();
  }

  function handleOddsInput(): void {
    recalculate();
  }

  function handleProbabilityInput(): void {
    recalculate();
  }

  function getStake(): number {
    if (!calculation) return 0;
    return Math.max(0, calculation.halfKelly * bankroll);
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(value);
  }

  recalculate();

  $: stakeFractionPct = calculation
    ? Math.min(Math.max(calculation.fullKelly, 0), 1) * 100
    : 0;
</script>

<div
  class="rounded-lg border border-border bg-bg-raised p-6 max-w-lg"
  data-testid="kelly-calculator"
>
  <header class="mb-5">
    <p class="text-body-sm uppercase tracking-wider text-text-dim">Stake sizing</p>
    <h2 class="text-display font-display text-foreground">Kelly Calculator</h2>
    <p class="text-body text-text-muted mt-1">Half-Kelly stake sizing for sensible bankroll growth.</p>
  </header>

  <div class="space-y-4 mb-5">
    <div>
      <label for="kelly-bankroll" class="block text-label text-foreground mb-1.5">
        Your bankroll
      </label>
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim text-body">£</span>
        <input
          id="kelly-bankroll"
          type="number"
          data-input="bankroll"
          bind:value={bankroll}
          on:input={handleBankrollInput}
          min="1"
          step="10"
          class="w-full pl-7 pr-3 py-2.5 rounded-md border border-border bg-bg-inset text-foreground text-label"
        />
      </div>
    </div>

    <div>
      <label for="kelly-odds" class="block text-label text-foreground mb-1.5">
        Bookmaker odds (decimal)
      </label>
      <input
        id="kelly-odds"
        type="number"
        data-input="odds"
        bind:value={bookmakerOdds}
        on:input={handleOddsInput}
        min="1.01"
        max="100"
        step="0.01"
        class="w-full px-3 py-2.5 rounded-md border border-border bg-bg-inset text-foreground text-label"
      />
      <p class="text-body-sm text-text-dim mt-1">
        Implied probability: {((1 / bookmakerOdds) * 100).toFixed(1)}%
      </p>
    </div>

    <div>
      <label for="kelly-probability" class="block text-label text-foreground mb-1.5">
        Your win probability (%)
      </label>
      <input
        id="kelly-probability"
        type="number"
        data-input="probability"
        bind:value={ourProbability}
        on:input={handleProbabilityInput}
        min="1"
        max="99"
        step="1"
        class="w-full px-3 py-2.5 rounded-md border border-border bg-bg-inset text-foreground text-label"
      />
    </div>
  </div>

  {#if calculation}
    <div
      class="rounded-md border border-border bg-bg-inset p-5"
      data-results
      aria-live="polite"
      aria-label="Kelly calculation results"
    >
      <div class="text-center pb-4 mb-4 border-b border-border">
        <p class="text-body-sm uppercase tracking-wider text-text-dim mb-1">Stake amount</p>
        <p class="text-display font-display text-foreground" data-output="stake">
          {formatCurrency(getStake())}
        </p>
        <p class="text-body-sm text-text-dim mt-1">
          {bankroll > 0 ? ((getStake() / bankroll) * 100).toFixed(1) : '0.0'}% of bankroll
        </p>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="text-center">
          <p class="text-body-sm text-text-dim mb-0.5">Expected value</p>
          <p
            class="text-label font-display"
            data-output="ev"
            class:text-emerald-500={calculation.expectedValue > 0}
            class:text-red-500={calculation.expectedValue <= 0}
          >
            {calculation.expectedValue > 0 ? '+' : ''}{(calculation.expectedValue * 100).toFixed(1)}%
          </p>
        </div>
        <div class="text-center">
          <p class="text-body-sm text-text-dim mb-0.5">Your edge</p>
          <p
            class="text-label font-display"
            data-output="edge"
            class:text-emerald-500={calculation.edgePercentage > 0}
            class:text-red-500={calculation.edgePercentage <= 0}
          >
            {calculation.edgePercentage > 0 ? '+' : ''}{calculation.edgePercentage.toFixed(1)}%
          </p>
        </div>
      </div>

      <div class="mb-3">
        <div class="flex justify-between text-body-sm text-text-dim mb-1.5">
          <span>Stake fraction</span>
          <span>{stakeFractionPct.toFixed(0)}% of bankroll (full Kelly)</span>
        </div>
        <div
          class="relative h-2 rounded-full bg-bg-raised border border-border overflow-hidden"
          data-stake-bar
          role="img"
          aria-label="Kelly stake fraction visualisation"
        >
          <div
            class="absolute inset-y-0 left-0 bg-accent"
            data-stake-value
            style="width: {stakeFractionPct}%"
          ></div>
          <span
            class="absolute inset-y-0 w-px bg-border-strong"
            data-stake-mark="quarter"
            style="left: 25%"
            aria-label="Quarter Kelly mark"
          ></span>
          <span
            class="absolute inset-y-0 w-px bg-border-strong"
            data-stake-mark="half"
            style="left: 50%"
            aria-label="Half Kelly mark"
          ></span>
          <span
            class="absolute inset-y-0 w-px bg-border-strong"
            data-stake-mark="full"
            style="left: 100%"
            aria-label="Full Kelly mark"
          ></span>
        </div>
        <div class="flex justify-between text-body-sm text-text-dim mt-1">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <div class="flex justify-between text-body-sm text-text-dim pt-3 border-t border-border">
        <span data-output="value-flag">{calculation.isValueBet ? 'Value bet' : 'No value'}</span>
        <span>Half-Kelly recommended</span>
      </div>

      {#if calculation.edgePercentage < 0}
        <div
          class="mt-3 p-3 rounded-md border border-red-500/30 bg-red-500/10"
          data-no-value
        >
          <p class="text-body-sm text-red-500">
            The odds don't offer value at this probability. Consider passing.
          </p>
        </div>
      {/if}
    </div>
  {/if}
</div>
