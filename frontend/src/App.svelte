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
  import SuggestedBets from './components/betting/SuggestedBets.svelte';
  import ValueBets from './components/betting/ValueBets.svelte';
  import AccumulatorBuilder from './components/betting/AccumulatorBuilder.svelte';
  import Settings from './components/Settings.svelte';
  import ApiSetupWizard from './components/ApiSetupWizard.svelte';
  import Help from './components/Help.svelte';
  import TopScorers from './components/TopScorers.svelte';
  import LiveMatches from './components/LiveMatches.svelte';
  import StandingsTable from './components/StandingsTable.svelte';
  import SeasonTimeline from './components/SeasonTimeline.svelte';
  import SeasonPredictions from './components/SeasonPredictions.svelte';
  import ChatBot from './components/ChatBot.svelte';
  import { dataService } from './services/dataService';
  import { footballDataAPI } from './services/api/footballData';
  import { onMount } from 'svelte';
  import { isDarkMode } from './stores/theme';

  type ViewName = 'Dashboard' | 'Matches' | 'Predictions' | 'Season Predictions' | 'Kelly Calculator' | 'Suggested Bets' | 'Value Scanner' | 'Accumulators' | 'Betting History' | 'Season Stats' | 'Season Timeline' | 'Settings' | 'Help' | 'Top Scorers' | 'Live Matches' | 'Standings' | 'Oracle Chat';

  let currentView: ViewName = 'Dashboard';
  let isSidebarOpen = false; // Start with sidebar closed
  let isTransitioning = false;
  let showApiSetup = false;
  let hasApiKey = false;
  let dashboardComponent: Dashboard;
  
  function navigate(event: CustomEvent<{ view: string }>) {
    const view = event.detail.view as ViewName;
    if (view === currentView) return;

    isTransitioning = true;
    setTimeout(() => {
      currentView = view;
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

    // Initialise shared theme store — respects localStorage then prefers-color-scheme
    isDarkMode.init();

    // Restore favourite team theme
    const savedTeam = localStorage.getItem('favourite_team');
    if (savedTeam) {
      document.documentElement.dataset.team = savedTeam;
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
    showApiSetup = false;

    // Only mark as having an API key if one was actually provided
    if (!event.detail.apiKey) {
      return;
    }

    hasApiKey = true;

    // Set the API key and clear any stale cached data
    footballDataAPI.setApiKey(event.detail.apiKey);
    await dataService.clearCache();
    await dataService.refreshApiConfiguration();

    // Refresh dashboard if it's currently loaded
    if (currentView === 'Dashboard' && dashboardComponent) {
      setTimeout(() => {
        dashboardComponent.refresh();
      }, 100);
    }
  }

</script>

<div class="flex h-screen bg-background text-foreground overflow-hidden relative noise-bg">
  <Sidebar bind:isOpen={isSidebarOpen} currentView={currentView} on:navigate={navigate} on:closeSidebar={() => isSidebarOpen = false} />

  <div class="flex-1 flex flex-col overflow-hidden transition-[margin] duration-300 ease-in-out {isSidebarOpen ? 'lg:ml-64' : ''}">
    <Header toggleSidebar={toggleSidebar} {isSidebarOpen} />
    <LiveTicker />

    <main class="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 pb-20 sm:p-6 sm:pb-20 lg:p-8 lg:pb-8 relative" aria-label="Premier League Oracle content">
      <!-- Page transition overlay -->
      {#if isTransitioning}
        <div class="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 transition-opacity duration-200 animate-fade-in"></div>
      {/if}
      
      <!-- Page content with smooth transitions -->
      <div class="page-content" class:transitioning={isTransitioning}>
        {#if currentView === 'Dashboard'}
          <Dashboard bind:this={dashboardComponent} on:navigate={navigate} />
        {:else if currentView === 'Matches'}
          <MatchList />
        {:else if currentView === 'Predictions'}
          <Predictions on:navigate={navigate} />
        {:else if currentView === 'Kelly Calculator'}
          <KellyCalculator />
        {:else if currentView === 'Suggested Bets'}
          <SuggestedBets />
        {:else if currentView === 'Value Scanner'}
          <ValueBets />
        {:else if currentView === 'Accumulators'}
          <AccumulatorBuilder />
        {:else if currentView === 'Betting History'}
          <BettingHistory />
        {:else if currentView === 'Season Stats'}
          <SeasonStats />
        {:else if currentView === 'Season Timeline'}
          <SeasonTimeline />
        {:else if currentView === 'Season Predictions'}
          <SeasonPredictions />
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
        {:else if currentView === 'Oracle Chat'}
          <ChatBot />
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
