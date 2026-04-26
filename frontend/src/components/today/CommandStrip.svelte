<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Link } from 'svelte-routing';

  export let gameweek: number | null;
  export let kickoffIso: string | null;
  export let accuracyPct: number;
  export let apiHealthy: boolean;

  let now = Date.now();
  let timer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    timer = setInterval(() => (now = Date.now()), 1000);
  });
  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  $: kickoffMs = kickoffIso ? +new Date(kickoffIso) : null;
  $: countdown = formatCountdown(kickoffMs, now);

  function formatCountdown(target: number | null, current: number): string {
    if (target === null) return '—';
    const diff = target - current;
    if (diff <= 0) return 'KICKING OFF';
    const totalMin = Math.floor(diff / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h >= 24) {
      const d = Math.floor(h / 24);
      return `${d}d ${h % 24}h`;
    }
    return `${h}h ${m}m`;
  }
</script>

<div
  class="sticky top-0 z-20 h-14 px-4 flex items-center justify-between bg-bg-raised border-b border-border"
  data-command-strip
>
  <div class="flex items-center gap-4 text-body-sm">
    <span class="text-eyebrow text-text-dim">GW {gameweek ?? '—'}</span>
    <span class="font-mono text-text-dim" data-countdown>{countdown}</span>
    <span class="px-2 py-0.5 rounded-full bg-bg-inset text-label">
      {Math.round(accuracyPct)}% accuracy
    </span>
    <span
      class="inline-block h-2 w-2 rounded-full {apiHealthy ? 'bg-accent' : 'bg-warning'}"
      data-api-dot
      data-healthy={String(apiHealthy)}
      aria-label={apiHealthy ? 'API healthy' : 'API stale'}
    ></span>
  </div>

  {#if gameweek !== null}
    <Link
      to="/predictions/this-week"
      class="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-label"
      data-predict-cta
    >
      Predict GW {gameweek}
    </Link>
  {/if}
</div>
