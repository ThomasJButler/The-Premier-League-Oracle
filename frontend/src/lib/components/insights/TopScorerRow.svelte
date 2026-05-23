<script lang="ts">
  interface Props {
    rank: number;
    player: string;
    team: string;
    goals: number;
    assists?: number | null;
  }

  const { rank, player, team, goals, assists }: Props = $props();
</script>

<div
  class="grid items-baseline gap-3 border-b border-rule py-2"
  style="grid-template-columns: 32px minmax(0, 1fr) auto auto;"
  data-top-scorer-row
  data-scorer-rank={rank}
>
  <span class="font-mono text-[12px] text-ink-dim tabular-nums" data-scorer-rank-label>
    {String(rank).padStart(2, '0')}
  </span>
  <div class="min-w-0">
    <p class="font-serif text-[16px] text-ink truncate" data-scorer-player>{player}</p>
    <p class="font-sans text-[10px] tracking-[0.18em] uppercase text-ink-dim truncate" data-scorer-team>
      {team}
    </p>
  </div>
  <span class="font-serif text-[20px] text-ink tabular-nums" data-scorer-goals>{goals}</span>
  {#if typeof assists === 'number'}
    <span
      class="font-mono text-[11px] text-ink-soft tabular-nums"
      data-scorer-assists={assists}
    >
      +{assists}
    </span>
  {:else}
    <span class="font-mono text-[11px] text-ink-soft" data-scorer-assists-missing>—</span>
  {/if}
</div>
