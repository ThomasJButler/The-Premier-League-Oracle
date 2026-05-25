<script lang="ts">
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import CheersGeoffCallout from '$lib/components/match/CheersGeoffCallout.svelte';
  import HeatBar from '$lib/components/rumours/HeatBar.svelte';
  import LockedColumn from '$lib/components/rumours/LockedColumn.svelte';
  import { KICKER_RUMOURS } from '$lib/fixtures/rumours';
</script>

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell kicker="TRANSFER WINDOW · JUNE OPENING · MACCA'S DESK" title="Transfer Rumours">
    <div class="px-8 py-6" data-rumours-page>
      <section
        class="kicker-rumours-hero relative overflow-hidden mb-8 px-8 py-10 text-center"
        data-rumours-hero
      >
        <div class="kicker-rumours-hatch absolute inset-0" aria-hidden="true"></div>
        <div class="relative">
          <span
            class="inline-block px-4 py-1.5 mb-4 font-sans text-[10px] tracking-[0.4em] font-extrabold bg-red text-paper"
            data-rumours-coming-soon
          >
            COMING SOON · JUNE 2026
          </span>
          <h1
            class="font-serif font-bold tracking-[-0.03em] text-[72px] leading-[0.88] text-paper"
            data-rumours-headline
          >
            Transfer<br /><em class="text-amber">Season.</em>
          </h1>
          <p
            class="mt-5 max-w-xl mx-auto font-serif italic text-[16px] leading-[1.6] text-ink-ghost"
            data-rumours-blurb
          >
            The window opens June 9. Macca will be watching every rumour, rating every deal, and offering
            opinions nobody asked for. The model will assign probability scores to every move. Geoff will
            find the useless statistics.
          </p>
          <div class="mt-6 grid grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            {#each [
              { l: 'DEAL PROBABILITY', d: 'Model scores each rumour 0–100%. Clubs rated by historical follow-through.' },
              { l: "MACCA'S DESK", d: '"To be fair to the player…" — full pundit analysis of every major link.' },
              { l: 'IMPACT RATING', d: "How much does each signing move the title odds? We'll show you." }
            ] as feature (feature.l)}
              <div class="kicker-rumours-feature px-4 py-3" data-rumours-feature>
                <div class="font-sans text-[9px] tracking-[0.25em] font-bold mb-1 text-amber">
                  {feature.l}
                </div>
                <p class="font-serif italic text-[12px] text-ink-ghost leading-[1.5]">
                  {feature.d}
                </p>
              </div>
            {/each}
          </div>
          <div class="mt-6 flex items-center justify-center gap-4 flex-wrap">
            <button
              type="button"
              class="px-8 py-3 font-sans font-extrabold text-[12px] tracking-widest bg-paper text-ink"
              data-rumours-notify-cta
            >
              NOTIFY ME WHEN LIVE →
            </button>
            <p class="font-serif italic text-[11px] text-ink-faint">
              No spam. Just Macca's first take when the window opens.
            </p>
          </div>
        </div>
      </section>

      <header class="flex items-baseline justify-between mb-2 pb-2 border-b-2 border-ink">
        <div>
          <p class="font-sans text-[9px] tracking-[0.3em] font-extrabold mb-0.5 text-red">
            PREVIEW · EARLY RUMOURS
          </p>
          <h2 class="font-serif text-[22px] font-bold leading-none tracking-[-0.01em] text-ink">
            What Macca's already watching
          </h2>
        </div>
        <p class="font-mono text-[10px] text-ink-dim uppercase tracking-wider" data-rumours-unlock-note>
          PROBABILITY SCORES UNLOCK JUNE 9
        </p>
      </header>

      <ul class="flex flex-col gap-3" data-rumours-list>
        {#each KICKER_RUMOURS as rumour, i (i)}
          <li
            class="grid gap-4 items-start px-4 py-4 bg-paper-warm border border-rule kicker-rumour-row"
            data-rumour-row
          >
            <div data-rumour-player>
              <div class="font-serif text-[20px] font-bold leading-none text-ink">
                {rumour.player}
              </div>
              <div class="font-mono text-[11px] mt-1 text-ink-dim">
                {rumour.from} → {rumour.to}
              </div>
            </div>
            <div data-rumour-fee>
              <div class="font-sans text-[9px] tracking-widest font-bold mb-0.5 text-red">
                REPORTED FEE
              </div>
              <div class="font-mono font-extrabold text-[18px] tracking-[-0.02em] text-ink">
                {rumour.fee}
              </div>
            </div>
            <div data-rumour-heat>
              <div class="font-sans text-[9px] tracking-widest font-bold mb-1 text-red">HEAT</div>
              <HeatBar heat={rumour.heat} />
            </div>
            <div data-rumour-locked>
              <div class="font-sans text-[9px] tracking-widest font-bold mb-1 text-red text-center">
                PROB.
              </div>
              <LockedColumn />
            </div>
            <blockquote
              class="relative pl-3 border-l-2 border-red"
              data-rumour-macca
            >
              <div class="font-sans text-[9px] tracking-[0.2em] font-bold mb-0.5 text-red">
                MACCA SAYS
              </div>
              <p class="font-serif italic text-[12px] leading-[1.45] text-ink">
                &ldquo;{rumour.macca}&rdquo;
              </p>
            </blockquote>
          </li>
        {/each}
      </ul>

      <div class="mt-6" data-rumours-footer>
        <CheersGeoffCallout
          stat="£2.1bn"
          label="SPENT LAST WINDOW"
          gloriouslyUseless="Premier League clubs spent £2.1 billion in January. The combined transfer fee of every player Geoff has personally recommended over the years is £0. Geoff recommends free agents exclusively."
        />
      </div>
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-rumours-page-mobile>
  <MobileHeader title="Transfer Rumours" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-6 pb-24 overflow-y-auto" data-mobile-body>
    <section
      class="kicker-rumours-stub px-6 py-10 text-center bg-ink text-paper"
      data-rumours-mobile-stub
    >
      <span
        class="inline-block px-3 py-1 mb-4 font-sans text-[9px] tracking-[0.4em] font-extrabold bg-red text-paper"
      >
        COMING SOON · JUNE 2026
      </span>
      <h1 class="font-serif font-bold text-[44px] leading-[0.9] tracking-[-0.02em] text-paper">
        Transfer<br /><em class="text-amber">Season.</em>
      </h1>
      <p class="mt-5 font-serif italic text-[14px] leading-[1.6] text-ink-ghost">
        The window opens June 9. The full rumour table reads best on a bigger screen — open
        <span class="font-mono">/rumours</span> on desktop to see Macca's early takes.
      </p>
      <button
        type="button"
        class="mt-6 px-6 py-3 font-sans font-extrabold text-[11px] tracking-widest bg-paper text-ink"
        data-rumours-notify-cta-mobile
      >
        NOTIFY ME WHEN LIVE →
      </button>
    </section>
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="more" />
  </div>
</div>

<style>
  .kicker-rumours-hero {
    background: var(--ink);
    color: var(--paper);
  }
  .kicker-rumours-hatch {
    opacity: 0.1;
    background-image: repeating-linear-gradient(45deg, var(--paper) 0 2px, transparent 2px 20px);
  }
  .kicker-rumours-feature {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .kicker-rumour-row {
    grid-template-columns: 1fr 120px 120px 60px 1fr;
  }
</style>
