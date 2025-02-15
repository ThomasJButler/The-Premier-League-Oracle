<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Header from './components/Header.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import MatchList from './components/MatchList.svelte';
  import Predictions from './components/Predictions.svelte';
  import BettingHistory from './components/BettingHistory.svelte';

  let currentView = 'dashboard';
  let isDarkMode = false;

  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle('dark');
  }

  onMount(() => {
    // Check system preference for dark mode
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      isDarkMode = true;
      document.documentElement.classList.add('dark');
    }
  });
</script>

<div class="min-h-screen bg-gray-50 dark:bg-dark-bg" data-theme={isDarkMode ? 'dark' : 'light'}>
  <div class="flex">
    <Sidebar {currentView} on:changeView={(e) => currentView = e.detail} />
    
    <div class="flex-1">
      <Header {isDarkMode} on:toggleDarkMode={toggleDarkMode} />
      
      <main class="p-6">
        {#if currentView === 'dashboard'}
          <Dashboard />
        {:else if currentView === 'matches'}
          <MatchList />
        {:else if currentView === 'predictions'}
          <Predictions />
        {:else if currentView === 'history'}
          <BettingHistory />
        {/if}
        }
      </main>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
                 Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
  }
</style>