import { supabase } from './supabase';
import type { Match } from './supabase';

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
  const { data, error } = await supabase
    .from('match_statistics_view')
    .select('*')
    .eq('team', team)
    .single();

  if (error) {
    console.error('Error fetching team stats:', error);
    return null;
  }

  return {
    team: data.team,
    avgGoalsScored: data.avg_goals_scored,
    avgGoalsConceded: data.avg_goals_conceded,
    totalMatches: data.total_matches,
    totalWins: data.total_wins,
    totalDraws: data.total_draws,
    totalLosses: data.total_losses,
    winPercentage: data.win_percentage
  };
}

export async function getTeamForm(team: string): Promise<TeamForm | null> {
  const { data, error } = await supabase
    .from('team_form_view')
    .select('*')
    .eq('team', team)
    .single();

  if (error) {
    console.error('Error fetching team form:', error);
    return null;
  }

  return {
    team: data.team,
    form: data.form,
    avgRecentGoalsScored: data.avg_recent_goals_scored,
    avgRecentGoalsConceded: data.avg_recent_goals_conceded
  };
}

export async function getHeadToHeadRecord(homeTeam: string, awayTeam: string): Promise<HeadToHeadRecord> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .or(`and(home_team.eq.${homeTeam},away_team.eq.${awayTeam}),and(home_team.eq.${awayTeam},away_team.eq.${homeTeam})`)
    .order('date', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching head to head records:', error);
    return { matches: 0, homeWins: 0, draws: 0, awayWins: 0 };
  }

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  data.forEach(match => {
    if (match.home_team === homeTeam && match.away_team === awayTeam) {
      if (match.result === 'H') homeWins++;
      else if (match.result === 'D') draws++;
      else if (match.result === 'A') awayWins++;
    } else {
      // Reversed match
      if (match.result === 'H') awayWins++;
      else if (match.result === 'D') draws++;
      else if (match.result === 'A') homeWins++;
    }
  });

  return {
    matches: data.length,
    homeWins,
    draws,
    awayWins
  };
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
  const { error } = await supabase
    .from('predictions')
    .insert([{
      match_id: matchId,
      predicted_result: prediction.predictedResult,
      confidence_score: prediction.confidence,
      predicted_home_goals: prediction.predictedHomeGoals,
      predicted_away_goals: prediction.predictedAwayGoals,
      was_correct: false // Will be updated after the match
    }]);

  if (error) {
    console.error('Error saving prediction:', error);
    throw error;
  }
}