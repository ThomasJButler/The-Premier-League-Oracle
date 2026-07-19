<script lang="ts">
  import type { Snippet } from 'svelte';
  import { personaStore } from '$lib/stores/persona';
  import { getPersona, type PersonaId } from '$lib/personas';
  import GeoffTicker from '$lib/components/atoms/GeoffTicker.svelte';
  import { tickerDesktop } from '$lib/ticker/tickerFeed';

  type NavId = 'today' | 'fixtures' | 'predictions' | 'oracle' | 'insights' | 'settings';

  interface NavItem {
    id: NavId;
    href: string;
    label: string;
  }

  interface Props {
    active?: NavId;
    title?: string;
    kicker?: string;
    children?: Snippet;
  }

  const NAV: readonly NavItem[] = [
    { id: 'today', href: '/today', label: "Today's Paper" },
    { id: 'fixtures', href: '/fixtures', label: 'Fixtures' },
    { id: 'predictions', href: '/predictions', label: 'Predictions' },
    { id: 'oracle', href: '/oracle', label: 'Oracle' },
    { id: 'insights', href: '/insights', label: 'Insights' },
    { id: 'settings', href: '/settings', label: 'Settings' }
  ];

  const { active, title = 'THE KICKER', kicker, children }: Props = $props();

  const personaId = $derived($personaStore as PersonaId);
  const persona = $derived(getPersona(personaId));
</script>

<div class="kicker-shell min-h-screen bg-paper text-ink font-serif" data-shell>
  <GeoffTicker items={$tickerDesktop} />

  <div class="kicker-shell__grid grid">
    <aside
      class="kicker-shell__sidebar bg-paper-deep border-r border-rule px-6 py-8 flex flex-col gap-8"
      data-shell-sidebar
    >
      <a
        href="/today"
        class="font-serif text-[22px] leading-none font-bold tracking-[-0.02em]"
        data-shell-masthead
      >
        THE KICKER
      </a>

      <nav aria-label="Primary" data-shell-nav>
        <ul class="flex flex-col gap-1">
          {#each NAV as item (item.id)}
            {@const isActive = item.id === active}
            <li>
              <a
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                data-nav-id={item.id}
                class="kicker-shell__nav-link block font-sans text-[11px] tracking-[0.25em] uppercase font-bold py-2 border-l-2 pl-3 transition-colors"
                class:active-link={isActive}
              >
                {item.label}
              </a>
            </li>
          {/each}
        </ul>
      </nav>

      <div class="mt-auto" data-pundit-on-duty>
        <p class="font-sans text-[9px] tracking-[0.3em] uppercase font-bold text-ink-dim mb-2">
          Pundit on Duty
        </p>
        <div class="flex items-center gap-3">
          <span
            class="kicker-shell__accent-dot"
            data-pundit-accent
            aria-hidden="true"
          ></span>
          <div>
            <p class="font-serif text-[15px] leading-tight font-bold" data-pundit-name>
              {persona.name}
            </p>
            <p class="font-serif italic text-[12px] text-ink-soft mt-0.5" data-pundit-tic>
              "{persona.tic}"
            </p>
          </div>
        </div>
      </div>
    </aside>

    <main class="kicker-shell__main px-12 py-8" data-shell-main>
      <header class="kicker-shell__topbar flex items-end justify-between border-b border-ink pb-4 mb-8">
        <div>
          {#if kicker}
            <p
              class="font-sans text-[10px] tracking-[0.3em] uppercase font-bold text-red mb-1"
              data-topbar-kicker
            >
              {kicker}
            </p>
          {/if}
          <h1
            class="font-serif text-[44px] leading-none font-bold tracking-[-0.02em]"
            data-topbar-title
          >
            {title}
          </h1>
        </div>
        <div class="flex items-center gap-4">
          <a
            href="/today"
            class="font-mono text-[10px] tracking-[0.25em] uppercase font-bold text-red"
            data-todays-paper-cta
          >
            Today's Paper →
          </a>
        </div>
      </header>

      {#if children}
        {@render children()}
      {/if}
    </main>
  </div>
</div>

<style>
  .kicker-shell__grid {
    grid-template-columns: 240px 1fr;
  }
  .kicker-shell__nav-link {
    border-color: transparent;
    color: var(--ink-soft);
  }
  .kicker-shell__nav-link:hover {
    color: var(--ink);
  }
  .kicker-shell__nav-link.active-link {
    border-color: var(--persona-accent);
    color: var(--ink);
  }
  .kicker-shell__accent-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--persona-accent);
    display: inline-block;
    flex-shrink: 0;
  }
</style>
