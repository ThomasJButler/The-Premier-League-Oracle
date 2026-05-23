import { threadsStore } from '$lib/stores/threads';
import type { ChatMessage } from '$lib/server/anthropic';

export interface StreamChatPayload {
  personaId: string;
  messages: ChatMessage[];
  threadId: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const CHAT_ENDPOINT = '/api/chat';

async function extractErrorCode(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    // non-JSON error body — fall through to status code
  }
  return `http_${res.status}`;
}

function pushError(threadId: string, assistantIndex: number, code: string): void {
  threadsStore.appendDelta(threadId, assistantIndex, `⚠ ${code}`);
  threadsStore.finalizeStreaming(threadId, assistantIndex);
}

/**
 * POST to /api/chat and pipe the SSE response into the active thread's
 * streaming assistant placeholder. Errors (HTTP, network, mid-stream
 * `{"error":…}`) are surfaced inline by writing `⚠ {code}` into the same
 * placeholder so they persist with the conversation history.
 */
export async function streamChat(
  payload: StreamChatPayload,
  assistantIndex: number,
  fetchFn: FetchLike = fetch
): Promise<void> {
  let res: Response;
  try {
    res = await fetchFn(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'network_error';
    pushError(payload.threadId, assistantIndex, msg);
    return;
  }

  if (!res.ok) {
    const code = await extractErrorCode(res);
    pushError(payload.threadId, assistantIndex, code);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    pushError(payload.threadId, assistantIndex, 'no_stream');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: !done });

      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const ev of events) {
        const line = ev.startsWith('data: ') ? ev.slice(6) : ev.replace(/^data:\s*/, '');
        if (!line) continue;
        if (line === '[DONE]') {
          threadsStore.finalizeStreaming(payload.threadId, assistantIndex);
          return;
        }
        try {
          const parsed = JSON.parse(line) as { delta?: unknown; error?: unknown };
          if (typeof parsed.delta === 'string') {
            threadsStore.appendDelta(payload.threadId, assistantIndex, parsed.delta);
          } else if (typeof parsed.error === 'string') {
            pushError(payload.threadId, assistantIndex, parsed.error);
            return;
          }
        } catch {
          // unparsable event — skip, keep streaming
        }
      }

      if (done) {
        threadsStore.finalizeStreaming(payload.threadId, assistantIndex);
        return;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'stream_error';
    pushError(payload.threadId, assistantIndex, msg);
  }
}
