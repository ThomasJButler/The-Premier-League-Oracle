import { KellyCalculator, type KellyCalculation, type BettingOpportunity } from './kelly';
import { AdvancedMatchPredictor } from '../../lib/advancedPredictions';

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

export interface ClosingLineValue {
  betId: string;
  openingOdds: number;
  closingOdds: number;
  clv: number; // Positive means we beat the closing line
  profitable: boolean;
}

/**
 * Interface for future odds API integration.
 * Implementations should fetch real-time bookmaker odds for a given match.
 */
export interface OddsProvider {
  /** Human-readable name of the odds source (e.g. "Betfair", "Odds API") */
  name: string;
  /** Fetch current market odds for a match. Returns null if unavailable. */
  getOdds(homeTeam: string, awayTeam: string, matchDate: Date): Promise<MarketOdds | null>;
  /** Whether this provider is currently available and configured */
  isAvailable(): boolean;
}

export class ValueBettingEngine {
  private static readonly MIN_VALUE_EDGE = 0.03; // 3% minimum edge
  private static readonly MIN_CONFIDENCE = 0.55; // 55% minimum confidence
  private static readonly MAX_ODDS_MOVEMENT = 0.15; // 15% max odds movement to consider

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
      // Error identifying value bets
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
    const maxGoals = 10;
    
    for (let goals = 0; goals <= maxGoals; goals++) {
      const poissonProb = this.poissonProbability(expectedGoals, goals);
      
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
    const homeScoresProb = 1 - this.poissonProbability(expectedHomeGoals, 0);
    // Probability that away scores at least 1
    const awayScoresProb = 1 - this.poissonProbability(expectedAwayGoals, 0);
    // Both teams score
    return homeScoresProb * awayScoresProb;
  }
  
  /**
   * Poisson probability calculation
   */
  private static poissonProbability(lambda: number, k: number): number {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / this.factorial(k);
  }
  
  private static factorial(n: number): number {
    if (n <= 1) return 1;
    return n * this.factorial(n - 1);
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
  
  /**
   * Track closing line value
   */
  public static calculateCLV(
    openingOdds: number,
    closingOdds: number
  ): ClosingLineValue {
    const clv = ((closingOdds - openingOdds) / openingOdds) * 100;
    
    return {
      betId: '',
      openingOdds,
      closingOdds,
      clv,
      profitable: clv > 0
    };
  }
  
  /**
   * Identify arbitrage opportunities
   */
  public static findArbitrage(
    bookmakers: Array<{ name: string; odds: MarketOdds }>
  ): Array<{
    type: string;
    bookmakers: string[];
    odds: number[];
    profit: number;
  }> {
    const arbitrages: Array<{
      type: string;
      bookmakers: string[];
      odds: number[];
      profit: number;
    }> = [];
    
    // Check 1X2 market
    const bestHome = Math.max(...bookmakers.map(b => b.odds.home));
    const bestDraw = Math.max(...bookmakers.map(b => b.odds.draw));
    const bestAway = Math.max(...bookmakers.map(b => b.odds.away));
    
    const arb = KellyCalculator.calculateArbitrage(
      [bestHome, bestDraw, bestAway],
      1000
    );
    
    if (arb) {
      const homeBook = bookmakers.find(b => b.odds.home === bestHome)?.name || '';
      const drawBook = bookmakers.find(b => b.odds.draw === bestDraw)?.name || '';
      const awayBook = bookmakers.find(b => b.odds.away === bestAway)?.name || '';
      
      arbitrages.push({
        type: '1X2',
        bookmakers: [homeBook, drawBook, awayBook],
        odds: [bestHome, bestDraw, bestAway],
        profit: arb.returnPercentage
      });
    }
    
    return arbitrages;
  }
  
  /**
   * Calculate Sharpe Ratio for betting performance
   */
  public static calculateSharpeRatio(
    returns: number[],
    riskFreeRate: number = 0.02
  ): number {
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const excessReturns = returns.map(r => r - riskFreeRate);
    const avgExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
    
    const variance = excessReturns.reduce((sum, r) => 
      sum + Math.pow(r - avgExcessReturn, 2), 0
    ) / excessReturns.length;
    
    const stdDev = Math.sqrt(variance);
    
    return stdDev === 0 ? 0 : avgExcessReturn / stdDev;
  }
  
  /**
   * Track betting performance metrics
   */
  public static calculatePerformanceMetrics(
    bets: Array<{
      stake: number;
      odds: number;
      won: boolean;
      expectedValue: number;
    }>
  ): {
    totalBets: number;
    wonBets: number;
    winRate: number;
    totalStaked: number;
    totalReturn: number;
    profit: number;
    roi: number;
    yield: number;
    avgOdds: number;
    clvRate: number;
    maxDrawdown: number;
  } {
    const totalBets = bets.length;
    const wonBets = bets.filter(b => b.won).length;
    const winRate = wonBets / totalBets;
    
    const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0);
    const totalReturn = bets.reduce((sum, b) => 
      sum + (b.won ? b.stake * b.odds : 0), 0
    );
    const profit = totalReturn - totalStaked;
    const roi = (profit / totalStaked) * 100;
    const yieldValue = profit / totalBets;
    
    const avgOdds = bets.reduce((sum, b) => sum + b.odds, 0) / totalBets;
    
    // Calculate CLV rate (simplified - assuming EV correlates with CLV)
    const positiveCLV = bets.filter(b => b.expectedValue > 0).length;
    const clvRate = positiveCLV / totalBets;
    
    // Calculate max drawdown
    let bankroll = 0;
    let maxBankroll = 0;
    let maxDrawdown = 0;
    
    for (const bet of bets) {
      bankroll += bet.won ? (bet.stake * (bet.odds - 1)) : -bet.stake;
      maxBankroll = Math.max(maxBankroll, bankroll);
      const drawdown = maxBankroll > 0 ? (maxBankroll - bankroll) / maxBankroll : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return {
      totalBets,
      wonBets,
      winRate: Math.round(winRate * 10000) / 100,
      totalStaked: Math.round(totalStaked * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      yield: Math.round(yieldValue * 100) / 100,
      avgOdds: Math.round(avgOdds * 100) / 100,
      clvRate: Math.round(clvRate * 10000) / 100,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 100
    };
  }
}