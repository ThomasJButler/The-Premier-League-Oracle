<script lang="ts">
  import { Router, Route, navigate } from 'svelte-routing';
  import Header from './components/Header.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import MobileNav from './components/MobileNav.svelte';
  import LiveTicker from './components/LiveTicker.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import MatchList from './components/MatchList.svelte';
  import Predictions from './components/Predictions.svelte';
  import LiveMatches from './components/LiveMatches.svelte';
  import StandingsTable from './components/StandingsTable.svelte';
  import KellyCalculator from './components/betting/KellyCalculator.svelte';
  import Settings from './components/Settings.svelte';
  import ApiSetupWizard from './components/ApiSetupWizard.svelte';
  import Help from './components/Help.svelte';
  import TopScorers from './components/TopScorers.svelte';
  import SeasonStats from './components/SeasonStats.svelte';
  import SeasonTimeline from './components/SeasonTimeline.svelte';
  import ChatBot from './components/ChatBot.svelte';
  import { dataService } from './services/dataService';
  import { footballDataAPI } from './services/api/footballData';
  import { onMount } from 'svelte';
  import { isDarkMode } from './stores/theme';
  import { REDIRECTS } from './routes';

  export let url = '';

  let isSidebarOpen = false;
  let showApiSetup = false;
  let hasApiKey = false;
  let dashboardComponent: Dashboard;

  function applyRedirect(): boolean {
    const here = window.location.pathname + window.location.search;
    const target = REDIRECTS[window.location.pathname];
    if (target && here !== target) {
      navigate(target, { replace: true });
      return true;
    }
    return false;
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }

  onMount(() => {
    if (window.innerWidth >= 1024) {
      isSidebarOpen = true;
    }
    isDarkMode.init();
    const savedTeam = localStorage.getItem('favourite_team');
    if (savedTeam) {
      document.documentElement.dataset.team = savedTeam;
    }
    applyRedirect();
    checkApiKey();
  });

  function checkApiKey() {
    const apiKey = localStorage.getItem('football_data_api_key');
    hasApiKey = !!apiKey;
    if (!hasApiKey) {
      showApiSetup = true;
    }
  }

  async function handleApiSetupComplete(event: CustomEvent<{ apiKey: string }>) {
    showApiSetup = false;
    if (!event.detail.apiKey) return;
    hasApiKey = true;
    footballDataAPI.setApiKey(event.detail.apiKey);
    await dataService.clearCache();
    await dataService.refreshApiConfiguration();
    if (dashboardComponent) {
      setTimeout(() => dashboardComponent.refresh(), 100);
    }
  }
</script>

<Router {url}>
  <div class="flex h-screen bg-background text-foreground overflow-hidden relative noise-bg">
    <Sidebar bind:isOpen={isSidebarOpen} on:closeSidebar={() => (isSidebarOpen = false)} />

    <div class="flex-1 flex flex-col overflow-hidden transition-[margin] duration-300 ease-in-out {isSidebarOpen ? 'lg:ml-64' : ''}">
      <Header toggleSidebar={toggleSidebar} {isSidebarOpen} />
      <LiveTicker />

      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 pb-20 sm:p-6 sm:pb-20 lg:p-8 lg:pb-8 relative" aria-label="Premier League Oracle content">
        <!-- Phase 0b: routes mount LEGACY components by URL.
             Phase 0d swaps the shell; later phases swap the components. -->
        <Route path="/today"><Dashboard bind:this={dashboardComponent} /></Route>
        <Route path="/fixtures/live"><LiveMatches /></Route>
        <Route path="/fixtures/matches"><MatchList /></Route>
        <Route path="/fixtures/standings"><StandingsTable /></Route>
        <Route path="/predictions/this-week"><Predictions /></Route>
        <Route path="/predictions/backtest"><Predictions /></Route>
        <Route path="/predictions/log"><Predictions /></Route>
        <Route path="/predictions/tools"><KellyCalculator /></Route>
        <Route path="/oracle"><ChatBot /></Route>
        <Route path="/insights/scorers"><TopScorers /></Route>
        <Route path="/insights/stats"><SeasonStats /></Route>
        <Route path="/insights/timeline"><SeasonTimeline /></Route>
        <Route path="/settings/account"><Settings /></Route>
        <Route path="/settings/api-data"><Settings /></Route>
        <Route path="/settings/display"><Settings /></Route>
        <Route path="/settings/predictions"><Settings /></Route>
        <Route path="/settings/notifications"><Settings /></Route>
        <Route path="/settings/privacy"><Settings /></Route>
        <Route path="/settings/help"><Help /></Route>
      </main>
    </div>

    <MobileNav />

    {#if showApiSetup}
      <ApiSetupWizard on:complete={handleApiSetupComplete} />
    {/if}
  </div>
</Router>
