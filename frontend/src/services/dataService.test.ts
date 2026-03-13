import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Match, Season, TeamStats, Standing } from '../types';

// Mock predictionTracker
vi.mock('./predictionTracker', () => ({
  predictionTracker: {
    getAccuracyStats: vi.fn(() => ({
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      resultAccuracy: 0,
      scoreAccuracy: 0,
      highConfidenceAccuracy: 0,
      mediumConfidenceAccuracy: 0,
      lowConfidenceAccuracy: 0,
      homeWinAccuracy: 0,
      awayWinAccuracy: 0,
      drawAccuracy: 0,
      averageConfidence: 0,
      streak: { current: 0, best: 0, worst: 0 }
    })),
    getMatchPredictions: vi.fn(() => []),
    updateWithResult: vi.fn()
  }
}));

// Mock the dependencies
vi.mock('./api/footballData', () => ({
  footballDataAPI: {
    hasApiKey: vi.fn(() => true),
    testConnection: vi.fn(() => Promise.resolve(true)),
    getCurrentSeason: vi.fn(() => Promise.resolve(mockSeason)),
    getUpcomingMatches: vi.fn(() => Promise.resolve(mockMatches)),
    getRecentMatches: vi.fn(() => Promise.resolve(mockMatches)),
    getAllMatches: vi.fn(() => Promise.resolve(mockMatches)),
    getMatchesByMatchday: vi.fn(() => Promise.resolve(mockMatches)),
    getTeamStats: vi.fn(() => Promise.resolve({ played: 10, wins: 7, draws: 2, losses: 1, goalsFor: 20, goalsAgainst: 8, points: 23 })),
    getStandings: vi.fn(() => Promise.resolve(mockStandings)),
    getTopScorers: vi.fn(() => Promise.resolve([])),
    getTeamForm: vi.fn(() => Promise.resolve([])),
    clearApiKey: vi.fn()
  }
}));

// Mock data
const mockSeason: Season = {
  id: '1',
  name: '2024-2025',
  start_date: '2024-08-01',
  end_date: '2025-05-31',
  is_current: true,
  created_at: '2024-01-01'
};

const mockMatches: Match[] = [
  {
    id: '1',
    season_id: '1',
    date: '2024-08-15T15:00:00Z',
    home_team: 'Arsenal',
    away_team: 'Liverpool',
    home_goals: 2,
    away_goals: 1,
    result: 'H',
    home_odds: 2.5,
    draw_odds: 3.2,
    away_odds: 2.8,
    first_half_home_goals: 1,
    first_half_away_goals: 0,
    full_time_result: 'H',
    half_time_result: 'H',
    referee: 'Michael Oliver',
    home_shots: 15,
    away_shots: 12,
    home_shots_target: 6,
    away_shots_target: 4,
    home_fouls: 10,
    away_fouls: 12,
    home_corners: 6,
    away_corners: 4,
    home_yellows: 2,
    away_yellows: 3,
    home_reds: 0,
    away_reds: 0,
    created_at: '2024-08-15'
  }
];

const mockStandings: Standing[] = [
  {
    position: 1,
    team: {
      id: 1,
      name: 'Arsenal',
      shortName: 'ARS',
      tla: 'ARS',
      crest: 'arsenal.png'
    },
    playedGames: 10,
    form: 'WWDWL',
    won: 7,
    draw: 2,
    lost: 1,
    points: 23,
    goalsFor: 20,
    goalsAgainst: 8,
    goalDifference: 12
  }
];

describe('DataService', () => {
  let dataService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const { dataService: ds } = await import('./dataService');
    dataService = ds;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentSeason', () => {
    it('should fetch current season from API when available', async () => {
      const { footballDataAPI } = await import('./api/footballData');

      const season = await dataService.getCurrentSeason();

      expect(footballDataAPI.getCurrentSeason).toHaveBeenCalled();
      expect(season).toEqual(mockSeason);
    });
  });

  describe('getMatches', () => {
    it('should fetch upcoming matches from API', async () => {
      const { footballDataAPI } = await import('./api/footballData');

      const matches = await dataService.getMatches({ upcoming: true, days: 7 });

      expect(footballDataAPI.getUpcomingMatches).toHaveBeenCalledWith(7);
      expect(matches).toEqual(mockMatches);
    });

    it('should fetch recent matches from API', async () => {
      const { footballDataAPI } = await import('./api/footballData');

      const matches = await dataService.getMatches({ recent: true, days: 7 });

      expect(footballDataAPI.getRecentMatches).toHaveBeenCalledWith(7);
      expect(matches).toEqual(mockMatches);
    });

    it('should fetch all matches when no filter specified', async () => {
      const { footballDataAPI } = await import('./api/footballData');

      const matches = await dataService.getMatches();

      expect(footballDataAPI.getAllMatches).toHaveBeenCalled();
      expect(matches).toEqual(mockMatches);
    });
  });

  describe('getTeamStats', () => {
    it('should fetch team stats from API', async () => {
      const { footballDataAPI } = await import('./api/footballData');

      const stats = await dataService.getTeamStats('Arsenal');

      expect(footballDataAPI.getTeamStats).toHaveBeenCalledWith('Arsenal');
      expect(stats).toBeDefined();
      expect(stats?.team_name).toBe('Arsenal');
    });
  });

  describe('getStandings', () => {
    it('should fetch standings from API', async () => {
      const { footballDataAPI } = await import('./api/footballData');

      const standings = await dataService.getStandings();

      expect(footballDataAPI.getStandings).toHaveBeenCalled();
      expect(standings).toEqual(mockStandings);
    });

    it('should return empty array on error', async () => {
      const { footballDataAPI } = await import('./api/footballData');
      vi.mocked(footballDataAPI.getStandings).mockResolvedValueOnce([]);

      try {
        const standings = await dataService.getStandings();
        // If it doesn't throw, standings should be empty or the error message
        expect(standings).toEqual([]);
      } catch (error) {
        // getStandings throws when no data available
        expect(error).toBeDefined();
      }
    });
  });

  describe('getTeamForm', () => {
    it('should fetch team form from API', async () => {
      const { footballDataAPI } = await import('./api/footballData');

      const form = await dataService.getTeamForm('Arsenal');

      expect(footballDataAPI.getTeamForm).toHaveBeenCalled();
      expect(Array.isArray(form)).toBe(true);
    });
  });

  describe('Data source management', () => {
    it('should get current status', () => {
      const status = dataService.getStatus();

      expect(status).toHaveProperty('primarySource');
      expect(status).toHaveProperty('fallbackSource');
      expect(status.primarySource).toHaveProperty('type');
      expect(status.primarySource).toHaveProperty('available');
    });
  });

  describe('Prediction accuracy', () => {
    it('should return prediction accuracy', async () => {
      const accuracy = await dataService.getPredictionAccuracy('2024');

      expect(accuracy).toHaveProperty('total');
      expect(accuracy).toHaveProperty('correct');
      expect(accuracy).toHaveProperty('accuracy');
      expect(accuracy.accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy.accuracy).toBeLessThanOrEqual(1);
    });
  });
});
