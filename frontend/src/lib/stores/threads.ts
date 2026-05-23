import { writable, type Writable } from 'svelte/store';
import type { ChatMessage } from '$lib/server/anthropic';

export type OracleRole = 'user' | 'assistant';

export interface OracleMessage {
  role: OracleRole;
  content: string;
  timestamp: number;
  /** Set on assistant messages while their stream is still open. */
  streaming?: boolean;
}

export interface OracleThread {
  id: string;
  title: string;
  messages: OracleMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface OracleThreadState {
  threads: OracleThread[];
  activeThreadId: string | null;
}

export const STORAGE_KEY = 'kicker:threads';
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

export function deriveTitle(messages: OracleMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return TITLE_FALLBACK;
  const trimmed = firstUser.content.trim();
  if (trimmed.length === 0) return TITLE_FALLBACK;
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_TITLE_LENGTH).trimEnd() + '…';
}

export function toApiMessages(messages: OracleMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.content.length > 0)
    .map((m) => ({ role: m.role, content: m.content }));
}

function readInitial(): OracleThreadState {
  if (typeof localStorage === 'undefined') {
    return { threads: [], activeThreadId: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { threads: [], activeThreadId: null };
    const parsed = JSON.parse(raw) as Partial<OracleThreadState> | null;
    if (!parsed || !Array.isArray(parsed.threads)) {
      return { threads: [], activeThreadId: null };
    }
    const threads = parsed.threads.filter(
      (t): t is OracleThread =>
        !!t &&
        typeof t.id === 'string' &&
        typeof t.title === 'string' &&
        Array.isArray(t.messages)
    );
    const activeThreadId =
      typeof parsed.activeThreadId === 'string' && threads.some((t) => t.id === parsed.activeThreadId)
        ? parsed.activeThreadId
        : null;
    return { threads, activeThreadId };
  } catch {
    return { threads: [], activeThreadId: null };
  }
}

function persist(state: OracleThreadState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const trimmed: OracleThreadState = {
      threads: state.threads.slice(-MAX_THREADS).map((t) => ({
        ...t,
        messages: t.messages.slice(-MAX_MESSAGES_PER_THREAD)
      })),
      activeThreadId: state.activeThreadId
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota / corrupt — drop write silently; in-memory state remains source of truth.
  }
}

const inner: Writable<OracleThreadState> = writable(readInitial());
inner.subscribe(persist);

function update(mutator: (s: OracleThreadState) => OracleThreadState): void {
  inner.update(mutator);
}

function createThread(initialTitle?: string): OracleThread {
  const ts = nowMs();
  const thread: OracleThread = {
    id: newId(),
    title: initialTitle ?? TITLE_FALLBACK,
    messages: [],
    createdAt: ts,
    updatedAt: ts
  };
  update((s) => ({ threads: [...s.threads, thread], activeThreadId: thread.id }));
  return thread;
}

function setActive(threadId: string): void {
  update((s) => {
    if (!s.threads.some((t) => t.id === threadId)) return s;
    return { ...s, activeThreadId: threadId };
  });
}

function deleteThread(threadId: string): void {
  update((s) => {
    const threads = s.threads.filter((t) => t.id !== threadId);
    const activeThreadId =
      s.activeThreadId === threadId ? (threads[threads.length - 1]?.id ?? null) : s.activeThreadId;
    return { threads, activeThreadId };
  });
}

function appendMessage(threadId: string, message: OracleMessage): void {
  update((s) => {
    const threads = s.threads.map((t) => {
      if (t.id !== threadId) return t;
      const messages = [...t.messages, message];
      const titleNeedsDerivation = t.title === TITLE_FALLBACK;
      return {
        ...t,
        messages,
        title: titleNeedsDerivation ? deriveTitle(messages) : t.title,
        updatedAt: nowMs()
      };
    });
    return { ...s, threads };
  });
}

function appendDelta(threadId: string, messageIndex: number, delta: string): void {
  update((s) => {
    const threads = s.threads.map((t) => {
      if (t.id !== threadId) return t;
      const messages = t.messages.map((m, i) =>
        i === messageIndex ? { ...m, content: m.content + delta } : m
      );
      return { ...t, messages, updatedAt: nowMs() };
    });
    return { ...s, threads };
  });
}

function finalizeStreaming(threadId: string, messageIndex: number): void {
  update((s) => {
    const threads = s.threads.map((t) => {
      if (t.id !== threadId) return t;
      const messages = t.messages.map((m, i) => {
        if (i !== messageIndex) return m;
        const { streaming: _streaming, ...rest } = m;
        return rest;
      });
      return { ...t, messages };
    });
    return { ...s, threads };
  });
}

function clearAll(): void {
  inner.set({ threads: [], activeThreadId: null });
}

export const threadsStore = {
  subscribe: inner.subscribe,
  createThread,
  setActive,
  deleteThread,
  appendMessage,
  appendDelta,
  finalizeStreaming,
  clearAll
};
