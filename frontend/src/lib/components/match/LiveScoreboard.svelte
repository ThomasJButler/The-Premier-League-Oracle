<script lang="ts">
  import type { Fixture } from '../../../types/redesign';

  interface Props {
    fixture: Fixture;
  }

  const { fixture }: Props = $props();

  const minuteLabel = $derived(
    typeof fixture.minute === 'number' ? `${fixture.minute}'` : '—'
  );

  const homeGoals = $derived(fixture.score?.home ?? 0);
  const awayGoals = $derived(fixture.score?.away ?? 0);
</script>

<section
  class="kicker-live-scoreboard bg-paper-warm border border-ink"
  data-live-scoreboard
  data-live-scoreboard-id={fixture.id}
>
  <div class="hidden lg:block px-8 py-6" data-live-desktop>
    <div
      class="flex items-center justify-between text-[10px] tracking-[0.3em] font-bold uppercase pb-3 mb-5 border-b border-ink"
      data-live-meta
    >
      <span class="flex items-center gap-2 text-red" data-live-status>
        <span class="kicker-live-dot" data-live-dot aria-hidden="true"></span>
        LIVE · {minuteLabel}
      </span>
      <span class="text-ink-dim" data-live-competition>
        {fixture.competition} · GW {fixture.gameweek}
      </span>
    </div>

    <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-6" data-live-teams>
      <div class="text-right">
        <div class="font-serif font-bold text-[40px] leading-none tracking-[-0.03em] text-ink">
          {fixture.home.name}
        </div>
        <div class="mt-1 font-sans text-[11px] tracking-[0.3em] font-bold uppercase text-ink-dim">
          HOME · {fixture.home.abbr}
        </div>
      </div>

      <div class="flex flex-col items-center min-w-[160px]">
        <div
          class="font-mono font-extrabold text-[64px] leading-none tracking-[-0.05em] text-ink"
          data-live-score
        >
          {homeGoals}<span class="text-ink-faint text-[36px] px-3">·</span>{awayGoals}
        </div>
        <div class="mt-2 font-sans text-[10px] tracking-[0.3em] font-bold text-ink-dim">
          LIVE SCORE
        </div>
      </div>

      <div class="text-left">
        <div class="font-serif font-bold text-[40px] leading-none tracking-[-0.03em] text-ink">
          {fixture.away.name}
        </div>
        <div class="mt-1 font-sans text-[11px] tracking-[0.3em] font-bold uppercase text-ink-dim">
          AWAY · {fixture.away.abbr}
        </div>
      </div>
    </div>
  </div>

  <div class="lg:hidden px-4 py-5" data-live-mobile>
    <div class="flex items-center justify-between mb-3">
      <span
        class="inline-flex items-center gap-1.5 bg-ink px-2 py-1 text-[9px] tracking-[0.3em] font-bold uppercase"
        style="color: var(--paper);"
      >
        <span class="kicker-live-dot" data-live-dot aria-hidden="true"></span>
        LIVE · {minuteLabel}
      </span>
      <span class="font-mono text-[9px] tracking-[0.2em] font-bold text-ink-dim uppercase">
        {fixture.competition} · GW {fixture.gameweek}
      </span>
    </div>

    <div class="text-center font-sans text-[10px] tracking-[0.25em] font-bold uppercase text-red mb-2">
      {fixture.home.name} {homeGoals} — {awayGoals} {fixture.away.name}
    </div>

    <div class="text-center mb-4">
      <div class="font-mono font-extrabold text-[60px] leading-none tracking-[-0.05em] text-ink">
        {homeGoals} — {awayGoals}
      </div>
      <div class="mt-1 font-sans text-[9px] tracking-[0.3em] font-bold text-ink-dim">
        LIVE SCORE
      </div>
    </div>

    <div class="grid grid-cols-2 border-y border-ink divide-x divide-ink">
      <div class="px-3 py-4 flex flex-col items-center text-center">
        <div
          class="w-12 h-12 rounded-full flex items-center justify-center font-serif font-bold text-[20px] mb-2"
          style="background: var(--persona-accent, var(--red)); color: var(--paper);"
        >
          {fixture.home.abbr.charAt(0)}
        </div>
        <div class="font-serif text-[16px] leading-tight text-ink">
          {fixture.home.name}
        </div>
        <div class="mt-1 font-sans text-[9px] tracking-[0.25em] font-bold uppercase text-ink-dim">
          HOME · {fixture.home.abbr}
        </div>
      </div>
      <div class="px-3 py-4 flex flex-col items-center text-center">
        <div
          class="w-12 h-12 rounded-full flex items-center justify-center font-serif font-bold text-[20px] mb-2"
          style="background: var(--ink); color: var(--paper);"
        >
          {fixture.away.abbr.charAt(0)}
        </div>
        <div class="font-serif text-[16px] leading-tight text-ink">
          {fixture.away.name}
        </div>
        <div class="mt-1 font-sans text-[9px] tracking-[0.25em] font-bold uppercase text-ink-dim">
          AWAY · {fixture.away.abbr}
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .kicker-live-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    background: currentColor;
    animation: kicker-live-pulse 1.4s ease-in-out infinite;
  }

  @keyframes kicker-live-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(0.7); }
  }

  @media (prefers-reduced-motion: reduce) {
    .kicker-live-dot {
      animation: none;
    }
  }
</style>
