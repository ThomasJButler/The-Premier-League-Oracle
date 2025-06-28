<script lang="ts">
  import { LayoutDashboard, List, BarChart3, History, Bot, Settings, LogOut } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let currentView: string;
  export let isOpen: boolean;

  const dispatch = createEventDispatcher();

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, view: 'Dashboard' },
    { name: 'Matches', icon: List, view: 'Matches' },
    { name: 'Predictions', icon: BarChart3, view: 'Predictions' },
    { name: 'Betting History', icon: History, view: 'Betting History' },
    { name: 'AI Assistant', icon: Bot, view: 'AI Assistant' },
  ];

  const bottomNavItems = [
    { name: 'Settings', icon: Settings, view: 'Settings' },
    { name: 'Logout', icon: LogOut, view: 'Logout' },
  ];

  function handleNavClick(view: string) {
    dispatch('navigate', { view });
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      isOpen = false;
    }
  }
</script>

<aside class="sidebar-container {isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0">
  <nav class="flex flex-col h-full">
    <div class="flex-grow space-y-2 pt-4">
      {#each navItems as item}
        <button
          class="nav-item {currentView === item.view ? 'nav-item-active' : ''}"
          on:click={() => handleNavClick(item.view)}
        >
          <svelte:component this={item.icon} class="w-5 h-5 mr-3 flex-shrink-0" />
          <span>{item.name}</span>
        </button>
      {/each}
    </div>
    <div class="pb-4 space-y-2">
      {#each bottomNavItems as item}
        <button
          class="nav-item {currentView === item.view ? 'nav-item-active' : ''}"
          on:click={() => handleNavClick(item.view)}
        >
          <svelte:component this={item.icon} class="w-5 h-5 mr-3 flex-shrink-0" />
          <span>{item.name}</span>
        </button>
      {/each}
    </div>
  </nav>
</aside>

<!-- Sidebar backdrop for mobile -->
{#if isOpen}
  <div class="fixed inset-0 bg-black/30 z-30 md:hidden" on:click={() => isOpen = false} aria-hidden="true"></div>
{/if}