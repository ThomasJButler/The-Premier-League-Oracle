<script lang="ts">
  interface Props {
    onnext?: () => void;
  }

  const { onnext }: Props = $props();
</script>

<section class="kicker-onboard-welcome w-full min-h-screen flex flex-col lg:flex-row bg-paper" data-onboard-step="welcome">
  <aside class="w-full lg:w-[480px] flex-shrink-0 flex flex-col justify-between px-10 lg:px-16 py-12 lg:py-16 bg-ink text-paper">
    <div>
      <p class="font-sans text-[10px] tracking-[0.4em] font-bold mb-4 text-ink-ghost">EST. 2026 · ISSUE №&nbsp;001</p>
      <h1 class="font-serif font-bold leading-[0.88] tracking-[-0.03em] text-[64px] lg:text-[86px]">
        The<br />Kicker.
      </h1>
      <p class="mt-6 font-serif italic text-[18px] leading-[1.5] text-ink-ghost">
        Your daily Premier League<br />newspaper. Written by an<br />AI pundit you actually like.
      </p>
    </div>
    <div class="mt-10">
      <p class="font-sans text-[10px] tracking-[0.3em] font-bold mb-3 text-ink-ghost">WHAT YOU GET</p>
      <ul class="space-y-2 font-serif text-[13px] text-ink-ghost">
        <li class="flex items-start gap-3"><span class="text-[16px] flex-shrink-0">📰</span><span>A full broadsheet every matchday morning</span></li>
        <li class="flex items-start gap-3"><span class="text-[16px] flex-shrink-0">🗣️</span><span>10 pundits to choose from — switch any time</span></li>
        <li class="flex items-start gap-3"><span class="text-[16px] flex-shrink-0">⚽</span><span>Live fixture cards with real probabilities</span></li>
        <li class="flex items-start gap-3"><span class="text-[16px] flex-shrink-0">🏆</span><span>"Cheers, Geoff" moments of glorious irrelevance</span></li>
      </ul>
    </div>
  </aside>

  <div class="flex-1 flex flex-col justify-between px-10 lg:px-16 py-12 lg:py-16">
    <div>
      <p class="font-sans text-[10px] tracking-[0.3em] font-bold mb-2 text-red">TODAY'S EDITION · GW35 · SUN 3 MAY 2026</p>
      <div class="pb-4 mb-6 border-b-[3px] border-ink">
        <h2 class="font-serif font-bold leading-[0.92] tracking-[-0.02em] text-[36px] lg:text-[48px] text-ink">
          Liverpool host Spurs;<br />
          <em class="text-red">the model says go home early.</em>
        </h2>
      </div>
      <p class="font-serif italic text-[13px] leading-[1.6] text-ink-soft max-w-xl">
        Pick the voice that suits your morning. Switch any time.
      </p>
    </div>

    <div class="flex items-center justify-between mt-10">
      <p class="font-serif italic text-[11px] text-ink-dim">Takes about 30 seconds to set up.</p>
      <button
        type="button"
        class="px-10 py-4 font-sans font-extrabold text-[15px] tracking-[0.1em] bg-ink text-paper border-2 border-ink transition-transform hover:scale-[1.01]"
        onclick={onnext}
        data-onboard-next
      >
        PICK YOUR PUNDIT →
      </button>
    </div>
  </div>
</section>
