/**
 * Kelly Criterion Calculator for Optimal Bet Sizing
 * 
 * The Kelly Criterion is a formula for sizing bets to maximize long-term
 * bankroll growth while minimizing risk of ruin.
 * 
 * Formula: f = (bp - q) / b
 * Where:
 * - f = fraction of bankroll to bet
 * - b = odds received on the bet (decimal odds - 1)
 * - p = probability of winning
 * - q = probability of losing (1 - p)
 */

export interface KellyCalculation {
  fullKelly: number;
  halfKelly: number;
  quarterKelly: number;
  recommendedStake: number;
  expectedValue: number;
  edgePercentage: number;
  impliedProbability: number;
  isValueBet: boolean;
  confidence: 'high' | 'medium' | 'low';
  risk: 'high' | 'medium' | 'low';
}

export interface BettingOpportunity {
  outcome: string;
  ourProbability: number;
  bookmakerOdds: number;
  bankroll: number;
  maxStakePercentage?: number;
  confidenceLevel?: number;
}

export class KellyCalculator {
  private static readonly MIN_EDGE = 0.02; // 2% minimum edge to consider betting
  private static readonly MAX_KELLY = 0.25; // Never bet more than 25% of bankroll
  private static readonly HIGH_CONFIDENCE_THRESHOLD = 0.7;
  private static readonly MEDIUM_CONFIDENCE_THRESHOLD = 0.5;
  
  /**
   * Calculate Kelly Criterion for a single bet
   */
  public static calculate(opportunity: BettingOpportunity): KellyCalculation {
    const { ourProbability, bookmakerOdds, bankroll, maxStakePercentage = 0.05, confidenceLevel = 0.6 } = opportunity;

    // Clamp confidenceLevel to [0, 1] — values outside this range produce oversized stakes
    const clampedConfidence = Math.max(0, Math.min(1, confidenceLevel));

    // Validate inputs — return zero result for invalid values
    if (isNaN(ourProbability) || isNaN(bookmakerOdds) || isNaN(bankroll) ||
        bankroll <= 0 || bookmakerOdds < 1 || ourProbability < 0 || ourProbability > 1) {
      const impliedProb = bookmakerOdds > 0 && !isNaN(bookmakerOdds) ? 1 / bookmakerOdds : 0;
      return {
        fullKelly: 0, halfKelly: 0, quarterKelly: 0,
        recommendedStake: 0, expectedValue: 0, edgePercentage: 0,
        impliedProbability: Math.round(impliedProb * 10000) / 10000,
        isValueBet: false, confidence: 'low', risk: 'high'
      };
    }

    // Convert decimal odds to net odds (profit on win)
    const netOdds = bookmakerOdds - 1;
    
    // Calculate implied probability from bookmaker odds
    const impliedProbability = 1 / bookmakerOdds;
    
    // Calculate edge (our probability - implied probability)
    const edge = ourProbability - impliedProbability;
    const edgePercentage = edge * 100;
    
    // Calculate expected value
    const expectedValue = (ourProbability * bookmakerOdds) - 1;
    
    // Determine if this is a value bet
    const isValueBet = edge > this.MIN_EDGE && expectedValue > 0;
    
    // Calculate Kelly fraction
    const q = 1 - ourProbability;
    const rawKelly = Math.max(0, (ourProbability * netOdds - q) / netOdds);
    
    // Cap at maximum Kelly
    const fullKelly = Math.min(rawKelly, this.MAX_KELLY);
    
    // Calculate fractional Kelly variants (pure fractions of fullKelly)
    const halfKelly = fullKelly * 0.5;
    const quarterKelly = fullKelly * 0.25;

    // Recommended stake: half-Kelly adjusted by model confidence, capped at limit
    const maxAllowedKelly = Math.min(this.MAX_KELLY, maxStakePercentage);
    const recommendedKelly = Math.min(halfKelly * clampedConfidence, maxAllowedKelly);
    
    // Calculate actual stake amount
    const recommendedStake = recommendedKelly * bankroll;
    
    // Determine confidence level
    const confidence = this.getConfidenceLevel(ourProbability, edge, clampedConfidence);
    
    // Assess risk level
    const risk = this.getRiskLevel(edge, ourProbability);
    
    return {
      fullKelly: Math.round(fullKelly * 10000) / 10000,
      halfKelly: Math.round(halfKelly * 10000) / 10000,
      quarterKelly: Math.round(quarterKelly * 10000) / 10000,
      recommendedStake: Math.round(recommendedStake * 100) / 100,
      expectedValue: Math.round(expectedValue * 10000) / 10000,
      edgePercentage: Math.round(edgePercentage * 100) / 100,
      impliedProbability: Math.round(impliedProbability * 10000) / 10000,
      isValueBet,
      confidence,
      risk
    };
  }
  
  /**
   * Determine confidence level
   */
  private static getConfidenceLevel(
    probability: number,
    edge: number,
    confidenceInput: number
  ): 'high' | 'medium' | 'low' {
    const score = (probability * 0.3) + (edge * 2) + (confidenceInput * 0.4);
    
    if (score >= this.HIGH_CONFIDENCE_THRESHOLD) return 'high';
    if (score >= this.MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
    return 'low';
  }
  
  /**
   * Assess risk level
   */
  private static getRiskLevel(
    edge: number,
    probability: number
  ): 'high' | 'medium' | 'low' {
    if (probability < 0.6) return 'high';
    if (probability >= 0.7 && edge > 0.05) return 'low';
    return 'medium';
  }
}

// Export convenience functions
export function calculateKelly(
  ourProbability: number,
  bookmakerOdds: number,
  bankroll: number = 1000,
  kellyFraction: number = 0.5
): KellyCalculation {
  return KellyCalculator.calculate({
    outcome: 'default',
    ourProbability,
    bookmakerOdds,
    bankroll,
    maxStakePercentage: kellyFraction
  });
}
