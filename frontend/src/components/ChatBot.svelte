<script lang="ts">
  import { MessageCircle, Send, Key, Loader2, AlertTriangle, Trash2, ShieldAlert } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { onMount, tick } from 'svelte';
  import { renderMarkdown } from '$lib/renderMarkdown';
  import { dataService } from '../services/dataService';
  import { aiAnalysisService } from '../services/aiAnalysis';
  import type { Standing, Match } from '../types';

  // --- Types ---
  interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }

  // --- Constants ---
  const MIN_REQUEST_INTERVAL = 3000;
  const MAX_INPUT_LENGTH = 500;
  const STORAGE_KEY_MESSAGES = 'oracle_chat_history';
  const STORAGE_KEY_API_KEY = 'openai_api_key';
  const MAX_STORED_MESSAGES = 50;

  // --- State ---
  let apiKey = '';
  let hasApiKey = false;
  let useServerKey = false;
  let messages: ChatMessage[] = [];
  let inputText = '';
  let isLoading = false;
  let error: string | null = null;
  let messagesContainer: HTMLElement;
  let showSecurityWarning = false;
  let lastRequestTime = 0;

  // --- Lifecycle ---
  onMount(() => {
    const savedKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (savedKey) {
      apiKey = savedKey;
      hasApiKey = true;
    }

    // Restore persisted chat history
    const savedMessages = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          messages = parsed;
          scrollToBottom();
          checkServerKey();
          return;
        }
      } catch {
        // Invalid stored data — fall through to welcome message
      }
    }

    messages = [{
      role: 'system',
      content: 'Welcome to Oracle Chat! Ask me anything about Premier League predictions, team form, match analysis, or betting strategy.',
      timestamp: Date.now()
    }];

    checkServerKey();
  });

  /** Check whether the server-side chat proxy has an API key configured.
   * Probes via POST with an empty messages array: if the server has a key the
   * request reaches the messages-validation step and returns "Messages array required";
   * if the server has no key it returns "No API key configured" first.
   */
  async function checkServerKey() {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      });
      if (res.status === 400) {
        const data = await res.json();
        if (data.error?.includes('Messages array required')) {
          useServerKey = true;
          hasApiKey = true;
        }
      }
    } catch {
      // Proxy not available — user must provide their own key
    }
  }

  // Persist messages whenever they change
  $: if (messages.length > 0) {
    persistMessages();
  }

  function persistMessages() {
    // Keep only the most recent messages to avoid bloating localStorage
    const toStore = messages.slice(-MAX_STORED_MESSAGES);
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(toStore));
    } catch {
      // Storage full — silently drop oldest messages
    }
  }

  // --- API Key Management ---
  export function saveApiKey() {
    const trimmed = apiKey.trim();
    if (!trimmed || trimmed.length < 10) {
      error = 'Please enter a valid OpenAI API key.';
      return;
    }
    localStorage.setItem(STORAGE_KEY_API_KEY, trimmed);
    apiKey = trimmed;
    hasApiKey = true;
    error = null;
  }

  export function clearApiKey() {
    localStorage.removeItem(STORAGE_KEY_API_KEY);
    apiKey = '';
    hasApiKey = false;
    messages = [...messages, {
      role: 'system',
      content: 'API key removed. Enter a new key to continue chatting.',
      timestamp: Date.now()
    }];
  }

  // --- Build Context (batched) ---
  async function buildSystemPrompt(): Promise<string> {
    let context = `You are the Premier League Oracle, an expert football analyst.
You provide insightful predictions and analysis for Premier League matches.
Be concise, data-driven, and confident in your analysis. Use UK English.
Reference real statistics when available. If you're uncertain, say so.
Never give financial advice — only discuss statistical probabilities.
Format your responses with markdown: use **bold** for emphasis, bullet points for lists, and \`code\` for statistics.

Current data:\n`;

    // Fetch all context data in parallel instead of sequentially
    const [standingsResult, upcomingResult, recentResult] = await Promise.allSettled([
      dataService.getStandings(),
      dataService.getMatches({ upcoming: true, days: 7 }),
      dataService.getMatches({ recent: true, days: 7 })
    ]);

    // Standings
    if (standingsResult.status === 'fulfilled' && standingsResult.value.length > 0) {
      context += '\nLeague Table (top 6):\n';
      standingsResult.value.slice(0, 6).forEach((s: Standing) => {
        context += `${s.position}. ${s.team.shortName || s.team.name} - ${s.points}pts (W${s.won} D${s.draw} L${s.lost}, GD ${s.goalDifference})\n`;
      });
    } else {
      context += '\nLeague table: unavailable\n';
    }

    // Upcoming matches
    if (upcomingResult.status === 'fulfilled' && upcomingResult.value.length > 0) {
      context += '\nUpcoming matches (next 7 days):\n';
      upcomingResult.value.slice(0, 5).forEach((m: Match) => {
        const date = new Date(m.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        context += `${m.home_team} vs ${m.away_team} (${date})\n`;
      });
    } else {
      context += '\nUpcoming matches: unavailable\n';
    }

    // Recent results
    if (recentResult.status === 'fulfilled') {
      const finished = recentResult.value.filter((m: Match) => m.result);
      if (finished.length > 0) {
        context += '\nRecent results:\n';
        finished.slice(0, 5).forEach((m: Match) => {
          context += `${m.home_team} ${m.home_goals}-${m.away_goals} ${m.away_team}\n`;
        });
      }
    } else {
      context += '\nRecent results: unavailable\n';
    }

    // Recent AI analyses (from Predictions view)
    const recentAnalyses = aiAnalysisService.getRecentAnalyses(3);
    if (recentAnalyses.length > 0) {
      context += '\nRecent AI match analyses:\n';
      recentAnalyses.forEach(a => {
        context += `- Match ${a.matchId}: ${a.analysis.slice(0, 200)}...\n`;
      });
    }

    return context;
  }

  // --- Simple Markdown Rendering (sanitised) ---
  // --- Send Message ---
  export async function sendMessage() {
    const text = inputText.trim();
    if (!text || isLoading) return;

    if (text.length > MAX_INPUT_LENGTH) {
      error = `Message too long (${text.length}/${MAX_INPUT_LENGTH} characters).`;
      return;
    }

    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
      error = 'Please wait a moment before sending another message.';
      return;
    }

    error = null;
    inputText = '';

    messages = [...messages, {
      role: 'user',
      content: text,
      timestamp: Date.now()
    }];

    await scrollToBottom();
    isLoading = true;
    lastRequestTime = Date.now();

    try {
      const systemPrompt = await buildSystemPrompt();

      const apiMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages
          .filter(m => m.role !== 'system')
          .slice(-10)
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          ...(!useServerKey && apiKey ? { apiKey } : {})
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: '' }));
        throw new Error(errData.error || `Chat error (${response.status}). Please try again.`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;

      if (!reply) {
        throw new Error('No response from OpenAI. Please try again.');
      }

      messages = [...messages, {
        role: 'assistant',
        content: reply,
        timestamp: Date.now()
      }];
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      messages = [...messages, {
        role: 'system',
        content: errorMessage,
        timestamp: Date.now()
      }];
    } finally {
      isLoading = false;
      await scrollToBottom();
    }
  }

  async function scrollToBottom() {
    await tick();
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function handleKeydown(e: Event) {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Enter' && !ke.shiftKey) {
      ke.preventDefault();
      if (hasApiKey) {
        sendMessage();
      } else {
        saveApiKey();
      }
    }
  }

  export function clearChat() {
    messages = [{
      role: 'system',
      content: 'Chat cleared. Ask me anything about Premier League predictions!',
      timestamp: Date.now()
    }];
  }
</script>

<div class="max-w-2xl mx-auto space-y-4" data-testid="chatbot">
  <!-- Security Notice Banner (only shown when using a user-provided key, not a server key) -->
  {#if hasApiKey && !useServerKey && !showSecurityWarning}
    <button
      on:click={() => showSecurityWarning = true}
      class="w-full flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-left hover:bg-blue-500/15 transition-colors"
    >
      <ShieldAlert class="w-4 h-4 text-blue-500 flex-shrink-0" />
      <p class="text-xs text-blue-400">
        Your API key is routed through our server proxy. <span class="underline">Tap for details.</span>
      </p>
    </button>
  {/if}

  {#if showSecurityWarning}
    <div class="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
      <div class="flex items-start gap-2 mb-2">
        <ShieldAlert class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p class="text-sm font-medium text-blue-400">Security Notice</p>
          <p class="text-xs text-muted-foreground mt-1">
            Oracle Chat routes requests through a server-side proxy.
            Your API key is never sent directly to third-party services from your browser.
          </p>
          <ul class="text-xs text-muted-foreground mt-2 space-y-1">
            <li>• Your key is stored in localStorage (browser only)</li>
            <li>• Your key is sent to our server-side proxy, which forwards it to OpenAI — it is not sent directly from your browser to OpenAI</li>
            <li>• Use a key with spend limits set in your OpenAI dashboard</li>
            <li>• You can remove it anytime via "Change key"</li>
          </ul>
        </div>
      </div>
      <button
        on:click={() => showSecurityWarning = false}
        class="text-xs text-blue-400 hover:underline mt-1"
      >Dismiss</button>
    </div>
  {/if}

  <!-- API Key Setup (hidden when the server has its own key) -->
  {#if !hasApiKey && !useServerKey}
    <Card class="card-glass p-4 sm:p-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 rounded-lg bg-primary/10">
          <Key class="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 class="text-lg font-bold font-display text-foreground">Connect OpenAI</h2>
          <p class="text-xs text-muted-foreground">Your key is stored in your browser only</p>
        </div>
      </div>

      <div class="flex gap-2">
        <input
          type="password"
          bind:value={apiKey}
          placeholder="sk-..."
          class="flex-1 px-3 py-2.5 text-sm rounded-lg border border-border bg-muted text-foreground"
          on:keydown={handleKeydown}
        />
        <Button
          on:click={saveApiKey}
          class="px-4"
        >
          Connect
        </Button>
      </div>

      {#if error}
        <p class="text-xs text-red-500 mt-2 flex items-center gap-1">
          <AlertTriangle class="w-3 h-3" />
          {error}
        </p>
      {/if}

      <p class="text-xs text-muted-foreground mt-3">
        Get an API key from <a href="https://platform.openai.com/api-keys" target="_blank" class="text-primary hover:underline">platform.openai.com</a>.
        You can also configure this in Settings.
      </p>
    </Card>
  {/if}

  <!-- Chat Interface -->
  <Card class="card-glass overflow-hidden flex flex-col" style="height: calc(100vh - 18rem); min-height: 300px;">
    <!-- Chat Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-border/30">
      <div class="flex items-center gap-2">
        <MessageCircle class="w-4 h-4 text-accent" />
        <span class="text-sm font-display font-semibold text-foreground">Oracle Chat</span>
        <span class="w-2 h-2 rounded-full {hasApiKey ? 'bg-emerald-500' : 'bg-muted-foreground'} live-pulse"></span>
      </div>
      <div class="flex items-center gap-1">
        <button
          on:click={clearChat}
          class="p-1.5 rounded-md hover:bg-muted transition-colors"
          title="Clear chat"
        >
          <Trash2 class="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        {#if hasApiKey && !useServerKey}
          <button
            on:click={clearApiKey}
            class="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
          >
            Change key
          </button>
        {/if}
      </div>
    </div>

    <!-- Messages -->
    <div
      bind:this={messagesContainer}
      class="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {#each messages as message}
        <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
          <div class="max-w-[85%] rounded-xl px-3 sm:px-4 py-2.5 text-sm break-words {
            message.role === 'user'
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : message.role === 'system'
                ? 'bg-muted/50 text-muted-foreground italic border border-border/30 rounded-bl-sm'
                : 'bg-muted text-foreground rounded-bl-sm'
          }">
            {#if message.role === 'assistant'}
              <div class="prose-chat">{@html renderMarkdown(message.content)}</div>
            {:else}
              <p style="white-space: pre-wrap;">{message.content}</p>
            {/if}
          </div>
        </div>
      {/each}

      {#if isLoading}
        <div class="flex justify-start">
          <div class="bg-muted rounded-xl px-4 py-3 rounded-bl-sm flex items-center gap-2">
            <Loader2 class="w-4 h-4 text-muted-foreground animate-spin" />
            <span class="text-sm text-muted-foreground">Analysing...</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Input -->
    <div class="px-4 py-3 border-t border-border/30">
      {#if error && hasApiKey}
        <p class="text-xs text-red-500 mb-2 flex items-center gap-1">
          <AlertTriangle class="w-3 h-3" />
          {error}
        </p>
      {/if}
      <div class="flex gap-2">
        <label for="chatbot-input" class="sr-only">Chat message</label>
        <input
          id="chatbot-input"
          type="text"
          bind:value={inputText}
          placeholder={hasApiKey ? 'Ask about predictions, form, or match analysis...' : 'Connect your OpenAI key to start chatting'}
          disabled={!hasApiKey || isLoading}
          maxlength={MAX_INPUT_LENGTH}
          class="flex-1 px-3 py-2.5 text-sm rounded-lg border border-border bg-muted text-foreground disabled:opacity-50"
          on:keydown={handleKeydown}
          data-testid="chatbot-input"
        />
        <Button
          on:click={sendMessage}
          disabled={!hasApiKey || isLoading || !inputText.trim()}
          class="px-3"
          data-testid="chatbot-send"
          aria-label="Send message"
        >
          <Send class="w-4 h-4" />
        </Button>
      </div>
      <p class="text-xs text-muted-foreground mt-1.5 text-right">
        {inputText.length}/{MAX_INPUT_LENGTH}
      </p>
    </div>
  </Card>
</div>

<style>
  .prose-chat :global(strong) {
    font-weight: 600;
    color: inherit;
  }
  .prose-chat :global(em) {
    font-style: italic;
  }
  .prose-chat :global(ul) {
    list-style-type: disc;
    padding-left: 1rem;
  }
  .prose-chat :global(ol) {
    list-style-type: decimal;
    padding-left: 1rem;
  }
  .prose-chat :global(li) {
    margin-left: 0;
    list-style-position: inside;
  }
  .prose-chat :global(code) {
    font-size: 0.75rem;
  }
  .prose-chat :global(pre) {
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
