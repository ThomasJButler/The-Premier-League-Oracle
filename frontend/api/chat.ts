export const config = {
  runtime: 'edge',
};

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;
// Smallest cacheable prefix across our allowed models is 2048 tokens
// (Sonnet 4.6); Haiku 4.5 needs 4096. ~4 chars/token gives a conservative
// 8000-char floor — below this, applying cache_control is pure waste at
// best and a 400 risk at worst.
const CACHE_CONTROL_MIN_CHARS = 8000;

/**
 * Supported Claude models the frontend may select from.
 * Keep this list in sync with frontend/vite.config.ts ALLOWED_MODELS
 * and frontend/src/lib/constants.ts AI_MODELS.
 */
const ALLOWED_MODELS = [
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
] as const;

type AllowedModel = typeof ALLOWED_MODELS[number];

interface InboundMessage { role: string; content: string }

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Call Anthropic Messages API and normalise to the OpenAI-ish shape the
 * frontend has historically consumed so callers don't need to change.
 *
 * Prompt caching strategy: match analyses and chat turns share a long
 * grounded system prompt. We mark the system prompt with
 * cache_control: ephemeral so subsequent requests with the same system
 * text (e.g. the same gameweek's ten matches) hit the cache.
 */
async function callAnthropic(
  apiKey: string,
  model: AllowedModel,
  messages: InboundMessage[],
): Promise<Response> {
  // Anthropic takes `system` as a separate top-level field — extract any
  // role:'system' messages from the list, concatenate, and cache.
  let systemPrompt = '';
  const userMessages: Array<{ role: string; content: string }> = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt += (systemPrompt ? '\n' : '') + msg.content;
    } else {
      userMessages.push({ role: msg.role, content: msg.content });
    }
  }

  // Only request prompt caching when the system text is long enough to
  // plausibly meet the model's minimum cacheable prefix. Short prompts
  // (e.g. the AI match analysis ~70-token system message) gain nothing
  // from cache_control and can trigger 400s from Anthropic.
  const systemField = systemPrompt
    ? [
        systemPrompt.length >= CACHE_CONTROL_MIN_CHARS
          ? {
              type: 'text' as const,
              text: systemPrompt,
              cache_control: { type: 'ephemeral' as const },
            }
          : {
              type: 'text' as const,
              text: systemPrompt,
            },
      ]
    : undefined;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      ...(systemField ? { system: systemField } : {}),
      messages: userMessages,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const errorMap: Record<number, string> = {
      401: 'Invalid API key. Please check your Anthropic key.',
      429: 'Rate limited by Anthropic. Please wait a moment and try again.',
    };
    // Pull Anthropic's error detail so we can see what's actually wrong.
    // Shape: { type: 'error', error: { type, message }, request_id }
    let detail = '';
    try {
      const body = await response.json() as {
        error?: { message?: string; type?: string };
      };
      detail = body?.error?.message || '';
    } catch { /* non-JSON body — ignore */ }

    const baseMessage = errorMap[status] || `Anthropic API error (${status}).`;
    const message = detail ? `${baseMessage} ${detail}` : baseMessage;
    return jsonResponse({ error: message }, status);
  }

  let data: {
    content?: Array<{ type: string; text?: string }>;
    model?: string;
    usage?: unknown;
  };
  try {
    data = await response.json();
  } catch {
    return jsonResponse({ error: 'Anthropic returned an unexpected response.' }, 502);
  }

  // Concatenate all text blocks — normally there's just one, but adaptive
  // thinking can produce thinking blocks before the text block.
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('');

  return jsonResponse({
    choices: [{ message: { role: 'assistant', content: text } }],
    model: data.model,
    usage: data.usage,
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: { messages?: unknown[]; apiKey?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const { messages, apiKey: userKey, model: requestedModel } = body;

  // Resolve model: request body → env var → default. Only allow known models.
  const envModel = process.env.ORACLE_AI_MODEL;
  const resolvedModel: AllowedModel =
    (requestedModel && (ALLOWED_MODELS as readonly string[]).includes(requestedModel)
      ? requestedModel as AllowedModel : null)
    ?? (envModel && (ALLOWED_MODELS as readonly string[]).includes(envModel)
      ? envModel as AllowedModel : null)
    ?? DEFAULT_MODEL;

  // Server-side key takes priority over user-provided key.
  // Key check runs before messages check so the server-key probe
  // (which sends empty messages) can detect whether a server key exists.
  const apiKey = process.env.ANTHROPIC_API_KEY || userKey;

  if (!apiKey) {
    return jsonResponse(
      { error: 'No API key configured. Please enter your Anthropic key or ask the site owner to set ANTHROPIC_API_KEY.' },
      400,
    );
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'Messages array required.' }, 400);
  }

  try {
    return await callAnthropic(apiKey, resolvedModel, messages as InboundMessage[]);
  } catch {
    return jsonResponse({ error: 'Failed to connect to Anthropic.' }, 502);
  }
}
