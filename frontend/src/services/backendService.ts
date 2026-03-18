import type { MLPrediction, MLBatchResponse, MLHealthResponse } from '../types';
import { BackendUnavailableError } from '../types';

const BASE_URL = '/api/oracle';
const HEALTH_TIMEOUT_MS = 3000;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Service for communicating with the Python ML backend.
 *
 * All methods throw BackendUnavailableError when the backend is unreachable
 * or returns a non-OK response. Callers should catch this and fall back to
 * the TypeScript ensemble (optimizedPredictions.ts).
 *
 * The Vite dev proxy maps /api/oracle → http://localhost:8000.
 * In production, configure the backend URL via Vercel rewrites or environment variable.
 */
class BackendService {
  private cachedAvailability: boolean | null = null;
  private lastHealthCheck = 0;
  private readonly healthCacheTtl = 30_000; // 30s between health checks

  /** Returns the auth token from localStorage, if configured */
  private getToken(): string | null {
    return localStorage.getItem('oracle_api_token');
  }

  /** Build request headers with optional auth */
  private headers(includeAuth = false): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (includeAuth) {
      const token = this.getToken();
      if (token) h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  }

  /**
   * Ping the backend's /health endpoint.
   * Returns true if the server is reachable and healthy.
   * Caches the result for 30 seconds to avoid hammering the backend.
   */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedAvailability !== null && now - this.lastHealthCheck < this.healthCacheTtl) {
      return this.cachedAvailability;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      const res = await fetch(`${BASE_URL}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        this.cachedAvailability = false;
        this.lastHealthCheck = now;
        return false;
      }

      const data: MLHealthResponse = await res.json();
      this.cachedAvailability = data.status === 'healthy';
      this.lastHealthCheck = now;
      return this.cachedAvailability;
    } catch {
      this.cachedAvailability = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /** Force a fresh health check on next call (e.g. after settings change) */
  invalidateCache(): void {
    this.cachedAvailability = null;
    this.lastHealthCheck = 0;
  }

  /**
   * Predict a single match using the backend ML ensemble.
   * Throws BackendUnavailableError if the backend is down.
   */
  async predictMatch(homeTeam: string, awayTeam: string): Promise<MLPrediction> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}/predict`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          home_team: homeTeam,
          away_team: awayTeam,
          include_details: true,
          use_cache: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new BackendUnavailableError(
          `Backend returned ${res.status}${errorText ? `: ${errorText}` : ''}`,
        );
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof BackendUnavailableError) throw err;
      throw new BackendUnavailableError(
        err instanceof Error ? err.message : 'Failed to reach backend',
      );
    }
  }

  /**
   * Predict multiple matches in a single request.
   * Throws BackendUnavailableError if the backend is down.
   * Individual match failures are returned inline (not thrown).
   */
  async predictBatch(
    matches: Array<{ homeTeam: string; awayTeam: string }>,
  ): Promise<MLBatchResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}/predict/batch`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          matches: matches.map((m) => ({
            home_team: m.homeTeam,
            away_team: m.awayTeam,
          })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        throw new BackendUnavailableError(`Backend returned ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof BackendUnavailableError) throw err;
      throw new BackendUnavailableError(
        err instanceof Error ? err.message : 'Failed to reach backend',
      );
    }
  }

  /**
   * Get team statistics from the backend.
   * Throws BackendUnavailableError if the backend is down.
   */
  async getTeamStats(
    teamName: string,
    lastNMatches = 10,
  ): Promise<{ team: string; recent_form: unknown; timestamp: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const encoded = encodeURIComponent(teamName);
      const res = await fetch(
        `${BASE_URL}/teams/${encoded}/stats?last_n_matches=${lastNMatches}`,
        {
          headers: this.headers(),
          signal: controller.signal,
        },
      );

      clearTimeout(timer);

      if (!res.ok) {
        throw new BackendUnavailableError(`Backend returned ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof BackendUnavailableError) throw err;
      throw new BackendUnavailableError(
        err instanceof Error ? err.message : 'Failed to reach backend',
      );
    }
  }
}

/** Singleton instance — import this rather than creating new instances */
export const backendService = new BackendService();
