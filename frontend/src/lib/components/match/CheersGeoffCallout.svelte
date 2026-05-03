<script lang="ts">
  interface Props {
    stat: string;
    label: string;
    gloriouslyUseless: string;
  }

  const { stat, label, gloriouslyUseless }: Props = $props();
</script>

<aside
  class="kicker-cheers my-4 px-5 py-4 relative bg-paper-warm border-2 border-dashed border-amber"
  data-cheers-callout
>
  <span
    class="absolute -top-2 left-4 px-2 py-0.5 font-sans text-[9px] tracking-[0.3em] font-extrabold uppercase bg-amber text-paper"
    data-cheers-stamp
  >CHEERS, GEOFF</span>
  <div class="grid grid-cols-[auto_1fr] gap-5 items-center">
    <div class="text-center" data-cheers-stat-block>
      <div
        class="font-mono font-extrabold text-[42px] leading-none tracking-[-0.04em] text-amber"
        data-cheers-stat
      >
        {stat}
      </div>
      <div
        class="font-sans text-[9px] tracking-[0.25em] font-bold uppercase mt-1 text-amber"
        data-cheers-label
      >
        {label}
      </div>
    </div>
    <div class="pl-4 border-l border-amber" data-cheers-body>
      <div class="font-sans text-[10px] tracking-[0.2em] uppercase font-bold mb-1 text-ink-dim">
        GLORIOUSLY USELESS
      </div>
      <p
        class="font-serif italic text-[14px] leading-[1.5] text-ink"
        data-cheers-text
      >
        {gloriouslyUseless}
      </p>
    </div>
  </div>
</aside>
