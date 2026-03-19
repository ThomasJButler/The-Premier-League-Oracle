import { dataService } from '../services/dataService';
import type { Match, Standing, MLPrediction } from '../types';
import { BackendUnavailableError } from '../types';
import { EloRatingSystem, PoissonPredictor, FatigueAnalyzer, RefereeAnalyzer, sharedEloSystem } from './advancedPredictions';
import { backendService } from '../services/backendService';
import { VALUE_ODDS_MARGIN, DEFAULT_HOME_WIN_RATE } from './constants';

export interface EnhancedPredictionModel {
  predictedResult: 'H' | 'D' | 'A';
  confidence: number;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  homeForm: string;
  awayForm: string;
  modelWeights: {
    elo: number;
    poisson: number;
    form: number;
    h2h: number;
    standings: number;
    ml?: number;
  };
  insights: string[];
  valueOdds?: {
    home: number;
    draw: number;
    away: number;
  };
}

// Home/away attack & defence strengths for the Poisson model
interface TeamStrengths {
  homeAttack: number;   // Goals scored at home relative to league average
  homeDefence: number;  // Goals conceded at home relative to league average
  awayAttack: number;   // Goals scored away relative to league average
  awayDefence: number;  // Goals conceded away relative to league average
}

// League-wide averages derived from completed matches
interface LeagueAverages {
  avgHomeGoals: number; // Average goals scored by home teams per match
  avgAwayGoals: number; // Average goals scored by away teams per match
  homeWinRate: number;  // Proportion of completed matches won by the home side
  teamStrengths: Map<string, TeamStrengths>;
}

/**
 * Single source of truth for ensemble model weights.
 * Used by combineModels() for computation and returned in predictions for transparency.
 * If you change these, the actual model behaviour AND reported weights stay in sync.
 */
const MODEL_WEIGHTS = {
  elo: 0.25,
  poisson: 0.30,
  form: 0.20,
  h2h: 0.10,
  standings: 0.15
} as const;

/**
 * When the ML backend contributes to the ensemble, it gets this weight and
 * the TypeScript model weights are scaled down proportionally. A 30% ML weight
 * means the Python models contribute nearly a third of the final prediction.
 */
const ML_BACKEND_WEIGHT = 0.30;

export class OptimizedPredictor {
  // Use the shared ELO system — single source of truth for team ratings
  private static eloSystem = sharedEloSystem;

  /**
   * Compute league averages and per-team attack/defence strengths from completed matches.
   * This is the foundation of the Dixon-Coles Poisson model.
   */
  private static computeLeagueAverages(matches: Match[]): LeagueAverages {
    const completed = matches.filter(m => m.result && m.home_goals !== null && m.away_goals !== null);

    if (completed.length === 0) {
      return { avgHomeGoals: 1.5, avgAwayGoals: 1.2, homeWinRate: DEFAULT_HOME_WIN_RATE, teamStrengths: new Map() };
    }

    // League totals
    let totalHomeGoals = 0;
    let totalAwayGoals = 0;

    // Per-team accumulators
    const teamHome = new Map<string, { scored: number; conceded: number; matches: number }>();
    const teamAway = new Map<string, { scored: number; conceded: number; matches: number }>();

    for (const m of completed) {
      const hg = m.home_goals!;
      const ag = m.away_goals!;
      totalHomeGoals += hg;
      totalAwayGoals += ag;

      // Home team stats
      const h = teamHome.get(m.home_team) ?? { scored: 0, conceded: 0, matches: 0 };
      h.scored += hg;
      h.conceded += ag;
      h.matches += 1;
      teamHome.set(m.home_team, h);

      // Away team stats
      const a = teamAway.get(m.away_team) ?? { scored: 0, conceded: 0, matches: 0 };
      a.scored += ag;
      a.conceded += hg;
      a.matches += 1;
      teamAway.set(m.away_team, a);
    }

    const avgHomeGoals = totalHomeGoals / completed.length;
    const avgAwayGoals = totalAwayGoals / completed.length;
    const homeWinRate = completed.filter(m => m.result === 'H').length / completed.length;

    // Compute per-team strengths relative to league average
    const teamStrengths = new Map<string, TeamStrengths>();
    const allTeams = new Set([...teamHome.keys(), ...teamAway.keys()]);

    for (const team of allTeams) {
      const home = teamHome.get(team);
      const away = teamAway.get(team);

      teamStrengths.set(team, {
        homeAttack: home && home.matches >= 3
          ? (home.scored / home.matches) / avgHomeGoals
          : 1.0,
        homeDefence: home && home.matches >= 3
          ? (home.conceded / home.matches) / avgAwayGoals
          : 1.0,
        awayAttack: away && away.matches >= 3
          ? (away.scored / away.matches) / avgAwayGoals
          : 1.0,
        awayDefence: away && away.matches >= 3
          ? (away.conceded / away.matches) / avgHomeGoals
          : 1.0,
      });
    }

    return { avgHomeGoals, avgAwayGoals, homeWinRate, teamStrengths };
  }

  /**
   * Calculate Poisson lambda values using the Dixon-Coles approach.
   *
   * λ_home = home_attack × away_defence × league_avg_home_goals
   * λ_away = away_attack × home_defence × league_avg_away_goals
   *
   * Falls back to ELO-derived estimates when insufficient match data exists.
   */
  private static calculatePoissonLambdas(
    homeTeam: string,
    awayTeam: string,
    leagueAvgs: LeagueAverages,
    homeStats: { avgGoalsScored: number; avgGoalsConceded: number },
    awayStats: { avgGoalsScored: number; avgGoalsConceded: number }
  ): { lambdaHome: number; lambdaAway: number } {
    const homeStrengths = leagueAvgs.teamStrengths.get(homeTeam);
    const awayStrengths = leagueAvgs.teamStrengths.get(awayTeam);

    if (homeStrengths && awayStrengths) {
      // Full Dixon-Coles: team strengths are relative to league average
      const lambdaHome = homeStrengths.homeAttack * awayStrengths.awayDefence * leagueAvgs.avgHomeGoals;
      const lambdaAway = awayStrengths.awayAttack * homeStrengths.homeDefence * leagueAvgs.avgAwayGoals;

      // Clamp to sensible range (0.3 – 4.5 goals)
      return {
        lambdaHome: Math.max(0.3, Math.min(4.5, lambdaHome)),
        lambdaAway: Math.max(0.3, Math.min(4.5, lambdaAway)),
      };
    }

    // Fallback: derive from overall stats (no home/away split available)
    const avgLeagueGoals = (leagueAvgs.avgHomeGoals + leagueAvgs.avgAwayGoals) / 2 || 1.35;
    const lambdaHome = (homeStats.avgGoalsScored / avgLeagueGoals) * (awayStats.avgGoalsConceded / avgLeagueGoals) * leagueAvgs.avgHomeGoals;
    const lambdaAway = (awayStats.avgGoalsScored / avgLeagueGoals) * (homeStats.avgGoalsConceded / avgLeagueGoals) * leagueAvgs.avgAwayGoals;

    return {
      lambdaHome: Math.max(0.3, Math.min(4.5, lambdaHome)),
      lambdaAway: Math.max(0.3, Math.min(4.5, lambdaAway)),
    };
  }

  /**
   * Main prediction method with enhanced algorithms
   */
  static async predictMatch(
    homeTeam: string,
    awayTeam: string,
    historicalMatches?: Match[],
    referee?: string | null,
    matchDate?: string
  ): Promise<EnhancedPredictionModel> {
    const insights: string[] = [];
    
    try {
      // 1. Get current standings and team positions
      // In backtest mode (historicalMatches provided), skip dataService.getStandings()
      // to avoid both stale data and per-match API overhead. ELO-derived positions are
      // a better proxy for historical standings anyway.
      let standings: Standing[] = [];
      let homePosition = 0;
      let awayPosition = 0;

      if (!historicalMatches) {
        try {
          standings = await dataService.getStandings();
          homePosition = standings.findIndex(s => s.team.name === homeTeam) + 1;
          awayPosition = standings.findIndex(s => s.team.name === awayTeam) + 1;
        } catch {
          // Falls through to ELO-derived positions below
        }
      }

      if (!homePosition || !awayPosition) {
        // Use ELO-derived positions as fallback (or primary in backtest mode)
        const allRatings = this.eloSystem.getAllRatings();
        const sortedTeams = Object.entries(allRatings).sort((a, b) => b[1] - a[1]);
        homePosition = sortedTeams.findIndex(([team]) => team === homeTeam) + 1;
        awayPosition = sortedTeams.findIndex(([team]) => team === awayTeam) + 1;
      }
      
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

      // 3. Calculate ELO ratings from shared system
      const homeElo = this.eloSystem.getTeamRating(homeTeam);
      const awayElo = this.eloSystem.getTeamRating(awayTeam);
      const eloWinProbability = this.eloSystem.calculateWinProbability(
        homeElo + EloRatingSystem.HOME_ADVANTAGE,
        awayElo
      );

      // 4. Fetch match data once — used for fatigue, Poisson, standings, referee
      let allMatches: Match[] = historicalMatches ?? [];
      if (!historicalMatches) {
        try {
          allMatches = await dataService.getMatches();
        } catch {
          // No match data available — fallback paths will handle empty array
        }
      }

      // 5. Calculate fatigue factor (needed before Poisson lambdas)
      // When backtesting with pre-fetched data, derive rest days locally
      // to avoid hitting dataService on every iteration.
      const asOfDate = matchDate ? new Date(matchDate) : undefined;
      const fatigueFactor = historicalMatches
        ? this.calculateFatigueFromMatches(homeTeam, awayTeam, historicalMatches, asOfDate)
        : this.calculateFatigueFromMatches(homeTeam, awayTeam, allMatches);

      // 6. Calculate Poisson predictions using Dixon-Coles lambdas
      const leagueAvgs = this.computeLeagueAverages(allMatches);
      const rawLambdas =
        this.calculatePoissonLambdas(homeTeam, awayTeam, leagueAvgs, homeStats, awayStats);

      // Apply fatigue: tired teams score less (lambda × fatigue) and concede
      // more (opponent lambda ÷ fatigue). Multipliers are in [0.85, 1.0] so
      // the adjustment is modest but data-driven per spec 01.
      const homeGoalsExpected = Math.max(0.3, rawLambdas.lambdaHome * fatigueFactor.homeFatigue / fatigueFactor.awayFatigue);
      const awayGoalsExpected = Math.max(0.3, rawLambdas.lambdaAway * fatigueFactor.awayFatigue / fatigueFactor.homeFatigue);

      const scoreProbabilities = PoissonPredictor.predictScoreProbabilities(
        homeGoalsExpected,
        awayGoalsExpected
      );
      const poissonProbs = PoissonPredictor.getOutcomeProbabilities(scoreProbabilities);

      // 6. Analyze recent form (pass historical matches to avoid dataService calls in backtest)
      const formAnalysis = await this.analyzeRecentForm(homeTeam, awayTeam, historicalMatches);

      // 7. Head-to-head analysis
      const h2hAnalysis = await this.analyzeHeadToHead(homeTeam, awayTeam, historicalMatches);
      
      // 8. Attempt ML backend prediction (parallel — started earlier or fetched now)
      let mlPrediction: MLPrediction | null = null;
      if (!historicalMatches && typeof localStorage !== 'undefined' && localStorage.getItem('use_backend') === 'true') {
        try {
          mlPrediction = await backendService.predictMatch(homeTeam, awayTeam);
          insights.push('ML backend prediction incorporated into ensemble');
        } catch (err) {
          if (!(err instanceof BackendUnavailableError)) {
            console.warn('ML backend prediction failed:', err);
          }
          // Silent fallback — TypeScript ensemble handles it alone
        }
      }

      // 9. Combine all models with weighted approach
      // Dynamic draw probability: closer ratings → more likely draw (~26.5% PL average)
      const ratingDiffAbs = Math.abs(homeElo - awayElo);
      const eloDrawProb = 0.265 * Math.exp(-ratingDiffAbs / 600);
      const eloDrawClamped = Math.max(0.10, Math.min(0.35, eloDrawProb));
      const eloHomeProb = eloWinProbability * (1 - eloDrawClamped);
      const eloAwayProb = (1 - eloWinProbability) * (1 - eloDrawClamped);

      const eloProbs = { home: eloHomeProb, draw: eloDrawClamped, away: eloAwayProb };
      const combinedProbabilities = this.combineModels(
        {
          elo: eloProbs,
          poisson: poissonProbs,
          form: formAnalysis.probabilities,
          h2h: h2hAnalysis.probabilities,
          standings: this.getStandingsProbabilities(homePosition, awayPosition)
        },
        mlPrediction
      );

      // 8b. Apply referee adjustment (±3% max on home/away probabilities)
      // Home win rate derived from actual completed matches (fallback 0.46 if no data)
      const leagueHomeWinRate = leagueAvgs.homeWinRate;
      let adjustedProbabilities = { ...combinedProbabilities };

      if (referee) {
        try {
          const refereeStats = await RefereeAnalyzer.getRefereeStats(referee);
          const homeWinBias = refereeStats.homeWinRate - leagueHomeWinRate;
          // Clamp adjustment to ±3%
          const adjustment = Math.max(-0.03, Math.min(0.03, homeWinBias));

          if (Math.abs(adjustment) > 0.005) {
            adjustedProbabilities.homeWin += adjustment;
            adjustedProbabilities.awayWin -= adjustment;

            // Re-normalise to ensure probabilities sum to 1
            const total = adjustedProbabilities.homeWin + adjustedProbabilities.draw + adjustedProbabilities.awayWin;
            adjustedProbabilities.homeWin /= total;
            adjustedProbabilities.draw /= total;
            adjustedProbabilities.awayWin /= total;

            const direction = adjustment > 0 ? 'favours home' : 'favours away';
            insights.push(`Referee ${referee} ${direction} (${(refereeStats.homeWinRate * 100).toFixed(0)}% home win rate vs ${(leagueHomeWinRate * 100).toFixed(0)}% avg)`);
          }
        } catch {
          // Referee data unavailable — skip adjustment
        }
      }

      // 9. Determine predicted outcome
      const prediction = this.determinePrediction(adjustedProbabilities);

      // 10. Calculate confidence score with ensemble disagreement detection
      // Determine what each key model predicts independently
      const eloTopOutcome = this.getTopOutcome(eloProbs.home, eloProbs.draw, eloProbs.away);
      const poissonTopOutcome = this.getTopOutcome(poissonProbs.homeWin, poissonProbs.draw, poissonProbs.awayWin);
      const modelsDisagree = eloTopOutcome !== poissonTopOutcome;

      const confidence = this.calculateConfidence(
        adjustedProbabilities,
        prediction.result,
        fatigueFactor,
        modelsDisagree
      );

      if (modelsDisagree) {
        insights.push(`Models split: ELO predicts ${eloTopOutcome}, Poisson predicts ${poissonTopOutcome} — lower confidence`);
      }

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
      const valueOdds = this.calculateValueOdds(adjustedProbabilities);

      // Report the effective weights used in this prediction
      const tsScale = mlPrediction ? (1 - ML_BACKEND_WEIGHT) : 1;
      const effectiveWeights: EnhancedPredictionModel['modelWeights'] = {
        elo: MODEL_WEIGHTS.elo * tsScale,
        poisson: MODEL_WEIGHTS.poisson * tsScale,
        form: MODEL_WEIGHTS.form * tsScale,
        h2h: MODEL_WEIGHTS.h2h * tsScale,
        standings: MODEL_WEIGHTS.standings * tsScale,
        ...(mlPrediction ? { ml: ML_BACKEND_WEIGHT } : {}),
      };

      return {
        predictedResult: prediction.result,
        confidence,
        predictedHomeGoals: predictedGoals.home,
        predictedAwayGoals: predictedGoals.away,
        homeForm: formAnalysis.homeFormString,
        awayForm: formAnalysis.awayFormString,
        modelWeights: effectiveWeights,
        insights,
        valueOdds
      };

    } catch (error) {
      console.warn('OptimizedPredictor.predictMatch failed, using fallback:', error);
      // Fallback to simple prediction — still report the real weights for consistency
      return {
        predictedResult: 'D',
        confidence: 0.33,
        predictedHomeGoals: 1,
        predictedAwayGoals: 1,
        homeForm: '?????',
        awayForm: '?????',
        modelWeights: { ...MODEL_WEIGHTS },
        insights: ['Using simplified prediction due to data limitations'],
        valueOdds: { home: 3.0, draw: 3.3, away: 3.0 }
      };
    }
  }

  private static async getEnhancedTeamStats(team: string, standings: Standing[]) {
    const standing = standings.find(s => s.team.name === team);

    if (!standing) {
      // Use ELO rating to estimate stats when no standings data available
      const teamStrength = this.eloSystem.getTeamRating(team);
      const relativeStrength = (teamStrength - 1500) / 200; // Normalise to approx -1.5 to +1.75
      
      // Better teams score more and concede less
      const avgGoalsScored = 1.5 + (relativeStrength * 0.5);
      const avgGoalsConceded = 1.5 - (relativeStrength * 0.3);
      const pointsPerGame = 1.3 + (relativeStrength * 0.7);
      const winRate = 0.33 + (relativeStrength * 0.2);
      
      return {
        avgGoalsScored: Math.max(0.5, avgGoalsScored),
        avgGoalsConceded: Math.max(0.5, avgGoalsConceded),
        pointsPerGame: Math.max(0.3, Math.min(3, pointsPerGame)),
        cleanSheetRate: Math.max(0.1, Math.min(0.5, 0.3 + relativeStrength * 0.1)),
        winRate: Math.max(0.1, Math.min(0.8, winRate))
      };
    }

    const gamesPlayed = standing.playedGames || 1;
    
    return {
      avgGoalsScored: standing.goalsFor / gamesPlayed,
      avgGoalsConceded: standing.goalsAgainst / gamesPlayed,
      pointsPerGame: standing.points / gamesPlayed,
      cleanSheetRate: Math.exp(-(standing.goalsAgainst / gamesPlayed)), // Poisson P(0 goals conceded)
      winRate: standing.won / gamesPlayed
    };
  }

  private static async analyzeRecentForm(homeTeam: string, awayTeam: string, historicalMatches?: Match[]) {
    const [homeForm, awayForm] = await Promise.all([
      dataService.getTeamForm(homeTeam, historicalMatches),
      dataService.getTeamForm(awayTeam, historicalMatches)
    ]);

    const calculateFormScore = (form: any[]) => {
      if (!form || form.length === 0) {
        // Return neutral form score when no form data available.
        // Previously this derived from ELO, which double-counted ELO's
        // contribution (25% ELO weight + 20% form weight both from ELO).
        return 0.5;
      }
      
      let score = 0;
      const weights = [0.35, 0.25, 0.20, 0.12, 0.08]; // Recent matches weighted more
      
      form.slice(0, 5).forEach((match, idx) => {
        if (match.result === 'W') score += 1 * weights[idx];
        else if (match.result === 'D') score += 0.33 * weights[idx];
      });
      
      return Math.max(0.1, Math.min(0.9, score)); // Ensure reasonable bounds
    };

    const homeFormScore = calculateFormScore(homeForm);
    const awayFormScore = calculateFormScore(awayForm);
    
    const formString = (form: any[]) => {
      if (!form || form.length === 0) {
        return '?????'; // No form data available
      }
      return form.slice(0, 5).map(m => m.result || '?').join('');
    };

    // Calculate form-based probabilities with more variation
    const homeMomentum = homeFormScore * 1.1; // Home advantage in form
    const awayMomentum = awayFormScore * 0.9;
    
    // Add variance based on form difference
    const formDiff = Math.abs(homeMomentum - awayMomentum);
    const drawProb = Math.max(0.15, Math.min(0.35, 0.25 - formDiff * 0.3));
    
    // Calculate win probabilities
    const totalMomentum = homeMomentum + awayMomentum;
    let homeWinProb = (homeMomentum / totalMomentum) * (1 - drawProb);
    let awayWinProb = (awayMomentum / totalMomentum) * (1 - drawProb);
    
    // Ensure probabilities sum to 1
    const total = homeWinProb + drawProb + awayWinProb;
    
    return {
      homeFormScore,
      awayFormScore,
      homeFormString: formString(homeForm),
      awayFormString: formString(awayForm),
      probabilities: {
        homeWin: homeWinProb / total,
        draw: drawProb / total,
        awayWin: awayWinProb / total
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
      // No H2H data — use league-average home advantage (consistent with ensemble priors)
      const awayRate = (1 - DEFAULT_HOME_WIN_RATE) * 0.55; // ~0.297
      const drawRate = 1 - DEFAULT_HOME_WIN_RATE - awayRate; // ~0.263
      return {
        totalMatches: 0,
        homeWins: 0,
        awayWins: 0,
        draws: 0,
        homeWinRate: DEFAULT_HOME_WIN_RATE,
        awayWinRate: awayRate,
        probabilities: {
          homeWin: DEFAULT_HOME_WIN_RATE,
          draw: drawRate,
          awayWin: awayRate
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
        // Shrink towards uniform (1/3) to avoid overfitting small H2H samples
        homeWin: (homeWins / total) * 0.7 + 0.1,
        draw: (draws / total) * 0.7 + 0.1,
        awayWin: (awayWins / total) * 0.7 + 0.1
      }
    };
  }

  /**
   * Calculate fatigue from pre-fetched match data (backtest mode).
   * Avoids hitting dataService — derives rest days directly from the match list.
   */
  private static calculateFatigueFromMatches(
    homeTeam: string, awayTeam: string, matches: Match[], asOfDate?: Date
  ): { homeFatigue: number; awayFatigue: number } {
    const ref = asOfDate ?? new Date();
    const restDaysFor = (team: string): number => {
      const teamMatches = matches
        .filter(m => (m.home_team === team || m.away_team === team) && new Date(m.date) < ref)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (teamMatches.length === 0) return 7;
      return Math.floor((ref.getTime() - new Date(teamMatches[0].date).getTime()) / (1000 * 60 * 60 * 24));
    };
    return {
      homeFatigue: FatigueAnalyzer.getFatigueMultiplier(restDaysFor(homeTeam), 1),
      awayFatigue: FatigueAnalyzer.getFatigueMultiplier(restDaysFor(awayTeam), 1)
    };
  }

  private static getStandingsProbabilities(homePosition: number, awayPosition: number) {
    if (!homePosition || !awayPosition) {
      return { homeWin: DEFAULT_HOME_WIN_RATE, draw: 0.27, awayWin: 1 - DEFAULT_HOME_WIN_RATE - 0.27 };
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

  /**
   * Combine all sub-models into a single probability distribution.
   *
   * When an ML backend prediction is available, it joins the ensemble with its
   * own weight (ML_BACKEND_WEIGHT). The TypeScript model weights are scaled down
   * proportionally so they still sum to (1 - ML_BACKEND_WEIGHT).
   */
  private static combineModels(
    models: {
      elo: { home: number; draw: number; away: number };
      poisson: { homeWin: number; draw: number; awayWin: number };
      form: { homeWin: number; draw: number; awayWin: number };
      h2h: { homeWin: number; draw: number; awayWin: number };
      standings: { homeWin: number; draw: number; awayWin: number };
    },
    mlPrediction?: MLPrediction | null
  ) {
    // When the ML backend is contributing, scale TS weights down proportionally
    const tsScale = mlPrediction ? (1 - ML_BACKEND_WEIGHT) : 1;

    const homeWin =
      models.elo.home * MODEL_WEIGHTS.elo * tsScale +
      models.poisson.homeWin * MODEL_WEIGHTS.poisson * tsScale +
      models.form.homeWin * MODEL_WEIGHTS.form * tsScale +
      models.h2h.homeWin * MODEL_WEIGHTS.h2h * tsScale +
      models.standings.homeWin * MODEL_WEIGHTS.standings * tsScale +
      (mlPrediction ? mlPrediction.prediction.home * ML_BACKEND_WEIGHT : 0);

    const draw =
      models.elo.draw * MODEL_WEIGHTS.elo * tsScale +
      models.poisson.draw * MODEL_WEIGHTS.poisson * tsScale +
      models.form.draw * MODEL_WEIGHTS.form * tsScale +
      models.h2h.draw * MODEL_WEIGHTS.h2h * tsScale +
      models.standings.draw * MODEL_WEIGHTS.standings * tsScale +
      (mlPrediction ? mlPrediction.prediction.draw * ML_BACKEND_WEIGHT : 0);

    const awayWin =
      models.elo.away * MODEL_WEIGHTS.elo * tsScale +
      models.poisson.awayWin * MODEL_WEIGHTS.poisson * tsScale +
      models.form.awayWin * MODEL_WEIGHTS.form * tsScale +
      models.h2h.awayWin * MODEL_WEIGHTS.h2h * tsScale +
      models.standings.awayWin * MODEL_WEIGHTS.standings * tsScale +
      (mlPrediction ? mlPrediction.prediction.away * ML_BACKEND_WEIGHT : 0);

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

  /**
   * Determine which outcome a model predicts from its three probabilities.
   */
  private static getTopOutcome(home: number, draw: number, away: number): 'H' | 'D' | 'A' {
    if (home > draw && home > away) return 'H';
    if (away > draw && away > home) return 'A';
    return 'D';
  }

  private static calculateConfidence(
    probabilities: { homeWin: number; draw: number; awayWin: number },
    predictedResult: 'H' | 'D' | 'A',
    fatigueFactor: { homeFatigue: number; awayFatigue: number },
    modelsDisagree: boolean = false
  ): number {
    const probs = Object.values(probabilities);
    const sorted = [...probs].sort((a, b) => b - a); // Non-mutating sort
    const maxProb = sorted[0];
    const secondProb = sorted[1];

    // Confidence based on probability gap between top two outcomes
    const probDifference = maxProb - secondProb;

    // Base confidence from the predicted outcome's probability
    let confidence = maxProb;

    // Boost confidence if there's a clear favourite
    if (probDifference > 0.2) {
      confidence += 0.1;
    } else if (probDifference < 0.1) {
      confidence -= 0.1;
    }

    // Penalise when key models (ELO & Poisson) disagree on the outcome
    if (modelsDisagree) {
      confidence -= 0.08;
    }

    // Apply fatigue adjustment — uncertain when teams are tired
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
    // Convert probabilities to decimal odds with bookmaker margin
    return {
      home: probabilities.homeWin > 0 ? (1 / probabilities.homeWin) * VALUE_ODDS_MARGIN : 10.0,
      draw: probabilities.draw > 0 ? (1 / probabilities.draw) * VALUE_ODDS_MARGIN : 4.0,
      away: probabilities.awayWin > 0 ? (1 / probabilities.awayWin) * VALUE_ODDS_MARGIN : 10.0
    };
  }
}