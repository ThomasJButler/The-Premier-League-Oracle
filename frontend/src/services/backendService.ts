import type { MLPrediction, MLHealthResponse } from '../types';
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

  /** Build JSON request headers */
  private headers(): Record<string, string> {
    return { 'Content-Type': 'application/json' };
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
   * Predict a single match using the free-tier XGBoost model.
   * Throws BackendUnavailableError if the backend is down.
   *
   * Calls /predict/free and maps the response to the MLPrediction type
   * expected by the frontend ensemble (optimizedPredictions.ts).
   */
  async predictMatch(homeTeam: string, awayTeam: string): Promise<MLPrediction> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}/predict/free`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          home_team: homeTeam,
          away_team: awayTeam,
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

      const data = await res.json();

      // Map /predict/free response to MLPrediction shape
      return {
        match: `${data.home_team} vs ${data.away_team}`,
        prediction: {
          home: data.probabilities.home_win,
          draw: data.probabilities.draw,
          away: data.probabilities.away_win,
        },
        confidence: data.confidence,
        recommendation: data.predicted_outcome,
        timestamp: new Date().toISOString(),
      };
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
