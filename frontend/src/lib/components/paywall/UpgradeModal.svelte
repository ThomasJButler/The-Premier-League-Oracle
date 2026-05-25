<script lang="ts">
  import { onMount } from 'svelte';
  import { entitlementsStore, TIERS, type Tier } from '$lib/stores/entitlementsStore';

  interface Props {
    open?: boolean;
    onClose?: () => void;
  }

  let { open = $bindable(false), onClose }: Props = $props();

  const activeTier = $derived($entitlementsStore);

  function close(): void {
    open = false;
    onClose?.();
  }

  function subscribe(tier: Tier): void {
    entitlementsStore.set(tier);
    close();
  }

  function handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && open) close();
  }

  onMount(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center px-4"
    data-upgrade-modal
    role="dialog"
    aria-modal="true"
    aria-labelledby="kicker-upgrade-title"
  >
    <button
      type="button"
      class="absolute inset-0 bg-ink/70"
      data-upgrade-backdrop
      aria-label="Close upgrade modal"
      onclick={close}
    ></button>

    <div
      class="relative z-10 w-full max-w-3xl bg-paper border border-ink p-6 lg:p-8 max-h-[90vh] overflow-y-auto"
      data-upgrade-panel
    >
      <div class="flex items-start justify-between mb-4">
        <div>
          <p
            class="font-sans text-[9px] tracking-[0.3em] font-bold text-red uppercase"
            data-upgrade-kicker
          >
            UPGRADE · THE KICKER
          </p>
          <h2
            id="kicker-upgrade-title"
            class="font-serif text-[28px] lg:text-[34px] font-bold leading-tight text-ink mt-1"
            data-upgrade-title
          >
            Pick a tier
          </h2>
          <p
            class="font-serif italic text-[13px] text-ink-dim mt-1"
            data-upgrade-standfirst
          >
            Mock-only at MVP — Stripe wires in at K2c. Selecting a tier sets it on
            this device.
          </p>
        </div>
        <button
          type="button"
          class="font-mono text-[18px] leading-none px-2 py-1 text-ink-dim hover:text-ink"
          data-upgrade-close
          aria-label="Close"
          onclick={close}
        >
          ✕
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4" data-upgrade-grid>
        {#each TIERS as tier (tier.id)}
          {@const isActive = tier.id === activeTier}
          <article
            class="kicker-tier-card flex flex-col border p-4 bg-paper-warm"
            class:is-active={isActive}
            data-upgrade-tier-card={tier.id}
            data-upgrade-active={isActive ? 'true' : 'false'}
          >
            <p
              class="font-sans text-[9px] tracking-[0.3em] font-bold text-red uppercase"
              data-upgrade-tier-id
            >
              {tier.id.toUpperCase()}
            </p>
            <p
              class="font-serif text-[22px] font-bold leading-tight text-ink mt-1"
              data-upgrade-tier-label
            >
              {tier.label}
            </p>
            <p
              class="font-mono text-[15px] font-bold text-ink mt-1"
              data-upgrade-tier-price
            >
              {tier.priceLine}
            </p>
            <p
              class="font-serif italic text-[12px] text-ink-soft mt-2"
              data-upgrade-tier-tagline
            >
              {tier.tagline}
            </p>
            <ul
              class="mt-3 flex flex-col gap-1 font-serif text-[12px] text-ink-soft flex-1"
              data-upgrade-tier-perks
            >
              {#each tier.perks as perk}
                <li class="flex gap-2">
                  <span aria-hidden="true">·</span>
                  <span>{perk}</span>
                </li>
              {/each}
            </ul>
            <button
              type="button"
              class="mt-4 font-sans text-[10px] tracking-[0.25em] font-bold uppercase bg-ink text-paper px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              data-upgrade-subscribe={tier.id}
              disabled={isActive}
              onclick={() => subscribe(tier.id)}
            >
              {isActive ? 'Current tier' : `Choose ${tier.label}`}
            </button>
          </article>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .kicker-tier-card {
    border-color: var(--rule);
  }
  .kicker-tier-card.is-active {
    border-color: var(--ink);
    outline: 2px solid var(--ink);
    outline-offset: -2px;
  }
</style>
