import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Season = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
};

export type Match = {
  id: string;
  season_id: string;
  date: string;
  home_team: string;
  away_team: string;
  home_goals: number | null;
  away_goals: number | null;
  result: 'H' | 'A' | 'D' | null;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  first_half_home_goals: number | null;
  first_half_away_goals: number | null;
  full_time_result: 'H' | 'A' | 'D' | null;
  half_time_result: 'H' | 'A' | 'D' | null;
  referee: string | null;
  home_shots: number | null;
  away_shots: number | null;
  home_shots_target: number | null;
  away_shots_target: number | null;
  home_fouls: number | null;
  away_fouls: number | null;
  home_corners: number | null;
  away_corners: number | null;
  home_yellows: number | null;
  away_yellows: number | null;
  home_reds: number | null;
  away_reds: number | null;
  created_at: string;
};

// Fetch matches for a specific season
export async function getMatchesBySeason(seasonName: string) {
  try {
    const { data: season, error: seasonError } = await supabase
      .from('seasons')
      .select('id')
      .eq('name', seasonName)
      .single();

    if (seasonError) {
      console.error('Error fetching season:', seasonError);
      return [];
    }

    if (!season) {
      console.error('Season not found:', seasonName);
      return [];
    }

    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .eq('season_id', season.id)
      .order('date', { ascending: false });

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return [];
    }

    return matches as Match[];
  } catch (error) {
    console.error('Error in getMatchesBySeason:', error);
    return [];
  }
}

// Get current season matches
export async function getCurrentSeasonMatches() {
  try {
    // First try to get the season marked as current
    let { data: season, error: seasonError } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_current', true)
      .single();

    // If no current season is found, get the latest season by name
    if (!season) {
      const { data: latestSeason, error: latestSeasonError } = await supabase
        .from('seasons')
        .select('id')
        .order('name', { ascending: false })
        .limit(1)
        .single();

      if (latestSeasonError) {
        console.error('Error fetching latest season:', latestSeasonError);
        return [];
      }

      season = latestSeason;
    }

    if (!season) {
      console.error('No seasons found');
      return [];
    }

    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .eq('season_id', season.id)
      .order('date', { ascending: false });

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return [];
    }

    return matches as Match[];
  } catch (error) {
    console.error('Error in getCurrentSeasonMatches:', error);
    return [];
  }
}

// Get all seasons
export async function getAllSeasons() {
  const { data: seasons, error } = await supabase
    .from('seasons')
    .select('*')
    .order('name', { ascending: false });

  if (error) {
    console.error('Error fetching seasons:', error);
    return [];
  }

  return seasons as Season[];
}

export type TeamStats = {
  id: string;
  season_id: string;
  team_name: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  clean_sheets: number;
  failed_to_score: number;
  points: number;
  home_matches_played: number;
  home_wins: number;
  home_draws: number;
  home_losses: number;
  home_goals_for: number;
  home_goals_against: number;
  away_matches_played: number;
  away_wins: number;
  away_draws: number;
  away_losses: number;
  away_goals_for: number;
  away_goals_against: number;
  updated_at: string;
};

export type Prediction = {
  id: string;
  match_id: string;
  predicted_result: 'H' | 'A' | 'D';
  confidence_score: number;
  predicted_home_goals: number;
  predicted_away_goals: number;
  was_correct: boolean;
  prediction_date: string;
  created_at: string;
};

// Get team statistics for a season
export async function getTeamStats(seasonName: string, teamName: string) {
  const { data, error } = await supabase
    .from('team_stats')
    .select('*, seasons!inner(*)')
    .eq('seasons.name', seasonName)
    .eq('team_name', teamName)
    .single();

  if (error) {
    console.error('Error fetching team stats:', error);
    return null;
  }

  return data as TeamStats;
}

// Get team form (last N matches)
export async function getTeamForm(teamName: string, limit: number = 5) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .or(`home_team.eq.${teamName},away_team.eq.${teamName}`)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching team form:', error);
    return [];
  }

  return data.map(match => {
    const isHome = match.home_team === teamName;
    return {
      opponent: isHome ? match.away_team : match.home_team,
      goalsFor: isHome ? match.home_goals : match.away_goals,
      goalsAgainst: isHome ? match.away_goals : match.home_goals,
      result: isHome 
        ? match.result === 'H' ? 'W' : match.result === 'A' ? 'L' : 'D'
        : match.result === 'A' ? 'W' : match.result === 'H' ? 'L' : 'D',
      date: match.date
    };
  });
}

// Insert a new match
export async function insertMatch(match: Omit<Match, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('matches')
    .insert([match])
    .select()
    .single();

  if (error) {
    console.error('Error inserting match:', error);
    return null;
  }

  return data;
}

// Insert a prediction
export async function insertPrediction(prediction: Omit<Prediction, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('predictions')
    .insert([prediction])
    .select()
    .single();

  if (error) {
    console.error('Error inserting prediction:', error);
    return null;
  }

  return data;
}

// Get prediction accuracy for a season
export async function getPredictionAccuracy(seasonName: string) {
  try {
    const { data: season, error: seasonError } = await supabase
      .from('seasons')
      .select('id')
      .eq('name', seasonName)
      .single();

    if (seasonError || !season) {
      console.error('Season not found:', seasonName);
      return null;
    }

    const { data, error } = await supabase
      .from('predictions')
      .select('*, matches!inner(*)')
      .eq('matches.season_id', season.id);

    if (error) {
      console.error('Error fetching predictions:', error);
      return null;
    }

    const total = data.length;
    const correct = data.filter(p => p.was_correct).length;
    
    return {
      total,
      correct,
      accuracy: total > 0 ? (correct / total) * 100 : 0
    };
  } catch (error) {
    console.error('Error in getPredictionAccuracy:', error);
    return null;
  }
}