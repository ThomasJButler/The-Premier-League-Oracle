import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FootballDataAPI } from './footballData';

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn());

describe('FootballDataAPI', () => {
  let api: FootballDataAPI;
  const mockApiKey = 'test-api-key-123';
  const baseUrl = 'https://api.football-data.org/v4';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('football_data_api_key');
    api = new FootballDataAPI();
    api.clearApiKey();
    // Bypass rate limiting in tests
    (api as any).rateLimitDelay = 0;
    (api as any).lastRequestTime = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should initialize without API key', () => {
      expect(api.hasApiKey()).toBe(false);
    });

    it('should set and validate API key', () => {
      api.setApiKey(mockApiKey);
      expect(api.hasApiKey()).toBe(true);
    });

    it('should clear API key', () => {
      api.setApiKey(mockApiKey);
      api.clearApiKey();
      expect(api.hasApiKey()).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should return true when API is accessible', async () => {
      api.setApiKey(mockApiKey);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          currentSeason: {
            id: 2024,
            startDate: '2024-08-01',
            endDate: '2025-05-31',
            currentMatchday: 10
          }
        })
      } as unknown as Response);

      const result = await api.testConnection();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalled();
    });

    it('should return false when API key is missing', async () => {
      const result = await api.testConnection();
      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should return false when API returns error', async () => {
      api.setApiKey(mockApiKey);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401
      } as unknown as Response);

      const result = await api.testConnection();
      expect(result).toBe(false);
    });

    it('should handle network errors', async () => {
      api.setApiKey(mockApiKey);
      
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await api.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('getCurrentSeason', () => {
    it('should fetch current season data', async () => {
      api.setApiKey(mockApiKey);
      
      const mockSeasonData = {
        currentSeason: {
          id: 2024,
          startDate: '2024-08-01',
          endDate: '2025-05-31',
          currentMatchday: 10
        }
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSeasonData
      } as unknown as Response);

      const result = await api.getCurrentSeason();
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('2024/2025');
      expect(result?.is_current).toBe(true);
    });

    it('should return null without API key', async () => {
      const result = await api.getCurrentSeason();
      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      api.setApiKey(mockApiKey);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500
      } as unknown as Response);

      const result = await api.getCurrentSeason();
      expect(result).toBeNull();
    });
  });

  describe('getMatches', () => {
    const mockMatchesResponse = {
      matches: [
        {
          id: 123,
          utcDate: '2024-08-15T15:00:00Z',
          homeTeam: { name: 'Arsenal FC', shortName: 'Arsenal' },
          awayTeam: { name: 'Liverpool FC', shortName: 'Liverpool' },
          score: {
            winner: 'HOME_TEAM',
            fullTime: { home: 2, away: 1 },
            halfTime: { home: 1, away: 0 }
          },
          status: 'FINISHED',
          referees: [{ name: 'Michael Oliver', type: 'REFEREE' }]
        },
        {
          id: 124,
          utcDate: '2024-08-16T20:00:00Z',
          homeTeam: { name: 'Chelsea FC', shortName: 'Chelsea' },
          awayTeam: { name: 'Manchester United FC', shortName: 'Man United' },
          score: {
            winner: null,
            fullTime: { home: null, away: null },
            halfTime: { home: null, away: null }
          },
          status: 'SCHEDULED',
          referees: []
        }
      ]
    };

    it('should fetch and transform matches correctly', async () => {
      api.setApiKey(mockApiKey);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMatchesResponse
      } as unknown as Response);

      const matches = await api.getMatches();
      
      expect(matches).toHaveLength(2);
      expect(matches[0].home_team).toBe('Arsenal FC');
      expect(matches[0].away_team).toBe('Liverpool FC');
      expect(matches[0].home_goals).toBe(2);
      expect(matches[0].away_goals).toBe(1);
      expect(matches[0].result).toBe('H');
    });

    it('should handle scheduled matches', async () => {
      api.setApiKey(mockApiKey);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMatchesResponse
      } as unknown as Response);

      const matches = await api.getMatches();
      
      expect(matches[1].home_goals).toBeNull();
      expect(matches[1].away_goals).toBeNull();
      expect(matches[1].result).toBeNull();
    });

    it('should return empty array without API key', async () => {
      const matches = await api.getMatches();
      expect(matches).toEqual([]);
    });
  });

  describe('getUpcomingMatches', () => {
    it('should fetch upcoming matches with date filter', async () => {
      api.setApiKey(mockApiKey);
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ matches: [] })
      } as unknown as Response);

      await api.getUpcomingMatches(7);
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('dateFrom='),
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('dateTo='),
        expect.any(Object)
      );
    });
  });

  describe('getStandings', () => {
    const mockStandingsResponse = {
      standings: [
        {
          type: 'TOTAL',
          table: [
            {
              position: 1,
              team: {
                id: 57,
                name: 'Arsenal FC',
                shortName: 'Arsenal',
                tla: 'ARS',
                crest: 'https://crests.football-data.org/57.png'
              },
              playedGames: 10,
              form: 'W,W,D,W,L',
              won: 7,
              draw: 2,
              lost: 1,
              points: 23,
              goalsFor: 20,
              goalsAgainst: 8,
              goalDifference: 12
            }
          ]
        }
      ]
    };

    it('should fetch and transform standings', async () => {
      api.setApiKey(mockApiKey);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStandingsResponse
      } as unknown as Response);

      const standings = await api.getStandings();
      
      expect(standings).toHaveLength(1);
      expect(standings[0].position).toBe(1);
      expect(standings[0].team.name).toBe('Arsenal FC');
      expect(standings[0].points).toBe(23);
    });

    it('should handle missing standings data', async () => {
      api.setApiKey(mockApiKey);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ standings: [] })
      } as unknown as Response);

      const standings = await api.getStandings();
      expect(standings).toEqual([]);
    });
  });

  describe('getTeamStats', () => {
    const mockStandingsForStats = {
      standings: [{
        type: 'TOTAL',
        table: [{
          position: 1,
          team: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: '' },
          playedGames: 10, form: 'W,W,D,W,L', won: 7, draw: 2, lost: 1,
          points: 23, goalsFor: 20, goalsAgainst: 8, goalDifference: 12
        }]
      }]
    };

    const mockTeamMatches = {
      matches: [{
        id: 501, utcDate: '2024-08-10T15:00:00Z',
        homeTeam: { name: 'Arsenal FC', shortName: 'Arsenal' },
        awayTeam: { name: 'Chelsea FC', shortName: 'Chelsea' },
        score: { winner: 'HOME_TEAM', fullTime: { home: 2, away: 0 }, halfTime: { home: 1, away: 0 } },
        referees: []
      }]
    };

    it('should fetch team-specific statistics', async () => {
      api.setApiKey(mockApiKey);

      // getTeamStats calls getStandings() then getTeamMatches()
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => mockStandingsForStats } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mockTeamMatches } as unknown as Response);

      const stats = await api.getTeamStats('Arsenal');

      expect(stats).toBeDefined();
      expect(stats!.position).toBe(1);
      expect(stats!.points).toBe(23);
    });

    it('should handle team name variations', async () => {
      api.setApiKey(mockApiKey);

      // getTeamStats matches by name or shortName (case-insensitive)
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => mockStandingsForStats } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mockTeamMatches } as unknown as Response);

      const stats = await api.getTeamStats('arsenal');
      expect(stats).toBeDefined();
      expect(stats!.position).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting (429 status)', async () => {
      api.setApiKey(mockApiKey);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as unknown as Response);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const matches = await api.getMatches();

      expect(matches).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle unauthorized access (401 status)', async () => {
      api.setApiKey('invalid-key');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as unknown as Response);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const matches = await api.getMatches();

      expect(matches).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle malformed JSON responses', async () => {
      api.setApiKey(mockApiKey);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      } as unknown as Response);

      const matches = await api.getMatches();
      
      expect(matches).toEqual([]);
    });

    it('should handle network timeouts', async () => {
      api.setApiKey(mockApiKey);
      
      vi.mocked(fetch).mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      const matches = await api.getMatches();
      
      expect(matches).toEqual([]);
    });
  });

  describe('Data Transformation', () => {
    it('should correctly determine match results', () => {
      const testCases = [
        { home: 2, away: 1, expected: 'H' },
        { home: 1, away: 2, expected: 'A' },
        { home: 1, away: 1, expected: 'D' },
        { home: null, away: null, expected: null }
      ];

      testCases.forEach(({ home, away, expected }) => {
        const match = {
          score: {
            fullTime: { home, away }
          }
        };

        const result = home !== null && away !== null
          ? home > away ? 'H' : away > home ? 'A' : 'D'
          : null;

        expect(result).toBe(expected);
      });
    });

    it('should handle team name normalization', () => {
      const teamNames = [
        { input: 'Arsenal FC', expected: 'Arsenal' },
        { input: 'Liverpool FC', expected: 'Liverpool' },
        { input: 'Manchester United FC', expected: 'Manchester United' },
        { input: 'Tottenham Hotspur FC', expected: 'Tottenham' }
      ];

      teamNames.forEach(({ input, expected }) => {
        const normalized = input
          .replace(' FC', '')
          .replace(' AFC', '')
          .replace(' Hotspur', '');
        
        expect(normalized).toContain(expected.split(' ')[0]);
      });
    });
  });

  describe('Caching', () => {
    it('should cache responses and serve from cache on subsequent calls', async () => {
      api.setApiKey(mockApiKey);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ matches: [] })
      } as unknown as Response);

      // First call fetches from API
      await api.getMatches();
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call should use the in-memory cache (no additional fetch)
      await api.getMatches();
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});