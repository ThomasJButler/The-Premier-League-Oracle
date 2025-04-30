<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Header from './components/Header.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import MatchList from './components/MatchList.svelte';
  import Predictions from './components/Predictions.svelte';
  import BettingHistory from './components/BettingHistory.svelte';
  import AiAssistant from './components/AiAssistant.svelte';

  let currentView = 'dashboard';
  let isDarkMode = false;
  let isSidebarOpen = true; // State for sidebar visibility

  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle('dark');
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }

  onMount(() => {
    // Check system preference for dark mode
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      isDarkMode = true;
      document.documentElement.classList.add('dark');
    }
  });
</script>

<div class="min-h-screen flex bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300" data-theme={isDarkMode ? 'dark' : 'light'}>
  <Sidebar {currentView} bind:isOpen={isSidebarOpen} on:changeView={(e) => currentView = e.detail} />
  
  <div class="flex-1 flex flex-col transition-all duration-300 ease-in-out {isSidebarOpen ? 'ml-64' : 'ml-0'}"> 
    <Header {isDarkMode} on:toggleDarkMode={toggleDarkMode} on:toggleSidebar={toggleSidebar} />
    
    <main class="flex-1 overflow-y-auto p-6 sm:p-8">
      {#if currentView === 'dashboard'}
        <Dashboard />
      {:else if currentView === 'matches'}
        <MatchList />
      {:else if currentView === 'predictions'}
        <Predictions />
      {:else if currentView === 'history'}
        <BettingHistory />
      {:else if currentView === 'assistant'}
        <AiAssistant />
      {/if}
    </main>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
                 Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Basic responsive adjustment for sidebar */
  @media (max-width: 768px) {
    .ml-64 {
      margin-left: 0; /* Remove margin on smaller screens if sidebar becomes toggleable */
    }
    /* Ensure main content takes full width when sidebar is closed on mobile */
    .flex-1.flex.flex-col.ml-0 {
        width: 100%;
    }
  }
</style>