<script lang="ts">
  interface Props {
    items?: string[];
    label?: string;
  }

  const {
    items = [
      'MODEL LIVE',
      'GW33',
      'EDGE +4pp',
      'BRIER 0.198',
      'CALIBRATION 0.94'
    ],
    label = 'Live model ticker'
  }: Props = $props();

  const tape = $derived(items.join('   ·   '));
</script>

<div
  class="kicker-mticker bg-ink text-paper border-y border-rule-strong overflow-hidden"
  role="marquee"
  aria-label={label}
  data-mobile-ticker
>
  <div class="kicker-mticker__track font-mono text-[10px] tracking-[0.25em] uppercase whitespace-nowrap py-[6px]">
    <span class="kicker-mticker__run">{tape}   ·   {tape}</span>
  </div>
</div>

<style>
  .kicker-mticker {
    height: 22px;
    -webkit-mask-image: linear-gradient(to right, black calc(100% - 24px), transparent);
    mask-image: linear-gradient(to right, black calc(100% - 24px), transparent);
  }
  .kicker-mticker__track {
    display: flex;
  }
  .kicker-mticker__run {
    padding-left: 100%;
    animation: kicker-mticker-marquee 40s linear infinite;
  }
  @keyframes kicker-mticker-marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-100%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .kicker-mticker__run {
      animation: none;
      padding-left: 0;
    }
  }
</style>
