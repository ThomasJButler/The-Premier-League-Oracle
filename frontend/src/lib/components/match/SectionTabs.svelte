<script lang="ts" generics="Id extends string">
  interface TabSpec {
    id: Id;
    label: string;
  }

  interface Props {
    tabs: ReadonlyArray<TabSpec>;
    active: Id;
    onSelect: (id: Id) => void;
  }

  const { tabs, active, onSelect }: Props = $props();
</script>

<nav
  aria-label="Match sections"
  class="kicker-section-tabs flex border-b border-ink overflow-x-auto"
  data-section-tabs
>
  {#each tabs as tab (tab.id)}
    {@const isActive = tab.id === active}
    <button
      type="button"
      class="kicker-section-tab font-sans text-[10px] tracking-[0.3em] font-bold uppercase px-4 py-2.5 whitespace-nowrap transition-colors"
      class:is-active={isActive}
      data-section-tab={tab.id}
      aria-current={isActive ? 'page' : undefined}
      onclick={() => onSelect(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</nav>

<style>
  .kicker-section-tab {
    color: var(--ink-dim);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .kicker-section-tab:hover {
    color: var(--ink);
  }
  .kicker-section-tab.is-active {
    color: var(--ink);
    border-bottom-color: var(--persona-accent, var(--red));
  }
</style>
