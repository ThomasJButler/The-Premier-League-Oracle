<script lang="ts">
  import { Calculator, TrendingUp, AlertTriangle, DollarSign, Target, Settings, Save, Shield } from 'lucide-svelte';
  import { KellyCalculator, type KellyCalculation } from '../../services/betting/kelly';
  import { fade, slide } from 'svelte/transition';
  import { onMount } from 'svelte';
  
  // Main inputs
  let ourProbability: number = 55;
  let bookmakerOdds: number = 2.0;
  let bankroll: number = 100;
  let confidenceLevel: number = 0.7;
  let kellyFraction: 'conservative' | 'quarter' | 'half' = 'conservative';
  
  // Personal limits
  let maxBankroll: number = 500;
  let maxStakeAmount: number = 50;
  let dailyLossLimit: number = 100;
  let weeklyLossLimit: number = 300;
  let showLimits: boolean = false;
  
  let calculation: KellyCalculation | null = null;
  
  // Load saved limits
  onMount(() => {
    const saved = localStorage.getItem('betting_limits');
    if (saved) {
      const limits = JSON.parse(saved);
      maxBankroll = limits.maxBankroll || 500;
      maxStakeAmount = limits.maxStakeAmount || 50;
      dailyLossLimit = limits.dailyLossLimit || 100;
      weeklyLossLimit = limits.weeklyLossLimit || 300;
      bankroll = Math.min(bankroll, maxBankroll);
    }
  });
  
  function saveLimits() {
    const limits = {
      maxBankroll,
      maxStakeAmount,
      dailyLossLimit,
      weeklyLossLimit
    };
    localStorage.setItem('betting_limits', JSON.stringify(limits));
    bankroll = Math.min(bankroll, maxBankroll);
    showLimits = false;
  }
  
  function calculate() {
    const effectiveBankroll = Math.min(bankroll, maxBankroll);
    calculation = KellyCalculator.calculate({
      outcome: 'Manual Calculation',
      ourProbability: ourProbability / 100,
      bookmakerOdds,
      bankroll: effectiveBankroll,
      maxStakePercentage: maxStakeAmount / effectiveBankroll,
      confidenceLevel
    });
  }
  
  function getRecommendedStake(): number {
    if (!calculation) return 0;
    
    const effectiveBankroll = Math.min(bankroll, maxBankroll);
    let stake: number;
    
    switch (kellyFraction) {
      case 'conservative': 
        stake = calculation.quarterKelly * effectiveBankroll * 0.5;
        break;
      case 'quarter': 
        stake = calculation.quarterKelly * effectiveBankroll;
        break;
      case 'half': 
        stake = calculation.halfKelly * effectiveBankroll;
        break;
      default: 
        stake = calculation.quarterKelly * effectiveBankroll;
    }
    
    // Apply max stake limit
    return Math.min(stake, maxStakeAmount);
  }
  
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(value);
  }
  
  function formatPercentage(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }
  
  $: if (ourProbability && bookmakerOdds && bankroll) {
    calculate();
  }
  
  $: effectiveBankroll = Math.min(bankroll, maxBankroll);
</script>

<div class="max-w-[1000px] rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5">
  <div class="header mb-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
          <Calculator class="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 class="text-xl font-bold font-display text-foreground">Kelly Calculator</h2>
          <p class="text-sm text-muted-foreground">Safe betting with £{maxBankroll} maximum</p>
        </div>
      </div>
      
      <button
        on:click={() => showLimits = !showLimits}
        class="px-3 py-1 text-sm rounded-lg font-medium transition-colors bg-muted text-foreground hover:bg-muted/80 flex items-center gap-1"
      >
        <Settings class="w-4 h-4" />
        Personal Limits
      </button>
    </div>
  </div>
  
  <!-- Personal Limits Modal -->
  {#if showLimits}
    <div class="mb-6 p-4 bg-muted rounded-lg" transition:slide>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold font-display flex items-center gap-2">
          <Shield class="w-5 h-5 text-blue-500" />
          Personal Betting Limits
        </h3>
        <button
          on:click={saveLimits}
          class="px-3 py-1 text-sm rounded-lg font-medium transition-colors bg-primary text-white hover:bg-primary/90 flex items-center gap-1"
        >
          <Save class="w-4 h-4" />
          Save Limits
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-foreground mb-1">
            Maximum Bankroll
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">£</span>
            <input
              type="number"
              bind:value={maxBankroll}
              min="50"
              max="500"
              step="50"
              class="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-card"
            />
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-foreground mb-1">
            Max Stake Per Bet
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">£</span>
            <input
              type="number"
              bind:value={maxStakeAmount}
              min="5"
              max="100"
              step="5"
              class="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-card"
            />
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-foreground mb-1">
            Daily Loss Limit
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">£</span>
            <input
              type="number"
              bind:value={dailyLossLimit}
              min="20"
              max="200"
              step="10"
              class="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-card"
            />
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-foreground mb-1">
            Weekly Loss Limit
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">£</span>
            <input
              type="number"
              bind:value={weeklyLossLimit}
              min="50"
              max="500"
              step="50"
              class="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-card"
            />
          </div>
        </div>
      </div>
      
      <div class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
        <div class="flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p class="text-xs text-amber-800 dark:text-amber-200">
            These limits help you maintain responsible betting habits. The app will automatically cap recommendations based on these settings.
          </p>
        </div>
      </div>
    </div>
  {/if}
  
  <div class="calculator-inputs grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
    <!-- Bankroll -->
    <div>
      <label class="block text-sm font-medium text-foreground mb-2">
        Your Bankroll
      </label>
      <div class="relative">
        <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">£</span>
        <input
          type="number"
          bind:value={bankroll}
          min="10"
          max={maxBankroll}
          step="10"
          class="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-card"
        />
        <span class="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
          Max: £{maxBankroll}
        </span>
      </div>
    </div>
    
    <!-- Your Probability -->
    <div>
      <label class="block text-sm font-medium text-foreground mb-2">
        Your Win Probability
      </label>
      <div class="relative">
        <input
          type="range"
          bind:value={ourProbability}
          min="1"
          max="99"
          step="1"
          class="w-full"
        />
        <div class="flex justify-between items-center mt-1">
          <span class="text-xs text-muted-foreground">1%</span>
          <span class="text-sm font-medium text-primary">{ourProbability}%</span>
          <span class="text-xs text-muted-foreground">99%</span>
        </div>
      </div>
    </div>
    
    <!-- Bookmaker Odds -->
    <div>
      <label class="block text-sm font-medium text-foreground mb-2">
        Bookmaker Odds (Decimal)
      </label>
      <input
        type="number"
        bind:value={bookmakerOdds}
        min="1.01"
        max="100"
        step="0.01"
        class="w-full px-4 py-2 rounded-lg border border-border bg-muted"
      />
      <p class="text-xs text-muted-foreground mt-1">
        Implied: {((1 / bookmakerOdds) * 100).toFixed(1)}%
      </p>
    </div>
    
    <!-- Kelly Fraction -->
    <div>
      <label class="block text-sm font-medium text-foreground mb-2">
        Risk Level
      </label>
      <div class="grid grid-cols-3 gap-2">
        <button
          on:click={() => kellyFraction = 'conservative'}
          class="px-3 py-2 rounded-lg text-sm font-medium transition-colors {
            kellyFraction === 'conservative'
              ? 'bg-green-500 text-white'
              : 'bg-muted text-foreground hover:bg-muted/80'
          }"
        >
          Conservative
        </button>
        <button
          on:click={() => kellyFraction = 'quarter'}
          class="px-3 py-2 rounded-lg text-sm font-medium transition-colors {
            kellyFraction === 'quarter'
              ? 'bg-amber-500 text-white'
              : 'bg-muted text-foreground hover:bg-muted/80'
          }"
        >
          Standard
        </button>
        <button
          on:click={() => kellyFraction = 'half'}
          class="px-3 py-2 rounded-lg text-sm font-medium transition-colors {
            kellyFraction === 'half'
              ? 'bg-red-500 text-white'
              : 'bg-muted text-foreground hover:bg-muted/80'
          }"
        >
          Aggressive
        </button>
      </div>
    </div>
  </div>
  
  {#if calculation}
    <!-- Results -->
    <div class="results bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl p-6 mb-6" transition:fade>
      <h3 class="text-lg font-bold font-display mb-4 flex items-center space-x-2">
        <Target class="w-5 h-5 text-primary" />
        <span>Recommended Bet</span>
      </h3>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-card/80 rounded-lg p-4">
          <p class="text-sm text-muted-foreground mb-1">Stake Amount</p>
          <p class="text-2xl font-bold text-primary">
            {formatCurrency(getRecommendedStake())}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            {((getRecommendedStake() / effectiveBankroll) * 100).toFixed(1)}% of bankroll
          </p>
        </div>
        
        <div class="bg-card/80 rounded-lg p-4">
          <p class="text-sm text-muted-foreground mb-1">Expected Value</p>
          <p class="text-2xl font-bold {calculation.expectedValue > 0 ? 'text-green-600' : 'text-red-600'}">
            {calculation.expectedValue > 0 ? '+' : ''}{formatPercentage(calculation.expectedValue)}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            {calculation.expectedValue > 0 ? 'Positive EV' : 'Negative EV'}
          </p>
        </div>
        
        <div class="bg-card/80 rounded-lg p-4">
          <p class="text-sm text-muted-foreground mb-1">Potential Return</p>
          <p class="text-2xl font-bold text-blue-600">
            {formatCurrency(getRecommendedStake() * bookmakerOdds)}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            Profit: {formatCurrency(getRecommendedStake() * (bookmakerOdds - 1))}
          </p>
        </div>
      </div>
      
      <!-- Warning if edge is negative -->
      {#if calculation.edgePercentage < 0}
        <div class="mt-4 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700">
          <div class="flex items-start gap-2">
            <AlertTriangle class="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p class="text-sm font-semibold text-red-800 dark:text-red-200">No Value Detected</p>
              <p class="text-xs text-red-700 dark:text-red-300">
                The bookmaker odds don't offer value based on your probability. Consider passing on this bet.
              </p>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Warning if stake exceeds limits -->
      {#if getRecommendedStake() >= maxStakeAmount}
        <div class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
          <div class="flex items-start gap-2">
            <Shield class="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p class="text-xs text-amber-800 dark:text-amber-200">
              Stake has been capped at your maximum limit of £{maxStakeAmount}
            </p>
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Details -->
    <div class="details grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-muted rounded-lg p-4">
        <h4 class="text-sm font-semibold font-display mb-2">Kelly Values</h4>
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Full Kelly:</span>
            <span class="font-mono">{formatPercentage(calculation.fullKelly)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Half Kelly:</span>
            <span class="font-mono">{formatPercentage(calculation.halfKelly)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Quarter Kelly:</span>
            <span class="font-mono">{formatPercentage(calculation.quarterKelly)}</span>
          </div>
        </div>
      </div>
      
      <div class="bg-muted rounded-lg p-4">
        <h4 class="text-sm font-semibold font-display mb-2">Analysis</h4>
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Your Edge:</span>
            <span class="font-mono {calculation.edgePercentage > 0 ? 'text-green-600' : 'text-red-600'}">
              {calculation.edgePercentage > 0 ? '+' : ''}{formatPercentage(calculation.edgePercentage)}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Confidence:</span>
            <span class="font-mono">{(confidenceLevel * 100).toFixed(0)}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Risk Level:</span>
            <span class="font-mono capitalize">{kellyFraction}</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
