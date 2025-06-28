import { supabase } from './supabase';
import type { Match } from './supabase';

// Advanced team rating system using ELO
export interface TeamRating {
  team: string;
  eloRating: number;
  offensiveStrength: number;
  defensiveStrength: number;
  formRating: number; // Dynamic form based on recent performances
  homeAdvantage: number; // Team-specific home advantage
}

// Poisson distribution for goal prediction
export class PoissonPredictor {
  static factorial(n: number): number {
    if (n <= 1) return 1;
    return n * this.factorial(n - 1);
  }

  static poissonProbability(lambda: number, k: number): number {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / this.factorial(k);
  }

  static predictScoreProbabilities(
    expectedHomeGoals: number,
    expectedAwayGoals: number,
    maxGoals: number = 10
  ): { [key: string]: number } {
    const probabilities: { [key: string]: number } = {};

    for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals++) {
      for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals++) {
        const homeProb = this.poissonProbability(expectedHomeGoals, homeGoals);
        const awayProb = this.poissonProbability(expectedAwayGoals, awayGoals);
        probabilities[`${homeGoals}-${awayGoals}`] = homeProb * awayProb;
      }
    }

    return probabilities;
  }

  static getOutcomeProbabilities(scoreProbabilities: { [key: string]: number }): {
    homeWin: number;
    draw: number;
    awayWin: number;
  } {
    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;

    for (const [score, prob] of Object.entries(scoreProbabilities)) {
      const [home, away] = score.split('-').map(Number);
      if (home > away) homeWin += prob;
      else if (home === away) draw += prob;
      else awayWin += prob;
    }

    return { homeWin, draw, awayWin };
  }
}

// ELO Rating System
export class EloRatingSystem {
  private static readonly K_FACTOR = 32; // Sensitivity of rating changes
  private static readonly HOME_ADVANTAGE = 65; // Average home advantage in ELO points

  static calculateExpectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  static updateRatings(
    homeRating: number,
    awayRating: number,
    actualResult: 'H' | 'D' | 'A'
  ): { newHomeRating: number; newAwayRating: number } {
    // Add home advantage
    const adjustedHomeRating = homeRating + this.HOME_ADVANTAGE;
    
    // Calculate expected scores
    const expectedHome = this.calculateExpectedScore(adjustedHomeRating, awayRating);
    const expectedAway = 1 - expectedHome;

    // Actual scores
    const actualHome = actualResult === 'H' ? 1 : actualResult === 'D' ? 0.5 : 0;
    const actualAway = actualResult === 'A' ? 1 : actualResult === 'D' ? 0.5 : 0;

    // Update ratings
    const newHomeRating = homeRating + this.K_FACTOR * (actualHome - expectedHome);
    const newAwayRating = awayRating + this.K_FACTOR * (actualAway - expectedAway);

    return { newHomeRating, newAwayRating };
  }
}

// Expected Goals (xG) Calculator
export class ExpectedGoalsCalculator {
  static calculateShotValue(
    shotType: 'open-play' | 'corner' | 'free-kick' | 'penalty',
    distance: number,
    angle: number,
    bodyPart: 'foot' | 'head' | 'other'
  ): number {
    let baseXG = 0;

    // Base xG values by shot type
    switch (shotType) {
      case 'penalty':
        return 0.76; // Penalties have ~76% conversion rate
      case 'open-play':
        baseXG = 0.1;
        break;
      case 'corner':
        baseXG = 0.03;
        break;
      case 'free-kick':
        baseXG = 0.06;
        break;
    }

    // Adjust for distance (closer = higher xG)
    const distanceFactor = Math.exp(-0.1 * distance);
    
    // Adjust for angle (more central = higher xG)
    const angleFactor = 1 - (Math.abs(angle) / 90) * 0.7;
    
    // Adjust for body part
    const bodyPartMultiplier = bodyPart === 'foot' ? 1 : bodyPart === 'head' ? 0.7 : 0.3;

    return Math.min(baseXG * distanceFactor * angleFactor * bodyPartMultiplier, 0.95);
  }

  static async calculateMatchXG(matchId: string): Promise<{ homeXG: number; awayXG: number }> {
    // This would fetch shot data from the database
    // For now, we'll estimate based on shots and shots on target
    const { data: match } = await supabase
      .from('matches')
      .select('home_shots, away_shots, home_shots_target, away_shots_target')
      .eq('id', matchId)
      .single();

    if (!match) return { homeXG: 0, awayXG: 0 };

    // Simplified xG calculation based on available data
    const homeXG = (match.home_shots_target || 0) * 0.38 + 
                   ((match.home_shots || 0) - (match.home_shots_target || 0)) * 0.03;
    const awayXG = (match.away_shots_target || 0) * 0.38 + 
                   ((match.away_shots || 0) - (match.away_shots_target || 0)) * 0.03;

    return { homeXG, awayXG };
  }
}

// Fixture Congestion & Fatigue Analysis
export class FatigueAnalyzer {
  static calculateRestDays(teamName: string, matchDate: Date): Promise<number> {
    return supabase
      .from('matches')
      .select('date')
      .or(`home_team.eq.${teamName},away_team.eq.${teamName}`)
      .lt('date', matchDate.toISOString())
      .order('date', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!data || data.length === 0) return 7; // Default rest days
        const lastMatch = new Date(data[0].date);
        return Math.floor((matchDate.getTime() - lastMatch.getTime()) / (1000 * 60 * 60 * 24));
      });
  }

  static calculateFixtureDifficulty(
    teamName: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    // Calculate average opponent strength in date range
    return supabase
      .from('matches')
      .select('*')
      .or(`home_team.eq.${teamName},away_team.eq.${teamName}`)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())
      .then(async ({ data }) => {
        if (!data || data.length === 0) return 0;
        
        let totalDifficulty = 0;
        for (const match of data) {
          const opponent = match.home_team === teamName ? match.away_team : match.home_team;
          // Get opponent's rating (simplified - in real implementation, fetch from ratings table)
          totalDifficulty += 1500; // Placeholder - would fetch actual ELO rating
        }
        
        return totalDifficulty / data.length;
      });
  }

  static getFatigueMultiplier(restDays: number, recentFixtures: number): number {
    // Less rest = more fatigue = worse performance
    const restFactor = Math.min(restDays / 7, 1); // Optimal rest is 7+ days
    const fixtureFactor = Math.max(1 - (recentFixtures - 1) * 0.1, 0.6); // Each extra fixture reduces performance
    
    return restFactor * fixtureFactor;
  }
}

// Advanced Match Predictor combining all factors
export class AdvancedMatchPredictor {
  static async predictMatch(
    homeTeam: string,
    awayTeam: string,
    matchDate: Date
  ): Promise<{
    homeWinProb: number;
    drawProb: number;
    awayWinProb: number;
    expectedHomeGoals: number;
    expectedAwayGoals: number;
    confidence: number;
    valueBets: Array<{ outcome: string; odds: number; expectedValue: number }>;
    insights: string[];
  }> {
    // 1. Get team ratings (would be fetched from database)
    const homeRating = 1500; // Placeholder - fetch from DB
    const awayRating = 1450; // Placeholder - fetch from DB

    // 2. Calculate rest days and fatigue
    const [homeRestDays, awayRestDays] = await Promise.all([
      FatigueAnalyzer.calculateRestDays(homeTeam, matchDate),
      FatigueAnalyzer.calculateRestDays(awayTeam, matchDate)
    ]);

    const homeFatigue = FatigueAnalyzer.getFatigueMultiplier(homeRestDays, 1);
    const awayFatigue = FatigueAnalyzer.getFatigueMultiplier(awayRestDays, 1);

    // 3. Adjust ratings for fatigue
    const adjustedHomeRating = homeRating * homeFatigue;
    const adjustedAwayRating = awayRating * awayFatigue;

    // 4. Calculate expected goals using adjusted ratings
    const ratingDiff = (adjustedHomeRating + EloRatingSystem['HOME_ADVANTAGE'] - adjustedAwayRating) / 100;
    const baseHomeGoals = 1.5; // League average
    const baseAwayGoals = 1.2; // Slightly lower for away teams

    const expectedHomeGoals = baseHomeGoals * Math.exp(ratingDiff * 0.1);
    const expectedAwayGoals = baseAwayGoals * Math.exp(-ratingDiff * 0.1);

    // 5. Use Poisson distribution for outcome probabilities
    const scoreProbabilities = PoissonPredictor.predictScoreProbabilities(
      expectedHomeGoals,
      expectedAwayGoals
    );
    const outcomes = PoissonPredictor.getOutcomeProbabilities(scoreProbabilities);

    // 6. Calculate confidence based on model factors
    const ratingReliability = 0.8; // How much we trust our ratings
    const fatigueCertainty = homeRestDays >= 3 && awayRestDays >= 3 ? 0.9 : 0.7;
    const confidence = (ratingReliability + fatigueCertainty) / 2;

    // 7. Value betting opportunities (placeholder odds - would fetch from API)
    const bookmakerOdds = { home: 2.1, draw: 3.4, away: 3.8 };
    const valueBets = [
      {
        outcome: 'Home Win',
        odds: bookmakerOdds.home,
        expectedValue: outcomes.homeWin * bookmakerOdds.home - 1
      },
      {
        outcome: 'Draw',
        odds: bookmakerOdds.draw,
        expectedValue: outcomes.draw * bookmakerOdds.draw - 1
      },
      {
        outcome: 'Away Win',
        odds: bookmakerOdds.away,
        expectedValue: outcomes.awayWin * bookmakerOdds.away - 1
      }
    ].filter(bet => bet.expectedValue > 0); // Only positive EV bets

    // 8. Generate insights
    const insights: string[] = [];
    
    if (homeRestDays < 3) {
      insights.push(`${homeTeam} has only ${homeRestDays} days rest - fatigue could be a factor`);
    }
    if (awayRestDays < 3) {
      insights.push(`${awayTeam} has only ${awayRestDays} days rest - fatigue could be a factor`);
    }
    if (ratingDiff > 200) {
      insights.push(`Significant quality gap - ${homeTeam} rated ${Math.abs(ratingDiff * 100).toFixed(0)} points higher`);
    }
    if (valueBets.length > 0) {
      const bestValue = valueBets.reduce((a, b) => a.expectedValue > b.expectedValue ? a : b);
      insights.push(`Value bet detected: ${bestValue.outcome} at ${bestValue.odds} (EV: +${(bestValue.expectedValue * 100).toFixed(1)}%)`);
    }

    return {
      homeWinProb: outcomes.homeWin,
      drawProb: outcomes.draw,
      awayWinProb: outcomes.awayWin,
      expectedHomeGoals,
      expectedAwayGoals,
      confidence,
      valueBets,
      insights
    };
  }
}

// Referee impact analysis
export class RefereeAnalyzer {
  static async getRefereeStats(refereeName: string): Promise<{
    avgYellowCards: number;
    avgRedCards: number;
    avgPenalties: number;
    homeWinRate: number;
  }> {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('referee', refereeName);

    if (!data || data.length === 0) {
      return { avgYellowCards: 4, avgRedCards: 0.1, avgPenalties: 0.2, homeWinRate: 0.46 };
    }

    const totalMatches = data.length;
    const totalYellows = data.reduce((sum, m) => sum + (m.home_yellows || 0) + (m.away_yellows || 0), 0);
    const totalReds = data.reduce((sum, m) => sum + (m.home_reds || 0) + (m.away_reds || 0), 0);
    const homeWins = data.filter(m => m.result === 'H').length;

    return {
      avgYellowCards: totalYellows / totalMatches,
      avgRedCards: totalReds / totalMatches,
      avgPenalties: 0.2, // Placeholder - would need penalty data
      homeWinRate: homeWins / totalMatches
    };
  }
}