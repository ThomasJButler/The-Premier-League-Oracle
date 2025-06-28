<script lang="ts">
  import Header from './components/Header.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import MobileNav from './components/MobileNav.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import MatchList from './components/MatchList.svelte';
  import Predictions from './components/Predictions.svelte';
  import BettingHistory from './components/BettingHistory.svelte';
  import AiAssistant from './components/AiAssistant.svelte';
  import LiveTicker from './components/LiveTicker.svelte';
  import { onMount } from 'svelte';

  let currentView = 'Dashboard'; // Default view
  let isSidebarOpen = true;
  let isDarkMode = false;

  function navigate(event: CustomEvent<{ view: string }>) {
    currentView = event.detail.view;
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }

  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  onMount(() => {
    // Check local storage for theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      isDarkMode = true;
      document.documentElement.classList.add('dark');
    } else {
      isDarkMode = false;
      document.documentElement.classList.remove('dark');
    }

    // Optional: Adjust sidebar based on screen size initially
    if (window.innerWidth < 768) { // Example breakpoint (Tailwind's md)
      isSidebarOpen = false;
    }
  });

</script>

<!-- Animated Background with Particles -->
<div class="animated-bg">
  {#each Array(15) as _, i}
    <div 
      class="particle" 
      style="
        left: {Math.random() * 100}%;
        width: {Math.random() * 4 + 2}px;
        height: {Math.random() * 4 + 2}px;
        animation-delay: {Math.random() * 20}s;
        animation-duration: {Math.random() * 20 + 20}s;
      "
    ></div>
  {/each}
</div>

<div class="flex h-screen bg-white/90 dark:bg-slate-950/90 text-slate-800 dark:text-slate-200 overflow-hidden relative">
  <Sidebar bind:isOpen={isSidebarOpen} currentView={currentView} on:navigate={navigate} />

  <div class="flex-1 flex flex-col overflow-hidden">
    <Header toggleSidebar={toggleSidebar} on:toggleDarkMode={toggleDarkMode} />
    <LiveTicker />

    <main class="flex-1 overflow-x-hidden overflow-y-auto bg-white dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <!-- Conditional Rendering based on currentView -->
      {#if currentView === 'Dashboard'}
        <Dashboard />
      {:else if currentView === 'Matches'}
        <MatchList />
      {:else if currentView === 'Predictions'}
        <Predictions />
      {:else if currentView === 'Betting History'}
        <BettingHistory />
      {:else if currentView === 'AI Assistant'}
        <AiAssistant />
      {/if}
    </main>
  </div>
  
  <!-- Mobile Navigation -->
  <MobileNav {currentView} on:navigate={navigate} />
</div>

<style global lang="postcss">
  /* Add any component-specific styles here if needed, though most should be handled by Tailwind */
</style>