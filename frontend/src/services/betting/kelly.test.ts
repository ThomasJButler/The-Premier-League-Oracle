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
      expect(result.halfKelly).toBeCloseTo(0.125, 4); // 0.25 * 0.5
      expect(result.quarterKelly).toBeCloseTo(0.0625, 4); // 0.25 * 0.25
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