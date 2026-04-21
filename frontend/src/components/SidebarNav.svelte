<script lang="ts">
  import { LayoutDashboard, List, BarChart2, BarChart3, History, Settings, Calculator, HelpCircle, Trophy, Tv, Table, X, MessageCircle, Search, Layers, Calendar, CalendarCheck, Zap } from 'lucide-svelte';
  import { Separator } from '$lib/components/ui/separator';
  import { createEventDispatcher } from 'svelte';

  export let currentView: string;
  export let showCloseButton = false;

  const dispatch = createEventDispatcher();

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, view: 'Dashboard' },
    { name: 'Standings', icon: Table, view: 'Standings' },
    { name: 'Live Matches', icon: Tv, view: 'Live Matches' },
    { name: 'Matches', icon: List, view: 'Matches' },
    { name: 'Predictions', icon: BarChart3, view: 'Predictions' },
    { name: 'Oracle Chat', icon: MessageCircle, view: 'Oracle Chat' },
    { name: 'Top Scorers', icon: Trophy, view: 'Top Scorers' },
    { name: 'Season Stats', icon: BarChart2, view: 'Season Stats' },
    { name: 'Season Timeline', icon: Calendar, view: 'Season Timeline' },
    { name: 'Season Predictions', icon: CalendarCheck, view: 'Season Predictions' },
  ];

  const bettingItems = [
    { name: 'Kelly Calculator', icon: Calculator, view: 'Kelly Calculator' },
    { name: 'Suggested Bets', icon: Zap, view: 'Suggested Bets' },
    { name: 'Value Scanner', icon: Search, view: 'Value Scanner' },
    { name: 'Accumulators', icon: Layers, view: 'Accumulators' },
    { name: 'Betting History', icon: History, view: 'Betting History' },
  ];

  const bottomNavItems = [
    { name: 'Help', icon: HelpCircle, view: 'Help' },
    { name: 'Settings', icon: Settings, view: 'Settings' },
  ];

  function handleNavClick(view: string) {
    dispatch('navigate', { view });
  }
</script>

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
      {#if showCloseButton}
        <button
          class="p-1.5 rounded-lg hover:bg-muted transition-colors"
          on:click={() => dispatch('close')}
          aria-label="Close menu"
        >
          <X class="w-5 h-5 text-muted-foreground" />
        </button>
      {/if}
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
        title={item.name}
      >
        <svelte:component this={item.icon} class="w-5 h-5 mr-3 flex-shrink-0" />
        <span class="truncate">{item.name}</span>
      </button>
    {/each}

    <Separator class="my-3" />

    <p class="px-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-primary"></span>Betting</p>
    {#each bettingItems as item}
      <button
        class="nav-item {currentView === item.view ? 'nav-item-active' : ''}"
        on:click={() => handleNavClick(item.view)}
        aria-current={currentView === item.view ? 'page' : undefined}
        title={item.name}
      >
        <svelte:component this={item.icon} class="w-5 h-5 mr-3 flex-shrink-0" />
        <span class="truncate">{item.name}</span>
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
        title={item.name}
      >
        <svelte:component this={item.icon} class="w-5 h-5 mr-3 flex-shrink-0" />
        <span class="truncate">{item.name}</span>
      </button>
    {/each}
  </div>
</nav>
