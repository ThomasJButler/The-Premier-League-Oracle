import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BetBuilderPredictor, type BetBuilderPrediction } from './betBuilder';

// Mock external dependencies
vi.mock('./optimizedPredictions', () => ({
  OptimizedPredictor: {
    predictMatch: vi.fn()
  }
}));

vi.mock('./advancedPredictions', () => ({
  PoissonPredictor: {
    predictScoreProbabilities: vi.fn()
  }
}));

vi.mock('../services/dataService', () => ({
  dataService: {
    getTeamStats: vi.fn(),
    getMatches: vi.fn()
  }
}));

import { OptimizedPredictor } from './optimizedPredictions';
import { PoissonPredictor } from './advancedPredictions';
import { dataService } from '../services/dataService';

/**
 * Helper: build a score probability map from a set of scores.
 * Each entry is "H-A": probability. Useful for controlling exactly
 * which private-method branches fire.
 */
function makeScoreProbs(entries: Record<string, number>): Record<string, number> {
  return { ...entries };
}

/** Default mock prediction with realistic expected goals (cast as any to avoid full interface boilerplate) */
function mockPrediction(overrides: Record<string, any> = {}) {
  return {
    predictedResult: 'H' as const,
    homeWinProbability: 0.5,
    drawProbability: 0.25,
    awayWinProbability: 0.25,
    predictedHomeGoals: 1.6,
    predictedAwayGoals: 1.1,
    confidence: 0.72,
    homeForm: 'WWDLW',
    awayForm: 'LDWDL',
    modelWeights: { elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 },
    insights: [],
    ...overrides
  } as any;
}

/** Default team stats for home/away (cast as any — only goals_for/against/matches_played are read) */
function mockTeamStats(overrides: Record<string, any> = {}) {
  return {
    id: 'test-id',
    season_id: '2025',
    team_name: 'Test FC',
    matches_played: 20,
    wins: 10,
    draws: 5,
    losses: 5,
    goals_for: 30,
    goals_against: 20,
    clean_sheets: 5,
    failed_to_score: 3,
    points: 35,
    home_matches_played: 10,
    home_wins: 6,
    home_draws: 2,
    home_losses: 2,
    home_goals_for: 18,
    home_goals_against: 8,
    away_matches_played: 10,
    away_wins: 4,
    away_draws: 3,
    away_losses: 3,
    away_goals_for: 12,
    away_goals_against: 12,
    updated_at: '2026-03-14',
    ...overrides
  } as any;
}

describe('BetBuilderPredictor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return empty match array (falls back to hardcoded league averages)
    vi.mocked(dataService.getMatches).mockResolvedValue([]);
  });

  describe('generateBetBuilder', () => {
    it('should return a complete BetBuilderPrediction with all required fields', async () => {
      // Arrange: home-dominant score distribution
      const scoreProbs = makeScoreProbs({
        '1-0': 0.15, '2-0': 0.10, '2-1': 0.12, '3-1': 0.05,
        '0-0': 0.06, '1-1': 0.14, '2-2': 0.04,
        '0-1': 0.10, '0-2': 0.05, '1-2': 0.08,
        '3-0': 0.03, '0-3': 0.02, '3-2': 0.03, '1-3': 0.03
      });

      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(scoreProbs);

      // Act
      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea', 'match-123');

      // Assert: top-level structure
      expect(result.matchId).toBe('match-123');
      expect(result.homeTeam).toBe('Arsenal');
      expect(result.awayTeam).toBe('Chelsea');

      // All sub-objects exist
      expect(result.matchResult).toBeDefined();
      expect(result.bothTeamsToScore).toBeDefined();
      expect(result.totalGoals).toBeDefined();
      expect(result.corners).toBeDefined();
      expect(result.cards).toBeDefined();
      expect(result.halfTimeResult).toBeDefined();
      expect(result.cleanSheets).toBeDefined();
      expect(result.suggestedCombos).toBeDefined();
      expect(Array.isArray(result.suggestedCombos)).toBe(true);
    });

    it('should use default matchId when not provided', async () => {
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-0': 0.5, '0-1': 0.3, '1-1': 0.2 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      expect(result.matchId).toBe('Arsenal-Chelsea');
    });

    it('should use 0 expected goals when prediction returns 0 (not treat as falsy)', async () => {
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(
        mockPrediction({ predictedHomeGoals: 0, predictedAwayGoals: 0 })
      );
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-0': 0.4, '0-0': 0.3, '0-1': 0.3 })
      );

      await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');

      // 0 is a valid value — ?? only falls back on null/undefined
      expect(PoissonPredictor.predictScoreProbabilities).toHaveBeenCalledWith(0, 0, 7);
    });

    it('should use real expected goals when prediction provides them', async () => {
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(
        mockPrediction({ predictedHomeGoals: 2.1, predictedAwayGoals: 0.8 })
      );
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-0': 0.5, '1-0': 0.3, '2-1': 0.2 })
      );

      await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');

      expect(PoissonPredictor.predictScoreProbabilities).toHaveBeenCalledWith(2.1, 0.8, 7);
    });
  });

  describe('calculateMatchResult (via generateBetBuilder)', () => {
    beforeEach(() => {
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());
    });

    it('should predict H when home win probability is highest', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-0': 0.30, '1-0': 0.25, '0-0': 0.10, '0-1': 0.15, '1-1': 0.20 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      expect(result.matchResult.prediction).toBe('H');
      expect(result.matchResult.homeWinProb).toBeGreaterThan(result.matchResult.drawProb);
      expect(result.matchResult.homeWinProb).toBeGreaterThan(result.matchResult.awayWinProb);
    });

    it('should predict A when away win probability exceeds draw', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '0-2': 0.30, '0-1': 0.25, '0-0': 0.10, '1-0': 0.10, '1-1': 0.15, '1-2': 0.10 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      expect(result.matchResult.prediction).toBe('A');
    });

    it('should predict D when draw probability is dominant', async () => {
      // Away < draw and home < draw
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '0-0': 0.25, '1-1': 0.30, '2-2': 0.10, '1-0': 0.15, '0-1': 0.10, '2-1': 0.05, '1-2': 0.05 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      expect(result.matchResult.prediction).toBe('D');
    });

    it('should set confidence to the maximum of the three probabilities', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-0': 0.50, '1-0': 0.20, '0-0': 0.10, '0-1': 0.10, '1-1': 0.10 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // homeWin = 0.70, draw = 0.20, awayWin = 0.10
      expect(result.matchResult.confidence).toBeCloseTo(0.70, 2);
    });

    it('should have probabilities that sum approximately to 1', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-0': 0.25, '0-1': 0.25, '1-1': 0.25, '2-0': 0.15, '0-2': 0.10 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      const sum = result.matchResult.homeWinProb + result.matchResult.drawProb + result.matchResult.awayWinProb;
      expect(sum).toBeCloseTo(1.0, 2);
    });
  });

  describe('calculateBTTS (via generateBetBuilder)', () => {
    beforeEach(() => {
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());
    });

    it('should predict BTTS yes when majority of scores have both teams scoring', async () => {
      // Both teams score in 1-1, 2-1, 1-2 = 0.70 total
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-1': 0.30, '2-1': 0.20, '1-2': 0.20, '1-0': 0.15, '0-1': 0.15 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      expect(result.bothTeamsToScore.prediction).toBe(true);
      expect(result.bothTeamsToScore.yesProb).toBeCloseTo(0.70, 2);
      expect(result.bothTeamsToScore.noProb).toBeCloseTo(0.30, 2);
    });

    it('should predict BTTS no when clean sheets dominate', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-0': 0.35, '0-0': 0.25, '2-0': 0.10, '0-1': 0.10, '1-1': 0.10, '2-1': 0.10 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      expect(result.bothTeamsToScore.prediction).toBe(false);
      expect(result.bothTeamsToScore.noProb).toBeGreaterThan(0.5);
    });

    it('should have yesProb + noProb summing to approximately 1', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-1': 0.40, '2-1': 0.10, '1-0': 0.25, '0-0': 0.15, '0-1': 0.10 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      const sum = result.bothTeamsToScore.yesProb + result.bothTeamsToScore.noProb;
      expect(sum).toBeCloseTo(1.0, 2);
    });
  });

  describe('calculateTotalGoals (via generateBetBuilder)', () => {
    beforeEach(() => {
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());
    });

    it('should correctly calculate over/under 2.5 goals', async () => {
      // Total goals: 0 (0-0 = 0.10), 1 (1-0 = 0.15), 2 (2-0 + 1-1 = 0.25), 3 (2-1 + 3-0 = 0.30), 4 (3-1 = 0.20)
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '0-0': 0.10, '1-0': 0.15, '2-0': 0.10, '1-1': 0.15, '2-1': 0.20, '3-0': 0.10, '3-1': 0.20 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // Over 2.5: scores with 3+ goals = 0.20 + 0.10 + 0.20 = 0.50
      expect(result.totalGoals.over25.probability).toBeCloseTo(0.50, 2);
      expect(result.totalGoals.under25.probability).toBeCloseTo(0.50, 2);
    });

    it('should correctly calculate over/under 3.5 goals', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '0-0': 0.10, '1-0': 0.20, '2-1': 0.30, '3-1': 0.25, '4-0': 0.15 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // Over 3.5: 4+ goals = 3-1 (4 goals) + 4-0 (4 goals) = 0.25 + 0.15 = 0.40
      expect(result.totalGoals.over35.probability).toBeCloseTo(0.40, 2);
      expect(result.totalGoals.under35.probability).toBeCloseTo(0.60, 2);
    });

    it('should set prediction booleans based on 0.5 threshold', async () => {
      // High-scoring: over 2.5 > 0.5
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-1': 0.30, '3-1': 0.20, '2-2': 0.15, '1-0': 0.20, '0-0': 0.15 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // Over 2.5 = 0.30 + 0.20 + 0.15 = 0.65
      expect(result.totalGoals.over25.prediction).toBe(true);
      expect(result.totalGoals.under25.prediction).toBe(false);
    });

    it('should populate exactGoals distribution', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '0-0': 0.10, '1-0': 0.20, '0-1': 0.15, '1-1': 0.25, '2-0': 0.15, '2-1': 0.15 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // 0 goals: 0-0 = 0.10
      expect(result.totalGoals.exactGoals[0]).toBeCloseTo(0.10, 2);
      // 1 goal: 1-0 + 0-1 = 0.35
      expect(result.totalGoals.exactGoals[1]).toBeCloseTo(0.35, 2);
      // 2 goals: 1-1 + 2-0 = 0.40
      expect(result.totalGoals.exactGoals[2]).toBeCloseTo(0.40, 2);
      // 3 goals: 2-1 = 0.15
      expect(result.totalGoals.exactGoals[3]).toBeCloseTo(0.15, 2);
    });
  });

  describe('calculateCorners (via generateBetBuilder)', () => {
    beforeEach(() => {
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-0': 0.5, '0-1': 0.3, '1-1': 0.2 })
      );
    });

    it('should return corner predictions for three thresholds', async () => {
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      expect(result.corners.totalOver85).toBeDefined();
      expect(result.corners.totalOver95).toBeDefined();
      expect(result.corners.totalOver105).toBeDefined();
    });

    it('should use league average when team stats are null', async () => {
      vi.mocked(dataService.getTeamStats).mockResolvedValue(null as any);

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // With null stats, attacking factors default to 1, so expectedCorners = 9.5 * 1 = 9.5
      // Over 8.5: expectedCorners (9.5) > 8.5, so prediction is true
      expect(result.corners.totalOver85.prediction).toBe(true);
      // Over 9.5: expectedCorners (9.5) is NOT > 9.5, so prediction is false
      expect(result.corners.totalOver95.prediction).toBe(false);
      expect(result.corners.totalOver105.prediction).toBe(false);
    });

    it('should increase corner expectation for high-scoring teams', async () => {
      // High-scoring: 45 goals in 20 matches = 2.25 per match, factor = 2.25/1.5 = 1.5
      vi.mocked(dataService.getTeamStats).mockResolvedValue(
        mockTeamStats({ goals_for: 45, matches_played: 20 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // expectedCorners = 9.5 * ((1.5 + 1.5) / 2) = 9.5 * 1.5 = 14.25
      expect(result.corners.totalOver105.prediction).toBe(true);
    });

    it('should decrease corner expectation for low-scoring teams', async () => {
      // Low-scoring: 10 goals in 20 matches = 0.5 per match, factor = 0.5/1.5 ≈ 0.33
      vi.mocked(dataService.getTeamStats).mockResolvedValue(
        mockTeamStats({ goals_for: 10, matches_played: 20 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // expectedCorners = 9.5 * 0.33 ≈ 3.17 — well under all thresholds
      expect(result.corners.totalOver85.prediction).toBe(false);
      expect(result.corners.totalOver95.prediction).toBe(false);
      expect(result.corners.totalOver105.prediction).toBe(false);
    });
  });

  describe('calculateCards (via generateBetBuilder)', () => {
    beforeEach(() => {
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-0': 0.5, '0-1': 0.3, '1-1': 0.2 })
      );
    });

    it('should return card predictions for three thresholds', async () => {
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      expect(result.cards.totalOver25).toBeDefined();
      expect(result.cards.totalOver35).toBeDefined();
      expect(result.cards.totalOver45).toBeDefined();
    });

    it('should increase expected cards for rivalry matches', async () => {
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());

      const rivalryResult = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Tottenham Hotspur');

      // Reset and test non-rivalry
      vi.clearAllMocks();
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-0': 0.5, '0-1': 0.3, '1-1': 0.2 })
      );

      const normalResult = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Brentford');

      // Rivalry should have higher card probabilities
      expect(rivalryResult.cards.totalOver35.probability).toBeGreaterThan(
        normalResult.cards.totalOver35.probability
      );
    });

    it('should detect all ten hardcoded rivalries', async () => {
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());

      const rivalries = [
        ['Manchester United', 'Manchester City'],
        ['Manchester United', 'Liverpool'],
        ['Arsenal', 'Tottenham Hotspur'],
        ['Liverpool', 'Everton'],
        ['Chelsea', 'Arsenal'],
        ['Chelsea', 'Tottenham Hotspur'],
        ['Nottingham Forest', 'Leicester City'],
        ['Newcastle United', 'Everton'],
        ['Aston Villa', 'Wolverhampton Wanderers'],
        ['Crystal Palace', 'Brighton and Hove Albion']
      ];

      for (const [home, away] of rivalries) {
        vi.clearAllMocks();
        vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
        vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());
        vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
          makeScoreProbs({ '1-0': 0.5, '0-1': 0.3, '1-1': 0.2 })
        );

        const result = await BetBuilderPredictor.generateBetBuilder(home, away);
        // Base cards 3.2 + rivalry 1.5 = 4.7, over 4.5 should be true
        expect(result.cards.totalOver45.prediction).toBe(true);
      }
    });

    it('should add cards bonus for defensive teams conceding > 1.5 per match', async () => {
      // goals_against: 40 in 20 matches = 2.0 per match (> 1.5 threshold)
      vi.mocked(dataService.getTeamStats).mockResolvedValue(
        mockTeamStats({ goals_against: 40, matches_played: 20 })
      );

      const defensiveResult = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');

      vi.clearAllMocks();
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
      // goals_against: 20 in 20 matches = 1.0 per match (< 1.5 threshold)
      vi.mocked(dataService.getTeamStats).mockResolvedValue(
        mockTeamStats({ goals_against: 20, matches_played: 20 })
      );
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-0': 0.5, '0-1': 0.3, '1-1': 0.2 })
      );

      const solidResult = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');

      expect(defensiveResult.cards.totalOver25.probability).toBeGreaterThan(
        solidResult.cards.totalOver25.probability
      );
    });
  });

  describe('calculateHalfTimeResult (via generateBetBuilder)', () => {
    beforeEach(() => {
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());
    });

    it('should predict same outcome as full-time result', async () => {
      // Strong home win
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-0': 0.40, '3-0': 0.20, '1-0': 0.15, '0-0': 0.10, '0-1': 0.10, '1-1': 0.05 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      expect(result.halfTimeResult.prediction).toBe(result.matchResult.prediction);
    });

    it('should produce normalised HT probabilities that sum to 1.0', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-0': 0.50, '1-0': 0.30, '0-0': 0.10, '0-1': 0.10 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      const sum = result.halfTimeResult.homeWinProb + result.halfTimeResult.drawProb + result.halfTimeResult.awayWinProb;
      expect(sum).toBeCloseTo(1.0, 6);
    });

    it('should apply HT-FT correlation bias to full-time probabilities with normalisation', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-0': 0.60, '0-0': 0.20, '0-1': 0.20 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // Constants from constants.ts (derived from 12,535 PL matches, 33 seasons):
      //   HT_FT_CORRELATION=0.39, HT_PRIOR_HOME=0.35, HT_PRIOR_DRAW=0.41, HT_PRIOR_AWAY=0.24
      // FT homeWin=0.60: raw = 0.60*0.39 + 0.35*0.61 = 0.4475
      // FT draw=0.20:    raw = 0.20*0.39 + 0.41*0.61 = 0.3281
      // FT away=0.20:    raw = 0.20*0.39 + 0.24*0.61 = 0.2244
      // total = 1.0, homeWinProb = 0.4475/1.0 = 0.4475
      expect(result.halfTimeResult.homeWinProb).toBeCloseTo(0.4475, 2);
      // And sum to 1
      const sum = result.halfTimeResult.homeWinProb + result.halfTimeResult.drawProb + result.halfTimeResult.awayWinProb;
      expect(sum).toBeCloseTo(1.0, 6);
    });
  });

  describe('calculateCleanSheets (via generateBetBuilder)', () => {
    beforeEach(() => {
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());
    });

    it('should calculate home clean sheet from scores where away = 0', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-0': 0.25, '2-0': 0.15, '0-0': 0.10, '1-1': 0.30, '0-1': 0.20 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // Home clean sheet: 1-0 + 2-0 + 0-0 = 0.50
      expect(result.cleanSheets.homeCleanSheet.probability).toBeCloseTo(0.50, 2);
      expect(result.cleanSheets.homeCleanSheet.prediction).toBe(true); // > 0.3
    });

    it('should calculate away clean sheet from scores where home = 0', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '0-1': 0.20, '0-2': 0.10, '0-0': 0.10, '1-0': 0.30, '1-1': 0.30 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // Away clean sheet: 0-1 + 0-2 + 0-0 = 0.40
      expect(result.cleanSheets.awayCleanSheet.probability).toBeCloseTo(0.40, 2);
      expect(result.cleanSheets.awayCleanSheet.prediction).toBe(true); // > 0.3
    });

    it('should calculate both clean sheets from 0-0 probability', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '0-0': 0.15, '1-0': 0.40, '0-1': 0.30, '1-1': 0.15 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      expect(result.cleanSheets.bothCleanSheets.probability).toBeCloseTo(0.15, 2);
      // bothCleanSheets.prediction is true when P(0-0) > 0.08 (league average ~7-8%)
      expect(result.cleanSheets.bothCleanSheets.prediction).toBe(true);
    });

    it('should handle missing 0-0 score gracefully', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-0': 0.50, '0-1': 0.30, '1-1': 0.20 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      expect(result.cleanSheets.bothCleanSheets.probability).toBe(0);
    });

    it('should set prediction false when clean sheet probability <= 0.3', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '1-1': 0.50, '2-1': 0.20, '1-2': 0.20, '1-0': 0.10 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // Home clean sheet: 1-0 = 0.10 — below 0.3 threshold
      expect(result.cleanSheets.homeCleanSheet.prediction).toBe(false);
      // Away clean sheet: no scores with home=0 in this set = 0
      expect(result.cleanSheets.awayCleanSheet.prediction).toBe(false);
    });
  });

  describe('generateSuggestedCombos (via generateBetBuilder)', () => {
    beforeEach(() => {
      vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue(mockPrediction());
      vi.mocked(dataService.getTeamStats).mockResolvedValue(mockTeamStats());
    });

    it('should generate Safe Builder when confidence > 0.4', async () => {
      // Strong home win — high confidence
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-0': 0.40, '1-0': 0.20, '0-0': 0.10, '0-1': 0.15, '1-1': 0.15 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      const safeCombo = result.suggestedCombos.find(c => c.name === 'Safe Builder');
      expect(safeCombo).toBeDefined();
      // Confidence = product of individual selection probabilities (3 legs)
      expect(safeCombo!.confidence).toBeGreaterThan(0);
      expect(safeCombo!.confidence).toBeLessThanOrEqual(1);
      expect(safeCombo!.selections).toHaveLength(3);
      expect(safeCombo!.combinedOdds).toBeGreaterThan(0);
    });

    it('should generate Value Builder when BTTS > 0.45 and over 2.5 > 0.5', async () => {
      // High BTTS and high goals
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-1': 0.30, '1-1': 0.20, '3-1': 0.15, '2-2': 0.10, '1-0': 0.10, '0-0': 0.05, '0-1': 0.10 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      const valueCombo = result.suggestedCombos.find(c => c.name === 'Value Builder');
      expect(valueCombo).toBeDefined();
      // Confidence = product of 4 selection probabilities
      expect(valueCombo!.confidence).toBeGreaterThan(0);
      expect(valueCombo!.confidence).toBeLessThanOrEqual(1);
      expect(valueCombo!.selections).toHaveLength(4);
    });

    it('should generate High Risk Builder when a team has > 0.45 win probability', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-0': 0.30, '1-0': 0.20, '3-0': 0.05, '0-0': 0.15, '0-1': 0.15, '1-1': 0.15 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      const highRisk = result.suggestedCombos.find(c => c.name === 'High Risk Builder');
      expect(highRisk).toBeDefined();
      // Confidence = product of 4 selection probabilities
      expect(highRisk!.confidence).toBeGreaterThan(0);
      expect(highRisk!.confidence).toBeLessThanOrEqual(1);
      expect(highRisk!.selections.some(s => s.includes('Arsenal'))).toBe(true);
    });

    it('should generate Goals Galore when over 2.5 > 0.55 and BTTS > 0.5', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-1': 0.25, '3-1': 0.15, '1-2': 0.15, '2-2': 0.10, '3-2': 0.05, '1-1': 0.10, '1-0': 0.10, '0-0': 0.05, '0-1': 0.05 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      const goalsGalore = result.suggestedCombos.find(c => c.name === 'Goals Galore');
      expect(goalsGalore).toBeDefined();
      // Confidence = product of 4 selection probabilities
      expect(goalsGalore!.confidence).toBeGreaterThan(0);
      expect(goalsGalore!.confidence).toBeLessThanOrEqual(1);
    });

    it('should generate no combos when all thresholds are unmet', async () => {
      // Very low confidence, low BTTS, low goals
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '0-0': 0.40, '1-0': 0.20, '0-1': 0.20, '1-1': 0.15, '2-0': 0.05 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      // matchResult.confidence = max(0.25, 0.55, 0.20) = 0.55 > 0.4, so Safe Builder still triggers
      // But BTTS = 0.15, over2.5 = 0.05 — no Value or Goals Galore
      // homeWin = 0.25, awayWin = 0.20 — no High Risk
      const valueCombo = result.suggestedCombos.find(c => c.name === 'Value Builder');
      const goalsGalore = result.suggestedCombos.find(c => c.name === 'Goals Galore');
      const highRisk = result.suggestedCombos.find(c => c.name === 'High Risk Builder');
      expect(valueCombo).toBeUndefined();
      expect(goalsGalore).toBeUndefined();
      expect(highRisk).toBeUndefined();
    });

    it('should include correct team name in combo selections', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-0': 0.40, '1-0': 0.20, '0-0': 0.10, '0-1': 0.15, '1-1': 0.15 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      const safeCombo = result.suggestedCombos.find(c => c.name === 'Safe Builder');
      // Home win dominant — should say "Arsenal to win"
      expect(safeCombo!.selections[0]).toBe('Arsenal to win');
    });

    it('should say "Draw to win" in Safe Builder when draw is predicted', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '0-0': 0.30, '1-1': 0.35, '2-2': 0.05, '1-0': 0.15, '0-1': 0.10, '2-1': 0.05 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      const safeCombo = result.suggestedCombos.find(c => c.name === 'Safe Builder');
      expect(safeCombo).toBeDefined();
      expect(safeCombo!.selections[0]).toBe('Draw to win');
    });

    it('should round combinedOdds to 2 decimal places', async () => {
      vi.mocked(PoissonPredictor.predictScoreProbabilities).mockReturnValue(
        makeScoreProbs({ '2-0': 0.40, '1-0': 0.20, '0-0': 0.10, '0-1': 0.15, '1-1': 0.15 })
      );

      const result = await BetBuilderPredictor.generateBetBuilder('Arsenal', 'Chelsea');
      for (const combo of result.suggestedCombos) {
        // Check that odds are rounded to at most 2 decimal places
        const rounded = Math.round(combo.combinedOdds * 100) / 100;
        expect(combo.combinedOdds).toBe(rounded);
      }
    });
  });
});
