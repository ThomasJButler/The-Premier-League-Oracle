import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OptimizedPredictor } from './optimizedPredictions';
import { EloRatingSystem, sharedEloSystem } from './advancedPredictions';
import { dataService } from '../services/dataService';
import type { Match, Standing } from '../types';

vi.mock('../services/dataService', () => ({
  dataService: {
    getStandings: vi.fn(),
    getTeamForm: vi.fn(),
    getMatches: vi.fn()
  }
}));

/** Creates a full Match object with sensible defaults. Override any field as needed. */
function createMockMatch(
  overrides: Partial<Match> & { id: string; home_team: string; away_team: string }
): Match {
  return {
    season_id: '2025-26',
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
    ...overrides
  };
}

function createMockStanding(overrides: Partial<Standing> & { team: Standing['team']; position: number }): Standing {
  return {
    playedGames: 20,
    form: 'WWDLD',
    won: 10,
    draw: 5,
    lost: 5,
    points: 35,
    goalsFor: 30,
    goalsAgainst: 20,
    goalDifference: 10,
    ...overrides
  };
}

describe('OptimizedPredictor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('predictMatch', () => {
    it('should return a valid prediction with all required fields', async () => {
      const standings: Standing[] = [
        createMockStanding({
          position: 1,
          team: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: '' },
          playedGames: 25, won: 18, draw: 4, lost: 3, points: 58, goalsFor: 55, goalsAgainst: 18, goalDifference: 37
        }),
        createMockStanding({
          position: 6,
          team: { id: 61, name: 'Chelsea FC', shortName: 'Chelsea', tla: 'CHE', crest: '' },
          playedGames: 25, won: 12, draw: 6, lost: 7, points: 42, goalsFor: 40, goalsAgainst: 30, goalDifference: 10
        })
      ];

      vi.mocked(dataService.getStandings).mockResolvedValue(standings);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([
        { opponent: 'Team1', goalsFor: 2, goalsAgainst: 0, result: 'W', date: '2026-02-01' },
        { opponent: 'Team2', goalsFor: 1, goalsAgainst: 1, result: 'D', date: '2026-02-08' },
        { opponent: 'Team3', goalsFor: 3, goalsAgainst: 1, result: 'W', date: '2026-02-15' }
      ]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      // Structure checks
      expect(prediction).toHaveProperty('predictedResult');
      expect(prediction).toHaveProperty('confidence');
      expect(prediction).toHaveProperty('predictedHomeGoals');
      expect(prediction).toHaveProperty('predictedAwayGoals');
      expect(prediction).toHaveProperty('modelWeights');
      expect(prediction).toHaveProperty('insights');
      expect(prediction).toHaveProperty('valueOdds');

      // Value ranges
      expect(['H', 'D', 'A']).toContain(prediction.predictedResult);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0.25);
      expect(prediction.confidence).toBeLessThanOrEqual(0.95);
      expect(prediction.predictedHomeGoals).toBeGreaterThanOrEqual(0);
      expect(prediction.predictedAwayGoals).toBeGreaterThanOrEqual(0);

      // Model weights should sum to 1
      const { elo, poisson, form, h2h, standings: sw } = prediction.modelWeights;
      expect(elo + poisson + form + h2h + sw).toBeCloseTo(1.0, 5);
    });

    it('should favour the stronger team at home', async () => {
      const standings: Standing[] = [
        createMockStanding({
          position: 1,
          team: { id: 65, name: 'Manchester City FC', shortName: 'Man City', tla: 'MCI', crest: '' },
          playedGames: 25, won: 20, draw: 3, lost: 2, points: 63, goalsFor: 65, goalsAgainst: 15, goalDifference: 50
        }),
        createMockStanding({
          position: 18,
          team: { id: 340, name: 'Southampton FC', shortName: 'Southampton', tla: 'SOU', crest: '' },
          playedGames: 25, won: 3, draw: 5, lost: 17, points: 14, goalsFor: 15, goalsAgainst: 50, goalDifference: -35
        })
      ];

      vi.mocked(dataService.getStandings).mockResolvedValue(standings);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([
        { opponent: 'T1', goalsFor: 3, goalsAgainst: 0, result: 'W', date: '2026-02-01' },
        { opponent: 'T2', goalsFor: 4, goalsAgainst: 1, result: 'W', date: '2026-02-08' }
      ]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const prediction = await OptimizedPredictor.predictMatch('Manchester City FC', 'Southampton FC');

      expect(prediction.predictedResult).toBe('H');
      expect(prediction.predictedHomeGoals).toBeGreaterThan(prediction.predictedAwayGoals);
    });

    it('should return a valid fallback when data is unavailable', async () => {
      vi.mocked(dataService.getStandings).mockRejectedValue(new Error('Network error'));
      vi.mocked(dataService.getTeamForm).mockRejectedValue(new Error('Network error'));
      vi.mocked(dataService.getMatches).mockRejectedValue(new Error('Network error'));

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      expect(['H', 'D', 'A']).toContain(prediction.predictedResult);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0.25);
      expect(prediction.insights.length).toBeGreaterThan(0);
    });

    it('should include H2H insights when historical matches exist', async () => {
      const standings: Standing[] = [
        createMockStanding({
          position: 2,
          team: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: '' }
        }),
        createMockStanding({
          position: 7,
          team: { id: 61, name: 'Chelsea FC', shortName: 'Chelsea', tla: 'CHE', crest: '' }
        })
      ];

      const h2hMatches = [
        createMockMatch({ id: '1', home_team: 'Arsenal FC', away_team: 'Chelsea FC', home_goals: 3, away_goals: 1, result: 'H' as const }),
        createMockMatch({ id: '2', home_team: 'Arsenal FC', away_team: 'Chelsea FC', home_goals: 2, away_goals: 0, result: 'H' as const }),
        createMockMatch({ id: '3', home_team: 'Chelsea FC', away_team: 'Arsenal FC', home_goals: 0, away_goals: 1, result: 'A' as const }),
      ];

      vi.mocked(dataService.getStandings).mockResolvedValue(standings);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([
        { opponent: 'T1', goalsFor: 2, goalsAgainst: 1, result: 'W', date: '2026-02-01' }
      ]);
      vi.mocked(dataService.getMatches).mockResolvedValue(h2hMatches);

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC', h2hMatches);

      // Arsenal dominates H2H — should appear in insights
      const h2hInsight = prediction.insights.find(i => i.includes('H2H'));
      expect(h2hInsight).toBeDefined();
    });
  });

  describe('model weights consistency', () => {
    it('should use the documented ensemble weights (ELO 25%, Poisson 30%, Form 20%, H2H 10%, Standings 15%)', async () => {
      vi.mocked(dataService.getStandings).mockResolvedValue([]);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      expect(prediction.modelWeights).toEqual({
        elo: 0.25,
        poisson: 0.30,
        form: 0.20,
        h2h: 0.10,
        standings: 0.15
      });
    });
  });

  describe('ELO integration', () => {
    it('should use the shared ELO system (single source of truth)', () => {
      // The shared ELO system should have ratings for all PL teams
      const arsenalRating = sharedEloSystem.getTeamRating('Arsenal FC');
      expect(arsenalRating).toBeGreaterThan(1400);
      expect(arsenalRating).toBeLessThan(2000);
    });

    it('should resolve team name aliases correctly', () => {
      const fullName = sharedEloSystem.getTeamRating('Arsenal FC');
      const shortName = sharedEloSystem.getTeamRating('Arsenal');
      // Both should resolve to the same rating
      expect(fullName).toBe(shortName);
    });
  });

  describe('confidence calculation', () => {
    it('should produce higher confidence for lopsided matchups', async () => {
      // Strong vs weak team
      const strongStandings: Standing[] = [
        createMockStanding({
          position: 1,
          team: { id: 65, name: 'Manchester City FC', shortName: 'Man City', tla: 'MCI', crest: '' },
          playedGames: 25, won: 20, draw: 3, lost: 2, points: 63, goalsFor: 65, goalsAgainst: 15, goalDifference: 50
        }),
        createMockStanding({
          position: 20,
          team: { id: 340, name: 'Southampton FC', shortName: 'Southampton', tla: 'SOU', crest: '' },
          playedGames: 25, won: 2, draw: 3, lost: 20, points: 9, goalsFor: 12, goalsAgainst: 60, goalDifference: -48
        })
      ];

      vi.mocked(dataService.getStandings).mockResolvedValue(strongStandings);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const lopsided = await OptimizedPredictor.predictMatch('Manchester City FC', 'Southampton FC');

      // Even matchup
      const evenStandings: Standing[] = [
        createMockStanding({
          position: 9,
          team: { id: 402, name: 'Brentford FC', shortName: 'Brentford', tla: 'BRE', crest: '' },
          playedGames: 25, won: 10, draw: 5, lost: 10, points: 35, goalsFor: 30, goalsAgainst: 30, goalDifference: 0
        }),
        createMockStanding({
          position: 10,
          team: { id: 76, name: 'Wolverhampton Wanderers FC', shortName: 'Wolves', tla: 'WOL', crest: '' },
          playedGames: 25, won: 10, draw: 5, lost: 10, points: 35, goalsFor: 28, goalsAgainst: 28, goalDifference: 0
        })
      ];

      vi.mocked(dataService.getStandings).mockResolvedValue(evenStandings);

      const even = await OptimizedPredictor.predictMatch('Brentford FC', 'Wolverhampton Wanderers FC');

      expect(lopsided.confidence).toBeGreaterThan(even.confidence);
    });
  });

  describe('value odds calculation', () => {
    it('should return decimal odds that are inversely related to probabilities', async () => {
      vi.mocked(dataService.getStandings).mockResolvedValue([]);
      vi.mocked(dataService.getTeamForm).mockResolvedValue([]);
      vi.mocked(dataService.getMatches).mockResolvedValue([]);

      const prediction = await OptimizedPredictor.predictMatch('Arsenal FC', 'Chelsea FC');

      expect(prediction.valueOdds).toBeDefined();
      if (prediction.valueOdds) {
        // Odds should be > 1.0 (decimal format)
        expect(prediction.valueOdds.home).toBeGreaterThan(1.0);
        expect(prediction.valueOdds.draw).toBeGreaterThan(1.0);
        expect(prediction.valueOdds.away).toBeGreaterThan(1.0);

        // More likely outcomes should have lower odds
        if (prediction.predictedResult === 'H') {
          expect(prediction.valueOdds.home).toBeLessThan(prediction.valueOdds.away);
        }
      }
    });
  });
});
