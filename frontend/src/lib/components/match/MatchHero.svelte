<script lang="ts">
  import type { Fixture } from '../../../types/redesign';
  import { displayTeam } from '$lib/utils/displayTeam';

  interface Props {
    fixture: Fixture;
    kind?: 'preview' | 'live';
  }

  const { fixture, kind = 'preview' }: Props = $props();

  const homeName = $derived(displayTeam(fixture.home.name));
  const awayName = $derived(displayTeam(fixture.away.name));

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
  <div class="hidden lg:block px-8 py-7" data-hero-desktop>
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
          {homeName}
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
          {awayName}
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

  <div class="lg:hidden px-4 py-5" data-hero-mobile>
    <div class="flex items-center justify-between mb-3">
      <span
        class="inline-flex items-center gap-1.5 bg-ink px-2 py-1 text-[9px] tracking-[0.3em] font-bold uppercase"
        style="color: var(--paper);"
      >
        {statusLabel}
      </span>
      <span class="font-mono text-[9px] tracking-[0.2em] font-bold text-ink-dim uppercase">
        {fixture.competition} · GW {fixture.gameweek}
      </span>
    </div>

    <div class="text-center font-sans text-[10px] tracking-[0.25em] font-bold uppercase text-red mb-2">
      {#if hasScore && fixture.score}
        {homeName} {fixture.score.home} — {fixture.score.away} {awayName}
      {:else}
        {homeName} v {awayName}
      {/if}
    </div>

    <div class="text-center mb-4">
      {#if hasScore && fixture.score}
        <div class="font-mono font-extrabold text-[64px] leading-none tracking-[-0.05em] text-ink">
          {fixture.score.home} — {fixture.score.away}
        </div>
        <div class="mt-1 font-sans text-[9px] tracking-[0.3em] font-bold text-ink-dim">
          {isLive ? 'LIVE SCORE' : 'FINAL SCORE'}
        </div>
      {:else}
        <div class="font-mono font-extrabold text-[56px] leading-none tracking-[-0.05em] text-ink">
          v
        </div>
        <div class="mt-1 font-sans text-[9px] tracking-[0.3em] font-bold text-ink-dim">
          FIXTURE
        </div>
      {/if}
    </div>

    <div class="grid grid-cols-2 border-y border-ink divide-x divide-ink">
      <div class="px-3 py-4 flex flex-col items-center text-center">
        <div
          class="w-14 h-14 rounded-full flex items-center justify-center font-serif font-bold text-[22px] mb-2"
          style="background: var(--persona-accent, var(--red)); color: var(--paper);"
        >
          {fixture.home.abbr.charAt(0)}
        </div>
        <div class="font-serif text-[17px] leading-tight text-ink">
          {homeName}
        </div>
        <div class="mt-1 font-sans text-[9px] tracking-[0.25em] font-bold uppercase text-ink-dim">
          HOME · {fixture.home.abbr}
        </div>
      </div>
      <div class="px-3 py-4 flex flex-col items-center text-center">
        <div
          class="w-14 h-14 rounded-full flex items-center justify-center font-serif font-bold text-[22px] mb-2"
          style="background: var(--ink); color: var(--paper);"
        >
          {fixture.away.abbr.charAt(0)}
        </div>
        <div class="font-serif text-[17px] leading-tight text-ink">
          {awayName}
        </div>
        <div class="mt-1 font-sans text-[9px] tracking-[0.25em] font-bold uppercase text-ink-dim">
          AWAY · {fixture.away.abbr}
        </div>
      </div>
    </div>

    <div
      class="mt-3 font-serif italic text-[12px] text-ink-dim text-center"
      data-hero-mobile-meta
    >
      {#if fixture.venue}{fixture.venue} · {/if}{kickoffDate} · {kickoffTime}
    </div>
  </div>
</section>
