<script lang="ts">
  import { onMount } from 'svelte';
  import { Trophy, TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown } from 'lucide-svelte';
  import { dataService } from '../services/dataService';
  import type { Standing } from '../types';
  import { fade, fly } from 'svelte/transition';
  import { getTeamLogo } from '../utils/teamLogos';
  
  let standings: Standing[] = [];
  let loading = true;
  let error = '';
  let showFullTable = false;

  // Derive current season label from date (July onwards = new season)
  function getSeasonLabel(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month >= 6) return `${year}/${(year + 1).toString().slice(-2)}`;
    return `${year - 1}/${year.toString().slice(-2)}`;
  }
  
  onMount(async () => {
    await loadStandings();
  });
  
  async function loadStandings() {
    try {
      loading = true;
      error = '';
      
      // Check if API key is configured
      const apiKey = localStorage.getItem('football_data_api_key');
      if (!apiKey) {
        error = 'Please configure your Football-Data.org API key in Settings to view standings.';
        return;
      }
      
      standings = await dataService.getStandings();
      
      if (!standings || standings.length === 0) {
        error = 'No standings data available. The season may not have started yet.';
      }
    } catch (err: any) {
      if (err.message?.includes('API key')) {
        error = 'Please configure your Football-Data.org API key in Settings to view standings.';
      } else if (err.message?.includes('403') || err.message?.includes('401')) {
        error = 'Invalid API key. Please check your Football-Data.org API key in Settings.';
      } else {
        error = 'Failed to load standings. Please check your internet connection and try again.';
      }
      // Error loading standings
    } finally {
      loading = false;
    }
  }
  
  function getPositionClass(position: number): string {
    if (position <= 4) return 'border-l-4 border-l-blue-500'; // Champions League
    if (position === 5) return 'border-l-4 border-l-orange-500'; // Europa League
    if (position >= 18) return 'border-l-4 border-l-red-500'; // Relegation
    return '';
  }
  
  function getPositionBadge(position: number): string {
    if (position <= 4) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
    if (position === 5) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
    if (position >= 18) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
  }
  
  function getFormClass(result: string): string {
    switch (result) {
      case 'W': return 'bg-green-500 text-white';
      case 'D': return 'bg-slate-400 text-white';
      case 'L': return 'bg-red-500 text-white';
      default: return 'bg-slate-200 dark:bg-slate-700';
    }
  }
  
  function formatForm(form: string | null): string[] {
    if (!form) return [];
    // Form string comes as comma-separated values (e.g., "W,W,D,L,W")
    return form.split(',').slice(-5);
  }
  
  function getMovementIcon(team: Standing) {
    // This would need actual movement data from the API
    // For now, return a placeholder based on recent form
    const form = formatForm(team.form);
    const recentWins = form.filter(r => r === 'W').length;
    if (recentWins >= 3) return { icon: ChevronUp, color: 'text-green-500' };
    if (recentWins <= 1) return { icon: ChevronDown, color: 'text-red-500' };
    return { icon: Minus, color: 'text-slate-400' };
  }
  
  $: displayedStandings = showFullTable ? standings : standings.slice(0, 10);
</script>

<div class="standings-table">
  <!-- Header -->
  <div class="bg-gradient-to-r from-indigo-500/10 to-purple-600/10 dark:from-indigo-500/20 dark:to-purple-600/20 rounded-xl p-6 mb-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
          <Trophy class="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Premier League Table</h2>
          <p class="text-sm text-slate-600 dark:text-slate-400">{getSeasonLabel()} Season Standings</p>
        </div>
      </div>
      
      <button
        on:click={loadStandings}
        disabled={loading}
        class="px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  </div>
  
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  {:else if error}
    <div class="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-6 rounded-xl text-center">
      <p>{error}</p>
      <button 
        on:click={loadStandings}
        class="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  {:else if standings.length > 0}
    <div class="bg-white dark:bg-slate-900 rounded-xl shadow-lg overflow-hidden">
      <!-- Legend -->
      <div class="px-6 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div class="flex flex-wrap gap-4 text-xs">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span class="text-slate-600 dark:text-slate-400">Champions League</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span class="text-slate-600 dark:text-slate-400">Europa League</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-red-500 rounded-full"></div>
            <span class="text-slate-600 dark:text-slate-400">Relegation</span>
          </div>
        </div>
      </div>
      
      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">Pos</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">Team</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">P</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">W</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">D</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">L</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider hidden sm:table-cell">GF</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider hidden sm:table-cell">GA</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">GD</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">Pts</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider hidden md:table-cell">Form</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
            {#each displayedStandings as team, i (team.team.id)}
              <tr 
                class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors {getPositionClass(team.position)}"
                in:fly={{ y: 20, delay: i * 30 }}
              >
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-bold {getPositionBadge(team.position)} px-2 py-1 rounded">
                      {team.position}
                    </span>
                    {#if i < 5}
                      {@const movement = getMovementIcon(team)}
                      <svelte:component this={movement.icon} class="w-3 h-3 {movement.color}" />
                    {/if}
                  </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="flex items-center gap-3">
                    <img 
                      src={getTeamLogo(team.team.name)} 
                      alt="{team.team.name} logo" 
                      class="w-6 h-6 object-contain"
                    />
                    <div>
                      <div class="text-sm font-medium text-slate-900 dark:text-white">
                        {team.team.shortName || team.team.name}
                      </div>
                      <div class="text-xs text-slate-500 dark:text-slate-400 sm:hidden">
                        {team.team.tla}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-slate-700 dark:text-slate-300">
                  {team.playedGames}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-green-600 dark:text-green-400 font-medium">
                  {team.won}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-slate-600 dark:text-slate-400">
                  {team.draw}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-red-600 dark:text-red-400">
                  {team.lost}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">
                  {team.goalsFor}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">
                  {team.goalsAgainst}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                  <span class="{team.goalDifference > 0 ? 'text-green-600' : team.goalDifference < 0 ? 'text-red-600' : 'text-slate-600'}">
                    {team.goalDifference > 0 ? '+' : ''}{team.goalDifference}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-bold text-slate-900 dark:text-white">
                  {team.points}
                </td>
                <td class="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                  <div class="flex gap-1">
                    {#each formatForm(team.form) as result}
                      <span class="w-6 h-6 rounded text-xs font-bold flex items-center justify-center {getFormClass(result)}">
                        {result}
                      </span>
                    {/each}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      
      <!-- Toggle Full Table -->
      {#if standings.length > 10}
        <div class="px-6 py-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <button
            on:click={() => showFullTable = !showFullTable}
            class="w-full text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {showFullTable ? 'Show Less' : `Show All ${standings.length} Teams`}
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-12 text-center">
      <Trophy class="w-12 h-12 mx-auto mb-4 text-slate-400" />
      <p class="text-slate-600 dark:text-slate-400">No standings data available</p>
    </div>
  {/if}
</div>

<style lang="postcss">
  .standings-table {
    @apply w-full;
  }
</style>