<script lang="ts">
  interface Props {
    label: string;
    form?: ReadonlyArray<'W' | 'D' | 'L'>;
  }

  const { label, form }: Props = $props();
</script>

<div class="flex flex-col gap-2" data-form-chips data-form-team={label}>
  <span
    class="font-sans text-[10px] tracking-[0.3em] font-bold uppercase text-ink"
    data-form-label
  >
    {label}
  </span>
  {#if form && form.length > 0}
    <ol class="flex gap-1.5" data-form-row>
      {#each form as outcome, i (i)}
        <li
          class="kicker-form-chip w-7 h-7 flex items-center justify-center font-mono text-[12px] font-bold border border-ink"
          data-form-chip={outcome}
        >
          {outcome}
        </li>
      {/each}
    </ol>
  {:else}
    <p class="font-serif italic text-[12px] text-ink-dim" data-form-empty>
      No completed matches yet this season.
    </p>
  {/if}
</div>

<style>
  .kicker-form-chip[data-form-chip='W'] {
    background: var(--persona-accent, var(--ink));
    color: var(--paper);
    border-color: var(--persona-accent, var(--ink));
  }
  .kicker-form-chip[data-form-chip='L'] {
    background: var(--paper);
    color: var(--ink-dim);
  }
  .kicker-form-chip[data-form-chip='D'] {
    background: var(--paper-warm);
    color: var(--ink);
  }
</style>
