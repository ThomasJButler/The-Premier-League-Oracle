<script lang="ts">
  import type { Snippet } from 'svelte';
  import { entitlementsStore, hasAccess, type Tier } from '$lib/stores/entitlementsStore';

  interface Props {
    required: Tier;
    children: Snippet;
    locked?: Snippet;
  }

  const { required, children, locked }: Props = $props();

  const activeTier = $derived($entitlementsStore);
  const allowed = $derived(hasAccess(activeTier, required));
</script>

{#if allowed}
  <div data-tier-gate={required} data-tier-gate-state="allowed">
    {@render children()}
  </div>
{:else}
  <div data-tier-gate={required} data-tier-gate-state="locked">
    {#if locked}
      {@render locked()}
    {/if}
  </div>
{/if}
