import type { PersonaId } from '$lib/personas';

export interface VerdictSuccess {
  ok: true;
  verdict: string;
  generatedAt: string;
}

export interface VerdictFailure {
  ok: false;
  error: string;
}

export type VerdictResult = VerdictSuccess | VerdictFailure;
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const ENDPOINT = '/api/broadsheet';

/**
 * POST `{kind: 'season-verdict', personaId, season}` to `/api/broadsheet`.
 * HTTP errors, network failures, and malformed JSON all collapse into a tagged
 * `{ok: false, error}` so callers can render one inline failure state.
 */
export async function requestSeasonVerdict(
  payload: { personaId: PersonaId; season: string },
  fetchFn: FetchLike = fetch
): Promise<VerdictResult> {
  let res: Response;
  try {
    res = await fetchFn(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'season-verdict', ...payload })
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

  const parsed = body as { verdict?: unknown; generatedAt?: unknown };
  if (typeof parsed.verdict !== 'string' || typeof parsed.generatedAt !== 'string') {
    return { ok: false, error: 'malformed_response' };
  }
  return { ok: true, verdict: parsed.verdict, generatedAt: parsed.generatedAt };
}
