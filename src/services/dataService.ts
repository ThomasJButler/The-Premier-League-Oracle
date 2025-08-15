import { supabase } from '../lib/supabase';
import type { Match, Season, TeamStats, Standing, TeamForm } from '../types';
import { footballDataAPI } from './api/footballData';

interface DataSource {
  type: 'api' | 'database';
  available: boolean;
}

class DataService {
  private primarySource: DataSource = { type: 'api', available: false };
  private fallbackSource: DataSource = { type: 'database', available: true };
  private useCache: boolean = true;
  private cacheDb: IDBDatabase | null = null;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes default
  
  constructor() {
    this.initializeIndexedDB();
    this.checkDataSources();
  }
  
  private async initializeIndexedDB(): Promise<void> {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not available');
      return;
    }
    
    const request = indexedDB.open('PremierLeagueOracle', 1);
    
    request.onerror = () => {
      console.error('Failed to open IndexedDB');
    };
    
    request.onsuccess = () => {
      this.cacheDb = request.result;
      console.log('IndexedDB initialized');
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object stores for caching
      if (!db.objectStoreNames.contains('matches')) {
        const matchStore = db.createObjectStore('matches', { keyPath: 'id' });
        matchStore.createIndex('date', 'date', { unique: false });
        matchStore.createIndex('teams', ['home_team', 'away_team'], { unique: false });
      }
      
      if (!db.objectStoreNames.contains('standings')) {
        const standingsStore = db.createObjectStore('standings', { keyPath: 'team_id' });
        standingsStore.createIndex('position', 'position', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('cache_metadata')) {
        db.createObjectStore('cache_metadata', { keyPath: 'key' });
      }
    };
  }
  
  private async checkDataSources(): Promise<void> {
    // Force API as primary if key exists
    if (footballDataAPI.hasApiKey()) {
      this.primarySource = { type: 'api', available: false };
      
      try {
        const isConnected = await footballDataAPI.testConnection();
        this.primarySource.available = isConnected;
        
        if (isConnected) {
          console.log('✅ Football-Data API connected successfully');
          // Clear old cache to force fresh data
          await this.clearCache();
          // Reset cache timeout for fresh data
          this.cacheTimeout = 2 * 60 * 1000; // 2 minutes for development
        } else {
          console.warn('⚠️ Football-Data API not available, falling back to database');
        }
      } catch (error) {
        console.warn('⚠️ Football-Data API connection failed:', error);
        this.primarySource.available = false;
      }
    } else {
      console.log('ℹ️ No Football-Data API key configured, using database');
      this.primarySource.available = false;
    }
  }
  
  // Cache management
  private async getCachedData<T>(storeName: string, key: string): Promise<T | null> {
    if (!this.cacheDb || !this.useCache) return null;
    
    return new Promise((resolve) => {
      try {
        const transaction = this.cacheDb!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = () => {
          resolve(request.result || null);
        };
        
        request.onerror = () => {
          console.error('Cache read error');
          resolve(null);
        };
      } catch (error) {
        console.error('Cache transaction error:', error);
        resolve(null);
      }
    });
  }
  
  private async setCachedData<T>(storeName: string, key: string, data: T): Promise<void> {
    if (!this.cacheDb || !this.useCache) return;
    
    return new Promise((resolve) => {
      try {
        const transaction = this.cacheDb!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put({ ...data, id: key });
        
        transaction.oncomplete = () => {
          resolve();
        };
        
        transaction.onerror = () => {
          console.error('Cache write error');
          resolve();
        };
      } catch (error) {
        console.error('Cache transaction error:', error);
        resolve();
      }
    });
  }
  
  // Get current season
  public async getCurrentSeason(): Promise<Season | null> {
    // Try API first
    if (this.primarySource.available) {
      const season = await footballDataAPI.getCurrentSeason();
      if (season) {
        // Cache the result
        await this.setCachedData('cache_metadata', 'current_season', season);
        return season;
      }
    }
    
    // Check cache
    const cached = await this.getCachedData<Season>('cache_metadata', 'current_season');
    if (cached) return cached;
    
    // Fall back to database
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_current', true)
      .single();
    
    if (error) {
      console.error('Error fetching season from database:', error);
      return null;
    }
    
    return data as Season;
  }
  
  // Get matches with hybrid approach
  public async getMatches(options?: {
    upcoming?: boolean;
    recent?: boolean;
    days?: number;
    teamName?: string;
  }): Promise<Match[]> {
    let matches: Match[] = [];
    
    // Try API first
    if (this.primarySource.available) {
      if (options?.upcoming) {
        matches = await footballDataAPI.getUpcomingMatches(options.days || 7);
      } else if (options?.recent) {
        matches = await footballDataAPI.getRecentResults(options.days || 7);
      } else {
        matches = await footballDataAPI.getMatches();
      }
      
      // Cache the matches
      for (const match of matches) {
        await this.setCachedData('matches', match.id, match);
      }
      
      if (matches.length > 0) {
        return matches;
      }
    }
    
    // Fall back to database
    let query = supabase.from('matches').select('*');
    
    if (options?.upcoming) {
      query = query.gte('date', new Date().toISOString())
        .order('date', { ascending: true });
    } else if (options?.recent) {
      query = query.lt('date', new Date().toISOString())
        .order('date', { ascending: false });
    } else {
      query = query.order('date', { ascending: false });
    }
    
    if (options?.teamName) {
      query = query.or(`home_team.eq.${options.teamName},away_team.eq.${options.teamName}`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching matches from database:', error);
      return [];
    }
    
    return data as Match[];
  }
  
  // Get team stats
  public async getTeamStats(teamName: string): Promise<TeamStats | any> {
    // Try API first
    if (this.primarySource.available) {
      const stats = await footballDataAPI.getTeamStats(teamName);
      if (stats) {
        // Cache the result
        await this.setCachedData('standings', teamName, stats);
        return stats;
      }
    }
    
    // Check cache
    const cached = await this.getCachedData('standings', teamName);
    if (cached) return cached;
    
    // Fall back to database
    const { data, error } = await supabase
      .from('team_stats')
      .select('*')
      .eq('team_name', teamName)
      .single();
    
    if (error) {
      console.error('Error fetching team stats from database:', error);
      return null;
    }
    
    return data;
  }
  
  // Get standings
  public async getStandings(): Promise<Standing[] | TeamStats[]> {
    // Try API first
    if (this.primarySource.available) {
      const standings = await footballDataAPI.getStandings();
      if (standings && standings.length > 0) {
        // Cache the standings
        for (const standing of standings) {
          await this.setCachedData('standings', standing.team.name, standing);
        }
        return standings;
      }
    }
    
    // Fall back to database
    const { data, error } = await supabase
      .from('team_stats')
      .select('*')
      .order('points', { ascending: false });
    
    if (error) {
      console.error('Error fetching standings from database:', error);
      return [];
    }
    
    return data || [];
  }
  
  // Get team form (last N matches)
  public async getTeamForm(teamName: string, limit: number = 5): Promise<TeamForm[]> {
    const matches = await this.getMatches({ teamName });
    
    return matches.slice(0, limit).map(match => {
      const isHome = match.home_team === teamName;
      return {
        opponent: isHome ? match.away_team : match.home_team,
        goalsFor: isHome ? match.home_goals : match.away_goals,
        goalsAgainst: isHome ? match.away_goals : match.home_goals,
        result: match.result === null ? null :
                isHome 
                  ? match.result === 'H' ? 'W' : match.result === 'A' ? 'L' : 'D'
                  : match.result === 'A' ? 'W' : match.result === 'H' ? 'L' : 'D',
        date: match.date
      } as TeamForm;
    });
  }
  
  // Get all seasons
  public async getAllSeasons(): Promise<Season[]> {
    // Try API first
    if (this.primarySource.available) {
      const season = await footballDataAPI.getCurrentSeason();
      if (season) {
        return [season]; // API only provides current season in free tier
      }
    }
    
    // Fall back to database
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('name', { ascending: false });
    
    if (error) {
      console.error('Error fetching seasons from database:', error);
      return [];
    }
    
    return data as Season[];
  }
  
  // Get matches by season
  public async getMatchesBySeason(seasonName: string): Promise<Match[]> {
    // For current season, use regular getMatches
    const currentSeason = await this.getCurrentSeason();
    if (currentSeason && currentSeason.name === seasonName) {
      return this.getMatches();
    }
    
    // For historical seasons, use database
    const { data: season } = await supabase
      .from('seasons')
      .select('id')
      .eq('name', seasonName)
      .single();
    
    if (!season) return [];
    
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('season_id', season.id)
      .order('date', { ascending: false });
    
    return matches as Match[] || [];
  }
  
  // Get current season matches
  public async getCurrentSeasonMatches(): Promise<Match[]> {
    return this.getMatches();
  }
  
  // Get prediction accuracy (mock for now)
  public async getPredictionAccuracy(seasonName: string): Promise<{
    total: number;
    correct: number;
    accuracy: number;
  } | null> {
    // This would need a predictions table or calculation
    return {
      total: 100,
      correct: 65,
      accuracy: 65.0
    };
  }
  
  // Get head to head
  public async getHeadToHead(homeTeam: string, awayTeam: string): Promise<{
    homeWins: number;
    draws: number;
    awayWins: number;
    matches: Match[];
  }> {
    const matches = await this.getMatches();
    
    const h2hMatches = matches.filter(m => 
      (m.home_team === homeTeam && m.away_team === awayTeam) ||
      (m.home_team === awayTeam && m.away_team === homeTeam)
    ).slice(0, 10); // Last 10 matches
    
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    
    h2hMatches.forEach(match => {
      if (match.result) {
        if (match.home_team === homeTeam) {
          if (match.result === 'H') homeWins++;
          else if (match.result === 'D') draws++;
          else if (match.result === 'A') awayWins++;
        } else {
          if (match.result === 'A') homeWins++;
          else if (match.result === 'D') draws++;
          else if (match.result === 'H') awayWins++;
        }
      }
    });
    
    return {
      homeWins,
      draws,
      awayWins,
      matches: h2hMatches
    };
  }
  
  // Switch data source
  public setDataSource(source: 'api' | 'database'): void {
    if (source === 'api' && !footballDataAPI.hasApiKey()) {
      console.error('Cannot switch to API source without API key');
      return;
    }
    
    this.primarySource.type = source;
    this.checkDataSources();
  }
  
  // Clear cache
  public async clearCache(): Promise<void> {
    if (!this.cacheDb) return;
    
    const stores = ['matches', 'standings', 'cache_metadata'];
    
    for (const storeName of stores) {
      const transaction = this.cacheDb.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      await store.clear();
    }
    
    console.log('Cache cleared');
  }
  
  // Get data source status
  public getStatus(): {
    primarySource: DataSource;
    fallbackSource: DataSource;
    cacheEnabled: boolean;
  } {
    return {
      primarySource: this.primarySource,
      fallbackSource: this.fallbackSource,
      cacheEnabled: this.useCache
    };
  }
}

// Export singleton instance
export const dataService = new DataService();