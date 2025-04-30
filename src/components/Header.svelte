<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let isDarkMode: boolean;
  const dispatch = createEventDispatcher();
</script>

<header class="navbar px-4 sm:px-6 py-3 sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/50">
  <div class="flex justify-between items-center w-full">
    <div class="flex items-center">
      <button 
        class="mr-2 p-2 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700/50 lg:hidden" 
        on:click={() => dispatch('toggleSidebar')}
        aria-label="Toggle sidebar"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
      </button>
      <span class="text-2xl font-bold gradient-text mr-2">⚡</span>
      <h1 class="text-xl font-semibold text-slate-800 dark:text-slate-200 hidden sm:block">
        The Premier League Oracle
      </h1>
    </div>
    
    <div class="flex items-center space-x-3 sm:space-x-4">
      <button
        class="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
        on:click={() => dispatch('toggleDarkMode')}
        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {#if isDarkMode}
          <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        {:else}
          <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        {/if}
      </button>
      
      <div class="relative group">
        <button class="flex items-center space-x-1 sm:space-x-2 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 p-2 rounded-lg transition-colors duration-200">
          <div class="avatar w-8 h-8 text-sm">
            <span class="font-semibold text-primary dark:text-primary-light">TB</span>
          </div>
          <span class="font-medium text-slate-700 dark:text-slate-300 hidden md:inline">Tom Butler</span>
          <svg class="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <!-- Basic Dropdown Structure (needs JS for toggle) -->
        <div class="dropdown hidden group-hover:block">
          <div class="py-1">
            <button type="button" class="dropdown-item">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              Profile
            </button>
          </div>
          <div class="py-1">
            <button type="button" class="dropdown-item">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>