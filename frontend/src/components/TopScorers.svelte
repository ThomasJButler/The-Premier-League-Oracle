<script lang="ts">
  import { onMount } from 'svelte';
  import { Trophy } from 'lucide-svelte';
  import { dataService } from '../services/dataService';
  import { fade, fly } from 'svelte/transition';
  import { getSeasonLabel } from '../lib/utils';

  interface Scorer {
    position?: number;
    player: {
      id: number;
      name: string;
      nationality?: string;
      position?: string;
      dateOfBirth?: string;
    };
    team: {
      id: number;
      name: string;
      crest?: string;
    };
    goals: number;
    assists?: number | null;
    penalties?: number | null;
  }
  
  let scorers: Scorer[] = [];
  let loading = true;
  let error = '';

  function handleImageError(e: Event) {
    const target = e.currentTarget;
    if (target instanceof HTMLImageElement) target.style.display = 'none';
  }
  
  onMount(async () => {
    await loadTopScorers();
  });
  
  async function loadTopScorers() {
    try {
      loading = true;
      error = '';
      
      // Check if API key is configured
      const apiKey = localStorage.getItem('football_data_api_key');
      if (!apiKey) {
        error = 'Please configure your Football-Data.org API key in Settings to view top scorers.';
        loading = false;
        return;
      }
      
      const rawScorers = await dataService.getTopScorers();
      
      // Transform data to consistent format
      scorers = rawScorers.map((s, index) => ({
        position: index + 1,
        player: {
          id: s.player?.id || 0,
          name: s.player?.name || 'Unknown',
          nationality: s.player?.nationality || 'Unknown',
          position: s.player?.position || 'Unknown',
          dateOfBirth: s.player?.dateOfBirth
        },
        team: {
          id: s.team?.id || 0,
          name: s.team?.name || s.team?.shortName || 'Unknown',
          crest: s.team?.crest
        },
        goals: s.goals || 0,
        assists: s.assists ?? null,
        penalties: s.penalties ?? null
      }));
      
      if (scorers.length === 0) {
        error = 'No top scorer data available for this season.';
      }
    } catch (err: any) {
      if (err.message?.includes('API key')) {
        error = 'Please configure your Football-Data.org API key in Settings to view top scorers.';
      } else if (err.message?.includes('403') || err.message?.includes('401')) {
        error = 'Invalid API key. Please check your Football-Data.org API key in Settings.';
      } else {
        error = 'Failed to load top scorers. Please check your internet connection and try again.';
      }
      // Error loading top scorers
    } finally {
      loading = false;
    }
  }
  
  function getPositionColor(position: number): string {
    if (position === 1) return 'from-yellow-400 to-amber-500';
    if (position === 2) return 'from-gray-300 to-gray-400';
    if (position === 3) return 'from-orange-400 to-orange-500';
    return 'from-slate-400 to-slate-500';
  }
  
  function getPositionIcon(position: number): string {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return '';
  }
</script>

<div class="max-w-7xl mx-auto">
  <!-- Header -->
  <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 mb-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center">
          <Trophy class="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 class="text-2xl font-bold font-display text-foreground">Top Scorers</h1>
          <p class="text-sm text-muted-foreground">Premier League {getSeasonLabel()} Season</p>
        </div>
      </div>
      <button 
        on:click={loadTopScorers}
        class="px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
        disabled={loading}
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
    <div class="rounded-xl border border-destructive/50 bg-destructive/10 shadow-sm p-6 text-center">
      <p class="text-destructive">{error}</p>
      <button 
        on:click={loadTopScorers}
        class="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
      >
        Try Again
      </button>
    </div>
  {:else if scorers.length > 0}
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
      <table class="w-full" aria-label="Top scorers table">
        <thead>
          <tr class="border-b border-border bg-muted/50">
            <th class="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">#</th>
            <th class="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Player</th>
            <th class="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Team</th>
            <th class="py-3 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Goals</th>
            <th class="py-3 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Assists</th>
            <th class="py-3 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Pens</th>
          </tr>
        </thead>
        <tbody>
          {#each scorers as scorer, index}
            <tr
              class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              in:fly={{ y: 20, delay: index * 50, duration: 300 }}
            >
              <td class="py-3 px-4">
                {#if index < 3}
                  <span class="text-xl">{getPositionIcon(index + 1)}</span>
                {:else}
                  <span class="inline-flex w-8 h-8 items-center justify-center bg-gradient-to-br {getPositionColor(index + 1)} rounded-full text-white font-bold text-sm">{index + 1}</span>
                {/if}
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-foreground">{scorer.player.name}</span>
                  <span class="text-xs px-2 py-0.5 bg-muted rounded-full hidden sm:inline">{scorer.player.position}</span>
                </div>
                <!-- Team shown inline on mobile -->
                <div class="flex items-center gap-1 text-sm text-muted-foreground sm:hidden mt-0.5">
                  {#if scorer.team.crest}
                    <img src={scorer.team.crest} alt="" class="w-4 h-4 object-contain" on:error={handleImageError} />
                  {/if}
                  {scorer.team.name}
                </div>
              </td>
              <td class="py-3 px-4 hidden sm:table-cell">
                <span class="flex items-center gap-2 text-sm text-muted-foreground">
                  {#if scorer.team.crest}
                    <img src={scorer.team.crest} alt="" class="w-5 h-5 object-contain" on:error={handleImageError} />
                  {/if}
                  {scorer.team.name}
                </span>
              </td>
              <td class="py-3 px-4 text-right">
                <span class="text-lg font-bold text-primary">{scorer.goals}</span>
              </td>
              <td class="py-3 px-4 text-right hidden sm:table-cell">
                <span class="text-lg font-bold text-blue-500">{scorer.assists ?? '-'}</span>
              </td>
              <td class="py-3 px-4 text-right hidden md:table-cell">
                <span class="text-lg font-bold text-amber-500">{scorer.penalties != null && scorer.penalties > 0 ? scorer.penalties : '-'}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-8 text-center">
      <Trophy class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <p class="text-muted-foreground">No scorer data available</p>
    </div>
  {/if}
</div>

