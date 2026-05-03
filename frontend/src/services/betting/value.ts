import { KellyCalculator, type KellyCalculation } from './kelly';
import { AdvancedMatchPredictor, PoissonPredictor } from '../../lib/advancedPredictions';

export interface ValueBet {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  market: 'home' | 'draw' | 'away' | 'over2.5' | 'under2.5' | 'btts';
  ourProbability: number;
  bookmakerOdds: number;
  impliedProbability: number;
  edge: number;
  expectedValue: number;
  kellyStake: KellyCalculation;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string[];
  warnings: string[];
}

export interface MarketOdds {
  home: number;
  draw: number;
  away: number;
  over25?: number;
  under25?: number;
  btts?: number;
  bttsNo?: number;
}


export class ValueBettingEngine {
  private static readonly MIN_VALUE_EDGE = 0.03; // 3% minimum edge
  private static readonly MIN_CONFIDENCE = 0.35; // 35% — model typically operates at 25-45% confidence


  /**
   * Identify value bets for a match
   */
  public static async identifyValueBets(
    matchId: string,
    homeTeam: string,
    awayTeam: string,
    matchDate: Date,
    marketOdds: MarketOdds,
    bankroll: number = 1000
  ): Promise<ValueBet[]> {
    const valueBets: ValueBet[] = [];
    
    try {
      // Get our predictions
      const prediction = await AdvancedMatchPredictor.predictMatch(
        homeTeam,
        awayTeam,
        matchDate
      );
      
      // Check 1X2 market
      const markets = [
        { type: 'home' as const, prob: prediction.homeWinProb, odds: marketOdds.home },
        { type: 'draw' as const, prob: prediction.drawProb, odds: marketOdds.draw },
        { type: 'away' as const, prob: prediction.awayWinProb, odds: marketOdds.away }
      ];

      for (const market of markets) {
        const valueBet = this.evaluateMarket(
          matchId,
          homeTeam,
          awayTeam,
          matchDate,
          market.type,
          market.prob,
          market.odds,
          bankroll,
          prediction.confidence,
          prediction.insights
        );
        
        if (valueBet) {
          valueBets.push(valueBet);
        }
      }
      
      // Check goals markets if available
      if (marketOdds.over25 && marketOdds.under25) {
        const totalGoalsExpected = prediction.expectedHomeGoals + prediction.expectedAwayGoals;
        const over25Prob = this.calculateGoalsProbability(totalGoalsExpected, 2.5, 'over');
        const under25Prob = 1 - over25Prob;
        
        const overBet = this.evaluateMarket(
          matchId,
          homeTeam,
          awayTeam,
          matchDate,
          'over2.5',
          over25Prob,
          marketOdds.over25,
          bankroll,
          prediction.confidence,
          [`Expected ${totalGoalsExpected.toFixed(1)} goals`]
        );

        if (overBet) valueBets.push(overBet);

        const underBet = this.evaluateMarket(
          matchId,
          homeTeam,
          awayTeam,
          matchDate,
          'under2.5',
          under25Prob,
          marketOdds.under25,
          bankroll,
          prediction.confidence,
          [`Expected ${totalGoalsExpected.toFixed(1)} goals`]
        );
        
        if (underBet) valueBets.push(underBet);
      }
      
      // Check BTTS market if available
      if (marketOdds.btts && marketOdds.bttsNo) {
        const bttsProb = this.calculateBTTSProbability(
          prediction.expectedHomeGoals,
          prediction.expectedAwayGoals
        );
        
        const bttsBet = this.evaluateMarket(
          matchId,
          homeTeam,
          awayTeam,
          matchDate,
          'btts',
          bttsProb,
          marketOdds.btts,
          bankroll,
          prediction.confidence,
          prediction.insights
        );
        
        if (bttsBet) valueBets.push(bttsBet);
      }
      
    } catch (error) {
      console.warn('ValueBettingEngine: failed to identify value bets', error);
    }
    
    // Sort by expected value
    return valueBets.sort((a, b) => b.expectedValue - a.expectedValue);
  }
  
  /**
   * Evaluate a single market for value
   */
  private static evaluateMarket(
    matchId: string,
    homeTeam: string,
    awayTeam: string,
    matchDate: Date,
    market: ValueBet['market'],
    ourProbability: number,
    bookmakerOdds: number,
    bankroll: number,
    modelConfidence: number,
    insights: string[]
  ): ValueBet | null {
    const impliedProbability = 1 / bookmakerOdds;
    const edge = ourProbability - impliedProbability;
    const expectedValue = (ourProbability * bookmakerOdds) - 1;
    
    // Check minimum criteria
    if (edge < this.MIN_VALUE_EDGE || ourProbability < this.MIN_CONFIDENCE) {
      return null;
    }
    
    // Calculate Kelly stake
    const kellyStake = KellyCalculator.calculate({
      outcome: market,
      ourProbability,
      bookmakerOdds,
      bankroll,
      confidenceLevel: modelConfidence
    });
    
    // Only return if it's a value bet
    if (!kellyStake.isValueBet) {
      return null;
    }
    
    // Generate reasoning
    const reasoning = [
      `Our model: ${(ourProbability * 100).toFixed(1)}% vs Market: ${(impliedProbability * 100).toFixed(1)}%`,
      `Edge: ${(edge * 100).toFixed(1)}%`,
      `Expected Value: ${(expectedValue * 100).toFixed(1)}%`,
      ...insights.slice(0, 2)
    ];
    
    // Generate warnings
    const warnings = this.generateWarnings(
      ourProbability,
      edge,
      bookmakerOdds,
      kellyStake,
      modelConfidence
    );
    
    return {
      matchId,
      homeTeam,
      awayTeam,
      matchDate,
      market,
      ourProbability,
      bookmakerOdds,
      impliedProbability,
      edge,
      expectedValue,
      kellyStake,
      confidence: kellyStake.confidence,
      reasoning,
      warnings
    };
  }
  
  /**
   * Calculate probability for goals markets using Poisson
   */
  private static calculateGoalsProbability(
    expectedGoals: number,
    threshold: number,
    type: 'over' | 'under'
  ): number {
    let probability = 0;
    const maxGoals = 7;
    
    for (let goals = 0; goals <= maxGoals; goals++) {
      const poissonProb = PoissonPredictor.poissonProbability(expectedGoals, goals);
      
      if (type === 'over' && goals > threshold) {
        probability += poissonProb;
      } else if (type === 'under' && goals < threshold) {
        probability += poissonProb;
      }
    }
    
    return probability;
  }
  
  /**
   * Calculate BTTS probability
   */
  private static calculateBTTSProbability(
    expectedHomeGoals: number,
    expectedAwayGoals: number
  ): number {
    // Probability that home scores at least 1
    const homeScoresProb = 1 - PoissonPredictor.poissonProbability(expectedHomeGoals, 0);
    // Probability that away scores at least 1
    const awayScoresProb = 1 - PoissonPredictor.poissonProbability(expectedAwayGoals, 0);
    // Both teams score
    return homeScoresProb * awayScoresProb;
  }
  
  
  /**
   * Generate warnings for a value bet
   */
  private static generateWarnings(
    probability: number,
    edge: number,
    odds: number,
    kelly: KellyCalculation,
    confidence: number
  ): string[] {
    const warnings: string[] = [];
    
    if (kelly.risk === 'high') {
      warnings.push('High risk bet - consider smaller stake');
    }
    
    if (edge < 0.05) {
      warnings.push('Small edge - vulnerable to model error');
    }
    
    if (odds > 5) {
      warnings.push('Long odds - high variance expected');
    }
    
    if (confidence < 0.6) {
      warnings.push('Low model confidence');
    }
    
    if (kelly.fullKelly > 0.1) {
      warnings.push('Large Kelly percentage - consider fractional Kelly');
    }
    
    if (probability < 0.2 && odds < 6) {
      warnings.push('Low probability event with insufficient odds');
    }
    
    return warnings;
  }
  
}