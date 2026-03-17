<script lang="ts">
  import { onMount } from 'svelte';
  import { dataService } from '../services/dataService';
  import { predictionTracker } from '../services/predictionTracker';
  import { calculateKelly } from '../services/betting/kelly';
  import { OptimizedPredictor } from '../lib/optimizedPredictions';
  import type { Match, Prediction } from '../types';
  import { format } from 'date-fns';
  import { fade } from 'svelte/transition';
  import { getTeamLogo } from '../utils/teamLogos';
  import { PoissonPredictor } from '../lib/advancedPredictions';
  import { BetBuilderPredictor } from '../lib/betBuilder';
  import type { BetBuilderPrediction } from '../lib/betBuilder';
  import type { AccuracyStats } from '../services/predictionTracker';
  import { TrendingUp, Target, Clock, Users, BarChart3, Calculator, Database, Package, ChevronDown, ChevronUp } from 'lucide-svelte';

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
    betBuilder?: BetBuilderPrediction;
    predictionStatus?: 'pending' | 'processing' | 'complete' | 'error';
  }> = [];
  let accuracy = { total: 0, correct: 0, accuracy: 0 };
  let accuracyStats: AccuracyStats | null = null;
  let showAccuracyPanel = false;
  let rollingLast10Accuracy = 0;
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
      
      // Filter for selected gameweek using the matchday field from the API
      const gameweekMatches = allMatches.filter(m => m.matchday === gameweek);
      
      // Filter to only show future matches (after current date/time)
      const now = new Date();
      const futureMatches = gameweekMatches.filter(match => {
        const matchDate = new Date(match.date);
        return matchDate > now || !match.result; // Show future matches or matches without results
      });
      
      // If no future matches in this gameweek, show a message
      if (futureMatches.length === 0 && gameweekMatches.length > 0) {
        error = 'All matches in this gameweek have already been played. Please select a future gameweek.';
        loading = false;
        return;
      }
      
      // Initialize matches with pending status
      predictions = futureMatches.map(match => ({
        ...match,
        predictionStatus: 'pending' as const
      }));
      
      // Get accuracy stats
      const currentAccuracy = await dataService.getPredictionAccuracy('2025-2026');
      if (currentAccuracy) {
        accuracy = currentAccuracy;
      }

      // Load full accuracy breakdown from PredictionTracker
      const fullStats = predictionTracker.getAccuracyStats(90);
      if (fullStats.totalPredictions > 0) {
        accuracyStats = fullStats;
      }

      // Calculate rolling last-10 accuracy
      const recent10 = predictionTracker.getRecentPredictions(10)
        .filter(p => p.actualResult !== undefined);
      if (recent10.length > 0) {
        const correct10 = recent10.filter(p => p.isCorrect).length;
        rollingLast10Accuracy = (correct10 / recent10.length) * 100;
      }
      
      visible = true;
    } catch (err) {
      error = 'Failed to load matches. Please try again.';
      // Error loading predictions
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
        
        // Use optimized predictor for better accuracy
        const optimizedPrediction = await OptimizedPredictor.predictMatch(
          match.home_team,
          match.away_team,
          undefined,
          match.referee
        );
        
        // Convert to legacy format for compatibility
        const prediction = {
          predictedResult: optimizedPrediction.predictedResult,
          confidence: optimizedPrediction.confidence,
          predictedHomeGoals: optimizedPrediction.predictedHomeGoals,
          predictedAwayGoals: optimizedPrediction.predictedAwayGoals,
          insights: optimizedPrediction.insights,
          eloRating: optimizedPrediction.modelWeights.elo
        };
        
        // Calculate Poisson probabilities for additional analysis
        const scoreProbabilities = PoissonPredictor.predictScoreProbabilities(
          prediction.predictedHomeGoals,
          prediction.predictedAwayGoals,
          6
        );
        const outcomeProbabilities = PoissonPredictor.getOutcomeProbabilities(scoreProbabilities);

        // Calculate recommended stake using Kelly Criterion
        // Uses the top outcome probability as our edge estimate against typical bookmaker odds
        const topProb = Math.max(outcomeProbabilities.homeWin, outcomeProbabilities.draw, outcomeProbabilities.awayWin);
        const estimatedBookmakerOdds = (1 / topProb) * 1.05; // Assume 5% edge over fair value
        const kellyResult = calculateKelly(topProb, estimatedBookmakerOdds, 100, prediction.confidence);

        // Generate bet builder predictions
        const betBuilder = await BetBuilderPredictor.generateBetBuilder(
          match.home_team,
          match.away_team,
          match.id
        );

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
            homeForm: optimizedPrediction.homeForm,
            awayForm: optimizedPrediction.awayForm,
            h2hRecord: prediction.insights.find(i => i.includes('H2H')) || 'No H2H data',
            poissonProbs: outcomeProbabilities,
            recommendedStake: kellyResult.recommendedStake
          },
          betBuilder: betBuilder,
          predictionStatus: 'complete'
        };
        
        // Store in tracker (local storage) with gameweek for per-matchday accuracy
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
          match.date,
          selectedGameweek
        );
        
      } catch (error) {
        // Error predicting match
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
    <h2 class="text-2xl font-bold font-display text-foreground">Match Predictions</h2>
    
    <div class="flex items-center gap-4">
      <!-- Gameweek Selector -->
      <div class="flex items-center gap-2">
        <label for="gameweek" class="text-sm font-medium">Gameweek:</label>
        <select
          id="gameweek"
          bind:value={selectedGameweek}
          on:change={handleGameweekChange}
          class="px-3 py-1.5 bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
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
  
  <!-- Accuracy Breakdown Panel -->
  {#if accuracyStats && accuracyStats.totalPredictions > 0}
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5" in:fade={{ duration: 300 }}>
      <button
        on:click={() => showAccuracyPanel = !showAccuracyPanel}
        class="w-full flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <BarChart3 class="w-5 h-5 text-primary" />
          <span class="font-semibold text-foreground">Prediction Accuracy</span>
          <span class="badge badge-neutral text-xs">{accuracyStats.totalPredictions} predictions</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-lg font-bold text-primary">{accuracyStats.accuracy.toFixed(1)}%</span>
          {#if showAccuracyPanel}
            <ChevronUp class="w-4 h-4 text-muted-foreground" />
          {:else}
            <ChevronDown class="w-4 h-4 text-muted-foreground" />
          {/if}
        </div>
      </button>

      {#if showAccuracyPanel}
        <div class="px-4 pb-4 space-y-4" in:fade={{ duration: 200 }}>
          <!-- Per-Outcome Accuracy -->
          <div>
            <h4 class="text-sm font-semibold font-display text-foreground mb-2">By Outcome</h4>
            <div class="grid grid-cols-3 gap-3">
              {#each [
                { label: 'Home Win', value: accuracyStats.homeWinAccuracy, colour: 'bg-blue-500' },
                { label: 'Draw', value: accuracyStats.drawAccuracy, colour: 'bg-amber-500' },
                { label: 'Away Win', value: accuracyStats.awayWinAccuracy, colour: 'bg-emerald-500' }
              ] as outcome}
                <div class="text-center p-3 bg-muted rounded-lg">
                  <div class="text-xs text-muted-foreground mb-1">{outcome.label}</div>
                  <div class="text-lg font-bold text-foreground">{outcome.value.toFixed(0)}%</div>
                  <div class="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div class="{outcome.colour} h-1.5 rounded-full transition-all" style="width: {Math.min(outcome.value, 100)}%"></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Per-Confidence Band -->
          <div>
            <h4 class="text-sm font-semibold font-display text-foreground mb-2">By Confidence Band</h4>
            <div class="grid grid-cols-3 gap-3">
              {#each [
                { label: 'High (>70%)', value: accuracyStats.highConfidenceAccuracy, colour: 'bg-green-500' },
                { label: 'Medium (50-70%)', value: accuracyStats.mediumConfidenceAccuracy, colour: 'bg-yellow-500' },
                { label: 'Low (<50%)', value: accuracyStats.lowConfidenceAccuracy, colour: 'bg-red-500' }
              ] as band}
                <div class="text-center p-3 bg-muted rounded-lg">
                  <div class="text-xs text-muted-foreground mb-1">{band.label}</div>
                  <div class="text-lg font-bold text-foreground">{band.value.toFixed(0)}%</div>
                  <div class="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div class="{band.colour} h-1.5 rounded-full transition-all" style="width: {Math.min(band.value, 100)}%"></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Rolling & Streaks -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="text-center p-3 bg-muted rounded-lg">
              <div class="text-xs text-muted-foreground mb-1">Last 10</div>
              <div class="text-lg font-bold text-foreground">{rollingLast10Accuracy.toFixed(0)}%</div>
            </div>
            <div class="text-center p-3 bg-muted rounded-lg">
              <div class="text-xs text-muted-foreground mb-1">Exact Score</div>
              <div class="text-lg font-bold text-foreground">{accuracyStats.scoreAccuracy.toFixed(0)}%</div>
            </div>
            <div class="text-center p-3 bg-muted rounded-lg">
              <div class="text-xs text-muted-foreground mb-1">Best Streak</div>
              <div class="text-lg font-bold text-green-600 dark:text-green-400">{accuracyStats.streak.best}</div>
            </div>
            <div class="text-center p-3 bg-muted rounded-lg">
              <div class="text-xs text-muted-foreground mb-1">Current Streak</div>
              <div class="text-lg font-bold {accuracyStats.streak.current >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                {accuracyStats.streak.current >= 0 ? '+' : ''}{accuracyStats.streak.current}
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Batch Prediction Progress -->
  {#if isBatchPredicting}
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5" in:fade={{ duration: 300 }}>
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-sm font-medium">{batchPredictionMessage}</span>
          <span class="text-sm text-muted-foreground">
            {batchPredictionProgress} / {batchPredictionTotal}
          </span>
        </div>
        
        <!-- Progress Bar -->
        <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div 
            class="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
            style="width: {(batchPredictionProgress / batchPredictionTotal) * 100}%"
          >
            <div class="h-full bg-white/30 animate-pulse"></div>
          </div>
        </div>
        
        <!-- Current Team Processing -->
        {#if currentProcessingTeam}
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
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
    <div class="rounded-xl border border-destructive/50 bg-destructive/10 text-destructive shadow-sm p-6 text-center">
      <p class="font-medium">{error}</p>
      <button class="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors" on:click={() => loadGameweekMatches(selectedGameweek)}>Retry</button>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each predictions as prediction, i (prediction.id)}
        <div class="flip-card relative" style="animation-delay: {i * 50}ms">
          <!-- Status Indicator Overlay -->
          {#if prediction.predictionStatus === 'processing'}
            <div class="absolute inset-0 bg-blue-500/10 rounded-lg z-10 flex items-center justify-center pointer-events-none">
              <div class="bg-card rounded-lg p-3 shadow-lg flex items-center gap-2">
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
            <div class="flip-card-front rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5">
              <div class="flex justify-between items-start mb-3">
                <span class="text-sm text-muted-foreground">{format(new Date(prediction.date), 'MMM d, HH:mm')}</span>
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
                    <span class="text-sm font-medium text-foreground text-center">{prediction.home_team}</span>
                  </div>
                  <div class="text-center">
                    <span class="text-xl font-bold text-muted-foreground">vs</span>
                    {#if prediction.detailedAnalysis}
                      <div class="text-2xl font-bold text-primary mt-1">
                        {prediction.detailedAnalysis.predictedScore}
                      </div>
                    {/if}
                  </div>
                  <div class="flex flex-col items-center w-1/3">
                    <img src={getTeamLogo(prediction.away_team, 40)} alt="{prediction.away_team} logo" class="w-10 h-10 mb-2 object-contain rounded-full">
                    <span class="text-sm font-medium text-foreground text-center">{prediction.away_team}</span>
                  </div>
                </div>
              </div>

              {#if prediction.prediction}
                <div class="mb-4">
                  <div class="flex justify-around items-center bg-muted rounded-lg p-3">
                    {#each [
                      { label: 'Home', value: 'H', prob: prediction.detailedAnalysis?.poissonProbs.homeWin },
                      { label: 'Draw', value: 'D', prob: prediction.detailedAnalysis?.poissonProbs.draw },
                      { label: 'Away', value: 'A', prob: prediction.detailedAnalysis?.poissonProbs.awayWin }
                    ] as outcome}
                      <div class="text-center px-2">
                        <span class="block text-xs font-medium text-muted-foreground">{outcome.label}</span>
                        <span class="block text-lg font-bold {prediction.prediction.predicted_result === outcome.value ? 'text-primary' : 'text-muted-foreground'}">
                          {outcome.prob ? (outcome.prob * 100).toFixed(0) + '%' : '-'}
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if prediction.prediction && prediction.detailedAnalysis}
                <button 
                  on:click={() => toggleCard(prediction.id)}
                  class="w-full btn btn-outline btn-sm mt-2 flex items-center justify-center gap-2"
                >
                  <Calculator class="w-4 h-4" />
                  Tap for Analysis
                </button>
              {:else}
                <div class="w-full text-center text-sm text-muted-foreground mt-3 py-2">
                  Click "Predict Gameweek" to generate analysis
                </div>
              {/if}
            </div>

            <!-- Back of Card -->
            <div class="flip-card-back rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
              {#if prediction.detailedAnalysis}
                <div class="h-full overflow-y-auto">
                  <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-foreground">Analysis</h3>
                    <button 
                      on:click={() => toggleCard(prediction.id)}
                      class="btn btn-ghost btn-sm">
                      ×
                    </button>
                  </div>

                  <!-- Predicted Score Section -->
                  <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div class="flex items-center gap-2 mb-2">
                      <Target class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span class="font-semibold text-blue-800 dark:text-blue-200">Predicted Score</span>
                    </div>
                    <div class="text-2xl font-bold text-blue-700 dark:text-blue-300 text-center">
                      {prediction.detailedAnalysis.predictedScore}
                    </div>
                    <div class="text-sm text-center text-foreground mt-1">
                      Confidence: {prediction.detailedAnalysis.confidence.toFixed(1)}%
                    </div>
                  </div>

                  <!-- Form Section -->
                  <div class="mb-4">
                    <div class="flex items-center gap-2 mb-2">
                      <TrendingUp class="w-4 h-4 text-emerald-600" />
                      <span class="font-semibold text-foreground">Recent Form</span>
                    </div>
                    <div class="space-y-2 text-sm">
                      <div class="flex justify-between">
                        <span class="text-muted-foreground">{prediction.home_team}:</span>
                        <span class="font-mono">{prediction.detailedAnalysis.homeForm}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-muted-foreground">{prediction.away_team}:</span>
                        <span class="font-mono">{prediction.detailedAnalysis.awayForm}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Key Factors -->
                  <div class="mb-4">
                    <div class="flex items-center gap-2 mb-2">
                      <BarChart3 class="w-4 h-4 text-blue-600" />
                      <span class="font-semibold text-foreground">Key Factors</span>
                    </div>
                    <ul class="text-sm space-y-1">
                      {#each prediction.detailedAnalysis.keyFactors as factor}
                        <li class="flex items-start gap-2">
                          <span class="text-primary mt-1">•</span>
                          <span class="text-muted-foreground">{factor}</span>
                        </li>
                      {/each}
                    </ul>
                  </div>

                  <!-- Betting Recommendation -->
                  {#if prediction.detailedAnalysis.recommendedStake > 0}
                    <div class="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg border border-amber-200 dark:border-amber-700">
                      <div class="flex items-center gap-2 mb-1">
                        <Users class="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span class="font-semibold text-amber-800 dark:text-amber-200">Betting Tip</span>
                      </div>
                      <div class="text-sm text-amber-700 dark:text-amber-300">
                        Recommended stake: {prediction.detailedAnalysis.recommendedStake.toFixed(1)}% of bankroll
                      </div>
                    </div>
                  {/if}
                  
                  <!-- Bet Builder Section -->
                  {#if prediction.betBuilder}
                    <div class="mt-4 p-3 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-lg border border-purple-200 dark:border-purple-700">
                      <div class="flex items-center gap-2 mb-3">
                        <Package class="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span class="font-semibold text-purple-800 dark:text-purple-200">Bet Builder Markets</span>
                      </div>
                      
                      <!-- Quick Markets Grid -->
                      <div class="grid grid-cols-2 gap-2 mb-3 text-xs">
                        <div class="bg-muted p-2 rounded">
                          <span class="text-muted-foreground">BTTS:</span>
                          <span class="font-bold ml-1 {prediction.betBuilder.bothTeamsToScore.prediction ? 'text-green-600' : 'text-red-600'}">
                            {prediction.betBuilder.bothTeamsToScore.prediction ? 'Yes' : 'No'}
                            ({((prediction.betBuilder.bothTeamsToScore.prediction ?
                              prediction.betBuilder.bothTeamsToScore.yesProb :
                              prediction.betBuilder.bothTeamsToScore.noProb) * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div class="bg-muted p-2 rounded">
                          <span class="text-muted-foreground">O/U 2.5:</span>
                          <span class="font-bold ml-1 {prediction.betBuilder.totalGoals.over25.prediction ? 'text-green-600' : 'text-red-600'}">
                            {prediction.betBuilder.totalGoals.over25.prediction ? 'Over' : 'Under'}
                            ({(prediction.betBuilder.totalGoals.over25.probability * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div class="bg-muted p-2 rounded">
                          <span class="text-muted-foreground">Corners:</span>
                          <span class="font-bold ml-1">
                            O{prediction.betBuilder.corners.totalOver95.prediction ? '9.5' : '8.5'}
                          </span>
                        </div>
                        <div class="bg-muted p-2 rounded">
                          <span class="text-muted-foreground">Cards:</span>
                          <span class="font-bold ml-1">
                            O{prediction.betBuilder.cards.totalOver35.prediction ? '3.5' : '2.5'}
                          </span>
                        </div>
                      </div>
                      
                      <!-- Suggested Combos -->
                      {#if prediction.betBuilder.suggestedCombos.length > 0}
                        <div class="mt-2">
                          <div class="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
                            Suggested Builders:
                          </div>
                          {#each prediction.betBuilder.suggestedCombos.slice(0, 2) as combo}
                            <div class="bg-muted rounded p-2 mb-1">
                              <div class="flex justify-between items-start mb-1">
                                <span class="text-xs font-bold text-purple-700 dark:text-purple-300">
                                  {combo.name}
                                </span>
                                <span class="text-xs font-mono bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-1 rounded">
                                  @{combo.combinedOdds.toFixed(2)}
                                </span>
                              </div>
                              <div class="text-xs text-muted-foreground">
                                {combo.selections.join(' + ')}
                              </div>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {:else}
                <div class="h-full flex flex-col items-center justify-center text-center p-6">
                  <div class="mb-4">
                    <Calculator class="w-16 h-16 text-muted-foreground" />
                  </div>
                  <h3 class="text-lg font-semibold text-foreground mb-2">
                    No Prediction Available
                  </h3>
                  <p class="text-sm text-muted-foreground mb-4">
                    Click the "Predict Gameweek" button to generate predictions and analysis for this match.
                  </p>
                  <button 
                    on:click={() => toggleCard(prediction.id)}
                    class="btn btn-outline btn-sm">
                    Go Back
                  </button>
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

  .flip-card-back {
    transform: rotateY(180deg);
    overflow-y: auto;
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
