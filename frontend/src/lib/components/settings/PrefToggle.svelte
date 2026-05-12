<script lang="ts">
  interface Props {
    id: string;
    label: string;
    sub?: string;
    checked: boolean;
    onchange: (next: boolean) => void;
  }

  let { id, label, sub, checked, onchange }: Props = $props();
</script>

<label
  class="pref-toggle flex items-center justify-between gap-4 py-3"
  data-pref-toggle={id}
  data-pref-checked={checked ? 'true' : 'false'}
>
  <span class="flex flex-col">
    <span class="font-sans text-[12px] font-bold tracking-[0.08em] uppercase">
      {label}
    </span>
    {#if sub}
      <span class="font-serif italic text-[11px] text-ink-dim">{sub}</span>
    {/if}
  </span>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    data-pref-switch={id}
    class="pref-switch"
    class:is-on={checked}
    onclick={() => onchange(!checked)}
  >
    <span class="pref-switch__knob"></span>
  </button>
</label>

<style>
  .pref-switch {
    position: relative;
    width: 44px;
    height: 24px;
    border-radius: 999px;
    background: var(--paper-inset);
    border: 1px solid var(--rule);
    transition: background 0.15s ease, border-color 0.15s ease;
    flex-shrink: 0;
    cursor: pointer;
  }
  .pref-switch__knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--ink-dim);
    transition: transform 0.15s ease, background 0.15s ease;
  }
  .pref-switch.is-on {
    background: var(--ink);
    border-color: var(--ink);
  }
  .pref-switch.is-on .pref-switch__knob {
    background: var(--paper);
    transform: translateX(20px);
  }
  .pref-switch:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }
</style>
