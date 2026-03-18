<script lang="ts">
  import { onMount } from 'svelte';
  import { Trophy, Flag } from 'lucide-svelte';
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

  // Derive current season label from date (July onwards = new season)
  function getSeasonLabel(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month >= 6) return `${year}/${(year + 1).toString().slice(-2)}`;
    return `${year - 1}/${year.toString().slice(-2)}`;
  }

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
      scorers = rawScorers.map((s: any, index: number) => ({
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
        goals: s.goals || s.numberOfGoals || 0,
        assists: s.assists ?? s.numberOfAssists ?? null,
        penalties: s.penalties ?? s.penaltyGoals ?? null
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
    <div class="grid gap-4">
      {#each scorers as scorer, index}
        <div 
          class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group"
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
                <span class="text-xs px-2 py-0.5 bg-muted rounded-full">
                  {scorer.player.position}
                </span>
              </div>
              <div class="flex items-center gap-4 text-sm text-muted-foreground">
                <span class="flex items-center gap-1">
                  {#if scorer.team.crest}
                    <img 
                      src={scorer.team.crest} 
                      alt={scorer.team.name}
                      class="w-4 h-4 object-contain"
                      on:error={handleImageError}
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
                <div class="text-xs text-muted-foreground">Goals</div>
              </div>
              {#if scorer.assists !== null}
                <div>
                  <div class="text-2xl font-bold text-blue-500">{scorer.assists}</div>
                  <div class="text-xs text-muted-foreground">Assists</div>
                </div>
              {/if}
              {#if scorer.penalties != null && scorer.penalties > 0}
                <div>
                  <div class="text-2xl font-bold text-amber-500">{scorer.penalties}</div>
                  <div class="text-xs text-muted-foreground">Pens</div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-8 text-center">
      <Trophy class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <p class="text-muted-foreground">No scorer data available</p>
    </div>
  {/if}
</div>

