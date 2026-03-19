import { dataService } from '../services/dataService';
import type { Match } from '../types';
import { VALUE_ODDS_MARGIN, DEFAULT_HOME_WIN_RATE } from './constants';

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
    maxGoals: number = 7
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

// ELO Rating System — single source of truth for team strength
// Ratings persist to localStorage and update dynamically from completed match results.
export class EloRatingSystem {
  static readonly K_FACTOR = 32; // Sensitivity of rating changes
  static readonly HOME_ADVANTAGE = 65; // Average home advantage in ELO points
  static readonly DEFAULT_RATING = 1500; // Default ELO rating for new teams
  private static readonly STORAGE_KEY = 'elo_ratings';
  private static readonly PROCESSED_KEY = 'elo_processed_match_ids';

  private teamRatings: Map<string, number> = new Map();
  private processedMatchIds: Set<string> = new Set();

  // Default seed ratings — used only when no localStorage data exists.
  // Keyed by canonical Football-Data.org names (with FC suffix).
  private static readonly SEED_RATINGS: Record<string, number> = {
    'Manchester City FC': 1850,
    'Arsenal FC': 1800,
    'Liverpool FC': 1780,
    'Manchester United FC': 1700,
    'Chelsea FC': 1680,
    'Tottenham Hotspur FC': 1650,
    'Newcastle United FC': 1620,
    'Brighton & Hove Albion FC': 1580,
    'Aston Villa FC': 1560,
    'West Ham United FC': 1540,
    'Brentford FC': 1520,
    'Fulham FC': 1500,
    'Crystal Palace FC': 1480,
    'Wolverhampton Wanderers FC': 1460,
    'Everton FC': 1440,
    'Nottingham Forest FC': 1420,
    'AFC Bournemouth': 1400,
    'Leicester City FC': 1380,
    'Leeds United FC': 1360,
    'Southampton FC': 1340,
    'Ipswich Town FC': 1320,
    'Sunderland AFC': 1310,
    'Luton Town FC': 1300,
    'Burnley FC': 1290,
    'Sheffield United FC': 1280,
  };

  // Short-name aliases → canonical name for fuzzy lookup
  private static readonly ALIASES: Record<string, string> = {
    'manchester city': 'Manchester City FC',
    'man city': 'Manchester City FC',
    'arsenal': 'Arsenal FC',
    'liverpool': 'Liverpool FC',
    'manchester united': 'Manchester United FC',
    'man united': 'Manchester United FC',
    'man utd': 'Manchester United FC',
    'chelsea': 'Chelsea FC',
    'tottenham hotspur': 'Tottenham Hotspur FC',
    'tottenham': 'Tottenham Hotspur FC',
    'spurs': 'Tottenham Hotspur FC',
    'newcastle united': 'Newcastle United FC',
    'newcastle': 'Newcastle United FC',
    'brighton & hove albion': 'Brighton & Hove Albion FC',
    'brighton': 'Brighton & Hove Albion FC',
    'aston villa': 'Aston Villa FC',
    'west ham united': 'West Ham United FC',
    'west ham': 'West Ham United FC',
    'brentford': 'Brentford FC',
    'fulham': 'Fulham FC',
    'crystal palace': 'Crystal Palace FC',
    'wolverhampton wanderers': 'Wolverhampton Wanderers FC',
    'wolves': 'Wolverhampton Wanderers FC',
    'everton': 'Everton FC',
    'nottingham forest': 'Nottingham Forest FC',
    'nottm forest': 'Nottingham Forest FC',
    'afc bournemouth': 'AFC Bournemouth',
    'bournemouth': 'AFC Bournemouth',
    'leicester city': 'Leicester City FC',
    'leicester': 'Leicester City FC',
    'leeds united': 'Leeds United FC',
    'leeds': 'Leeds United FC',
    'southampton': 'Southampton FC',
    'ipswich town': 'Ipswich Town FC',
    'ipswich': 'Ipswich Town FC',
    'sunderland afc': 'Sunderland AFC',
    'sunderland': 'Sunderland AFC',
    'luton town': 'Luton Town FC',
    'luton': 'Luton Town FC',
    'burnley': 'Burnley FC',
    'sheffield united': 'Sheffield United FC',
  };

  constructor() {
    this.loadFromStorage();
  }

  /** Load persisted ratings from localStorage, falling back to seed values. */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(EloRatingSystem.STORAGE_KEY);
      if (stored) {
        const parsed: Record<string, number> = JSON.parse(stored);
        this.teamRatings = new Map(Object.entries(parsed));
      } else {
        // First run — seed with defaults
        this.teamRatings = new Map(Object.entries(EloRatingSystem.SEED_RATINGS));
        this.saveToStorage();
      }

      const processedIds = localStorage.getItem(EloRatingSystem.PROCESSED_KEY);
      if (processedIds) {
        this.processedMatchIds = new Set(JSON.parse(processedIds));
      }
    } catch {
      // localStorage unavailable (SSR or test) — use seed ratings
      this.teamRatings = new Map(Object.entries(EloRatingSystem.SEED_RATINGS));
    }
  }

  /** Persist current ratings to localStorage. */
  saveToStorage(): void {
    try {
      const obj: Record<string, number> = {};
      this.teamRatings.forEach((rating, team) => { obj[team] = Math.round(rating); });
      localStorage.setItem(EloRatingSystem.STORAGE_KEY, JSON.stringify(obj));
      localStorage.setItem(
        EloRatingSystem.PROCESSED_KEY,
        JSON.stringify([...this.processedMatchIds])
      );
    } catch {
      // localStorage unavailable — silently continue
    }
  }

  /** Resolve a team name to its canonical form, or return as-is if unrecognised. */
  private resolveTeamName(name: string): string {
    // Exact match on existing ratings
    if (this.teamRatings.has(name)) return name;

    // Try alias lookup (case-insensitive)
    const lower = name.toLowerCase();
    const canonical = EloRatingSystem.ALIASES[lower];
    if (canonical) return canonical;

    // Try partial match against existing rating keys
    for (const key of this.teamRatings.keys()) {
      if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
        return key;
      }
    }

    return name;
  }

  setTeamRating(teamName: string, rating: number): void {
    const resolved = this.resolveTeamName(teamName);
    this.teamRatings.set(resolved, rating);
  }

  getTeamRating(teamName: string): number {
    const resolved = this.resolveTeamName(teamName);
    return this.teamRatings.get(resolved) ?? EloRatingSystem.DEFAULT_RATING;
  }

  /** Get all current ratings as a plain object (useful for debugging / display). */
  getAllRatings(): Record<string, number> {
    const result: Record<string, number> = {};
    this.teamRatings.forEach((rating, team) => { result[team] = Math.round(rating); });
    return result;
  }

  /** Get a copy of all processed match IDs (for snapshotting before backtests). */
  getProcessedMatchIds(): Set<string> {
    return new Set(this.processedMatchIds);
  }

  /** Replace the processed match IDs set (for restoring after backtests). */
  setProcessedMatchIds(ids: Set<string>): void {
    this.processedMatchIds = new Set(ids);
  }

  calculateWinProbability(homeRating: number, awayRating: number): number {
    return 1 / (1 + Math.pow(10, (awayRating - homeRating) / 400));
  }

  static calculateExpectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  updateRatings(
    homeTeam: string,
    awayTeam: string,
    actualResult: 'H' | 'D' | 'A'
  ): { newHomeRating: number; newAwayRating: number } {
    const homeResolved = this.resolveTeamName(homeTeam);
    const awayResolved = this.resolveTeamName(awayTeam);
    const homeRating = this.getTeamRating(homeResolved);
    const awayRating = this.getTeamRating(awayResolved);

    const { newHomeRating, newAwayRating } = EloRatingSystem.updateRatings(homeRating, awayRating, actualResult);

    this.teamRatings.set(homeResolved, newHomeRating);
    this.teamRatings.set(awayResolved, newAwayRating);

    return { newHomeRating, newAwayRating };
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

  /**
   * Process an array of completed matches chronologically to update ELO ratings.
   * Skips matches already processed (idempotent). Persists to localStorage when done.
   */
  processCompletedMatches(matches: Match[]): number {
    // Sort chronologically so ratings evolve in the correct order
    const sorted = [...matches]
      .filter(m => m.result && m.status === 'FINISHED')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let processed = 0;
    for (const match of sorted) {
      if (this.processedMatchIds.has(match.id)) continue;

      this.updateRatings(match.home_team, match.away_team, match.result!);
      this.processedMatchIds.add(match.id);
      processed++;
    }

    if (processed > 0) {
      this.saveToStorage();
    }

    return processed;
  }
}

// Fixture Congestion & Fatigue Analysis
export class FatigueAnalyzer {
  static async calculateRestDays(teamName: string, matchDate: Date, allMatches?: Match[]): Promise<number> {
    try {
      const matches = allMatches ?? await dataService.getMatches();
      const teamMatches = matches.filter(match =>
        (match.home_team === teamName || match.away_team === teamName) &&
        new Date(match.date) < matchDate
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (teamMatches.length === 0) return 7; // Default rest days
      const lastMatch = new Date(teamMatches[0].date);
      return Math.floor((matchDate.getTime() - lastMatch.getTime()) / (1000 * 60 * 60 * 24));
    } catch (error) {
      // Error calculating rest days
      return 7;
    }
  }

  static getFatigueMultiplier(restDays: number, recentFixtures: number): number {
    // Less rest = more fatigue = worse performance
    // Floor restDays at 0.5 (12 hours) to prevent zero multiplier causing division-by-zero
    const restFactor = Math.min(Math.max(restDays, 0.5) / 7, 1); // Optimal rest is 7+ days
    const fixtureFactor = Math.max(1 - (recentFixtures - 1) * 0.1, 0.6); // Each extra fixture reduces performance

    return restFactor * fixtureFactor;
  }
}

// Shared ELO system instance — used by both AdvancedMatchPredictor and OptimizedPredictor
export const sharedEloSystem = new EloRatingSystem();

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
    // Fetch all matches once — used for fatigue, league averages, and insights
    const allMatches = await dataService.getMatches();

    // 1. Get team ratings from the shared ELO system
    const homeRating = sharedEloSystem.getTeamRating(homeTeam);
    const awayRating = sharedEloSystem.getTeamRating(awayTeam);

    // 2. Calculate rest days and fatigue (pass matches to avoid redundant fetches)
    const [homeRestDays, awayRestDays] = await Promise.all([
      FatigueAnalyzer.calculateRestDays(homeTeam, matchDate, allMatches),
      FatigueAnalyzer.calculateRestDays(awayTeam, matchDate, allMatches)
    ]);

    const homeFatigue = FatigueAnalyzer.getFatigueMultiplier(homeRestDays, 1);
    const awayFatigue = FatigueAnalyzer.getFatigueMultiplier(awayRestDays, 1);

    // 3. Adjust ratings for fatigue
    const adjustedHomeRating = homeRating * homeFatigue;
    const adjustedAwayRating = awayRating * awayFatigue;

    // 4. Calculate expected goals using adjusted ratings and real league averages
    const ratingDiff = (adjustedHomeRating + EloRatingSystem['HOME_ADVANTAGE'] - adjustedAwayRating) / 100;

    // Derive league average goals from completed matches (fallback: 1.5 / 1.2)
    const completed = allMatches.filter(m => m.result && m.home_goals !== null && m.away_goals !== null);
    let baseHomeGoals = 1.5;
    let baseAwayGoals = 1.2;
    if (completed.length > 0) {
      baseHomeGoals = completed.reduce((sum, m) => sum + m.home_goals!, 0) / completed.length;
      baseAwayGoals = completed.reduce((sum, m) => sum + m.away_goals!, 0) / completed.length;
    }

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

    // 7. Value betting — derive fair odds from model probabilities (no hardcoded bookmaker odds)
    const fairOdds = {
      home: outcomes.homeWin > 0 ? (1 / outcomes.homeWin) * VALUE_ODDS_MARGIN : 10.0,
      draw: outcomes.draw > 0 ? (1 / outcomes.draw) * VALUE_ODDS_MARGIN : 4.0,
      away: outcomes.awayWin > 0 ? (1 / outcomes.awayWin) * VALUE_ODDS_MARGIN : 10.0,
    };
    // Without real bookmaker odds, value bets are empty — model odds ≈ fair odds by definition
    const valueBets: Array<{ outcome: string; odds: number; expectedValue: number }> = [];

    // 8. Generate insights
    const insights: string[] = [];
    
    if (homeRestDays < 3) {
      insights.push(`${homeTeam} has only ${homeRestDays} days rest - fatigue could be a factor`);
    }
    if (awayRestDays < 3) {
      insights.push(`${awayTeam} has only ${awayRestDays} days rest - fatigue could be a factor`);
    }
    if (ratingDiff > 2) {
      insights.push(`Significant quality gap - ${homeTeam} rated ${Math.abs(ratingDiff * 100).toFixed(0)} points higher`);
    }
    // Fair odds derived from model — shown for reference
    insights.push(`Fair odds: H ${fairOdds.home.toFixed(2)} / D ${fairOdds.draw.toFixed(2)} / A ${fairOdds.away.toFixed(2)}`);

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
    try {
      const matches = await dataService.getMatches();
      const refereeMatches = matches.filter(match => match.referee === refereeName);

      if (refereeMatches.length === 0) {
        return { avgYellowCards: 4, avgRedCards: 0.1, avgPenalties: 0.2, homeWinRate: DEFAULT_HOME_WIN_RATE };
      }

      const totalMatches = refereeMatches.length;
      const totalYellows = refereeMatches.reduce((sum: number, m: Match) => sum + (m.home_yellows || 0) + (m.away_yellows || 0), 0);
      const totalReds = refereeMatches.reduce((sum: number, m: Match) => sum + (m.home_reds || 0) + (m.away_reds || 0), 0);
      const homeWins = refereeMatches.filter(m => m.result === 'H').length;

      return {
        avgYellowCards: totalYellows / totalMatches,
        avgRedCards: totalReds / totalMatches,
        avgPenalties: 0.2, // Placeholder - would need penalty data
        homeWinRate: homeWins / totalMatches
      };
    } catch (error) {
      // Error getting referee stats
      return { avgYellowCards: 4, avgRedCards: 0.1, avgPenalties: 0.2, homeWinRate: DEFAULT_HOME_WIN_RATE };
    }
  }
}