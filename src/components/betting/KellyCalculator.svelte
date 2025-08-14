<script lang="ts">
  import { Calculator, TrendingUp, AlertTriangle, DollarSign, Target } from 'lucide-svelte';
  import { KellyCalculator, type KellyCalculation } from '../../services/betting/kelly';
  import { fade, slide } from 'svelte/transition';
  
  let ourProbability: number = 0.55;
  let bookmakerOdds: number = 2.0;
  let bankroll: number = 1000;
  let confidenceLevel: number = 0.7;
  let maxStakePercentage: number = 0.05;
  let kellyFraction: 'full' | 'half' | 'quarter' = 'half';
  
  let calculation: KellyCalculation | null = null;
  let showAdvanced: boolean = false;
  let simulationResults: any = null;
  
  function calculate() {
    calculation = KellyCalculator.calculate({
      outcome: 'Manual Calculation',
      ourProbability: ourProbability / 100,
      bookmakerOdds,
      bankroll,
      maxStakePercentage: maxStakePercentage / 100,
      confidenceLevel
    });
  }
  
  function runSimulation() {
    simulationResults = KellyCalculator.simulate(
      bankroll,
      [{ probability: ourProbability / 100, odds: bookmakerOdds }],
      1000,
      kellyFraction === 'full' ? 1 : kellyFraction === 'half' ? 0.5 : 0.25
    );
  }
  
  function getRecommendedStake(): number {
    if (!calculation) return 0;
    
    switch (kellyFraction) {
      case 'full': return calculation.fullKelly * bankroll;
      case 'half': return calculation.halfKelly * bankroll;
      case 'quarter': return calculation.quarterKelly * bankroll;
      default: return calculation.halfKelly * bankroll;
    }
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
</script>

<div class="kelly-calculator bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6">
  <div class="header mb-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
          <Calculator class="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Kelly Criterion Calculator</h2>
          <p class="text-sm text-slate-600 dark:text-slate-400">Calculate optimal bet sizes for maximum growth</p>
        </div>
      </div>
      
      <button
        on:click={() => showAdvanced = !showAdvanced}
        class="text-sm text-primary hover:text-primary/80 font-medium"
      >
        {showAdvanced ? 'Simple' : 'Advanced'} Mode
      </button>
    </div>
  </div>
  
  <div class="calculator-inputs grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
    <!-- Your Probability -->
    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
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
          <input
            type="number"
            bind:value={ourProbability}
            min="1"
            max="99"
            class="w-20 px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
          />
          <span class="text-sm font-medium text-primary">{ourProbability}%</span>
        </div>
      </div>
    </div>
    
    <!-- Bookmaker Odds -->
    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Bookmaker Odds (Decimal)
      </label>
      <input
        type="number"
        bind:value={bookmakerOdds}
        min="1.01"
        max="100"
        step="0.01"
        class="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
        Implied: {((1 / bookmakerOdds) * 100).toFixed(1)}%
      </p>
    </div>
    
    <!-- Bankroll -->
    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Your Bankroll
      </label>
      <input
        type="number"
        bind:value={bankroll}
        min="1"
        max="1000000"
        step="100"
        class="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </div>
    
    <!-- Kelly Fraction -->
    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Kelly Fraction
      </label>
      <div class="grid grid-cols-3 gap-2">
        <button
          on:click={() => kellyFraction = 'quarter'}
          class="px-3 py-2 rounded-lg text-sm font-medium transition-colors {
            kellyFraction === 'quarter'
              ? 'bg-primary text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }"
        >
          1/4 Kelly
        </button>
        <button
          on:click={() => kellyFraction = 'half'}
          class="px-3 py-2 rounded-lg text-sm font-medium transition-colors {
            kellyFraction === 'half'
              ? 'bg-primary text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }"
        >
          1/2 Kelly
        </button>
        <button
          on:click={() => kellyFraction = 'full'}
          class="px-3 py-2 rounded-lg text-sm font-medium transition-colors {
            kellyFraction === 'full'
              ? 'bg-primary text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }"
        >
          Full Kelly
        </button>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
        Conservative bettors use fractional Kelly
      </p>
    </div>
    
    {#if showAdvanced}
      <!-- Confidence Level -->
      <div transition:slide>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Model Confidence
        </label>
        <div class="relative">
          <input
            type="range"
            bind:value={confidenceLevel}
            min="0.1"
            max="1"
            step="0.05"
            class="w-full"
          />
          <div class="flex justify-between items-center mt-1">
            <span class="text-sm text-slate-500">Low</span>
            <span class="text-sm font-medium text-primary">{(confidenceLevel * 100).toFixed(0)}%</span>
            <span class="text-sm text-slate-500">High</span>
          </div>
        </div>
      </div>
      
      <!-- Max Stake -->
      <div transition:slide>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Max Stake (% of bankroll)
        </label>
        <input
          type="number"
          bind:value={maxStakePercentage}
          min="1"
          max="25"
          step="1"
          class="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
    {/if}
  </div>
  
  {#if calculation}
    <div class="results space-y-4" transition:fade>
      <!-- Value Assessment -->
      <div class="p-4 rounded-lg {
        calculation.isValueBet 
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
      }">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            {#if calculation.isValueBet}
              <Target class="w-5 h-5 text-green-600 dark:text-green-400" />
              <span class="font-semibold text-green-800 dark:text-green-300">Value Bet Detected!</span>
            {:else}
              <AlertTriangle class="w-5 h-5 text-red-600 dark:text-red-400" />
              <span class="font-semibold text-red-800 dark:text-red-300">No Value</span>
            {/if}
          </div>
          
          <div class="text-sm">
            <span class="text-slate-600 dark:text-slate-400">EV:</span>
            <span class="font-bold {
              calculation.expectedValue > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }">
              {calculation.expectedValue > 0 ? '+' : ''}{formatPercentage(calculation.expectedValue)}
            </span>
          </div>
        </div>
        
        <div class="mt-2 text-sm text-slate-700 dark:text-slate-300">
          Edge: <span class="font-medium">{formatPercentage(calculation.edgePercentage / 100)}</span> |
          Confidence: <span class="font-medium capitalize">{calculation.confidence}</span> |
          Risk: <span class="font-medium capitalize">{calculation.risk}</span>
        </div>
      </div>
      
      <!-- Recommended Stake -->
      <div class="bg-gradient-to-r from-primary/10 to-accent/10 dark:from-primary/20 dark:to-accent/20 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center space-x-2">
            <DollarSign class="w-5 h-5 text-primary" />
            <span class="font-semibold text-slate-800 dark:text-slate-200">Recommended Stake</span>
          </div>
          <span class="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
            {kellyFraction === 'full' ? 'Full' : kellyFraction === 'half' ? 'Half' : 'Quarter'} Kelly
          </span>
        </div>
        
        <div class="grid grid-cols-3 gap-4">
          <div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-1">Stake Amount</p>
            <p class="text-xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(getRecommendedStake())}
            </p>
          </div>
          <div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-1">% of Bankroll</p>
            <p class="text-xl font-bold text-slate-900 dark:text-white">
              {formatPercentage(getRecommendedStake() / bankroll)}
            </p>
          </div>
          <div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-1">Potential Return</p>
            <p class="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(getRecommendedStake() * bookmakerOdds)}
            </p>
          </div>
        </div>
      </div>
      
      <!-- Kelly Values -->
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-1">Full Kelly</p>
          <p class="text-lg font-bold text-slate-900 dark:text-white">
            {formatPercentage(calculation.fullKelly)}
          </p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-1">Half Kelly</p>
          <p class="text-lg font-bold text-slate-900 dark:text-white">
            {formatPercentage(calculation.halfKelly)}
          </p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-1">Quarter Kelly</p>
          <p class="text-lg font-bold text-slate-900 dark:text-white">
            {formatPercentage(calculation.quarterKelly)}
          </p>
        </div>
      </div>
      
      {#if showAdvanced}
        <!-- Simulation -->
        <div class="mt-4">
          <button
            on:click={runSimulation}
            class="btn btn-secondary w-full flex items-center justify-center space-x-2"
          >
            <TrendingUp class="w-4 h-4" />
            <span>Run 1000 Bet Simulation</span>
          </button>
          
          {#if simulationResults}
            <div class="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg" transition:slide>
              <h4 class="font-semibold text-slate-900 dark:text-white mb-3">Simulation Results</h4>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span class="text-slate-600 dark:text-slate-400">Avg Final Bankroll:</span>
                  <span class="font-medium text-slate-900 dark:text-white ml-2">
                    {formatCurrency(simulationResults.finalBankroll)}
                  </span>
                </div>
                <div>
                  <span class="text-slate-600 dark:text-slate-400">Avg Return:</span>
                  <span class="font-medium {
                    simulationResults.averageReturn > 0 ? 'text-green-600' : 'text-red-600'
                  } ml-2">
                    {simulationResults.averageReturn > 0 ? '+' : ''}{simulationResults.averageReturn}%
                  </span>
                </div>
                <div>
                  <span class="text-slate-600 dark:text-slate-400">Max Drawdown:</span>
                  <span class="font-medium text-orange-600 ml-2">
                    {simulationResults.maxDrawdown}%
                  </span>
                </div>
                <div>
                  <span class="text-slate-600 dark:text-slate-400">Bust Rate:</span>
                  <span class="font-medium text-red-600 ml-2">
                    {simulationResults.bustRate}%
                  </span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
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