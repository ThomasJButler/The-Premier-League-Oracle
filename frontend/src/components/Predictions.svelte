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
  import { TrendingUp, Target, Users, BarChart3, Calculator, Package, ChevronDown, ChevronUp, FlaskConical, Sparkles, Loader2 } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { BacktestRunner, type BacktestResult } from '../lib/backtest';
  import { aiAnalysisService } from '../services/aiAnalysis';
  import type { AnalysisInput } from '../services/aiAnalysis';
  import { renderMarkdown } from '$lib/renderMarkdown';

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
  let accuracyStats: AccuracyStats | null = null;
  let showAccuracyPanel = false;
  let rollingLast10Accuracy = 0;
  let loading = true;
  let error: string | null = null;
  let flippedCards = new Set<string>(); // Track which cards are flipped
  
  // Batch prediction state
  let selectedGameweek = 1;
  let batchPredictionProgress = 0;
  let batchPredictionTotal = 0;
  let batchPredictionMessage = '';
  let isBatchPredicting = false;
  let currentProcessingTeam = '';
  let totalGameweeks = 38; // Premier League: 20 teams × 2 = 38 matchdays (always)

  // Backtest state
  let backtestResult: BacktestResult | null = null;
  let isBacktesting = false;
  let backtestProgress = 0;
  let backtestTotal = 0;
  let backtestError: string | null = null;

  // AI analysis state — keyed by matchId
  let aiAnalyses: Map<string, string> = new Map();
  let aiAnalysisLoading: Set<string> = new Set();
  let aiAnalysisErrors: Map<string, string> = new Map();

  /** Fetch AI analysis for a match when the user flips the card */
  async function fetchAiAnalysis(matchData: typeof predictions[0]) {
    if (!aiAnalysisService.isEnabled()) return;
    if (aiAnalyses.has(matchData.id)) return; // Already loaded
    if (aiAnalysisLoading.has(matchData.id)) return; // Already fetching

    const pred = matchData.prediction;
    const detail = matchData.detailedAnalysis;
    if (!pred || !detail) return;

    aiAnalysisLoading.add(matchData.id);
    aiAnalysisLoading = new Set(aiAnalysisLoading); // trigger reactivity

    const input: AnalysisInput = {
      homeTeam: matchData.home_team,
      awayTeam: matchData.away_team,
      matchId: matchData.id,
      matchDate: format(new Date(matchData.date), 'EEEE d MMMM yyyy, HH:mm'),
      predictedResult: pred.predicted_result,
      confidence: pred.confidence_score,
      predictedHomeGoals: pred.predicted_home_goals,
      predictedAwayGoals: pred.predicted_away_goals,
      homeForm: detail.homeForm,
      awayForm: detail.awayForm,
      insights: detail.keyFactors,
    };

    try {
      const analysis = await aiAnalysisService.getAnalysis(input);
      if (analysis) {
        aiAnalyses.set(matchData.id, analysis);
        aiAnalyses = new Map(aiAnalyses);
      }
    } catch (err) {
      aiAnalysisErrors.set(matchData.id, err instanceof Error ? err.message : 'Analysis failed');
      aiAnalysisErrors = new Map(aiAnalysisErrors);
    } finally {
      aiAnalysisLoading.delete(matchData.id);
      aiAnalysisLoading = new Set(aiAnalysisLoading);
    }
  }

  export async function runBacktest() {
    if (isBacktesting) return;

    isBacktesting = true;
    backtestResult = null;
    backtestError = null;
    backtestProgress = 0;
    backtestTotal = 0;

    try {
      // Fetch completed matches from the current season
      const allMatches = await dataService.getMatches({ recent: true, days: 365 });
      const completedMatches = allMatches.filter(m => m.result);

      if (completedMatches.length < 5) {
        backtestError = 'Need at least 5 completed matches to run a backtest.';
        isBacktesting = false;
        return;
      }

      const runner = new BacktestRunner(completedMatches);
      backtestResult = await runner.run((completed, total) => {
        backtestProgress = completed;
        backtestTotal = total;
      });
    } catch (err) {
      console.error('Backtest failed:', err);
      backtestError = 'Backtest failed. Please try again.';
    } finally {
      isBacktesting = false;
    }
  }

  export async function loadGameweekMatches(gameweek: number) {
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
      
    } catch (err) {
      error = 'Failed to load matches. Please try again.';
      // Error loading predictions
    } finally {
      loading = false;
    }
  }
  
  export async function predictGameweek() {
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
          prediction.predictedAwayGoals
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
        
        // Auto-fetch AI analysis in the background (don't block the loop)
        if (aiAnalysisService.isEnabled()) {
          fetchAiAnalysis(predictions[matchIndex]);
        }

      } catch (err) {
        console.warn(`Prediction failed for match ${matchIndex}:`, err);
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
      // Lazy-load AI analysis when card is flipped to back
      const matchData = predictions.find(p => p.id === matchId);
      if (matchData) {
        fetchAiAnalysis(matchData);
      }
    }
    flippedCards = new Set(flippedCards);
  }

  onMount(async () => {
    try {
      const season = await dataService.getCurrentSeason();
      if (season?.currentMatchday) {
        selectedGameweek = season.currentMatchday;
      }
    } catch {
      // Fall back to week 1 if API unavailable
    }
    loadGameweekMatches(selectedGameweek);
  });
  
  function handleGameweekChange() {
    loadGameweekMatches(selectedGameweek);
  }
</script>

<div class="space-y-6 animate-fade-in">
  <!-- Header with Gameweek Selector -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <h2 class="text-2xl font-bold font-display text-foreground">Match Predictions</h2>
    
    <div class="flex flex-wrap items-center gap-3 sm:gap-4">
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
          {#each Array(totalGameweeks) as _, i}
            <option value={i + 1}>Week {i + 1}</option>
          {/each}
        </select>
      </div>
      
      <!-- Predict Button -->
      <Button
        on:click={predictGameweek}
        disabled={isBatchPredicting || loading}
        data-testid="predict-gameweek"
        class="btn-neon px-5 py-2.5"
      >
        {#if isBatchPredicting}
          <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          Predicting...
        {:else}
          <Calculator class="w-4 h-4" />
          Predict Gameweek
        {/if}
      </Button>
    </div>
  </div>
  
  <!-- Accuracy Breakdown Panel -->
  {#if accuracyStats && accuracyStats.totalPredictions > 0}
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5" data-testid="accuracy-panel" in:fade={{ duration: 300 }}>
      <button
        on:click={() => showAccuracyPanel = !showAccuracyPanel}
        class="w-full flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <BarChart3 class="w-5 h-5 text-primary" />
          <span class="font-semibold text-foreground">Prediction Accuracy</span>
          <Badge variant="neutral" class="text-xs">{accuracyStats.totalPredictions} predictions</Badge>
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
            <div class="grid grid-cols-3 gap-2 sm:gap-3">
              {#each [
                { label: 'Home Win', value: accuracyStats.homeWinAccuracy, colour: 'bg-blue-500' },
                { label: 'Draw', value: accuracyStats.drawAccuracy, colour: 'bg-amber-500' },
                { label: 'Away Win', value: accuracyStats.awayWinAccuracy, colour: 'bg-emerald-500' }
              ] as outcome}
                <div class="text-center p-3 bg-muted rounded-lg">
                  <div class="text-xs text-muted-foreground mb-1">{outcome.label}</div>
                  <div class="text-lg font-bold text-foreground">{outcome.value.toFixed(0)}%</div>
                  <div class="w-full bg-muted rounded-full h-1.5 mt-1" role="meter" aria-valuenow={outcome.value} aria-valuemin={0} aria-valuemax={100} aria-label="{outcome.label} accuracy">
                    <div class="{outcome.colour} h-1.5 rounded-full transition-all" style="width: {Math.min(outcome.value, 100)}%"></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Per-Confidence Band -->
          <div>
            <h4 class="text-sm font-semibold font-display text-foreground mb-2">By Confidence Band</h4>
            <div class="grid grid-cols-3 gap-2 sm:gap-3">
              {#each [
                { label: 'High (>70%)', value: accuracyStats.highConfidenceAccuracy, colour: 'bg-green-500' },
                { label: 'Medium (50-70%)', value: accuracyStats.mediumConfidenceAccuracy, colour: 'bg-yellow-500' },
                { label: 'Low (<50%)', value: accuracyStats.lowConfidenceAccuracy, colour: 'bg-red-500' }
              ] as band}
                <div class="text-center p-3 bg-muted rounded-lg">
                  <div class="text-xs text-muted-foreground mb-1">{band.label}</div>
                  <div class="text-lg font-bold text-foreground">{band.value.toFixed(0)}%</div>
                  <div class="w-full bg-muted rounded-full h-1.5 mt-1" role="meter" aria-valuenow={band.value} aria-valuemin={0} aria-valuemax={100} aria-label="{band.label} accuracy">
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

      <!-- Backtest Runner — always visible when accuracy panel exists -->
      <div class="border-t border-border mt-4 pt-4 px-1">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <FlaskConical class="w-4 h-4 text-teal-500" />
            <span class="text-sm font-semibold font-display text-foreground">Model Backtest</span>
          </div>
          <button
            on:click={runBacktest}
            disabled={isBacktesting}
            data-testid="run-backtest"
            class="text-xs px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {#if isBacktesting}
              <div class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Running...
            {:else}
              Run Backtest
            {/if}
          </button>
        </div>
        <p class="text-xs text-muted-foreground mb-3">
          Runs completed matches through the prediction model retrospectively to measure true accuracy, log loss, and Brier score.
        </p>

        {#if isBacktesting && backtestTotal > 0}
          <div class="space-y-2">
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>Processing matches...</span>
              <span>{backtestProgress} / {backtestTotal}</span>
            </div>
            <div class="w-full bg-muted rounded-full h-1.5" role="progressbar" aria-valuenow={backtestProgress} aria-valuemin={0} aria-valuemax={backtestTotal} aria-label="Backtest progress">
              <div class="bg-teal-500 h-1.5 rounded-full transition-all duration-200" style="width: {(backtestProgress / backtestTotal) * 100}%"></div>
            </div>
          </div>
        {/if}

        {#if backtestError}
          <div class="text-xs text-destructive bg-destructive/10 rounded-lg p-3">
            {backtestError}
          </div>
        {/if}

        {#if backtestResult}
          <div class="space-y-3" in:fade={{ duration: 200 }}>
            <!-- Summary Row -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div class="text-center p-2.5 bg-muted rounded-lg">
                <div class="text-xs text-muted-foreground mb-0.5">Accuracy</div>
                <div class="text-lg font-bold text-foreground">{backtestResult.overallAccuracy.toFixed(1)}%</div>
              </div>
              <div class="text-center p-2.5 bg-muted rounded-lg">
                <div class="text-xs text-muted-foreground mb-0.5">Matches</div>
                <div class="text-lg font-bold text-foreground">{backtestResult.totalMatches}</div>
              </div>
              <div class="text-center p-2.5 bg-muted rounded-lg">
                <div class="text-xs text-muted-foreground mb-0.5"
                  title="Log loss measures calibration — lower is better. Perfect = 0, random = 1.10">Log Loss</div>
                <div class="text-lg font-bold {backtestResult.logLoss < 1.0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}">{backtestResult.logLoss.toFixed(3)}</div>
              </div>
              <div class="text-center p-2.5 bg-muted rounded-lg">
                <div class="text-xs text-muted-foreground mb-0.5"
                  title="Brier score measures probability quality — lower is better. Perfect = 0, worst = 2.0">Brier Score</div>
                <div class="text-lg font-bold {backtestResult.brierScore < 0.5 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}">{backtestResult.brierScore.toFixed(3)}</div>
              </div>
            </div>

            <!-- Per-Outcome Breakdown -->
            <div class="grid grid-cols-3 gap-2">
              {#each [
                { label: 'Home', data: backtestResult.outcomeAccuracy.home, colour: 'bg-blue-500' },
                { label: 'Draw', data: backtestResult.outcomeAccuracy.draw, colour: 'bg-amber-500' },
                { label: 'Away', data: backtestResult.outcomeAccuracy.away, colour: 'bg-emerald-500' }
              ] as outcome}
                <div class="text-center p-2 bg-muted rounded-lg">
                  <div class="text-xs text-muted-foreground mb-0.5">{outcome.label}</div>
                  <div class="text-sm font-bold text-foreground">{outcome.data.accuracy.toFixed(0)}%</div>
                  <div class="text-xs text-muted-foreground">{outcome.data.correct}/{outcome.data.total}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
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
        <div class="w-full bg-muted rounded-full h-2 overflow-hidden" role="progressbar" aria-valuenow={batchPredictionProgress} aria-valuemin={0} aria-valuemax={batchPredictionTotal} aria-label="Prediction progress">
          <div
            class="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-300 ease-out"
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
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
            <div class="flip-card-front rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5" aria-hidden={flippedCards.has(prediction.id)}>
              <div class="flex justify-between items-start mb-3">
                <span class="text-sm text-muted-foreground">{format(new Date(prediction.date), 'MMM d, HH:mm')}</span>
                {#if prediction.prediction}
                  <Badge
                    variant={prediction.prediction.confidence_score > 0.75 ? 'success' : prediction.prediction.confidence_score > 0.6 ? 'warning' : 'neutral'}
                    title="{prediction.prediction.confidence_score > 0.75 ? 'High confidence — all models agree strongly' : prediction.prediction.confidence_score > 0.6 ? 'Moderate confidence — some model disagreement' : 'Low confidence — models disagree significantly'}"
                  >
                    {(prediction.prediction.confidence_score * 100).toFixed(0)}%
                  </Badge>
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
                <Button
                  variant="outline"
                  size="sm"
                  on:click={() => toggleCard(prediction.id)}
                  class="w-full mt-2 flex items-center justify-center gap-2"
                  aria-label="View analysis for {prediction.home_team} vs {prediction.away_team}"
                >
                  <Calculator class="w-4 h-4" />
                  Tap for Analysis
                </Button>
              {:else}
                <div class="w-full text-center text-sm text-muted-foreground mt-3 py-2">
                  Click "Predict Gameweek" to generate analysis
                </div>
              {/if}
            </div>

            <!-- Back of Card -->
            <div class="flip-card-back rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6" aria-hidden={!flippedCards.has(prediction.id)}>
              {#if prediction.detailedAnalysis}
                <div class="h-full overflow-y-auto">
                  <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-foreground">Analysis</h3>
                    <Button
                      on:click={() => toggleCard(prediction.id)}
                      variant="ghost"
                      size="sm"
                      aria-label="Close analysis">
                      ×
                    </Button>
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
                        <span class="font-semibold text-amber-800 dark:text-amber-200">Estimated Stake</span>
                      </div>
                      <div class="text-sm text-amber-700 dark:text-amber-300">
                        Kelly stake: {prediction.detailedAnalysis.recommendedStake.toFixed(1)}% of bankroll
                      </div>
                      <div class="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
                        Based on model-estimated odds — not real bookmaker prices
                      </div>
                    </div>
                  {/if}
                  
                  <!-- Bet Builder Section -->
                  {#if prediction.betBuilder}
                    <div class="mt-4 p-3 bg-gradient-to-br from-slate-50 to-teal-50 dark:from-slate-950/30 dark:to-teal-950/30 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div class="flex items-center gap-2 mb-3">
                        <Package class="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        <span class="font-semibold text-slate-800 dark:text-slate-200">Bet Builder Markets</span>
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
                          <div class="text-xs font-semibold text-teal-700 dark:text-teal-300 mb-1">
                            Suggested Builders:
                          </div>
                          {#each prediction.betBuilder.suggestedCombos.slice(0, 2) as combo}
                            <div class="bg-muted rounded p-2 mb-1">
                              <div class="flex justify-between items-start mb-1">
                                <span class="text-xs font-bold text-teal-700 dark:text-teal-300">
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

                  <!-- AI Analysis Section -->
                  {#if aiAnalysisService.isEnabled()}
                    <div class="mt-4 p-3 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-lg border border-violet-200 dark:border-violet-700">
                      <div class="flex items-center gap-2 mb-2">
                        <Sparkles class="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        <span class="font-semibold text-violet-800 dark:text-violet-200">AI Analysis</span>
                      </div>
                      {#if aiAnalyses.has(prediction.id)}
                        <div class="text-sm text-muted-foreground prose-chat">
                          {@html renderMarkdown(aiAnalyses.get(prediction.id) || '')}
                        </div>
                      {:else if aiAnalysisLoading.has(prediction.id)}
                        <div class="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 class="w-4 h-4 animate-spin" />
                          <span>Generating analysis…</span>
                        </div>
                      {:else if aiAnalysisErrors.has(prediction.id)}
                        <p class="text-xs text-destructive">{aiAnalysisErrors.get(prediction.id)}</p>
                      {:else}
                        <p class="text-xs text-muted-foreground">Flip the card to load AI analysis</p>
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
                  <Button
                    on:click={() => toggleCard(prediction.id)}
                    variant="outline"
                    size="sm">
                    Go Back
                  </Button>
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
    height: 360px;
    perspective: 1000px;
    animation: slideInUp 0.6s ease-out forwards;
    opacity: 0;
  }

  @media (min-width: 640px) {
    .flip-card {
      height: 400px;
    }
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
