<script lang="ts">
  interface Props {
    value?: string;
    placeholder?: string;
    onsubmit?: (query: string) => void;
    onchange?: (query: string) => void;
    onclear?: () => void;
  }

  let {
    value = $bindable(''),
    placeholder = 'Search fixtures, players, seasons, threads…',
    onsubmit,
    onchange,
    onclear
  }: Props = $props();

  function handleSubmit(event: Event): void {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onsubmit?.(trimmed);
  }

  function handleInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    value = next;
    onchange?.(next);
  }

  function handleClear(): void {
    value = '';
    onclear?.();
  }
</script>

<form
  class="border-b border-rule py-2 lg:flex lg:items-center lg:gap-3"
  data-search-input
  onsubmit={handleSubmit}
>
  <div class="flex items-center gap-3 lg:flex-1" data-search-input-row>
    <span
      aria-hidden="true"
      class="font-mono text-[10px] tracking-[0.2em] uppercase"
      style="color: var(--persona-accent, var(--red));"
      data-search-input-glyph
    >
      /
    </span>
    <input
      type="search"
      class="flex-1 min-w-0 bg-transparent font-serif text-[18px] text-ink placeholder:text-ink-dim focus:outline-none"
      {placeholder}
      {value}
      autocomplete="off"
      spellcheck="false"
      aria-label="Search the Kicker"
      data-search-input-field
      oninput={handleInput}
    />
  </div>
  <div
    class="flex items-center justify-end gap-3 mt-2 lg:mt-0"
    data-search-input-actions
  >
    {#if value.length > 0}
      <button
        type="button"
        class="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim hover:text-ink"
        data-search-input-clear
        onclick={handleClear}
      >
        Clear
      </button>
    {/if}
    <button
      type="submit"
      class="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim hover:text-ink disabled:opacity-40"
      data-search-input-submit
      disabled={value.trim().length === 0}
    >
      Search ↵
    </button>
  </div>
</form>
