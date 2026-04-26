<script lang="ts">
  import { Link } from 'svelte-routing';
  import type { SubTabDef } from '../../routes';

  export let tabs: SubTabDef[];
  export let active: string;
  export let basePath: string;
</script>

<div role="tablist" class="inline-flex rounded-md border border-border bg-bg-inset p-1">
  {#each tabs as tab (tab.slug)}
    <Link
      to={`${basePath}/${tab.slug}`}
      role="tab"
      aria-selected={tab.slug === active}
      class="px-3 py-1 rounded-sm text-label {tab.slug === active
        ? 'bg-card text-foreground'
        : 'text-text-muted hover:text-foreground'}"
    >
      {tab.label}
    </Link>
  {/each}
</div>
