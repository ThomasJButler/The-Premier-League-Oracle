import { describe, it, expect } from 'vitest';
import { KellyCalculator } from './kelly';
import type { BettingOpportunity } from './kelly';

describe('KellyCalculator', () => {
  describe('calculate', () => {
    it('should calculate correct Kelly values for a positive edge bet', () => {
      const opportunity: BettingOpportunity = {
        outcome: 'Home Win',
        ourProbability: 0.6,
        bookmakerOdds: 2.5,
        bankroll: 1000
      };

      const result = KellyCalculator.calculate(opportunity);

      expect(result.fullKelly).toBeCloseTo(0.25, 4); // Capped at MAX_KELLY
      expect(result.halfKelly).toBeCloseTo(0.075, 4); // 0.25 * 0.6 * 0.5
      expect(result.quarterKelly).toBeCloseTo(0.0375, 4); // 0.25 * 0.6 * 0.25
      expect(result.isValueBet).toBe(true);
      expect(result.expectedValue).toBeCloseTo(0.5, 2);
      expect(result.edgePercentage).toBeCloseTo(20, 1);
    });

    it('should not recommend betting when there is no edge', () => {
      const opportunity: BettingOpportunity = {
        outcome: 'Draw',
        ourProbability: 0.33,
        bookmakerOdds: 3.0,
        bankroll: 1000
      };

      const result = KellyCalculator.calculate(opportunity);

      expect(result.fullKelly).toBe(0);
      expect(result.isValueBet).toBe(false);
      expect(result.expectedValue).toBeLessThan(0);
    });

    it('should cap maximum bet at 25% of bankroll', () => {
      const opportunity: BettingOpportunity = {
        outcome: 'Away Win',
        ourProbability: 0.9,
        bookmakerOdds: 5.0,
        bankroll: 1000
      };

      const result = KellyCalculator.calculate(opportunity);

      expect(result.fullKelly).toBe(0.25); // Should be capped
      expect(result.fullKelly).toBeLessThanOrEqual(0.25);
    });

    it('should handle edge case with 0% probability', () => {
      const opportunity: BettingOpportunity = {
        outcome: 'Test',
        ourProbability: 0,
        bookmakerOdds: 2.0,
        bankroll: 1000
      };

      const result = KellyCalculator.calculate(opportunity);

      expect(result.fullKelly).toBe(0);
      expect(result.isValueBet).toBe(false);
      expect(result.recommendedStake).toBe(0);
    });

    it('should handle edge case with 100% probability', () => {
      const opportunity: BettingOpportunity = {
        outcome: 'Sure Thing',
        ourProbability: 1.0,
        bookmakerOdds: 1.5,
        bankroll: 1000
      };

      const result = KellyCalculator.calculate(opportunity);

      // With 100% probability and 1.5 odds: kelly = (1.0 * 0.5 - 0) / 0.5 = 1.0
      // But capped at 0.25
      expect(result.fullKelly).toBe(0.25); // Capped at max
      expect(result.isValueBet).toBe(true);
    });

    it('should apply confidence level adjustment', () => {
      const opportunity: BettingOpportunity = {
        outcome: 'Test',
        ourProbability: 0.6,
        bookmakerOdds: 2.5,
        bankroll: 1000,
        confidenceLevel: 0.8
      };

      const result = KellyCalculator.calculate(opportunity);

      expect(result.confidence).toBe('high');
      expect(result.recommendedStake).toBeLessThanOrEqual(50); // Capped by maxStakePercentage default (5%)
    });

    it('should respect maximum stake percentage', () => {
      const opportunity: BettingOpportunity = {
        outcome: 'Test',
        ourProbability: 0.7,
        bookmakerOdds: 3.0,
        bankroll: 1000,
        maxStakePercentage: 0.02
      };

      const result = KellyCalculator.calculate(opportunity);

      expect(result.recommendedStake).toBeLessThanOrEqual(20);
    });

    it('should determine risk level correctly', () => {
      const highRisk: BettingOpportunity = {
        outcome: 'High Risk',
        ourProbability: 0.55,
        bookmakerOdds: 4.0,
        bankroll: 1000
      };

      const lowRisk: BettingOpportunity = {
        outcome: 'Low Risk',
        ourProbability: 0.75,
        bookmakerOdds: 1.5,
        bankroll: 1000
      };

      const highResult = KellyCalculator.calculate(highRisk);
      const lowResult = KellyCalculator.calculate(lowRisk);

      expect(highResult.risk).toBe('high');
      expect(lowResult.risk).toBe('low');
    });
  });

  describe('calculateMultiple', () => {
    it('should handle multiple betting opportunities', () => {
      const opportunities: BettingOpportunity[] = [
        {
          outcome: 'Bet 1',
          ourProbability: 0.6,
          bookmakerOdds: 2.0,
          bankroll: 1000
        },
        {
          outcome: 'Bet 2',
          ourProbability: 0.55,
          bookmakerOdds: 2.5,
          bankroll: 1000
        }
      ];

      const results = KellyCalculator.calculateMultiple(opportunities, 0.25);

      expect(results).toHaveLength(1);
      expect(results[0].allocations).toHaveLength(2);
      expect(results[0].totalStake).toBeLessThanOrEqual(250);
      results[0].allocations.forEach(allocation => {
        expect(allocation.stake).toBeGreaterThanOrEqual(0);
      });
    });

    it('should distribute bankroll proportionally', () => {
      const opportunities: BettingOpportunity[] = [
        {
          outcome: 'Strong Bet',
          ourProbability: 0.7,
          bookmakerOdds: 2.0,
          bankroll: 1000
        },
        {
          outcome: 'Weak Bet',
          ourProbability: 0.52,
          bookmakerOdds: 2.2,
          bankroll: 1000
        }
      ];

      const results = KellyCalculator.calculateMultiple(opportunities, 0.5);
      const strongBet = results[0].allocations.find(a => a.outcome === 'Strong Bet');
      const weakBet = results[0].allocations.find(a => a.outcome === 'Weak Bet');

      expect(strongBet!.stake).toBeGreaterThan(weakBet!.stake);
    });
  });

  describe('simulate', () => {
    it('should run Monte Carlo simulation', () => {
      const opportunities = [
        { probability: 0.6, odds: 2.0 },
        { probability: 0.55, odds: 2.5 }
      ];

      const simulation = KellyCalculator.simulate(1000, opportunities, 100, 0.5);

      expect(simulation.finalBankroll).toBeGreaterThan(0);
      expect(simulation.maxBankroll).toBeGreaterThanOrEqual(simulation.finalBankroll);
      expect(simulation.minBankroll).toBeLessThanOrEqual(simulation.finalBankroll);
      expect(simulation.bustRate).toBeGreaterThanOrEqual(0);
      expect(simulation.bustRate).toBeLessThanOrEqual(100);
    });

    it('should show higher bust rate with aggressive betting', () => {
      const riskyOpportunities = [
        { probability: 0.51, odds: 2.5 }
      ];

      const conservativeResult = KellyCalculator.simulate(1000, riskyOpportunities, 100, 0.25);
      const aggressiveResult = KellyCalculator.simulate(1000, riskyOpportunities, 100, 1.0);

      expect(aggressiveResult.bustRate).toBeGreaterThanOrEqual(conservativeResult.bustRate);
    });
  });

  describe('detectArbitrage', () => {
    it('should detect arbitrage opportunity', () => {
      const odds = [1.5, 6.0, 8.0]; // Sum of implied probabilities < 1
      const result = KellyCalculator.detectArbitrage(odds);

      expect(result.isArbitrage).toBe(true);
      expect(result.guaranteedProfit).toBeGreaterThan(0);
      expect(result.stakes).toHaveLength(3);
      expect(result.stakes.reduce((sum, stake) => sum + stake, 0)).toBeCloseTo(1000, 1);
    });

    it('should not detect arbitrage when none exists', () => {
      const odds = [2.0, 3.5, 4.0]; // Normal odds
      const result = KellyCalculator.detectArbitrage(odds);

      expect(result.isArbitrage).toBe(false);
      expect(result.guaranteedProfit).toBe(0);
      expect(result.stakes).toEqual([]);
    });

    it('should calculate correct stakes for arbitrage', () => {
      const odds = [1.4, 8.0, 15.0];
      const result = KellyCalculator.detectArbitrage(odds, 1000);

      if (result.isArbitrage) {
        // Each stake should return the same amount regardless of outcome
        const returns = result.stakes.map((stake, i) => stake * odds[i]);
        const firstReturn = returns[0];
        returns.forEach(returnAmount => {
          expect(returnAmount).toBeCloseTo(firstReturn, 1);
        });
      }
    });
  });

  describe('calculateRequiredWinRate', () => {
    it('should calculate breakeven win rate', () => {
      const winRate = KellyCalculator.calculateRequiredWinRate(2.0);
      expect(winRate).toBe(0.5); // 50% for 2.0 odds
    });

    it('should handle various odds correctly', () => {
      expect(KellyCalculator.calculateRequiredWinRate(1.5)).toBeCloseTo(0.667, 3);
      expect(KellyCalculator.calculateRequiredWinRate(3.0)).toBeCloseTo(0.333, 3);
      expect(KellyCalculator.calculateRequiredWinRate(10.0)).toBe(0.1);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle negative bankroll gracefully', () => {
      const opportunity: BettingOpportunity = {
        outcome: 'Test',
        ourProbability: 0.6,
        bookmakerOdds: 2.0,
        bankroll: -100
      };

      const result = KellyCalculator.calculate(opportunity);
      expect(result.recommendedStake).toBe(0);
    });

    it('should handle invalid odds', () => {
      const opportunity: BettingOpportunity = {
        outcome: 'Test',
        ourProbability: 0.6,
        bookmakerOdds: 0.5, // Invalid odds < 1
        bankroll: 1000
      };

      const result = KellyCalculator.calculate(opportunity);
      expect(result.fullKelly).toBe(0);
      expect(result.isValueBet).toBe(false);
    });

    it('should handle NaN inputs', () => {
      const opportunity: BettingOpportunity = {
        outcome: 'Test',
        ourProbability: NaN,
        bookmakerOdds: 2.0,
        bankroll: 1000
      };

      const result = KellyCalculator.calculate(opportunity);
      expect(result.fullKelly).toBe(0);
      expect(result.recommendedStake).toBe(0);
    });
  });
});