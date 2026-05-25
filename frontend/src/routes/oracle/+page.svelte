<script lang="ts">
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import GeoffMessage from '$lib/components/chat/GeoffMessage.svelte';
  import UserMessage from '$lib/components/chat/UserMessage.svelte';
  import GeoffComposer from '$lib/components/chat/GeoffComposer.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import ThreadListRail from '$lib/components/oracle/ThreadListRail.svelte';
  import WatchlistRail from '$lib/components/oracle/WatchlistRail.svelte';
  import TodayFixtureRail from '$lib/components/oracle/TodayFixtureRail.svelte';
  import { personaStore } from '$lib/stores/persona';
  import { threadsStore, toApiMessages, type OracleMessage } from '$lib/stores/threads';
  import { streamChat } from '$lib/oracle/streamChat';
  import { applyThreadDeepLink } from '$lib/oracle/applyThreadDeepLink';
  import { getPersona, type PersonaId } from '$lib/personas';

  interface Props {
    data?: { thread: string | null };
  }
  let { data }: Props = $props();

  const persona = $derived(getPersona($personaStore as PersonaId));

  onMount(() => {
    applyThreadDeepLink(data?.thread);
  });
  const activeThread = $derived(
    $threadsStore.threads.find((t) => t.id === $threadsStore.activeThreadId) ?? null
  );
  const messages = $derived<readonly OracleMessage[]>(activeThread?.messages ?? []);

  function handleSubmit(text: string): void {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    let threadId = $threadsStore.activeThreadId;
    if (!threadId) {
      threadId = threadsStore.createThread().id;
    }

    const now = Date.now();
    threadsStore.appendMessage(threadId, { role: 'user', content: trimmed, timestamp: now });
    threadsStore.appendMessage(threadId, {
      role: 'assistant',
      content: '',
      timestamp: now,
      streaming: true
    });

    const fresh = get(threadsStore).threads.find((t) => t.id === threadId);
    if (!fresh) return;
    const assistantIndex = fresh.messages.length - 1;
    const wireMessages = toApiMessages(fresh.messages);

    void streamChat(
      {
        personaId: $personaStore,
        messages: wireMessages,
        threadId
      },
      assistantIndex
    );
  }
</script>

{#snippet body()}
  <div class="kicker-oracle flex flex-col min-h-[60vh]" data-oracle-page>
    <div class="kicker-oracle__rule mb-4">
      <Rule
        kicker="THE ORACLE · LIVE CONVERSATION"
        title="In conversation with {persona.name}"
        action={messages.length === 0 ? 'READY' : 'STREAMING'}
      />
    </div>

    <div class="kicker-oracle__thread flex-1 px-1" data-oracle-thread aria-live="polite">
      {#if messages.length === 0}
        <p
          class="kicker-oracle__empty font-serif italic text-[13px] text-ink-dim pt-6"
          data-oracle-empty
        >
          Right then — ask {persona.name} anything. Saturday's slate, Tuesday's
          ghosts, last season's heartbreaks. Pick a prompt or type your own.
        </p>
      {:else}
        {#each messages as msg, i (i)}
          {#if msg.role === 'user'}
            <UserMessage body={msg.content} />
          {:else}
            <GeoffMessage body={msg.content} {persona} />
          {/if}
        {/each}
      {/if}
    </div>

    <div
      class="kicker-oracle__composer mt-4 sticky lg:static bottom-16 lg:bottom-auto z-10 -mx-4 lg:mx-0"
      data-oracle-composer-host
    >
      <GeoffComposer {persona} onsubmit={handleSubmit} />
    </div>
  </div>
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell active="oracle" kicker="ASK · LISTEN · LEARN" title="ORACLE">
    <div class="kicker-oracle__layout grid gap-6" data-oracle-layout>
      <div data-oracle-left-rail>
        <ThreadListRail />
        <WatchlistRail />
      </div>
      <div class="min-w-0">
        {@render body()}
      </div>
      <div data-oracle-right-rail>
        <TodayFixtureRail />
      </div>
    </div>
  </KickerShell>
</div>

<style>
  .kicker-oracle__layout {
    grid-template-columns: 240px minmax(0, 1fr) 320px;
  }
</style>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-oracle-mobile>
  <MobileHeader title="Oracle" sub={persona.short.toUpperCase()}>
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="oracle" />
  </div>
</div>
