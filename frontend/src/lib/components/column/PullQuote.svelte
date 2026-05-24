<script lang="ts">
  interface Props {
    body: string;
    attribution: string;
  }

  const { body, attribution }: Props = $props();
</script>

<figure
  class="kicker-pullquote my-8 relative pt-6 pl-12 pr-4"
  data-pull-quote
>
  <span
    class="kicker-pullquote__rule absolute top-0 left-0 right-0"
    data-pullquote-rule
    aria-hidden="true"
  ></span>
  <span
    class="kicker-pullquote__glyph absolute left-0 top-3 font-serif font-extrabold text-red text-[72px] leading-none"
    aria-hidden="true"
  >&ldquo;</span>
  <blockquote
    class="font-serif italic text-ink text-[22px] leading-snug tracking-[-0.01em]"
    data-pullquote-body
  >
    {body}
  </blockquote>
  <figcaption
    class="mt-3 font-sans text-[10px] tracking-[0.3em] uppercase font-bold text-ink-dim"
    data-pullquote-attribution
  >
    — {attribution}
  </figcaption>
</figure>

<style>
  .kicker-pullquote__rule {
    height: 3px;
    background: var(--red);
  }
</style>
