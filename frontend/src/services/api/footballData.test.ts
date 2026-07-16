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

  describe('transformMatch — result gating on match status', () => {
    // Regression: Football-Data.org occasionally populates score.winner mid-match.
    // Before this gate, live matches were rendered as "Full Time" and marked
    // correct/incorrect before they actually ended.
    const makeFdMatch = (overrides: Record<string, unknown> = {}) => ({
      id: 999,
      utcDate: '2024-08-15T15:00:00Z',
      homeTeam: { name: 'Liverpool FC', shortName: 'Liverpool' },
      awayTeam: { name: 'Fulham FC', shortName: 'Fulham' },
      score: {
        winner: 'HOME_TEAM',
        fullTime: { home: 2, away: 1 },
        halfTime: { home: 1, away: 0 }
      },
      status: 'IN_PLAY',
      referees: [],
      ...overrides
    });

    const fetchTransformed = async (fdMatch: Record<string, unknown>) => {
      api.setApiKey(mockApiKey);
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ matches: [fdMatch] })
      } as unknown as Response);
      const [match] = await api.getMatches();
      return match;
    };

    it('leaves result null while a match is IN_PLAY even if winner is populated', async () => {
      const match = await fetchTransformed(makeFdMatch({ status: 'IN_PLAY' }));
      expect(match.result).toBeNull();
      expect(match.full_time_result).toBeNull();
      expect(match.status).toBe('IN_PLAY');
      // Running goals must remain so the live ticker and goal-event diff keep working
      expect(match.home_goals).toBe(2);
      expect(match.away_goals).toBe(1);
    });

    it.each(['PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'] as const)(
      'leaves result null during %s',
      async (status) => {
        const match = await fetchTransformed(makeFdMatch({ status }));
        expect(match.result).toBeNull();
      }
    );

    it.each(['SUSPENDED', 'POSTPONED', 'CANCELLED', 'AWARDED'] as const)(
      'leaves result null when match is %s',
      async (status) => {
        const match = await fetchTransformed(makeFdMatch({ status }));
        expect(match.result).toBeNull();
      }
    );

    it('sets result only once status is FINISHED', async () => {
      const match = await fetchTransformed(
        makeFdMatch({ status: 'FINISHED', score: {
          winner: 'DRAW',
          fullTime: { home: 1, away: 1 },
          halfTime: { home: 0, away: 1 }
        } })
      );
      expect(match.result).toBe('D');
      expect(match.full_time_result).toBe('D');
      expect(match.home_goals).toBe(1);
      expect(match.away_goals).toBe(1);
    });

    it('still derives half_time_result mid-match so the UI can show HT scores', async () => {
      const match = await fetchTransformed(
        makeFdMatch({ status: 'PAUSED', score: {
          winner: 'HOME_TEAM',
          fullTime: { home: 1, away: 0 },
          halfTime: { home: 1, away: 0 }
        } })
      );
      expect(match.result).toBeNull();
      expect(match.half_time_result).toBe('H');
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
    it('should throw on rate limiting (429 status) so callers can show feedback', async () => {
      api.setApiKey(mockApiKey);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as unknown as Response);

      await expect(api.getMatches()).rejects.toThrow('Rate limit exceeded');
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

    it('should throw on API authentication failure (403 status) so callers can show feedback', async () => {
      api.setApiKey('invalid-key');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Your API token is invalid' })
      } as unknown as Response);

      await expect(api.getMatches()).rejects.toThrow('API authentication failed');
    });

    it('should throw on 403 rate limit (distinguished from auth failure)', async () => {
      api.setApiKey(mockApiKey);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'You reached your request rate limit' })
      } as unknown as Response);

      await expect(api.getMatches()).rejects.toThrow('Rate limit exceeded');
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

  describe('getTeamForm ordering (recency-inversion regression)', () => {
    // Element 0 MUST be the most recent match — consumers render form strings
    // newest-first and (pre-Butler) weighted element 0 heaviest. The original
    // implementation returned `.slice(-5)` of an ascending array — oldest
    // first — which gave the stalest result the heaviest weight and printed
    // form strings backwards relative to the match-detail caption.
    const mkMatch = (id: string, date: string, result: 'H' | 'D' | 'A', opponent: string) => ({
      id,
      season_id: 's1',
      date,
      home_team: 'Arsenal',
      away_team: opponent,
      home_goals: result === 'H' ? 2 : result === 'D' ? 1 : 0,
      away_goals: result === 'A' ? 2 : result === 'D' ? 1 : 0,
      result,
      home_odds: null, draw_odds: null, away_odds: null,
      first_half_home_goals: null, first_half_away_goals: null,
      full_time_result: result, half_time_result: null,
      referee: null,
      home_shots: null, away_shots: null,
      home_shots_target: null, away_shots_target: null,
      home_fouls: null, away_fouls: null,
      home_corners: null, away_corners: null,
      home_yellows: null, away_yellows: null,
      home_reds: null, away_reds: null,
      created_at: date,
      status: 'FINISHED' as const,
    });

    it('returns newest-first when given an ascending (API-order) match array', async () => {
      // Ascending by date: the OLDEST is a win, the NEWEST is a loss.
      const ascending = [
        mkMatch('m1', '2026-03-01T15:00:00Z', 'H', 'Oldest FC'),   // W (oldest)
        mkMatch('m2', '2026-03-08T15:00:00Z', 'H', 'Mid1 FC'),     // W
        mkMatch('m3', '2026-03-15T15:00:00Z', 'D', 'Mid2 FC'),     // D
        mkMatch('m4', '2026-03-22T15:00:00Z', 'A', 'Mid3 FC'),     // L
        mkMatch('m5', '2026-04-01T15:00:00Z', 'A', 'Newest FC'),   // L (newest)
      ];

      const form = await api.getTeamForm('Arsenal', ascending);
      expect(form).not.toBeNull();
      // Element 0 = most recent match (the loss to Newest FC).
      expect(form![0].opponent).toBe('Newest FC');
      expect(form![0].result).toBe('L');
      expect(form![4].opponent).toBe('Oldest FC');
      expect(form![4].result).toBe('W');
      // The rendered string therefore reads newest → oldest: LLDWW.
      expect(form!.map((f) => f.result).join('')).toBe('LLDWW');
    });

    it('is insensitive to the input array order', async () => {
      const shuffled = [
        mkMatch('m3', '2026-03-15T15:00:00Z', 'D', 'Mid2 FC'),
        mkMatch('m5', '2026-04-01T15:00:00Z', 'A', 'Newest FC'),
        mkMatch('m1', '2026-03-01T15:00:00Z', 'H', 'Oldest FC'),
        mkMatch('m4', '2026-03-22T15:00:00Z', 'A', 'Mid3 FC'),
        mkMatch('m2', '2026-03-08T15:00:00Z', 'H', 'Mid1 FC'),
      ];
      const form = await api.getTeamForm('Arsenal', shuffled);
      expect(form!.map((f) => f.result).join('')).toBe('LLDWW');
    });

    it('keeps only the 5 most recent when more completed matches exist', async () => {
      const six = [
        mkMatch('m0', '2026-02-20T15:00:00Z', 'A', 'Ancient FC'), // should drop
        mkMatch('m1', '2026-03-01T15:00:00Z', 'H', 'Oldest FC'),
        mkMatch('m2', '2026-03-08T15:00:00Z', 'H', 'Mid1 FC'),
        mkMatch('m3', '2026-03-15T15:00:00Z', 'D', 'Mid2 FC'),
        mkMatch('m4', '2026-03-22T15:00:00Z', 'A', 'Mid3 FC'),
        mkMatch('m5', '2026-04-01T15:00:00Z', 'A', 'Newest FC'),
      ];
      const form = await api.getTeamForm('Arsenal', six);
      expect(form).toHaveLength(5);
      expect(form!.some((f) => f.opponent === 'Ancient FC')).toBe(false);
    });
  });
});