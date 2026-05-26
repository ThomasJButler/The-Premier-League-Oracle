<script lang="ts">
  import type { Match, Standing } from '../../../types';
  import { displayTeam } from '$lib/utils/displayTeam';

  interface Props {
    match: Match;
    probH: number;
    probD: number;
    probA: number;
    homeColor: string;
    awayColor: string;
    standings?: Standing[];
    pick?: string;
    conf?: number;
  }

  const { match, probH, probD, probA, homeColor, awayColor, standings, pick, conf }: Props = $props();

  const homeName = $derived(displayTeam(match.home_team, standings));
  const awayName = $derived(displayTeam(match.away_team, standings));

  const kickoffTime = $derived(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London'
    }).format(new Date(match.date))
  );

  const homeProb = $derived(Math.round(probH * 100));
  const drawProb = $derived(Math.round(probD * 100));
  const awayProb = $derived(Math.round(probA * 100));
</script>

<a
  href="/fixtures/{match.id}"
  class="block no-underline"
  data-match-row
  data-match-row-id={match.id}
>
  <!-- Desktop layout (lg+) -->
  <div
    class="hidden lg:grid gap-4 items-center px-4 py-3 bg-paper-warm border border-rule hover:bg-paper-inset transition-colors"
    style="grid-template-columns: 80px 1fr 100px 180px 1fr 80px;"
    data-match-row-desktop
  >
    <div data-match-time>
      <div class="font-mono text-[11px] font-bold text-red tracking-widest">{kickoffTime}</div>
    </div>
    <div class="flex items-center justify-between gap-2" data-match-teams>
      <div class="font-serif text-[18px] font-bold text-ink leading-none" data-match-home={match.home_team}>{homeName}</div>
      <div class="font-mono text-[11px] text-ink-dim">v</div>
      <div class="font-serif text-[18px] font-bold text-ink leading-none" data-match-away={match.away_team}>{awayName}</div>
    </div>
    <div class="text-center" data-prediction-col>
      {#if pick}
        <div class="font-sans text-[9px] tracking-widest font-bold text-ink-dim mb-1">PICK</div>
        <div class="font-mono font-extrabold text-[18px] text-red leading-none" data-match-pick>{pick}</div>
        {#if conf !== undefined}
          <div class="font-mono text-[9px] text-ink-dim mt-0.5" data-match-conf>{conf}%</div>
        {/if}
      {:else}
        <div class="font-mono text-[9px] text-ink-ghost tracking-widest">—</div>
      {/if}
    </div>
    <div data-match-probs>
      <div
        class="font-mono font-extrabold text-center text-[16px] text-ink tracking-[-0.02em]"
        aria-label="Win probability: home {homeProb}%, draw {drawProb}%, away {awayProb}%"
        data-match-prob-readout
      >
        {homeProb}<span class="text-ink-faint text-[12px]">·{drawProb}·</span>{awayProb}
      </div>
      <div class="mt-1.5 h-1.5 flex overflow-hidden border border-rule-strong" data-match-prob-bar>
        <div data-match-bar-home style="width: {probH * 100}%; background-color: {homeColor};"></div>
        <div class="bg-ink-faint" style="width: {probD * 100}%;" data-match-bar-draw></div>
        <div data-match-bar-away style="width: {probA * 100}%; background-color: {awayColor};"></div>
      </div>
    </div>
    <div class="font-serif text-[11px] italic text-ink-dim text-center" data-match-venue>{homeName}</div>
    <div class="text-center">
      <span class="inline-block px-2 py-1.5 font-sans text-[9px] tracking-widest font-bold bg-ink text-paper" data-match-open>OPEN →</span>
    </div>
  </div>

  <!-- Mobile layout (<lg): stacked card -->
  <div class="lg:hidden bg-paper-warm border border-rule px-3 py-2.5" data-match-row-mobile>
    <div class="flex items-center justify-between mb-1.5">
      <span class="font-mono text-[11px] text-ink-dim">{kickoffTime}</span>
      {#if pick}
        <span class="font-mono text-[11px] font-bold text-red" data-match-pick-mobile>PICK {pick}</span>
      {/if}
    </div>
    <div class="flex items-center justify-between">
      <span class="font-serif text-[16px] font-bold text-ink">{homeName}</span>
      <span class="font-mono font-extrabold text-[14px] text-ink" data-match-prob-mobile>
        {homeProb}<span class="text-ink-faint text-[11px]">·{drawProb}·</span>{awayProb}
      </span>
      <span class="font-serif text-[16px] font-bold text-ink">{awayName}</span>
    </div>
    <div class="mt-1.5 h-1 flex overflow-hidden border border-rule-strong" data-match-prob-bar-mobile>
      <div style="width: {probH * 100}%; background-color: {homeColor};"></div>
      <div class="bg-ink-faint" style="width: {probD * 100}%;"></div>
      <div style="width: {probA * 100}%; background-color: {awayColor};"></div>
    </div>
  </div>
</a>
