import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PoissonPredictor,
  EloRatingSystem,
  FatigueAnalyzer,
  RefereeAnalyzer,
  AdvancedMatchPredictor
} from './advancedPredictions';
import { dataService } from '../services/dataService';
import type { Match, TeamStats } from '../types';

vi.mock('../services/dataService', () => ({
  dataService: {
    getMatches: vi.fn(),
    getTeamStats: vi.fn()
  }
}));

/** Creates a full Match object with sensible defaults. Override any field as needed. */
function createMockMatch(overrides: Partial<Match> & { id: string; season_id: string; date: string; home_team: string; away_team: string; created_at: string }): Match {
  return {
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
    ...overrides
  };
}

describe('Advanced Predictions Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no team stats available — tests that need stats override this
    vi.mocked(dataService.getTeamStats).mockResolvedValue(null);
  });

  describe('PoissonPredictor', () => {
    describe('factorial', () => {
      it('should calculate factorial correctly', () => {
        expect(PoissonPredictor.factorial(0)).toBe(1);
        expect(PoissonPredictor.factorial(1)).toBe(1);
        expect(PoissonPredictor.factorial(5)).toBe(120);
        expect(PoissonPredictor.factorial(10)).toBe(3628800);
      });
    });

    describe('poissonProbability', () => {
      it('should calculate Poisson probability correctly', () => {
        // P(X=2) when λ=1.5
        const prob = PoissonPredictor.poissonProbability(1.5, 2);
        expect(prob).toBeCloseTo(0.251, 3);

        // P(X=0) when λ=2.0
        const prob0 = PoissonPredictor.poissonProbability(2.0, 0);
        expect(prob0).toBeCloseTo(0.135, 3);

        // P(X=3) when λ=3.0
        const prob3 = PoissonPredictor.poissonProbability(3.0, 3);
        expect(prob3).toBeCloseTo(0.224, 3);
      });
    });

    describe('predictScoreProbabilities', () => {
      it('should generate score probability matrix', () => {
        const probs = PoissonPredictor.predictScoreProbabilities(1.8, 1.2, 5);
        
        // Check structure
        expect(probs).toBeDefined();
        expect(probs['0-0']).toBeDefined();
        expect(probs['2-1']).toBeDefined();
        expect(probs['5-5']).toBeDefined();

        // Check probabilities sum to approximately 1
        const sum = Object.values(probs).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 1);

        // Most likely scores for these parameters
        expect(probs['2-1']).toBeGreaterThan(probs['5-5']);
        expect(probs['1-1']).toBeGreaterThan(probs['4-4']);
      });
    });

    describe('getOutcomeProbabilities', () => {
      it('should calculate match outcome probabilities', () => {
        const scoreProbabilities = PoissonPredictor.predictScoreProbabilities(2.0, 1.0, 5);
        const outcomes = PoissonPredictor.getOutcomeProbabilities(scoreProbabilities);

        expect(outcomes.homeWin).toBeDefined();
        expect(outcomes.draw).toBeDefined();
        expect(outcomes.awayWin).toBeDefined();

        // Sum should equal 1
        const sum = outcomes.homeWin + outcomes.draw + outcomes.awayWin;
        expect(sum).toBeCloseTo(1, 1);

        // Home should be favored with 2.0 vs 1.0 expected goals
        expect(outcomes.homeWin).toBeGreaterThan(outcomes.awayWin);
        expect(outcomes.homeWin).toBeGreaterThan(outcomes.draw);
      });

      it('should handle equal expected goals', () => {
        const scoreProbabilities = PoissonPredictor.predictScoreProbabilities(1.5, 1.5, 5);
        const outcomes = PoissonPredictor.getOutcomeProbabilities(scoreProbabilities);

        // With equal expected goals, home and away wins should be similar
        expect(Math.abs(outcomes.homeWin - outcomes.awayWin)).toBeLessThan(0.1);
        
        // Draw should be reasonably likely
        expect(outcomes.draw).toBeGreaterThan(0.2);
      });
    });
  });

  describe('EloRatingSystem', () => {
    describe('calculateExpectedScore', () => {
      it('should calculate expected scores correctly', () => {
        // Equal ratings
        expect(EloRatingSystem.calculateExpectedScore(1500, 1500)).toBe(0.5);

        // 100 point advantage
        const exp100 = EloRatingSystem.calculateExpectedScore(1600, 1500);
        expect(exp100).toBeCloseTo(0.64, 2);

        // 200 point advantage
        const exp200 = EloRatingSystem.calculateExpectedScore(1700, 1500);
        expect(exp200).toBeCloseTo(0.76, 2);

        // 400 point advantage
        const exp400 = EloRatingSystem.calculateExpectedScore(1900, 1500);
        expect(exp400).toBeCloseTo(0.91, 2);
      });
    });

    describe('updateRatings', () => {
      it('should update ratings after home win', () => {
        const { newHomeRating, newAwayRating } = EloRatingSystem.updateRatings(1500, 1500, 'H');
        
        expect(newHomeRating).toBeGreaterThan(1500);
        expect(newAwayRating).toBeLessThan(1500);
        
        // Ratings change should sum to zero
        const homeChange = newHomeRating - 1500;
        const awayChange = newAwayRating - 1500;
        expect(homeChange + awayChange).toBeCloseTo(0, 5);
      });

      it('should update ratings after draw', () => {
        const { newHomeRating, newAwayRating } = EloRatingSystem.updateRatings(1600, 1400, 'D');
        
        // Higher rated team loses points in a draw
        expect(newHomeRating).toBeLessThan(1600);
        // Lower rated team gains points in a draw
        expect(newAwayRating).toBeGreaterThan(1400);
      });

      it('should update ratings after away win', () => {
        const { newHomeRating, newAwayRating } = EloRatingSystem.updateRatings(1550, 1450, 'A');
        
        expect(newHomeRating).toBeLessThan(1550);
        expect(newAwayRating).toBeGreaterThan(1450);
        
        // Away win against higher rated + home advantage = bigger gain
        const awayGain = newAwayRating - 1450;
        expect(awayGain).toBeGreaterThan(16); // More than half K-factor
      });

      it('should handle large rating differences', () => {
        // Huge favourite wins — gains little
        const { newHomeRating: home1, newAwayRating: away1 } =
          EloRatingSystem.updateRatings(1800, 1200, 'H');

        expect(home1 - 1800).toBeLessThan(5);
        expect(1200 - away1).toBeLessThan(5);

        // Huge underdog away team (1200) wins against 1800-rated home side
        const { newHomeRating: home2, newAwayRating: away2 } =
          EloRatingSystem.updateRatings(1800, 1200, 'A');

        expect(away2 - 1200).toBeGreaterThan(25);
        expect(1800 - home2).toBeGreaterThan(25);
      });
    });
  });

  describe('FatigueAnalyzer', () => {
    describe('calculateRestDays', () => {
      it('should calculate rest days between matches', async () => {
        const mockMatches: Match[] = [
          createMockMatch({
            id: '1',
            season_id: '2025-26',
            date: '2025-08-10T15:00:00Z',
            home_team: 'Arsenal',
            away_team: 'Chelsea',
            home_goals: 2,
            away_goals: 1,
            result: 'H',
            created_at: '2025-08-10'
          }),
          createMockMatch({
            id: '2',
            season_id: '2025-26',
            date: '2025-08-07T20:00:00Z',
            home_team: 'Liverpool',
            away_team: 'Arsenal',
            home_goals: 1,
            away_goals: 1,
            result: 'D',
            created_at: '2025-08-07'
          })
        ];

        vi.mocked(dataService.getMatches).mockResolvedValue(mockMatches);

        const nextMatchDate = new Date('2025-08-13T15:00:00Z');
        const restDays = await FatigueAnalyzer.calculateRestDays('Arsenal', nextMatchDate);
        
        expect(restDays).toBe(3); // 3 days between Aug 10 and Aug 13
      });

      it('should return default rest days for first match', async () => {
        vi.mocked(dataService.getMatches).mockResolvedValue([]);

        const restDays = await FatigueAnalyzer.calculateRestDays('NewTeam', new Date());
        
        expect(restDays).toBe(7);
      });
    });

    describe('getFatigueMultiplier', () => {
      it('should return 1.0 for fully rested teams (7+ days)', () => {
        expect(FatigueAnalyzer.getFatigueMultiplier(7)).toBe(1);
        expect(FatigueAnalyzer.getFatigueMultiplier(10)).toBe(1);
      });

      it('should scale linearly with rest days', () => {
        // 4 days rest → 4/7 ≈ 0.571
        expect(FatigueAnalyzer.getFatigueMultiplier(4)).toBeCloseTo(4 / 7, 3);
        // 2 days rest → 2/7 ≈ 0.286
        expect(FatigueAnalyzer.getFatigueMultiplier(2)).toBeCloseTo(2 / 7, 3);
      });

      it('should floor at 0.5 days to prevent NaN in Poisson', () => {
        // 0 days rest → clamped to 0.5/7 ≈ 0.071
        expect(FatigueAnalyzer.getFatigueMultiplier(0)).toBeCloseTo(0.5 / 7, 3);
        expect(FatigueAnalyzer.getFatigueMultiplier(-1)).toBeCloseTo(0.5 / 7, 3);
      });
    });
  });

  describe('RefereeAnalyzer', () => {
    describe('getRefereeStats', () => {
      it('should calculate referee statistics', async () => {
        const mockMatches: Match[] = [
          createMockMatch({
            id: '1',
            season_id: '2024-25',
            date: '2024-12-01',
            home_team: 'Arsenal',
            away_team: 'Chelsea',
            home_goals: 2,
            away_goals: 1,
            home_yellows: 2,
            away_yellows: 3,
            home_reds: 0,
            away_reds: 1,
            referee: 'Michael Oliver',
            result: 'H',
            created_at: '2024-12-01'
          }),
          createMockMatch({
            id: '2',
            season_id: '2024-25',
            date: '2024-11-01',
            home_team: 'Liverpool',
            away_team: 'Man City',
            home_yellows: 1,
            away_yellows: 2,
            home_reds: 0,
            away_reds: 0,
            referee: 'Michael Oliver',
            result: 'D',
            created_at: '2024-11-01'
          })
        ];

        vi.mocked(dataService.getMatches).mockResolvedValue(mockMatches);

        const stats = await RefereeAnalyzer.getRefereeStats('Michael Oliver');
        
        expect(stats.avgYellowCards).toBe(4); // (5 + 3) / 2
        expect(stats.avgRedCards).toBe(0.5); // 1 / 2
        expect(stats.homeWinRate).toBe(0.5); // 1 / 2
      });

      it('should return default stats for unknown referee', async () => {
        vi.mocked(dataService.getMatches).mockResolvedValue([]);

        const stats = await RefereeAnalyzer.getRefereeStats('New Referee');
        
        expect(stats.avgYellowCards).toBe(4);
        expect(stats.avgRedCards).toBe(0.1);
        expect(stats.avgPenalties).toBe(0.2);
        expect(stats.homeWinRate).toBe(0.46);
      });

      it('should handle matches with null card values', async () => {
        const mockMatches: Match[] = [
          createMockMatch({
            id: '1',
            season_id: '2024-25',
            date: '2024-12-01',
            home_team: 'Arsenal',
            away_team: 'Chelsea',
            home_goals: 2,
            away_goals: 1,
            referee: 'Michael Oliver',
            result: 'H',
            created_at: '2024-12-01'
          })
        ];

        vi.mocked(dataService.getMatches).mockResolvedValue(mockMatches);

        const stats = await RefereeAnalyzer.getRefereeStats('Michael Oliver');
        
        expect(stats.avgYellowCards).toBe(0);
        expect(stats.avgRedCards).toBe(0);
        expect(stats.homeWinRate).toBe(1);
      });
    });
  });

  describe('AdvancedMatchPredictor', () => {
    describe('predictMatch', () => {
      it('should generate comprehensive match prediction', async () => {
        vi.mocked(dataService.getMatches).mockResolvedValue([]);

        const prediction = await AdvancedMatchPredictor.predictMatch(
          'Arsenal',
          'Chelsea',
          new Date('2025-08-20')
        );

        // Check structure
        expect(prediction).toHaveProperty('homeWinProb');
        expect(prediction).toHaveProperty('drawProb');
        expect(prediction).toHaveProperty('awayWinProb');
        expect(prediction).toHaveProperty('expectedHomeGoals');
        expect(prediction).toHaveProperty('expectedAwayGoals');
        expect(prediction).toHaveProperty('confidence');
        expect(prediction).toHaveProperty('valueBets');
        expect(prediction).toHaveProperty('insights');

        // Check probabilities sum to ~1 (Poisson truncation at maxGoals=7 loses ~0.06% tail mass)
        const probSum = prediction.homeWinProb + prediction.drawProb + prediction.awayWinProb;
        expect(probSum).toBeCloseTo(1, 2);

        // Check confidence is reasonable
        expect(prediction.confidence).toBeGreaterThan(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);

        // Check goals are reasonable
        expect(prediction.expectedHomeGoals).toBeGreaterThan(0);
        expect(prediction.expectedHomeGoals).toBeLessThan(5);
        expect(prediction.expectedAwayGoals).toBeGreaterThan(0);
        expect(prediction.expectedAwayGoals).toBeLessThan(5);
      });

      it('should return empty valueBets when no bookmaker odds are available', async () => {
        // P5e: The production code explicitly returns [] because the model has no
        // external bookmaker odds to compare against. This test documents that
        // intentional behaviour and will catch regressions if the array shape changes.
        vi.mocked(dataService.getMatches).mockResolvedValue([]);

        const prediction = await AdvancedMatchPredictor.predictMatch(
          'Man City',
          'Luton',
          new Date('2025-08-25')
        );

        expect(Array.isArray(prediction.valueBets)).toBe(true);
        expect(prediction.valueBets).toHaveLength(0);
      });

      it('should use per-team stats for Poisson lambda when available', async () => {
        // Arsenal: strong at home (2.0 goals/game scored, 0.5 conceded)
        // Chelsea: weak away (0.8 goals/game scored, 1.5 conceded)
        const arsenalStats: TeamStats = {
          id: 'Arsenal_2025', season_id: '2025', team_name: 'Arsenal',
          matches_played: 10, wins: 7, draws: 2, losses: 1,
          goals_for: 25, goals_against: 8, clean_sheets: 5, failed_to_score: 1, points: 23,
          home_matches_played: 5, home_wins: 4, home_draws: 1, home_losses: 0,
          home_goals_for: 10, home_goals_against: 2,
          away_matches_played: 5, away_wins: 3, away_draws: 1, away_losses: 1,
          away_goals_for: 6, away_goals_against: 4,
          updated_at: new Date().toISOString()
        };
        // Chelsea: decent away (1.2 goals/game scored, 1.6 conceded)
        const chelseaStats: TeamStats = {
          id: 'Chelsea_2025', season_id: '2025', team_name: 'Chelsea',
          matches_played: 10, wins: 4, draws: 3, losses: 3,
          goals_for: 15, goals_against: 13, clean_sheets: 3, failed_to_score: 2, points: 15,
          home_matches_played: 5, home_wins: 3, home_draws: 1, home_losses: 1,
          home_goals_for: 9, home_goals_against: 5,
          away_matches_played: 5, away_wins: 1, away_draws: 2, away_losses: 2,
          away_goals_for: 6, away_goals_against: 8,
          updated_at: new Date().toISOString()
        };

        // Provide completed matches so league averages can be computed
        const completedMatches: Match[] = Array.from({ length: 20 }, (_, i) => createMockMatch({
          id: String(i + 1), season_id: '2025-26',
          date: `2025-08-${String(i + 1).padStart(2, '0')}T15:00:00Z`,
          home_team: i % 2 === 0 ? 'Arsenal' : 'Chelsea',
          away_team: i % 2 === 0 ? 'Chelsea' : 'Arsenal',
          home_goals: 2, away_goals: 1, result: 'H',
          created_at: '2025-08-01'
        }));

        vi.mocked(dataService.getMatches).mockResolvedValue(completedMatches);
        vi.mocked(dataService.getTeamStats).mockImplementation(async (team: string) => {
          if (team === 'Arsenal') return arsenalStats;
          if (team === 'Chelsea') return chelseaStats;
          return null;
        });

        const prediction = await AdvancedMatchPredictor.predictMatch(
          'Arsenal', 'Chelsea', new Date('2025-09-15')
        );

        // Arsenal at home vs Chelsea away: strong attack vs weak defence
        // Expected home goals should be notably higher than away goals
        expect(prediction.expectedHomeGoals).toBeGreaterThan(prediction.expectedAwayGoals);
        // Goals should be in a reasonable range
        expect(prediction.expectedHomeGoals).toBeGreaterThan(0.5);
        expect(prediction.expectedHomeGoals).toBeLessThan(4.5);
        expect(prediction.expectedAwayGoals).toBeGreaterThan(0.3);
        expect(prediction.expectedAwayGoals).toBeLessThan(3.0);
        // Home win should be most likely given Arsenal's home dominance
        expect(prediction.homeWinProb).toBeGreaterThan(prediction.awayWinProb);
      });

      it('should fall back to ELO-derived lambda when team stats are insufficient', async () => {
        // No team stats available — should fall back to ELO-exponent approach
        vi.mocked(dataService.getMatches).mockResolvedValue([]);
        vi.mocked(dataService.getTeamStats).mockResolvedValue(null);

        const prediction = await AdvancedMatchPredictor.predictMatch(
          'Arsenal', 'Chelsea', new Date('2025-08-20')
        );

        // Should still produce valid predictions using fallback
        const probSum = prediction.homeWinProb + prediction.drawProb + prediction.awayWinProb;
        expect(probSum).toBeCloseTo(1, 2);
        expect(prediction.expectedHomeGoals).toBeGreaterThan(0);
        expect(prediction.expectedAwayGoals).toBeGreaterThan(0);
      });

      it('should fall back when one team has fewer than 3 home/away matches', async () => {
        // Only 2 home matches — below the 3-match threshold
        const thinStats: TeamStats = {
          id: 'NewTeam_2025', season_id: '2025', team_name: 'NewTeam',
          matches_played: 4, wins: 2, draws: 1, losses: 1,
          goals_for: 6, goals_against: 4, clean_sheets: 1, failed_to_score: 0, points: 7,
          home_matches_played: 2, home_wins: 1, home_draws: 1, home_losses: 0,
          home_goals_for: 4, home_goals_against: 1,
          away_matches_played: 2, away_wins: 1, away_draws: 0, away_losses: 1,
          away_goals_for: 2, away_goals_against: 3,
          updated_at: new Date().toISOString()
        };

        vi.mocked(dataService.getMatches).mockResolvedValue([]);
        vi.mocked(dataService.getTeamStats).mockResolvedValue(thinStats);

        const prediction = await AdvancedMatchPredictor.predictMatch(
          'NewTeam', 'NewTeam2', new Date('2025-08-20')
        );

        // Should still produce valid predictions
        expect(prediction.expectedHomeGoals).toBeGreaterThan(0);
        expect(prediction.expectedAwayGoals).toBeGreaterThan(0);
        const probSum = prediction.homeWinProb + prediction.drawProb + prediction.awayWinProb;
        expect(probSum).toBeCloseTo(1, 2);
      });

      it('should generate meaningful insights', async () => {
        // Mock matches to trigger fatigue insights
        const recentMatch: Match = createMockMatch({
          id: '1',
          season_id: '2025-26',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          home_team: 'Arsenal',
          away_team: 'Tottenham',
          home_goals: 2,
          away_goals: 1,
          result: 'H',
          created_at: '2025-08-15'
        });

        vi.mocked(dataService.getMatches).mockResolvedValue([recentMatch]);

        const prediction = await AdvancedMatchPredictor.predictMatch(
          'Arsenal',
          'Chelsea',
          new Date()
        );

        expect(prediction.insights).toBeInstanceOf(Array);
        expect(prediction.insights.length).toBeGreaterThan(0);
        
        // Should have fatigue insight
        const fatigueInsight = prediction.insights.find(i => i.includes('rest'));
        expect(fatigueInsight).toBeDefined();
      });
    });
  });
});