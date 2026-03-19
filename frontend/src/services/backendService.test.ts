import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { backendService } from './backendService';
import { BackendUnavailableError } from '../types';

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn());

describe('BackendService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    // Reset cached availability between tests
    backendService.invalidateCache();
    localStorage.removeItem('oracle_api_token');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when backend is healthy', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          timestamp: '2026-03-18T12:00:00Z',
          free_tier_model_loaded: true,
        }),
      } as unknown as Response);

      const result = await backendService.isAvailable();
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        '/api/oracle/health',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('should return false when backend returns unhealthy status', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'degraded',
          timestamp: '2026-03-18T12:00:00Z',
          free_tier_model_loaded: false,
        }),
      } as unknown as Response);

      const result = await backendService.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when backend returns non-OK response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as unknown as Response);

      const result = await backendService.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when fetch throws (network error)', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await backendService.isAvailable();
      expect(result).toBe(false);
    });

    it('should cache health check result for 30 seconds', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy', timestamp: '', free_tier_model_loaded: true }),
      } as unknown as Response);

      // First call hits the network
      await backendService.isAvailable();
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call within 30s returns cached result
      vi.spyOn(Date, 'now').mockReturnValue(now + 15_000);
      const cached = await backendService.isAvailable();
      expect(cached).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1); // No additional fetch

      // After 30s, a fresh check is made
      vi.spyOn(Date, 'now').mockReturnValue(now + 31_000);
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy', timestamp: '', free_tier_model_loaded: true }),
      } as unknown as Response);

      await backendService.isAvailable();
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should refresh after invalidateCache()', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'healthy', timestamp: '', free_tier_model_loaded: true }),
      } as unknown as Response);

      await backendService.isAvailable();
      expect(fetch).toHaveBeenCalledTimes(1);

      backendService.invalidateCache();

      await backendService.isAvailable();
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('predictMatch', () => {
    // Mock response from /predict/free endpoint
    const mockFreeTierResponse = {
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      probabilities: { home_win: 0.45, draw: 0.30, away_win: 0.25 },
      predicted_outcome: 'Home win',
      confidence: 0.45,
      model_version: '1.0.0',
      feature_importance: {},
    };

    it('should return prediction mapped to MLPrediction shape', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockFreeTierResponse,
      } as unknown as Response);

      const result = await backendService.predictMatch('Arsenal', 'Chelsea');
      expect(result.match).toBe('Arsenal vs Chelsea');
      expect(result.prediction).toEqual({ home: 0.45, draw: 0.30, away: 0.25 });
      expect(result.confidence).toBe(0.45);
      expect(result.recommendation).toBe('Home win');
      expect(result.timestamp).toBeDefined();
      expect(fetch).toHaveBeenCalledWith(
        '/api/oracle/predict/free',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            home_team: 'Arsenal',
            away_team: 'Chelsea',
          }),
        }),
      );
    });

    it('should throw BackendUnavailableError on non-OK response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as unknown as Response);

      await expect(backendService.predictMatch('Arsenal', 'Chelsea'))
        .rejects.toThrow(BackendUnavailableError);
    });

    it('should include error text in BackendUnavailableError message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => 'Unknown team: Arsenall',
      } as unknown as Response);

      await expect(backendService.predictMatch('Arsenall', 'Chelsea'))
        .rejects.toThrow(/Backend returned 422: Unknown team: Arsenall/);
    });

    it('should throw BackendUnavailableError on network failure', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(backendService.predictMatch('Arsenal', 'Chelsea'))
        .rejects.toThrow(BackendUnavailableError);
    });

    it('should NOT include auth token for predictMatch by default', async () => {
      localStorage.setItem('oracle_api_token', 'test-token-abc');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockFreeTierResponse,
      } as unknown as Response);

      // predictMatch doesn't pass includeAuth, so no Authorization header
      await backendService.predictMatch('Arsenal', 'Chelsea');

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });
  });
});
