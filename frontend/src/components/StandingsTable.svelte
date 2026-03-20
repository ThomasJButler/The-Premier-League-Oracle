<script lang="ts">
  import { onMount } from 'svelte';
  import { Trophy, Minus, ChevronUp, ChevronDown } from 'lucide-svelte';
  import { dataService } from '../services/dataService';
  import type { Standing } from '../types';
  import { fly } from 'svelte/transition';
  import { getTeamLogo } from '../utils/teamLogos';
  import { getSeasonLabel } from '../lib/utils';
  import { Button } from '$lib/components/ui/button';

  let standings: Standing[] = [];
  let loading = true;
  let error = '';
  let showFullTable = false;
  
  onMount(async () => {
    await loadStandings();
  });
  
  export async function loadStandings() {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('API key')) {
        error = 'Please configure your Football-Data.org API key in Settings to view standings.';
      } else if (message.includes('403') || message.includes('401')) {
        error = 'Invalid API key. Please check your Football-Data.org API key in Settings.';
      } else {
        error = 'Failed to load standings. Please check your internet connection and try again.';
      }
    } finally {
      loading = false;
    }
  }
  
  function getPositionClass(position: number): string {
    if (position <= 4) return 'border-l-4 border-l-blue-500'; // Champions League
    if (position === 5) return 'border-l-4 border-l-orange-500'; // Europa League
    if (position === 6) return 'border-l-4 border-l-emerald-500'; // Conference League
    if (position >= 18) return 'border-l-4 border-l-red-500'; // Relegation
    return '';
  }

  function getPositionBadge(position: number): string {
    if (position <= 4) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
    if (position === 5) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
    if (position === 6) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
    if (position >= 18) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    return 'bg-muted text-foreground';
  }

  function getRowBackground(position: number): string {
    if (position <= 4) return 'bg-blue-50/40 dark:bg-blue-950/15';
    if (position === 5) return 'bg-orange-50/40 dark:bg-orange-950/15';
    if (position === 6) return 'bg-emerald-50/40 dark:bg-emerald-950/15';
    if (position >= 18) return 'bg-red-50/40 dark:bg-red-950/15';
    return '';
  }
  
  function getFormClass(result: string): string {
    switch (result) {
      case 'W': return 'bg-green-500 text-white';
      case 'D': return 'bg-slate-400 text-white';
      case 'L': return 'bg-red-500 text-white';
      default: return 'bg-muted';
    }
  }
  
  function formatForm(form: string | null): string[] {
    if (!form) return [];
    // Form string comes as comma-separated values (e.g., "W,W,D,L,W")
    return form.split(',').slice(-5);
  }
  
  /**
   * Approximate movement indicator based on recent form.
   *
   * The Football-Data.org free tier does not expose per-matchday position
   * history, so we cannot compute real "moved up/down N places" deltas.
   * Instead we infer momentum from the last 5 results — 3+ wins shows
   * an upward arrow, 0-1 wins shows a downward arrow. This is a proxy
   * for likely table movement rather than actual movement.
   */
  function getMovementIcon(team: Standing) {
    const form = formatForm(team.form);
    const recentWins = form.filter(r => r === 'W').length;
    if (recentWins >= 3) return { icon: ChevronUp, color: 'text-green-500' };
    if (recentWins <= 1) return { icon: ChevronDown, color: 'text-red-500' };
    return { icon: Minus, color: 'text-muted-foreground' };
  }
  
  $: displayedStandings = showFullTable ? standings : standings.slice(0, 10);
</script>

<div class="w-full">
  <!-- Header -->
  <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 mb-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="p-3 bg-gradient-to-br from-slate-600 to-teal-600 rounded-lg">
          <Trophy class="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 class="text-2xl font-bold font-display text-foreground">Premier League Table</h2>
          <p class="text-sm text-muted-foreground">{getSeasonLabel()} Season Standings</p>
        </div>
      </div>
      
      <Button variant="ghost" size="sm" on:click={loadStandings} disabled={loading}>
        {loading ? 'Refreshing...' : 'Refresh'}
      </Button>
    </div>
  </div>
  
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  {:else if error}
    <div class="rounded-xl border border-destructive/50 bg-destructive/10 text-destructive p-6 text-center">
      <p>{error}</p>
      <Button variant="destructive" class="mt-4" on:click={loadStandings}>Try Again</Button>
    </div>
  {:else if standings.length > 0}
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
      <!-- Legend -->
      <div class="px-6 py-3 bg-muted border-b border-border">
        <div class="flex flex-wrap gap-4 text-xs">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span class="text-muted-foreground">Champions League</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span class="text-muted-foreground">Europa League</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span class="text-muted-foreground">Conference League</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-red-500 rounded-full"></div>
            <span class="text-muted-foreground">Relegation</span>
          </div>
        </div>
      </div>
      
      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full" aria-label="Premier League standings">
          <thead class="bg-muted border-b border-border">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"><abbr title="Position">Pos</abbr></th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Team</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"><abbr title="Played">P</abbr></th>
              <th class="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"><abbr title="Won">W</abbr></th>
              <th class="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"><abbr title="Drawn">D</abbr></th>
              <th class="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"><abbr title="Lost">L</abbr></th>
              <th class="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell"><abbr title="Goals for">GF</abbr></th>
              <th class="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell"><abbr title="Goals against">GA</abbr></th>
              <th class="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"><abbr title="Goal difference">GD</abbr></th>
              <th class="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"><abbr title="Points">Pts</abbr></th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Form</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each displayedStandings as team, i (team.team.id)}
              <tr
                class="hover:bg-muted/50 transition-colors {getPositionClass(team.position)} {getRowBackground(team.position)}"
                in:fly={{ y: 20, delay: i * 30 }}
              >
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-bold {getPositionBadge(team.position)} px-2 py-1 rounded">
                      {team.position}
                    </span>
                    <span title="Based on recent form, not actual position change">
                      <svelte:component this={getMovementIcon(team).icon} class="w-3 h-3 {getMovementIcon(team).color}" />
                    </span>
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
                      <div class="text-sm font-medium text-foreground">
                        {team.team.shortName || team.team.name}
                      </div>
                      <div class="text-xs text-muted-foreground sm:hidden">
                        {team.team.tla}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-foreground">
                  {team.playedGames}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-green-600 dark:text-green-400 font-medium">
                  {team.won}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-muted-foreground">
                  {team.draw}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-red-600 dark:text-red-400">
                  {team.lost}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-foreground hidden sm:table-cell">
                  {team.goalsFor}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-foreground hidden sm:table-cell">
                  {team.goalsAgainst}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                  <span class="{team.goalDifference > 0 ? 'text-green-600' : team.goalDifference < 0 ? 'text-red-600' : 'text-muted-foreground'}">
                    {team.goalDifference > 0 ? '+' : ''}{team.goalDifference}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-bold text-foreground">
                  {team.points}
                </td>
                <td class="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                  <div class="flex gap-1" role="list" aria-label="Last 5 results">
                    {#each formatForm(team.form) as result}
                      <span
                        class="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center {getFormClass(result)}"
                        role="listitem"
                        title="{result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}"
                        aria-label="{result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}"
                      >
                        {result}
                      </span>
                    {:else}
                      <span class="text-xs text-muted-foreground">—</span>
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
        <div class="px-6 py-3 bg-muted border-t border-border">
          <button
            on:click={() => showFullTable = !showFullTable}
            class="w-full text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            aria-expanded={showFullTable}
          >
            {showFullTable ? 'Show Less' : `Show All ${standings.length} Teams`}
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-12 text-center">
      <Trophy class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <p class="text-muted-foreground">No standings data available</p>
    </div>
  {/if}
</div>

