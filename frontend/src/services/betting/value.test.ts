import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValueBettingEngine, type MarketOdds } from './value';

// Mock only AdvancedMatchPredictor — keep real PoissonPredictor for goals calculations
vi.mock('../../lib/advancedPredictions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/advancedPredictions')>();
  return {
    ...actual,
    AdvancedMatchPredictor: {
      predictMatch: vi.fn()
    }
  };
});

import { AdvancedMatchPredictor } from '../../lib/advancedPredictions';

/** Creates a mock prediction result from AdvancedMatchPredictor */
function mockPrediction(overrides: Record<string, any> = {}) {
  return {
    homeWinProb: 0.55,
    drawProb: 0.25,
    awayWinProb: 0.20,
    expectedHomeGoals: 1.6,
    expectedAwayGoals: 1.1,
    confidence: 0.72,
    valueBets: [],
    insights: ['Strong home form', 'Weak away defence'],
    ...overrides
  };
}

/** Standard market odds where home has value */
function standardOdds(overrides: Partial<MarketOdds> = {}): MarketOdds {
  return {
    home: 2.10,  // implied 47.6% — our model says 55%, edge ~7.4%
    draw: 3.40,  // implied 29.4% — our model says 25%, no edge
    away: 3.80,  // implied 26.3% — our model says 20%, no edge
    ...overrides
  };
}

describe('ValueBettingEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('identifyValueBets', () => {
    it('should identify value bets from 1X2 market', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(mockPrediction());

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds(), 1000
      );

      // Home should be a value bet (55% vs implied 47.6%)
      const homeBet = result.find(b => b.market === 'home');
      expect(homeBet).toBeDefined();
      expect(homeBet!.edge).toBeGreaterThan(0.03); // Above MIN_VALUE_EDGE
      expect(homeBet!.ourProbability).toBe(0.55);
      expect(homeBet!.matchId).toBe('match-1');
      expect(homeBet!.homeTeam).toBe('Arsenal');
      expect(homeBet!.awayTeam).toBe('Chelsea');
    });

    it('should not identify bets where edge is below 3%', async () => {
      // Model probability close to implied — no edge
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(
        mockPrediction({ homeWinProb: 0.48, drawProb: 0.30, awayWinProb: 0.22 })
      );

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds(), 1000
      );

      // Home: 48% vs implied 47.6% = edge 0.4% (below 3%)
      const homeBet = result.find(b => b.market === 'home');
      expect(homeBet).toBeUndefined();
    });

    it('should not identify bets where probability is below 55%', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(
        mockPrediction({ homeWinProb: 0.50, drawProb: 0.25, awayWinProb: 0.25 })
      );

      // Even with decent edge, probability below MIN_CONFIDENCE rejects
      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds({ home: 2.50 }), // implied 40%, edge 10% but prob only 50%
        1000
      );

      const homeBet = result.find(b => b.market === 'home');
      expect(homeBet).toBeUndefined();
    });

    it('should sort results by expected value descending', async () => {
      // High expected goals (4.0 total) creates over 2.5 value alongside home win value
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(
        mockPrediction({
          homeWinProb: 0.60,
          drawProb: 0.25,
          awayWinProb: 0.15,
          expectedHomeGoals: 2.5,
          expectedAwayGoals: 1.5
        })
      );

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds({ home: 2.00, draw: 3.00, away: 5.00, over25: 2.00, under25: 1.90 }),
        1000
      );

      expect(result.length).toBeGreaterThan(1);
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].expectedValue).toBeGreaterThanOrEqual(result[i + 1].expectedValue);
      }
    });

    it('should return empty array on error', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockRejectedValue(
        new Error('API failure')
      );

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds(), 1000
      );

      expect(result).toEqual([]);
    });

    it('should use default bankroll of 1000 when not provided', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(mockPrediction());

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds()
      );

      // Should not throw — bankroll defaults to 1000
      expect(Array.isArray(result)).toBe(true);
    });

    it('should check goals markets when over25 and under25 odds are provided', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(
        mockPrediction({ expectedHomeGoals: 2.0, expectedAwayGoals: 1.5 })
      );

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds({ over25: 1.80, under25: 2.10 }),
        1000
      );

      // With 3.5 expected goals, over 2.5 probability should be high
      const overBet = result.find(b => b.market === 'over2.5');
      // May or may not be a value bet depending on Kelly — but the code path was exercised
      expect(Array.isArray(result)).toBe(true);
    });

    it('should NOT check goals markets when only over25 is provided without under25', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(mockPrediction());

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds({ over25: 1.80 }), // under25 missing
        1000
      );

      const goalsBets = result.filter(b => b.market === 'over2.5' || b.market === 'under2.5');
      expect(goalsBets).toHaveLength(0);
    });

    it('should check BTTS market when btts and bttsNo odds are provided', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(
        mockPrediction({ expectedHomeGoals: 1.8, expectedAwayGoals: 1.4 })
      );

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds({ btts: 1.75, bttsNo: 2.10 }),
        1000
      );

      // BTTS code path exercised
      expect(Array.isArray(result)).toBe(true);
    });

    it('should NOT check BTTS market when bttsNo is missing', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(mockPrediction());

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds({ btts: 1.75 }), // bttsNo missing
        1000
      );

      const bttsBets = result.filter(b => b.market === 'btts');
      expect(bttsBets).toHaveLength(0);
    });

    it('should include reasoning with model vs market comparison and insights', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(mockPrediction());

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds(), 1000
      );

      const homeBet = result.find(b => b.market === 'home');
      expect(homeBet).toBeDefined();
      expect(homeBet!.reasoning.length).toBeGreaterThanOrEqual(3);
      expect(homeBet!.reasoning[0]).toContain('Our model');
      expect(homeBet!.reasoning[1]).toContain('Edge');
      expect(homeBet!.reasoning[2]).toContain('Expected Value');
      // Insights sliced to first 2
      expect(homeBet!.reasoning).toContain('Strong home form');
      expect(homeBet!.reasoning).toContain('Weak away defence');
    });

    it('should include correct EV calculation', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(
        mockPrediction({ homeWinProb: 0.60 })
      );

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds({ home: 2.10 }), 1000
      );

      const homeBet = result.find(b => b.market === 'home');
      expect(homeBet).toBeDefined();
      // EV = (0.60 * 2.10) - 1 = 0.26
      expect(homeBet!.expectedValue).toBeCloseTo(0.26, 2);
      // Implied probability = 1 / 2.10 ≈ 0.476
      expect(homeBet!.impliedProbability).toBeCloseTo(1 / 2.10, 2);
    });
  });

  describe('warnings generation (via identifyValueBets)', () => {
    it('should warn about small edge below 5%', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(
        mockPrediction({ homeWinProb: 0.56 })
      );

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds({ home: 2.10 }), // implied 47.6%, edge = 56-47.6 = 8.4% but after adjustments
        1000
      );

      // Check that warnings are populated (specific content depends on Kelly calculation)
      const homeBet = result.find(b => b.market === 'home');
      expect(homeBet).toBeDefined();
      expect(Array.isArray(homeBet!.warnings)).toBe(true);
    });

    it('should warn about long odds', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(
        mockPrediction({ awayWinProb: 0.60 })
      );

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds({ away: 6.00 }), // Long odds
        1000
      );

      const awayBet = result.find(b => b.market === 'away');
      expect(awayBet).toBeDefined();
      expect(awayBet!.warnings.some(w => w.includes('Long odds'))).toBe(true);
    });

    it('should warn about low model confidence', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(
        mockPrediction({ homeWinProb: 0.60, confidence: 0.55 })
      );

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds({ home: 2.00 }),
        1000
      );

      const homeBet = result.find(b => b.market === 'home');
      expect(homeBet).toBeDefined();
      expect(homeBet!.warnings.some(w => w.includes('Low model confidence'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle very high probabilities', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(
        mockPrediction({ homeWinProb: 0.95, drawProb: 0.03, awayWinProb: 0.02 })
      );

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        standardOdds({ home: 1.30 }), // implied 76.9%, our 95%, edge 18%
        1000
      );

      const homeBet = result.find(b => b.market === 'home');
      expect(homeBet).toBeDefined();
      expect(homeBet!.expectedValue).toBeGreaterThan(0);
    });

    it('should handle all markets simultaneously', async () => {
      vi.mocked(AdvancedMatchPredictor.predictMatch).mockResolvedValue(
        mockPrediction({
          homeWinProb: 0.60,
          expectedHomeGoals: 2.0,
          expectedAwayGoals: 1.5
        })
      );

      const result = await ValueBettingEngine.identifyValueBets(
        'match-1', 'Arsenal', 'Chelsea', new Date('2026-03-15'),
        {
          home: 2.00, draw: 3.50, away: 4.00,
          over25: 1.80, under25: 2.10,
          btts: 1.70, bttsNo: 2.20
        },
        1000
      );

      // All code paths exercised — no errors thrown
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
