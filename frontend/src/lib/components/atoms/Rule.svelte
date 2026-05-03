<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    kicker?: string;
    action?: string;
    children?: Snippet;
  }

  const { title, kicker, action, children }: Props = $props();
</script>

<header class="kicker-rule grid items-end gap-3 border-b border-ink pb-2 mb-4" data-rule>
  <div>
    {#if kicker}
      <p class="font-sans text-[10px] tracking-[0.3em] uppercase text-red font-bold mb-1" data-rule-kicker>
        {kicker}
      </p>
    {/if}
    <h2 class="font-serif text-[28px] leading-none font-bold tracking-[-0.02em] text-ink" data-rule-title>
      {title}
    </h2>
  </div>
  {#if action || children}
    <div class="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-soft justify-self-end" data-rule-action>
      {#if children}
        {@render children()}
      {:else if action}
        {action}
      {/if}
    </div>
  {/if}
</header>

<style>
  .kicker-rule {
    grid-template-columns: 1fr auto;
  }
</style>
