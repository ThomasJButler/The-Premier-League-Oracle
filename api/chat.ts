export const config = {
  runtime: 'edge',
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 800;
const TEMPERATURE = 0.7;

/** Supported models that users can select via Settings. */
const ALLOWED_MODELS = [
  'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo',
  'claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-opus-latest',
];

function isAnthropicModel(model: string): boolean {
  return model.startsWith('claude');
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Call OpenAI Chat Completions API. */
async function callOpenAI(
  apiKey: string, model: string, messages: unknown[],
): Promise<Response> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const errorMap: Record<number, string> = {
      401: 'Invalid API key. Please check your OpenAI key.',
      429: 'Rate limited by OpenAI. Please wait a moment and try again.',
    };
    return jsonResponse(
      { error: errorMap[status] || `OpenAI API error (${status}).` },
      status,
    );
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    return jsonResponse({ error: 'OpenAI returned an unexpected response.' }, 502);
  }
  return jsonResponse(data);
}

/** Call Anthropic Messages API and normalise to OpenAI-compatible response shape. */
async function callAnthropic(
  apiKey: string, model: string, messages: Array<{ role: string; content: string }>,
): Promise<Response> {
  // Extract system message — Anthropic uses a separate `system` field
  let systemPrompt = '';
  const userMessages: Array<{ role: string; content: string }> = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt += (systemPrompt ? '\n' : '') + msg.content;
    } else {
      userMessages.push({ role: msg.role, content: msg.content });
    }
  }

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
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: userMessages,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const errorMap: Record<number, string> = {
      401: 'Invalid API key. Please check your Anthropic key.',
      429: 'Rate limited by Anthropic. Please wait a moment and try again.',
    };
    return jsonResponse(
      { error: errorMap[status] || `Anthropic API error (${status}).` },
      status,
    );
  }

  let data: { content?: Array<{ text?: string }>; model?: string; usage?: unknown };
  try {
    data = await response.json();
  } catch {
    return jsonResponse({ error: 'Anthropic returned an unexpected response.' }, 502);
  }

  // Normalise to OpenAI response shape so the frontend doesn't need to care
  const text = data.content?.[0]?.text || '';
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

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'Messages array required.' }, 400);
  }

  // Resolve model: request body → env var → default. Only allow known models.
  const envModel = process.env.ORACLE_AI_MODEL;
  const resolvedModel =
    (requestedModel && ALLOWED_MODELS.includes(requestedModel) ? requestedModel : null)
    ?? (envModel && ALLOWED_MODELS.includes(envModel) ? envModel : null)
    ?? DEFAULT_MODEL;

  const useAnthropic = isAnthropicModel(resolvedModel);

  // Server-side key takes priority over user-provided key
  const apiKey = useAnthropic
    ? (process.env.ANTHROPIC_API_KEY || userKey)
    : (process.env.OPENAI_API_KEY || userKey);

  if (!apiKey) {
    const provider = useAnthropic ? 'Anthropic' : 'OpenAI';
    return jsonResponse(
      { error: `No API key configured. Please enter your ${provider} key or ask the site owner to set ${useAnthropic ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'}.` },
      400,
    );
  }

  try {
    if (useAnthropic) {
      return await callAnthropic(apiKey, resolvedModel, messages as Array<{ role: string; content: string }>);
    } else {
      return await callOpenAI(apiKey, resolvedModel, messages);
    }
  } catch {
    const provider = useAnthropic ? 'Anthropic' : 'OpenAI';
    return jsonResponse({ error: `Failed to connect to ${provider}.` }, 502);
  }
}
