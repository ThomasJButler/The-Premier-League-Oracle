import type { PersonaId } from '$lib/personas';
import type {
  FixtureAnalysisFixture,
  FixtureAnalysisPrediction
} from '$lib/server/broadsheetPrompt';

export interface FixtureAnalysisSuccess {
  ok: true;
  analysis: string;
  generatedAt: string;
}

export interface FixtureAnalysisFailure {
  ok: false;
  error: string;
}

export type FixtureAnalysisResult = FixtureAnalysisSuccess | FixtureAnalysisFailure;
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const ENDPOINT = '/api/broadsheet';

export async function requestFixtureAnalysis(
  payload: {
    personaId: PersonaId;
    fixtureId: string;
    fixture: FixtureAnalysisFixture;
    prediction: FixtureAnalysisPrediction;
  },
  fetchFn: FetchLike = fetch
): Promise<FixtureAnalysisResult> {
  let res: Response;
  try {
    res = await fetchFn(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'fixture-analysis', ...payload })
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

  const parsed = body as { analysis?: unknown; generatedAt?: unknown };
  if (typeof parsed.analysis !== 'string' || typeof parsed.generatedAt !== 'string') {
    return { ok: false, error: 'malformed_response' };
  }
  return { ok: true, analysis: parsed.analysis, generatedAt: parsed.generatedAt };
}
