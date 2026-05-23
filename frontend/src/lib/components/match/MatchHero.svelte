<script lang="ts">
  import type { Fixture } from '../../../types/redesign';

  interface Props {
    fixture: Fixture;
    kind?: 'preview' | 'live';
  }

  const { fixture, kind = 'preview' }: Props = $props();

  const kickoffDate = $derived(
    new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/London'
    }).format(new Date(fixture.utcDate)).toUpperCase()
  );

  const kickoffTime = $derived(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London'
    }).format(new Date(fixture.utcDate))
  );

  const isLive = $derived(kind === 'live' || fixture.status === 'LIVE');
  const isFinished = $derived(fixture.status === 'FINISHED');
  const hasScore = $derived(Boolean(fixture.score));

  const statusLabel = $derived.by(() => {
    if (isLive) return typeof fixture.minute === 'number' ? `LIVE · ${fixture.minute}'` : 'LIVE';
    if (isFinished) return 'FULL TIME';
    if (fixture.status === 'POSTPONED') return 'POSTPONED';
    if (fixture.status === 'CANCELLED') return 'CANCELLED';
    return 'KICK-OFF';
  });
</script>

<section
  class="kicker-match-hero relative bg-paper-warm border border-ink"
  data-match-hero
  data-match-hero-kind={kind}
  data-match-hero-id={fixture.id}
>
  <div class="px-8 py-7">
    <div
      class="flex items-center justify-between text-[10px] tracking-[0.3em] font-bold uppercase pb-3 mb-5 border-b border-ink"
      data-hero-meta
    >
      <span class="text-red" data-hero-status>{statusLabel}</span>
      <span class="text-ink-dim" data-hero-competition>
        {fixture.competition} · GW {fixture.gameweek}
      </span>
      <span class="font-mono text-ink-dim" data-hero-kickoff>
        {kickoffDate} · {kickoffTime}
      </span>
    </div>

    <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-8" data-hero-teams>
      <div class="text-right">
        <div
          class="font-serif font-bold text-[56px] leading-none tracking-[-0.03em] text-ink"
          data-hero-home-name
        >
          {fixture.home.name}
        </div>
        <div class="mt-2 font-sans text-[11px] tracking-[0.3em] font-bold uppercase text-ink-dim">
          HOME · {fixture.home.abbr}
        </div>
      </div>

      <div class="flex flex-col items-center min-w-[140px]" data-hero-centre>
        {#if hasScore && fixture.score}
          <div
            class="font-mono font-extrabold text-[72px] leading-none tracking-[-0.05em] text-ink"
            data-hero-score
          >
            {fixture.score.home}<span class="text-ink-faint text-[40px] px-3">·</span>{fixture.score.away}
          </div>
          <div class="mt-2 font-sans text-[10px] tracking-[0.3em] font-bold text-ink-dim">
            {isLive ? 'LIVE SCORE' : 'FINAL SCORE'}
          </div>
        {:else}
          <div
            class="font-mono font-extrabold text-[56px] leading-none tracking-[-0.05em] text-ink"
            data-hero-versus
          >
            v
          </div>
          <div class="mt-2 font-sans text-[10px] tracking-[0.3em] font-bold text-ink-dim">
            FIXTURE
          </div>
        {/if}
      </div>

      <div class="text-left">
        <div
          class="font-serif font-bold text-[56px] leading-none tracking-[-0.03em] text-ink"
          data-hero-away-name
        >
          {fixture.away.name}
        </div>
        <div class="mt-2 font-sans text-[11px] tracking-[0.3em] font-bold uppercase text-ink-dim">
          AWAY · {fixture.away.abbr}
        </div>
      </div>
    </div>

    {#if fixture.venue}
      <div
        class="mt-6 pt-4 border-t border-rule font-serif italic text-[13px] text-ink-dim text-center"
        data-hero-venue
      >
        {fixture.venue}
      </div>
    {/if}
  </div>
</section>
