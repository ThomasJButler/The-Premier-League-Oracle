import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

function makeLocalStorageStub(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    _store: store
  };
}

describe('threadsStore (SSR — no localStorage)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('initialises with an empty state when localStorage is undefined', async () => {
    const { threadsStore } = await import('./threads');
    expect(get(threadsStore)).toEqual({ threads: [], activeThreadId: null });
  });

  it('does not throw when mutating in SSR (persist is a no-op)', async () => {
    const { threadsStore } = await import('./threads');
    expect(() => threadsStore.createThread()).not.toThrow();
    expect(get(threadsStore).threads).toHaveLength(1);
  });
});

describe('threadsStore (browser)', () => {
  let ls: ReturnType<typeof makeLocalStorageStub>;

  beforeEach(() => {
    vi.resetModules();
    ls = makeLocalStorageStub();
    vi.stubGlobal('localStorage', ls);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createThread() appends a new thread and marks it active', async () => {
    const { threadsStore } = await import('./threads');
    const t = threadsStore.createThread();
    const state = get(threadsStore);
    expect(state.threads).toHaveLength(1);
    expect(state.threads[0].id).toBe(t.id);
    expect(state.activeThreadId).toBe(t.id);
    expect(t.title).toBe('New thread');
  });

  it('persists state to localStorage under kicker:threads', async () => {
    const { threadsStore, STORAGE_KEY } = await import('./threads');
    threadsStore.createThread();
    const raw = ls.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.threads).toHaveLength(1);
    expect(typeof parsed.activeThreadId).toBe('string');
  });

  it('appendMessage() pushes onto the thread and derives title from first user message', async () => {
    const { threadsStore } = await import('./threads');
    const t = threadsStore.createThread();
    threadsStore.appendMessage(t.id, {
      role: 'user',
      content: 'Talk me through Saturday',
      timestamp: 1
    });
    const state = get(threadsStore);
    expect(state.threads[0].messages).toHaveLength(1);
    expect(state.threads[0].title).toBe('Talk me through Saturday');
  });

  it('truncates derived titles longer than MAX_TITLE_LENGTH', async () => {
    const { threadsStore, MAX_TITLE_LENGTH } = await import('./threads');
    const t = threadsStore.createThread();
    const long = 'a'.repeat(MAX_TITLE_LENGTH + 25);
    threadsStore.appendMessage(t.id, { role: 'user', content: long, timestamp: 1 });
    const title = get(threadsStore).threads[0].title;
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH + 1);
  });

  it('appendDelta() concatenates streamed tokens onto a message', async () => {
    const { threadsStore } = await import('./threads');
    const t = threadsStore.createThread();
    threadsStore.appendMessage(t.id, {
      role: 'assistant',
      content: '',
      timestamp: 1,
      streaming: true
    });
    threadsStore.appendDelta(t.id, 0, 'Right ');
    threadsStore.appendDelta(t.id, 0, 'then.');
    expect(get(threadsStore).threads[0].messages[0].content).toBe('Right then.');
  });

  it('finalizeStreaming() removes the streaming flag on the target message', async () => {
    const { threadsStore } = await import('./threads');
    const t = threadsStore.createThread();
    threadsStore.appendMessage(t.id, {
      role: 'assistant',
      content: 'done',
      timestamp: 1,
      streaming: true
    });
    threadsStore.finalizeStreaming(t.id, 0);
    expect(get(threadsStore).threads[0].messages[0].streaming).toBeUndefined();
  });

  it('setActive() switches activeThreadId only for known threads', async () => {
    const { threadsStore } = await import('./threads');
    const a = threadsStore.createThread();
    const b = threadsStore.createThread();
    threadsStore.setActive(a.id);
    expect(get(threadsStore).activeThreadId).toBe(a.id);
    threadsStore.setActive('does-not-exist');
    expect(get(threadsStore).activeThreadId).toBe(a.id);
    threadsStore.setActive(b.id);
    expect(get(threadsStore).activeThreadId).toBe(b.id);
  });

  it('deleteThread() removes the thread and reassigns active pointer to the latest remaining', async () => {
    const { threadsStore } = await import('./threads');
    const a = threadsStore.createThread();
    const b = threadsStore.createThread();
    threadsStore.setActive(b.id);
    threadsStore.deleteThread(b.id);
    const state = get(threadsStore);
    expect(state.threads.map((t) => t.id)).toEqual([a.id]);
    expect(state.activeThreadId).toBe(a.id);
  });

  it('deleteThread() leaves activeThreadId null when no threads remain', async () => {
    const { threadsStore } = await import('./threads');
    const a = threadsStore.createThread();
    threadsStore.deleteThread(a.id);
    expect(get(threadsStore)).toEqual({ threads: [], activeThreadId: null });
  });

  it('round-trips through localStorage across re-imports', async () => {
    const first = await import('./threads');
    const t = first.threadsStore.createThread();
    first.threadsStore.appendMessage(t.id, {
      role: 'user',
      content: 'persisted',
      timestamp: 1
    });

    vi.resetModules();
    const second = await import('./threads');
    const state = get(second.threadsStore);
    expect(state.threads).toHaveLength(1);
    expect(state.threads[0].messages[0].content).toBe('persisted');
    expect(state.activeThreadId).toBe(t.id);
  });

  it('ignores corrupt localStorage payloads and starts fresh', async () => {
    ls.setItem('kicker:threads', '{not json');
    const { threadsStore } = await import('./threads');
    expect(get(threadsStore)).toEqual({ threads: [], activeThreadId: null });
  });

  it('drops activeThreadId that points at a non-existent thread on load', async () => {
    ls.setItem(
      'kicker:threads',
      JSON.stringify({ threads: [], activeThreadId: 'ghost' })
    );
    const { threadsStore } = await import('./threads');
    expect(get(threadsStore).activeThreadId).toBeNull();
  });

  it('toApiMessages() strips timestamps + empty content for the wire format', async () => {
    const { toApiMessages } = await import('./threads');
    const out = toApiMessages([
      { role: 'user', content: 'hi', timestamp: 1 },
      { role: 'assistant', content: '', timestamp: 2, streaming: true },
      { role: 'assistant', content: 'hello', timestamp: 3 }
    ]);
    expect(out).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' }
    ]);
  });
});
