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
  import SeasonStats from './components/SeasonStats.svelte';
  import KellyCalculator from './components/betting/KellyCalculator.svelte';
  import ValueBets from './components/betting/ValueBets.svelte';
  import Settings from './components/Settings.svelte';
  import { onMount } from 'svelte';

  let currentView = 'Dashboard'; // Default view
  let isSidebarOpen = true;
  let isTransitioning = false;
  
  function navigate(event: CustomEvent<{ view: string }>) {
    if (event.detail.view === currentView) return;
    
    isTransitioning = true;
    setTimeout(() => {
      currentView = event.detail.view;
      setTimeout(() => {
        isTransitioning = false;
      }, 50);
    }, 200);
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }

  onMount(() => {
    // Adjust sidebar based on screen size initially
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
  <Sidebar bind:isOpen={isSidebarOpen} currentView={currentView} on:navigate={navigate} on:closeSidebar={() => isSidebarOpen = false} />

  <div class="flex-1 flex flex-col overflow-hidden">
    <Header toggleSidebar={toggleSidebar} />
    <LiveTicker />

    <main class="flex-1 overflow-x-hidden overflow-y-auto bg-white dark:bg-slate-950 p-4 sm:p-6 lg:p-8 relative">
      <!-- Page transition overlay -->
      {#if isTransitioning}
        <div class="absolute inset-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm z-50 transition-opacity duration-200 animate-fadeIn"></div>
      {/if}
      
      <!-- Page content with smooth transitions -->
      <div class="page-content" class:transitioning={isTransitioning}>
        {#if currentView === 'Dashboard'}
          <Dashboard />
        {:else if currentView === 'Matches'}
          <MatchList />
        {:else if currentView === 'Predictions'}
          <Predictions />
        {:else if currentView === 'Kelly Calculator'}
          <KellyCalculator />
        {:else if currentView === 'Value Bets'}
          <ValueBets />
        {:else if currentView === 'Betting History'}
          <BettingHistory />
        {:else if currentView === 'AI Assistant'}
          <AiAssistant />
        {:else if currentView === 'Season Stats'}
          <SeasonStats />
        {:else if currentView === 'Settings'}
          <Settings />
        {/if}
      </div>
    </main>
  </div>
  
  <!-- Mobile Navigation -->
  <MobileNav {currentView} on:navigate={navigate} />
  
  <!-- Floating Action Buttons -->
  <div class="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
    <!-- Quick Prediction FAB -->
    <button 
      class="fab-button group"
      on:click={() => navigate({detail: {view: 'Predictions'}} as CustomEvent)}
      aria-label="Quick Predictions"
    >
      <div class="fab-icon">⚡</div>
      <div class="fab-tooltip">Quick Predictions</div>
    </button>
    
    <!-- AI Assistant FAB -->
    <button 
      class="fab-button group"
      on:click={() => navigate({detail: {view: 'AI Assistant'}} as CustomEvent)}
      aria-label="AI Assistant"
    >
      <div class="fab-icon">🤖</div>
      <div class="fab-tooltip">AI Assistant</div>
    </button>
    
    <!-- Live Status Indicator -->
    <div class="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg">
      <div class="w-3 h-3 bg-white rounded-full live-pulse"></div>
    </div>
  </div>
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