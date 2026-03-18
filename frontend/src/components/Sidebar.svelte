<script lang="ts">
  import { LayoutDashboard, List, BarChart2, BarChart3, History, Settings, Calculator, HelpCircle, Trophy, Tv, Table, X, MessageCircle, Search } from 'lucide-svelte';
  import { Separator } from '$lib/components/ui/separator';
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { focusTrap } from '$lib/utils';

  export let currentView: string;
  export let isOpen: boolean;

  // Focus trap only on mobile (< lg breakpoint) when sidebar is open over backdrop
  let isMobile = false;
  function checkMobile() { isMobile = window.innerWidth < 1024; }
  if (typeof window !== 'undefined') {
    checkMobile();
    window.addEventListener('resize', checkMobile);
  }
  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('resize', checkMobile);
  });
  $: trapActive = isOpen && isMobile;

  const dispatch = createEventDispatcher();

  function closeSidebar() {
    dispatch('closeSidebar');
  }

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, view: 'Dashboard' },
    { name: 'Standings', icon: Table, view: 'Standings' },
    { name: 'Live Matches', icon: Tv, view: 'Live Matches' },
    { name: 'Matches', icon: List, view: 'Matches' },
    { name: 'Predictions', icon: BarChart3, view: 'Predictions' },
    { name: 'Oracle Chat', icon: MessageCircle, view: 'Oracle Chat' },
    { name: 'Top Scorers', icon: Trophy, view: 'Top Scorers' },
    { name: 'Season Stats', icon: BarChart2, view: 'Season Stats' },
  ];

  const bettingItems = [
    { name: 'Kelly Calculator', icon: Calculator, view: 'Kelly Calculator' },
    { name: 'Value Bets', icon: Search, view: 'Value Bets' },
    { name: 'Betting History', icon: History, view: 'Betting History' },
  ];

  const bottomNavItems = [
    { name: 'Help', icon: HelpCircle, view: 'Help' },
    { name: 'Settings', icon: Settings, view: 'Settings' },
  ];

  function handleNavClick(view: string) {
    dispatch('navigate', { view });
    if (window.innerWidth < 1024) {
      closeSidebar();
    }
  }

  function handleKeydown(e: any) {
    if (e.key === 'Escape' && isOpen && isMobile) closeSidebar();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<aside class="sidebar-container {isOpen ? 'translate-x-0' : '-translate-x-full'}" use:focusTrap={trapActive}>
  <nav class="flex flex-col h-full">
    <!-- Sidebar Header -->
    <div class="px-4 py-5" style="border-bottom: 1px solid hsl(var(--border) / 0.3);">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center" style="background: linear-gradient(135deg, #0f172a, #1e293b); border: 1px solid hsl(var(--primary) / 0.15);">
            <span class="text-white font-bold text-sm">PL</span>
          </div>
          <div>
            <h2 class="text-sm font-display font-bold text-foreground">Premier League</h2>
            <p class="text-xs text-muted-foreground">Oracle</p>
          </div>
        </div>
        <button
          class="p-1.5 rounded-lg hover:bg-muted transition-colors lg:hidden"
          on:click={closeSidebar}
          aria-label="Close menu"
        >
          <X class="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    </div>

    <!-- Main navigation -->
    <div class="flex-grow overflow-y-auto px-3 pt-4 space-y-1">
      <p class="px-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-accent"></span>Main</p>
      {#each navItems as item}
        <button
          class="nav-item {currentView === item.view ? 'nav-item-active' : ''}"
          on:click={() => handleNavClick(item.view)}
          aria-current={currentView === item.view ? 'page' : undefined}
        >
          <svelte:component this={item.icon} class="w-5 h-5 mr-3 flex-shrink-0" />
          <span>{item.name}</span>
        </button>
      {/each}

      <Separator class="my-3" />

      <p class="px-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-primary"></span>Betting</p>
      {#each bettingItems as item}
        <button
          class="nav-item {currentView === item.view ? 'nav-item-active' : ''}"
          on:click={() => handleNavClick(item.view)}
          aria-current={currentView === item.view ? 'page' : undefined}
        >
          <svelte:component this={item.icon} class="w-5 h-5 mr-3 flex-shrink-0" />
          <span>{item.name}</span>
        </button>
      {/each}
    </div>

    <!-- Bottom navigation -->
    <Separator />
    <div class="px-3 py-3 space-y-1">
      {#each bottomNavItems as item}
        <button
          class="nav-item {currentView === item.view ? 'nav-item-active' : ''}"
          on:click={() => handleNavClick(item.view)}
          aria-current={currentView === item.view ? 'page' : undefined}
        >
          <svelte:component this={item.icon} class="w-5 h-5 mr-3 flex-shrink-0" />
          <span>{item.name}</span>
        </button>
      {/each}
    </div>
  </nav>
</aside>

<!-- Sidebar backdrop — mobile only -->
{#if isOpen}
  <button
    class="fixed inset-0 bg-black/40 z-30 transition-opacity duration-300 lg:hidden cursor-default"
    on:click={closeSidebar}
    aria-label="Close sidebar"
    tabindex="-1"
  ></button>
{/if}
