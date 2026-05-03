<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    sub?: string;
    back?: boolean;
    backHref?: string;
    action?: Snippet;
  }

  const { title, sub, back = false, backHref = '/today', action }: Props = $props();
</script>

<header
  class="kicker-mheader bg-paper border-b border-ink flex items-end justify-between px-4 pt-3 pb-2"
  data-mobile-header
>
  <div class="flex items-end gap-2 min-w-0">
    {#if back}
      <a
        href={backHref}
        aria-label="Back"
        data-mobile-back
        class="font-mono text-[14px] leading-none text-ink-soft pb-1 pr-1"
      >
        ‹
      </a>
    {/if}
    <div class="min-w-0">
      {#if sub}
        <p
          class="font-sans text-[9px] tracking-[0.3em] uppercase font-bold text-red"
          data-mobile-sub
        >
          {sub}
        </p>
      {/if}
      <h1
        class="font-serif text-[22px] leading-none font-bold tracking-[-0.02em] truncate"
        data-mobile-title
      >
        {title}
      </h1>
    </div>
  </div>

  {#if action}
    <div class="flex items-center" data-mobile-action>
      {@render action()}
    </div>
  {/if}
</header>
