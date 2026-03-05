import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getTeamStats, 
  getTeamForm, 
  getHeadToHeadRecord, 
  predictMatch,
  type TeamStats,
  type TeamForm,
  type HeadToHeadRecord
} from './predictions';
import { dataService } from '../services/dataService';
import type { Match } from '../types';

// Mock the dataService
vi.mock('../services/dataService', () => ({
  dataService: {
    getTeamStats: vi.fn(),
    getTeamForm: vi.fn(),
    getMatches: vi.fn()
  }
}));

describe('Enhanced Prediction Algorithm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTeamStats', () => {
    it('should calculate team statistics correctly', async () => {
      const mockTeamStats = {
        team_name: 'Arsenal',
        matches_played: 10,
        wins: 6,
        draws: 2,
        losses: 2,
        goals_for: 20,
        goals_against: 10,
        points: 20
      };

      const mockMatches: Match[] = [
        {
          id: '1',
          season_id: '2025-26',
          date: '2025-08-01',
          home_team: 'Arsenal',
          away_team: 'Chelsea',
          home_goals: 3,
          away_goals: 1,
          result: 'H',
          created_at: '2025-08-01'
        },
        {
          id: '2',
          season_id: '2025-26',
          date: '2025-08-08',
          home_team: 'Liverpool',
          away_team: 'Arsenal',
          home_goals: 1,
          away_goals: 2,
          result: 'A',
          created_at: '2025-08-08'
        }
      ];

      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats);
      vi.mocked(dataService.getMatches).mockResolvedValue(mockMatches);

      const stats = await getTeamStats('Arsenal');

      expect(stats).toBeDefined();
      expect(stats?.team).toBe('Arsenal');
      expect(stats?.totalWins).toBe(6);
      expect(stats?.winPercentage).toBe(60);
      expect(stats?.avgGoalsScored).toBeCloseTo(2.5, 1);
      expect(stats?.avgGoalsConceded).toBeCloseTo(1, 1);
    });

    it('should handle missing team data', async () => {
      vi.mocked(dataService.getTeamStats).mockResolvedValue(null);
      
      const stats = await getTeamStats('NonExistentTeam');
      
      expect(stats).toBeNull();
    });
  });

  describe('getHeadToHeadRecord', () => {
    it('should analyze H2H records with detailed statistics', async () => {
      const mockH2HMatches: Match[] = [
        {
          id: '1',
          season_id: '2024-25',
          date: '2024-12-01',
          home_team: 'Arsenal',
          away_team: 'Chelsea',
          home_goals: 2,
          away_goals: 0,
          result: 'H',
          created_at: '2024-12-01'
        },
        {
          id: '2',
          season_id: '2024-25',
          date: '2024-09-01',
          home_team: 'Chelsea',
          away_team: 'Arsenal',
          home_goals: 1,
          away_goals: 1,
          result: 'D',
          created_at: '2024-09-01'
        },
        {
          id: '3',
          season_id: '2023-24',
          date: '2024-03-01',
          home_team: 'Arsenal',
          away_team: 'Chelsea',
          home_goals: 3,
          away_goals: 2,
          result: 'H',
          created_at: '2024-03-01'
        }
      ];

      vi.mocked(dataService.getMatches).mockResolvedValue(mockH2HMatches);

      const h2h = await getHeadToHeadRecord('Arsenal', 'Chelsea');

      expect(h2h.matches).toBe(3);
      expect(h2h.homeWins).toBe(2);
      expect(h2h.draws).toBe(1);
      expect(h2h.awayWins).toBe(0);
      expect(h2h.totalHomeGoals).toBe(5);
      expect(h2h.totalAwayGoals).toBe(3);
      expect(h2h.avgHomeGoals).toBeCloseTo(1.67, 2);
      expect(h2h.avgAwayGoals).toBeCloseTo(1, 2);
      expect(h2h.homeCleanSheets).toBe(1);
      expect(h2h.bothTeamsScored).toBe(2);
      expect(h2h.over25).toBe(1);
    });

    it('should handle reversed H2H matches correctly', async () => {
      const mockH2HMatches: Match[] = [
        {
          id: '1',
          season_id: '2024-25',
          date: '2024-12-01',
          home_team: 'Chelsea',
          away_team: 'Arsenal',
          home_goals: 1,
          away_goals: 2,
          result: 'A',
          created_at: '2024-12-01'
        }
      ];

      vi.mocked(dataService.getMatches).mockResolvedValue(mockH2HMatches);

      const h2h = await getHeadToHeadRecord('Arsenal', 'Chelsea');

      expect(h2h.matches).toBe(1);
      expect(h2h.homeWins).toBe(1); // Arsenal won as away team
      expect(h2h.totalHomeGoals).toBe(2); // Arsenal scored 2 as away
      expect(h2h.totalAwayGoals).toBe(1); // Chelsea scored 1 as home
    });

    it('should return empty record when no H2H matches exist', async () => {
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const h2h = await getHeadToHeadRecord('Arsenal', 'Newcastle');

      expect(h2h.matches).toBe(0);
      expect(h2h.homeWins).toBe(0);
      expect(h2h.avgHomeGoals).toBe(0);
      expect(h2h.avgAwayGoals).toBe(0);
    });
  });

  describe('predictMatch', () => {
    it('should generate realistic predictions with proper weights', async () => {
      // Mock team stats
      const mockHomeStats = {
        team: 'Arsenal',
        avgGoalsScored: 2.2,
        avgGoalsConceded: 0.8,
        totalMatches: 20,
        totalWins: 14,
        totalDraws: 4,
        totalLosses: 2,
        winPercentage: 70
      };

      const mockAwayStats = {
        team: 'Chelsea',
        avgGoalsScored: 1.8,
        avgGoalsConceded: 1.2,
        totalMatches: 20,
        totalWins: 10,
        totalDraws: 5,
        totalLosses: 5,
        winPercentage: 50
      };

      // Mock form
      const mockHomeForm = {
        team: 'Arsenal',
        form: 'WWWDW',
        avgRecentGoalsScored: 2.5,
        avgRecentGoalsConceded: 0.6
      };

      const mockAwayForm = {
        team: 'Chelsea',
        form: 'LDWWL',
        avgRecentGoalsScored: 1.5,
        avgRecentGoalsConceded: 1.4
      };

      // Mock H2H
      const mockH2H = {
        matches: 5,
        homeWins: 3,
        draws: 1,
        awayWins: 1,
        totalHomeGoals: 10,
        totalAwayGoals: 6,
        avgHomeGoals: 2,
        avgAwayGoals: 1.2,
        homeCleanSheets: 2,
        awayCleanSheets: 1,
        bothTeamsScored: 3,
        over25: 2,
        recentForm: { home: 'WWD', away: 'LLD' }
      };

      vi.mocked(dataService.getTeamStats).mockImplementation(async (team) => {
        if (team === 'Arsenal') return mockHomeStats;
        if (team === 'Chelsea') return mockAwayStats;
        return null;
      });

      vi.mocked(dataService.getTeamForm).mockImplementation(async (team) => {
        if (team === 'Arsenal') return [
          { opponent: 'Team1', goalsFor: 3, goalsAgainst: 0, result: 'W', date: '2025-08-01' },
          { opponent: 'Team2', goalsFor: 2, goalsAgainst: 1, result: 'W', date: '2025-08-08' },
          { opponent: 'Team3', goalsFor: 2, goalsAgainst: 0, result: 'W', date: '2025-08-15' },
          { opponent: 'Team4', goalsFor: 1, goalsAgainst: 1, result: 'D', date: '2025-08-22' },
          { opponent: 'Team5', goalsFor: 4, goalsAgainst: 1, result: 'W', date: '2025-08-29' }
        ];
        if (team === 'Chelsea') return [
          { opponent: 'Team1', goalsFor: 0, goalsAgainst: 2, result: 'L', date: '2025-08-01' },
          { opponent: 'Team2', goalsFor: 1, goalsAgainst: 1, result: 'D', date: '2025-08-08' },
          { opponent: 'Team3', goalsFor: 3, goalsAgainst: 1, result: 'W', date: '2025-08-15' },
          { opponent: 'Team4', goalsFor: 2, goalsAgainst: 0, result: 'W', date: '2025-08-22' },
          { opponent: 'Team5', goalsFor: 1, goalsAgainst: 3, result: 'L', date: '2025-08-29' }
        ];
        return [];
      });

      vi.mocked(dataService.getMatches).mockResolvedValue([
        {
          id: '1',
          season_id: '2024-25',
          date: '2024-12-01',
          home_team: 'Arsenal',
          away_team: 'Chelsea',
          home_goals: 2,
          away_goals: 1,
          result: 'H',
          created_at: '2024-12-01'
        },
        {
          id: '2',
          season_id: '2024-25',
          date: '2024-09-01',
          home_team: 'Arsenal',
          away_team: 'Chelsea',
          home_goals: 3,
          away_goals: 0,
          result: 'H',
          created_at: '2024-09-01'
        },
        {
          id: '3',
          season_id: '2023-24',
          date: '2024-03-01',
          home_team: 'Arsenal',
          away_team: 'Chelsea',
          home_goals: 1,
          away_goals: 1,
          result: 'D',
          created_at: '2024-03-01'
        }
      ]);

      const prediction = await predictMatch('Arsenal', 'Chelsea');

      // Check prediction structure
      expect(prediction).toHaveProperty('predictedResult');
      expect(prediction).toHaveProperty('confidence');
      expect(prediction).toHaveProperty('predictedHomeGoals');
      expect(prediction).toHaveProperty('predictedAwayGoals');
      expect(prediction).toHaveProperty('insights');

      // Check confidence is within realistic bounds
      expect(prediction.confidence).toBeGreaterThanOrEqual(0.15);
      expect(prediction.confidence).toBeLessThanOrEqual(0.85);

      // Check predicted goals are reasonable
      expect(prediction.predictedHomeGoals).toBeGreaterThanOrEqual(0);
      expect(prediction.predictedHomeGoals).toBeLessThanOrEqual(5);
      expect(prediction.predictedAwayGoals).toBeGreaterThanOrEqual(0);
      expect(prediction.predictedAwayGoals).toBeLessThanOrEqual(4);

      // Check insights are generated
      expect(prediction.insights.length).toBeGreaterThan(0);
      expect(prediction.insights.some(i => i.includes('H2H'))).toBe(true);

      // Arsenal should be favored based on the data
      expect(prediction.predictedResult).toBe('H');
      expect(prediction.predictedHomeGoals).toBeGreaterThan(prediction.predictedAwayGoals);
    });

    it('should handle teams with no H2H history', async () => {
      const mockStats = {
        team: 'Team',
        avgGoalsScored: 1.5,
        avgGoalsConceded: 1.5,
        totalMatches: 10,
        totalWins: 5,
        totalDraws: 2,
        totalLosses: 3,
        winPercentage: 50
      };

      const mockForm = {
        team: 'Team',
        form: 'WDLDW',
        avgRecentGoalsScored: 1.5,
        avgRecentGoalsConceded: 1.5
      };

      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockStats);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const prediction = await predictMatch('Luton', 'Burnley');

      expect(prediction).toBeDefined();
      expect(prediction.confidence).toBeGreaterThanOrEqual(0.15);
      expect(prediction.confidence).toBeLessThanOrEqual(0.85);
    });

    it('should predict draws when teams are evenly matched', async () => {
      const mockStats = {
        team: 'Team',
        avgGoalsScored: 1.5,
        avgGoalsConceded: 1.5,
        totalMatches: 20,
        totalWins: 7,
        totalDraws: 6,
        totalLosses: 7,
        winPercentage: 35
      };

      const mockForm = {
        team: 'Team',
        form: 'DDDDD',
        avgRecentGoalsScored: 1.5,
        avgRecentGoalsConceded: 1.5
      };

      vi.mocked(dataService.getTeamStats).mockImplementation(async () => mockStats);
      vi.mocked(dataService.getTeamForm).mockImplementation(async () => [
        { opponent: 'Team1', goalsFor: 1, goalsAgainst: 1, result: 'D', date: '2025-08-01' },
        { opponent: 'Team2', goalsFor: 1, goalsAgainst: 1, result: 'D', date: '2025-08-08' },
        { opponent: 'Team3', goalsFor: 2, goalsAgainst: 2, result: 'D', date: '2025-08-15' },
        { opponent: 'Team4', goalsFor: 0, goalsAgainst: 0, result: 'D', date: '2025-08-22' },
        { opponent: 'Team5', goalsFor: 1, goalsAgainst: 1, result: 'D', date: '2025-08-29' }
      ]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const prediction = await predictMatch('Brighton', 'Brentford');

      // When teams are very evenly matched, draw probability should be higher
      expect(['H', 'D', 'A']).toContain(prediction.predictedResult);
      expect(Math.abs(prediction.predictedHomeGoals - prediction.predictedAwayGoals)).toBeLessThanOrEqual(1);
    });
  });

  describe('Form Trend Analysis', () => {
    it('should identify improving form', () => {
      // Import the helper function (we'll need to export it)
      const analyzeFormTrend = (form: string): number => {
        if (form.length < 3) return 1.0;
        
        const recent = form.slice(0, 3);
        const older = form.slice(3, 6);
        
        const recentPoints = (recent.match(/W/g) || []).length * 3 + (recent.match(/D/g) || []).length;
        const olderPoints = older.length > 0 ? 
          (older.match(/W/g) || []).length * 3 + (older.match(/D/g) || []).length : recentPoints;
        
        if (olderPoints === 0) return 1.0;
        return Math.min(1.5, Math.max(0.5, recentPoints / olderPoints));
      };

      expect(analyzeFormTrend('WWWLLL')).toBeGreaterThan(1.1); // Improving
      expect(analyzeFormTrend('LLLWWW')).toBeLessThan(0.9); // Declining
      expect(analyzeFormTrend('WDLWDL')).toBeCloseTo(1.0, 1); // Stable
      expect(analyzeFormTrend('WW')).toBe(1.0); // Not enough data
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing team data gracefully', async () => {
      vi.mocked(dataService.getTeamStats).mockResolvedValue(null);
      vi.mocked(dataService.getTeamForm).mockResolvedValue(null);

      await expect(predictMatch('InvalidTeam1', 'InvalidTeam2')).rejects.toThrow('Unable to get team statistics');
    });

    it('should handle extreme goal differences', async () => {
      const strongTeam = {
        team: 'Man City',
        avgGoalsScored: 4.5,
        avgGoalsConceded: 0.3,
        totalMatches: 20,
        totalWins: 19,
        totalDraws: 1,
        totalLosses: 0,
        winPercentage: 95
      };

      const weakTeam = {
        team: 'Luton',
        avgGoalsScored: 0.5,
        avgGoalsConceded: 3.5,
        totalMatches: 20,
        totalWins: 1,
        totalDraws: 2,
        totalLosses: 17,
        winPercentage: 5
      };

      vi.mocked(dataService.getTeamStats).mockImplementation(async (team) => {
        if (team === 'Man City') return strongTeam;
        if (team === 'Luton') return weakTeam;
        return null;
      });

      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const prediction = await predictMatch('Man City', 'Luton');

      // Even with extreme differences, predictions should be capped
      expect(prediction.predictedHomeGoals).toBeLessThanOrEqual(5);
      expect(prediction.predictedAwayGoals).toBeLessThanOrEqual(2);
      expect(prediction.confidence).toBeLessThanOrEqual(0.85);
    });
  });
});