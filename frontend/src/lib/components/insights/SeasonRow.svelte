<script lang="ts">
  interface Props {
    season: string;
    champion: string | null;
    points: number | null;
    goalDifference: number | null;
    inProgress?: boolean;
    active?: boolean;
    onselect?: (season: string) => void;
  }

  const { season, champion, points, goalDifference, inProgress = false, active = false, onselect }: Props = $props();

  function handleClick() {
    onselect?.(season);
  }
</script>

<button
  type="button"
  class="kicker-season-row grid w-full items-baseline gap-3 border-b border-rule py-2 text-left transition-colors hover:bg-paper-warm"
  class:is-active={active}
  style="grid-template-columns: 72px minmax(0, 1fr) auto;"
  data-season-row
  data-season={season}
  aria-current={active ? 'true' : undefined}
  onclick={handleClick}
>
  <span class="font-mono text-[12px] tracking-[0.15em] text-red font-bold" data-season-label>
    {season}
  </span>
  {#if inProgress}
    <span class="font-serif italic text-ink-dim text-[14px]" data-season-in-progress>In progress</span>
    <span class="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft" data-season-meta>TBD</span>
  {:else}
    <span class="font-serif text-[15px] text-ink truncate" data-season-champion>{champion}</span>
    <span class="font-mono text-[11px] text-ink-soft tabular-nums" data-season-meta>
      {points} pts · GD {goalDifference !== null && goalDifference >= 0 ? '+' : ''}{goalDifference}
    </span>
  {/if}
</button>

<style>
  .kicker-season-row.is-active {
    border-left: 3px solid var(--persona-accent, var(--red));
    padding-left: 8px;
  }
</style>
