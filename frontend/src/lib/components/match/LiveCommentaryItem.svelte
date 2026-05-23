<script lang="ts">
  import type { LiveCommentaryLine } from '$lib/fixtures/liveFeed';

  interface Props {
    line: LiveCommentaryLine;
  }

  const { line }: Props = $props();
</script>

<article
  class="kicker-commentary-item py-3 border-b border-rule last:border-b-0"
  data-commentary-item
  data-commentary-id={line.id}
>
  <div class="flex items-baseline gap-3">
    <span
      class="font-mono text-[12px] text-red font-bold w-[44px] shrink-0"
      data-commentary-minute
    >
      {line.minute}'
    </span>
    <p class="font-serif text-[15px] leading-snug text-ink" data-commentary-text>
      {line.text}
    </p>
  </div>
</article>

<style>
  .kicker-commentary-item {
    animation: kicker-commentary-fade 280ms ease-out both;
  }

  @keyframes kicker-commentary-fade {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .kicker-commentary-item {
      animation: none;
    }
  }
</style>
