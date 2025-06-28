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

  // Initialize theme based on saved preference
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      isDarkMode = true;
      document.documentElement.classList.add('dark');
    }
  }
</script>

<header class="header-container">
  <div class="flex items-center">
    <button on:click={toggleSidebar} class="btn btn-ghost btn-icon md:hidden mr-2">
      <Menu class="w-6 h-6" />
    </button>
    <div class="flex items-center space-x-2">
      <img src="/vite.svg" alt="Logo" class="h-8 w-8" />
      <span class="text-xl font-bold gradient-text">Premier League Oracle</span>
    </div>
  </div>

  <div class="flex items-center space-x-3">
    <a href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-icon" aria-label="GitHub Repository">
      <Github class="w-5 h-5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" />
    </a>
    <button on:click={toggleTheme} class="btn btn-ghost btn-icon" aria-label="Toggle theme">
      {#if isDarkMode}
        <Sun class="w-5 h-5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" />
      {:else}
        <Moon class="w-5 h-5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" />
      {/if}
    </button>
    <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary dark:text-primary-light">
      TB <!-- User Initials -->
    </div>
  </div>
</header>