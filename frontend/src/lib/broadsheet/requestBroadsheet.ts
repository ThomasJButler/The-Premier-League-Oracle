import type { PersonaId } from '$lib/personas';
import type { BroadsheetJson } from '$lib/server/broadsheetPrompt';

export interface BroadsheetSuccess {
  ok: true;
  broadsheet: BroadsheetJson;
  generatedAt: string;
}

export interface BroadsheetFailure {
  ok: false;
  error: string;
}

export type BroadsheetResult = BroadsheetSuccess | BroadsheetFailure;
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const ENDPOINT = '/api/broadsheet';

/**
 * POST to `/api/broadsheet` and return the typed JSON payload (or a tagged
 * error). HTTP errors, network failures, and malformed JSON all collapse into
 * `{ok: false, error}` so callers can render a single inline failure state.
 */
export async function requestBroadsheet(
  payload: { personaId: PersonaId; gameweek: number },
  fetchFn: FetchLike = fetch
): Promise<BroadsheetResult> {
  let res: Response;
  try {
    res = await fetchFn(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'network_error';
    return { ok: false, error: msg };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: `http_${res.status}` };
  }

  if (!res.ok) {
    const code =
      body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `http_${res.status}`;
    return { ok: false, error: code };
  }

  const parsed = body as { broadsheet?: BroadsheetJson; generatedAt?: string };
  if (!parsed.broadsheet || typeof parsed.generatedAt !== 'string') {
    return { ok: false, error: 'malformed_response' };
  }
  return { ok: true, broadsheet: parsed.broadsheet, generatedAt: parsed.generatedAt };
}
