<script lang="ts">
  import { LayoutDashboard, Tv, BarChart3, Table, MoreHorizontal, List, Calculator, History, Trophy, HelpCircle, Settings, BarChart2, X, MessageCircle } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let currentView: string;

  const dispatch = createEventDispatcher();

  let isMoreOpen = false;

  const primaryItems = [
    { name: 'Dashboard', icon: LayoutDashboard, view: 'Dashboard' },
    { name: 'Live', icon: Tv, view: 'Live Matches' },
    { name: 'Predictions', icon: BarChart3, view: 'Predictions' },
    { name: 'Standings', icon: Table, view: 'Standings' },
  ];

  const moreItems = [
    { name: 'Matches', icon: List, view: 'Matches' },
    { name: 'Oracle Chat', icon: MessageCircle, view: 'Oracle Chat' },
    { name: 'Top Scorers', icon: Trophy, view: 'Top Scorers' },
    { name: 'Kelly Calculator', icon: Calculator, view: 'Kelly Calculator' },
    { name: 'Season Stats', icon: BarChart2, view: 'Season Stats' },
    { name: 'Betting History', icon: History, view: 'Betting History' },
    { name: 'Settings', icon: Settings, view: 'Settings' },
    { name: 'Help', icon: HelpCircle, view: 'Help' },
  ];

  function handleNavClick(view: string) {
    dispatch('navigate', { view });
    isMoreOpen = false;
  }

  // Check if current view is in the "more" menu
  $: isMoreActive = moreItems.some(item => item.view === currentView);
</script>

<!-- More menu overlay -->
{#if isMoreOpen}
  <button
    class="fixed inset-0 bg-black/40 z-40 cursor-default"
    on:click={() => isMoreOpen = false}
    aria-label="Close menu"
    tabindex="-1"
  ></button>
  <div class="fixed bottom-16 left-0 right-0 z-50 px-4 pb-2 animate-slide-in-up">
    <div class="bg-card border border-border rounded-xl shadow-xl p-3">
      <div class="flex items-center justify-between mb-2 px-1">
        <span class="text-sm font-display font-semibold text-foreground">More</span>
        <button
          class="p-1 rounded-md hover:bg-muted"
          on:click={() => isMoreOpen = false}
          aria-label="Close"
        >
          <X class="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <div class="grid grid-cols-4 gap-1">
        {#each moreItems as item}
          <button
            class="flex flex-col items-center justify-center py-3 px-1 rounded-lg text-xs font-medium transition-colors {currentView === item.view ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'}"
            on:click={() => handleNavClick(item.view)}
          >
            <svelte:component this={item.icon} class="w-5 h-5 mb-1" />
            <span class="truncate w-full text-center">{item.name}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- Bottom nav bar -->
<nav class="mobile-nav">
  <div class="flex justify-around items-center">
    {#each primaryItems as item}
      <button
        class="mobile-nav-item {currentView === item.view ? 'mobile-nav-item-active' : ''}"
        on:click={() => handleNavClick(item.view)}
        aria-current={currentView === item.view ? 'page' : undefined}
      >
        <svelte:component this={item.icon} class="w-5 h-5 mb-1" />
        <span>{item.name}</span>
      </button>
    {/each}
    <button
      class="mobile-nav-item {isMoreActive ? 'mobile-nav-item-active' : ''}"
      on:click={() => isMoreOpen = !isMoreOpen}
      aria-label="More options"
    >
      <MoreHorizontal class="w-5 h-5 mb-1" />
      <span>More</span>
    </button>
  </div>
</nav>
