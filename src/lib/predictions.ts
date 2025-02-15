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

export async function predictMatch(homeTeam: string, awayTeam: string): Promise<{
  predictedResult: 'H' | 'A' | 'D';
  confidence: number;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
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

  if (!homeStats || !awayStats || !homeForm || !awayForm) {
    throw new Error('Unable to get team statistics');
  }

  // Simple prediction logic based on team statistics
  const homeAdvantage = 1.2; // Home team typically scores more
  const predictedHomeGoals = Math.round(homeStats.avgGoalsScored * homeAdvantage);
  const predictedAwayGoals = Math.round(awayStats.avgGoalsScored);

  let predictedResult: 'H' | 'A' | 'D';
  let confidence: number;

  if (predictedHomeGoals > predictedAwayGoals) {
    predictedResult = 'H';
    confidence = (homeStats.winPercentage / 100) * 0.7 + 
                (homeForm.avgRecentGoalsScored / (homeForm.avgRecentGoalsScored + awayForm.avgRecentGoalsScored)) * 0.3;
  } else if (predictedHomeGoals < predictedAwayGoals) {
    predictedResult = 'A';
    confidence = (awayStats.winPercentage / 100) * 0.7 +
                (awayForm.avgRecentGoalsScored / (homeForm.avgRecentGoalsScored + awayForm.avgRecentGoalsScored)) * 0.3;
  } else {
    predictedResult = 'D';
    confidence = 0.5;
  }

  return {
    predictedResult,
    confidence: Math.min(0.95, confidence), // Cap confidence at 95%
    predictedHomeGoals,
    predictedAwayGoals
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