<script lang="ts">
  interface Props {
    fixture: string;
    predicted: string;
    actual: string;
    hit: boolean;
    exact: boolean;
    date?: string;
    isLast?: boolean;
  }

  const {
    fixture,
    predicted,
    actual,
    hit,
    exact,
    date,
    isLast = false
  }: Props = $props();
</script>

<div
  class="grid gap-4 px-4 py-2.5 items-center text-[13px] {isLast
    ? ''
    : 'border-b border-rule'}"
  style="grid-template-columns: 1fr 80px 80px 60px 80px 80px;"
  data-settled-row
  data-settled-hit={hit ? 'true' : 'false'}
  data-settled-exact={exact ? 'true' : 'false'}
>
  <div class="font-serif text-ink" data-settled-fixture>{fixture}</div>
  <div class="font-mono font-bold text-center text-ink" data-settled-predicted>
    {predicted}
  </div>
  <div class="font-mono font-bold text-center text-ink" data-settled-actual>
    {actual}
  </div>
  <div
    class="text-center text-[10px] font-bold tracking-widest {hit
      ? 'text-green'
      : 'text-ink-dim'}"
    data-settled-hda
  >
    {hit ? '✓' : '—'}
  </div>
  <div
    class="text-center text-[10px] font-bold tracking-widest {exact
      ? 'text-red'
      : 'text-ink-faint'}"
    data-settled-exact-chip
  >
    {exact ? '✓✓' : '—'}
  </div>
  {#if date}
    <div
      class="font-mono text-[10px] text-ink-dim text-right"
      data-settled-date
    >
      {date}
    </div>
  {:else}
    <div></div>
  {/if}
</div>
