<script lang="ts">
  import { MessageCircle, Send, Key, Loader2, AlertTriangle, Trash2 } from 'lucide-svelte';
  import { onMount, tick } from 'svelte';
  import { dataService } from '../services/dataService';
  import type { Standing, Match } from '../types';

  // --- Types ---
  interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }

  // --- State ---
  let apiKey = '';
  let hasApiKey = false;
  let messages: ChatMessage[] = [];
  let inputText = '';
  let isLoading = false;
  let error: string | null = null;
  let messagesContainer: HTMLElement;

  // Rate limiting: min 3s between requests
  let lastRequestTime = 0;
  const MIN_REQUEST_INTERVAL = 3000;
  const MAX_INPUT_LENGTH = 500;

  // --- Lifecycle ---
  onMount(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
      apiKey = savedKey;
      hasApiKey = true;
    }

    // Welcome message
    messages = [{
      role: 'system',
      content: 'Welcome to Oracle Chat! Ask me anything about Premier League predictions, team form, match analysis, or betting strategy.',
      timestamp: Date.now()
    }];
  });

  // --- API Key Management ---
  function saveApiKey() {
    const trimmed = apiKey.trim();
    if (!trimmed || trimmed.length < 10) {
      error = 'Please enter a valid OpenAI API key.';
      return;
    }
    localStorage.setItem('openai_api_key', trimmed);
    apiKey = trimmed;
    hasApiKey = true;
    error = null;
  }

  function clearApiKey() {
    localStorage.removeItem('openai_api_key');
    apiKey = '';
    hasApiKey = false;
    messages = [{
      role: 'system',
      content: 'API key removed. Enter a new key to continue chatting.',
      timestamp: Date.now()
    }];
  }

  // --- Build Context ---
  async function buildSystemPrompt(): Promise<string> {
    let context = `You are the Premier League Oracle, an expert football analyst.
You provide insightful predictions and analysis for Premier League matches.
Be concise, data-driven, and confident in your analysis. Use UK English.
Reference real statistics when available. If you're uncertain, say so.
Never give financial advice — only discuss statistical probabilities.

Current data:\n`;

    try {
      const standings: Standing[] = await dataService.getStandings();
      if (standings.length > 0) {
        context += '\nLeague Table (top 6):\n';
        standings.slice(0, 6).forEach((s: any) => {
          context += `${s.position}. ${s.team.shortName || s.team.name} - ${s.points}pts (W${s.won} D${s.draw} L${s.lost}, GD ${s.goalDifference})\n`;
        });
      }
    } catch {
      context += '\nLeague table: unavailable\n';
    }

    try {
      const upcoming: Match[] = await dataService.getMatches({ upcoming: true, days: 7 });
      if (upcoming.length > 0) {
        context += '\nUpcoming matches (next 7 days):\n';
        upcoming.slice(0, 5).forEach((m: Match) => {
          const date = new Date(m.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          context += `${m.home_team} vs ${m.away_team} (${date})\n`;
        });
      }
    } catch {
      context += '\nUpcoming matches: unavailable\n';
    }

    try {
      const recent: Match[] = await dataService.getMatches({ recent: true, days: 7 });
      const finished = recent.filter((m: Match) => m.result);
      if (finished.length > 0) {
        context += '\nRecent results:\n';
        finished.slice(0, 5).forEach((m: Match) => {
          context += `${m.home_team} ${m.home_goals}-${m.away_goals} ${m.away_team}\n`;
        });
      }
    } catch {
      context += '\nRecent results: unavailable\n';
    }

    return context;
  }

  // --- Send Message ---
  async function sendMessage() {
    const text = inputText.trim();
    if (!text || isLoading) return;

    // Input validation
    if (text.length > MAX_INPUT_LENGTH) {
      error = `Message too long (${text.length}/${MAX_INPUT_LENGTH} characters).`;
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
      error = 'Please wait a moment before sending another message.';
      return;
    }

    error = null;
    inputText = '';

    // Add user message
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

      // Build message history for API (last 10 messages, excluding system UI messages)
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

  function clearChat() {
    messages = [{
      role: 'system',
      content: 'Chat cleared. Ask me anything about Premier League predictions!',
      timestamp: Date.now()
    }];
  }
</script>

<div class="max-w-2xl mx-auto space-y-4" data-testid="chatbot">
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
        Get an API key from <a href="https://platform.openai.com/api-keys" target="_blank" class="text-primary hover:underline">platform.openai.com</a>
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
            <p style="white-space: pre-wrap;">{message.content}</p>
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
