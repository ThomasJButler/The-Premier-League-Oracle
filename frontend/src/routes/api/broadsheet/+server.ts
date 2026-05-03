import { json, type RequestEvent } from '@sveltejs/kit';
import { isPersonaId, getPersona } from '$lib/personas';
import { getAnthropic } from '$lib/server/anthropic';
import { checkRateLimit } from '$lib/server/rateLimit';
import { getContext } from '$lib/server/contextProvider';
import { buildBroadsheetPrompt, parseBroadsheetJson } from '$lib/server/broadsheetPrompt';

const MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 4096;

interface BroadsheetBody {
  personaId: unknown;
  gameweek: unknown;
}

function clientKey(event: RequestEvent): string {
  return event.request.headers.get('x-forwarded-for') ?? event.getClientAddress();
}

export async function POST(event: RequestEvent): Promise<Response> {
  let body: BroadsheetBody;
  try {
    body = (await event.request.json()) as BroadsheetBody;
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.personaId !== 'string' || !isPersonaId(body.personaId)) {
    return json({ error: 'unknown_persona' }, { status: 400 });
  }
  if (typeof body.gameweek !== 'number' || !Number.isInteger(body.gameweek) || body.gameweek < 1) {
    return json({ error: 'invalid_gameweek' }, { status: 400 });
  }

  const limit = checkRateLimit(clientKey(event));
  if (!limit.ok) {
    return json(
      { error: 'rate_limited', resetAt: limit.resetAt },
      {
        status: 429,
        headers: {
          'retry-after': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000)))
        }
      }
    );
  }

  const client = getAnthropic();
  if (!client) {
    return json({ error: 'anthropic_unavailable' }, { status: 503 });
  }

  const persona = getPersona(body.personaId);
  const context = await getContext({ daysAhead: 14, includeStandings: true });
  const { system, userMessage } = buildBroadsheetPrompt(persona, body.gameweek, context);

  let raw: string;
  try {
    raw = await client.createText({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: userMessage }]
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'anthropic_call_failed';
    return json({ error: 'anthropic_call_failed', detail: message }, { status: 502 });
  }

  let broadsheet;
  try {
    broadsheet = parseBroadsheetJson(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'json_parse_failed';
    return json({ error: 'broadsheet_parse_failed', detail: message }, { status: 500 });
  }

  return json({ broadsheet, generatedAt: new Date().toISOString() }, { status: 200 });
}
