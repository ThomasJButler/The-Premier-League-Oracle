export const config = {
  runtime: 'edge',
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 800;
const TEMPERATURE = 0.7;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: { messages?: unknown[]; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const { messages, apiKey: userKey } = body;

  // Server-side key takes priority over user-provided key
  const apiKey = process.env.OPENAI_API_KEY || userKey;

  if (!apiKey) {
    return jsonResponse(
      { error: 'No API key configured. Please enter your OpenAI key or ask the site owner to set OPENAI_API_KEY.' },
      400,
    );
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'Messages array required.' }, 400);
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
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
  } catch {
    return jsonResponse({ error: 'Failed to connect to OpenAI.' }, 502);
  }
}
