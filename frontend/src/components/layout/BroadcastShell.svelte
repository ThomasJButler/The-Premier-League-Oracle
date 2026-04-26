<script lang="ts">
  import { Link } from 'svelte-routing';
  import { ROUTES } from '../../routes';
  import Icon from '../atoms/Icon.svelte';
  import { isDarkMode } from '../../stores/theme';

  $: sidebarItems = ROUTES.filter((r) => r.inSidebar);

  function toggleTheme() {
    isDarkMode.toggle();
  }
</script>

<div class="flex h-screen bg-background text-foreground overflow-hidden">
  <aside class="hidden lg:flex w-64 flex-col bg-card border-r border-border">
    <div class="p-4 border-b border-border">
      <span class="text-display">Oracle</span>
    </div>

    <nav class="flex-1 overflow-y-auto p-2" aria-label="Primary navigation">
      {#each sidebarItems as item (item.path)}
        <Link
          to={item.path}
          class="flex items-center gap-3 px-3 py-2 rounded-md text-label text-text-muted hover:bg-surface-hover hover:text-foreground"
        >
          {item.label}
        </Link>
      {/each}
    </nav>

    <button
      type="button"
      on:click={toggleTheme}
      class="m-2 p-3 rounded-md hover:bg-surface-hover text-label flex items-center gap-2"
    >
      <Icon name={$isDarkMode ? 'circle' : 'dot'} size={16} />
      Toggle theme
    </button>
  </aside>

  <main
    class="flex-1 overflow-y-auto p-4 lg:p-8 pb-20 lg:pb-8"
    aria-label="Premier League Oracle content"
  >
    <slot />
  </main>
</div>
