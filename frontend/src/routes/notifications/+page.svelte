<script lang="ts">
  import { onMount } from 'svelte';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import NotificationItem from '$lib/components/notifications/NotificationItem.svelte';
  import { personaStore } from '$lib/stores/persona';
  import type { PersonaId } from '$lib/personas';
  import { getEmptyStateCopy } from '$lib/copy/emptyStates';
  import {
    readNotifications,
    markRead,
    markAllRead,
    clearAll,
    type NotificationItem as NItem
  } from '$lib/stores/notificationsFeed';

  let items = $state<NItem[]>([]);
  let hydrated = $state(false);

  onMount(() => {
    items = readNotifications();
    hydrated = true;
  });

  function handleItemClick(item: NItem): void {
    if (!item.read) items = markRead(item.id);
    if (item.href && typeof window !== 'undefined') {
      window.location.assign(item.href);
    }
  }

  function handleMarkAll(): void {
    items = markAllRead();
  }

  function handleClearAll(): void {
    clearAll();
    items = [];
  }

  const unreadCount = $derived(items.filter((n) => !n.read).length);
</script>

{#snippet body()}
  <Rule
    kicker="THE WIRE"
    title="Notifications"
    action={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
  />

  {#if !hydrated}
    <p class="font-serif italic text-ink-dim text-[14px] py-6" data-notifications-loading>
      Loading your wire…
    </p>
  {:else if items.length === 0}
    <div class="py-10 text-center" data-notifications-empty>
      <p class="font-serif italic text-ink-dim text-[15px] mb-2">
        {getEmptyStateCopy('notifications', $personaStore as PersonaId)}
      </p>
      <p class="font-serif text-[13px] text-ink-soft">
        Match kick-offs, model edges, and broadsheet drops will surface here once the engine starts
        filing.
      </p>
    </div>
  {:else}
    <div class="flex items-center justify-between mb-2" data-notifications-actions>
      <button
        type="button"
        class="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim hover:text-ink disabled:opacity-40"
        data-action="mark-all-read"
        disabled={unreadCount === 0}
        onclick={handleMarkAll}
      >
        Mark all read
      </button>
      <button
        type="button"
        class="font-mono text-[10px] tracking-[0.2em] uppercase text-red hover:text-ink"
        data-action="clear-all"
        onclick={handleClearAll}
      >
        Clear all
      </button>
    </div>
    <div data-notifications-list>
      {#each items as item (item.id)}
        <NotificationItem {item} onclick={handleItemClick} />
      {/each}
    </div>
  {/if}

  <a
    href="/settings#notifications"
    class="inline-block mt-6 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim border-b border-rule pb-0.5 hover:text-ink"
    data-notifications-settings-link
  >
    Manage in Settings →
  </a>
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell kicker="NOTIFICATIONS" title="The Wire">
    <div class="px-8 py-6 max-w-3xl">
      {@render body()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-notifications-page>
  <MobileHeader title="Notifications" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="more" />
  </div>
</div>
