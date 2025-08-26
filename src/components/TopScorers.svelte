<script lang="ts">
  import { onMount } from 'svelte';
  import { Trophy, Target, User, Flag } from 'lucide-svelte';
  import { dataService } from '../services/dataService';
  import { fade, fly } from 'svelte/transition';
  
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
      scorers = rawScorers.map((s: any, index: number) => ({
        position: index + 1,
        player: {
          id: s.player?.id || 0,
          name: s.player?.name || 'Unknown',
          nationality: s.player?.nationality || 'Unknown',
          position: s.player?.position || 'Forward',
          dateOfBirth: s.player?.dateOfBirth
        },
        team: {
          id: s.team?.id || 0,
          name: s.team?.name || s.team?.shortName || 'Unknown',
          crest: s.team?.crest
        },
        goals: s.goals || s.numberOfGoals || 0,
        assists: s.assists || s.numberOfAssists || null,
        penalties: s.penalties || s.penaltyGoals || null
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
      console.error('Error loading top scorers:', err);
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
  <div class="glass-card p-6 mb-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
          <Trophy class="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 class="text-2xl font-bold gradient-text">Top Scorers</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Premier League 2024/25 Season</p>
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
      <div class="loading-spinner"></div>
    </div>
  {:else if error}
    <div class="glass-card p-6 text-center">
      <p class="text-red-500">{error}</p>
      <button 
        on:click={loadTopScorers}
        class="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
      >
        Try Again
      </button>
    </div>
  {:else if scorers.length > 0}
    <div class="grid gap-4">
      {#each scorers as scorer, index}
        <div 
          class="glass-card p-4 hover:shadow-xl transition-all duration-300 group"
          in:fly={{ y: 20, delay: index * 50, duration: 300 }}
        >
          <div class="flex items-center gap-4">
            <!-- Position -->
            <div class="flex-shrink-0">
              {#if index < 3}
                <div class="text-3xl">{getPositionIcon(index + 1)}</div>
              {:else}
                <div class="w-10 h-10 bg-gradient-to-br {getPositionColor(index + 1)} rounded-full flex items-center justify-center">
                  <span class="text-white font-bold">{index + 1}</span>
                </div>
              {/if}
            </div>
            
            <!-- Player Info -->
            <div class="flex-grow">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="font-semibold text-lg group-hover:text-primary transition-colors">
                  {scorer.player.name}
                </h3>
                <span class="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                  {scorer.player.position}
                </span>
              </div>
              <div class="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                <span class="flex items-center gap-1">
                  {#if scorer.team.crest}
                    <img 
                      src={scorer.team.crest} 
                      alt={scorer.team.name}
                      class="w-4 h-4 object-contain"
                      on:error={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  {/if}
                  {scorer.team.name}
                </span>
                {#if scorer.player.nationality && scorer.player.nationality !== 'Unknown'}
                  <span class="flex items-center gap-1">
                    <Flag class="w-3 h-3" />
                    {scorer.player.nationality}
                  </span>
                {/if}
              </div>
            </div>
            
            <!-- Stats -->
            <div class="flex gap-6 text-center">
              <div>
                <div class="text-2xl font-bold text-primary">{scorer.goals}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400">Goals</div>
              </div>
              {#if scorer.assists !== null}
                <div>
                  <div class="text-2xl font-bold text-blue-500">{scorer.assists}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">Assists</div>
                </div>
              {/if}
              {#if scorer.penalties !== null && scorer.penalties > 0}
                <div>
                  <div class="text-2xl font-bold text-amber-500">{scorer.penalties}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">Pens</div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="glass-card p-8 text-center">
      <Trophy class="w-12 h-12 mx-auto mb-4 text-slate-400" />
      <p class="text-slate-500 dark:text-slate-400">No scorer data available</p>
    </div>
  {/if}
</div>

<style>
  .glass-card {
    @apply bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-slate-200 dark:border-slate-700;
  }
  
  .gradient-text {
    @apply bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent;
  }
  
  .loading-spinner {
    @apply w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin;
  }
</style>