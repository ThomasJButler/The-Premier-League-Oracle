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
  totalHomeGoals: number;
  totalAwayGoals: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  homeCleanSheets: number;
  awayCleanSheets: number;
  bothTeamsScored: number;
  over25: number;
  recentForm: { home: string; away: string }; // Last 3 H2H results
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
    let totalHomeGoals = 0;
    let totalAwayGoals = 0;
    let homeCleanSheets = 0;
    let awayCleanSheets = 0;
    let bothTeamsScored = 0;
    let over25 = 0;
    let recentFormHome = '';
    let recentFormAway = '';

    h2hMatches.forEach((match, index) => {
      if (match.result && match.home_goals !== null && match.away_goals !== null) {
        const isNormalOrientation = match.home_team === homeTeam && match.away_team === awayTeam;
        
        if (isNormalOrientation) {
          // Normal orientation: homeTeam at home
          totalHomeGoals += match.home_goals;
          totalAwayGoals += match.away_goals;
          
          if (match.result === 'H') {
            homeWins++;
            if (index < 3) recentFormHome += 'W';
          } else if (match.result === 'D') {
            draws++;
            if (index < 3) {
              recentFormHome += 'D';
              recentFormAway += 'D';
            }
          } else if (match.result === 'A') {
            awayWins++;
            if (index < 3) recentFormAway += 'W';
          }
          
          if (match.away_goals === 0) homeCleanSheets++;
          if (match.home_goals === 0) awayCleanSheets++;
        } else {
          // Reversed: awayTeam at home vs homeTeam away
          totalHomeGoals += match.away_goals; // Our home team scored as away
          totalAwayGoals += match.home_goals; // Our away team scored as home
          
          if (match.result === 'H') {
            awayWins++;
            if (index < 3) recentFormAway += 'W';
          } else if (match.result === 'D') {
            draws++;
            if (index < 3) {
              recentFormHome += 'D';
              recentFormAway += 'D';
            }
          } else if (match.result === 'A') {
            homeWins++;
            if (index < 3) recentFormHome += 'W';
          }
          
          if (match.home_goals === 0) homeCleanSheets++;
          if (match.away_goals === 0) awayCleanSheets++;
        }
        
        // Common stats
        if (match.home_goals > 0 && match.away_goals > 0) bothTeamsScored++;
        if (match.home_goals + match.away_goals > 2.5) over25++;
      }
    });

    const validMatches = h2hMatches.filter(m => m.home_goals !== null && m.away_goals !== null).length;

    return {
      matches: h2hMatches.length,
      homeWins,
      draws,
      awayWins,
      totalHomeGoals,
      totalAwayGoals,
      avgHomeGoals: validMatches > 0 ? totalHomeGoals / validMatches : 0,
      avgAwayGoals: validMatches > 0 ? totalAwayGoals / validMatches : 0,
      homeCleanSheets,
      awayCleanSheets,
      bothTeamsScored,
      over25,
      recentForm: { home: recentFormHome, away: recentFormAway }
    };
  } catch (error) {
    console.error('Error fetching head to head records:', error);
    return { 
      matches: 0, homeWins: 0, draws: 0, awayWins: 0,
      totalHomeGoals: 0, totalAwayGoals: 0, avgHomeGoals: 0, avgAwayGoals: 0,
      homeCleanSheets: 0, awayCleanSheets: 0, bothTeamsScored: 0, over25: 0,
      recentForm: { home: '', away: '' }
    };
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

  // Get head-to-head record with detailed stats
  const h2h = await getHeadToHeadRecord(homeTeam, awayTeam);

  if (!homeStats || !awayStats || !homeForm || !awayForm) {
    throw new Error('Unable to get team statistics');
  }

  // === ENHANCED PREDICTION ALGORITHM ===
  
  // Weight distribution for different factors
  const WEIGHTS = {
    h2h: 0.30,        // 30% - Head-to-head history
    currentForm: 0.25, // 25% - Current form (last 5 matches)
    seasonStats: 0.20, // 20% - Overall season statistics
    homeAdvantage: 0.15, // 15% - Home advantage factor
    formTrend: 0.10    // 10% - Form trajectory
  };

  // 1. Calculate base predictions from season averages
  const leagueAvgHome = 1.5; // Average home goals in Premier League
  const leagueAvgAway = 1.2; // Average away goals in Premier League
  
  let baseHomeGoals = homeStats.avgGoalsScored * 0.6 + leagueAvgHome * 0.4;
  let baseAwayGoals = awayStats.avgGoalsScored * 0.6 + leagueAvgAway * 0.4;
  
  // 2. Head-to-Head adjustment (30% weight)
  let h2hHomeGoals = baseHomeGoals;
  let h2hAwayGoals = baseAwayGoals;
  
  if (h2h.matches >= 3) {
    // Use H2H averages if we have enough data
    h2hHomeGoals = h2h.avgHomeGoals * WEIGHTS.h2h + baseHomeGoals * (1 - WEIGHTS.h2h);
    h2hAwayGoals = h2h.avgAwayGoals * WEIGHTS.h2h + baseAwayGoals * (1 - WEIGHTS.h2h);
    
    // Additional H2H pattern adjustments
    if (h2h.homeWins > h2h.matches * 0.6) {
      h2hHomeGoals *= 1.1; // Home team dominates this fixture
    }
    if (h2h.awayWins > h2h.matches * 0.4) {
      h2hAwayGoals *= 1.1; // Away team performs well in this fixture
    }
  }
  
  // 3. Current form adjustment (25% weight)
  const homeFormMultiplier = homeForm.avgRecentGoalsScored > 0 ? 
    (homeForm.avgRecentGoalsScored / homeStats.avgGoalsScored) : 1;
  const awayFormMultiplier = awayForm.avgRecentGoalsScored > 0 ? 
    (awayForm.avgRecentGoalsScored / awayStats.avgGoalsScored) : 1;
  
  // 4. Form trajectory analysis (10% weight)
  const homeFormTrend = analyzeFormTrend(homeForm.form);
  const awayFormTrend = analyzeFormTrend(awayForm.form);
  
  // 5. Defensive analysis
  const homeDefensiveFactor = awayStats.avgGoalsConceded / leagueAvgAway;
  const awayDefensiveFactor = homeStats.avgGoalsConceded / leagueAvgHome;
  
  // 6. Calculate weighted predictions
  let predictedHomeGoals = 
    h2hHomeGoals * WEIGHTS.h2h +
    (baseHomeGoals * homeFormMultiplier) * WEIGHTS.currentForm +
    (homeStats.avgGoalsScored * awayDefensiveFactor) * WEIGHTS.seasonStats +
    (baseHomeGoals * 1.3) * WEIGHTS.homeAdvantage + // Home advantage boost
    (baseHomeGoals * homeFormTrend) * WEIGHTS.formTrend;
    
  let predictedAwayGoals = 
    h2hAwayGoals * WEIGHTS.h2h +
    (baseAwayGoals * awayFormMultiplier) * WEIGHTS.currentForm +
    (awayStats.avgGoalsScored * homeDefensiveFactor) * WEIGHTS.seasonStats +
    (baseAwayGoals * 0.9) * WEIGHTS.homeAdvantage + // Away disadvantage
    (baseAwayGoals * awayFormTrend) * WEIGHTS.formTrend;
  
  // 7. Apply statistical corrections
  // Regression to mean for extreme predictions
  if (predictedHomeGoals > 4) predictedHomeGoals = 4 + (predictedHomeGoals - 4) * 0.3;
  if (predictedAwayGoals > 3.5) predictedAwayGoals = 3.5 + (predictedAwayGoals - 3.5) * 0.3;
  if (predictedHomeGoals < 0.5) predictedHomeGoals = 0.5;
  if (predictedAwayGoals < 0.3) predictedAwayGoals = 0.3;
  
  // Round for final predictions
  const intHomeGoals = Math.round(predictedHomeGoals);
  const intAwayGoals = Math.round(predictedAwayGoals);
  
  // 8. Determine result and confidence
  let predictedResult: 'H' | 'A' | 'D';
  let baseConfidence: number;
  
  const goalDifference = predictedHomeGoals - predictedAwayGoals;
  
  if (goalDifference > 0.5) {
    predictedResult = 'H';
    baseConfidence = 0.5 + Math.min(goalDifference * 0.15, 0.3);
  } else if (goalDifference < -0.5) {
    predictedResult = 'A';
    baseConfidence = 0.5 + Math.min(Math.abs(goalDifference) * 0.15, 0.3);
  } else {
    predictedResult = 'D';
    baseConfidence = 0.35 + Math.min(0.5 - Math.abs(goalDifference), 0.2);
  }
  
  // 9. Adjust confidence based on data quality and consistency
  let confidence = baseConfidence;
  
  // H2H consistency check
  if (h2h.matches >= 5) {
    const h2hConsistency = calculateH2HConsistency(h2h, predictedResult);
    confidence = confidence * 0.6 + h2hConsistency * 0.4;
  }
  
  // Form consistency check
  if (homeForm.form.length >= 3 && awayForm.form.length >= 3) {
    const formConsistency = calculateFormConsistency(homeForm.form, awayForm.form, predictedResult);
    confidence = confidence * 0.8 + formConsistency * 0.2;
  }
  
  // Cap confidence — unified with OptimizedPredictor [0.25, 0.95]
  confidence = Math.max(0.25, Math.min(0.95, confidence));
  
  // 10. Generate detailed insights
  const insights: string[] = [];
  
  // H2H insights
  if (h2h.matches >= 3) {
    insights.push(`Last ${h2h.matches} H2H: ${homeTeam} ${h2h.homeWins}W-${h2h.draws}D-${h2h.awayWins}L (${h2h.avgHomeGoals.toFixed(1)}-${h2h.avgAwayGoals.toFixed(1)} avg goals)`);
    
    if (h2h.bothTeamsScored > h2h.matches * 0.7) {
      insights.push(`Both teams scored in ${Math.round(h2h.bothTeamsScored / h2h.matches * 100)}% of recent H2H matches`);
    }
    
    if (h2h.over25 > h2h.matches * 0.6) {
      insights.push(`${Math.round(h2h.over25 / h2h.matches * 100)}% of H2H matches had over 2.5 goals`);
    }
  }
  
  // Form insights
  if (homeFormTrend > 1.1) {
    insights.push(`${homeTeam} showing improving form (${homeForm.form.slice(0, 5)})`);
  } else if (homeFormTrend < 0.9) {
    insights.push(`${homeTeam} in declining form (${homeForm.form.slice(0, 5)})`);
  }
  
  if (awayFormTrend > 1.1) {
    insights.push(`${awayTeam} showing improving form (${awayForm.form.slice(0, 5)})`);
  } else if (awayFormTrend < 0.9) {
    insights.push(`${awayTeam} in declining form (${awayForm.form.slice(0, 5)})`);
  }
  
  // Statistical insights
  if (homeStats.winPercentage > 70) {
    insights.push(`${homeTeam} has won ${homeStats.winPercentage.toFixed(0)}% of matches this season`);
  }
  
  if (awayStats.winPercentage > 50 && awayStats.totalMatches >= 5) {
    insights.push(`${awayTeam} strong away record: ${awayStats.winPercentage.toFixed(0)}% win rate`);
  }

  return {
    predictedResult,
    confidence,
    predictedHomeGoals: intHomeGoals,
    predictedAwayGoals: intAwayGoals,
    insights
  };
}

// Helper function to analyze form trend
function analyzeFormTrend(form: string): number {
  if (form.length < 3) return 1.0;
  
  const recent = form.slice(0, 3);
  const older = form.slice(3, 6);
  
  const recentPoints = (recent.match(/W/g) || []).length * 3 + (recent.match(/D/g) || []).length;
  const olderPoints = older.length > 0 ? 
    (older.match(/W/g) || []).length * 3 + (older.match(/D/g) || []).length : recentPoints;
  
  if (olderPoints === 0) return 1.0;
  return Math.min(1.5, Math.max(0.5, recentPoints / olderPoints));
}

// Helper function to calculate H2H consistency
function calculateH2HConsistency(h2h: HeadToHeadRecord, prediction: 'H' | 'A' | 'D'): number {
  if (h2h.matches === 0) return 0.5;
  
  const total = h2h.homeWins + h2h.draws + h2h.awayWins;
  if (prediction === 'H') return h2h.homeWins / total;
  if (prediction === 'A') return h2h.awayWins / total;
  return h2h.draws / total;
}

// Helper function to calculate form consistency
function calculateFormConsistency(homeForm: string, awayForm: string, prediction: 'H' | 'A' | 'D'): number {
  const homeWins = (homeForm.match(/W/g) || []).length;
  const awayWins = (awayForm.match(/W/g) || []).length;
  const homeDraws = (homeForm.match(/D/g) || []).length;
  const awayDraws = (awayForm.match(/D/g) || []).length;
  
  if (prediction === 'H') {
    return (homeWins * 2 + homeDraws) / (homeForm.length * 2 + 0.1);
  }
  if (prediction === 'A') {
    return (awayWins * 2 + awayDraws) / (awayForm.length * 2 + 0.1);
  }
  return (homeDraws + awayDraws) / (homeForm.length + awayForm.length + 0.1);
}
