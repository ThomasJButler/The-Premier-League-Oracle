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
    const risk = this.getRiskLevel(fullKelly, edge, ourProbability);
    
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
   * Calculate Kelly for multiple simultaneous bets
   */
  public static calculateMultiple(
    opportunities: BettingOpportunity[],
    kellyFraction: number = 0.25
  ): Array<{
    totalStake: number;
    allocations: Array<{
      outcome: string;
      stake: number;
      kelly: number;
      expectedValue: number;
    }>;
  }> {
    const allocations = opportunities.map(opp => {
      const calc = this.calculate(opp);
      return {
        outcome: opp.outcome,
        stake: calc.recommendedStake,
        kelly: calc.fullKelly * kellyFraction,
        expectedValue: calc.expectedValue
      };
    }).filter(a => a.expectedValue > 0);
    
    const totalStake = allocations.reduce((sum, a) => sum + a.stake, 0);
    
    return [{
      totalStake,
      allocations
    }];
  }
  
  /**
   * Calculate optimal stake for arbitrage opportunity
   */
  public static calculateArbitrage(
    odds: number[],
    bankroll: number
  ): { stakes: number[]; profit: number; returnPercentage: number } | null {
    // Check if arbitrage exists
    const impliedProbSum = odds.reduce((sum, odd) => sum + 1/odd, 0);
    
    if (impliedProbSum >= 1) {
      return null; // No arbitrage opportunity
    }
    
    // Calculate stakes to guarantee profit
    const stakes = odds.map(odd => (bankroll / impliedProbSum) / odd);
    const totalStake = stakes.reduce((sum, stake) => sum + stake, 0);
    const returns = stakes.map((stake, i) => stake * odds[i]);
    const profit = returns[0] - totalStake; // All returns should be equal
    const returnPercentage = (profit / totalStake) * 100;
    
    return {
      stakes: stakes.map(s => Math.round(s * 100) / 100),
      profit: Math.round(profit * 100) / 100,
      returnPercentage: Math.round(returnPercentage * 100) / 100
    };
  }
  
  /**
   * Simulate Kelly betting over multiple iterations
   */
  public static simulate(
    initialBankroll: number,
    opportunities: Array<{ probability: number; odds: number }>,
    iterations: number = 1000,
    kellyFraction: number = 0.5
  ): {
    finalBankroll: number;
    maxBankroll: number;
    minBankroll: number;
    maxDrawdown: number;
    averageReturn: number;
    bustRate: number;
  } {
    const results: number[] = [];
    let busts = 0;
    let maxDrawdown = 0;
    
    for (let i = 0; i < iterations; i++) {
      let bankroll = initialBankroll;
      let maxBankroll = initialBankroll;
      
      for (const opp of opportunities) {
        const calc = this.calculate({
          outcome: 'sim',
          ourProbability: opp.probability,
          bookmakerOdds: opp.odds,
          bankroll: bankroll
        });
        
        const stake = calc.fullKelly * kellyFraction * bankroll;
        
        // Simulate bet outcome
        const won = Math.random() < opp.probability;
        
        if (won) {
          bankroll += stake * (opp.odds - 1);
        } else {
          bankroll -= stake;
        }
        
        maxBankroll = Math.max(maxBankroll, bankroll);
        const currentDrawdown = (maxBankroll - bankroll) / maxBankroll;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
        
        // Check for bust
        if (bankroll < initialBankroll * 0.01) {
          busts++;
          break;
        }
      }
      
      results.push(bankroll);
    }
    
    const avgBankroll = results.reduce((sum, b) => sum + b, 0) / results.length;
    const avgReturn = ((avgBankroll - initialBankroll) / initialBankroll) * 100;
    
    return {
      finalBankroll: Math.round(avgBankroll * 100) / 100,
      maxBankroll: Math.round(Math.max(...results) * 100) / 100,
      minBankroll: Math.round(Math.min(...results) * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
      averageReturn: Math.round(avgReturn * 100) / 100,
      bustRate: Math.round((busts / iterations) * 10000) / 100
    };
  }
  
  /**
   * Detect arbitrage opportunity
   */
  public static detectArbitrage(
    odds: number[],
    bankroll: number = 1000
  ): {
    isArbitrage: boolean;
    guaranteedProfit: number;
    stakes: number[];
    returnPercentage?: number;
  } {
    // Calculate sum of implied probabilities
    const impliedProbSum = odds.reduce((sum, odd) => sum + 1/odd, 0);
    
    if (impliedProbSum >= 1) {
      return {
        isArbitrage: false,
        guaranteedProfit: 0,
        stakes: []
      };
    }
    
    // Calculate stakes for arbitrage
    const stakes = odds.map(odd => (bankroll / impliedProbSum) / odd);
    const totalStake = stakes.reduce((sum, stake) => sum + stake, 0);
    const guaranteedReturn = bankroll / impliedProbSum;
    const guaranteedProfit = guaranteedReturn - totalStake;
    const returnPercentage = (guaranteedProfit / totalStake) * 100;
    
    return {
      isArbitrage: true,
      guaranteedProfit: Math.round(guaranteedProfit * 100) / 100,
      stakes: stakes.map(s => Math.round(s * 100) / 100),
      returnPercentage: Math.round(returnPercentage * 100) / 100
    };
  }
  
  /**
   * Calculate required win rate for profitability at given odds
   */
  public static calculateRequiredWinRate(odds: number): number {
    return 1 / odds;
  }
  
  /**
   * Calculate required win rate for profitability at given odds (alias)
   */
  public static requiredWinRate(odds: number): number {
    return this.calculateRequiredWinRate(odds);
  }
  
  /**
   * Calculate break-even odds for given probability
   */
  public static breakEvenOdds(probability: number): number {
    return 1 / probability;
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
    kellyFraction: number,
    edge: number,
    probability: number
  ): 'high' | 'medium' | 'low' {
    if (probability < 0.6) return 'high';
    if (probability >= 0.7 && edge > 0.05) return 'low';
    return 'medium';
  }
  
  /**
   * Format percentage for display
   */
  public static formatPercentage(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }
  
  /**
   * Format odds (decimal to fractional)
   */
  public static decimalToFractional(decimal: number): string {
    const numerator = decimal - 1;
    const denominator = 1;
    const gcd = this.getGCD(numerator * 100, 100);
    return `${(numerator * 100) / gcd}/${100 / gcd}`;
  }
  
  private static getGCD(a: number, b: number): number {
    return b === 0 ? a : this.getGCD(b, a % b);
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

export function isValueBet(ourProbability: number, bookmakerOdds: number): boolean {
  const impliedProbability = 1 / bookmakerOdds;
  const edge = ourProbability - impliedProbability;
  const expectedValue = (ourProbability * bookmakerOdds) - 1;
  return edge > 0.02 && expectedValue > 0;
}