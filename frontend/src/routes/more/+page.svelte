<script lang="ts">
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';

  interface MoreLink {
    href: string;
    label: string;
    description: string;
  }

  const LINKS: readonly MoreLink[] = [
    { href: '/settings', label: 'Settings', description: 'Pundit, account, and display preferences.' },
    { href: '/insights', label: 'Insights', description: 'Top scorers, season stats, and the numbers behind the model.' },
    { href: '/insights/archive', label: 'Archive', description: '33 seasons of results, back to 1992.' },
    { href: '/broadsheet', label: 'Broadsheet', description: "This week's paper, written by your pundit." },
    { href: '/roster', label: 'Roster', description: 'Meet the ten pundits on the desk.' },
    { href: '/roster/voices', label: 'Voice Range', description: 'The same fixture, ten different takes.' },
    { href: '/search', label: 'Search', description: 'Fixtures, players, and seasons.' },
    { href: '/notifications', label: 'Notifications', description: 'Kick-offs, model edges, and broadsheet drops.' },
    { href: '/rumours', label: 'Transfer Rumours', description: "Macca's desk, coming this window." },
    { href: '/landing', label: 'About The Kicker', description: 'What this paper is, and who writes it.' }
  ];
</script>

{#snippet body()}
  <Rule kicker="THE INDEX" title="More" />

  <div data-more-list>
    {#each LINKS as link (link.href)}
      <a
        href={link.href}
        aria-label={link.label}
        data-more-link
        class="flex items-center justify-between gap-4 py-3 border-b border-rule"
      >
        <div class="min-w-0">
          <p class="font-serif text-[16px] font-bold text-ink" data-more-link-label>
            {link.label}
          </p>
          <p class="font-serif italic text-[12px] text-ink-dim mt-0.5" data-more-link-desc>
            {link.description}
          </p>
        </div>
        <span class="font-serif text-[18px] text-ink-dim flex-shrink-0" aria-hidden="true">›</span>
      </a>
    {/each}
  </div>
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell kicker="THE INDEX" title="More">
    <div class="px-8 py-6 max-w-3xl">
      {@render body()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-more-page>
  <MobileHeader title="More" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="more" />
  </div>
</div>
