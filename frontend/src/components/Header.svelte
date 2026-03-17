<script lang="ts">
  import { Sun, Moon, Github, Menu } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let toggleSidebar: () => void;

  const dispatch = createEventDispatcher();

  let isDarkMode = false;

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    dispatch('toggleDarkMode');
  }

  // Initialise theme from saved preference
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      isDarkMode = true;
      document.documentElement.classList.add('dark');
    }
  }
</script>

<header class="header-container">
  <div class="flex items-center gap-3">
    <button
      on:click={toggleSidebar}
      class="p-2 rounded-lg hover:bg-muted transition-colors"
      aria-label="Toggle menu"
    >
      <Menu class="w-5 h-5 text-muted-foreground" />
    </button>
    <span class="text-lg font-display font-bold text-foreground hidden sm:inline">
      Premier League Oracle
    </span>
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
      on:click={toggleTheme}
      class="p-2 rounded-lg hover:bg-muted transition-colors"
      aria-label="Toggle dark mode"
    >
      {#if isDarkMode}
        <Sun class="w-5 h-5 text-muted-foreground" />
      {:else}
        <Moon class="w-5 h-5 text-muted-foreground" />
      {/if}
    </button>
  </div>
</header>
