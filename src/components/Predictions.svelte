<script lang="ts">
  import { onMount } from 'svelte';
  import { dataService } from '../services/dataService';
  import { predictionTracker } from '../services/predictionTracker';
  import { predictMatch } from '../lib/predictions';
  import type { Match, Prediction } from '../types';
  import { format } from 'date-fns';
  import { fade } from 'svelte/transition';
  import { getTeamLogo } from '../utils/teamLogos';
  import { PoissonPredictor } from '../lib/advancedPredictions';
  import { TrendingUp, Target, Clock, Users, BarChart3, Calculator } from 'lucide-svelte';

  let predictions: Array<Match & { 
    prediction?: Prediction;
    detailedAnalysis?: {
      predictedScore: string;
      keyFactors: string[];
      confidence: number;
      homeForm: string;
      awayForm: string;
      h2hRecord: string;
      poissonProbs: { homeWin: number; draw: number; awayWin: number };
      recommendedStake: number;
    };
    predictionStatus?: 'pending' | 'processing' | 'complete' | 'error';
  }> = [];
  let accuracy = { total: 0, correct: 0, accuracy: 0 };
  let loading = true;
  let selectedMatch: Match | null = null;
  let predictionInProgress = false;
  let currentPrediction: any = null;
  let visible = false;
  let error: string | null = null;
  let flippedCards = new Set<string>(); // Track which cards are flipped
  
  // Batch prediction state
  let selectedGameweek = 1;
  let batchPredictionProgress = 0;
  let batchPredictionTotal = 0;
  let batchPredictionMessage = '';
  let isBatchPredicting = false;
  let currentProcessingTeam = '';

  async function loadGameweekMatches(gameweek: number) {
    loading = true;
    error = null;
    predictions = [];
    
    try {
      // Get all matches for the season
      const allMatches = await dataService.getCurrentSeasonMatches();
      
      // Filter for selected gameweek (10 matches per gameweek)
      const startIdx = (gameweek - 1) * 10;
      const endIdx = startIdx + 10;
      const gameweekMatches = allMatches.slice(startIdx, endIdx);
      
      // Initialize matches with pending status
      predictions = gameweekMatches.map(match => ({
        ...match,
        predictionStatus: 'pending' as const
      }));
      
      // Get accuracy stats
      const currentAccuracy = await dataService.getPredictionAccuracy('2025-2026');
      if (currentAccuracy) {
        accuracy = currentAccuracy;
      }
      
      visible = true;
    } catch (err) {
      error = 'Failed to load matches. Please try again.';
      console.error(err);
    } finally {
      loading = false;
    }
  }
  
  async function predictGameweek() {
    if (isBatchPredicting) return;
    
    isBatchPredicting = true;
    batchPredictionProgress = 0;
    batchPredictionTotal = predictions.filter(m => !m.result).length;
    
    const upcomingMatches = predictions.filter(m => !m.result);
    
    for (let i = 0; i < upcomingMatches.length; i++) {
      const match = upcomingMatches[i];
      const matchIndex = predictions.findIndex(p => p.id === match.id);
      
      // Update status to processing
      predictions[matchIndex].predictionStatus = 'processing';
      currentProcessingTeam = `${match.home_team} vs ${match.away_team}`;
      batchPredictionMessage = `Analyzing ${currentProcessingTeam}...`;
      batchPredictionProgress = i + 1;
      
      // Force UI update
      predictions = [...predictions];
      
      try {
        // Add small delay to show animation
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const prediction = await predictMatch(match.home_team, match.away_team);
        
        // Calculate Poisson probabilities for additional analysis
        const scoreProbabilities = PoissonPredictor.predictScoreProbabilities(
          prediction.predictedHomeGoals,
          prediction.predictedAwayGoals,
          6
        );
        const outcomeProbabilities = PoissonPredictor.getOutcomeProbabilities(scoreProbabilities);
        
        predictions[matchIndex] = {
          ...match,
          prediction: {
            predicted_result: prediction.predictedResult,
            confidence_score: prediction.confidence,
            predicted_home_goals: prediction.predictedHomeGoals,
            predicted_away_goals: prediction.predictedAwayGoals,
            was_correct: false,
            prediction_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
            id: `pred_${match.id}`,
            match_id: match.id
          },
          detailedAnalysis: {
            predictedScore: `${prediction.predictedHomeGoals}-${prediction.predictedAwayGoals}`,
            keyFactors: prediction.insights,
            confidence: prediction.confidence * 100,
            homeForm: 'WWDLW',
            awayForm: 'LDWDL',
            h2hRecord: prediction.insights.find(i => i.includes('H2H')) || 'No H2H data',
            poissonProbs: outcomeProbabilities,
            recommendedStake: Math.max(0, (prediction.confidence - 0.6) * 10)
          },
          predictionStatus: 'complete'
        };
        
        // Store in tracker
        predictionTracker.storePrediction(
          match.id,
          match.home_team,
          match.away_team,
          {
            predictedResult: prediction.predictedResult,
            predictedHomeGoals: prediction.predictedHomeGoals,
            predictedAwayGoals: prediction.predictedAwayGoals,
            confidence: prediction.confidence
          },
          match.date
        );
      } catch (error) {
        console.error(`Error predicting ${match.id}:`, error);
        predictions[matchIndex].predictionStatus = 'error';
      }
      
      // Force UI update
      predictions = [...predictions];
    }
    
    batchPredictionMessage = 'All predictions complete!';
    setTimeout(() => {
      isBatchPredicting = false;
      batchPredictionMessage = '';
    }, 2000);
  }

  function toggleCard(matchId: string) {
    if (flippedCards.has(matchId)) {
      flippedCards.delete(matchId);
    } else {
      flippedCards.add(matchId);
    }
    flippedCards = new Set(flippedCards);
  }

  onMount(() => loadGameweekMatches(selectedGameweek));
  
  function handleGameweekChange() {
    loadGameweekMatches(selectedGameweek);
  }
</script>

<div class="space-y-6 animate-fade-in">
  <!-- Header with Gameweek Selector -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <h2 class="text-2xl font-bold gradient-text">Match Predictions</h2>
    
    <div class="flex items-center gap-4">
      <!-- Gameweek Selector -->
      <div class="flex items-center gap-2">
        <label for="gameweek" class="text-sm font-medium">Gameweek:</label>
        <select
          id="gameweek"
          bind:value={selectedGameweek}
          on:change={handleGameweekChange}
          class="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          disabled={isBatchPredicting}
        >
          {#each Array(38) as _, i}
            <option value={i + 1}>Week {i + 1}</option>
          {/each}
        </select>
      </div>
      
      <!-- Predict Button -->
      <button
        on:click={predictGameweek}
        disabled={isBatchPredicting || loading}
        class="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {#if isBatchPredicting}
          <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          Predicting...
        {:else}
          <Calculator class="w-4 h-4" />
          Predict Gameweek
        {/if}
      </button>
    </div>
  </div>
  
  <!-- Batch Prediction Progress -->
  {#if isBatchPredicting}
    <div class="glass-card p-4" in:fade={{ duration: 300 }}>
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-sm font-medium">{batchPredictionMessage}</span>
          <span class="text-sm text-slate-500 dark:text-slate-400">
            {batchPredictionProgress} / {batchPredictionTotal}
          </span>
        </div>
        
        <!-- Progress Bar -->
        <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
          <div 
            class="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
            style="width: {(batchPredictionProgress / batchPredictionTotal) * 100}%"
          >
            <div class="h-full bg-white/30 animate-pulse"></div>
          </div>
        </div>
        
        <!-- Current Team Processing -->
        {#if currentProcessingTeam}
          <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Analyzing: {currentProcessingTeam}</span>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
    </div>
  {:else if error}
    <div class="card p-6 text-center bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700/50">
      <p class="text-rose-700 dark:text-rose-300 font-medium">{error}</p>
      <button class="btn btn-primary mt-4" on:click={() => loadGameweekMatches(selectedGameweek)}>Retry</button>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each predictions as prediction, i (prediction.id)}
        <div class="flip-card relative" style="animation-delay: {i * 50}ms">
          <!-- Status Indicator Overlay -->
          {#if prediction.predictionStatus === 'processing'}
            <div class="absolute inset-0 bg-blue-500/10 rounded-lg z-10 flex items-center justify-center pointer-events-none">
              <div class="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-lg flex items-center gap-2">
                <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span class="text-sm font-medium">Analyzing...</span>
              </div>
            </div>
          {:else if prediction.predictionStatus === 'complete'}
            <div class="absolute top-2 right-2 z-10 pointer-events-none">
              <div class="bg-green-500 text-white rounded-full p-1 animate-scale-in">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            </div>
          {:else if prediction.predictionStatus === 'error'}
            <div class="absolute top-2 right-2 z-10 pointer-events-none">
              <div class="bg-red-500 text-white rounded-full p-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
            </div>
          {/if}
          
          <div class="flip-card-inner {flippedCards.has(prediction.id) ? 'flipped' : ''}">
            <!-- Front of Card -->
            <div class="flip-card-front card card-glass">
              <div class="flex justify-between items-start mb-3">
                <span class="text-sm text-slate-500 dark:text-slate-400">{format(new Date(prediction.date), 'MMM d, HH:mm')}</span>
                {#if prediction.prediction}
                  <span class="badge {prediction.prediction.confidence_score > 0.75 ? 'badge-success' : prediction.prediction.confidence_score > 0.6 ? 'badge-warning' : 'badge-neutral'}">
                    {(prediction.prediction.confidence_score * 100).toFixed(0)}%
                  </span>
                {/if}
              </div>
              
              <div class="text-center mb-4">
                <div class="flex justify-center items-center space-x-4 mb-3">
                  <div class="flex flex-col items-center w-1/3">
                    <img src={getTeamLogo(prediction.home_team, 40)} alt="{prediction.home_team} logo" class="w-10 h-10 mb-2 object-contain rounded-full">
                    <span class="text-sm font-medium text-slate-800 dark:text-slate-200 text-center">{prediction.home_team}</span>
                  </div>
                  <div class="text-center">
                    <span class="text-xl font-bold text-slate-500 dark:text-slate-400">vs</span>
                    {#if prediction.detailedAnalysis}
                      <div class="text-2xl font-bold text-primary dark:text-primary-light mt-1">
                        {prediction.detailedAnalysis.predictedScore}
                      </div>
                    {/if}
                  </div>
                  <div class="flex flex-col items-center w-1/3">
                    <img src={getTeamLogo(prediction.away_team, 40)} alt="{prediction.away_team} logo" class="w-10 h-10 mb-2 object-contain rounded-full">
                    <span class="text-sm font-medium text-slate-800 dark:text-slate-200 text-center">{prediction.away_team}</span>
                  </div>
                </div>
              </div>

              {#if prediction.prediction}
                <div class="mb-4">
                  <div class="flex justify-around items-center bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3">
                    {#each [
                      { label: 'Home', value: 'H', prob: prediction.detailedAnalysis?.poissonProbs.homeWin },
                      { label: 'Draw', value: 'D', prob: prediction.detailedAnalysis?.poissonProbs.draw },
                      { label: 'Away', value: 'A', prob: prediction.detailedAnalysis?.poissonProbs.awayWin }
                    ] as outcome}
                      <div class="text-center px-2">
                        <span class="block text-xs font-medium text-slate-500 dark:text-slate-400">{outcome.label}</span>
                        <span class="block text-lg font-bold {prediction.prediction.predicted_result === outcome.value ? 'text-primary dark:text-primary-light' : 'text-slate-600 dark:text-slate-400'}">
                          {outcome.prob ? (outcome.prob * 100).toFixed(0) + '%' : '-'}
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <button 
                on:click={() => toggleCard(prediction.id)}
                class="w-full btn btn-outline btn-sm mt-2 flex items-center justify-center gap-2"
              >
                <Calculator class="w-4 h-4" />
                Tap for Analysis
              </button>
            </div>

            <!-- Back of Card -->
            <div class="flip-card-back card card-glass">
              {#if prediction.detailedAnalysis}
                <div class="h-full overflow-y-auto">
                  <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200">Analysis</h3>
                    <button 
                      on:click={() => toggleCard(prediction.id)}
                      class="btn btn-ghost btn-sm">
                      ×
                    </button>
                  </div>

                  <!-- Predicted Score Section -->
                  <div class="mb-4 p-3 bg-primary/10 dark:bg-primary/20 rounded-lg">
                    <div class="flex items-center gap-2 mb-2">
                      <Target class="w-4 h-4 text-primary" />
                      <span class="font-semibold text-slate-800 dark:text-slate-200">Predicted Score</span>
                    </div>
                    <div class="text-2xl font-bold text-primary text-center">
                      {prediction.detailedAnalysis.predictedScore}
                    </div>
                    <div class="text-sm text-center text-slate-600 dark:text-slate-400 mt-1">
                      Confidence: {prediction.detailedAnalysis.confidence.toFixed(1)}%
                    </div>
                  </div>

                  <!-- Form Section -->
                  <div class="mb-4">
                    <div class="flex items-center gap-2 mb-2">
                      <TrendingUp class="w-4 h-4 text-emerald-600" />
                      <span class="font-semibold text-slate-800 dark:text-slate-200">Recent Form</span>
                    </div>
                    <div class="space-y-2 text-sm">
                      <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400">{prediction.home_team}:</span>
                        <span class="font-mono">{prediction.detailedAnalysis.homeForm}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-slate-600 dark:text-slate-400">{prediction.away_team}:</span>
                        <span class="font-mono">{prediction.detailedAnalysis.awayForm}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Key Factors -->
                  <div class="mb-4">
                    <div class="flex items-center gap-2 mb-2">
                      <BarChart3 class="w-4 h-4 text-blue-600" />
                      <span class="font-semibold text-slate-800 dark:text-slate-200">Key Factors</span>
                    </div>
                    <ul class="text-sm space-y-1">
                      {#each prediction.detailedAnalysis.keyFactors as factor}
                        <li class="flex items-start gap-2">
                          <span class="text-primary mt-1">•</span>
                          <span class="text-slate-600 dark:text-slate-400">{factor}</span>
                        </li>
                      {/each}
                    </ul>
                  </div>

                  <!-- Betting Recommendation -->
                  {#if prediction.detailedAnalysis.recommendedStake > 0}
                    <div class="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
                      <div class="flex items-center gap-2 mb-1">
                        <Users class="w-4 h-4 text-amber-600" />
                        <span class="font-semibold text-amber-800 dark:text-amber-200">Betting Tip</span>
                      </div>
                      <div class="text-sm text-amber-700 dark:text-amber-300">
                        Recommended stake: {prediction.detailedAnalysis.recommendedStake.toFixed(1)}% of bankroll
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style lang="postcss">
  .card-glass {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.75rem;
  }

  .gradient-text {
    @apply bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent;
  }

  .animate-fade-in {
    animation: fadeIn 0.5s ease-out;
  }

  /* Flip Card Styles */
  .flip-card {
    background-color: transparent;
    width: 100%;
    height: 400px;
    perspective: 1000px;
    animation: slideInUp 0.6s ease-out forwards;
    opacity: 0;
  }

  .flip-card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    text-align: center;
    transition: transform 0.6s;
    transform-style: preserve-3d;
  }

  .flip-card-inner.flipped {
    transform: rotateY(180deg);
  }

  .flip-card-front, .flip-card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
  }

  .flip-card-front {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .flip-card-back {
    background-color: rgba(255, 255, 255, 0.15);
    transform: rotateY(180deg);
    padding: 1rem;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes scale-in {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .animate-scale-in {
    animation: scale-in 0.3s ease-out;
  }
</style>