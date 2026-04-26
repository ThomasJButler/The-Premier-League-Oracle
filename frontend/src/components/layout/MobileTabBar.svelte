<script lang="ts">
  import { Link } from 'svelte-routing';
  import { ROUTES } from '../../routes';
  import Icon from '../atoms/Icon.svelte';
  import type { IconName } from '../atoms/icons';

  // Phase 0d: 5 tabs — Today, Fixtures, Predictions, Oracle, More.
  // 'More' opens a bottom sheet via the parent-supplied onMore callback.
  const ICON_FOR: Record<string, IconName> = {
    '/today':       'home',
    '/fixtures':    'calendar',
    '/predictions': 'target',
    '/oracle':      'chart-line',
  };

  $: primary = ROUTES.filter((r) => r.inMobileBar);

  export let onMore: () => void = () => {};
</script>

<nav
  class="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around p-2 z-30"
  aria-label="Primary mobile navigation"
>
  {#each primary as item (item.path)}
    <Link
      to={item.path}
      class="flex flex-col items-center gap-1 px-2 py-1 text-body-sm text-text-muted"
    >
      <Icon name={ICON_FOR[item.path]} size={20} />
      {item.label}
    </Link>
  {/each}

  <button
    type="button"
    on:click={onMore}
    class="flex flex-col items-center gap-1 px-2 py-1 text-body-sm text-text-muted"
  >
    <Icon name="menu" size={20} />
    More
  </button>
</nav>
