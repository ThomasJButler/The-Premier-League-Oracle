<script lang="ts">
  import { onMount } from 'svelte';
  import { getAllSeasons, getMatchesBySeason, type Match, type Season } from '../lib/supabase';
  import { format } from 'date-fns';

  let matches: Match[] = [];
  let seasons: Season[] = [];
  let selectedSeason = '2024-2025';
  let loading = true;

  async function loadSeasons() {
    seasons = await getAllSeasons();
    if (seasons.length > 0) {
      const currentSeason = seasons.find(s => s.is_current) || seasons[0];
      selectedSeason = currentSeason.name;
    }
  }

  async function loadMatches(season: string) {
    loading = true;
    matches = await getMatchesBySeason(season);
    loading = false;
  }

  onMount(async () => {
    await loadSeasons();
    await loadMatches(selectedSeason);
  });
</script>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <div>
      <h2 class="text-2xl font-bold gradient-text">Matches</h2>
      <p class="text-gray-600 dark:text-gray-400 mt-1">View and analyze match data</p>
    </div>
    <div class="flex items-center space-x-4">
      <select
        bind:value={selectedSeason}
        on:change={() => loadMatches(selectedSeason)}
        class="form-input"
      >
        {#each seasons as season}
          <option value={season.name}>
            {season.name} {season.is_current ? '(Current)' : ''}
          </option>
        {/each}
      </select>
      <button 
        class="btn btn-primary"
        on:click={() => loadMatches(selectedSeason)}
      >
        Refresh
      </button>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
    </div>
  {:else}
    <div class="grid gap-4">
      {#each matches as match}
        <div class="card hover:scale-[1.01] transition-transform duration-200">
          <div class="flex justify-between items-center mb-4">
            <div class="flex items-center space-x-2">
              {#if new Date(match.date).toDateString() === new Date().toDateString()}
                <span class="text-sm text-red-600 dark:text-red-400 animate-pulse">● LIVE</span>
              {/if}
              <span class="text-sm text-gray-500 dark:text-gray-400">{format(new Date(match.date), 'HH:mm')}</span>
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">{format(new Date(match.date), 'MMM d, yyyy')}</div>
          </div>

          <div class="flex justify-between items-center mb-6">
            <div class="text-lg font-semibold dark:text-dark-text">{match.home_team}</div>
            <div class="text-lg text-gray-500 dark:text-gray-400">vs</div>
            <div class="text-lg font-semibold dark:text-dark-text">{match.away_team}</div>
          </div>

          <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="text-center p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
              <div class="text-sm text-gray-500 dark:text-gray-400">Home</div>
              <div class="font-semibold dark:text-dark-text">{match.home_odds?.toFixed(2) || '-'}</div>
            </div>
            <div class="text-center p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
              <div class="text-sm text-gray-500 dark:text-gray-400">Draw</div>
              <div class="font-semibold dark:text-dark-text">{match.draw_odds?.toFixed(2) || '-'}</div>
            </div>
            <div class="text-center p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
              <div class="text-sm text-gray-500 dark:text-gray-400">Away</div>
              <div class="font-semibold dark:text-dark-text">{match.away_odds?.toFixed(2) || '-'}</div>
            </div>
          </div>

          {#if match.home_goals !== null && match.away_goals !== null}
            <div class="flex justify-center items-center space-x-4 mb-6">
              <span class="text-2xl font-bold dark:text-dark-text">{match.home_goals}</span>
              <span class="text-gray-500 dark:text-gray-400">-</span>
              <span class="text-2xl font-bold dark:text-dark-text">{match.away_goals}</span>
            </div>
          {/if}

          <div class="flex justify-between items-center">
            <div class="flex items-center space-x-2">
              <span class="text-sm font-medium dark:text-gray-400">Result:</span>
              {#if match.result}
                <span class="badge {
                  match.result === 'H' ? 'badge-success' :
                  match.result === 'A' ? 'badge-error' :
                  'badge-warning'
                }">
                  {match.result === 'H' ? 'Home Win' : match.result === 'A' ? 'Away Win' : 'Draw'}
                </span>
              {:else}
                <span class="badge badge-warning">Upcoming</span>
              {/if}
            </div>
            <button class="btn btn-secondary">View Stats</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>