<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let isDarkMode: boolean;
  const dispatch = createEventDispatcher();
</script>

<header class="bg-white dark:bg-dark-card shadow-md px-6 py-4 border-b border-gray-100 dark:border-dark-border">
  <div class="flex justify-between items-center">
    <h1 class="text-2xl font-bold gradient-text">⚡ The Football Oracle</h1>
    
    <div class="flex items-center space-x-4">
      <button
        class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg transition-colors duration-200"
        on:click={() => dispatch('toggleDarkMode')}
        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {#if isDarkMode}
          <svg class="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        {:else}
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        {/if}
      </button>
      
      <div class="relative">
        <button class="flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-dark-bg p-2 rounded-lg transition-colors duration-200">
          <span class="font-medium dark:text-dark-text">Profile</span>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</header>