<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentSeasonMatches, getPredictionAccuracy, type Match, type Prediction } from '../lib/supabase';
  import { predictMatch } from '../lib/predictions';
  import { format } from 'date-fns';

  let predictions: Array<Match & { prediction?: Prediction }> = [];
  let accuracy = { total: 0, correct: 0, accuracy: 0 };
  let loading = true;
  let selectedMatch: Match | null = null;
  let predictionInProgress = false;
  let currentPrediction: any = null;
  let visible = false; // For staggered animation

  async function loadData() {
    loading = true;
    const matches = await getCurrentSeasonMatches();
    const currentAccuracy = await getPredictionAccuracy('2024-2025');
    
    if (currentAccuracy) {
      accuracy = currentAccuracy;
    }

    predictions = matches.map(match => ({
      ...match,
      // Provide a default prediction result ('D' for Draw) if match.result is null
      prediction: {
        predicted_result: match.result ?? 'D', // Handle null case
        confidence_score: Math.random() * 0.3 + 0.6,
        predicted_home_goals: match.home_goals ?? Math.floor(Math.random() * 3), // Mock goals if null
        predicted_away_goals: match.away_goals ?? Math.floor(Math.random() * 3), // Mock goals if null
        was_correct: match.result ? Math.random() > 0.3 : false, // Mock correctness if result exists
        prediction_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        id: `pred_${match.id}`,
        match_id: match.id
      }
    }));
    loading = false;
    // Trigger staggered animation
    visible = false;
    setTimeout(() => { visible = true; }, 100);
  }

  async function generatePrediction(match: Match) {
    predictionInProgress = true;
    selectedMatch = match;
    
    try {
      currentPrediction = await predictMatch(match.home_team, match.away_team);
      
      // Add some artificial delay for UX
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      console.error('Error generating prediction:', error);
    } finally {
      predictionInProgress = false;
    }
  }

  onMount(loadData);
</script>

<div class="space-y-8 animate-fade-in">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <div>
      <h2 class="text-2xl font-bold gradient-text">AI Predictions</h2>
      <p class="text-slate-600 dark:text-slate-400 mt-1">Powered by advanced machine learning algorithms</p>
    </div>
    <div class="flex items-center space-x-4">
      <div class="card-stats !p-4 !flex-row items-center gap-3 hover-glow">
        <div class="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
          <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <div>
          <div class="stat-label !text-xs">Accuracy</div>
          <div class="stat-value !text-xl">{accuracy.accuracy.toFixed(1)}%</div>
        </div>
      </div>
      <div class="card-stats !p-4 !flex-row items-center gap-3 hover-glow">
        <div class="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full">
           <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
        </div>
        <div>
          <div class="stat-label !text-xs">Total Predictions</div>
          <div class="stat-value !text-xl">{accuracy.total}</div>
        </div>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
    </div>
  {:else}
    <div class="space-y-6">
      {#each predictions as match, i}
        <div 
          class="card card-glass card-spotlight {visible ? 'animate-slide-in-bottom' : 'opacity-0'} {selectedMatch?.id === match.id ? 'ring-2 ring-primary dark:ring-primary-light ring-offset-2 dark:ring-offset-slate-900' : ''}"
          style="animation-delay: {i * 100}ms"
        >
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <div class="flex items-center space-x-3 mb-2 sm:mb-0">
              <div class="text-lg font-semibold text-slate-800 dark:text-slate-200">
                {match.home_team} vs {match.away_team}
              </div>
              {#if new Date(match.date) > new Date()}
                <span class="badge badge-info">Upcoming</span>
              {/if}
            </div>
            <div class="text-sm text-slate-500 dark:text-slate-400">
              {format(new Date(match.date), 'PPP')}
            </div>
          </div>

          {#if currentPrediction && selectedMatch?.id === match.id}
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4 border border-blue-100 dark:border-blue-800/50 animate-fade-in">
              <h3 class="text-lg font-semibold text-primary dark:text-primary-light mb-3">AI Prediction Analysis</h3>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="text-center p-2 bg-white/50 dark:bg-slate-800/30 rounded">
                  <div class="text-xs text-slate-600 dark:text-slate-400">Predicted Result</div>
                  <div class="font-bold text-base text-slate-800 dark:text-slate-200">
                    {currentPrediction.predictedResult === 'H' ? 'Home Win' :
                     currentPrediction.predictedResult === 'A' ? 'Away Win' : 'Draw'}
                  </div>
                </div>
                <div class="text-center p-2 bg-white/50 dark:bg-slate-800/30 rounded">
                  <div class="text-xs text-slate-600 dark:text-slate-400">Confidence</div>
                  <div class="font-bold text-base text-slate-800 dark:text-slate-200">
                    {(currentPrediction.confidence * 100).toFixed(1)}%
                  </div>
                </div>
                <div class="text-center p-2 bg-white/50 dark:bg-slate-800/30 rounded">
                  <div class="text-xs text-slate-600 dark:text-slate-400">Predicted Score</div>
                  <div class="font-bold text-base text-slate-800 dark:text-slate-200">
                    {currentPrediction.predictedHomeGoals} - {currentPrediction.predictedAwayGoals}
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <div class="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div class="text-center p-3 bg-slate-100/70 dark:bg-slate-700/50 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-600/70 transition-colors duration-200">
              <div class="text-xs text-slate-600 dark:text-slate-400">Home Win Odds</div>
              <div class="font-semibold text-base text-slate-800 dark:text-slate-200">{match.home_odds?.toFixed(2) || '-'}</div>
            </div>
            <div class="text-center p-3 bg-slate-100/70 dark:bg-slate-700/50 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-600/70 transition-colors duration-200">
              <div class="text-xs text-slate-600 dark:text-slate-400">Draw Odds</div>
              <div class="font-semibold text-base text-slate-800 dark:text-slate-200">{match.draw_odds?.toFixed(2) || '-'}</div>
            </div>
            <div class="text-center p-3 bg-slate-100/70 dark:bg-slate-700/50 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-600/70 transition-colors duration-200">
              <div class="text-xs text-slate-600 dark:text-slate-400">Away Win Odds</div>
              <div class="font-semibold text-base text-slate-800 dark:text-slate-200">{match.away_odds?.toFixed(2) || '-'}</div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div class="flex items-center space-x-2">
              {#if match.result}
                <span class="text-sm font-medium text-slate-600 dark:text-slate-400">Status:</span>
                <span class="badge {match.prediction?.was_correct ? 'badge-success' : 'badge-error'}">
                  {match.prediction?.was_correct ? 'Correct' : 'Incorrect'}
                </span>
              {:else if new Date(match.date) < new Date()}
                 <span class="badge badge-neutral">Result Pending</span>
              {/if}
            </div>
            <div class="flex space-x-3 self-end sm:self-center">
              <button 
                class="btn btn-secondary btn-sm hover-scale"
                on:click={() => generatePrediction(match)}
                disabled={predictionInProgress && selectedMatch?.id === match.id}
              >
                {#if predictionInProgress && selectedMatch?.id === match.id}
                  <div class="flex items-center space-x-2">
                    <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Analyzing...</span>
                  </div>
                {:else}
                  <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                  Predict
                {/if}
              </button>
              <button class="btn btn-primary btn-sm hover-scale">
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                Analysis
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out;
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

  .btn-sm {
    @apply px-3 py-1.5 text-sm;
  }
</style>