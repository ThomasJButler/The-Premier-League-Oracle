import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { aiAnalysisService } from './aiAnalysis';
import type { AnalysisInput } from './aiAnalysis';

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn());

const mockInput: AnalysisInput = {
  homeTeam: 'Arsenal FC',
  awayTeam: 'Chelsea FC',
  matchId: 'match_12345',
  matchDate: 'Saturday 15 March 2026, 15:00',
  predictedResult: 'H',
  confidence: 0.72,
  predictedHomeGoals: 2,
  predictedAwayGoals: 1,
  homeForm: 'WWDWL',
  awayForm: 'DLWWD',
  insights: ['ELO rating advantage: Arsenal +120', 'Home form: 3W in last 5'],
};

describe('AIAnalysisService', () => {
  // Wire the global localStorage stubs to an actual backing store
  // so that setItem/getItem/removeItem round-trip correctly.
  let store: Map<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new Map<string, string>();

    vi.mocked(localStorage.getItem).mockImplementation((key: string) => store.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => { store.set(key, value); });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => { store.delete(key); });
    vi.mocked(localStorage.clear).mockImplementation(() => { store.clear(); });
    vi.mocked(localStorage.key).mockImplementation((i: number) => {
      const keys = Array.from(store.keys());
      return keys[i] ?? null;
    });
    Object.defineProperty(localStorage, 'length', { get: () => store.size, configurable: true });

    // Reset the service's in-memory server key cache between tests
    (aiAnalysisService as unknown as { serverKeyAvailable: boolean | null }).serverKeyAvailable = null;
    localStorage.removeItem('ai_analysis_server_key');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isEnabled / setEnabled', () => {
    it('should default to disabled', () => {
      expect(aiAnalysisService.isEnabled()).toBe(false);
    });

    it('should persist enabled state to localStorage', () => {
      aiAnalysisService.setEnabled(true);
      expect(aiAnalysisService.isEnabled()).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('ai_analysis_enabled', 'true');
    });

    it('should persist disabled state to localStorage', () => {
      aiAnalysisService.setEnabled(true);
      aiAnalysisService.setEnabled(false);
      expect(aiAnalysisService.isEnabled()).toBe(false);
      expect(localStorage.setItem).toHaveBeenCalledWith('ai_analysis_enabled', 'false');
    });
  });

  describe('legacy openai_api_key migration', () => {
    it('migrates openai_api_key → anthropic_api_key on demand and removes the old key', async () => {
      // Legacy storage state (many users pasted sk-ant- into this key before
      // the Anthropic-only migration).
      store.set('openai_api_key', 'sk-ant-legacy-value');

      const { migrateLegacyApiKey } = await import('$lib/constants');
      migrateLegacyApiKey();

      expect(store.get('anthropic_api_key')).toBe('sk-ant-legacy-value');
      expect(store.has('openai_api_key')).toBe(false);
    });

    it('does not overwrite an existing anthropic_api_key', async () => {
      store.set('anthropic_api_key', 'sk-ant-new');
      store.set('openai_api_key', 'sk-ant-old');

      const { migrateLegacyApiKey } = await import('$lib/constants');
      migrateLegacyApiKey();

      expect(store.get('anthropic_api_key')).toBe('sk-ant-new');
      expect(store.has('openai_api_key')).toBe(false);
    });

    it('is a no-op when no legacy key is present', async () => {
      store.set('anthropic_api_key', 'sk-ant-something');
      const { migrateLegacyApiKey } = await import('$lib/constants');
      migrateLegacyApiKey();
      expect(store.get('anthropic_api_key')).toBe('sk-ant-something');
    });
  });

  describe('hasApiKey', () => {
    it('should return true when user has a localStorage key', async () => {
      store.set('anthropic_api_key', 'sk-test-key');
      const result = await aiAnalysisService.hasApiKey();
      expect(result).toBe(true);
    });

    it('should probe server when no localStorage key', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 400,
        json: async () => ({ error: 'Messages array required.' }),
      } as unknown as Response);

      const result = await aiAnalysisService.hasApiKey();
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
      }));
    });

    it('should return false when no key anywhere', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 400,
        json: async () => ({ error: 'No API key configured.' }),
      } as unknown as Response);

      const result = await aiAnalysisService.hasApiKey();
      expect(result).toBe(false);
    });

    it('should cache server key probe result in memory', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 400,
        json: async () => ({ error: 'Messages array required.' }),
      } as unknown as Response);

      await aiAnalysisService.hasApiKey();
      // Second call should not fetch again
      await aiAnalysisService.hasApiKey();
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAnalysis', () => {
    it('should return null when disabled', async () => {
      const result = await aiAnalysisService.getAnalysis(mockInput);
      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should return cached analysis without fetching', async () => {
      aiAnalysisService.setEnabled(true);

      // Pre-populate cache
      const cached = {
        analysis: 'Arsenal look strong at home.',
        timestamp: Date.now(),
        matchId: 'match_12345',
      };
      store.set('ai_analysis_match_12345', JSON.stringify(cached));

      const result = await aiAnalysisService.getAnalysis(mockInput);
      expect(result).toBe('Arsenal look strong at home.');
      // Should not call /api/chat since cache hit
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should return null when expired cache and no API key', async () => {
      aiAnalysisService.setEnabled(true);

      // Expired cache
      const cached = {
        analysis: 'Old analysis',
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        matchId: 'match_12345',
      };
      store.set('ai_analysis_match_12345', JSON.stringify(cached));

      // No API key
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 400,
        json: async () => ({ error: 'No API key configured.' }),
      } as unknown as Response);

      const result = await aiAnalysisService.getAnalysis(mockInput);
      expect(result).toBeNull();
    });

    it('should fetch from /api/chat and cache the result', async () => {
      aiAnalysisService.setEnabled(true);
      store.set('anthropic_api_key', 'sk-test');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Arsenal should win this one comfortably.' },
          }],
        }),
      } as unknown as Response);

      const result = await aiAnalysisService.getAnalysis(mockInput);
      expect(result).toBe('Arsenal should win this one comfortably.');

      // Verify it was cached
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'ai_analysis_match_12345',
        expect.stringContaining('Arsenal should win this one comfortably.')
      );
    });

    it('should send user API key when server key not available', async () => {
      aiAnalysisService.setEnabled(true);
      store.set('anthropic_api_key', 'sk-user-key');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Analysis result.' } }],
        }),
      } as unknown as Response);

      await aiAnalysisService.getAnalysis(mockInput);

      const lastCall = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(lastCall[1]?.body as string);
      expect(body.apiKey).toBe('sk-user-key');
    });

    it('should return null on API error without crashing', async () => {
      aiAnalysisService.setEnabled(true);
      store.set('anthropic_api_key', 'sk-test');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limited.' }),
      } as unknown as Response);

      const result = await aiAnalysisService.getAnalysis(mockInput);
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      aiAnalysisService.setEnabled(true);
      store.set('anthropic_api_key', 'sk-test');

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await aiAnalysisService.getAnalysis(mockInput);
      expect(result).toBeNull();
    });
  });

  describe('getCachedAnalysis', () => {
    it('should return null for non-existent cache', () => {
      expect(aiAnalysisService.getCachedAnalysis('nonexistent')).toBeNull();
    });

    it('should return cached analysis within TTL', () => {
      const cached = {
        analysis: 'Good match ahead.',
        timestamp: Date.now() - 1000, // 1 second ago
        matchId: 'match_abc',
      };
      store.set('ai_analysis_match_abc', JSON.stringify(cached));

      expect(aiAnalysisService.getCachedAnalysis('match_abc')).toBe('Good match ahead.');
    });

    it('should return null and clean up expired cache', () => {
      const cached = {
        analysis: 'Stale analysis.',
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        matchId: 'match_old',
      };
      store.set('ai_analysis_match_old', JSON.stringify(cached));

      expect(aiAnalysisService.getCachedAnalysis('match_old')).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('ai_analysis_match_old');
    });

    it('should handle corrupt cache gracefully', () => {
      store.set('ai_analysis_match_bad', 'not json');
      expect(aiAnalysisService.getCachedAnalysis('match_bad')).toBeNull();
    });
  });

  describe('getRecentAnalyses', () => {
    it('should return empty array when no cached analyses', () => {
      expect(aiAnalysisService.getRecentAnalyses()).toEqual([]);
    });

    it('should return recent non-expired analyses sorted by recency', () => {
      const now = Date.now();
      store.set('ai_analysis_match_1', JSON.stringify({
        analysis: 'Analysis 1',
        timestamp: now - 1000,
        matchId: 'match_1',
      }));
      store.set('ai_analysis_match_2', JSON.stringify({
        analysis: 'Analysis 2',
        timestamp: now - 500,
        matchId: 'match_2',
      }));

      const results = aiAnalysisService.getRecentAnalyses();
      expect(results).toHaveLength(2);
      expect(results[0].matchId).toBe('match_2'); // More recent first
      expect(results[1].matchId).toBe('match_1');
    });

    it('should exclude expired analyses', () => {
      store.set('ai_analysis_match_old', JSON.stringify({
        analysis: 'Expired',
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        matchId: 'match_old',
      }));
      store.set('ai_analysis_match_new', JSON.stringify({
        analysis: 'Fresh',
        timestamp: Date.now(),
        matchId: 'match_new',
      }));

      const results = aiAnalysisService.getRecentAnalyses();
      expect(results).toHaveLength(1);
      expect(results[0].matchId).toBe('match_new');
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        store.set(`ai_analysis_match_${i}`, JSON.stringify({
          analysis: `Analysis ${i}`,
          timestamp: Date.now() - i * 1000,
          matchId: `match_${i}`,
        }));
      }

      expect(aiAnalysisService.getRecentAnalyses(3)).toHaveLength(3);
    });
  });

  describe('clearCache', () => {
    it('should remove all AI analysis entries from localStorage', () => {
      store.set('ai_analysis_match_1', JSON.stringify({ analysis: 'A', timestamp: Date.now(), matchId: 'match_1' }));
      store.set('ai_analysis_match_2', JSON.stringify({ analysis: 'B', timestamp: Date.now(), matchId: 'match_2' }));
      store.set('other_key', 'should not be removed');

      aiAnalysisService.clearCache();

      expect(store.has('ai_analysis_match_1')).toBe(false);
      expect(store.has('ai_analysis_match_2')).toBe(false);
      expect(store.get('other_key')).toBe('should not be removed');
    });
  });

});
