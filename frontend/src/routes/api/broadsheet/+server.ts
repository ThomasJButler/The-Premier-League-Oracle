import { json, type RequestEvent } from '@sveltejs/kit';
import { isPersonaId, getPersona } from '$lib/personas';
import { getAnthropic } from '$lib/server/anthropic';
import { checkRateLimit } from '$lib/server/rateLimit';
import { getContext } from '$lib/server/contextProvider';
import {
  buildBroadsheetPrompt,
  buildSeasonVerdictPrompt,
  parseBroadsheetJson
} from '$lib/server/broadsheetPrompt';
import { getSeasonRecord } from '$lib/fixtures/leagueHistory';
import { statsPack } from '$lib/data/statsPack';

const MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 4096;
const VERDICT_MAX_TOKENS = 512;
const SEASON_RE = /^\d{4}\/\d{2}$/;

interface BroadsheetBody {
  kind?: unknown;
  personaId: unknown;
  gameweek?: unknown;
  season?: unknown;
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

  const kind = body.kind === undefined ? 'broadsheet' : body.kind;
  if (kind !== 'broadsheet' && kind !== 'season-verdict') {
    return json({ error: 'unknown_kind' }, { status: 400 });
  }

  if (kind === 'broadsheet') {
    if (typeof body.gameweek !== 'number' || !Number.isInteger(body.gameweek) || body.gameweek < 1) {
      return json({ error: 'invalid_gameweek' }, { status: 400 });
    }
  } else {
    if (typeof body.season !== 'string' || !SEASON_RE.test(body.season)) {
      return json({ error: 'invalid_season' }, { status: 400 });
    }
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

  if (kind === 'broadsheet') {
    const context = await getContext({ daysAhead: 14, includeStandings: true });
    const { system, userMessage } = buildBroadsheetPrompt(persona, body.gameweek as number, context);

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

  // kind === 'season-verdict'
  const season = body.season as string;
  const record = getSeasonRecord(season);
  const seasonStats = statsPack.seasonStats?.[season];
  const { system, userMessage } = buildSeasonVerdictPrompt(persona, season, record, seasonStats);

  let raw: string;
  try {
    raw = await client.createText({
      model: MODEL,
      max_tokens: VERDICT_MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: userMessage }]
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'anthropic_call_failed';
    return json({ error: 'anthropic_call_failed', detail: message }, { status: 502 });
  }

  const verdict = raw.trim();
  if (!verdict) {
    return json({ error: 'empty_verdict' }, { status: 500 });
  }

  return json({ verdict, generatedAt: new Date().toISOString() }, { status: 200 });
}
