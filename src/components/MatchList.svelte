<script lang="ts">
  import { onMount } from 'svelte';
  import { getAllSeasons, getMatchesBySeason, type Match, type Season } from '../lib/supabase';
  import { format } from 'date-fns';

  let matches: Match[] = [];
  let seasons: Season[] = [];
  let selectedSeason = '2024-2025';
  let loading = true;
  let visible = false;

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
    // Trigger staggered animation on load
    visible = false;
    setTimeout(() => { visible = true; }, 100);
  }
  
  // Get team-specific class for styling
  function getTeamClass(teamName: string): string {
    const team = teamName.toLowerCase().replace(/\s+/g, '');
    const teamMap: Record<string, string> = {
      'arsenal': 'arsenal',
      'chelsea': 'chelsea',
      'liverpool': 'liverpool',
      'manchestercity': 'mancity',
      'manchesterunited': 'manutd',
      'tottenhamhotspur': 'tottenham'
      // Add more teams as needed
    };
    return teamMap[team] || '';
  }

  onMount(async () => {
    await loadSeasons();
    await loadMatches(selectedSeason);
  });
</script>

<div class="space-y-8 animate-fade-in">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <div>
      <h2 class="text-2xl font-bold gradient-text">Matches</h2>
      <p class="text-slate-600 dark:text-slate-400 mt-1">View and analyze match data by season</p>
    </div>
    <div class="flex items-center space-x-3">
      <select
        bind:value={selectedSeason}
        on:change={() => loadMatches(selectedSeason)}
        class="form-select hover-scale w-48"
      >
        {#each seasons as season}
          <option value={season.name}>
            {season.name} {season.is_current ? '•' : ''}
          </option>
        {/each}
      </select>
      <button 
        class="btn btn-secondary btn-sm hover-glow {loading ? 'opacity-50 cursor-not-allowed' : ''}"
        on:click={() => loadMatches(selectedSeason)}
        disabled={loading}
      >
        {#if loading}
          <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
          Loading...
        {:else}
          <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357 2m0 0H15"></path></svg>
          Refresh
        {/if}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="space-y-4">
      {#each Array(5) as _, i}
        <div class="match-card shimmer h-24" style="animation-delay: {i * 50}ms"></div>
      {/each}
    </div>
  {:else if matches.length === 0}
    <div class="card card-glass text-center py-12">
      <svg class="w-12 h-12 mx-auto mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <p class="text-slate-500 dark:text-slate-400 font-medium">No matches found for the {selectedSeason} season.</p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each matches as match, i}
        <div 
          class="match-card card-glass {visible ? 'animate-slide-in-bottom' : 'opacity-0'} card-spotlight"
          style="animation-delay: {i * 80}ms"
        >
          <!-- Home Team -->
          <div class="flex-1 match-team justify-end md:justify-start order-1 md:order-1">
            <span class={`font-semibold text-slate-800 dark:text-slate-200 text-right md:text-left ${getTeamClass(match.home_team) ? `team-text-${getTeamClass(match.home_team)}` : ''}`}>
              {match.home_team}
            </span>
            <div class={`avatar w-8 h-8 sm:w-10 sm:h-10 ${getTeamClass(match.home_team) ? `team-bg-${getTeamClass(match.home_team)}` : 'bg-slate-200 dark:bg-slate-700'}`}>
              <span class="text-sm sm:text-base font-bold text-white">{match.home_team.slice(0, 3).toUpperCase()}</span>
            </div>
          </div>
          
          <!-- Score / Time -->
          <div class="flex flex-col items-center mx-2 sm:mx-4 order-2 md:order-2">
            {#if match.home_goals !== null && match.away_goals !== null}
              <div class="match-score animate-pulse-glow">
                {match.home_goals}&nbsp;-&nbsp;{match.away_goals}
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Final
              </div>
            {:else}
              <div class="match-score !bg-transparent dark:!bg-transparent !text-slate-500 dark:!text-slate-400 text-sm sm:text-base font-normal">
                vs
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {format(new Date(match.date), 'MMM d, HH:mm')}
              </div>
            {/if}
          </div>
          
          <!-- Away Team -->
          <div class="flex-1 match-team order-3 md:order-3">
            <div class={`avatar w-8 h-8 sm:w-10 sm:h-10 ${getTeamClass(match.away_team) ? `team-bg-${getTeamClass(match.away_team)}` : 'bg-slate-200 dark:bg-slate-700'}`}>
              <span class="text-sm sm:text-base font-bold text-white">{match.away_team.slice(0, 3).toUpperCase()}</span>
            </div>
            <span class={`font-semibold text-slate-800 dark:text-slate-200 ${getTeamClass(match.away_team) ? `team-text-${getTeamClass(match.away_team)}` : ''}`}>
              {match.away_team}
            </span>
          </div>
          
          <!-- Result Badge (Optional) -->
          {#if match.result}
            <div class="absolute top-2 right-2 md:relative md:top-auto md:right-auto md:ml-4 order-4 md:order-4">
              <span class="badge {
                match.result === 'H' ? 'badge-success' :
                match.result === 'A' ? 'badge-error' :
                'badge-warning'
              } hover-scale">
                {match.result === 'H' ? 'Home' :
                 match.result === 'A' ? 'Away' :
                 'Draw'}
              </span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Ensure match-card layout works well on smaller screens */
  @media (max-width: 767px) {
    .match-card {
      @apply grid grid-cols-3 items-center gap-2 p-3;
    }
    .match-team {
      @apply space-x-2;
    }
    .match-score {
      @apply px-2 py-1 text-lg;
    }
  }
</style>