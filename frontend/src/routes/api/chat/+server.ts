import { json, type RequestEvent } from '@sveltejs/kit';
import { isPersonaId, getPersona } from '$lib/personas';
import { getAnthropic, type ChatMessage } from '$lib/server/anthropic';
import { checkRateLimit } from '$lib/server/rateLimit';
import { getContext } from '$lib/server/contextProvider';
import { buildSystemPrompt } from '$lib/server/buildSystemPrompt';

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 256;

interface ChatBody {
  personaId: unknown;
  messages: unknown;
  threadId?: unknown;
}

function clientKey(event: RequestEvent): string {
  return event.request.headers.get('x-forwarded-for') ?? event.getClientAddress();
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (v.role === 'user' || v.role === 'assistant') && typeof v.content === 'string';
}

export async function POST(event: RequestEvent): Promise<Response> {
  let body: ChatBody;
  try {
    body = (await event.request.json()) as ChatBody;
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.personaId !== 'string' || !isPersonaId(body.personaId)) {
    return json({ error: 'unknown_persona' }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0 || !body.messages.every(isChatMessage)) {
    return json({ error: 'invalid_messages' }, { status: 400 });
  }

  const limit = checkRateLimit(clientKey(event));
  if (!limit.ok) {
    return json(
      { error: 'rate_limited', resetAt: limit.resetAt },
      {
        status: 429,
        headers: {
          'retry-after': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))),
          'x-ratelimit-limit': String(limit.limit),
          'x-ratelimit-remaining': '0'
        }
      }
    );
  }

  const client = getAnthropic();
  if (!client) {
    return json({ error: 'anthropic_unavailable' }, { status: 503 });
  }

  const persona = getPersona(body.personaId);
  const context = await getContext({ daysAhead: 7 });
  const system = buildSystemPrompt(persona, context);

  const stream = client.streamText({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: body.messages
  });

  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.length === 0) continue;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'stream_error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(sse, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      'x-ratelimit-limit': String(limit.limit),
      'x-ratelimit-remaining': String(limit.remaining)
    }
  });
}
