<script lang="ts">
  import { onMount } from 'svelte';
  import ThreadRail from '../../components/oracle/ThreadRail.svelte';
  import MessageList from '../../components/oracle/MessageList.svelte';
  import Composer from '../../components/oracle/Composer.svelte';
  import ContextPanel from '../../components/oracle/ContextPanel.svelte';
  import {
    loadThreads,
    saveThreads,
    createThread,
    appendMessage,
    setActiveThread,
    migrateLegacyHistory,
    type OracleThreadStore,
    type ChatMessage,
  } from '../../lib/oracle/threads';
  import { detectBackendMode, streamReply, type BackendMode } from '../../services/oracleChat';
  import { dataService } from '../../services/dataService';
  import { predictionTracker, type AccuracyStats } from '../../services/predictionTracker';
  import { matchToFixture } from '../../lib/adapters/v3';
  import type { Fixture } from '../../types/redesign';
  import { getSavedAiModel, ANTHROPIC_API_KEY_STORAGE_KEY } from '$lib/constants';

  let store: OracleThreadStore = { threads: [], activeThreadId: null };
  let backendMode: BackendMode = 'none';
  let inputText = '';
  let isStreaming = false;
  let streamingContent = '';
  let recentFixtures: Fixture[] = [];

  function toContextStats(s: AccuracyStats): { totalPicks: number; accuracy: number; brierScore: number } {
    return { totalPicks: s.totalPredictions, accuracy: s.accuracy, brierScore: s.brierScore };
  }

  let stats: { totalPicks: number; accuracy: number; brierScore: number } | null =
    toContextStats(predictionTracker.getAccuracyStats());

  $: activeThread = store.threads.find((t) => t.id === store.activeThreadId) ?? null;

  export async function load(): Promise<void> {
    migrateLegacyHistory();
    const next = loadThreads();
    if (next.threads.length === 0) {
      const seed = createThread();
      next.threads = [seed];
      next.activeThreadId = seed.id;
      saveThreads(next);
    } else if (!next.activeThreadId) {
      next.activeThreadId = next.threads[0].id;
      saveThreads(next);
    }
    store = next;
    backendMode = await detectBackendMode();
    try {
      const upcoming = await dataService.getMatches({ upcoming: true, days: 7 });
      recentFixtures = upcoming.slice(0, 3).map(matchToFixture);
    } catch {
      recentFixtures = [];
    }
    stats = toContextStats(predictionTracker.getAccuracyStats());
  }

  onMount(load);

  function handleSelect(id: string): void {
    setActiveThread(id);
    store = loadThreads();
  }

  function handleNewThread(): void {
    const fresh = createThread();
    const next: OracleThreadStore = {
      threads: [...store.threads, fresh],
      activeThreadId: fresh.id,
    };
    saveThreads(next);
    store = loadThreads();
  }

  function handlePickPrompt(text: string): void {
    inputText = text;
  }

  async function handleSubmit(text: string): Promise<void> {
    if (!activeThread || isStreaming) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    const threadId = activeThread.id;
    const userMsg: ChatMessage = { role: 'user', content: trimmed, timestamp: Date.now() };
    appendMessage(threadId, userMsg);
    store = loadThreads();
    inputText = '';
    isStreaming = true;
    streamingContent = '';

    try {
      const apiKey = localStorage.getItem(ANTHROPIC_API_KEY_STORAGE_KEY) ?? undefined;
      const conversation = [...(activeThread?.messages ?? []), userMsg];
      for await (const chunk of streamReply(conversation, {
        model: getSavedAiModel(),
        apiKey,
      })) {
        streamingContent += chunk.delta;
      }
      if (streamingContent.length > 0) {
        appendMessage(threadId, {
          role: 'assistant',
          content: streamingContent,
          timestamp: Date.now(),
        });
      }
      store = loadThreads();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Streaming failed — please retry.';
      appendMessage(threadId, {
        role: 'system',
        content: message,
        timestamp: Date.now(),
      });
      store = loadThreads();
    } finally {
      streamingContent = '';
      isStreaming = false;
    }
  }
</script>

<div
  data-screen="oracle"
  class="grid grid-cols-1 lg:grid-cols-[240px_1fr_280px] gap-0 h-[calc(100vh-12rem)] min-h-[480px]"
>
  <aside class="hidden lg:block min-h-0">
    <ThreadRail
      threads={store.threads}
      activeThreadId={store.activeThreadId}
      onSelect={handleSelect}
      onNewThread={handleNewThread}
    />
  </aside>

  <section class="flex flex-col min-h-0 bg-bg">
    <MessageList
      messages={activeThread?.messages ?? []}
      {streamingContent}
      {isStreaming}
    />
    <Composer
      bind:value={inputText}
      disabled={isStreaming || backendMode === 'none'}
      onSubmit={handleSubmit}
      onPickPrompt={handlePickPrompt}
    />
  </section>

  <aside class="hidden lg:block min-h-0">
    <ContextPanel {stats} {recentFixtures} />
  </aside>
</div>
