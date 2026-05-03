# P5a — Oracle Chat

**Status:** plan-ready, awaiting loop pickup.
**Gate:** Manual (overall). Tasks 1–4 are auto-gated sub-slices; Task 5 closes the slice and is the human eyeball.
**Tag at sign-off:** `v3.15`.
**Spec reference:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 → "Oracle Chat (`/oracle`) — Phase 3" (lines 562–569).
**Closes:** Sub-phase 3.3 (Oracle hub is a single-slice sub-phase).

## Goal

Build the `/oracle` Oracle Chat hub screen — a 3-column broadcast-style layout that wraps the existing `frontend/api/chat.ts` Vercel Edge proxy + RAG-backend fallback in the new design system. Replace the `<Route path="/oracle"><ChatBot /></Route>` mount in `App.svelte` with `<OracleChat />`, and drop the legacy `import ChatBot` line in the same Task-5 commit (P5a is the last consumer of `ChatBot.svelte` — pre-flight grep must confirm zero remaining importers).

The slice introduces **multi-thread chat** as a genuinely new capability. The legacy `ChatBot.svelte` stores a single conversation under `localStorage[oracle_chat_history]`; spec § 6.7 calls for "saved threads list" + "[New thread] button" with active-thread highlighting. P5a ships a `lib/oracle/threads.ts` storage module that owns the multi-thread CRUD, plus a one-shot migration that promotes the legacy single-thread history into the first thread of the new store.

Strangler-fig contract: `ChatBot.svelte` + `ChatBot.test.ts` stay in tree (unimported after Task 5) until P10 cleanup. The legacy `frontend/src/services/chatBackendHealth.ts` module is **reused unchanged** by the new `services/oracleChat.ts` — same session-cached `isBackendAvailable()` helper.

## Surface area

- **New screen:** `frontend/src/screens/oracle/OracleChat.svelte` (+ `.test.ts`)
- **New components in** `frontend/src/components/oracle/`:
  - `ThreadRail.svelte` (+ `.test.ts`) — left rail (240px), saved threads list + `[New thread]` button
  - `Composer.svelte` (+ `.test.ts`) — bottom of centre column, textarea + quick-prompt chip row
  - `MessageList.svelte` (+ `.test.ts`) — scrolling centre column, role-styled message bubbles + markdown rendering
  - `ContextPanel.svelte` (+ `.test.ts`) — right rail (280px, hidden < `lg`), KPI tiles + "Recently discussed fixtures"
- **New helper:** `frontend/src/lib/oracle/threads.ts` (+ `.test.ts`) — multi-thread CRUD + legacy-history migration
- **New service:** `frontend/src/services/oracleChat.ts` (+ `.test.ts`) — backend-mode probe + SSE streaming primitive (extracted from `ChatBot.svelte` with no behavioural change)
- **Modified:** `frontend/src/App.svelte` — `<Route path="/oracle">` swaps from `<ChatBot />` to `<OracleChat />`; `import ChatBot from './components/ChatBot.svelte';` line dropped on the same commit
- **Read-only deps:** existing `services/chatBackendHealth.ts`, `services/dataService.ts`, `services/predictionTracker.ts`, `services/aiAnalysis.ts`, `lib/data/completedMatches.ts`, `lib/renderMarkdown.ts`, atoms (`KpiTile`, `Icon`), `components/MatchRow.svelte`, `lib/constants.ts`, `lib/adapters/v3.ts`, `frontend/api/chat.ts`

Legacy `ChatBot.svelte` and `ChatBot.test.ts` are **not** modified — they stay in tree (unimported after Task 5) until P10 cleanup.

## Type contracts

### Thread storage shape

```ts
// frontend/src/lib/oracle/threads.ts

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: number;
}

export interface OracleThread {
  /** Stable opaque identifier — `crypto.randomUUID()` at creation. */
  id: string;
  /** Auto-derived from first user message (max 40 chars + ellipsis); user-editable later (out of scope for MVP). */
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface OracleThreadStore {
  threads: OracleThread[];
  activeThreadId: string | null;
}

export const STORAGE_KEY_THREADS = 'oracle_threads';
export const STORAGE_KEY_ACTIVE_THREAD = 'oracle_active_thread';
export const STORAGE_KEY_LEGACY_HISTORY = 'oracle_chat_history';
export const MAX_TITLE_LENGTH = 40;
export const MAX_THREADS = 20;
export const MAX_MESSAGES_PER_THREAD = 50;
```

Public API:

```ts
export function loadThreads(): OracleThreadStore;
export function saveThreads(store: OracleThreadStore): void;
export function createThread(title?: string): OracleThread;
export function deriveTitle(messages: ChatMessage[]): string;
export function appendMessage(threadId: string, message: ChatMessage): void;
export function setActiveThread(threadId: string): void;
export function deleteThread(threadId: string): void;
export function migrateLegacyHistory(): void; // one-shot, idempotent
```

### Backend-mode + SSE primitives

```ts
// frontend/src/services/oracleChat.ts

export type BackendMode = 'rag' | 'server-key' | 'user-key' | 'none';

export interface OracleSendOpts {
  /** Caller-supplied API key when mode === 'user-key'; ignored otherwise. */
  apiKey?: string;
  /** Selected model id (subset of constants.AI_MODELS). Forwarded to the proxy. */
  model: string;
  /** AbortSignal for cancellation (composer "Stop" — out of MVP scope but honoured if passed). */
  signal?: AbortSignal;
}

export interface OracleSendChunk {
  /** A single text delta from the SSE stream. Caller appends to its in-progress assistant message. */
  delta: string;
}

export async function detectBackendMode(): Promise<BackendMode>;

export async function* streamReply(
  messages: ChatMessage[],
  opts: OracleSendOpts,
): AsyncGenerator<OracleSendChunk, void, void>;
```

`detectBackendMode()` re-uses `chatBackendHealth.isBackendAvailable()` for the RAG probe and the same 400-`Messages array required` round-trip the legacy `ChatBot.checkBackendRAG()` uses to detect a server-side key.

`streamReply()` POSTs to the chosen endpoint (`/health/ask` for RAG, `/api/chat` for the proxy), parses the SSE / NDJSON response, and yields `{ delta }` chunks. The body shape and parser logic are ported verbatim from `ChatBot.svelte` (lines ~330–540) with no behavioural change.

### OracleChat.svelte screen state

```ts
let store: OracleThreadStore;
let activeThread: OracleThread | null;
let backendMode: BackendMode = 'none';
let inputText = '';
let isStreaming = false;
let error: string | null = null;
let streamingAssistantContent = '';

$: messagesForRender = activeThread?.messages ?? [];
$: hasApiAccess = backendMode !== 'none';
$: recentlyDiscussedFixtures = deriveRecentFixtures(activeThread, allFixtures);
```

`deriveRecentFixtures` is an inline helper inside `ContextPanel.svelte` (not exported) that scans the active thread's user messages for team names that appear in `dataService.getMatches({ upcoming: true, days: 7 })` and returns up to 3 matching fixtures. Cheap derivation — no API roundtrips.

## Reference patterns

- **Single-screen hub plan template:** `p3a-fixtures-live.md`. Same surface-area-then-tasks structure, same manual-gate close, same App.svelte mount-and-stop pattern.
- **Multi-component hub plan template:** `p4d-predictions-tools.md`. Closest analogue: one screen file composing multiple new sibling components (`Tools` ↔ `KellyCalculator` + `ValueScanner`), service-layer touch (`betHistoryService` removal), and a same-commit legacy-import drop.
- **localStorage migration pattern:** `lib/constants.ts:migrateLegacyApiKey()` — one-shot, idempotent, reads-old-write-new-then-delete-old. Re-use the same shape for `migrateLegacyHistory()`.
- **SSE streaming reference:** `ChatBot.svelte` lines ~330–540 — the EventSource / fetch-stream parser. Port verbatim into `services/oracleChat.ts:streamReply`.
- **KPI tile usage:** `screens/Today.svelte` — 4 `<KpiTile>`s reading `predictionTracker.getAccuracyStats()`. Right rail in this slice does the same with picks + accuracy.

## Markers verified pre-flight

Before Task 1 starts, ralph greps the codebase to confirm:

```bash
# Confirm /oracle currently mounts ChatBot (so the swap target is correct)
grep -rn 'path="/oracle"' frontend/src/App.svelte
# expect: <Route path="/oracle"><ChatBot /></Route>

# Confirm ChatBot is imported only in App.svelte (so the same-commit-drop is safe)
grep -rn "import ChatBot" frontend/src/
# expect: only frontend/src/App.svelte:21 + the co-located ChatBot.test.ts:N

# Confirm chatBackendHealth is the live RAG probe (so service can reuse it)
grep -rn "isBackendAvailable" frontend/src/
# expect: hits in services/chatBackendHealth.ts (definition) + components/ChatBot.svelte (consumer)

# Confirm the legacy localStorage key
grep -rn "oracle_chat_history" frontend/src/
# expect: only ChatBot.svelte + ChatBot.test.ts

# Confirm KpiTile + MatchRow exports for ContextPanel
grep -rn "from.*atoms/KpiTile" frontend/src/screens/
grep -rn "from.*MatchRow" frontend/src/components/
```

If any pre-flight grep returns unexpected hits, ralph stops and records the discrepancy in `IMPLEMENTATION_PLAN.md` `## Notes / discoveries` before continuing.

## Known limitations baked in

1. **MVP excludes thread rename and delete-confirm modal.** `[New thread]` works; clicking a saved thread switches focus; `deleteThread()` is exported from the lib for testability but no UI wires to it in MVP. Rename and delete-confirm move to a follow-up slice (recorded in the rollover note).
2. **Right rail "Recently discussed fixtures" uses naive team-name substring match** against the current week snapshot. Fuzzy matching, alias resolution, and historical-fixture lookup are out of scope. Misses are silent — empty rail when no matches.
3. **Composer "Stop" / abort UI is not shipped in MVP.** The `streamReply` generator accepts an `AbortSignal` for testability, but the screen does not render a stop button. Streaming completes naturally or errors out.
4. **Quick-prompt chips are static copy** per spec § 6.7: `["Why does the model favour X?", "Show value bets for Saturday", "Explain the Brier score"]`. Future personalisation (e.g. injecting the supporting club's name into "Why does the model favour Arsenal?") is a follow-up.
5. **Mobile layout collapses to single column** (drops both rails); a "Threads" button at top of centre column triggers a `<MobileBottomSheet>` showing the thread list. Right-rail context panel is dropped entirely on mobile (not a sheet) — keeps the chat surface uncluttered.
6. **Markdown rendering reuses** `lib/renderMarkdown.ts` verbatim. Embedded `<ProbBar>` / fixture-chip / citation-footnote rendering inside assistant messages (spec § 6.7 second-rail bullet) is **deferred** to a follow-up slice — MVP renders structured content as plain markdown only. Logged in `## Known limitations` and the rollover note.

## TDD task list

Each task is one ralph iteration. Tasks 1–4 are auto-gated sub-slices (commit when vitest + svelte-check green; flag the parent P5a checkbox unchanged). Task 5 is manual-gated and closes the slice.

Test count budget: **32 new tests across 7 new files**. Baseline at start of P5a: 900/900 across 76 files. Expected at end of P5a: **932/932 across 83 files**.

### Task 1 — `lib/oracle/threads.ts` + 7 helper tests *(auto-gated sub-step)*

Pure module. No DOM, no network. Drives off `localStorage` only.

**Test file: `frontend/src/lib/oracle/threads.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEY_THREADS,
  STORAGE_KEY_ACTIVE_THREAD,
  STORAGE_KEY_LEGACY_HISTORY,
  loadThreads,
  saveThreads,
  createThread,
  deriveTitle,
  appendMessage,
  setActiveThread,
  migrateLegacyHistory,
} from './threads';

describe('lib/oracle/threads', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('loadThreads returns an empty store when no data is persisted', () => {
    const store = loadThreads();
    expect(store.threads).toEqual([]);
    expect(store.activeThreadId).toBeNull();
  });

  it('saveThreads round-trips the store via JSON localStorage', () => {
    const created = createThread('Test thread');
    saveThreads({ threads: [created], activeThreadId: created.id });
    const loaded = loadThreads();
    expect(loaded.threads).toHaveLength(1);
    expect(loaded.threads[0].id).toBe(created.id);
    expect(loaded.activeThreadId).toBe(created.id);
  });

  it('deriveTitle pulls the first user message and trims to 40 chars + ellipsis', () => {
    const long = 'Why does the model favour Liverpool over Manchester City this weekend?';
    const messages = [
      { role: 'system' as const, content: 'welcome', timestamp: 1 },
      { role: 'user' as const, content: long, timestamp: 2 },
    ];
    const title = deriveTitle(messages);
    expect(title.length).toBeLessThanOrEqual(43); // 40 + '...'
    expect(title.endsWith('…') || title.endsWith('...')).toBe(true);
    expect(title).toContain('Why does the model favour');
  });

  it('deriveTitle falls back to "New thread" when no user message exists', () => {
    expect(deriveTitle([])).toBe('New thread');
    expect(deriveTitle([{ role: 'system', content: 'welcome', timestamp: 1 }])).toBe('New thread');
  });

  it('appendMessage adds to the named thread and bumps updatedAt', async () => {
    const t = createThread();
    saveThreads({ threads: [t], activeThreadId: t.id });
    const before = t.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    appendMessage(t.id, { role: 'user', content: 'hi', timestamp: Date.now() });
    const after = loadThreads().threads.find((th) => th.id === t.id)!;
    expect(after.messages).toHaveLength(1);
    expect(after.updatedAt).toBeGreaterThan(before);
  });

  it('setActiveThread persists the active id and is read back by loadThreads', () => {
    const a = createThread();
    const b = createThread();
    saveThreads({ threads: [a, b], activeThreadId: a.id });
    setActiveThread(b.id);
    expect(loadThreads().activeThreadId).toBe(b.id);
  });

  it('migrateLegacyHistory promotes oracle_chat_history into the first thread and removes the legacy key', () => {
    const legacy = [
      { role: 'system', content: 'welcome', timestamp: 1 },
      { role: 'user', content: 'Will Arsenal win on Saturday?', timestamp: 2 },
      { role: 'assistant', content: 'Likely — model gives 62%.', timestamp: 3 },
    ];
    localStorage.setItem(STORAGE_KEY_LEGACY_HISTORY, JSON.stringify(legacy));
    migrateLegacyHistory();
    const store = loadThreads();
    expect(store.threads).toHaveLength(1);
    expect(store.threads[0].messages).toHaveLength(3);
    expect(store.threads[0].title).toContain('Arsenal');
    expect(store.activeThreadId).toBe(store.threads[0].id);
    expect(localStorage.getItem(STORAGE_KEY_LEGACY_HISTORY)).toBeNull();
  });
});
```

**Implementation outline — `frontend/src/lib/oracle/threads.ts`:**

```ts
export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage { role: ChatRole; content: string; timestamp: number; }
export interface OracleThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
export interface OracleThreadStore {
  threads: OracleThread[];
  activeThreadId: string | null;
}

export const STORAGE_KEY_THREADS = 'oracle_threads';
export const STORAGE_KEY_ACTIVE_THREAD = 'oracle_active_thread';
export const STORAGE_KEY_LEGACY_HISTORY = 'oracle_chat_history';
export const MAX_TITLE_LENGTH = 40;
export const MAX_THREADS = 20;
export const MAX_MESSAGES_PER_THREAD = 50;

const TITLE_FALLBACK = 'New thread';

function nowMs(): number { return Date.now(); }

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `t_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return TITLE_FALLBACK;
  const trimmed = firstUser.content.trim();
  if (trimmed.length === 0) return TITLE_FALLBACK;
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_TITLE_LENGTH).trimEnd() + '…';
}

export function loadThreads(): OracleThreadStore {
  let threads: OracleThread[] = [];
  let activeThreadId: string | null = null;
  try {
    const rawT = localStorage.getItem(STORAGE_KEY_THREADS);
    if (rawT) {
      const parsed = JSON.parse(rawT);
      if (Array.isArray(parsed?.threads)) threads = parsed.threads;
    }
    const rawA = localStorage.getItem(STORAGE_KEY_ACTIVE_THREAD);
    if (rawA) activeThreadId = rawA;
  } catch {
    // Corrupt storage — treat as empty.
  }
  return { threads, activeThreadId };
}

export function saveThreads(store: OracleThreadStore): void {
  try {
    const trimmed = {
      ...store,
      threads: store.threads.slice(-MAX_THREADS).map((t) => ({
        ...t,
        messages: t.messages.slice(-MAX_MESSAGES_PER_THREAD),
      })),
    };
    localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(trimmed));
    if (store.activeThreadId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_THREAD, store.activeThreadId);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_THREAD);
    }
  } catch {
    // Storage full — silently drop newest write.
  }
}

export function createThread(title?: string): OracleThread {
  const ts = nowMs();
  return { id: newId(), title: title ?? TITLE_FALLBACK, messages: [], createdAt: ts, updatedAt: ts };
}

export function appendMessage(threadId: string, message: ChatMessage): void {
  const store = loadThreads();
  const thread = store.threads.find((t) => t.id === threadId);
  if (!thread) return;
  thread.messages.push(message);
  thread.updatedAt = nowMs();
  if (thread.title === TITLE_FALLBACK || thread.messages.length === 1) {
    thread.title = deriveTitle(thread.messages);
  }
  saveThreads(store);
}

export function setActiveThread(threadId: string): void {
  const store = loadThreads();
  if (!store.threads.some((t) => t.id === threadId)) return;
  store.activeThreadId = threadId;
  saveThreads(store);
}

export function deleteThread(threadId: string): void {
  const store = loadThreads();
  store.threads = store.threads.filter((t) => t.id !== threadId);
  if (store.activeThreadId === threadId) {
    store.activeThreadId = store.threads[0]?.id ?? null;
  }
  saveThreads(store);
}

export function migrateLegacyHistory(): void {
  const raw = localStorage.getItem(STORAGE_KEY_LEGACY_HISTORY);
  if (!raw) return;
  // If new-store already has data, do not overwrite — just delete legacy.
  const existing = loadThreads();
  if (existing.threads.length > 0) {
    localStorage.removeItem(STORAGE_KEY_LEGACY_HISTORY);
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem(STORAGE_KEY_LEGACY_HISTORY);
      return;
    }
    const messages = parsed as ChatMessage[];
    const thread = createThread(deriveTitle(messages));
    thread.messages = messages;
    thread.updatedAt = nowMs();
    saveThreads({ threads: [thread], activeThreadId: thread.id });
    localStorage.removeItem(STORAGE_KEY_LEGACY_HISTORY);
  } catch {
    localStorage.removeItem(STORAGE_KEY_LEGACY_HISTORY);
  }
}
```

**TDD-discipline check:** all 7 tests fail pre-fix (module doesn't exist → import throws). All 7 pass post-fix.

**Validation:** `cd frontend && npm run test -- --run src/lib/oracle/threads.test.ts` → expect **7/7 pass**. Full suite: **907/907 across 77 files**.

### Task 2 — `services/oracleChat.ts` + 4 tests *(auto-gated sub-step)*

Network primitives extracted from `ChatBot.svelte`. No UI; pure async generator + mode-detection function. Tests use `vi.spyOn(globalThis, 'fetch')` and the `chatBackendHealth` mock pattern already in `chatBackendHealth.test.ts`.

**Test file: `frontend/src/services/oracleChat.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectBackendMode, streamReply } from './oracleChat';

vi.mock('./chatBackendHealth', () => ({
  isBackendAvailable: vi.fn(),
  invalidateBackendHealth: vi.fn(),
}));

import * as health from './chatBackendHealth';

describe('services/oracleChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detectBackendMode returns "rag" when isBackendAvailable resolves true', async () => {
    (health.isBackendAvailable as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const mode = await detectBackendMode();
    expect(mode).toBe('rag');
  });

  it('detectBackendMode returns "server-key" when proxy responds with 400 "Messages array required"', async () => {
    (health.isBackendAvailable as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Messages array required' }), { status: 400 }),
    );
    const mode = await detectBackendMode();
    expect(mode).toBe('server-key');
  });

  it('detectBackendMode returns "none" when neither RAG nor proxy is available', async () => {
    (health.isBackendAvailable as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
    const mode = await detectBackendMode();
    expect(mode).toBe('none');
  });

  it('streamReply yields concatenated text deltas from an SSE-shaped response body', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
        controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n'));
        controller.enqueue(enc.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    );
    const chunks: string[] = [];
    for await (const c of streamReply(
      [{ role: 'user', content: 'hi', timestamp: 0 }],
      { model: 'claude-haiku-4-5-20251001' },
    )) {
      chunks.push(c.delta);
    }
    expect(chunks.join('')).toBe('Hello world');
  });
});
```

**Implementation outline — `frontend/src/services/oracleChat.ts`:**

Port the priority-chain probe from `ChatBot.svelte:checkBackendRAG` (lines ~111–138) into `detectBackendMode`. Port the SSE parser from `ChatBot.svelte` (the `ReadableStream` + `TextDecoder` block) into `streamReply` as an `async function*`. Reuse the `Anthropic-style` JSON shape that the proxy already returns (the OpenAI-ish normalisation done by `frontend/api/chat.ts`).

Key implementation notes:
- `streamReply` accepts `(messages, opts)` and POSTs to `/api/chat` (proxy mode) or `/health/ask` (RAG mode), depending on `detectBackendMode()`'s last result. Cache the mode in module-scoped `let lastMode` to avoid re-probing on every send (invalidate on stream error).
- Header set: `Content-Type: application/json` always; `Authorization: Bearer ${opts.apiKey}` only when mode === 'user-key'.
- Body shape: `{ messages, model }` matches `frontend/api/chat.ts:36-95`'s expectation.
- Stream parser: read `data: <json>\n\n` frames, ignore `data: [DONE]`, extract `choices[0].delta.content` as the delta string.

**TDD-discipline check:** all 4 tests fail pre-fix (`streamReply` / `detectBackendMode` don't exist). All 4 pass post-fix.

**Validation:** `cd frontend && npm run test -- --run src/services/oracleChat.test.ts` → expect **4/4 pass**. Full suite: **911/911 across 78 files**.

### Task 3 — `Composer.svelte` + `MessageList.svelte` + 8 tests *(auto-gated sub-step)*

Two presentational components paired in one task because both are small (≤80 lines each) and conceptually the chat-pair UI surface.

**Composer.svelte** props:
```ts
export let value: string;                       // bound from parent
export let disabled: boolean = false;           // true while streaming
export let onSubmit: (text: string) => void;
export let onPickPrompt: (text: string) => void;
export let placeholder: string = 'Ask the Oracle…';
export const QUICK_PROMPTS = [
  'Why does the model favour X?',
  'Show value bets for Saturday',
  'Explain the Brier score',
];
```

Markers: `[data-composer]`, `[data-quick-prompt]` (one per chip), `[data-textarea]`, `[data-submit]`. Enter submits when textarea isn't empty + not disabled; Shift+Enter inserts a newline (default browser behaviour, just don't preventDefault). 500-char `maxlength`.

**MessageList.svelte** props:
```ts
export let messages: ChatMessage[];
export let streamingContent: string = '';       // appended live as the active assistant reply
export let isStreaming: boolean = false;
```

Markers: `[data-message-list]`, `[data-message]` per row, `data-role={role}` on each row. Empty state when `messages.length === 0`: `[data-message-list-empty]` rendering the welcome copy. Markdown via `lib/renderMarkdown.ts` for assistant + system roles; user role plain text. `streamingContent` rendered as a trailing assistant bubble with `[data-streaming]` marker when `isStreaming`.

**Test files** (4 each):

```ts
// frontend/src/components/oracle/Composer.test.ts
import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Composer from './Composer.svelte';

describe('Composer', () => {
  it('renders textarea + 3 quick-prompt chips', () => {
    const { container } = render(Composer, { props: { value: '', onSubmit: vi.fn(), onPickPrompt: vi.fn() } });
    expect(container.querySelector('[data-composer]')).toBeTruthy();
    expect(container.querySelector('[data-textarea]')).toBeTruthy();
    expect(container.querySelectorAll('[data-quick-prompt]')).toHaveLength(3);
  });

  it('clicking a quick-prompt chip calls onPickPrompt with the chip text', async () => {
    const onPickPrompt = vi.fn();
    const { container } = render(Composer, { props: { value: '', onSubmit: vi.fn(), onPickPrompt } });
    const chips = container.querySelectorAll<HTMLButtonElement>('[data-quick-prompt]');
    await fireEvent.click(chips[0]);
    expect(onPickPrompt).toHaveBeenCalledWith(expect.stringContaining('Why does the model favour'));
  });

  it('Enter (no shift) on a non-empty textarea calls onSubmit with the value', async () => {
    const onSubmit = vi.fn();
    const { container } = render(Composer, { props: { value: 'hello', onSubmit, onPickPrompt: vi.fn() } });
    const ta = container.querySelector<HTMLTextAreaElement>('[data-textarea]')!;
    await fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false });
    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('disabled prop hides the submit button or marks it disabled', () => {
    const { container } = render(Composer, { props: { value: 'hi', disabled: true, onSubmit: vi.fn(), onPickPrompt: vi.fn() } });
    const submit = container.querySelector<HTMLButtonElement>('[data-submit]');
    expect(submit?.disabled).toBe(true);
  });
});
```

```ts
// frontend/src/components/oracle/MessageList.test.ts
import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import MessageList from './MessageList.svelte';

describe('MessageList', () => {
  it('renders an empty state when messages is empty', () => {
    const { container } = render(MessageList, { props: { messages: [] } });
    expect(container.querySelector('[data-message-list-empty]')).toBeTruthy();
  });

  it('renders one [data-message] row per message with data-role attribute', () => {
    const { container } = render(MessageList, {
      props: {
        messages: [
          { role: 'user', content: 'hi', timestamp: 1 },
          { role: 'assistant', content: 'hello', timestamp: 2 },
        ],
      },
    });
    const rows = container.querySelectorAll('[data-message]');
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('data-role')).toBe('user');
    expect(rows[1].getAttribute('data-role')).toBe('assistant');
  });

  it('renders streamingContent as a trailing [data-streaming] bubble when isStreaming', () => {
    const { container } = render(MessageList, {
      props: {
        messages: [{ role: 'user', content: 'go', timestamp: 1 }],
        streamingContent: 'thinking',
        isStreaming: true,
      },
    });
    expect(container.querySelector('[data-streaming]')?.textContent).toContain('thinking');
  });

  it('does not render [data-streaming] bubble when isStreaming is false', () => {
    const { container } = render(MessageList, {
      props: { messages: [{ role: 'user', content: 'go', timestamp: 1 }], streamingContent: 'leftover', isStreaming: false },
    });
    expect(container.querySelector('[data-streaming]')).toBeNull();
  });
});
```

**TDD-discipline check:** all 8 tests fail pre-fix. All 8 pass post-fix.

**Validation:** `cd frontend && npm run test -- --run src/components/oracle/Composer.test.ts src/components/oracle/MessageList.test.ts` → expect **8/8 pass**. Full suite: **919/919 across 80 files**.

### Task 4 — `ThreadRail.svelte` + `ContextPanel.svelte` + 7 tests *(auto-gated sub-step)*

The two rail components paired in one task — both are presentational, no network, no streaming.

**ThreadRail.svelte** props:
```ts
export let threads: OracleThread[];
export let activeThreadId: string | null;
export let onSelect: (id: string) => void;
export let onNewThread: () => void;
```

Markers: `[data-thread-rail]`, `[data-thread]` per thread row, `data-active="true"` on the active row, `[data-new-thread]` on the button. Each thread row shows: title + last message preview (first 60 chars of last assistant or user message) + relative timestamp ("2m ago" / "Yesterday" / formatted date). Active row gets `bg-card-raised border-l-2 border-primary`.

**ContextPanel.svelte** props:
```ts
export let stats: { totalPicks: number; accuracy: number; brierScore: number } | null;
export let recentFixtures: Fixture[];           // from lib/adapters/v3
```

Markers: `[data-context-panel]`, `[data-kpi-grid]`, `[data-recent-fixtures]`, `[data-fixture-row]` per fixture, `[data-context-empty]` when both stats absent and no fixtures. Two `<KpiTile>`s: Picks (totalPicks) + Accuracy (accuracy%). Recent fixtures section uses `<MatchRow>` rows.

**Test counts:** 4 ThreadRail + 3 ContextPanel = 7 total.

```ts
// frontend/src/components/oracle/ThreadRail.test.ts
import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ThreadRail from './ThreadRail.svelte';

const t = (id: string, title: string) => ({
  id, title, messages: [{ role: 'user' as const, content: title, timestamp: 1 }], createdAt: 1, updatedAt: 1,
});

describe('ThreadRail', () => {
  it('renders one [data-thread] per thread + a [data-new-thread] button', () => {
    const { container } = render(ThreadRail, {
      props: { threads: [t('a', 'A'), t('b', 'B')], activeThreadId: null, onSelect: vi.fn(), onNewThread: vi.fn() },
    });
    expect(container.querySelectorAll('[data-thread]')).toHaveLength(2);
    expect(container.querySelector('[data-new-thread]')).toBeTruthy();
  });

  it('clicking a thread row calls onSelect with the thread id', async () => {
    const onSelect = vi.fn();
    const { container } = render(ThreadRail, {
      props: { threads: [t('a', 'A')], activeThreadId: null, onSelect, onNewThread: vi.fn() },
    });
    await fireEvent.click(container.querySelector('[data-thread]')!);
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('marks the active thread with data-active="true"', () => {
    const { container } = render(ThreadRail, {
      props: { threads: [t('a', 'A'), t('b', 'B')], activeThreadId: 'b', onSelect: vi.fn(), onNewThread: vi.fn() },
    });
    const rows = container.querySelectorAll('[data-thread]');
    expect(rows[0].getAttribute('data-active')).not.toBe('true');
    expect(rows[1].getAttribute('data-active')).toBe('true');
  });

  it('clicking [data-new-thread] calls onNewThread', async () => {
    const onNewThread = vi.fn();
    const { container } = render(ThreadRail, {
      props: { threads: [], activeThreadId: null, onSelect: vi.fn(), onNewThread },
    });
    await fireEvent.click(container.querySelector('[data-new-thread]')!);
    expect(onNewThread).toHaveBeenCalledTimes(1);
  });
});
```

```ts
// frontend/src/components/oracle/ContextPanel.test.ts
import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ContextPanel from './ContextPanel.svelte';

const fixture = (id: string) => ({
  id, kickoff: new Date().toISOString(), home: { name: 'Liverpool', short: 'LIV', crest: '' },
  away: { name: 'Arsenal', short: 'ARS', crest: '' }, status: 'SCHEDULED' as const, gameweek: 35,
});

describe('ContextPanel', () => {
  it('renders empty state when no stats and no fixtures', () => {
    const { container } = render(ContextPanel, { props: { stats: null, recentFixtures: [] } });
    expect(container.querySelector('[data-context-empty]')).toBeTruthy();
  });

  it('renders KPI tiles when stats are provided', () => {
    const { container } = render(ContextPanel, {
      props: { stats: { totalPicks: 42, accuracy: 67.5, brierScore: 0.21 }, recentFixtures: [] },
    });
    expect(container.querySelector('[data-kpi-grid]')).toBeTruthy();
    expect(container.textContent).toContain('42');
    expect(container.textContent).toContain('67.5');
  });

  it('renders one [data-fixture-row] per recent fixture (cap 3)', () => {
    const { container } = render(ContextPanel, {
      props: { stats: null, recentFixtures: [fixture('1'), fixture('2'), fixture('3'), fixture('4')] },
    });
    const rows = container.querySelectorAll('[data-fixture-row]');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.length).toBeLessThanOrEqual(3);
  });
});
```

**TDD-discipline check:** all 7 tests fail pre-fix. All 7 pass post-fix.

**Validation:** `cd frontend && npm run test -- --run src/components/oracle/ThreadRail.test.ts src/components/oracle/ContextPanel.test.ts` → expect **7/7 pass**. Full suite: **926/926 across 82 files**.

### Task 5 — `screens/oracle/OracleChat.svelte` + 6 tests + route mount swap *(manual-gated, closes P5a)*

The screen composes the four collaborator components, owns the thread state, the streaming state, and wires `services/oracleChat.ts:streamReply`. Same commit drops the legacy `import ChatBot` line in `App.svelte`.

**Test file: `frontend/src/screens/oracle/OracleChat.test.ts`** (6 tests):

```ts
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OracleChat from './OracleChat.svelte';

vi.mock('svelte-routing', async () => {
  const LinkStub = (await import('../../tests/LinkStub.svelte')).default;
  return { Link: LinkStub, navigate: vi.fn() };
});

vi.mock('../../services/oracleChat', () => ({
  detectBackendMode: vi.fn().mockResolvedValue('rag'),
  streamReply: vi.fn(),
}));

vi.mock('../../services/dataService', () => ({
  dataService: {
    getMatches: vi.fn().mockResolvedValue([]),
    getStandings: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getAccuracyStats: vi.fn().mockReturnValue({ totalPicks: 0, accuracy: 0, brierScore: 0 }),
  },
}));

import * as oracleChat from '../../services/oracleChat';

describe('OracleChat', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('mounts with [data-screen="oracle"] root', () => {
    const { container } = render(OracleChat);
    expect(container.querySelector('[data-screen="oracle"]')).toBeTruthy();
  });

  it('seeds an empty thread on first mount when no localStorage data exists', async () => {
    const { container } = render(OracleChat);
    await waitFor(() => {
      expect(container.querySelector('[data-thread]')).toBeTruthy();
    });
  });

  it('migrates legacy oracle_chat_history into a single thread on mount', async () => {
    localStorage.setItem(
      'oracle_chat_history',
      JSON.stringify([{ role: 'user', content: 'Will Arsenal win?', timestamp: 1 }]),
    );
    const { container } = render(OracleChat);
    await waitFor(() => {
      const rail = container.querySelector('[data-thread-rail]');
      expect(rail?.textContent).toContain('Will Arsenal win?');
    });
    expect(localStorage.getItem('oracle_chat_history')).toBeNull();
  });

  it('clicking [data-new-thread] adds a thread to the rail', async () => {
    const { container } = render(OracleChat);
    await waitFor(() => container.querySelector('[data-new-thread]'));
    const before = container.querySelectorAll('[data-thread]').length;
    await fireEvent.click(container.querySelector('[data-new-thread]')!);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-thread]').length).toBeGreaterThan(before);
    });
  });

  it('renders 3 KPI tiles + recent fixtures section in the right rail', async () => {
    const { container } = render(OracleChat);
    await waitFor(() => container.querySelector('[data-context-panel]'));
    expect(container.querySelector('[data-kpi-grid]')).toBeTruthy();
    expect(container.querySelector('[data-recent-fixtures]')).toBeTruthy();
  });

  it('submitting the composer calls streamReply with the user message', async () => {
    (oracleChat.streamReply as unknown as ReturnType<typeof vi.fn>).mockImplementation(async function* () {
      yield { delta: 'OK' };
    });
    const { container } = render(OracleChat);
    await waitFor(() => container.querySelector('[data-textarea]'));
    const ta = container.querySelector<HTMLTextAreaElement>('[data-textarea]')!;
    await fireEvent.input(ta, { target: { value: 'Hi' } });
    await fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false });
    await waitFor(() => {
      expect(oracleChat.streamReply).toHaveBeenCalled();
    });
  });
});
```

**Implementation outline — `frontend/src/screens/oracle/OracleChat.svelte`:**

```svelte
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
  import { predictionTracker } from '../../services/predictionTracker';
  import { matchToFixture } from '../../lib/adapters/v3';
  import { getSavedAiModel, ANTHROPIC_API_KEY_STORAGE_KEY } from '$lib/constants';

  let store: OracleThreadStore = { threads: [], activeThreadId: null };
  let backendMode: BackendMode = 'none';
  let inputText = '';
  let isStreaming = false;
  let streamingContent = '';
  let recentFixtures: ReturnType<typeof matchToFixture>[] = [];
  let stats = predictionTracker.getAccuracyStats();

  $: activeThread = store.threads.find((t) => t.id === store.activeThreadId) ?? null;

  onMount(async () => {
    migrateLegacyHistory();
    store = loadThreads();
    if (store.threads.length === 0) {
      const t = createThread();
      store = { threads: [t], activeThreadId: t.id };
      saveThreads(store);
    }
    backendMode = await detectBackendMode();
    const upcoming = await dataService.getMatches({ upcoming: true, days: 7 });
    recentFixtures = upcoming.slice(0, 3).map(matchToFixture);
    stats = predictionTracker.getAccuracyStats();
  });

  function handleSelect(id: string) {
    setActiveThread(id);
    store = loadThreads();
  }

  function handleNewThread() {
    const t = createThread();
    store = { threads: [...store.threads, t], activeThreadId: t.id };
    saveThreads(store);
  }

  function handlePickPrompt(text: string) {
    inputText = text;
  }

  async function handleSubmit(text: string) {
    if (!activeThread || isStreaming) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    const userMsg: ChatMessage = { role: 'user', content: trimmed, timestamp: Date.now() };
    appendMessage(activeThread.id, userMsg);
    store = loadThreads();
    inputText = '';
    isStreaming = true;
    streamingContent = '';
    try {
      const apiKey = localStorage.getItem(ANTHROPIC_API_KEY_STORAGE_KEY) ?? undefined;
      for await (const chunk of streamReply([...activeThread!.messages, userMsg], {
        model: getSavedAiModel(),
        apiKey,
      })) {
        streamingContent += chunk.delta;
      }
      const assistantMsg: ChatMessage = { role: 'assistant', content: streamingContent, timestamp: Date.now() };
      appendMessage(activeThread!.id, assistantMsg);
      store = loadThreads();
    } catch {
      // Surface a system message on stream error.
      appendMessage(activeThread!.id, {
        role: 'system',
        content: 'Streaming failed — please retry.',
        timestamp: Date.now(),
      });
      store = loadThreads();
    } finally {
      streamingContent = '';
      isStreaming = false;
    }
  }
</script>

<div data-screen="oracle" class="grid grid-cols-1 lg:grid-cols-[240px_1fr_280px] gap-4 h-full">
  <aside class="hidden lg:block">
    <ThreadRail
      threads={store.threads}
      activeThreadId={store.activeThreadId}
      onSelect={handleSelect}
      onNewThread={handleNewThread}
    />
  </aside>

  <section class="flex flex-col min-h-0">
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

  <aside class="hidden lg:block" data-context-panel>
    <ContextPanel {stats} {recentFixtures} />
  </aside>
</div>
```

**App.svelte route swap** (same commit):

```svelte
<!-- Before -->
import ChatBot from './components/ChatBot.svelte';
<Route path="/oracle"><ChatBot /></Route>

<!-- After -->
import OracleChat from './screens/oracle/OracleChat.svelte';
<Route path="/oracle"><OracleChat /></Route>
```

The `import ChatBot` line is **dropped** on the same commit. Pre-flight grep at the top of Task 5:

```bash
grep -rn "import ChatBot" frontend/src/
# expect: only frontend/src/App.svelte:21 + co-located ChatBot.test.ts:N
```

If the grep returns any other importer (e.g. an unexpected screen still mounting `ChatBot` directly), ralph stops and records the discovery in `## Notes / discoveries` before continuing. The legacy `ChatBot.svelte` itself stays in tree — only the App.svelte import is dropped. `ChatBot.test.ts` still imports it (its own `describe` block) and continues to pass; P10 cleanup deletes both files together.

**TDD-discipline check:** all 6 OracleChat tests fail pre-fix (screen doesn't exist). All 6 pass post-fix.

**Validation:**
- `cd frontend && npm run test -- --run` → expect **932/932 across 83 files** (+6 OracleChat tests, +1 file)
- `cd frontend && npm run check` → 0/0
- `cd frontend && npx playwright test --project=desktop-chrome routing.spec.ts` → expect **32/32** (the `/oracle-chat → /oracle` redirect at routing.spec.ts test #N silently end-to-end-validates the new mount)

### Task 5 commit — files to commit (verify intentional before staging)

- `frontend/src/lib/oracle/threads.ts` (Task 1)
- `frontend/src/lib/oracle/threads.test.ts` (Task 1)
- `frontend/src/services/oracleChat.ts` (Task 2)
- `frontend/src/services/oracleChat.test.ts` (Task 2)
- `frontend/src/components/oracle/Composer.svelte` (Task 3)
- `frontend/src/components/oracle/Composer.test.ts` (Task 3)
- `frontend/src/components/oracle/MessageList.svelte` (Task 3)
- `frontend/src/components/oracle/MessageList.test.ts` (Task 3)
- `frontend/src/components/oracle/ThreadRail.svelte` (Task 4)
- `frontend/src/components/oracle/ThreadRail.test.ts` (Task 4)
- `frontend/src/components/oracle/ContextPanel.svelte` (Task 4)
- `frontend/src/components/oracle/ContextPanel.test.ts` (Task 4)
- `frontend/src/screens/oracle/OracleChat.svelte` (Task 5)
- `frontend/src/screens/oracle/OracleChat.test.ts` (Task 5)
- `frontend/src/App.svelte` (Task 5 route mount swap + drop legacy `import ChatBot` line)
- `IMPLEMENTATION_PLAN.md` (Active phase narrative + discovery note + checklist comment)

**Commit message (Task 5):**

```
P5a Task 5: mount OracleChat at /oracle, drop legacy ChatBot import

screens/oracle/OracleChat.svelte composes ThreadRail + MessageList +
Composer + ContextPanel into a 3-column broadcast layout. Multi-thread
chat backed by lib/oracle/threads.ts; one-shot legacy migration of
oracle_chat_history into a single seed thread. Backend selection +
SSE streaming live in services/oracleChat.ts (extracted from
ChatBot.svelte unchanged).

App.svelte: <Route path="/oracle"> swaps from <ChatBot /> to <OracleChat />,
import ChatBot line dropped (P5a is the last consumer; legacy file
stays in tree until P10).

vitest 932/932 across 83 files (+32 across 7 new files: threads 7,
oracleChat service 4, Composer 4, MessageList 4, ThreadRail 4,
ContextPanel 3, OracleChat screen 6).
svelte-check 0/0.
Playwright routing.spec.ts 32/32 on desktop-chrome (covers
/oracle-chat → /oracle redirect).

Manual gate: P5a's [ ] stays unchecked pending sweep at /oracle;
checklist surfaced in IMPLEMENTATION_PLAN.md.
Tag at sign-off → v3.15.
```

## Validation summary (end of Task 5)

- vitest **932/932 across 83 files** (+32 across 7 new files vs. 900/76 baseline)
- svelte-check **0/0**
- Playwright `routing.spec.ts` **32/32** on desktop-chrome
- Manual visual sweep checklist surfaced (below) — required for sign-off

## Manual sweep checklist

Boot `cd frontend && npm run dev`, navigate to `http://localhost:5173/oracle`.

```
[ ] /oracle — page lays out as 3 columns at ≥1024px width:
    240px thread rail (left), centre column with messages + composer,
    280px context rail (right)
[ ] /oracle — left rail shows the seed thread highlighted as active,
    [New thread] button below the list
[ ] /oracle — clicking [New thread] adds a fresh row; clicking back
    on an old thread restores its messages in the centre
[ ] /oracle — type a question, hit Enter — a user bubble appears
    immediately, an assistant bubble streams in token-by-token,
    composer textarea clears, Enter is disabled while streaming
[ ] /oracle — Shift+Enter inserts a newline in the composer
    (does NOT submit)
[ ] /oracle — quick-prompt chip click fills the composer with the
    chip text (and does not submit)
[ ] /oracle — assistant response renders markdown (bold, lists, code)
    via lib/renderMarkdown.ts
[ ] /oracle — right rail KPI tiles read picks + accuracy from
    predictionTracker.getAccuracyStats(); "Recently discussed
    fixtures" shows up to 3 MatchRow rows when matches are upcoming,
    or an empty state otherwise
[ ] /oracle — refresh the page — active thread + message history
    persist via localStorage (oracle_threads, oracle_active_thread)
[ ] /oracle — open DevTools Application → localStorage:
      • oracle_chat_history (legacy) does NOT exist (was deleted
        post-migration if it had been seeded)
      • oracle_threads contains the active thread store as JSON
[ ] /oracle — resize <1024px — both rails collapse, centre column
    fills width, composer + messages still functional, no horizontal
    scroll
[ ] /oracle — toggle theme — every bubble + rail item flips cleanly
[ ] /oracle-chat — old URL still redirects to /oracle (covered by
    routing.spec.ts test #N — should not regress)
[ ] DevTools Network — POST /api/chat fires once per submit (NOT once
    per delta); response Content-Type is text/event-stream;
    response body streams chunked
[ ] DevTools Network — GET /health fires once per session at first
    /oracle mount (RAG probe, may 404 in dev = backendMode falls
    through to server-key)
```

## Sign-off action

Flip P5a's `[ ]` → `[x]` in `IMPLEMENTATION_PLAN.md` Phase 3 checklist, then `git tag v3.15 <P5a-Task-5-commit-sha>`. **Closes Sub-phase 3.3 (Oracle Chat).** Next slice is **P7a — Insights Top Scorers** — plan grooming first, since `p7a-…md` doesn't exist yet.

## Rollover notes for the next loop

- `lib/oracle/threads.ts` exports `deleteThread()` but no UI consumes it in MVP. Wire a thread-row delete affordance + confirm modal in a follow-up slice when the spec gets a thread-management section.
- Composer currently lacks an abort/Stop button while streaming. `streamReply` accepts an `AbortSignal`; the screen could expose `<button onclick={() => controller.abort()}>Stop</button>` next to the submit button. Keep behind a follow-up slice.
- Spec § 6.7 calls for embedded `<ProbBar>` / fixture chips / numbered citations inside assistant messages. MVP ships plain markdown only. A "structured response" follow-up slice would add a thin parser (e.g. `<oracle:probbar home="0.42" draw="0.28" away="0.30" />` tags emitted by Claude → custom Svelte renderer). Plumbing-only — no UI primitive new.
- The `services/oracleChat.ts` extraction is **complete** but `ChatBot.svelte` still has its own copy of the SSE parser inline. Since `ChatBot.svelte` is dropped from `App.svelte` in Task 5 and slated for P10 deletion, there is no need to refactor it to consume the new service — let it die in P10.
- The `aiAnalysisService.getRecentAnalyses(3)` call in `ChatBot.buildSystemPrompt` is **not** ported into `services/oracleChat.ts` for MVP — the new screen builds a simpler system prompt inline. If grounding parity with the legacy chat matters, port `buildSystemPrompt` and `buildGroundedDataBlock` into `services/oracleChat.ts` as a follow-up.
