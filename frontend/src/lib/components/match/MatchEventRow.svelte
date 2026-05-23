<script lang="ts">
  import { eventGlyph, type LiveEvent } from '$lib/fixtures/liveFeed';

  interface Props {
    event: LiveEvent;
  }

  const { event }: Props = $props();
</script>

<li
  class="py-2 grid grid-cols-[44px_28px_56px_1fr] items-baseline gap-3 border-b border-rule last:border-b-0"
  data-event-row
  data-event-type={event.type}
  data-event-side={event.side}
>
  <span class="font-mono text-[12px] text-ink-dim" data-event-minute>
    {event.minute}'
  </span>
  <span class="font-sans text-[14px] text-ink leading-none" data-event-glyph aria-hidden="true">
    {eventGlyph(event.type)}
  </span>
  <span class="font-sans text-[10px] tracking-[0.2em] font-bold uppercase text-ink-dim" data-event-team>
    {event.teamAbbr}
  </span>
  <span class="font-serif text-[14px] text-ink" data-event-body>
    <strong class="font-bold">{event.player}</strong>
    {#if event.detail}
      <span class="text-ink-dim"> — {event.detail}</span>
    {/if}
  </span>
</li>
