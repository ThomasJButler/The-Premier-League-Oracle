<script lang="ts">
  import { MessageCircle, Send, Key, Loader2, AlertTriangle, Trash2, ShieldAlert } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { onMount, onDestroy, tick } from 'svelte';
  import { renderMarkdown } from '$lib/renderMarkdown';
  import { dataService } from '../services/dataService';
  import { aiAnalysisService } from '../services/aiAnalysis';
  import { isBackendAvailable, invalidateBackendHealth } from '../services/chatBackendHealth';
  import { getSavedAiModel, ANTHROPIC_API_KEY_STORAGE_KEY, migrateLegacyApiKey } from '$lib/constants';
  import {
    getMatchesForTeam,
    getHeadToHead,
    getSeasonMatches,
    getTeamSeasonSummary,
    type CompletedMatch,
  } from '../lib/data/completedMatches';

  // Run the legacy openai_api_key → anthropic_api_key migration once on load.
  migrateLegacyApiKey();
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
  const STORAGE_KEY_API_KEY = ANTHROPIC_API_KEY_STORAGE_KEY;
  const MAX_STORED_MESSAGES = 50;

  // --- State ---
  let apiKey = '';
  let hasApiKey = false;
  let useServerKey = false;
  let useBackendRAG = false;
  let messages: ChatMessage[] = [];
  let inputText = '';
  let isLoading = false;
  let error: string | null = null;
  let messagesContainer: HTMLElement;
  let showSecurityWarning = false;
  let lastRequestTime = 0;

  // --- Lifecycle ---

  // Listen for API key changes from Settings
  function handleExternalKeyChange() {
    const savedKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (savedKey) {
      apiKey = savedKey;
      hasApiKey = true;
    } else if (!useServerKey && !useBackendRAG) {
      apiKey = '';
      hasApiKey = false;
    }
  }

  onMount(() => {
    window.addEventListener('api-key-changed', handleExternalKeyChange);

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
          checkBackendRAG();
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

    checkBackendRAG();
  });

  onDestroy(() => {
    window.removeEventListener('api-key-changed', handleExternalKeyChange);
  });

  /** Check backend RAG availability first, then fall back to the Vercel chat proxy.
   *
   * Priority:
   * 1. Backend RAG (/health) — data-grounded, server-side API key. Probed
   *    ONCE per session via `isBackendAvailable()` — subsequent mounts reuse
   *    the cached flag; the cache is invalidated if a RAG request later fails.
   * 2. Vercel chat proxy (/api/chat) — server-side API key, shallow context
   * 3. User-provided API key — client sends key through proxy
   */
  export async function checkBackendRAG() {
    // 1. Try backend RAG via the session-cached health probe. The cache
    // layer handles the canonical /health path and timeout; see
    // `services/chatBackendHealth.ts`.
    if (await isBackendAvailable()) {
      useBackendRAG = true;
      hasApiKey = true;
      return;
    }

    // 2. Try Vercel chat proxy server key
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
      error = 'Please enter a valid API key.';
      return;
    }
    localStorage.setItem(STORAGE_KEY_API_KEY, trimmed);
    apiKey = trimmed;
    hasApiKey = true;
    error = null;
    window.dispatchEvent(new CustomEvent('api-key-changed'));
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
    window.dispatchEvent(new CustomEvent('api-key-changed'));
  }

  // --- Build Context (batched) ---
  async function buildSystemPrompt(userQuery = ''): Promise<string> {
    // Every fallback-mode answer sits on top of the bundled 33-season match
    // index (frontend/src/lib/data/completedMatches.json). When the user
    // asks a historical question that matches one of the query patterns in
    // `buildGroundedDataBlock`, we pre-resolve the answer and append a
    // GROUNDED DATA block to the system prompt. Claude is instructed to
    // answer ONLY from those rows when present — no confabulating scorelines
    // or inventing "season excluded" claims.
    let context = `You are the Premier League Oracle, an expert football analyst.
You provide insightful predictions and analysis for Premier League matches.
Be concise, data-driven, and confident in your analysis. Use UK English.
Never give financial advice — only discuss statistical probabilities.
Format your responses with markdown: use **bold** for emphasis, bullet points for lists, and \`code\` for statistics.

DATA YOU HAVE ACCESS TO:
- A bundled 33-season completed-match archive (1993/94 – 2025/26, ~12,600 matches) with date, home team, away team, full-time score, and result per match. When the user asks about a specific team + season, a head-to-head, or a past season in general, a GROUNDED DATA block will be appended below. Use ONLY those rows — do not invent scorelines, fabricate match dates, or claim any season is "excluded".
- The current-week snapshot below (live league table, upcoming fixtures for the next 7 days, results from the last 7 days).

DATA YOU DO NOT HAVE:
- Player-level statistics, xG, shot data, possession, cards, or corners beyond what is in the current-week snapshot.
- Tactics, manager quotes, injury news, transfer activity, or anything that isn't in the numeric archive.

If the user asks for something outside these scopes, say so plainly ("I don't have player-level xG data for that fixture, only the final score") rather than refusing or inventing specifics.

Current-week snapshot:\n`;

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

    // Grounded data block from the 33-season archive, if the user's query
    // matches a known historical-data pattern. Appended LAST so Claude reads
    // the fresh archive rows after the current-week snapshot and knows to
    // prefer them for the specific question.
    const grounded = buildGroundedDataBlock(userQuery);
    if (grounded) {
      context += '\n' + grounded;
    }

    return context;
  }

  /**
   * Pattern-match the user's raw query against a handful of common
   * historical-data shapes and pre-resolve the answer from the bundled
   * 33-season match index. Returns a `GROUNDED DATA (33-season archive):`
   * markdown block ready to splice into the system prompt, or '' when no
   * pattern matches (letting the chat fall through to general reasoning).
   *
   * Patterns handled:
   *   • "<team> (home|away) wins in YYYY/YY"      → getMatchesForTeam
   *   • "<teamA> vs <teamB>" / "head-to-head"     → getHeadToHead
   *   • "<team> season YYYY/YY"                   → getTeamSeasonSummary + matches
   *   • "YYYY/YY season"                          → getSeasonMatches
   */
  function buildGroundedDataBlock(rawQuery: string): string {
    if (!rawQuery || rawQuery.length < 6) return '';
    const query = rawQuery.toLowerCase();
    const seasonMatch = query.match(/20\d{2}[/-]?\d{2}/);
    const season = seasonMatch ? normaliseSeason(seasonMatch[0]) : undefined;

    // Catch team names by scanning known CSV teams — API names vary
    // enough that regex alone is fragile.
    const teamNames = extractTeamNames(rawQuery);

    // Pattern 1: "<teamA> vs|v|against <teamB>" — head-to-head
    if (teamNames.length >= 2) {
      const h2h = getHeadToHead(teamNames[0], teamNames[1], { season, limit: 20 });
      if (h2h.length > 0) {
        return formatMatchTable(
          `Head-to-head: ${teamNames[0]} vs ${teamNames[1]}${season ? ` (${season})` : ''}`,
          h2h,
        );
      }
    }

    // Pattern 2: "<team> home|away wins|losses|draws in YYYY/YY"
    if (teamNames.length === 1) {
      const team = teamNames[0];
      const venue = /\b(at home|home (wins|results|matches|games)|home\b.*in)/.test(query)
        ? 'home'
        : /\b(away (wins|results|matches|games)|away\b.*in|on the road)/.test(query)
          ? 'away'
          : undefined;
      const result = /\b(wins?|victories)\b/.test(query)
        ? 'W'
        : /\b(losses?|defeats?)\b/.test(query)
          ? 'L'
          : /\b(draws?)\b/.test(query)
            ? 'D'
            : undefined;

      if (season || venue || result) {
        const matches = getMatchesForTeam(team, { season, venue, result });
        if (matches.length > 0) {
          const venueLabel = venue === 'home' ? ' home' : venue === 'away' ? ' away' : '';
          const resultLabel = result === 'W' ? ' wins' : result === 'L' ? ' losses' : result === 'D' ? ' draws' : ' matches';
          const seasonLabel = season ? ` in ${season}` : '';
          return formatMatchTable(
            `${team}${venueLabel}${resultLabel}${seasonLabel}`,
            matches,
          );
        }
      }

      // "<team> season YYYY/YY" → full summary + fixture list
      if (season) {
        const summary = getTeamSeasonSummary(team, season);
        const matches = getMatchesForTeam(team, { season });
        if (summary) {
          const header = `${team} — ${season} season summary\n\n` +
            `- **Played:** ${summary.played}  ` +
            `**Wins:** ${summary.wins}  ` +
            `**Draws:** ${summary.draws}  ` +
            `**Losses:** ${summary.losses}\n` +
            `- **Goals for:** ${summary.goalsFor}  ` +
            `**Goals against:** ${summary.goalsAgainst}  ` +
            `**Goal difference:** ${summary.goalsFor - summary.goalsAgainst > 0 ? '+' : ''}${summary.goalsFor - summary.goalsAgainst}\n`;
          return formatMatchTable(header + `\n${team} fixtures (${season})`, matches);
        }
      }
    }

    // Pattern 3: "<YYYY/YY> season" alone — whole-season overview
    if (season && teamNames.length === 0 && /\bseason\b/.test(query)) {
      const matches = getSeasonMatches(season);
      if (matches.length > 0) {
        // Cap the injected rows — a full season is 380 lines, too much for
        // the context window. Summarise with a sample instead.
        const homeWins = matches.filter((m) => m.result === 'H').length;
        const draws = matches.filter((m) => m.result === 'D').length;
        const awayWins = matches.filter((m) => m.result === 'A').length;
        const totalGoals = matches.reduce((sum, m) => sum + m.homeGoals + m.awayGoals, 0);
        const header = `Premier League ${season} season overview\n\n` +
          `- **Matches:** ${matches.length}  ` +
          `**Home wins:** ${homeWins}  ` +
          `**Draws:** ${draws}  ` +
          `**Away wins:** ${awayWins}\n` +
          `- **Total goals:** ${totalGoals}  ` +
          `**Goals per match:** ${(totalGoals / matches.length).toFixed(2)}\n`;
        return `GROUNDED DATA (33-season archive):\n\n${header}\n\nUse ONLY the numbers above for any season-wide claim. Do not invent specific team results unless the user asks for them — ask me for a team breakdown if they want match-by-match for a specific club.\n`;
      }
    }

    return '';
  }

  /** 'YYYY/YY' normalisation for user inputs like '2023/24', '2023-24', '202324'. */
  function normaliseSeason(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 6) return `${digits.slice(0, 4)}/${digits.slice(4)}`;
    if (digits.length === 8) return `${digits.slice(0, 4)}/${digits.slice(6)}`;
    return raw;
  }

  /**
   * Find canonical team names mentioned in the query. Uses a hardcoded list
   * of CSV-style names and a few common API aliases. Returns them in the
   * order they appear so "Arsenal vs Chelsea" and "Chelsea vs Arsenal" both
   * resolve correctly.
   */
  function extractTeamNames(rawQuery: string): string[] {
    const knownTeams: ReadonlyArray<{ match: RegExp; canonical: string }> = [
      { match: /\barsenal\b/i, canonical: 'Arsenal' },
      { match: /\baston villa\b/i, canonical: 'Aston Villa' },
      { match: /\bbournemouth\b/i, canonical: 'Bournemouth' },
      { match: /\bbrentford\b/i, canonical: 'Brentford' },
      { match: /\bbrighton\b/i, canonical: 'Brighton' },
      { match: /\bburnley\b/i, canonical: 'Burnley' },
      { match: /\bchelsea\b/i, canonical: 'Chelsea' },
      { match: /\bcrystal palace\b|\bpalace\b/i, canonical: 'Crystal Palace' },
      { match: /\beverton\b/i, canonical: 'Everton' },
      { match: /\bfulham\b/i, canonical: 'Fulham' },
      { match: /\bipswich\b/i, canonical: 'Ipswich' },
      { match: /\bleeds\b/i, canonical: 'Leeds' },
      { match: /\bleicester\b/i, canonical: 'Leicester' },
      { match: /\bliverpool\b/i, canonical: 'Liverpool' },
      { match: /\bluton\b/i, canonical: 'Luton' },
      { match: /\bman city\b|\bmanchester city\b/i, canonical: 'Man City' },
      { match: /\bman united\b|\bman utd\b|\bmanchester united\b|\bman u\b/i, canonical: 'Man United' },
      { match: /\bnewcastle\b/i, canonical: 'Newcastle' },
      { match: /\bnottingham forest\b|\bnotts forest\b|\bnot[ts]? forest\b/i, canonical: "Nott'm Forest" },
      { match: /\bsheffield united\b|\bsheff united\b|\bsheff utd\b/i, canonical: 'Sheffield United' },
      { match: /\bsouthampton\b/i, canonical: 'Southampton' },
      { match: /\bsunderland\b/i, canonical: 'Sunderland' },
      { match: /\bspurs\b|\btottenham\b/i, canonical: 'Tottenham' },
      { match: /\bwest ham\b/i, canonical: 'West Ham' },
      { match: /\bwolves\b|\bwolverhampton\b/i, canonical: 'Wolves' },
    ];

    const hits: { name: string; index: number }[] = [];
    for (const { match, canonical } of knownTeams) {
      const m = rawQuery.match(match);
      if (m && typeof m.index === 'number') hits.push({ name: canonical, index: m.index });
    }
    hits.sort((a, b) => a.index - b.index);
    // De-dupe while preserving order
    const seen = new Set<string>();
    return hits.filter((h) => (seen.has(h.name) ? false : (seen.add(h.name), true))).map((h) => h.name);
  }

  /** Render a compact markdown table of matches for Claude to read. */
  function formatMatchTable(title: string, matches: CompletedMatch[]): string {
    if (matches.length === 0) return '';
    const rows = matches.map((m) => {
      const resultLabel = m.result === 'H' ? 'H' : m.result === 'A' ? 'A' : 'D';
      return `| ${m.season} | ${m.date} | ${m.home} ${m.homeGoals}-${m.awayGoals} ${m.away} | ${resultLabel} |`;
    }).join('\n');
    return `GROUNDED DATA (33-season archive):\n\n**${title}** — ${matches.length} match${matches.length === 1 ? '' : 'es'}\n\n| Season | Date | Match | Result |\n|---|---|---|---|\n${rows}\n\nUse ONLY these rows to answer the user's question. Do not invent scorelines, dates, or teams. If the user asks for something not in the rows (e.g. goal scorers or shot counts), explain those aren't in the archive.\n`;
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
      let reply: string | null = null;

      // Try backend RAG first (data-grounded, server-side API key)
      if (useBackendRAG) {
        reply = await sendViaBackendRAG(text);
      }

      // Fall back to Vercel chat proxy if backend RAG failed or unavailable
      if (!reply) {
        reply = await sendViaFallbackProxy(text);
      }

      if (!reply) {
        throw new Error('No response received. Please try again.');
      }

      messages = [...messages, {
        role: 'assistant',
        content: reply,
        timestamp: Date.now()
      }];
    } catch (err: unknown) {
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

  /** Send via backend RAG endpoint — returns reply or null on failure. */
  async function sendViaBackendRAG(text: string): Promise<string | null> {
    try {
      const conversationHistory = messages
        .filter(m => m.role !== 'system')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      // Pass user's Anthropic API key as header if no server key is configured
      if (apiKey && !useServerKey) {
        headers['X-Anthropic-Key'] = apiKey;
      }

      const response = await fetch('/api/oracle/chat/rag', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          conversation_history: conversationHistory,
        }),
      });

      if (!response.ok) {
        // Server-side failure — invalidate the session cache so the next
        // probe re-checks backend health. 4xx (client-side) is not a health
        // signal, so leave the cache alone.
        if (response.status >= 500) {
          invalidateBackendHealth();
          console.warn(`[ChatBot] Backend RAG returned ${response.status}; falling back to proxy and invalidating health cache.`);
        }
        return null;
      }

      const data = await response.json();
      return data.reply || null;
    } catch {
      // Backend unreachable — invalidate and fall back.
      invalidateBackendHealth();
      console.warn('[ChatBot] Backend RAG unreachable; falling back to proxy and invalidating health cache.');
      return null;
    }
  }

  /** Send via Vercel chat proxy (fallback) — throws on failure. */
  async function sendViaFallbackProxy(text: string): Promise<string | null> {
    // Pass the raw user query through so buildSystemPrompt's grounded-data
    // injector can pattern-match it against the 33-season archive.
    const systemPrompt = await buildSystemPrompt(text);

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
        model: getSavedAiModel(),
        ...(!useServerKey && apiKey ? { apiKey } : {})
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: '' }));
      throw new Error(errData.error || `Chat error (${response.status}). Please try again.`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
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
  <!-- Security Notice Banner (only shown when using a user-provided key, not a server/backend key) -->
  {#if hasApiKey && !useServerKey && !useBackendRAG && !showSecurityWarning}
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
            <li>• Your key is sent to our server-side proxy, which forwards it to Anthropic — it is not sent directly from your browser</li>
            <li>• Use a key with spend limits set in your Anthropic console</li>
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

  <!-- API Key Setup (hidden when server/backend has its own key) -->
  {#if !hasApiKey && !useServerKey && !useBackendRAG}
    <Card class="card-glass p-4 sm:p-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 rounded-lg bg-primary/10">
          <Key class="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 class="text-lg font-bold font-display text-foreground">Connect Anthropic</h2>
          <p class="text-xs text-muted-foreground">Your key is stored in your browser only</p>
        </div>
      </div>

      <div class="flex gap-2">
        <input
          type="password"
          bind:value={apiKey}
          placeholder="sk-ant-..."
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
        Get a key from the <a href="https://console.anthropic.com/settings/keys" target="_blank" class="text-primary hover:underline">Anthropic Console</a>.
        Choose the model in Settings.
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
        {#if useBackendRAG}
          <span class="text-[10px] text-emerald-400 font-medium">RAG</span>
        {/if}
        <span class="w-2 h-2 rounded-full {hasApiKey ? 'bg-emerald-500' : 'bg-muted-foreground'} live-pulse"></span>
      </div>
      <div class="flex items-center gap-1">
        <button
          on:click={clearChat}
          class="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Clear chat"
        >
          <Trash2 class="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        {#if apiKey}
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
          placeholder={hasApiKey ? 'Ask about predictions, form, or match analysis...' : 'Connect your Anthropic key to start chatting'}
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
