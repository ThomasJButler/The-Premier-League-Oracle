<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    attribution: string;
    children: Snippet;
  }

  const { attribution, children }: Props = $props();
</script>

<figure
  class="kicker-pundit-quote my-5 relative pl-6 pr-4 border-l-[3px] border-red"
  data-pundit-quote
>
  <span
    class="kicker-pundit-quote__glyph absolute -left-2 top-0 font-serif font-extrabold text-red text-[58px] leading-none"
    aria-hidden="true"
  >&ldquo;</span>
  <blockquote
    class="pt-3 pl-3 font-serif italic text-ink text-[22px] leading-snug tracking-[-0.01em]"
    data-pundit-quote-body
  >
    {@render children()}
  </blockquote>
  <figcaption
    class="mt-2 pl-3 font-sans text-[10px] tracking-[0.25em] uppercase font-bold text-ink-dim"
    data-pundit-quote-attribution
  >
    — {attribution}
  </figcaption>
</figure>
