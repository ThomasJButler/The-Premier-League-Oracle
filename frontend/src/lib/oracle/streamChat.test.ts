import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

function makeLocalStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null
  };
}

function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    }
  });
}

function sseResponse(chunks: string[], init: ResponseInit = {}): Response {
  return new Response(sseBody(chunks), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    ...init
  });
}

interface Loaded {
  streamChat: typeof import('./streamChat').streamChat;
  threadsStore: typeof import('$lib/stores/threads').threadsStore;
}

async function loadFresh(): Promise<Loaded> {
  vi.resetModules();
  vi.stubGlobal('localStorage', makeLocalStorageStub());
  const stream = await import('./streamChat');
  const threads = await import('$lib/stores/threads');
  return { streamChat: stream.streamChat, threadsStore: threads.threadsStore };
}

function seedPlaceholder(
  threadsStore: Loaded['threadsStore']
): { threadId: string; assistantIndex: number } {
  const t = threadsStore.createThread();
  threadsStore.appendMessage(t.id, { role: 'user', content: 'hi', timestamp: 1 });
  threadsStore.appendMessage(t.id, {
    role: 'assistant',
    content: '',
    timestamp: 2,
    streaming: true
  });
  return { threadId: t.id, assistantIndex: 1 };
}

describe('streamChat — K1a-β.2 SSE wiring', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appends deltas onto the placeholder and finalises on [DONE]', async () => {
    const { streamChat, threadsStore } = await loadFresh();
    const { threadId, assistantIndex } = seedPlaceholder(threadsStore);

    const fakeFetch = vi.fn(async () =>
      sseResponse([
        'data: {"delta": "Right "}\n\n',
        'data: {"delta": "then."}\n\n',
        'data: [DONE]\n\n'
      ])
    );

    await streamChat(
      { personaId: 'voice', messages: [{ role: 'user', content: 'hi' }], threadId },
      assistantIndex,
      fakeFetch
    );

    const msg = get(threadsStore).threads[0].messages[assistantIndex];
    expect(msg.content).toBe('Right then.');
    expect(msg.streaming).toBeUndefined();
  });

  it('handles deltas split across chunk boundaries', async () => {
    const { streamChat, threadsStore } = await loadFresh();
    const { threadId, assistantIndex } = seedPlaceholder(threadsStore);

    const fakeFetch = vi.fn(async () =>
      sseResponse([
        'data: {"delta": "Foo',
        '"}\n\ndata: {"del',
        'ta": "Bar"}\n\ndata: [DONE]\n\n'
      ])
    );

    await streamChat(
      { personaId: 'voice', messages: [{ role: 'user', content: 'hi' }], threadId },
      assistantIndex,
      fakeFetch
    );

    expect(get(threadsStore).threads[0].messages[assistantIndex].content).toBe('FooBar');
  });

  it('POSTs JSON to /api/chat with the expected payload shape', async () => {
    const { streamChat, threadsStore } = await loadFresh();
    const { threadId, assistantIndex } = seedPlaceholder(threadsStore);

    const fakeFetch = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => sseResponse(['data: [DONE]\n\n'])
    );

    await streamChat(
      {
        personaId: 'voice',
        messages: [{ role: 'user', content: 'hi' }],
        threadId
      },
      assistantIndex,
      fakeFetch
    );

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = fakeFetch.mock.calls[0];
    expect(url).toBe('/api/chat');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json');
    const body = JSON.parse(init?.body as string);
    expect(body.personaId).toBe('voice');
    expect(body.threadId).toBe(threadId);
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('surfaces HTTP error codes inline as ⚠ {error}', async () => {
    const { streamChat, threadsStore } = await loadFresh();
    const { threadId, assistantIndex } = seedPlaceholder(threadsStore);

    const fakeFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'rate_limited' }), {
          status: 429,
          headers: { 'content-type': 'application/json' }
        })
    );

    await streamChat(
      { personaId: 'voice', messages: [{ role: 'user', content: 'hi' }], threadId },
      assistantIndex,
      fakeFetch
    );

    const msg = get(threadsStore).threads[0].messages[assistantIndex];
    expect(msg.content).toBe('⚠ rate_limited');
    expect(msg.streaming).toBeUndefined();
  });

  it('falls back to ⚠ http_{status} when the error body is not JSON', async () => {
    const { streamChat, threadsStore } = await loadFresh();
    const { threadId, assistantIndex } = seedPlaceholder(threadsStore);

    const fakeFetch = vi.fn(
      async () => new Response('Bad Gateway', { status: 502 })
    );

    await streamChat(
      { personaId: 'voice', messages: [{ role: 'user', content: 'hi' }], threadId },
      assistantIndex,
      fakeFetch
    );

    expect(get(threadsStore).threads[0].messages[assistantIndex].content).toBe('⚠ http_502');
  });

  it('surfaces mid-stream {"error":…} events inline and stops', async () => {
    const { streamChat, threadsStore } = await loadFresh();
    const { threadId, assistantIndex } = seedPlaceholder(threadsStore);

    const fakeFetch = vi.fn(async () =>
      sseResponse([
        'data: {"delta": "partial "}\n\n',
        'data: {"error": "upstream_timeout"}\n\n'
      ])
    );

    await streamChat(
      { personaId: 'voice', messages: [{ role: 'user', content: 'hi' }], threadId },
      assistantIndex,
      fakeFetch
    );

    const msg = get(threadsStore).threads[0].messages[assistantIndex];
    expect(msg.content).toBe('partial ⚠ upstream_timeout');
    expect(msg.streaming).toBeUndefined();
  });

  it('surfaces network errors (fetch rejection) inline', async () => {
    const { streamChat, threadsStore } = await loadFresh();
    const { threadId, assistantIndex } = seedPlaceholder(threadsStore);

    const fakeFetch = vi.fn(async () => {
      throw new Error('offline');
    });

    await streamChat(
      { personaId: 'voice', messages: [{ role: 'user', content: 'hi' }], threadId },
      assistantIndex,
      fakeFetch
    );

    expect(get(threadsStore).threads[0].messages[assistantIndex].content).toBe('⚠ offline');
  });

  it('ignores unparsable SSE events but still finalises the stream', async () => {
    const { streamChat, threadsStore } = await loadFresh();
    const { threadId, assistantIndex } = seedPlaceholder(threadsStore);

    const fakeFetch = vi.fn(async () =>
      sseResponse([
        'data: {"delta": "ok"}\n\n',
        'data: not-json\n\n',
        'data: [DONE]\n\n'
      ])
    );

    await streamChat(
      { personaId: 'voice', messages: [{ role: 'user', content: 'hi' }], threadId },
      assistantIndex,
      fakeFetch
    );

    const msg = get(threadsStore).threads[0].messages[assistantIndex];
    expect(msg.content).toBe('ok');
    expect(msg.streaming).toBeUndefined();
  });
});
