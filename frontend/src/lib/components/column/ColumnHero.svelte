<script lang="ts">
  import type { HeadlineSegment } from '$lib/fixtures/columns';

  interface Props {
    eyebrow: string;
    headline: HeadlineSegment[];
    bylineName: string;
    bylineSub: string;
    readTimeMinutes: number;
    dateline: string;
  }

  const {
    eyebrow,
    headline,
    bylineName,
    bylineSub,
    readTimeMinutes,
    dateline
  }: Props = $props();

  const monogram = $derived(bylineName.charAt(0).toUpperCase());
</script>

<header class="kicker-column-hero" data-column-hero>
  <p
    class="font-mono text-[10px] tracking-[0.3em] uppercase font-bold text-red mb-3"
    data-column-eyebrow
  >
    {eyebrow}
  </p>

  <h1
    class="font-serif font-bold text-ink leading-[0.95] tracking-[-0.02em] text-[44px] sm:text-[54px] lg:text-[64px]"
    data-column-headline
  >
    {#each headline as seg, i (i)}
      {#if seg.emphasis}
        <em
          class="kicker-column-hero__em not-italic font-extrabold"
          data-headline-em
        >{seg.text}</em>
      {:else}
        <span>{seg.text}</span>
      {/if}
    {/each}
  </h1>

  <div
    class="mt-6 pt-4 border-t border-rule grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 sm:gap-y-0"
    data-column-byline
  >
    <span
      class="kicker-column-hero__monogram inline-flex items-center justify-center font-serif font-extrabold text-paper text-[20px]"
      data-byline-monogram
      aria-hidden="true"
    >{monogram}</span>
    <div class="min-w-0">
      <p
        class="font-serif text-[16px] leading-tight font-bold text-ink truncate"
        data-byline-name
      >{bylineName}</p>
      <p
        class="font-serif italic text-[12px] text-ink-soft truncate"
        data-byline-sub
      >{bylineSub}</p>
    </div>
    <div
      class="col-span-2 sm:col-span-1 text-left sm:text-right font-mono text-[10px] tracking-[0.25em] uppercase font-bold text-ink-dim"
      data-byline-meta
    >
      <p data-byline-readtime>{readTimeMinutes} min read</p>
      <p class="mt-1 text-ink-soft" data-byline-dateline>{dateline}</p>
    </div>
  </div>
</header>

<style>
  .kicker-column-hero__em {
    color: var(--persona-accent, var(--red));
  }
  .kicker-column-hero__monogram {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--persona-accent, var(--red));
  }
</style>
