<script lang="ts">
  interface Props {
    items?: string[];
    label?: string;
  }

  // Honest neutral default: a prop-less render can never lie. Live tape is fed
  // from lib/ticker/tickerFeed (the KickerShell mount passes tickerDesktop).
  const {
    items = ['THE KICKER', 'AWAITING SCHEDULE'],
    label = 'Live model ticker'
  }: Props = $props();

  const tape = $derived(items.join('   ·   '));
</script>

<div
  class="kicker-ticker bg-ink text-paper border-y border-rule-strong overflow-hidden"
  role="marquee"
  aria-label={label}
>
  <div class="kicker-ticker__track font-mono text-[10px] tracking-[0.25em] uppercase whitespace-nowrap py-[9px]">
    <span class="kicker-ticker__run">{tape}   ·   {tape}</span>
  </div>
</div>

<style>
  .kicker-ticker {
    height: 28px;
    -webkit-mask-image: linear-gradient(to right, black calc(100% - 32px), transparent);
    mask-image: linear-gradient(to right, black calc(100% - 32px), transparent);
  }
  .kicker-ticker__track {
    display: flex;
  }
  .kicker-ticker__run {
    padding-left: 100%;
    animation: kicker-marquee 45s linear infinite;
  }
  @keyframes kicker-marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-100%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .kicker-ticker__run {
      animation: none;
      padding-left: 0;
    }
  }
</style>
