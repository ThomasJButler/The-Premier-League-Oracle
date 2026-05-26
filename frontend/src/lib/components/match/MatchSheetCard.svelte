<script lang="ts">
  interface Props {
    home: string;
    homeAbbr: string;
    homeColor: string;
    away: string;
    awayAbbr: string;
    awayColor: string;
    kickoff: string;
    venue: string;
    probH: number;
    probD: number;
    probA: number;
    pick?: string;
    conf?: number;
    headline?: string;
    byline?: string;
    score?: { home: number; away: number } | null;
    scoreLabel?: string;
  }

  const {
    home,
    homeAbbr,
    homeColor,
    away,
    awayAbbr,
    awayColor,
    kickoff,
    venue,
    probH,
    probD,
    probA,
    pick,
    conf,
    headline,
    byline,
    score = null,
    scoreLabel = 'FINAL'
  }: Props = $props();

  const probHpct = $derived(Math.round(probH * 100));
  const probDpct = $derived(Math.round(probD * 100));
  const probApct = $derived(Math.round(probA * 100));
  const hasScore = $derived(score !== null && score !== undefined);
  const showFooter = $derived(Boolean(headline || pick));
</script>

<article
  class="kicker-match-sheet relative my-4 bg-paper-warm border border-ink"
  data-match-sheet
  data-match-home={homeAbbr}
  data-match-away={awayAbbr}
>
  <span class="kicker-corner kicker-corner-tl" data-corner="tl" aria-hidden="true"></span>
  <span class="kicker-corner kicker-corner-tr" data-corner="tr" aria-hidden="true"></span>
  <span class="kicker-corner kicker-corner-bl" data-corner="bl" aria-hidden="true"></span>
  <span class="kicker-corner kicker-corner-br" data-corner="br" aria-hidden="true"></span>

  <div class="px-5 py-4">
    <div
      class="flex items-center justify-between text-[9px] tracking-[0.25em] font-bold pb-2 mb-3 text-red border-b border-ink uppercase"
      data-match-meta
    >
      <span data-match-venue>FIXTURE · {venue}</span>
      <span class="font-mono" data-match-kickoff>{kickoff}</span>
    </div>

    <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
      <div class="text-right">
        <div
          class="font-serif font-bold text-[28px] leading-none tracking-[-0.02em] text-ink"
          data-match-home-name
        >
          {home}
        </div>
        <div class="mt-1 font-sans text-[10px] tracking-widest uppercase text-ink-dim">
          HOME · {homeAbbr}
        </div>
      </div>

      <div class="flex flex-col items-center" data-match-probs>
        {#if hasScore && score}
          <div class="font-mono text-[11px] tracking-widest font-extrabold mb-1 text-red" data-match-score-label>
            {scoreLabel}
          </div>
          <div
            class="font-serif font-extrabold text-[38px] leading-none tracking-[-0.04em] text-ink"
            data-match-score
            data-match-score-home={score.home}
            data-match-score-away={score.away}
          >
            {score.home}<span class="text-ink-faint mx-2">–</span>{score.away}
          </div>
          <div class="text-[9px] tracking-[0.3em] font-bold mt-0.5 text-ink-dim">
            HOME · AWAY
          </div>
        {:else}
          <div class="font-mono text-[11px] tracking-widest font-extrabold mb-1 text-ink-dim">
            VERSUS
          </div>
          <div
            class="font-mono font-extrabold text-[38px] leading-none tracking-[-0.04em] text-ink"
            data-match-prob-readout
          >
            {probHpct}<span class="text-ink-faint text-[22px]">·{probDpct}·</span>{probApct}
          </div>
          <div class="text-[9px] tracking-[0.3em] font-bold mt-0.5 text-ink-dim">
            HOME · DRAW · AWAY
          </div>
        {/if}
      </div>

      <div class="text-left">
        <div
          class="font-serif font-bold text-[28px] leading-none tracking-[-0.02em] text-ink"
          data-match-away-name
        >
          {away}
        </div>
        <div class="mt-1 font-sans text-[10px] tracking-widest uppercase text-ink-dim">
          AWAY · {awayAbbr}
        </div>
      </div>
    </div>

    <div class="mt-4 flex items-center gap-3">
      <div
        class="flex-1 h-2 flex overflow-hidden border border-ink"
        data-match-bar
        role="img"
        aria-label="Win probability: home {probHpct}%, draw {probDpct}%, away {probApct}%"
      >
        <div
          data-match-bar-home
          style="width: {probHpct}%; background: {homeColor};"
        ></div>
        <div
          data-match-bar-draw
          class="bg-ink-faint"
          style="width: {probDpct}%;"
        ></div>
        <div
          data-match-bar-away
          style="width: {probApct}%; background: {awayColor};"
        ></div>
      </div>
    </div>

    {#if showFooter}
      <div
        class="mt-4 pt-3 grid grid-cols-[1fr_auto] gap-4 items-center border-t border-rule"
        data-match-footer
      >
        <div>
          {#if headline}
            <p
              class="font-serif font-bold italic text-[19px] leading-tight tracking-[-0.01em] text-ink"
              data-match-headline
            >
              {headline}
            </p>
          {/if}
          {#if byline}
            <p
              class="mt-1.5 font-sans text-[10px] tracking-widest uppercase text-ink-dim"
              data-match-byline
            >
              BYLINE · {byline}
            </p>
          {/if}
        </div>
        {#if pick}
          <div
            class="text-right pl-4 border-l border-rule"
            data-match-pick-block
          >
            <div class="font-sans text-[9px] tracking-[0.25em] font-bold text-red">
              GEOFF'S PICK
            </div>
            <div
              class="font-mono font-extrabold text-[26px] leading-none tracking-[-0.03em] text-ink mt-0.5"
              data-match-pick
            >
              {pick}
            </div>
            {#if typeof conf === 'number'}
              <div
                class="font-mono text-[10px] mt-1 text-ink-dim"
                data-match-conf
              >
                {conf}% confidence
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</article>

<style>
  .kicker-corner {
    position: absolute;
    width: 10px;
    height: 10px;
    border-color: var(--ink);
  }
  .kicker-corner-tl {
    top: -1px;
    left: -1px;
    border-top: 2px solid var(--ink);
    border-left: 2px solid var(--ink);
  }
  .kicker-corner-tr {
    top: -1px;
    right: -1px;
    border-top: 2px solid var(--ink);
    border-right: 2px solid var(--ink);
  }
  .kicker-corner-bl {
    bottom: -1px;
    left: -1px;
    border-bottom: 2px solid var(--ink);
    border-left: 2px solid var(--ink);
  }
  .kicker-corner-br {
    bottom: -1px;
    right: -1px;
    border-bottom: 2px solid var(--ink);
    border-right: 2px solid var(--ink);
  }
</style>
