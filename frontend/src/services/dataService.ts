import type { Match, Season, TeamStats, Standing, TeamForm } from '../types';
import { footballDataAPI, type FDScorer } from './api/footballData';
import { predictionTracker } from './predictionTracker';
import { betHistoryService } from './betting/betHistoryService';
import { sharedEloSystem } from '../lib/advancedPredictions';

interface DataSource {
  type: 'api';
  available: boolean;
}

class DataService {
  private apiSource: DataSource = { type: 'api', available: false };
  private useCache: boolean = true;
  private cacheDb: IDBDatabase | null = null;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes default
  private readyPromise: Promise<void>;

  constructor() {
    // Initialise IndexedDB first, then check data sources — both must complete before queries
    this.readyPromise = this.initializeIndexedDB().then(() => this.checkDataSources());
  }

  /** Wait for initial data source check to complete before querying */
  private async ensureReady(): Promise<void> {
    await this.readyPromise;
  }
  
  private initializeIndexedDB(): Promise<void> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      // IndexedDB not available (SSR or unsupported browser)
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const request = indexedDB.open('PremierLeagueOracle', 2);

      request.onerror = () => {
        // Failed to open IndexedDB — cache will be disabled but app still works
        resolve();
      };

      request.onsuccess = () => {
        this.cacheDb = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        if (oldVersion < 1) {
          // Fresh install — create all stores with correct keyPath
          const matchStore = db.createObjectStore('matches', { keyPath: 'id' });
          matchStore.createIndex('date', 'date', { unique: false });
          db.createObjectStore('standings', { keyPath: 'id' });
          db.createObjectStore('teamStats', { keyPath: 'id' });
          db.createObjectStore('scorers', { keyPath: 'id' });
        }

        if (oldVersion >= 1 && oldVersion < 2) {
          // Upgrade from v1: fix keyPaths (standings used 'team_id', teamStats used 'team_name')
          // and add missing scorers store
          if (db.objectStoreNames.contains('standings')) {
            db.deleteObjectStore('standings');
          }
          db.createObjectStore('standings', { keyPath: 'id' });

          if (db.objectStoreNames.contains('teamStats')) {
            db.deleteObjectStore('teamStats');
          }
          db.createObjectStore('teamStats', { keyPath: 'id' });

          if (!db.objectStoreNames.contains('scorers')) {
            db.createObjectStore('scorers', { keyPath: 'id' });
          }
        }
      };
    });
  }
  
  private async checkDataSources(): Promise<void> {
    try {
      // Check if API key is available
      const activeApi = this.getActiveApi();
      
      // Check if API key is available
      if (!activeApi.hasApiKey()) {
        // Football-Data: No API key available
        this.apiSource.available = false;
        return;
      }
      
      // Test API availability with the key
      const season = await activeApi.getCurrentSeason();
      this.apiSource.available = season !== null;
      
      if (this.apiSource.available) {
        // Football-Data (Free) is available and working
      } else {
        // Football-Data is not working
      }
    } catch (error) {
      // Error checking API availability
      this.apiSource.available = false;
    }
  }
  
  // Get the currently active API
  private getActiveApi() {
    return footballDataAPI;
  }
  


  // Public API for checking data source status
  public getDataSourceStatus() {
    return {
      api: this.apiSource.available,
      usingAPI: this.apiSource.available
    };
  }

  // Get overall service status
  public getStatus() {
    return {
      primarySource: this.apiSource,
      fallbackSource: { type: 'none', available: false }
    };
  }
  
  // Cache management
  private async getCachedData<T>(storeName: string, key: string, ttlMs?: number): Promise<T | null> {
    if (!this.useCache || !this.cacheDb) return null;

    const timeout = ttlMs ?? this.cacheTimeout;

    return new Promise((resolve) => {
      const transaction = this.cacheDb!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.timestamp && Date.now() - result.timestamp < timeout) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }
  
  private async setCachedData<T>(storeName: string, key: string, data: T): Promise<void> {
    if (!this.useCache || !this.cacheDb) return;

    return new Promise((resolve, reject) => {
      const transaction = this.cacheDb!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put({
        id: key,
        data,
        timestamp: Date.now()
      });

      request.onsuccess = () => resolve();
      // Cache writes are non-critical — resolve silently rather than propagating IDB errors
      request.onerror = () => resolve();
    });
  }

  // Main data fetching methods - API only
  public async getCurrentSeason(): Promise<Season | null> {
    await this.ensureReady();
    const cacheKey = 'current_season';
    
    // Season data stored in 'teamStats' IndexedDB store (no dedicated season store
    // exists — adding one would require an IDB schema migration for minimal benefit)
    const cached = await this.getCachedData<Season>('teamStats', cacheKey);
    if (cached) return cached;
    
    // Get from API
    if (this.apiSource.available) {
      try {
        const season = await this.getActiveApi().getCurrentSeason();
        if (season) {
          await this.setCachedData('teamStats', cacheKey, season);
          return season;
        }
      } catch (error) {
        // Error fetching season from API
      }
    }
    
    throw new Error('No data source available for current season');
  }
  
  public async getMatches(options: {
    upcoming?: boolean;
    recent?: boolean;
    days?: number;
    matchday?: number;
  } = {}): Promise<Match[]> {
    await this.ensureReady();
    const { upcoming = false, recent = false, days = 7, matchday } = options;
    const cacheKey = `matches_${upcoming ? 'upcoming' : 'recent'}_${days}_${matchday || 'all'}`;
    
    // Try cache first
    const cached = await this.getCachedData<Match[]>('matches', cacheKey);
    if (cached) return cached;
    
    // Get from API
    if (this.apiSource.available) {
      try {
        let matches: Match[] = [];
        
        if (upcoming) {
          matches = await this.getActiveApi().getUpcomingMatches(days);
        } else if (recent) {
          matches = await this.getActiveApi().getRecentMatches(days);
        } else if (matchday) {
          matches = await this.getActiveApi().getMatchesByMatchday(matchday);
        } else {
          matches = await this.getActiveApi().getAllMatches();
        }
        
        if (matches.length > 0) {
          await this.setCachedData('matches', cacheKey, matches);

          // Auto-reconcile: resolve pending predictions against any completed matches
          const finished = matches.filter(m => m.result !== null);
          if (finished.length > 0) {
            this.reconcilePredictions(finished);
          }

          return matches;
        }
      } catch (error) {
        // Error fetching matches from API
      }
    }

    // Provide helpful error message based on the situation
    if (!this.getActiveApi().hasApiKey()) {
      throw new Error('API key required. Please set up your Football-Data.org API key in Settings or through the setup wizard.');
    } else {
      throw new Error('Unable to fetch matches. Please check your internet connection and API key validity.');
    }
  }
  
  public async getCurrentSeasonMatches(): Promise<Match[]> {
    return this.getMatches();
  }
  
  public async getStandings(): Promise<Standing[]> {
    await this.ensureReady();
    const cacheKey = 'current_standings';
    
    // Try cache first
    const cached = await this.getCachedData<Standing[]>('standings', cacheKey);
    if (cached) return cached;
    
    // Get from API
    if (this.apiSource.available) {
      try {
        const standings = await this.getActiveApi().getStandings();
        if (standings && standings.length > 0) {
          await this.setCachedData('standings', cacheKey, standings);
          return standings;
        }
      } catch (error) {
        // Error fetching standings from API
      }
    }
    
    throw new Error('No data source available for standings');
  }
  
  public async getTopScorers(limit: number = 20): Promise<FDScorer[]> {
    await this.ensureReady();
    const cacheKey = `top_scorers_${limit}`;

    // Try cache first
    const cached = await this.getCachedData<FDScorer[]>('scorers', cacheKey);
    if (cached) return cached;
    
    // Get from API
    if (this.apiSource.available) {
      try {
        const scorers = await this.getActiveApi().getTopScorers(limit);
        if (scorers && scorers.length > 0) {
          await this.setCachedData('scorers', cacheKey, scorers);
          return scorers;
        }
      } catch (error) {
        // Error fetching top scorers from API
      }
    }
    
    throw new Error('No data source available for top scorers');
  }
  
  public async getTeamStats(teamName: string): Promise<TeamStats | null> {
    await this.ensureReady();
    const cacheKey = `team_stats_${teamName}`;
    
    // Try cache first
    const cached = await this.getCachedData<TeamStats>('teamStats', cacheKey);
    if (cached) return cached;
    
    // Get from API
    if (this.apiSource.available) {
      try {
        const teamStats = await this.getActiveApi().getTeamStats(teamName);
        if (teamStats) {
          // Transform Football API stats to our TeamStats format
          const currentYear = new Date().getFullYear();
          // Use the earlier year of the season (e.g. 2025 for 2025/26)
          // July onwards (getMonth() >= 6) = new season — matches footballData.ts boundary
          const seasonYear = new Date().getMonth() >= 6 ? currentYear : currentYear - 1;
          // Compute home/away splits from recent matches
          let homeStats = { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 };
          let awayStats = { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 };
          let totalCleanSheets = 0;
          let totalFailedToScore = 0;

          try {
            const allMatches = await this.getMatches();
            const teamMatches = allMatches.filter(m =>
              m.home_team.toLowerCase() === teamName.toLowerCase() ||
              m.away_team.toLowerCase() === teamName.toLowerCase()
            ).filter(m => m.result !== null); // only finished matches

            for (const m of teamMatches) {
              const isHome = m.home_team.toLowerCase() === teamName.toLowerCase();
              const gf = isHome ? (m.home_goals ?? 0) : (m.away_goals ?? 0);
              const ga = isHome ? (m.away_goals ?? 0) : (m.home_goals ?? 0);
              const bucket = isHome ? homeStats : awayStats;

              bucket.played++;
              bucket.goalsFor += gf;
              bucket.goalsAgainst += ga;
              if (ga === 0) { bucket.cleanSheets++; totalCleanSheets++; }
              if (gf === 0) totalFailedToScore++;

              if (m.result === 'D') { bucket.draws++; }
              else if ((isHome && m.result === 'H') || (!isHome && m.result === 'A')) { bucket.wins++; }
              else { bucket.losses++; }
            }
          } catch {
            // If match fetch fails, splits stay at 0 — overall stats still correct
          }

          const stats: TeamStats = {
            id: `${teamName}_${currentYear}`,
            season_id: String(seasonYear),
            team_name: teamName,
            matches_played: teamStats.played,
            wins: teamStats.wins,
            draws: teamStats.draws,
            losses: teamStats.losses,
            goals_for: teamStats.goalsFor,
            goals_against: teamStats.goalsAgainst,
            clean_sheets: totalCleanSheets,
            failed_to_score: totalFailedToScore,
            points: teamStats.points,
            home_matches_played: homeStats.played,
            home_wins: homeStats.wins,
            home_draws: homeStats.draws,
            home_losses: homeStats.losses,
            home_goals_for: homeStats.goalsFor,
            home_goals_against: homeStats.goalsAgainst,
            away_matches_played: awayStats.played,
            away_wins: awayStats.wins,
            away_draws: awayStats.draws,
            away_losses: awayStats.losses,
            away_goals_for: awayStats.goalsFor,
            away_goals_against: awayStats.goalsAgainst,
            updated_at: new Date().toISOString()
          };
          
          await this.setCachedData('teamStats', cacheKey, stats);
          return stats;
        }
      } catch (error) {
        // Error fetching team stats from API
      }
    }
    
    return null;
  }
  
  public async getTeamForm(teamName: string, matches?: Match[]): Promise<TeamForm[]> {
    await this.ensureReady();
    // Cache key must reflect actual match content, not just array length —
    // two different 5-match arrays for the same team would otherwise collide
    const matchFingerprint = matches
      ? matches.slice(0, 10).map(m => m.id).join(',')
      : 'default';
    const cacheKey = `team_form_${teamName}_${matchFingerprint}`;
    
    // Try cache first
    const cached = await this.getCachedData<TeamForm[]>('teamStats', cacheKey);
    if (cached) return cached;
    
    // Get from API
    if (this.apiSource.available) {
      try {
        const teamForm = await this.getActiveApi().getTeamForm(teamName, matches);
        if (teamForm) {
          await this.setCachedData('teamStats', cacheKey, teamForm);
          return teamForm;
        }
      } catch (error) {
        // Error fetching team form from API
      }
    }
    
    // Return empty array if no data available
    return [];
  }
  
  // Get all seasons — free tier only returns current season
  public async getAllSeasons(): Promise<Season[]> {
    await this.ensureReady();
    const cacheKey = 'all_seasons';
    
    // Try cache first
    const cached = await this.getCachedData<Season[]>('matches', cacheKey);
    if (cached) return cached;
    
    // Get current season from API
    if (this.apiSource.available) {
      try {
        const currentSeason = await this.getActiveApi().getCurrentSeason();
        if (currentSeason) {
          const seasons = [currentSeason];
          await this.setCachedData('matches', cacheKey, seasons);
          return seasons;
        }
      } catch (error) {
        // Error fetching seasons from API
      }
    }
    
    return [];
  }

  // Get matches by season — extracts year and delegates to getHistoricalMatches
  public async getMatchesBySeason(seasonId: string): Promise<Match[]> {
    // seasonId is "2024-2025" or "2024/25" — extract the starting year
    const yearMatch = seasonId.match(/^(\d{4})/);
    if (yearMatch) {
      return this.getHistoricalMatches(parseInt(yearMatch[1], 10));
    }
    // Fallback: return current season matches
    return this.getMatches();
  }

  // Refresh data source availability (useful after API key is set)
  public async refreshDataSources(): Promise<void> {
    this.readyPromise = this.checkDataSources();
    await this.readyPromise;
  }
  
  // Alias for refreshDataSources for backward compatibility
  public async refreshApiConfiguration(): Promise<void> {
    await this.checkDataSources();
  }

  // Get prediction accuracy for a season
  // seasonId is "2024-2025" or "2024/25" — extracts start year, filters predictions
  // whose matchDate falls within that season (Aug startYear to Jul startYear+1)
  public async getPredictionAccuracy(seasonId: string): Promise<{ total: number; correct: number; accuracy: number; }> {
    // Extract start year from seasonId (e.g. "2025" from "2025-2026" or "2025/26")
    const yearMatch = seasonId.match(/^(\d{4})/);
    const allPredictions = predictionTracker.getRecentPredictions(10000);
    const resolved = allPredictions.filter(p => p.actualResult !== undefined);

    let filtered = resolved;
    if (yearMatch) {
      const startYear = parseInt(yearMatch[1], 10);
      // PL season: August of startYear to July of startYear+1
      const seasonStart = new Date(startYear, 7, 1); // 1 Aug
      const seasonEnd = new Date(startYear + 1, 7, 1); // 1 Aug next year (exclusive)

      filtered = resolved.filter(p => {
        const d = new Date(p.matchDate);
        return d >= seasonStart && d < seasonEnd;
      });
    }

    const total = filtered.length;
    const correct = filtered.filter(p => p.isCorrect).length;
    return {
      total,
      correct,
      accuracy: total > 0 ? correct / total : 0
    };
  }

  // Get live matches currently in play — delegates to footballData with 60s IndexedDB cache
  public async getLiveMatches(): Promise<Match[]> {
    await this.ensureReady();
    const cacheKey = 'live_matches';
    const LIVE_CACHE_TTL = 60 * 1000; // 60 seconds for live data

    // Live data uses a short 60s cache
    const cached = await this.getCachedData<Match[]>('matches', cacheKey, LIVE_CACHE_TTL);
    if (cached) return cached;

    if (this.apiSource.available) {
      try {
        const matches = await this.getActiveApi().getLiveMatches();
        if (matches.length > 0) {
          // Store with standard setCachedData — caller controls refresh frequency
          await this.setCachedData('matches', cacheKey, matches);
        }
        return matches;
      } catch (error) {
        // Error fetching live matches
      }
    }

    return [];
  }

  // Get completed matches for a given season year (e.g. 2024 for 2024/25)
  public async getHistoricalMatches(season: number): Promise<Match[]> {
    await this.ensureReady();
    const cacheKey = `historical_matches_${season}`;

    // Historical data rarely changes — 24h cache
    const HISTORICAL_TTL = 24 * 60 * 60 * 1000;
    const cached = await this.getCachedData<Match[]>('matches', cacheKey, HISTORICAL_TTL);
    if (cached) return cached;

    if (this.apiSource.available) {
      try {
        const api = this.getActiveApi();
        // Football-Data.org v4 supports ?season=YYYY on the competition matches endpoint
        const matches = await api.getMatchesBySeason(season);
        if (matches.length > 0) {
          await this.setCachedData('matches', cacheKey, matches);
        }
        return matches;
      } catch (error) {
        // Error fetching historical matches
      }
    }

    return [];
  }

  // Get a team's recent finished matches — 30min cache
  public async getTeamRecentMatches(teamId: number, limit: number = 5): Promise<Match[]> {
    await this.ensureReady();
    const cacheKey = `team_recent_${teamId}_${limit}`;
    const TEAM_RECENT_TTL = 30 * 60 * 1000;

    const cached = await this.getCachedData<Match[]>('matches', cacheKey, TEAM_RECENT_TTL);
    if (cached) return cached;

    if (this.apiSource.available) {
      try {
        const matches = await this.getActiveApi().getTeamMatches(teamId, limit);
        if (matches.length > 0) {
          await this.setCachedData('matches', cacheKey, matches);
        }
        return matches;
      } catch (error) {
        // Error fetching team recent matches
      }
    }

    return [];
  }

  /**
   * Reconcile pending predictions and bets against completed match results.
   * Finds stored predictions whose matches have finished and updates them
   * with actual results via predictionTracker.updateWithResult().
   * Also resolves any placed bets for completed matches via betHistoryService.
   */
  public reconcilePredictions(completedMatches: Match[]): number {
    let reconciled = 0;

    for (const match of completedMatches) {
      // Only process matches with a definitive result
      if (!match.result || match.home_goals === null || match.away_goals === null) {
        continue;
      }

      // Check whether we have unresolved predictions for this match
      const predictions = predictionTracker.getMatchPredictions(match.id);
      const unresolvedPredictions = predictions.filter(p => p.actualResult === undefined);

      if (unresolvedPredictions.length > 0) {
        predictionTracker.updateWithResult(
          match.id,
          match.result,
          match.home_goals,
          match.away_goals
        );
        reconciled += unresolvedPredictions.length;
      }

      // Also resolve any pending bets for this match
      betHistoryService.resolveMatchBets(
        match.id,
        match.result,
        match.home_goals,
        match.away_goals
      );
    }

    // Update ELO ratings from completed matches so the ensemble
    // model has current ratings for future predictions.
    // processCompletedMatches is idempotent — it skips already-processed matches.
    sharedEloSystem.processCompletedMatches(completedMatches);

    return reconciled;
  }

  // Cache management utilities
  public async clearCache(): Promise<void> {
    if (!this.cacheDb) return;

    const storeNames = ['matches', 'standings', 'teamStats', 'scorers'];
    const transaction = this.cacheDb.transaction(storeNames, 'readwrite');

    // IDBRequest.clear() doesn't return a Promise — wrap each in one
    await Promise.all(storeNames.map(storeName => new Promise<void>((resolve, reject) => {
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    })));
    
    // Cache cleared — API key is intentionally preserved so the user
    // doesn't have to re-enter it after a simple cache flush.
  }
  
  public setCacheTimeout(minutes: number): void {
    this.cacheTimeout = minutes * 60 * 1000;
  }
  
  public disableCache(): void {
    this.useCache = false;
  }
  
  public enableCache(): void {
    this.useCache = true;
  }
}

// Export singleton instance
export const dataService = new DataService();