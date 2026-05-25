<script lang="ts">
  import TierGate from './TierGate.svelte';
  import type { Tier } from '$lib/stores/entitlementsStore';

  interface Props {
    required: Tier;
    allowedText: string;
    lockedText: string;
  }

  const { required, allowedText, lockedText }: Props = $props();
</script>

<TierGate {required}>
  <span data-harness-allowed>{allowedText}</span>
  {#snippet locked()}
    <span data-harness-locked>{lockedText}</span>
  {/snippet}
</TierGate>
