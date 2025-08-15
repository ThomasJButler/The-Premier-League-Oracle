<script lang="ts">
  import { onMount } from 'svelte';
  import { dataService } from '../services/dataService';
  import type { Match, Prediction } from '../types';
  import { format } from 'date-fns';

  let predictions: Array<Match & { prediction?: Prediction }> = [];
  let accuracy = { total: 0, correct: 0, accuracy: 0 };
  let loading = true;
  let selectedMatch: Match | null = null;
  let predictionInProgress = false;
  let currentPrediction: any = null;
  let visible = false; // For staggered animation
  let error: string | null = null;

  async function loadData() {
    loading = true;
    error = null;
    try {
      const matches = await dataService.getCurrentSeasonMatches();
      const currentAccuracy = await dataService.getPredictionAccuracy('2024-2025');
      
      if (currentAccuracy) {
        accuracy = currentAccuracy;
      }

      predictions = matches.map(match => {
        const mockConfidence = Math.random() * 0.4 + 0.5; // Between 50% and 90%
        const mockResult = mockConfidence > 0.75 ? (Math.random() > 0.5 ? 'H' : 'A') : 'D';
        const mockHomeGoals = mockResult === 'H' ? Math.ceil(Math.random() * 2) : mockResult === 'D' ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 1);
        const mockAwayGoals = mockResult === 'A' ? Math.ceil(Math.random() * 2) : mockResult === 'D' ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 1);

        return {
          ...match,
          prediction: {
            predicted_result: match.result ?? mockResult,
            confidence_score: mockConfidence,
            predicted_home_goals: match.home_goals ?? mockHomeGoals,
            predicted_away_goals: match.away_goals ?? mockAwayGoals,
            was_correct: match.result ? (match.result === mockResult) : false,
            prediction_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
            id: `pred_${match.id}`,
            match_id: match.id
          }
        };
      });
    } catch (err) {
      error = 'Failed to load predictions. Please try again.';
      console.error(err);
    } finally {
      loading = false;
      visible = false;
      setTimeout(() => { visible = true; }, 100);
    }
  }

  onMount(loadData);
</script>

<div class="space-y-6 animate-fade-in">
  <h2 class="text-2xl font-bold gradient-text">Match Predictions</h2>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
    </div>
  {:else if error}
    <div class="card p-6 text-center bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700/50">
      <p class="text-rose-700 dark:text-rose-300 font-medium">{error}</p>
      <button class="btn btn-primary mt-4" on:click={loadData}>Retry</button>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each predictions as prediction, i (prediction.id)}
        <div class="card card-glass animate-slide-in-up" style="animation-delay: {i * 50}ms">
          <div class="flex justify-between items-start mb-3">
            <span class="text-sm text-slate-500 dark:text-slate-400">{format(new Date(prediction.date), 'MMM d, HH:mm')}</span>
            {#if prediction.prediction}
              <span class="badge {prediction.prediction.confidence_score > 0.75 ? 'badge-success' : prediction.prediction.confidence_score > 0.6 ? 'badge-warning' : 'badge-neutral'}">
                {(prediction.prediction.confidence_score * 100).toFixed(0)}% Conf.
              </span>
            {/if}
          </div>
          <div class="text-center mb-4">
            <div class="flex justify-center items-center space-x-4 mb-2">
              <div class="flex flex-col items-center w-1/3">
                <img src={'https://via.placeholder.com/40/0000FF/FFFFFF?text=' + prediction.home_team.substring(0,3).toUpperCase()} alt="{prediction.home_team} logo" class="w-8 h-8 mb-1 object-contain rounded-full bg-gray-200">
                <span class="text-sm font-medium text-slate-800 dark:text-slate-200 text-center">{prediction.home_team}</span>
              </div>
              <span class="text-xl font-bold text-slate-500 dark:text-slate-400">vs</span>
              <div class="flex flex-col items-center w-1/3">
                <img src={'https://via.placeholder.com/40/FF0000/FFFFFF?text=' + prediction.away_team.substring(0,3).toUpperCase()} alt="{prediction.away_team} logo" class="w-8 h-8 mb-1 object-contain rounded-full bg-gray-200">
                <span class="text-sm font-medium text-slate-800 dark:text-slate-200 text-center">{prediction.away_team}</span>
              </div>
            </div>
          </div>

          {#if prediction.prediction}
            <div class="mb-4">
              <h4 class="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 text-center">Prediction</h4>
              <div class="flex justify-around items-center bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3">
                {#each [
                  { label: 'Home Win', value: 'H', goals: prediction.prediction.predicted_home_goals },
                  { label: 'Draw', value: 'D', goals: prediction.prediction.predicted_result === 'D' ? (prediction.prediction.predicted_home_goals + prediction.prediction.predicted_away_goals) / 2 : 0 },
                  { label: 'Away Win', value: 'A', goals: prediction.prediction.predicted_away_goals }
                ] as outcome}
                  <div class="text-center px-2">
                    <span class="block text-xs font-medium text-slate-500 dark:text-slate-400">{outcome.label}</span>
                    <span class="block text-lg font-bold {prediction.prediction.predicted_result === outcome.value ? 'text-primary dark:text-primary-light' : 'text-slate-800 dark:text-slate-200'}">
                      {prediction.prediction.predicted_result === outcome.value ? outcome.value : '-'}
                    </span>
                    <span class="block text-xs text-slate-500 dark:text-slate-400">{prediction.prediction.predicted_result === outcome.value ? `(${outcome.goals})` : ''}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <div class="flex justify-end space-x-2">
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
    border-radius: 0.75rem; /* Corresponds to rounded-xl */
  }

  .gradient-text {
    @apply bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent;
  }

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
</style>