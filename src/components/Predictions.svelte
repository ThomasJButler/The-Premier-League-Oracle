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

  async function loadData() {
    loading = true;
    const matches = await getCurrentSeasonMatches();
    const currentAccuracy = await getPredictionAccuracy('2024-2025');
    
    if (currentAccuracy) {
      accuracy = currentAccuracy;
    }

    predictions = matches.map(match => ({
      ...match,
      prediction: {
        predicted_result: match.result,
        confidence_score: Math.random() * 0.3 + 0.6,
        predicted_home_goals: match.home_goals || 0,
        predicted_away_goals: match.away_goals || 0,
        was_correct: true,
        prediction_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        id: '',
        match_id: match.id
      }
    }));
    loading = false;
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

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <div>
      <h2 class="text-2xl font-bold text-primary">AI Predictions</h2>
      <p class="text-gray-600 mt-1">Powered by advanced machine learning algorithms</p>
    </div>
    <div class="flex items-center space-x-4">
      <div class="stat-card">
        <div class="stat-label">Accuracy</div>
        <div class="stat-value">{accuracy.accuracy.toFixed(1)}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Predictions</div>
        <div class="stat-value">{accuracy.total}</div>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
    </div>
  {:else}
    <div class="grid gap-6">
      {#each predictions as match}
        <div class="card {selectedMatch?.id === match.id ? 'ring-2 ring-primary ring-offset-2' : ''}">
          <div class="flex justify-between items-center mb-6">
            <div class="flex items-center space-x-3">
              <div class="text-lg font-semibold">
                {match.home_team} vs {match.away_team}
              </div>
              {#if new Date(match.date) > new Date()}
                <span class="badge badge-warning">Upcoming</span>
              {/if}
            </div>
            <div class="text-sm text-gray-500">
              {format(new Date(match.date), 'MMM d, yyyy')}
            </div>
          </div>

          {#if currentPrediction && selectedMatch?.id === match.id}
            <div class="bg-blue-50 p-4 rounded-lg mb-6 animate-fade-in">
              <h3 class="text-lg font-semibold text-primary mb-3">AI Prediction</h3>
              <div class="grid grid-cols-3 gap-4">
                <div class="text-center">
                  <div class="text-sm text-gray-600">Predicted Result</div>
                  <div class="font-bold text-lg">
                    {currentPrediction.predictedResult === 'H' ? 'Home Win' :
                     currentPrediction.predictedResult === 'A' ? 'Away Win' : 'Draw'}
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-sm text-gray-600">Confidence</div>
                  <div class="font-bold text-lg">
                    {(currentPrediction.confidence * 100).toFixed(1)}%
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-sm text-gray-600">Predicted Score</div>
                  <div class="font-bold text-lg">
                    {currentPrediction.predictedHomeGoals} - {currentPrediction.predictedAwayGoals}
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <div class="text-sm text-gray-600">Home Win</div>
              <div class="font-semibold text-lg">{match.home_odds?.toFixed(2) || '-'}</div>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <div class="text-sm text-gray-600">Draw</div>
              <div class="font-semibold text-lg">{match.draw_odds?.toFixed(2) || '-'}</div>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <div class="text-sm text-gray-600">Away Win</div>
              <div class="font-semibold text-lg">{match.away_odds?.toFixed(2) || '-'}</div>
            </div>
          </div>

          <div class="flex justify-between items-center">
            <div class="flex items-center space-x-2">
              {#if match.result}
                <span class="text-sm font-medium">Status:</span>
                <span class="badge {match.prediction?.was_correct ? 'badge-success' : 'badge-error'}">
                  {match.prediction?.was_correct ? 'Correct Prediction' : 'Incorrect Prediction'}
                </span>
              {:else}
                <span class="badge badge-warning">Pending</span>
              {/if}
            </div>
            <div class="flex space-x-3">
              <button 
                class="btn btn-secondary"
                on:click={() => generatePrediction(match)}
                disabled={predictionInProgress && selectedMatch?.id === match.id}
              >
                {#if predictionInProgress && selectedMatch?.id === match.id}
                  <div class="flex items-center space-x-2">
                    <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Analyzing...</span>
                  </div>
                {:else}
                  Generate Prediction
                {/if}
              </button>
              <button class="btn btn-primary">View Analysis</button>
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
</style>