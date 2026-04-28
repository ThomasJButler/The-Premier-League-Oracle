import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  // The global setup.ts replaces localStorage with a bare vi.fn() stub, so
  // we wire a plain-object backing store per-test to get real round-trip
  // semantics — same pattern as predictionTracker.test.ts.
  let store: { [key: string]: string };

  beforeEach(() => {
    store = {};
    vi.spyOn(localStorage, 'getItem').mockImplementation((key: string) => store[key] ?? null);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      store[key] = value;
    });
    vi.spyOn(localStorage, 'removeItem').mockImplementation((key: string) => {
      delete store[key];
    });
    vi.spyOn(localStorage, 'clear').mockImplementation(() => {
      store = {};
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loadThreads returns an empty store when no data is persisted', () => {
    const loaded = loadThreads();
    expect(loaded.threads).toEqual([]);
    expect(loaded.activeThreadId).toBeNull();
  });

  it('saveThreads round-trips the store via JSON localStorage', () => {
    const created = createThread('Test thread');
    saveThreads({ threads: [created], activeThreadId: created.id });
    const loaded = loadThreads();
    expect(loaded.threads).toHaveLength(1);
    expect(loaded.threads[0].id).toBe(created.id);
    expect(loaded.activeThreadId).toBe(created.id);
    expect(store[STORAGE_KEY_THREADS]).toBeDefined();
    expect(store[STORAGE_KEY_ACTIVE_THREAD]).toBe(created.id);
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
    store[STORAGE_KEY_LEGACY_HISTORY] = JSON.stringify(legacy);
    migrateLegacyHistory();
    const loaded = loadThreads();
    expect(loaded.threads).toHaveLength(1);
    expect(loaded.threads[0].messages).toHaveLength(3);
    expect(loaded.threads[0].title).toContain('Arsenal');
    expect(loaded.activeThreadId).toBe(loaded.threads[0].id);
    expect(store[STORAGE_KEY_LEGACY_HISTORY]).toBeUndefined();
  });
});
