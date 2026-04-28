/**
 * Oracle Chat backend selection + reply streaming primitive.
 *
 * Extracted from the legacy `components/ChatBot.svelte` for the v3 broadcast
 * redesign (P5a Task 2). The legacy component used plain JSON responses and
 * had no SSE parser; this module is forward-compatible with token-streaming
 * responses (`Content-Type: text/event-stream`) while still handling today's
 * single-shot JSON path. Dispatch happens on the response Content-Type so
 * production keeps working unchanged and a future migration to streaming
 * "just works" without touching callers.
 */

import { isBackendAvailable, invalidateBackendHealth } from './chatBackendHealth';
import type { ChatMessage } from '../lib/oracle/threads';

export type BackendMode = 'rag' | 'server-key' | 'user-key' | 'none';

export interface OracleSendOpts {
  /** Caller-supplied API key when mode === 'user-key'; ignored otherwise. */
  apiKey?: string;
  /** Selected model id (subset of constants.AI_MODELS). Forwarded to the proxy. */
  model: string;
  /** AbortSignal for cancellation (composer "Stop" UI not shipped in MVP). */
  signal?: AbortSignal;
}

export interface OracleSendChunk {
  /** A single text delta from the response. Caller appends to its in-progress assistant message. */
  delta: string;
}

const RAG_ENDPOINT = '/api/oracle/chat/rag';
const PROXY_ENDPOINT = '/api/chat';

let cachedMode: BackendMode | null = null;

/**
 * Probe the available chat backends in priority order:
 *  1. Backend RAG (`/health` via session-cached `isBackendAvailable()`).
 *  2. Vercel chat proxy (`/api/chat`) with a `{ messages: [] }` round-trip;
 *     a 400 with "Messages array required" indicates a configured server key.
 *  3. Fall through to `'none'` — the screen disables the composer.
 *
 * Caches the result in module scope; subsequent `streamReply` calls use the
 * cached mode without re-probing.
 */
export async function detectBackendMode(): Promise<BackendMode> {
  if (await isBackendAvailable()) {
    cachedMode = 'rag';
    return 'rag';
  }

  try {
    const res = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    if (res.status === 400) {
      const data = await res.json().catch(() => null);
      const errText = (data as { error?: string } | null)?.error ?? '';
      if (errText.includes('Messages array required')) {
        cachedMode = 'server-key';
        return 'server-key';
      }
    }
  } catch {
    // Proxy unreachable — fall through to 'none'.
  }

  cachedMode = 'none';
  return 'none';
}

/**
 * POST the conversation to the active backend and yield reply text chunks.
 *
 * Two response shapes are handled transparently:
 *  - `Content-Type: text/event-stream` → SSE frames of the form
 *    `data: {"choices":[{"delta":{"content":"…"}}]}` are parsed and each
 *    delta is yielded as it arrives (forward-compatible with future
 *    streaming endpoints).
 *  - Anything else → the response is read as JSON. RAG responses use
 *    `{ reply: string }`; proxy responses use the OpenAI-ish
 *    `{ choices: [{ message: { content: string } }] }` shape returned by
 *    `frontend/api/chat.ts`. The full content is yielded as a single delta.
 *
 * On 5xx or network failure, the backend health cache is invalidated so the
 * next session-level probe re-checks the RAG endpoint.
 */
export async function* streamReply(
  messages: ChatMessage[],
  opts: OracleSendOpts,
): AsyncGenerator<OracleSendChunk, void, void> {
  const mode = cachedMode ?? 'server-key';
  const useRag = mode === 'rag';
  const endpoint = useRag ? RAG_ENDPOINT : PROXY_ENDPOINT;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useRag && opts.apiKey) {
    headers['X-Anthropic-Key'] = opts.apiKey;
  }

  const trimmed = messages
    .filter((m) => m.role !== 'system')
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));

  const body = useRag
    ? {
        message: trimmed[trimmed.length - 1]?.content ?? '',
        conversation_history: trimmed,
      }
    : {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        model: opts.model,
        ...(mode !== 'server-key' && opts.apiKey ? { apiKey: opts.apiKey } : {}),
      };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    invalidateBackendHealth();
    throw err;
  }

  if (!response.ok) {
    if (response.status >= 500) invalidateBackendHealth();
    const errBody = await response.json().catch(() => null);
    const errText = (errBody as { error?: string } | null)?.error;
    throw new Error(errText || `Chat error (${response.status}).`);
  }

  const contentType = (response.headers.get('Content-Type') ?? '').toLowerCase();
  if (contentType.includes('text/event-stream') && response.body) {
    yield* parseSseStream(response.body);
    return;
  }

  const data = (await response.json().catch(() => null)) as
    | { reply?: string; choices?: Array<{ message?: { content?: string } }> }
    | null;
  const content = useRag
    ? data?.reply
    : data?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.length > 0) {
    yield { delta: content };
  }
}

/**
 * Parse an OpenAI-style SSE stream and yield each `delta.content` as it
 * arrives. Frames are separated by `\n\n`; `data: [DONE]` terminates the
 * stream; malformed frames are skipped silently.
 */
async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<OracleSendChunk, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let frameEnd = buffer.indexOf('\n\n');
    while (frameEnd !== -1) {
      const frame = buffer.slice(0, frameEnd).trim();
      buffer = buffer.slice(frameEnd + 2);
      frameEnd = buffer.indexOf('\n\n');

      if (!frame.startsWith('data:')) continue;
      const payload = frame.slice(5).trim();
      if (payload === '[DONE]') return;

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          yield { delta };
        }
      } catch {
        // Skip malformed frame.
      }
    }
  }
}
