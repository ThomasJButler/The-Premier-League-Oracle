import { PoissonPredictor } from './advancedPredictions';
import { OptimizedPredictor } from './optimizedPredictions';
import { dataService } from '../services/dataService';
import type { Match } from '../types';

export interface BetBuilderPrediction {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  matchResult: {
    prediction: 'H' | 'D' | 'A';
    homeWinProb: number;
    drawProb: number;
    awayWinProb: number;
    confidence: number;
  };
  bothTeamsToScore: {
    prediction: boolean;
    yesProb: number;
    noProb: number;
    confidence: number;
  };
  totalGoals: {
    over25: { prediction: boolean; probability: number };
    over35: { prediction: boolean; probability: number };
    under25: { prediction: boolean; probability: number };
    under35: { prediction: boolean; probability: number };
    exactGoals: { [key: number]: number };
  };
  corners: {
    totalOver85: { prediction: boolean; probability: number };
    totalOver95: { prediction: boolean; probability: number };
    totalOver105: { prediction: boolean; probability: number };
  };
  cards: {
    totalOver25: { prediction: boolean; probability: number };
    totalOver35: { prediction: boolean; probability: number };
    totalOver45: { prediction: boolean; probability: number };
  };
  halfTimeResult: {
    prediction: 'H' | 'D' | 'A';
    homeWinProb: number;
    drawProb: number;
    awayWinProb: number;
  };
  cleanSheets: {
    homeCleanSheet: { prediction: boolean; probability: number };
    awayCleanSheet: { prediction: boolean; probability: number };
    bothCleanSheets: { prediction: boolean; probability: number };
  };
  suggestedCombos: BetBuilderCombo[];
}

export interface BetBuilderCombo {
  name: string;
  selections: string[];
  combinedOdds: number;
  confidence: number;
  reasoning: string;
}

export class BetBuilderPredictor {
  /**
   * Generate comprehensive bet builder predictions for a match
   */
  static async generateBetBuilder(
    homeTeam: string, 
    awayTeam: string,
    matchId?: string
  ): Promise<BetBuilderPrediction> {
    // Get base prediction from optimized predictor
    const basePrediction = await OptimizedPredictor.predictMatch(homeTeam, awayTeam);
    
    // Get team stats
    const [homeStats, awayStats] = await Promise.all([
      dataService.getTeamStats(homeTeam),
      dataService.getTeamStats(awayTeam)
    ]);
    
    // Calculate average goals for Poisson distribution
    const homeGoalsExpected = basePrediction.predictedHomeGoals || 1.3;
    const awayGoalsExpected = basePrediction.predictedAwayGoals || 1.1;
    
    // Generate score probabilities
    const scoreProbabilities = PoissonPredictor.predictScoreProbabilities(
      homeGoalsExpected,
      awayGoalsExpected,
      7
    );
    
    // Calculate match result probabilities
    const matchResult = this.calculateMatchResult(scoreProbabilities);
    
    // Calculate BTTS probabilities
    const btts = this.calculateBTTS(scoreProbabilities);
    
    // Calculate total goals markets
    const totalGoals = this.calculateTotalGoals(scoreProbabilities);
    
    // Calculate corners predictions (based on team stats and style)
    const corners = this.calculateCorners(homeStats, awayStats);
    
    // Calculate cards predictions (based on rivalry, referee, importance)
    const cards = this.calculateCards(homeTeam, awayTeam, homeStats, awayStats);
    
    // Calculate half-time result (simplified - usually 40% of full-time tendency)
    const halfTimeResult = this.calculateHalfTimeResult(matchResult);
    
    // Calculate clean sheet probabilities
    const cleanSheets = this.calculateCleanSheets(scoreProbabilities);
    
    // Generate suggested bet builder combos
    const suggestedCombos = this.generateSuggestedCombos(
      matchResult,
      btts,
      totalGoals,
      corners,
      cards,
      cleanSheets,
      homeTeam,
      awayTeam
    );
    
    return {
      matchId: matchId || `${homeTeam}-${awayTeam}`,
      homeTeam,
      awayTeam,
      matchResult,
      bothTeamsToScore: btts,
      totalGoals,
      corners,
      cards,
      halfTimeResult,
      cleanSheets,
      suggestedCombos
    };
  }
  
  private static calculateMatchResult(scoreProbabilities: { [key: string]: number }) {
    let homeWin = 0, draw = 0, awayWin = 0;
    
    for (const [score, prob] of Object.entries(scoreProbabilities)) {
      const [home, away] = score.split('-').map(Number);
      if (home > away) homeWin += prob;
      else if (home === away) draw += prob;
      else awayWin += prob;
    }
    
    const prediction = homeWin > draw && homeWin > awayWin ? 'H' : 
                      awayWin > draw ? 'A' : 'D';
    
    const confidence = Math.max(homeWin, draw, awayWin);
    
    return {
      prediction: prediction as 'H' | 'D' | 'A',
      homeWinProb: homeWin,
      drawProb: draw,
      awayWinProb: awayWin,
      confidence
    };
  }
  
  private static calculateBTTS(scoreProbabilities: { [key: string]: number }) {
    let bttsYes = 0, bttsNo = 0;
    
    for (const [score, prob] of Object.entries(scoreProbabilities)) {
      const [home, away] = score.split('-').map(Number);
      if (home > 0 && away > 0) {
        bttsYes += prob;
      } else {
        bttsNo += prob;
      }
    }
    
    return {
      prediction: bttsYes > 0.5,
      yesProb: bttsYes,
      noProb: bttsNo,
      confidence: Math.max(bttsYes, bttsNo)
    };
  }
  
  private static calculateTotalGoals(scoreProbabilities: { [key: string]: number }) {
    const goalsProbabilities: { [key: number]: number } = {};
    let over25 = 0, over35 = 0;
    
    for (const [score, prob] of Object.entries(scoreProbabilities)) {
      const [home, away] = score.split('-').map(Number);
      const total = home + away;
      
      goalsProbabilities[total] = (goalsProbabilities[total] || 0) + prob;
      
      if (total > 2.5) over25 += prob;
      if (total > 3.5) over35 += prob;
    }
    
    return {
      over25: { prediction: over25 > 0.5, probability: over25 },
      over35: { prediction: over35 > 0.5, probability: over35 },
      under25: { prediction: over25 <= 0.5, probability: 1 - over25 },
      under35: { prediction: over35 <= 0.5, probability: 1 - over35 },
      exactGoals: goalsProbabilities
    };
  }
  
  private static calculateCorners(homeStats: any, awayStats: any) {
    // Simplified corner prediction based on attacking style
    // Teams that attack more generally win more corners
    const avgCorners = 9.5; // League average
    
    const homeAttackingFactor = homeStats?.goals_for ? 
      (homeStats.goals_for / (homeStats.matches_played || 1)) / 1.5 : 1;
    const awayAttackingFactor = awayStats?.goals_for ? 
      (awayStats.goals_for / (awayStats.matches_played || 1)) / 1.5 : 1;
    
    const expectedCorners = avgCorners * ((homeAttackingFactor + awayAttackingFactor) / 2);
    
    return {
      totalOver85: { 
        prediction: expectedCorners > 8.5, 
        probability: expectedCorners > 8.5 ? 0.55 + (expectedCorners - 8.5) * 0.1 : 0.45 
      },
      totalOver95: { 
        prediction: expectedCorners > 9.5, 
        probability: expectedCorners > 9.5 ? 0.50 + (expectedCorners - 9.5) * 0.1 : 0.40 
      },
      totalOver105: { 
        prediction: expectedCorners > 10.5, 
        probability: expectedCorners > 10.5 ? 0.45 + (expectedCorners - 10.5) * 0.1 : 0.35 
      }
    };
  }
  
  private static calculateCards(homeTeam: string, awayTeam: string, homeStats: any, awayStats: any) {
    // Base card expectation
    let expectedCards = 3.2; // League average
    
    // Rivalry factor (simplified - would need actual rivalry data)
    const isRivalry = this.checkRivalry(homeTeam, awayTeam);
    if (isRivalry) expectedCards += 1.5;
    
    // Defensive teams tend to commit more fouls
    const homeDefensiveFactor = homeStats?.goals_against ? 
      (homeStats.goals_against / (homeStats.matches_played || 1)) : 1.5;
    const awayDefensiveFactor = awayStats?.goals_against ? 
      (awayStats.goals_against / (awayStats.matches_played || 1)) : 1.5;
    
    if (homeDefensiveFactor > 1.5 || awayDefensiveFactor > 1.5) {
      expectedCards += 0.5;
    }
    
    return {
      totalOver25: { 
        prediction: expectedCards > 2.5, 
        probability: expectedCards > 2.5 ? 0.60 + (expectedCards - 2.5) * 0.1 : 0.40 
      },
      totalOver35: { 
        prediction: expectedCards > 3.5, 
        probability: expectedCards > 3.5 ? 0.45 + (expectedCards - 3.5) * 0.1 : 0.35 
      },
      totalOver45: { 
        prediction: expectedCards > 4.5, 
        probability: expectedCards > 4.5 ? 0.30 + (expectedCards - 4.5) * 0.1 : 0.25 
      }
    };
  }
  
  /**
   * Normalise a team name by stripping common suffixes so that both
   * API canonical names ("Arsenal FC") and short display names ("Arsenal")
   * can match the rivalry list.
   */
  private static normaliseTeamName(name: string): string {
    return name.replace(/\s+(FC|AFC|CF)$/i, '').trim();
  }

  private static checkRivalry(team1: string, team2: string): boolean {
    const rivalries = [
      ['Manchester United', 'Manchester City'],
      ['Manchester United', 'Liverpool'],
      ['Arsenal', 'Tottenham Hotspur'],
      ['Liverpool', 'Everton'],
      ['Chelsea', 'Arsenal'],
      ['Chelsea', 'Tottenham Hotspur'],
      ['Wolverhampton Wanderers', 'West Bromwich Albion'],
      ['Nottingham Forest', 'Leicester City'],
      ['Newcastle United', 'Sunderland'],
      ['Aston Villa', 'Birmingham City']
    ];

    const n1 = this.normaliseTeamName(team1);
    const n2 = this.normaliseTeamName(team2);

    return rivalries.some(([a, b]) =>
      (n1 === a && n2 === b) || (n1 === b && n2 === a)
    );
  }
  
  /**
   * Estimate half-time result probabilities from full-time probabilities.
   *
   * Half-time draws are historically ~40 % in the Premier League, so we
   * blend each full-time probability towards a draw-heavy prior and then
   * normalise to guarantee the three values sum to exactly 1.0.
   */
  private static calculateHalfTimeResult(fullTimeResult: any) {
    const ftBias = 0.4; // 40 % correlation with full-time
    // Prior: draws much more common at half-time
    const priorHome = 0.25;
    const priorDraw = 0.45;
    const priorAway = 0.25;
    // Note: prior doesn't sum to 0.95 not 1.0, but the normalisation below fixes that

    let homeWinProb = fullTimeResult.homeWinProb * ftBias + priorHome * (1 - ftBias);
    let drawProb    = fullTimeResult.drawProb    * ftBias + priorDraw * (1 - ftBias);
    let awayWinProb = fullTimeResult.awayWinProb * ftBias + priorAway * (1 - ftBias);

    // Normalise so probabilities sum to exactly 1.0
    const total = homeWinProb + drawProb + awayWinProb;
    homeWinProb /= total;
    drawProb    /= total;
    awayWinProb /= total;

    const prediction: 'H' | 'A' | 'D' = homeWinProb > drawProb && homeWinProb > awayWinProb ? 'H'
                                      : awayWinProb > drawProb ? 'A'
                                      : 'D';

    return { prediction, homeWinProb, drawProb, awayWinProb };
  }
  
  private static calculateCleanSheets(scoreProbabilities: { [key: string]: number }) {
    let homeCleanSheet = 0, awayCleanSheet = 0;
    
    for (const [score, prob] of Object.entries(scoreProbabilities)) {
      const [home, away] = score.split('-').map(Number);
      if (away === 0) homeCleanSheet += prob;
      if (home === 0) awayCleanSheet += prob;
    }
    
    const bothCleanSheets = scoreProbabilities['0-0'] || 0;
    
    return {
      homeCleanSheet: { prediction: homeCleanSheet > 0.3, probability: homeCleanSheet },
      awayCleanSheet: { prediction: awayCleanSheet > 0.3, probability: awayCleanSheet },
      bothCleanSheets: { prediction: bothCleanSheets > 0.08, probability: bothCleanSheets }
    };
  }
  
  private static generateSuggestedCombos(
    matchResult: any,
    btts: any,
    totalGoals: any,
    corners: any,
    cards: any,
    cleanSheets: any,
    homeTeam: string,
    awayTeam: string
  ): BetBuilderCombo[] {
    const combos: BetBuilderCombo[] = [];
    
    // Safe combo - high probability selections
    if (matchResult.confidence > 0.4) {
      const safeOdds = (1 / matchResult.confidence) * 
                       (1 / Math.max(totalGoals.over25.probability, totalGoals.under35.probability)) * 
                       (1 / 0.6) * 1.1; // Adding margin
      
      combos.push({
        name: 'Safe Builder',
        selections: [
          `${matchResult.prediction === 'H' ? homeTeam : matchResult.prediction === 'A' ? awayTeam : 'Draw'} to win`,
          totalGoals.over25.probability > 0.5 ? 'Over 2.5 goals' : 'Under 3.5 goals',
          'Over 7.5 corners'
        ],
        combinedOdds: Math.round(safeOdds * 100) / 100,
        confidence: Math.round(matchResult.confidence * Math.max(totalGoals.over25.probability, totalGoals.under35.probability) * corners.totalOver85.probability * 100) / 100,
        reasoning: 'High probability selections with good combined odds'
      });
    }
    
    // Value combo - balanced risk/reward
    if (btts.yesProb > 0.45 && totalGoals.over25.probability > 0.5) {
      const valueOdds = (1 / matchResult.confidence) * 
                        (1 / btts.yesProb) * 
                        (1 / totalGoals.over25.probability) * 
                        (1 / cards.totalOver25.probability) * 1.15;
      
      combos.push({
        name: 'Value Builder',
        selections: [
          `${matchResult.prediction === 'H' ? homeTeam : matchResult.prediction === 'A' ? awayTeam : 'Draw'} to win`,
          'Both teams to score',
          'Over 2.5 goals',
          'Over 2.5 cards'
        ],
        combinedOdds: Math.round(valueOdds * 100) / 100,
        confidence: Math.round(matchResult.confidence * btts.yesProb * totalGoals.over25.probability * cards.totalOver25.probability * 100) / 100,
        reasoning: 'Good value with attacking teams likely to score'
      });
    }
    
    // Aggressive combo - higher risk, higher reward
    if (matchResult.homeWinProb > 0.45 || matchResult.awayWinProb > 0.45) {
      const favTeam = matchResult.homeWinProb > matchResult.awayWinProb ? homeTeam : awayTeam;
      const favProb = Math.max(matchResult.homeWinProb, matchResult.awayWinProb);
      
      // Win-to-nil = P(team wins) × P(team keeps clean sheet | team wins)
      // Approximate as favProb × favCleanSheet, clamped to a reasonable range
      const favCleanSheet = matchResult.homeWinProb > matchResult.awayWinProb
        ? cleanSheets.homeCleanSheet.probability
        : cleanSheets.awayCleanSheet.probability;
      const winToNilProb = Math.max(0.05, favProb * favCleanSheet);

      const aggressiveOdds = (1 / favProb) *
                             (1 / winToNilProb) *
                             (1 / corners.totalOver95.probability) *
                             (1 / cards.totalOver35.probability) * 1.2;
      
      combos.push({
        name: 'High Risk Builder',
        selections: [
          `${favTeam} to win`,
          `${favTeam} to keep clean sheet`,
          'Over 9.5 corners',
          'Over 3.5 cards'
        ],
        combinedOdds: Math.round(aggressiveOdds * 100) / 100,
        confidence: Math.round(favProb * favCleanSheet * corners.totalOver95.probability * cards.totalOver35.probability * 100) / 100,
        reasoning: `Banking on ${favTeam} dominance with defensive control`
      });
    }
    
    // Goals-focused combo
    if (totalGoals.over25.probability > 0.55 && btts.yesProb > 0.5) {
      const goalsOdds = (1 / totalGoals.over25.probability) * 
                        (1 / btts.yesProb) * 
                        (1 / 0.35) * // Over 1.5 first half goals
                        (1 / corners.totalOver95.probability) * 1.15;
      
      combos.push({
        name: 'Goals Galore',
        selections: [
          'Over 2.5 goals',
          'Both teams to score',
          'Over 1.5 first half goals',
          'Over 9.5 corners'
        ],
        combinedOdds: Math.round(goalsOdds * 100) / 100,
        confidence: Math.round(totalGoals.over25.probability * btts.yesProb * 0.35 * corners.totalOver95.probability * 100) / 100,
        reasoning: 'High-scoring game expected with open play'
      });
    }
    
    return combos;
  }
}