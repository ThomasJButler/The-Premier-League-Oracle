<script lang="ts">
  import Header from './components/Header.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import MobileNav from './components/MobileNav.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import MatchList from './components/MatchList.svelte';
  import Predictions from './components/Predictions.svelte';
  import BettingHistory from './components/BettingHistory.svelte';
  import LiveTicker from './components/LiveTicker.svelte';
  import SeasonStats from './components/SeasonStats.svelte';
  import KellyCalculator from './components/betting/KellyCalculator.svelte';
  import ValueBets from './components/betting/ValueBets.svelte';
  import Settings from './components/Settings.svelte';
  import ApiSetupWizard from './components/ApiSetupWizard.svelte';
  import Help from './components/Help.svelte';
  import TopScorers from './components/TopScorers.svelte';
  import LiveMatches from './components/LiveMatches.svelte';
  import StandingsTable from './components/StandingsTable.svelte';
  import { onMount } from 'svelte';

  let currentView = 'Dashboard'; // Default view
  let isSidebarOpen = false; // Start with sidebar closed
  let isTransitioning = false;
  let showApiSetup = false;
  let hasApiKey = false;
  let dashboardComponent: Dashboard;
  
  function navigate(event: CustomEvent<{ view: string }>) {
    if (event.detail.view === currentView) return;
    
    isTransitioning = true;
    setTimeout(() => {
      currentView = event.detail.view;
      setTimeout(() => {
        isTransitioning = false;
      }, 50);
    }, 200);
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }

  onMount(() => {
    // Open sidebar only on large desktop screens
    if (window.innerWidth >= 1024) { // Large desktop screens
      isSidebarOpen = true;
    }

    // Restore saved theme, falling back to system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }

    // Check for API key on load
    checkApiKey();
  });

  function checkApiKey() {
    const apiKey = localStorage.getItem('football_data_api_key');
    hasApiKey = !!apiKey;
    
    // Show setup wizard if no API key found
    if (!hasApiKey) {
      showApiSetup = true;
    }
  }

  async function handleApiSetupComplete(event: CustomEvent<{ apiKey: string }>) {
    hasApiKey = true;
    showApiSetup = false;
    
    // Refresh data services with new API key
    const { dataService } = await import('./services/dataService');
    const { footballDataAPI } = await import('./services/api/footballData');
    
    // Set the API key in the Football Data API
    footballDataAPI.setApiKey(event.detail.apiKey);
    
    // Refresh data source availability
    await dataService.refreshApiConfiguration();
    
    // API key setup completed successfully
    
    // Refresh dashboard if it's currently loaded
    if (currentView === 'Dashboard' && dashboardComponent) {
      setTimeout(() => {
        dashboardComponent.refresh();
      }, 100);
    }
  }

</script>

<div class="flex h-screen bg-background text-foreground overflow-hidden relative">
  <Sidebar bind:isOpen={isSidebarOpen} currentView={currentView} on:navigate={navigate} on:closeSidebar={() => isSidebarOpen = false} />

  <div class="flex-1 flex flex-col overflow-hidden">
    <Header toggleSidebar={toggleSidebar} />
    <LiveTicker />

    <main class="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 relative">
      <!-- Page transition overlay -->
      {#if isTransitioning}
        <div class="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 transition-opacity duration-200 animate-fadeIn"></div>
      {/if}
      
      <!-- Page content with smooth transitions -->
      <div class="page-content" class:transitioning={isTransitioning}>
        {#if currentView === 'Dashboard'}
          <Dashboard bind:this={dashboardComponent} on:navigate={navigate} />
        {:else if currentView === 'Matches'}
          <MatchList />
        {:else if currentView === 'Predictions'}
          <Predictions />
        {:else if currentView === 'Kelly Calculator'}
          <KellyCalculator />
        {:else if currentView === 'Value Bets'}
          <ValueBets />
        {:else if currentView === 'Betting History'}
          <BettingHistory />
        {:else if currentView === 'Season Stats'}
          <SeasonStats />
        {:else if currentView === 'Settings'}
          <Settings on:apiConfigured={() => {
            if (dashboardComponent && currentView === 'Dashboard') {
              dashboardComponent.refresh();
            }
          }} />
        {:else if currentView === 'Help'}
          <Help />
        {:else if currentView === 'Top Scorers'}
          <TopScorers />
        {:else if currentView === 'Live Matches'}
          <LiveMatches />
        {:else if currentView === 'Standings'}
          <StandingsTable />
        {/if}
      </div>
    </main>
  </div>
  
  <!-- Mobile Navigation -->
  <MobileNav {currentView} on:navigate={navigate} />

  <!-- API Setup Wizard -->
  {#if showApiSetup}
    <ApiSetupWizard on:complete={handleApiSetupComplete} />
  {/if}
</div>

<style global lang="postcss">
  /* Page transition effects */
  .page-content {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  
  .page-content.transitioning {
    transform: translateY(10px) scale(0.98);
    opacity: 0.7;
  }
</style>