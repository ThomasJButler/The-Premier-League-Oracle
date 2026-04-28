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

const TITLE_FALLBACK = 'New thread';

function nowMs(): number {
  return Date.now();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
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
  if (typeof localStorage === 'undefined') return { threads, activeThreadId };
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
  if (typeof localStorage === 'undefined') return;
  try {
    const trimmed: OracleThreadStore = {
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
    // Storage full / quota — silently drop newest write.
  }
}

export function createThread(title?: string): OracleThread {
  const ts = nowMs();
  return {
    id: newId(),
    title: title ?? TITLE_FALLBACK,
    messages: [],
    createdAt: ts,
    updatedAt: ts,
  };
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

/**
 * One-shot, idempotent: promote legacy `oracle_chat_history` into the first
 * thread of the new store, then delete the legacy key. Mirrors the shape of
 * `lib/constants.ts:migrateLegacyApiKey`. Safe to call on every load.
 */
export function migrateLegacyHistory(): void {
  if (typeof localStorage === 'undefined') return;
  const raw = localStorage.getItem(STORAGE_KEY_LEGACY_HISTORY);
  if (!raw) return;
  // If the new store already holds threads, do not overwrite — just discard the legacy blob.
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
    // Corrupt legacy blob — drop it so the user gets a clean slate next mount.
    localStorage.removeItem(STORAGE_KEY_LEGACY_HISTORY);
  }
}
