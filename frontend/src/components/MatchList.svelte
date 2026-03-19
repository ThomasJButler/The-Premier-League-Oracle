<script lang="ts">
  import { onMount } from 'svelte';
  import { dataService } from '../services/dataService';
  import type { Match, Season } from '../types';
  import { format } from 'date-fns';
  import { getTeamLogo } from '../utils/teamLogos';
  import { ArrowUpDown, Filter, Users } from 'lucide-svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { getSeasonYear } from '../lib/utils';

  let matches: Match[] = [];
  let filteredMatches: Match[] = [];
  let seasons: Season[] = [];
  // Compute current season from date (July onwards = new season). Overwritten by API if available.
  const year = getSeasonYear();
  let selectedSeason = `${year}-${year + 1}`;
  let loading = true;
  let error: string | null = null;
  
  // Filter states
  let filterStatus: 'all' | 'completed' | 'upcoming' = 'all';
  let filterTeam: string = '';
  let sortBy: 'date' | 'team' | 'status' = 'date';
  let sortOrder: 'asc' | 'desc' = 'asc';
  let teams: string[] = [];

  export async function loadSeasons() {
    try {
      seasons = await dataService.getAllSeasons();
      if (seasons.length > 0) {
        const currentSeason = seasons.find(s => s.is_current) || seasons[0];
        selectedSeason = currentSeason.name;
      }
    } catch (err) {
      console.warn('Failed to load seasons:', err);
      error = 'Failed to load seasons. Please check your API key in Settings.';
      loading = false;
    }
  }

  export async function loadMatches() {
    loading = true;
    error = null;
    try {
      matches = await dataService.getMatchesBySeason(selectedSeason);
      
      // Extract unique teams
      const teamSet = new Set<string>();
      matches.forEach(match => {
        teamSet.add(match.home_team);
        teamSet.add(match.away_team);
      });
      teams = Array.from(teamSet).sort();
      
      // Apply filters and sorting
      applyFiltersAndSort();
    } catch (err) {
      error = 'Failed to load matches. Please try again.';
    } finally {
      loading = false;
    }
  }
  
  function applyFiltersAndSort() {
    let result = [...matches];
    
    // Apply status filter
    if (filterStatus === 'completed') {
      result = result.filter(m => m.result !== null);
    } else if (filterStatus === 'upcoming') {
      result = result.filter(m => m.result === null);
    }
    
    // Apply team filter
    if (filterTeam) {
      result = result.filter(m => 
        m.home_team === filterTeam || m.away_team === filterTeam
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'team':
          comparison = a.home_team.localeCompare(b.home_team);
          break;
        case 'status': {
          const aStatus = a.result ? 1 : 0;
          const bStatus = b.result ? 1 : 0;
          comparison = aStatus - bStatus;
          break;
        }
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    filteredMatches = result;
  }
  
  function handleSort(field: 'date' | 'team' | 'status') {
    if (sortBy === field) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = field;
      sortOrder = 'asc';
    }
    applyFiltersAndSort();
  }
  
  function handleFilterChange() {
    applyFiltersAndSort();
  }

  onMount(async () => {
    await loadSeasons();
    if (error) return;
    await loadMatches();
  });
</script>

<div class="space-y-6 animate-fade-in">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <h2 class="text-2xl font-bold font-display text-foreground">Match Schedule</h2>

    <div class="flex items-center gap-4">
      <!-- Season selector -->
      {#if seasons.length > 1}
        <div class="flex items-center gap-2">
          <label for="season-select" class="text-sm text-muted-foreground">Season</label>
          <select
            id="season-select"
            bind:value={selectedSeason}
            on:change={() => loadMatches()}
            class="px-3 py-1.5 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {#each seasons as season}
              <option value={season.name}>{season.name}</option>
            {/each}
          </select>
        </div>
      {/if}

      <!-- Match count -->
      {#if !loading && filteredMatches.length > 0}
        <span class="text-sm text-muted-foreground">
          Showing {filteredMatches.length} of {matches.length} matches
        </span>
      {/if}
    </div>
  </div>
  
  <!-- Filters and Sorting Controls -->
  {#if !loading && matches.length > 0}
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Status Filter -->
        <div class="space-y-2">
          <label for="status-filter" class="text-sm font-medium text-foreground flex items-center gap-2">
            <Filter class="w-4 h-4" />
            Status
          </label>
          <select 
            id="status-filter" 
            bind:value={filterStatus} 
            on:change={handleFilterChange}
            class="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">All Matches</option>
            <option value="completed">Completed</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>
        
        <!-- Team Filter -->
        <div class="space-y-2">
          <label for="team-filter" class="text-sm font-medium text-foreground flex items-center gap-2">
            <Users class="w-4 h-4" />
            Team
          </label>
          <select 
            id="team-filter" 
            bind:value={filterTeam} 
            on:change={handleFilterChange}
            class="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">All Teams</option>
            {#each teams as team}
              <option value={team}>{team}</option>
            {/each}
          </select>
        </div>
        
        <!-- Sort By -->
        <div class="space-y-2">
          <div class="text-sm font-medium text-foreground flex items-center gap-2" role="group" aria-label="Sort options">
            <ArrowUpDown class="w-4 h-4" />
            Sort By
          </div>
          <div class="flex gap-2">
            <button
              on:click={() => handleSort('date')}
              aria-pressed={sortBy === 'date'}
              class="flex-1 px-3 py-2 text-sm rounded-lg transition-colors {sortBy === 'date'
                ? 'bg-primary text-white'
                : 'bg-muted text-foreground hover:bg-muted/80'}"
            >
              Date {sortBy === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
            </button>
            <button
              on:click={() => handleSort('team')}
              aria-pressed={sortBy === 'team'}
              class="flex-1 px-3 py-2 text-sm rounded-lg transition-colors {sortBy === 'team'
                ? 'bg-primary text-white'
                : 'bg-muted text-foreground hover:bg-muted/80'}"
            >
              Team {sortBy === 'team' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
            </button>
          </div>
        </div>
        
        <!-- Quick Actions -->
        <div class="space-y-2">
          <span class="text-sm font-medium text-foreground">Quick Filters</span>
          <div class="flex gap-2">
            <button
              on:click={() => {
                filterStatus = 'upcoming';
                filterTeam = '';
                handleFilterChange();
              }}
              class="flex-1 px-3 py-2 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
            >
              Next Fixtures
            </button>
            <button
              on:click={() => {
                filterStatus = 'completed';
                sortBy = 'date';
                sortOrder = 'desc';
                filterTeam = '';
                handleFilterChange();
              }}
              class="flex-1 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              Recent Results
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  {:else if error}
    <div class="rounded-xl border border-destructive/50 bg-destructive/10 text-destructive shadow-sm p-6 text-center">
      <p class="font-medium">{error}</p>
      <Button class="mt-4" on:click={loadMatches}>Retry</Button>
    </div>
  {:else if filteredMatches.length === 0}
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 text-center">
      <p class="text-muted-foreground">No matches found with the current filters.</p>
      <Button class="mt-4" on:click={() => {
          filterStatus = 'all';
          filterTeam = '';
          handleFilterChange();
        }}>
        Clear Filters
      </Button>
    </div>
  {:else}
    <div class="space-y-4">
      {#each filteredMatches as match, i (match.id)}
        <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5 grid grid-cols-3 sm:grid-cols-[1fr_auto_1fr_auto] items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 animate-slide-in-up" style="animation-delay: {i * 50}ms">
          <!-- Team 1 -->
          <div class="flex items-center justify-end space-x-3">
            <span class="font-semibold text-foreground text-right">{match.home_team}</span>
            <img src={getTeamLogo(match.home_team, 30)} alt="{match.home_team} logo" class="w-7 h-7 object-contain rounded-full">
          </div>

          <!-- Score/Time -->
          <div class="text-center">
            {#if match.result}
              <div class="text-xl font-bold text-foreground px-3 py-1">
                {match.home_goals ?? '?'} - {match.away_goals ?? '?'}
              </div>
            {:else}
              <div class="text-sm font-medium text-muted-foreground">
                {format(new Date(match.date), 'HH:mm')}
              </div>
              <div class="text-xs text-muted-foreground">
                {format(new Date(match.date), 'MMM d')}
              </div>
            {/if}
          </div>

          <!-- Team 2 -->
          <div class="flex items-center justify-start space-x-3">
            <img src={getTeamLogo(match.away_team, 30)} alt="{match.away_team} logo" class="w-7 h-7 object-contain rounded-full">
            <span class="font-semibold text-foreground text-left">{match.away_team}</span>
          </div>

          <!-- Status/Actions -->
          <div class="flex items-center justify-center sm:justify-end space-x-2 mt-2 sm:mt-0 col-span-full sm:col-span-1">
            {#if match.result}
              <Badge variant="neutral">Finished</Badge>
            {:else}
              <Badge variant="info">Upcoming</Badge>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

