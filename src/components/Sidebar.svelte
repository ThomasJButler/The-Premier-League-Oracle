<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let currentView: string;
  const dispatch = createEventDispatcher();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'matches', label: 'Matches', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'predictions', label: 'Predictions', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'history', label: 'Betting History', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { id: 'assistant', label: 'AI Assistant', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' }
  ];
</script>

<aside class="w-64 bg-white dark:bg-dark-card shadow-md h-screen border-r border-gray-100 dark:border-dark-border">
  <div class="p-4">
    <div class="flex items-center space-x-2 mb-8">
      <span class="text-xl font-bold gradient-text">⚡</span>
      <span class="text-lg font-semibold dark:text-dark-text">Football Oracle</span>
    </div>
    
    <nav class="space-y-2">
      {#each menuItems as item}
        <button
          class="w-full flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200
                 {currentView === item.id ? 
                   'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400' : 
                   'hover:bg-gray-50 dark:hover:bg-dark-bg dark:text-dark-text'}"
          on:click={() => dispatch('changeView', item.id)}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
          </svg>
          <span>{item.label}</span>
        </button>
      {/each}
    </nav>
  </div>
</aside>