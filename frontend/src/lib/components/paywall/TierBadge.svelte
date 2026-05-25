<script lang="ts">
  import type { Tier } from '$lib/stores/entitlementsStore';
  import { TIERS } from '$lib/stores/entitlementsStore';

  interface Props {
    tier: Tier;
    size?: 'sm' | 'md';
  }

  const { tier, size = 'sm' }: Props = $props();

  const spec = $derived(TIERS.find((t) => t.id === tier) ?? TIERS[0]);

  const sizeClass = $derived(
    size === 'md' ? 'px-3 py-1 text-[11px]' : 'px-2 py-[3px] text-[9px]'
  );
</script>

<span
  class="kicker-tier-badge inline-flex items-center gap-1.5 font-sans font-bold tracking-[0.25em] uppercase border {sizeClass}"
  class:tier-touchline={tier === 'touchline'}
  class:tier-press-box={tier === 'press-box'}
  class:tier-print-run={tier === 'print-run'}
  data-tier-badge={tier}
  data-tier-size={size}
>
  <span aria-hidden="true" data-tier-dot></span>
  <span data-tier-label>{spec.label}</span>
</span>

<style>
  .kicker-tier-badge {
    border-color: var(--rule-strong);
    background: var(--paper-inset);
    color: var(--ink);
  }
  .kicker-tier-badge[data-tier-badge='press-box'] {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }
  .kicker-tier-badge[data-tier-badge='print-run'] {
    background: var(--red);
    color: var(--paper);
    border-color: var(--red);
  }
  [data-tier-dot] {
    width: 6px;
    height: 6px;
    background: currentColor;
    border-radius: 50%;
  }
</style>
