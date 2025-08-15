import { dataService } from '../services/dataService';
import type { Match } from '../types';

export interface TeamStats {
  team: string;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  totalMatches: number;
  totalWins: number;
  totalDraws: number;
  totalLosses: number;
  winPercentage: number;
}

export interface TeamForm {
  team: string;
  form: string;
  avgRecentGoalsScored: number;
  avgRecentGoalsConceded: number;
}

export interface HeadToHeadRecord {
  matches: number;
  homeWins: number;
  draws: number;
  awayWins: number;
}

export async function getTeamStats(team: string): Promise<TeamStats | null> {
  try {
    // Get team stats from data service
    const teamStats = await dataService.getTeamStats(team);
    if (!teamStats) return null;

    // Calculate averages from matches
    const matches = await dataService.getMatches();
    const teamMatches = matches.filter(m => 
      m.home_team === team || m.away_team === team
    );

    let totalGoalsScored = 0;
    let totalGoalsConceded = 0;
    let completedMatches = 0;

    teamMatches.forEach(match => {
      if (match.home_goals !== null && match.away_goals !== null) {
        completedMatches++;
        if (match.home_team === team) {
          totalGoalsScored += match.home_goals;
          totalGoalsConceded += match.away_goals;
        } else {
          totalGoalsScored += match.away_goals;
          totalGoalsConceded += match.home_goals;
        }
      }
    });

    return {
      team,
      avgGoalsScored: completedMatches > 0 ? totalGoalsScored / completedMatches : 0,
      avgGoalsConceded: completedMatches > 0 ? totalGoalsConceded / completedMatches : 0,
      totalMatches: teamStats.matches_played,
      totalWins: teamStats.wins,
      totalDraws: teamStats.draws,
      totalLosses: teamStats.losses,
      winPercentage: teamStats.matches_played > 0 ? (teamStats.wins / teamStats.matches_played) * 100 : 0
    };
  } catch (error) {
    console.error('Error fetching team stats:', error);
    return null;
  }
}

export async function getTeamForm(team: string): Promise<TeamForm | null> {
  try {
    // Get recent team form from data service
    const teamForm = await dataService.getTeamForm(team);
    if (!teamForm || teamForm.length === 0) return null;

    // Calculate form statistics from recent matches
    let totalGoalsScored = 0;
    let totalGoalsConceded = 0;
    let formString = '';
    let validMatches = 0;

    teamForm.forEach(match => {
      if (match.goalsFor !== null && match.goalsAgainst !== null) {
        totalGoalsScored += match.goalsFor;
        totalGoalsConceded += match.goalsAgainst;
        validMatches++;
        
        if (match.result) {
          formString += match.result;
        }
      }
    });

    return {
      team,
      form: formString,
      avgRecentGoalsScored: validMatches > 0 ? totalGoalsScored / validMatches : 0,
      avgRecentGoalsConceded: validMatches > 0 ? totalGoalsConceded / validMatches : 0
    };
  } catch (error) {
    console.error('Error fetching team form:', error);
    return null;
  }
}

export async function getHeadToHeadRecord(homeTeam: string, awayTeam: string): Promise<HeadToHeadRecord> {
  try {
    // Get all matches and filter for head-to-head
    const allMatches = await dataService.getMatches();
    const h2hMatches = allMatches.filter(match => 
      (match.home_team === homeTeam && match.away_team === awayTeam) ||
      (match.home_team === awayTeam && match.away_team === homeTeam)
    ).slice(0, 10); // Last 10 head-to-head matches

    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;

    h2hMatches.forEach(match => {
      if (match.result) {
        if (match.home_team === homeTeam && match.away_team === awayTeam) {
          if (match.result === 'H') homeWins++;
          else if (match.result === 'D') draws++;
          else if (match.result === 'A') awayWins++;
        } else {
          // Reversed match (awayTeam at home vs homeTeam away)
          if (match.result === 'H') awayWins++;
          else if (match.result === 'D') draws++;
          else if (match.result === 'A') homeWins++;
        }
      }
    });

    return {
      matches: h2hMatches.length,
      homeWins,
      draws,
      awayWins
    };
  } catch (error) {
    console.error('Error fetching head to head records:', error);
    return { matches: 0, homeWins: 0, draws: 0, awayWins: 0 };
  }
}

export async function predictMatch(homeTeam: string, awayTeam: string): Promise<{
  predictedResult: 'H' | 'A' | 'D';
  confidence: number;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  insights: string[];
}> {
  // Get team statistics
  const [homeStats, awayStats] = await Promise.all([
    getTeamStats(homeTeam),
    getTeamStats(awayTeam)
  ]);

  // Get recent form
  const [homeForm, awayForm] = await Promise.all([
    getTeamForm(homeTeam),
    getTeamForm(awayTeam)
  ]);

  // Get head-to-head record
  const h2h = await getHeadToHeadRecord(homeTeam, awayTeam);

  if (!homeStats || !awayStats || !homeForm || !awayForm) {
    throw new Error('Unable to get team statistics');
  }

  // Enhanced prediction logic based on multiple factors
  // 1. Basic scoring tendency with home advantage
  const homeAdvantage = 1.3; // Home team typically scores more
  let predictedHomeGoals = homeStats.avgGoalsScored * homeAdvantage * (awayStats.avgGoalsConceded / 1.1);
  let predictedAwayGoals = awayStats.avgGoalsScored * (homeStats.avgGoalsConceded / 1.1);
  
  // 2. Adjust based on recent form (last 5 matches)
  const homeFormFactor = homeForm.avgRecentGoalsScored / homeStats.avgGoalsScored || 1;
  const awayFormFactor = awayForm.avgRecentGoalsScored / awayStats.avgGoalsScored || 1;
  
  predictedHomeGoals *= homeFormFactor;
  predictedAwayGoals *= awayFormFactor;
  
  // 3. Adjust based on head-to-head history
  if (h2h.matches > 0) {
    const h2hHomeWinRate = h2h.homeWins / h2h.matches;
    const h2hAwayWinRate = h2h.awayWins / h2h.matches;
    
    predictedHomeGoals *= (1 + h2hHomeWinRate * 0.2);
    predictedAwayGoals *= (1 + h2hAwayWinRate * 0.2);
  }
  
  // Round to nearest half for display purposes
  const roundedHomeGoals = Math.round(predictedHomeGoals * 2) / 2;
  const roundedAwayGoals = Math.round(predictedAwayGoals * 2) / 2;
  
  // Integer values for database storage
  const intHomeGoals = Math.round(predictedHomeGoals);
  const intAwayGoals = Math.round(predictedAwayGoals);
  
  // Determine predicted result
  let predictedResult: 'H' | 'A' | 'D';
  let confidence: number;
  
  if (roundedHomeGoals > roundedAwayGoals) {
    predictedResult = 'H';
    confidence = 0.5 + (roundedHomeGoals - roundedAwayGoals) * 0.1;
  } else if (roundedHomeGoals < roundedAwayGoals) {
    predictedResult = 'A';
    confidence = 0.5 + (roundedAwayGoals - roundedHomeGoals) * 0.1;
  } else {
    predictedResult = 'D';
    confidence = 0.4; // Draws are harder to predict
  }
  
  // Adjust confidence based on historical data
  if (h2h.matches > 0) {
    if (predictedResult === 'H') {
      confidence = confidence * 0.7 + (h2h.homeWins / h2h.matches) * 0.3;
    } else if (predictedResult === 'A') {
      confidence = confidence * 0.7 + (h2h.awayWins / h2h.matches) * 0.3;
    } else {
      confidence = confidence * 0.7 + (h2h.draws / h2h.matches) * 0.3;
    }
  }
  
  // Cap confidence
  confidence = Math.min(0.95, confidence);
  
  // Generate insights
  const insights: string[] = [];
  
  if (homeForm.avgRecentGoalsScored > homeStats.avgGoalsScored * 1.2) {
    insights.push(`${homeTeam} is in excellent scoring form, averaging ${homeForm.avgRecentGoalsScored.toFixed(1)} goals in recent matches.`);
  }
  
  if (awayForm.avgRecentGoalsScored > awayStats.avgGoalsScored * 1.2) {
    insights.push(`${awayTeam} is in excellent scoring form, averaging ${awayForm.avgRecentGoalsScored.toFixed(1)} goals in recent matches.`);
  }
  
  if (h2h.matches > 3) {
    if (h2h.homeWins > h2h.awayWins * 2) {
      insights.push(`${homeTeam} has historically dominated ${awayTeam} in head-to-head matches.`);
    } else if (h2h.awayWins > h2h.homeWins * 2) {
      insights.push(`${awayTeam} has historically performed well against ${homeTeam}.`);
    }
  }
  
  if (homeStats.winPercentage > 65) {
    insights.push(`${homeTeam} has an impressive ${homeStats.winPercentage.toFixed(1)}% win rate this season.`);
  }
  
  if (awayStats.winPercentage > 60) {
    insights.push(`${awayTeam} has an impressive ${awayStats.winPercentage.toFixed(1)}% win rate this season.`);
  }

  return {
    predictedResult,
    confidence,
    predictedHomeGoals: intHomeGoals,
    predictedAwayGoals: intAwayGoals,
    insights
  };
}

export async function savePrediction(
  matchId: string,
  prediction: {
    predictedResult: 'H' | 'A' | 'D';
    confidence: number;
    predictedHomeGoals: number;
    predictedAwayGoals: number;
  }
): Promise<void> {
  // TODO: Implement prediction saving to local storage or API
  // For now, just log the prediction
  console.log('Saving prediction:', { matchId, prediction });
}