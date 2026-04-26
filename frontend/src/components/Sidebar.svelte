<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { navigate as routerNavigate } from 'svelte-routing';
  import * as Sheet from '$lib/components/ui/sheet';
  import SidebarNav from './SidebarNav.svelte';

  export let currentView: string = '';
  export let isOpen: boolean;

  const VIEW_TO_PATH: Record<string, string> = {
    'Dashboard': '/today',
    'Matches': '/fixtures/matches',
    'Live Matches': '/fixtures/live',
    'Standings': '/fixtures/standings',
    'Predictions': '/predictions/this-week',
    'Suggested Bets': '/predictions/tools',
    'Kelly Calculator': '/predictions/tools?utility=kelly',
    'Value Scanner': '/predictions/tools?utility=value',
    'Accumulators': '/predictions/tools',
    'Betting History': '/predictions/log',
    'Top Scorers': '/insights/scorers',
    'Season Stats': '/insights/stats',
    'Season Timeline': '/insights/timeline',
    'Oracle Chat': '/oracle',
    'Settings': '/settings/account',
    'Help': '/settings/help',
  };

  let isMobile = false;
  function checkMobile() { isMobile = window.innerWidth < 1024; }
  if (typeof window !== 'undefined') {
    checkMobile();
    window.addEventListener('resize', checkMobile);
  }
  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('resize', checkMobile);
  });

  const dispatch = createEventDispatcher();

  function closeSidebar() {
    dispatch('closeSidebar');
  }

  function handleNavClick(e: CustomEvent<{ view: string }>) {
    const path = VIEW_TO_PATH[e.detail.view] ?? '/today';
    routerNavigate(path);
    if (isMobile) closeSidebar();
  }
</script>

<!-- Desktop sidebar — always in DOM, slides via CSS transform -->
<aside class="sidebar-container hidden lg:flex {isOpen ? 'translate-x-0' : '-translate-x-full'}">
  <SidebarNav {currentView} on:navigate={handleNavClick} />
</aside>

<!-- Mobile sidebar — Sheet overlay -->
<div class="lg:hidden">
  <Sheet.Root open={isOpen && isMobile} on:close={closeSidebar}>
    <Sheet.Content side="left" class="w-64 p-0">
      <SidebarNav {currentView} showCloseButton on:navigate={handleNavClick} on:close={closeSidebar} />
    </Sheet.Content>
  </Sheet.Root>
</div>
