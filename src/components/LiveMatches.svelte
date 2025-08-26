<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Activity, Clock, AlertCircle, Tv, Calendar, TrendingUp, Check } from 'lucide-svelte';
  import { dataService } from '../services/dataService';
  import type { Match } from '../types';
  import { fade, scale } from 'svelte/transition';
  import { format, subDays, isAfter, isBefore } from 'date-fns';
  import { getTeamLogo } from '../utils/teamLogos';
  
  let liveMatches: Match[] = [];
  let recentMatches: Match[] = [];
  let upcomingMatches: Match[] = [];
  let loading = true;
  let error = '';
  let refreshInterval: ReturnType<typeof setInterval>;
  let lastRefresh = new Date();
  let showSection: 'live' | 'recent' | 'upcoming' = 'live';
  
  onMount(async () => {
    await loadMatches();
    // Refresh every 30 seconds for live matches
    refreshInterval = setInterval(loadMatches, 30000);
  });
  
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
  
  async function loadMatches() {
    try {
      loading = true;
      error = '';
      
      // Get all matches
      const allMatches = await dataService.getMatches();
      const now = new Date();
      const threeDaysAgo = subDays(now, 3);
      const sevenDaysFromNow = subDays(now, -7); // Adding 7 days
      
      // Filter matches into categories
      liveMatches = []; // Would need live data from API
      
      // Recent matches (last 3 days that are completed)
      recentMatches = allMatches.filter(match => {
        const matchDate = new Date(match.date);
        return match.result && isAfter(matchDate, threeDaysAgo) && isBefore(matchDate, now);
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Upcoming matches (next 7 days)
      upcomingMatches = allMatches.filter(match => {
        const matchDate = new Date(match.date);
        return !match.result && isAfter(matchDate, now) && isBefore(matchDate, sevenDaysFromNow);
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      lastRefresh = new Date();
      
      // Default to recent if no live matches
      if (liveMatches.length === 0 && showSection === 'live') {
        showSection = recentMatches.length > 0 ? 'recent' : 'upcoming';
      }
    } catch (err) {
      error = 'Failed to load matches. Please check your API configuration.';
      console.error('Error loading matches:', err);
    } finally {
      loading = false;
    }
  }
  
  function getMinute(match: Match): string {
    // This would need actual minute data from the API
    // For now, return a placeholder
    return "45'";
  }
  
  function getStatusBadge(match: Match): { text: string; class: string } {
    if (!match.home_goals && !match.away_goals) {
      return { text: 'LIVE', class: 'bg-red-500 animate-pulse' };
    }
    return { text: 'IN PLAY', class: 'bg-green-500' };
  }
</script>

<div class="max-w-7xl mx-auto">
  <!-- Header -->
  <div class="glass-card p-6 mb-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center animate-pulse">
          <Tv class="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 class="text-2xl font-bold gradient-text">Match Centre</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Live, recent and upcoming Premier League matches
          </p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-sm text-slate-500 dark:text-slate-400">
          Last update: {lastRefresh.toLocaleTimeString()}
        </div>
        <button 
          on:click={loadMatches}
          class="px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  </div>
  
  <!-- Tab Navigation -->
  {#if !loading}
    <div class="glass-card p-2 mb-6">
      <div class="grid grid-cols-3 gap-2">
        <button
          on:click={() => showSection = 'live'}
          class="px-4 py-3 rounded-lg transition-all {showSection === 'live' 
            ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold shadow-lg' 
            : 'bg-white/50 dark:bg-slate-800/50 hover:bg-white/70 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-300'}"
        >
          <div class="flex items-center justify-center gap-2">
            <Activity class="w-4 h-4" />
            <span>Live ({liveMatches.length})</span>
          </div>
        </button>
        
        <button
          on:click={() => showSection = 'recent'}
          class="px-4 py-3 rounded-lg transition-all {showSection === 'recent' 
            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold shadow-lg' 
            : 'bg-white/50 dark:bg-slate-800/50 hover:bg-white/70 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-300'}"
        >
          <div class="flex items-center justify-center gap-2">
            <Check class="w-4 h-4" />
            <span>Recent ({recentMatches.length})</span>
          </div>
        </button>
        
        <button
          on:click={() => showSection = 'upcoming'}
          class="px-4 py-3 rounded-lg transition-all {showSection === 'upcoming' 
            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold shadow-lg' 
            : 'bg-white/50 dark:bg-slate-800/50 hover:bg-white/70 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-300'}"
        >
          <div class="flex items-center justify-center gap-2">
            <Calendar class="w-4 h-4" />
            <span>Upcoming ({upcomingMatches.length})</span>
          </div>
        </button>
      </div>
    </div>
  {/if}
  
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="loading-spinner"></div>
    </div>
  {:else if error}
    <div class="glass-card p-6 text-center">
      <AlertCircle class="w-12 h-12 mx-auto mb-4 text-red-500" />
      <p class="text-red-500">{error}</p>
      <button 
        on:click={loadMatches}
        class="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
      >
        Try Again
      </button>
    </div>
  {:else if showSection === 'live' && liveMatches.length > 0}
    <div class="grid gap-4">
      {#each liveMatches as match, index}
        <div 
          class="glass-card p-6 hover:shadow-xl transition-all duration-300"
          in:scale={{ delay: index * 100, duration: 300 }}
        >
          <!-- Live Badge -->
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="{getStatusBadge(match).class} text-white text-xs px-2 py-1 rounded-full font-semibold">
                {getStatusBadge(match).text}
              </span>
              <span class="text-sm text-slate-600 dark:text-slate-400">
                {getMinute(match)}
              </span>
            </div>
            <Activity class="w-5 h-5 text-green-500 animate-pulse" />
          </div>
          
          <!-- Match Info -->
          <div class="grid grid-cols-3 gap-4 items-center">
            <!-- Home Team -->
            <div class="text-right">
              <div class="font-semibold text-lg">{match.home_team}</div>
              <div class="text-sm text-slate-500 dark:text-slate-400">Home</div>
            </div>
            
            <!-- Score -->
            <div class="text-center">
              <div class="text-3xl font-bold">
                <span class="text-primary">{match.home_goals ?? 0}</span>
                <span class="mx-2 text-slate-400">-</span>
                <span class="text-primary">{match.away_goals ?? 0}</span>
              </div>
            </div>
            
            <!-- Away Team -->
            <div class="text-left">
              <div class="font-semibold text-lg">{match.away_team}</div>
              <div class="text-sm text-slate-500 dark:text-slate-400">Away</div>
            </div>
          </div>
          
          <!-- Match Events (placeholder for future enhancement) -->
          <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div class="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Clock class="w-4 h-4" />
              <span>Match in progress</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
    
    <!-- Auto-refresh indicator -->
    <div class="mt-6 text-center">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Auto-refreshing every 30 seconds
      </p>
    </div>
  {:else if showSection === 'recent'}
    <!-- Recent Matches -->
    {#if recentMatches.length > 0}
      <div class="grid gap-4">
        {#each recentMatches as match, index}
          <div 
            class="glass-card p-4 hover:shadow-xl transition-all duration-300"
            in:scale={{ delay: index * 50, duration: 300 }}
          >
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs text-slate-500 dark:text-slate-400">
                {format(new Date(match.date), 'EEEE, MMMM d, yyyy')}
              </span>
              <span class="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-full font-semibold">
                FULL TIME
              </span>
            </div>
            
            <div class="grid grid-cols-7 gap-2 items-center">
              <!-- Home Team -->
              <div class="col-span-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <span class="font-semibold">{match.home_team}</span>
                  <img src={getTeamLogo(match.home_team)} alt="" class="w-6 h-6 object-contain" />
                </div>
              </div>
              
              <!-- Score -->
              <div class="text-center">
                <div class="text-2xl font-bold">
                  <span class="{match.result === 'H' ? 'text-green-600' : 'text-slate-600'}">{match.home_goals ?? 0}</span>
                  <span class="mx-1 text-slate-400">-</span>
                  <span class="{match.result === 'A' ? 'text-green-600' : 'text-slate-600'}">{match.away_goals ?? 0}</span>
                </div>
              </div>
              
              <!-- Away Team -->
              <div class="col-span-3">
                <div class="flex items-center gap-2">
                  <img src={getTeamLogo(match.away_team)} alt="" class="w-6 h-6 object-contain" />
                  <span class="font-semibold">{match.away_team}</span>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="glass-card p-8 text-center">
        <Calendar class="w-12 h-12 mx-auto mb-4 text-slate-400" />
        <p class="text-slate-500 dark:text-slate-400">No recent matches in the last 3 days</p>
      </div>
    {/if}
  {:else if showSection === 'upcoming'}
    <!-- Upcoming Matches -->
    {#if upcomingMatches.length > 0}
      <div class="grid gap-4">
        {#each upcomingMatches as match, index}
          <div 
            class="glass-card p-4 hover:shadow-xl transition-all duration-300"
            in:scale={{ delay: index * 50, duration: 300 }}
          >
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs text-slate-500 dark:text-slate-400">
                {format(new Date(match.date), 'EEEE, MMMM d')}
              </span>
              <span class="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-2 py-1 rounded-full font-semibold">
                {format(new Date(match.date), 'HH:mm')}
              </span>
            </div>
            
            <div class="grid grid-cols-7 gap-2 items-center">
              <!-- Home Team -->
              <div class="col-span-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <span class="font-semibold">{match.home_team}</span>
                  <img src={getTeamLogo(match.home_team)} alt="" class="w-6 h-6 object-contain" />
                </div>
              </div>
              
              <!-- VS -->
              <div class="text-center">
                <div class="text-lg font-bold text-slate-400">VS</div>
              </div>
              
              <!-- Away Team -->
              <div class="col-span-3">
                <div class="flex items-center gap-2">
                  <img src={getTeamLogo(match.away_team)} alt="" class="w-6 h-6 object-contain" />
                  <span class="font-semibold">{match.away_team}</span>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="glass-card p-8 text-center">
        <Calendar class="w-12 h-12 mx-auto mb-4 text-slate-400" />
        <p class="text-slate-500 dark:text-slate-400">No upcoming matches in the next 7 days</p>
      </div>
    {/if}
  {:else}
    <div class="glass-card p-12 text-center">
      <Tv class="w-16 h-16 mx-auto mb-4 text-slate-400" />
      <h3 class="text-xl font-semibold mb-2">No Live Matches</h3>
      <p class="text-slate-500 dark:text-slate-400">
        There are no Premier League matches in play right now.
      </p>
      <p class="text-sm text-slate-400 dark:text-slate-500 mt-2">
        Check back during match times for live updates.
      </p>
    </div>
  {/if}
</div>

<style>
  .glass-card {
    @apply bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-slate-200 dark:border-slate-700;
  }
  
  .gradient-text {
    @apply bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent;
  }
  
  .loading-spinner {
    @apply w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin;
  }
</style>