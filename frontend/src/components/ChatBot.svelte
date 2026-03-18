<script lang="ts">
  import { MessageCircle, Send, Key, Loader2, AlertTriangle, Trash2, ShieldAlert } from 'lucide-svelte';
  import { onMount, tick } from 'svelte';
  import { dataService } from '../services/dataService';
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
  });

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

    return context;
  }

  // --- Simple Markdown Rendering ---
  function renderMarkdown(text: string): string {
    return text
      // Code blocks (triple backtick)
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-background/50 rounded p-2 my-1 text-xs font-mono overflow-x-auto">$1</pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-background/50 rounded px-1 py-0.5 text-xs font-mono">$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Bullet points (lines starting with - or *)
      .replace(/^[\-\*]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      // Numbered lists
      .replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
      // Wrap consecutive <li> in <ul>
      .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="space-y-0.5 my-1">$1</ul>')
      // Line breaks
      .replace(/\n/g, '<br/>');
  }

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

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: apiMessages,
          max_tokens: 800,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 401) {
          throw new Error('Invalid API key. Please check your OpenAI key in the setup above.');
        } else if (status === 429) {
          throw new Error('Rate limited by OpenAI. Please wait a moment and try again.');
        } else {
          throw new Error(`OpenAI API error (${status}). Please try again.`);
        }
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

  function handleKeydown(e: any) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
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
  <!-- Security Warning Banner -->
  {#if hasApiKey && !showSecurityWarning}
    <button
      on:click={() => showSecurityWarning = true}
      class="w-full flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-left hover:bg-amber-500/15 transition-colors"
    >
      <ShieldAlert class="w-4 h-4 text-amber-500 flex-shrink-0" />
      <p class="text-xs text-amber-400">
        Your API key is sent directly to OpenAI from your browser. <span class="underline">Tap for details.</span>
      </p>
    </button>
  {/if}

  {#if showSecurityWarning}
    <div class="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <div class="flex items-start gap-2 mb-2">
        <ShieldAlert class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p class="text-sm font-medium text-amber-400">Security Notice</p>
          <p class="text-xs text-muted-foreground mt-1">
            Oracle Chat sends your OpenAI API key directly from your browser to OpenAI's servers.
            This means your key is visible in your browser's network inspector.
            This is safe on your own device, but avoid using this on shared or public computers.
          </p>
          <ul class="text-xs text-muted-foreground mt-2 space-y-1">
            <li>• Your key is stored in localStorage (browser only)</li>
            <li>• It is never sent to our servers</li>
            <li>• Use a key with spend limits set in your OpenAI dashboard</li>
            <li>• You can remove it anytime via "Change key"</li>
          </ul>
        </div>
      </div>
      <button
        on:click={() => showSecurityWarning = false}
        class="text-xs text-amber-400 hover:underline mt-1"
      >Dismiss</button>
    </div>
  {/if}

  <!-- API Key Setup -->
  {#if !hasApiKey}
    <div class="card-glass p-4 sm:p-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 rounded-lg bg-primary/10">
          <Key class="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 class="text-lg font-bold font-display text-foreground">Connect OpenAI</h2>
          <p class="text-xs text-muted-foreground">Your key stays in your browser, never sent to our servers</p>
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
        <button
          on:click={saveApiKey}
          class="btn btn-primary px-4"
        >
          Connect
        </button>
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
    </div>
  {/if}

  <!-- Chat Interface -->
  <div class="card-glass overflow-hidden flex flex-col" style="height: calc(100vh - 18rem); min-height: 300px;">
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
        {#if hasApiKey}
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
        <input
          type="text"
          bind:value={inputText}
          placeholder={hasApiKey ? 'Ask about predictions, form, or match analysis...' : 'Connect your OpenAI key to start chatting'}
          disabled={!hasApiKey || isLoading}
          maxlength={MAX_INPUT_LENGTH}
          class="flex-1 px-3 py-2.5 text-sm rounded-lg border border-border bg-muted text-foreground disabled:opacity-50"
          on:keydown={handleKeydown}
          data-testid="chatbot-input"
        />
        <button
          on:click={sendMessage}
          disabled={!hasApiKey || isLoading || !inputText.trim()}
          class="btn btn-primary px-3 disabled:opacity-50"
          data-testid="chatbot-send"
        >
          <Send class="w-4 h-4" />
        </button>
      </div>
      <p class="text-xs text-muted-foreground mt-1.5 text-right">
        {inputText.length}/{MAX_INPUT_LENGTH}
      </p>
    </div>
  </div>
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
