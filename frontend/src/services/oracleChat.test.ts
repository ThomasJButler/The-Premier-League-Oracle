import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectBackendMode, streamReply } from './oracleChat';

vi.mock('./chatBackendHealth', () => ({
  isBackendAvailable: vi.fn(),
  invalidateBackendHealth: vi.fn(),
}));

import * as health from './chatBackendHealth';

describe('services/oracleChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detectBackendMode returns "rag" when isBackendAvailable resolves true', async () => {
    vi.mocked(health.isBackendAvailable).mockResolvedValue(true);
    const mode = await detectBackendMode();
    expect(mode).toBe('rag');
  });

  it('detectBackendMode returns "server-key" when proxy responds with 400 "Messages array required"', async () => {
    vi.mocked(health.isBackendAvailable).mockResolvedValue(false);
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Messages array required.' }), { status: 400 }),
    );
    const mode = await detectBackendMode();
    expect(mode).toBe('server-key');
  });

  it('detectBackendMode returns "none" when neither RAG nor proxy is available', async () => {
    vi.mocked(health.isBackendAvailable).mockResolvedValue(false);
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('network'));
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
    vi.mocked(globalThis.fetch).mockResolvedValue(
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
