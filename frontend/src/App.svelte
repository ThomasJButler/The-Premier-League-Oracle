<script lang="ts">
  import { Router, Route, navigate } from 'svelte-routing';
  import BroadcastShell from './components/layout/BroadcastShell.svelte';
  import MobileTabBar from './components/layout/MobileTabBar.svelte';
  import MobileBottomSheet from './components/layout/MobileBottomSheet.svelte';
  import LiveTicker from './components/LiveTicker.svelte';
  import Today from './screens/Today.svelte';
  import Live from './screens/fixtures/Live.svelte';
  import MatchList from './components/MatchList.svelte';
  import Predictions from './components/Predictions.svelte';
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
  import { supportingClub } from './stores/supportingClub';
  import { REDIRECTS } from './routes';

  export let url = '';

  let showApiSetup = false;
  let mobileSheetOpen = false;

  function applyRedirect(): boolean {
    const here = window.location.pathname;
    const target = REDIRECTS[here];
    if (target && here !== target.split('?')[0]) {
      navigate(target, { replace: true });
      return true;
    }
    return false;
  }

  onMount(() => {
    isDarkMode.init();
    // supportingClub store self-initialises the data-team attribute on module load
    void supportingClub;
    applyRedirect();
    checkApiKey();
  });

  function checkApiKey() {
    const apiKey = localStorage.getItem('football_data_api_key');
    if (!apiKey) showApiSetup = true;
  }

  async function handleApiSetupComplete(event: CustomEvent<{ apiKey: string }>) {
    showApiSetup = false;
    if (!event.detail.apiKey) return;
    footballDataAPI.setApiKey(event.detail.apiKey);
    await dataService.clearCache();
    await dataService.refreshApiConfiguration();
  }
</script>

<Router {url}>
  <BroadcastShell>
    <LiveTicker />

    <Route path="/today"><Today /></Route>
    <Route path="/fixtures/live"><Live /></Route>
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
  </BroadcastShell>

  <MobileTabBar onMore={() => (mobileSheetOpen = true)} />
  <MobileBottomSheet open={mobileSheetOpen} onClose={() => (mobileSheetOpen = false)}>
    <a href="/insights/scorers" class="block py-2 text-label">Insights</a>
    <a href="/settings/account" class="block py-2 text-label">Settings</a>
  </MobileBottomSheet>

  {#if showApiSetup}
    <ApiSetupWizard on:complete={handleApiSetupComplete} />
  {/if}
</Router>
