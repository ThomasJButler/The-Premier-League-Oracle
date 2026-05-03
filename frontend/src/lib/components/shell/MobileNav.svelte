<script lang="ts">
  type NavId = 'today' | 'fixtures' | 'predictions' | 'oracle' | 'more';

  interface NavItem {
    id: NavId;
    href: string;
    label: string;
    icon: string;
  }

  interface Props {
    active?: NavId;
  }

  const NAV: readonly NavItem[] = [
    { id: 'today', href: '/today', label: 'Today', icon: '◉' },
    { id: 'fixtures', href: '/fixtures', label: 'Fixtures', icon: '⚽' },
    { id: 'predictions', href: '/predictions', label: 'Predictions', icon: '◐' },
    { id: 'oracle', href: '/oracle', label: 'Oracle', icon: '◇' },
    { id: 'more', href: '/more', label: 'More', icon: '≡' }
  ];

  const { active }: Props = $props();
</script>

<nav
  class="kicker-mnav bg-paper border-t border-ink"
  aria-label="Mobile primary"
  data-mobile-nav
>
  <ul class="grid grid-cols-5">
    {#each NAV as item (item.id)}
      {@const isActive = item.id === active}
      <li class="flex flex-col items-center">
        <a
          href={item.href}
          aria-current={isActive ? 'page' : undefined}
          data-nav-id={item.id}
          class="kicker-mnav__tab flex flex-col items-center gap-1 pt-2 pb-1 w-full"
          class:active-tab={isActive}
        >
          <span
            class="kicker-mnav__icon text-[16px] leading-none"
            class:active-icon={isActive}
            aria-hidden="true"
            data-nav-icon
          >{item.icon}</span>
          <span class="font-sans text-[9px] tracking-[0.2em] uppercase font-bold">
            {item.label}
          </span>
          <span
            class="kicker-mnav__dot"
            class:active-dot={isActive}
            aria-hidden="true"
            data-nav-dot
          ></span>
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .kicker-mnav__icon {
    color: var(--ink-soft);
  }
  .kicker-mnav__icon.active-icon {
    color: var(--red);
  }
  .kicker-mnav__tab {
    color: var(--ink-soft);
  }
  .kicker-mnav__tab.active-tab {
    color: var(--ink);
  }
  .kicker-mnav__dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: transparent;
  }
  .kicker-mnav__dot.active-dot {
    background: var(--red);
  }
</style>
