<script lang="ts">
  import { LayoutDashboard, List, BarChart2, BarChart3, History, Settings, Calculator, HelpCircle, Trophy, Tv, Table, X, MessageCircle, Search, Layers, Calendar, Zap } from 'lucide-svelte';
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
        <!-- Logo: inline SVG trophy with emerald→gold gradient. Scales cleanly
             at 36px, readable in both themes, no separate asset file needed. -->
        <div class="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm" style="border: 1px solid hsl(var(--primary) / 0.25);">
          <svg viewBox="0 0 36 36" class="w-9 h-9" aria-hidden="true" role="img" focusable="false">
            <defs>
              <linearGradient id="pl-logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#10b981" />
                <stop offset="55%" stop-color="#059669" />
                <stop offset="100%" stop-color="#064e3b" />
              </linearGradient>
              <linearGradient id="pl-logo-trophy" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#fde68a" />
                <stop offset="100%" stop-color="#f59e0b" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="36" height="36" rx="8" fill="url(#pl-logo-bg)" />
            <!-- Trophy cup body -->
            <path d="M13 10 H23 V16 Q23 20 19.5 20.8 V24 H22 V26 H14 V24 H16.5 V20.8 Q13 20 13 16 Z" fill="url(#pl-logo-trophy)" />
            <!-- Trophy handles -->
            <path d="M13 12 H10 V15 Q10 17.5 13 17.5 M23 12 H26 V15 Q26 17.5 23 17.5" fill="none" stroke="url(#pl-logo-trophy)" stroke-width="1.4" stroke-linecap="round" />
            <!-- Base plinth -->
            <rect x="11.5" y="26" width="13" height="1.6" rx="0.5" fill="url(#pl-logo-trophy)" />
          </svg>
        </div>
        <div>
          <h2 class="text-sm font-display font-bold text-foreground leading-tight">The Premier League</h2>
          <p class="text-xs text-muted-foreground leading-tight">Oracle</p>
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
