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
          models_loaded: true,
          redis_connected: true,
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
          models_loaded: false,
          redis_connected: false,
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
        json: async () => ({ status: 'healthy', timestamp: '', models_loaded: true, redis_connected: true }),
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
        json: async () => ({ status: 'healthy', timestamp: '', models_loaded: true, redis_connected: true }),
      } as unknown as Response);

      await backendService.isAvailable();
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should refresh after invalidateCache()', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'healthy', timestamp: '', models_loaded: true, redis_connected: true }),
      } as unknown as Response);

      await backendService.isAvailable();
      expect(fetch).toHaveBeenCalledTimes(1);

      backendService.invalidateCache();

      await backendService.isAvailable();
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('predictMatch', () => {
    const mockPrediction = {
      match: 'Arsenal vs Chelsea',
      prediction: { home: 0.45, draw: 0.30, away: 0.25 },
      confidence: 0.72,
      recommendation: 'Home Win',
      timestamp: '2026-03-18T12:00:00Z',
    };

    it('should return prediction for a valid match', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPrediction,
      } as unknown as Response);

      const result = await backendService.predictMatch('Arsenal', 'Chelsea');
      expect(result).toEqual(mockPrediction);
      expect(fetch).toHaveBeenCalledWith(
        '/api/oracle/predict',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            home_team: 'Arsenal',
            away_team: 'Chelsea',
            include_details: true,
            use_cache: true,
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
        json: async () => mockPrediction,
      } as unknown as Response);

      // predictMatch doesn't pass includeAuth, so no Authorization header
      await backendService.predictMatch('Arsenal', 'Chelsea');

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
      // headers() is called without includeAuth=true by default
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('predictBatch', () => {
    const mockBatchResponse = {
      predictions: [
        {
          match: 'Arsenal vs Chelsea',
          prediction: { home: 0.45, draw: 0.30, away: 0.25 },
          confidence: 0.72,
          recommendation: 'Home Win',
          timestamp: '2026-03-18T12:00:00Z',
        },
        {
          match: 'Liverpool vs Man City',
          error: 'Insufficient data for prediction',
        },
      ],
      total: 2,
      timestamp: '2026-03-18T12:00:00Z',
    };

    it('should return batch predictions including mixed success/error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBatchResponse,
      } as unknown as Response);

      const result = await backendService.predictBatch([
        { homeTeam: 'Arsenal', awayTeam: 'Chelsea' },
        { homeTeam: 'Liverpool', awayTeam: 'Man City' },
      ]);

      expect(result.predictions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(fetch).toHaveBeenCalledWith(
        '/api/oracle/predict/batch',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            matches: [
              { home_team: 'Arsenal', away_team: 'Chelsea' },
              { home_team: 'Liverpool', away_team: 'Man City' },
            ],
          }),
        }),
      );
    });

    it('should throw BackendUnavailableError on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as unknown as Response);

      await expect(
        backendService.predictBatch([{ homeTeam: 'Arsenal', awayTeam: 'Chelsea' }]),
      ).rejects.toThrow(BackendUnavailableError);
    });

    it('should throw BackendUnavailableError on network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection refused'));

      await expect(
        backendService.predictBatch([{ homeTeam: 'Arsenal', awayTeam: 'Chelsea' }]),
      ).rejects.toThrow(BackendUnavailableError);
    });
  });

  describe('getTeamStats', () => {
    const mockStats = {
      team: 'Arsenal',
      recent_form: { wins: 5, draws: 2, losses: 3 },
      timestamp: '2026-03-18T12:00:00Z',
    };

    it('should return team statistics', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      } as unknown as Response);

      const result = await backendService.getTeamStats('Arsenal');
      expect(result).toEqual(mockStats);
      expect(fetch).toHaveBeenCalledWith(
        '/api/oracle/teams/Arsenal/stats?last_n_matches=10',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it('should URL-encode team names with spaces', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      } as unknown as Response);

      await backendService.getTeamStats('Manchester United');
      expect(fetch).toHaveBeenCalledWith(
        '/api/oracle/teams/Manchester%20United/stats?last_n_matches=10',
        expect.any(Object),
      );
    });

    it('should pass custom lastNMatches parameter', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      } as unknown as Response);

      await backendService.getTeamStats('Arsenal', 5);
      expect(fetch).toHaveBeenCalledWith(
        '/api/oracle/teams/Arsenal/stats?last_n_matches=5',
        expect.any(Object),
      );
    });

    it('should throw BackendUnavailableError on non-OK response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as unknown as Response);

      await expect(backendService.getTeamStats('UnknownFC'))
        .rejects.toThrow(BackendUnavailableError);
    });

    it('should throw BackendUnavailableError on network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Timeout'));

      await expect(backendService.getTeamStats('Arsenal'))
        .rejects.toThrow(BackendUnavailableError);
    });
  });
});
