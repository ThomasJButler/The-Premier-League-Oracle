import { dataService } from '../services/dataService';
import type { Match, Standing } from '../types';
import { EloRatingSystem, PoissonPredictor } from './advancedPredictions';

interface EnhancedPredictionModel {
  predictedResult: 'H' | 'D' | 'A';
  confidence: number;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  modelWeights: {
    elo: number;
    poisson: number;
    form: number;
    h2h: number;
    standings: number;
  };
  insights: string[];
  valueOdds?: {
    home: number;
    draw: number;
    away: number;
  };
}

export class OptimizedPredictor {
  private static eloSystem = new EloRatingSystem();
  private static readonly HOME_ADVANTAGE = 60; // ELO home advantage
  private static readonly FORM_WEIGHT = 0.25;
  private static readonly H2H_WEIGHT = 0.15;
  private static readonly POSITION_WEIGHT = 0.20;
  private static readonly STATS_WEIGHT = 0.40;

  /**
   * Main prediction method with enhanced algorithms
   */
  static async predictMatch(
    homeTeam: string, 
    awayTeam: string,
    historicalMatches?: Match[]
  ): Promise<EnhancedPredictionModel> {
    const insights: string[] = [];
    
    try {
      // 1. Get current standings and team positions
      const standings = await dataService.getStandings();
      const homePosition = standings.findIndex(s => s.team.name === homeTeam) + 1;
      const awayPosition = standings.findIndex(s => s.team.name === awayTeam) + 1;
      
      if (homePosition && awayPosition) {
        const positionDiff = awayPosition - homePosition;
        if (positionDiff > 10) {
          insights.push(`${homeTeam} is ${positionDiff} places higher in the table`);
        } else if (positionDiff < -10) {
          insights.push(`${awayTeam} is ${Math.abs(positionDiff)} places higher in the table`);
        }
      }

      // 2. Get team statistics
      const [homeStats, awayStats] = await Promise.all([
        this.getEnhancedTeamStats(homeTeam, standings),
        this.getEnhancedTeamStats(awayTeam, standings)
      ]);

      // 3. Calculate ELO ratings
      const homeElo = this.eloSystem.getTeamRating(homeTeam);
      const awayElo = this.eloSystem.getTeamRating(awayTeam);
      const eloWinProbability = this.eloSystem.calculateWinProbability(
        homeElo + this.HOME_ADVANTAGE, 
        awayElo
      );

      // 4. Calculate Poisson predictions
      const homeGoalsExpected = homeStats.avgGoalsScored * 1.2 + awayStats.avgGoalsConceded * 0.8;
      const awayGoalsExpected = awayStats.avgGoalsScored * 0.8 + homeStats.avgGoalsConceded * 1.2;
      
      const scoreProbabilities = PoissonPredictor.predictScoreProbabilities(
        homeGoalsExpected,
        awayGoalsExpected,
        5
      );
      const poissonProbs = PoissonPredictor.getOutcomeProbabilities(scoreProbabilities);

      // 5. Analyze recent form
      const formAnalysis = await this.analyzeRecentForm(homeTeam, awayTeam);
      
      // 6. Head-to-head analysis
      const h2hAnalysis = await this.analyzeHeadToHead(homeTeam, awayTeam, historicalMatches);
      
      // 7. Calculate fatigue factor
      const fatigueFactor = await this.calculateFatigueFactor(homeTeam, awayTeam);
      
      // 8. Combine all models with weighted approach
      const combinedProbabilities = this.combineModels({
        elo: { home: eloWinProbability, draw: 0.25, away: 1 - eloWinProbability - 0.25 },
        poisson: poissonProbs,
        form: formAnalysis.probabilities,
        h2h: h2hAnalysis.probabilities,
        standings: this.getStandingsProbabilities(homePosition, awayPosition)
      });

      // 9. Determine predicted outcome
      const prediction = this.determinePrediction(combinedProbabilities);
      
      // 10. Calculate confidence score
      const confidence = this.calculateConfidence(
        combinedProbabilities,
        prediction.result,
        fatigueFactor
      );

      // 11. Predict goals with adjusted model
      const predictedGoals = this.predictGoals(
        homeGoalsExpected,
        awayGoalsExpected,
        prediction.result,
        formAnalysis,
        h2hAnalysis
      );

      // Add form insights
      if (formAnalysis.homeFormScore > 0.7) {
        insights.push(`${homeTeam} in excellent form (last 5: ${formAnalysis.homeFormString})`);
      } else if (formAnalysis.homeFormScore < 0.3) {
        insights.push(`${homeTeam} struggling with form (last 5: ${formAnalysis.homeFormString})`);
      }

      if (formAnalysis.awayFormScore > 0.7) {
        insights.push(`${awayTeam} in excellent form (last 5: ${formAnalysis.awayFormString})`);
      } else if (formAnalysis.awayFormScore < 0.3) {
        insights.push(`${awayTeam} struggling with form (last 5: ${formAnalysis.awayFormString})`);
      }

      // Add H2H insights
      if (h2hAnalysis.totalMatches > 0) {
        if (h2hAnalysis.homeWinRate > 0.6) {
          insights.push(`${homeTeam} dominates H2H (${h2hAnalysis.homeWins}W in last ${h2hAnalysis.totalMatches})`);
        } else if (h2hAnalysis.awayWinRate > 0.6) {
          insights.push(`${awayTeam} dominates H2H (${h2hAnalysis.awayWins}W in last ${h2hAnalysis.totalMatches})`);
        }
      }

      // Add statistical insights
      if (homeStats.avgGoalsScored > 2.0) {
        insights.push(`${homeTeam} averaging ${homeStats.avgGoalsScored.toFixed(1)} goals per game`);
      }
      if (awayStats.avgGoalsConceded > 2.0) {
        insights.push(`${awayTeam} conceding ${awayStats.avgGoalsConceded.toFixed(1)} goals per game`);
      }

      // Calculate value odds
      const valueOdds = this.calculateValueOdds(combinedProbabilities);

      return {
        predictedResult: prediction.result,
        confidence,
        predictedHomeGoals: predictedGoals.home,
        predictedAwayGoals: predictedGoals.away,
        modelWeights: {
          elo: 0.25,
          poisson: 0.30,
          form: this.FORM_WEIGHT,
          h2h: this.H2H_WEIGHT,
          standings: this.POSITION_WEIGHT
        },
        insights,
        valueOdds
      };

    } catch (error) {
      console.error('Error in optimized prediction:', error);
      // Fallback to simple prediction
      return {
        predictedResult: 'D',
        confidence: 0.33,
        predictedHomeGoals: 1,
        predictedAwayGoals: 1,
        modelWeights: {
          elo: 0.25,
          poisson: 0.30,
          form: 0.25,
          h2h: 0.15,
          standings: 0.05
        },
        insights: ['Using simplified prediction due to data limitations'],
        valueOdds: { home: 3.0, draw: 3.3, away: 3.0 }
      };
    }
  }

  private static async getEnhancedTeamStats(team: string, standings: Standing[]) {
    const standing = standings.find(s => s.team.name === team);
    
    if (!standing) {
      return {
        avgGoalsScored: 1.2,
        avgGoalsConceded: 1.2,
        pointsPerGame: 1.0,
        cleanSheetRate: 0.25
      };
    }

    const gamesPlayed = standing.playedGames || 1;
    
    return {
      avgGoalsScored: standing.goalsFor / gamesPlayed,
      avgGoalsConceded: standing.goalsAgainst / gamesPlayed,
      pointsPerGame: standing.points / gamesPlayed,
      cleanSheetRate: 0.3, // Would need actual clean sheet data
      winRate: standing.won / gamesPlayed,
      form: standing.form
    };
  }

  private static async analyzeRecentForm(homeTeam: string, awayTeam: string) {
    const [homeForm, awayForm] = await Promise.all([
      dataService.getTeamForm(homeTeam),
      dataService.getTeamForm(awayTeam)
    ]);

    const calculateFormScore = (form: any[]) => {
      if (!form || form.length === 0) return 0.5;
      
      let score = 0;
      const weights = [0.35, 0.25, 0.20, 0.12, 0.08]; // Recent matches weighted more
      
      form.slice(0, 5).forEach((match, idx) => {
        if (match.result === 'W') score += 1 * weights[idx];
        else if (match.result === 'D') score += 0.33 * weights[idx];
      });
      
      return score;
    };

    const homeFormScore = calculateFormScore(homeForm);
    const awayFormScore = calculateFormScore(awayForm);
    
    const formString = (form: any[]) => {
      if (!form || form.length === 0) return 'DDDDD';
      return form.slice(0, 5).map(m => m.result || 'D').join('');
    };

    // Calculate form-based probabilities
    const totalFormScore = homeFormScore + awayFormScore;
    const homeFormProb = homeFormScore / totalFormScore;
    const awayFormProb = awayFormScore / totalFormScore;
    
    return {
      homeFormScore,
      awayFormScore,
      homeFormString: formString(homeForm),
      awayFormString: formString(awayForm),
      probabilities: {
        homeWin: homeFormProb * 0.8 + 0.1, // Adjust for draws
        draw: 0.2,
        awayWin: awayFormProb * 0.8 + 0.1
      }
    };
  }

  private static async analyzeHeadToHead(homeTeam: string, awayTeam: string, historicalMatches?: Match[]) {
    const matches = historicalMatches || await dataService.getMatches();
    
    const h2hMatches = matches.filter(m => 
      (m.home_team === homeTeam && m.away_team === awayTeam) ||
      (m.home_team === awayTeam && m.away_team === homeTeam)
    ).slice(0, 10); // Last 10 H2H matches

    if (h2hMatches.length === 0) {
      return {
        totalMatches: 0,
        homeWins: 0,
        awayWins: 0,
        draws: 0,
        homeWinRate: 0.33,
        awayWinRate: 0.33,
        probabilities: {
          homeWin: 0.40,
          draw: 0.30,
          awayWin: 0.30
        }
      };
    }

    let homeWins = 0, awayWins = 0, draws = 0;
    let homeGoals = 0, awayGoals = 0;

    h2hMatches.forEach(match => {
      if (match.result) {
        if (match.home_team === homeTeam) {
          if (match.result === 'H') homeWins++;
          else if (match.result === 'A') awayWins++;
          else draws++;
          
          homeGoals += match.home_goals || 0;
          awayGoals += match.away_goals || 0;
        } else {
          if (match.result === 'H') awayWins++;
          else if (match.result === 'A') homeWins++;
          else draws++;
          
          homeGoals += match.away_goals || 0;
          awayGoals += match.home_goals || 0;
        }
      }
    });

    const total = homeWins + awayWins + draws || 1;
    
    return {
      totalMatches: h2hMatches.length,
      homeWins,
      awayWins,
      draws,
      homeWinRate: homeWins / total,
      awayWinRate: awayWins / total,
      avgHomeGoals: homeGoals / h2hMatches.length,
      avgAwayGoals: awayGoals / h2hMatches.length,
      probabilities: {
        homeWin: (homeWins / total) * 0.8 + 0.1,
        draw: (draws / total) * 0.8 + 0.1,
        awayWin: (awayWins / total) * 0.8 + 0.1
      }
    };
  }

  private static async calculateFatigueFactor(homeTeam: string, awayTeam: string) {
    // Simplified fatigue calculation
    // In a real scenario, would check days since last match, European fixtures, etc.
    return {
      homeFatigue: 1.0, // No fatigue adjustment
      awayFatigue: 1.0
    };
  }

  private static getStandingsProbabilities(homePosition: number, awayPosition: number) {
    if (!homePosition || !awayPosition) {
      return { homeWin: 0.40, draw: 0.30, awayWin: 0.30 };
    }

    const positionDiff = awayPosition - homePosition;
    
    // Convert position difference to probability
    let homeWinProb = 0.5 + (positionDiff * 0.025); // Better position = higher probability
    homeWinProb = Math.max(0.15, Math.min(0.85, homeWinProb));
    
    let awayWinProb = 0.5 - (positionDiff * 0.025);
    awayWinProb = Math.max(0.10, Math.min(0.70, awayWinProb));
    
    const remaining = 1 - homeWinProb - awayWinProb;
    const drawProb = Math.max(0.15, Math.min(0.35, remaining));
    
    // Normalize
    const total = homeWinProb + drawProb + awayWinProb;
    
    return {
      homeWin: homeWinProb / total,
      draw: drawProb / total,
      awayWin: awayWinProb / total
    };
  }

  private static combineModels(models: {
    elo: { home: number; draw: number; away: number };
    poisson: { homeWin: number; draw: number; awayWin: number };
    form: { homeWin: number; draw: number; awayWin: number };
    h2h: { homeWin: number; draw: number; awayWin: number };
    standings: { homeWin: number; draw: number; awayWin: number };
  }) {
    const weights = {
      elo: 0.25,
      poisson: 0.30,
      form: 0.20,
      h2h: 0.10,
      standings: 0.15
    };

    const homeWin = 
      models.elo.home * weights.elo +
      models.poisson.homeWin * weights.poisson +
      models.form.homeWin * weights.form +
      models.h2h.homeWin * weights.h2h +
      models.standings.homeWin * weights.standings;

    const draw = 
      models.elo.draw * weights.elo +
      models.poisson.draw * weights.poisson +
      models.form.draw * weights.form +
      models.h2h.draw * weights.h2h +
      models.standings.draw * weights.standings;

    const awayWin = 
      models.elo.away * weights.elo +
      models.poisson.awayWin * weights.poisson +
      models.form.awayWin * weights.form +
      models.h2h.awayWin * weights.h2h +
      models.standings.awayWin * weights.standings;

    // Normalize to ensure sum equals 1
    const total = homeWin + draw + awayWin;
    
    return {
      homeWin: homeWin / total,
      draw: draw / total,
      awayWin: awayWin / total
    };
  }

  private static determinePrediction(probabilities: { homeWin: number; draw: number; awayWin: number }) {
    const { homeWin, draw, awayWin } = probabilities;
    
    if (homeWin > draw && homeWin > awayWin) {
      return { result: 'H' as const, probability: homeWin };
    } else if (awayWin > draw && awayWin > homeWin) {
      return { result: 'A' as const, probability: awayWin };
    } else {
      return { result: 'D' as const, probability: draw };
    }
  }

  private static calculateConfidence(
    probabilities: { homeWin: number; draw: number; awayWin: number },
    predictedResult: 'H' | 'D' | 'A',
    fatigueFactor: { homeFatigue: number; awayFatigue: number }
  ): number {
    const probs = Object.values(probabilities);
    const maxProb = Math.max(...probs);
    const secondProb = probs.sort((a, b) => b - a)[1];
    
    // Confidence based on probability difference
    const probDifference = maxProb - secondProb;
    
    // Base confidence from probability
    let confidence = maxProb;
    
    // Boost confidence if there's a clear favorite
    if (probDifference > 0.2) {
      confidence += 0.1;
    } else if (probDifference < 0.1) {
      confidence -= 0.1;
    }
    
    // Apply fatigue adjustment (minimal for now)
    const avgFatigue = (fatigueFactor.homeFatigue + fatigueFactor.awayFatigue) / 2;
    confidence *= avgFatigue;
    
    // Ensure confidence is within bounds
    return Math.max(0.25, Math.min(0.95, confidence));
  }

  private static predictGoals(
    homeExpected: number,
    awayExpected: number,
    predictedResult: 'H' | 'D' | 'A',
    formAnalysis: any,
    h2hAnalysis: any
  ): { home: number; away: number } {
    let homeGoals = Math.round(homeExpected);
    let awayGoals = Math.round(awayExpected);
    
    // Adjust based on predicted result
    if (predictedResult === 'H' && homeGoals <= awayGoals) {
      homeGoals = awayGoals + 1;
    } else if (predictedResult === 'A' && awayGoals <= homeGoals) {
      awayGoals = homeGoals + 1;
    } else if (predictedResult === 'D' && homeGoals !== awayGoals) {
      // Make it a draw
      if (Math.abs(homeGoals - awayGoals) === 1) {
        if (homeGoals > awayGoals) awayGoals = homeGoals;
        else homeGoals = awayGoals;
      } else {
        homeGoals = Math.round((homeGoals + awayGoals) / 2);
        awayGoals = homeGoals;
      }
    }
    
    // Consider H2H average goals
    if (h2hAnalysis.totalMatches > 0) {
      const h2hTotal = h2hAnalysis.avgHomeGoals + h2hAnalysis.avgAwayGoals;
      if (h2hTotal < 2.0) {
        // Low-scoring fixture historically
        homeGoals = Math.min(homeGoals, 2);
        awayGoals = Math.min(awayGoals, 2);
      } else if (h2hTotal > 3.5) {
        // High-scoring fixture
        if (homeGoals + awayGoals < 3) {
          homeGoals = Math.max(homeGoals, 2);
          awayGoals = Math.max(awayGoals, 1);
        }
      }
    }
    
    return {
      home: Math.max(0, homeGoals),
      away: Math.max(0, awayGoals)
    };
  }

  private static calculateValueOdds(probabilities: { homeWin: number; draw: number; awayWin: number }) {
    // Convert probabilities to decimal odds
    // Add small margin for bookmaker edge
    const margin = 1.05;
    
    return {
      home: probabilities.homeWin > 0 ? (1 / probabilities.homeWin) * margin : 10.0,
      draw: probabilities.draw > 0 ? (1 / probabilities.draw) * margin : 4.0,
      away: probabilities.awayWin > 0 ? (1 / probabilities.awayWin) * margin : 10.0
    };
  }
}