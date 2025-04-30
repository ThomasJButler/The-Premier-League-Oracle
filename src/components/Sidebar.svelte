<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  
  export let currentView: string;
  export let isOpen: boolean;
  const dispatch = createEventDispatcher();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'matches', label: 'Matches', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'predictions', label: 'Predictions', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'history', label: 'Betting History', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { id: 'assistant', label: 'AI Assistant', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' }
  ];
</script>

{#if isOpen}
<aside class="sidebar pt-4 fixed top-0 left-0 h-full z-10 transition-transform duration-300 ease-in-out" transition:slide={{ duration: 300, axis: 'x' }}>
  <div class="px-4 mb-6">
    <div class="flex items-center space-x-2">
      <span class="text-2xl font-bold gradient-text">⚡</span>
      <span class="text-lg font-semibold text-slate-800 dark:text-slate-200">Football Oracle</span>
    </div>
  </div>
  
  <nav class="space-y-1 px-2">
    {#each menuItems as item}
      <button
        class="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out
               {currentView === item.id ? 
                 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-medium shadow-sm border border-blue-100 dark:from-slate-800 dark:to-slate-700 dark:text-blue-300 dark:border-slate-600' : 
                 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-100'}"
        on:click={() => dispatch('changeView', item.id)}
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
        </svg>
        <span class="flex-grow text-left text-sm">{item.label}</span>
      </button>
    {/each}
  </nav>

  <div class="absolute bottom-0 left-0 w-full p-4 border-t border-slate-200 dark:border-slate-700">
    <div class="flex items-center space-x-2">
      <div class="avatar w-8 h-8 text-sm">
        <span class="font-semibold text-primary dark:text-primary-light">TB</span>
      </div>
      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Tom Butler</span>
    </div>
  </div>
</aside>
{/if}

<style>
  .sidebar {
    width: 256px; /* Equivalent to ml-64 */
    background-color: var(--sidebar-bg, white); /* Use CSS variables for theming */
    border-right: 1px solid var(--sidebar-border, #e5e7eb); /* Use CSS variables */
  }
  :global(.dark) .sidebar {
    background-color: var(--sidebar-bg-dark, #1f2937); /* Dark mode background */
    border-right-color: var(--sidebar-border-dark, #374151); /* Dark mode border */
  }
</style>