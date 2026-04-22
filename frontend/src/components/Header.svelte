<script lang="ts">
  import { Sun, Moon, Github, Menu } from 'lucide-svelte';
  import { isDarkMode } from '../stores/theme';

  export let toggleSidebar: () => void;
  export let isSidebarOpen = false;
</script>

<header class="header-container">
  <div class="flex items-center gap-3">
    <button
      on:click={toggleSidebar}
      class="p-2 rounded-lg hover:bg-muted transition-colors"
      aria-label="Toggle menu"
      aria-expanded={isSidebarOpen}
    >
      <Menu class="w-5 h-5 text-muted-foreground" />
    </button>
    <div class="flex items-center gap-2">
      <!-- Mini trophy logo — matches the SidebarNav logo (same gradient
           palette, scaled to 24px for the header). Rendered inline so it
           never requires a second paint and stays crisp at any density. -->
      <svg viewBox="0 0 36 36" class="w-6 h-6" aria-hidden="true" role="img" focusable="false">
        <defs>
          <linearGradient id="header-logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#10b981" />
            <stop offset="55%" stop-color="#059669" />
            <stop offset="100%" stop-color="#064e3b" />
          </linearGradient>
          <linearGradient id="header-logo-trophy" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fde68a" />
            <stop offset="100%" stop-color="#f59e0b" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="36" height="36" rx="8" fill="url(#header-logo-bg)" />
        <path d="M13 10 H23 V16 Q23 20 19.5 20.8 V24 H22 V26 H14 V24 H16.5 V20.8 Q13 20 13 16 Z" fill="url(#header-logo-trophy)" />
        <path d="M13 12 H10 V15 Q10 17.5 13 17.5 M23 12 H26 V15 Q26 17.5 23 17.5" fill="none" stroke="url(#header-logo-trophy)" stroke-width="1.4" stroke-linecap="round" />
        <rect x="11.5" y="26" width="13" height="1.6" rx="0.5" fill="url(#header-logo-trophy)" />
      </svg>
      <span class="text-base font-display font-bold text-foreground hidden sm:inline">
        The Premier League Oracle
      </span>
      <span class="text-base font-display font-bold text-foreground sm:hidden">
        The Oracle
      </span>
    </div>
  </div>

  <div class="flex items-center gap-2">
    <a
      href="https://github.com/ThomasJButler/The-Premier-League-Oracle"
      target="_blank"
      rel="noopener noreferrer"
      class="p-2 rounded-lg hover:bg-muted transition-colors"
      aria-label="GitHub Repository"
    >
      <Github class="w-5 h-5 text-muted-foreground" />
    </a>

    <button
      on:click={isDarkMode.toggle}
      class="p-2 rounded-lg hover:bg-muted transition-colors"
      aria-label="Toggle dark mode"
    >
      {#if $isDarkMode}
        <Sun class="w-5 h-5 text-muted-foreground" />
      {:else}
        <Moon class="w-5 h-5 text-muted-foreground" />
      {/if}
    </button>
  </div>
</header>
