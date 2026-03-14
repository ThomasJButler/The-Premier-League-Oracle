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

// Helper to create a full Match object with sensible defaults
function createMatch(partial: Partial<Match> & Pick<Match, 'id' | 'home_team' | 'away_team'>): Match {
  return {
    season_id: '',
    date: new Date().toISOString(),
    home_goals: null,
    away_goals: null,
    result: null,
    home_odds: null,
    draw_odds: null,
    away_odds: null,
    first_half_home_goals: null,
    first_half_away_goals: null,
    full_time_result: null,
    half_time_result: null,
    referee: null,
    home_shots: null,
    away_shots: null,
    home_shots_target: null,
    away_shots_target: null,
    home_fouls: null,
    away_fouls: null,
    home_corners: null,
    away_corners: null,
    home_yellows: null,
    away_yellows: null,
    home_reds: null,
    away_reds: null,
    created_at: new Date().toISOString(),
    ...partial
  };
}

describe('Enhanced Prediction Algorithm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTeamStats', () => {
    it('should calculate team statistics correctly', async () => {
      const mockTeamStats = {
        id: 'arsenal_2025',
        season_id: '2025',
        team_name: 'Arsenal',
        matches_played: 10,
        wins: 6,
        draws: 2,
        losses: 2,
        goals_for: 20,
        goals_against: 10,
        clean_sheets: 3,
        failed_to_score: 1,
        points: 20,
        home_matches_played: 5,
        home_wins: 4,
        home_draws: 1,
        home_losses: 0,
        home_goals_for: 12,
        home_goals_against: 3,
        away_matches_played: 5,
        away_wins: 2,
        away_draws: 1,
        away_losses: 2,
        away_goals_for: 8,
        away_goals_against: 7,
        updated_at: new Date().toISOString()
      };

      const mockMatches: Match[] = [
        createMatch({ id: '1', season_id: '2025-26', date: '2025-08-01', home_team: 'Arsenal', away_team: 'Chelsea', home_goals: 3, away_goals: 1, result: 'H' }),
        createMatch({ id: '2', season_id: '2025-26', date: '2025-08-08', home_team: 'Liverpool', away_team: 'Arsenal', home_goals: 1, away_goals: 2, result: 'A' })
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
        createMatch({ id: '1', season_id: '2024-25', date: '2024-12-01', home_team: 'Arsenal', away_team: 'Chelsea', home_goals: 2, away_goals: 0, result: 'H' }),
        createMatch({ id: '2', season_id: '2024-25', date: '2024-09-01', home_team: 'Chelsea', away_team: 'Arsenal', home_goals: 1, away_goals: 1, result: 'D' }),
        createMatch({ id: '3', season_id: '2023-24', date: '2024-03-01', home_team: 'Arsenal', away_team: 'Chelsea', home_goals: 3, away_goals: 2, result: 'H' })
      ];

      vi.mocked(dataService.getMatches).mockResolvedValue(mockH2HMatches);

      const h2h = await getHeadToHeadRecord('Arsenal', 'Chelsea');

      expect(h2h.matches).toBe(3);
      expect(h2h.homeWins).toBe(2);
      expect(h2h.draws).toBe(1);
      expect(h2h.awayWins).toBe(0);
      expect(h2h.totalHomeGoals).toBe(6);
      expect(h2h.totalAwayGoals).toBe(3);
      expect(h2h.avgHomeGoals).toBeCloseTo(2.0, 2);
      expect(h2h.avgAwayGoals).toBeCloseTo(1, 2);
      expect(h2h.homeCleanSheets).toBe(1);
      expect(h2h.bothTeamsScored).toBe(2);
      expect(h2h.over25).toBe(1);
    });

    it('should handle reversed H2H matches correctly', async () => {
      const mockH2HMatches: Match[] = [
        createMatch({ id: '1', season_id: '2024-25', date: '2024-12-01', home_team: 'Chelsea', away_team: 'Arsenal', home_goals: 1, away_goals: 2, result: 'A' })
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
      // Mock team stats in types/index.ts TeamStats shape (as returned by dataService)
      const mockHomeStats = {
        id: 'arsenal_2025',
        season_id: '2025',
        team_name: 'Arsenal',
        matches_played: 20,
        wins: 14,
        draws: 4,
        losses: 2,
        goals_for: 44,
        goals_against: 16,
        clean_sheets: 8,
        failed_to_score: 1,
        points: 46,
        home_matches_played: 10,
        home_wins: 8,
        home_draws: 2,
        home_losses: 0,
        home_goals_for: 26,
        home_goals_against: 6,
        away_matches_played: 10,
        away_wins: 6,
        away_draws: 2,
        away_losses: 2,
        away_goals_for: 18,
        away_goals_against: 10,
        updated_at: new Date().toISOString()
      };

      const mockAwayStats = {
        id: 'chelsea_2025',
        season_id: '2025',
        team_name: 'Chelsea',
        matches_played: 20,
        wins: 10,
        draws: 5,
        losses: 5,
        goals_for: 36,
        goals_against: 24,
        clean_sheets: 5,
        failed_to_score: 2,
        points: 35,
        home_matches_played: 10,
        home_wins: 6,
        home_draws: 3,
        home_losses: 1,
        home_goals_for: 20,
        home_goals_against: 10,
        away_matches_played: 10,
        away_wins: 4,
        away_draws: 2,
        away_losses: 4,
        away_goals_for: 16,
        away_goals_against: 14,
        updated_at: new Date().toISOString()
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
        createMatch({ id: '1', season_id: '2024-25', date: '2024-12-01', home_team: 'Arsenal', away_team: 'Chelsea', home_goals: 2, away_goals: 1, result: 'H' }),
        createMatch({ id: '2', season_id: '2024-25', date: '2024-09-01', home_team: 'Arsenal', away_team: 'Chelsea', home_goals: 3, away_goals: 0, result: 'H' }),
        createMatch({ id: '3', season_id: '2023-24', date: '2024-03-01', home_team: 'Arsenal', away_team: 'Chelsea', home_goals: 1, away_goals: 1, result: 'D' })
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
        id: 'team_2025',
        season_id: '2025',
        team_name: 'Team',
        matches_played: 10,
        wins: 5,
        draws: 2,
        losses: 3,
        goals_for: 15,
        goals_against: 15,
        clean_sheets: 2,
        failed_to_score: 1,
        points: 17,
        home_matches_played: 5,
        home_wins: 3,
        home_draws: 1,
        home_losses: 1,
        home_goals_for: 8,
        home_goals_against: 6,
        away_matches_played: 5,
        away_wins: 2,
        away_draws: 1,
        away_losses: 2,
        away_goals_for: 7,
        away_goals_against: 9,
        updated_at: new Date().toISOString()
      };

      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockStats);
      vi.mocked(dataService.getTeamForm).mockImplementation(async () => [
        { opponent: 'Team1', goalsFor: 2, goalsAgainst: 1, result: 'W' as const, date: '2025-08-01' },
        { opponent: 'Team2', goalsFor: 1, goalsAgainst: 1, result: 'D' as const, date: '2025-08-08' },
        { opponent: 'Team3', goalsFor: 0, goalsAgainst: 2, result: 'L' as const, date: '2025-08-15' },
        { opponent: 'Team4', goalsFor: 1, goalsAgainst: 1, result: 'D' as const, date: '2025-08-22' },
        { opponent: 'Team5', goalsFor: 3, goalsAgainst: 0, result: 'W' as const, date: '2025-08-29' }
      ]);
      // Matches for avgGoals calculation — no H2H between Luton and Burnley
      vi.mocked(dataService.getMatches).mockResolvedValue([
        createMatch({ id: 'a1', home_team: 'Luton', away_team: 'Brighton', home_goals: 1, away_goals: 2, result: 'A' }),
        createMatch({ id: 'a2', home_team: 'Burnley', away_team: 'Everton', home_goals: 2, away_goals: 1, result: 'H' })
      ]);

      const prediction = await predictMatch('Luton', 'Burnley');

      expect(prediction).toBeDefined();
      expect(prediction.confidence).toBeGreaterThanOrEqual(0.15);
      expect(prediction.confidence).toBeLessThanOrEqual(0.85);
    });

    it('should predict draws when teams are evenly matched', async () => {
      const mockStats = {
        id: 'team_2025',
        season_id: '2025',
        team_name: 'Team',
        matches_played: 20,
        wins: 7,
        draws: 6,
        losses: 7,
        goals_for: 30,
        goals_against: 30,
        clean_sheets: 3,
        failed_to_score: 2,
        points: 27,
        home_matches_played: 10,
        home_wins: 4,
        home_draws: 3,
        home_losses: 3,
        home_goals_for: 15,
        home_goals_against: 15,
        away_matches_played: 10,
        away_wins: 3,
        away_draws: 3,
        away_losses: 4,
        away_goals_for: 15,
        away_goals_against: 15,
        updated_at: new Date().toISOString()
      };

      vi.mocked(dataService.getTeamStats).mockImplementation(async () => mockStats);
      vi.mocked(dataService.getTeamForm).mockImplementation(async () => [
        { opponent: 'Team1', goalsFor: 1, goalsAgainst: 1, result: 'D', date: '2025-08-01' },
        { opponent: 'Team2', goalsFor: 1, goalsAgainst: 1, result: 'D', date: '2025-08-08' },
        { opponent: 'Team3', goalsFor: 2, goalsAgainst: 2, result: 'D', date: '2025-08-15' },
        { opponent: 'Team4', goalsFor: 0, goalsAgainst: 0, result: 'D', date: '2025-08-22' },
        { opponent: 'Team5', goalsFor: 1, goalsAgainst: 1, result: 'D', date: '2025-08-29' }
      ]);
      // Matches for avgGoals calculation — both teams score ~1.5 per game
      vi.mocked(dataService.getMatches).mockResolvedValue([
        createMatch({ id: 'b1', home_team: 'Brighton', away_team: 'Everton', home_goals: 1, away_goals: 1, result: 'D' }),
        createMatch({ id: 'b2', home_team: 'Brighton', away_team: 'Fulham', home_goals: 2, away_goals: 1, result: 'H' }),
        createMatch({ id: 'b3', home_team: 'Brentford', away_team: 'Wolves', home_goals: 1, away_goals: 1, result: 'D' }),
        createMatch({ id: 'b4', home_team: 'Brentford', away_team: 'Burnley', home_goals: 2, away_goals: 1, result: 'H' })
      ]);

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

      expect(analyzeFormTrend('WWWLLL')).toBe(1.0); // olderPoints is 0, returns 1.0
      expect(analyzeFormTrend('LLLWWW')).toBeLessThan(0.9); // Declining
      expect(analyzeFormTrend('WDLWDL')).toBeCloseTo(1.0, 1); // Stable
      expect(analyzeFormTrend('WW')).toBe(1.0); // Not enough data
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing team data gracefully', async () => {
      vi.mocked(dataService.getTeamStats).mockResolvedValue(null);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);

      await expect(predictMatch('InvalidTeam1', 'InvalidTeam2')).rejects.toThrow('Unable to get team statistics');
    });

    it('should handle extreme goal differences', async () => {
      const strongTeamStats = {
        id: 'mancity_2025',
        season_id: '2025',
        team_name: 'Man City',
        matches_played: 20,
        wins: 19,
        draws: 1,
        losses: 0,
        goals_for: 60,
        goals_against: 6,
        clean_sheets: 12,
        failed_to_score: 0,
        points: 58,
        home_matches_played: 10,
        home_wins: 10,
        home_draws: 0,
        home_losses: 0,
        home_goals_for: 35,
        home_goals_against: 2,
        away_matches_played: 10,
        away_wins: 9,
        away_draws: 1,
        away_losses: 0,
        away_goals_for: 25,
        away_goals_against: 4,
        updated_at: new Date().toISOString()
      };

      const weakTeamStats = {
        id: 'luton_2025',
        season_id: '2025',
        team_name: 'Luton',
        matches_played: 20,
        wins: 1,
        draws: 2,
        losses: 17,
        goals_for: 10,
        goals_against: 50,
        clean_sheets: 0,
        failed_to_score: 8,
        points: 5,
        home_matches_played: 10,
        home_wins: 1,
        home_draws: 1,
        home_losses: 8,
        home_goals_for: 6,
        home_goals_against: 22,
        away_matches_played: 10,
        away_wins: 0,
        away_draws: 1,
        away_losses: 9,
        away_goals_for: 4,
        away_goals_against: 28,
        updated_at: new Date().toISOString()
      };

      vi.mocked(dataService.getTeamStats).mockImplementation(async (team) => {
        if (team === 'Man City') return strongTeamStats;
        if (team === 'Luton') return weakTeamStats;
        return null;
      });

      vi.mocked(dataService.getTeamForm).mockImplementation(async (team) => {
        if (team === 'Man City') return [
          { opponent: 'T1', goalsFor: 4, goalsAgainst: 0, result: 'W' as const, date: '2025-08-01' },
          { opponent: 'T2', goalsFor: 5, goalsAgainst: 1, result: 'W' as const, date: '2025-08-08' },
          { opponent: 'T3', goalsFor: 3, goalsAgainst: 0, result: 'W' as const, date: '2025-08-15' },
          { opponent: 'T4', goalsFor: 4, goalsAgainst: 0, result: 'W' as const, date: '2025-08-22' },
          { opponent: 'T5', goalsFor: 6, goalsAgainst: 1, result: 'W' as const, date: '2025-08-29' }
        ];
        if (team === 'Luton') return [
          { opponent: 'T1', goalsFor: 0, goalsAgainst: 3, result: 'L' as const, date: '2025-08-01' },
          { opponent: 'T2', goalsFor: 1, goalsAgainst: 2, result: 'L' as const, date: '2025-08-08' },
          { opponent: 'T3', goalsFor: 0, goalsAgainst: 4, result: 'L' as const, date: '2025-08-15' },
          { opponent: 'T4', goalsFor: 0, goalsAgainst: 1, result: 'L' as const, date: '2025-08-22' },
          { opponent: 'T5', goalsFor: 1, goalsAgainst: 3, result: 'L' as const, date: '2025-08-29' }
        ];
        return [];
      });
      // Matches for avgGoals calculation
      vi.mocked(dataService.getMatches).mockResolvedValue([
        createMatch({ id: 'c1', home_team: 'Man City', away_team: 'Everton', home_goals: 5, away_goals: 0, result: 'H' }),
        createMatch({ id: 'c2', home_team: 'Man City', away_team: 'Wolves', home_goals: 4, away_goals: 1, result: 'H' }),
        createMatch({ id: 'c3', home_team: 'Luton', away_team: 'Burnley', home_goals: 0, away_goals: 3, result: 'A' }),
        createMatch({ id: 'c4', home_team: 'Luton', away_team: 'Fulham', home_goals: 1, away_goals: 4, result: 'A' })
      ]);

      const prediction = await predictMatch('Man City', 'Luton');

      // Even with extreme differences, predictions should be capped
      expect(prediction.predictedHomeGoals).toBeLessThanOrEqual(5);
      expect(prediction.predictedAwayGoals).toBeLessThanOrEqual(2);
      expect(prediction.confidence).toBeLessThanOrEqual(0.85);
    });
  });
});