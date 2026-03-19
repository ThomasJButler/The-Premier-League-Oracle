import type { Match, MatchStatus, Season, TeamForm } from '../../types';
import { getSeasonYear } from '../../lib/utils';

/** Football-Data.org competition ID for the Premier League */
const PREMIER_LEAGUE_ID = 2021;

interface FootballDataConfig {
  apiKey: string;
  baseUrl: string;
  competitionId: number;
}

interface FDTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

interface FDScore {
  home: number | null;
  away: number | null;
}

interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  minute: number | null;
  stage: string;
  group: null;
  lastUpdated: string;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
    duration: string;
    fullTime: FDScore;
    halfTime: FDScore;
  };
  odds?: {
    msg: string;
    homeWin?: number;
    draw?: number;
    awayWin?: number;
  };
  referees?: Array<{
    id: number;
    name: string;
    type: string;
    nationality: string;
  }>;
}

interface FDStanding {
  position: number;
  team: FDTeam;
  playedGames: number;
  form: string;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface FDCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
  currentSeason: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
    winner: null | FDTeam;
  };
}

interface FDPlayer {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  position: string;
  shirtNumber: number | null;
  lastUpdated: string;
}

interface FDScorer {
  player: FDPlayer;
  team: FDTeam;
  goals: number;
  assists: number | null;
  penalties: number | null;
}

class FootballDataAPI {
  private config: FootballDataConfig;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  // Real API needs 6s between requests (free tier: 10/min).
  // Dev proxy has no rate limit, so use a shorter delay to keep the UI snappy.
  private rateLimitDelay = import.meta.env.DEV ? 200 : 6000;
  private lastRequestTime = 0;
  // Promise-based queue: each request chains onto the previous one so that
  // concurrent callers are serialised and the rate-limit gap is guaranteed.
  private requestQueue: Promise<void> = Promise.resolve();

  constructor() {
    const envKey = import.meta.env.VITE_FOOTBALL_DATA_API_KEY;
    const savedApiKey = localStorage.getItem('football_data_api_key');
    const apiKey = envKey || savedApiKey || '';
    
    // Use proxy in development to avoid CORS issues
    const isDevelopment = import.meta.env.DEV;
    const baseUrl = isDevelopment 
      ? '/api/football-data' 
      : 'https://api.football-data.org/v4';
    
    this.config = {
      apiKey,
      baseUrl,
      competitionId: PREMIER_LEAGUE_ID
    };
    
    // Football-Data API initialised: mode, API key status
  }
  
  public setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    localStorage.setItem('football_data_api_key', apiKey);
    // Clear cache when API key changes
    this.cache.clear();
    // Football-Data API: API key updated
  }
  
  public hasApiKey(): boolean {
    return !!this.config.apiKey;
  }

  public clearApiKey(): void {
    this.config.apiKey = '';
    localStorage.removeItem('football_data_api_key');
    this.cache.clear();
  }
  
  /** Timeout for individual fetch requests (15s). Prevents a hung API call from
   *  blocking the entire rate-limit queue indefinitely. */
  private static readonly FETCH_TIMEOUT = 15_000;

  private async rateLimitedFetch(url: string): Promise<Response> {
    // Chain onto the queue so concurrent callers are serialised.
    // Without this, two simultaneous calls would both read the same
    // lastRequestTime and fire within milliseconds of each other,
    // blowing past the API rate limit.
    return new Promise<Response>((resolve, reject) => {
      this.requestQueue = this.requestQueue.then(async () => {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.rateLimitDelay) {
          await new Promise(r => setTimeout(r, this.rateLimitDelay - timeSinceLastRequest));
        }

        this.lastRequestTime = Date.now();

        // AbortController ensures a hung API call fails fast rather than
        // blocking the rate-limit queue indefinitely (P5t).
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FootballDataAPI.FETCH_TIMEOUT);

        try {
          const response = await fetch(url, {
            headers: {
              'X-Auth-Token': this.config.apiKey
            },
            signal: controller.signal,
            mode: 'cors',
            credentials: 'same-origin'
          });
          resolve(response);
        } catch (err) {
          reject(err);
        } finally {
          clearTimeout(timeoutId);
        }
      });
    });
  }
  
  private async fetchWithCache<T>(endpoint: string, customCacheTimeout?: number): Promise<T | null> {
    const cacheKey = endpoint;
    const cached = this.cache.get(cacheKey);
    const timeout = customCacheTimeout ?? this.cacheTimeout;

    if (cached && Date.now() - cached.timestamp < timeout) {
      return cached.data as T;
    }
    
    try {
      const url = `${this.config.baseUrl}${endpoint}`;
      const response = await this.rateLimitedFetch(url);
      
      if (!response.ok) {
        if (response.status === 403) {
          // Football-Data.org returns 403 for both invalid API keys AND rate-limit
          // exceeded on the free tier. Try to distinguish via response body.
          let detail = '';
          try {
            const body = await response.json();
            detail = body?.message || '';
          } catch { /* ignore parse errors */ }

          const isRateLimit = /rate|limit|quota|too many/i.test(detail);
          if (isRateLimit) {
            console.warn('Rate limit exceeded (403):', detail);
            throw new Error('Rate limit exceeded. The free tier allows 10 requests per minute — please wait and try again.');
          }
          console.error('API authentication failed (403):', detail);
          throw new Error('API authentication failed. Please check your API key.');
        }
        if (response.status === 429) {
          console.warn('Rate limit exceeded (429)');
          throw new Error('Rate limit exceeded. The free tier allows 10 requests per minute — please wait and try again.');
        }
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Cache the successful response
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      return null;
    }
  }
  
  // Get current season info
  public async getCurrentSeason(): Promise<Season | null> {
    const data = await this.fetchWithCache<FDCompetition>(
      `/competitions/${this.config.competitionId}`
    );
    
    if (!data || !data.currentSeason) {
      // Invalid competition data structure received
      return null;
    }
    
    const season = data.currentSeason;
    
    return {
      id: season.id.toString(),
      name: `${new Date(season.startDate).getFullYear()}/${new Date(season.endDate).getFullYear()}`,
      start_date: season.startDate,
      end_date: season.endDate,
      is_current: true,
      created_at: new Date().toISOString(),
      currentMatchday: season.currentMatchday
    };
  }
  
  // Get matches for current season
  public async getMatches(matchday?: number): Promise<Match[]> {
    let endpoint = `/competitions/${this.config.competitionId}/matches`;
    if (matchday) {
      endpoint += `?matchday=${matchday}`;
    }
    
    const data = await this.fetchWithCache<{ matches: FDMatch[] }>(endpoint);
    
    if (!data) return [];
    
    return data.matches.map(this.transformMatch);
  }
  
  // Get upcoming matches
  public async getUpcomingMatches(days: number = 7): Promise<Match[]> {
    const dateFrom = new Date().toISOString().split('T')[0];
    const dateTo = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const endpoint = `/competitions/${this.config.competitionId}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const data = await this.fetchWithCache<{ matches: FDMatch[] }>(endpoint);
    
    if (!data) return [];
    
    return data.matches.map(this.transformMatch);
  }
  
  // Get recent matches (both past and upcoming)
  public async getRecentMatches(days: number = 7): Promise<Match[]> {
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const endpoint = `/competitions/${this.config.competitionId}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const data = await this.fetchWithCache<{ matches: FDMatch[] }>(endpoint);
    
    if (!data) return [];
    
    return data.matches.map(this.transformMatch);
  }

  // Get matches by matchday
  public async getMatchesByMatchday(matchday: number): Promise<Match[]> {
    return this.getMatches(matchday);
  }

  // Get all matches for current season
  public async getAllMatches(): Promise<Match[]> {
    return this.getMatches();
  }

  // Get finished matches for a specific season (e.g. 2024 for 2024/25)
  public async getMatchesBySeason(season: number): Promise<Match[]> {
    const endpoint = `/competitions/${this.config.competitionId}/matches?season=${season}&status=FINISHED`;
    const data = await this.fetchWithCache<{ matches: FDMatch[] }>(endpoint, 24 * 60 * 60 * 1000);

    if (!data) return [];

    return data.matches.map(this.transformMatch);
  }
  
  // Get team matches
  public async getTeamMatches(teamId: number, limit: number = 10): Promise<Match[]> {
    const endpoint = `/teams/${teamId}/matches?limit=${limit}`;
    const data = await this.fetchWithCache<{ matches: FDMatch[] }>(endpoint);
    
    if (!data) return [];
    
    return data.matches.map(this.transformMatch);
  }
  
  // Get standings
  public async getStandings(): Promise<FDStanding[]> {
    const endpoint = `/competitions/${this.config.competitionId}/standings`;
    const data = await this.fetchWithCache<{
      standings: Array<{
        stage: string;
        type: string;
        group: null;
        table: FDStanding[];
      }>;
    }>(endpoint);
    
    if (!data || !data.standings[0]) return [];
    
    return data.standings[0].table;
  }
  
  // Transform Football-Data match to our Match type
  private transformMatch(fdMatch: FDMatch): Match {
    const result = fdMatch.score.winner === 'HOME_TEAM' ? 'H' :
                  fdMatch.score.winner === 'AWAY_TEAM' ? 'A' :
                  fdMatch.score.winner === 'DRAW' ? 'D' : null;
    
    const halfTimeResult = fdMatch.score.halfTime.home === null || fdMatch.score.halfTime.home === undefined ||
                           fdMatch.score.halfTime.away === null || fdMatch.score.halfTime.away === undefined ? null :
                           fdMatch.score.halfTime.home > fdMatch.score.halfTime.away ? 'H' :
                           fdMatch.score.halfTime.home < fdMatch.score.halfTime.away ? 'A' : 'D';
    
    // Derive season year from match date (July onwards = new season)
    const matchDate = new Date(fdMatch.utcDate);
    const seasonYear = getSeasonYear(matchDate);

    return {
      id: fdMatch.id.toString(),
      season_id: String(seasonYear),
      date: fdMatch.utcDate,
      home_team: fdMatch.homeTeam.name,
      away_team: fdMatch.awayTeam.name,
      home_goals: fdMatch.score.fullTime.home,
      away_goals: fdMatch.score.fullTime.away,
      result: result as 'H' | 'A' | 'D' | null,
      home_odds: fdMatch.odds?.homeWin ?? null,
      draw_odds: fdMatch.odds?.draw ?? null,
      away_odds: fdMatch.odds?.awayWin ?? null,
      first_half_home_goals: fdMatch.score.halfTime.home,
      first_half_away_goals: fdMatch.score.halfTime.away,
      full_time_result: result as 'H' | 'A' | 'D' | null,
      half_time_result: halfTimeResult as 'H' | 'A' | 'D' | null,
      referee: fdMatch.referees?.[0]?.name || null,
      // These fields not available in free tier, will need other sources
      home_shots: null,
      away_shots: null,
      home_shots_target: null,
      away_shots_target: null,
      home_fouls: null,
      away_fouls: null,
      home_corners: null,
      away_corners: null,
      home_yellows: null,
      away_yellows: null,
      home_reds: null,
      away_reds: null,
      created_at: new Date().toISOString(),
      status: fdMatch.status as MatchStatus,
      minute: fdMatch.minute ?? null,
      matchday: fdMatch.matchday
    };
  }
  
  // Get team by name (useful for matching with our data)
  public async getTeamByName(teamName: string): Promise<FDTeam | null> {
    const standings = await this.getStandings();
    const standing = standings.find(s => 
      s.team.name.toLowerCase() === teamName.toLowerCase() ||
      s.team.shortName.toLowerCase() === teamName.toLowerCase()
    );
    
    return standing?.team || null;
  }
  
  // Calculate team stats from standings and recent matches
  public async getTeamStats(teamName: string): Promise<{
    position: number;
    points: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    form: string;
    recentMatches: Match[];
  } | null> {
    const standings = await this.getStandings();
    const standing = standings.find(s => 
      s.team.name.toLowerCase() === teamName.toLowerCase() ||
      s.team.shortName.toLowerCase() === teamName.toLowerCase()
    );
    
    if (!standing) return null;
    
    const recentMatches = await this.getTeamMatches(standing.team.id, 5);
    
    return {
      position: standing.position,
      points: standing.points,
      played: standing.playedGames,
      wins: standing.won,
      draws: standing.draw,
      losses: standing.lost,
      goalsFor: standing.goalsFor,
      goalsAgainst: standing.goalsAgainst,
      form: standing.form,
      recentMatches
    };
  }

  // Get team form from recent matches
  public async getTeamForm(teamName: string, matches?: Match[]): Promise<TeamForm[] | null> {
    const team = await this.getTeamByName(teamName);
    if (!team) return null;

    // Use provided matches or fetch recent team matches
    const teamMatches = matches?.filter(m => 
      m.home_team.toLowerCase() === teamName.toLowerCase() || 
      m.away_team.toLowerCase() === teamName.toLowerCase()
    ).slice(0, 5) || await this.getTeamMatches(team.id, 5);

    return teamMatches.map(match => {
      const isHome = match.home_team.toLowerCase() === teamName.toLowerCase();
      const opponent = isHome ? match.away_team : match.home_team;
      const goalsFor = isHome ? match.home_goals : match.away_goals;
      const goalsAgainst = isHome ? match.away_goals : match.home_goals;
      
      let result: 'W' | 'L' | 'D' | null = null;
      if (match.result) {
        if (match.result === 'D') result = 'D';
        else if ((isHome && match.result === 'H') || (!isHome && match.result === 'A')) result = 'W';
        else result = 'L';
      }

      return {
        opponent,
        goalsFor,
        goalsAgainst,
        result,
        date: match.date
      };
    });
  }
  
  // Get top scorers for the competition
  public async getTopScorers(limit: number = 20): Promise<FDScorer[]> {
    const endpoint = `/competitions/${this.config.competitionId}/scorers?limit=${limit}`;
    const data = await this.fetchWithCache<{ scorers: FDScorer[] }>(endpoint);
    
    if (!data) return [];
    
    return data.scorers;
  }
  
  // Get live matches (in play) — uses 60s cache for freshness
  public async getLiveMatches(): Promise<Match[]> {
    const endpoint = `/competitions/${this.config.competitionId}/matches?status=IN_PLAY,PAUSED,EXTRA_TIME,PENALTY_SHOOTOUT`;
    const data = await this.fetchWithCache<{ matches: FDMatch[] }>(endpoint, 60_000);

    if (!data) return [];

    return data.matches.map(this.transformMatch);
  }
  
  // Check if API is configured and working
  public async testConnection(): Promise<boolean> {
    if (!this.hasApiKey()) {
      // No API key configured for connection test
      return false;
    }
    
    try {
      const season = await this.getCurrentSeason();
      return !!season;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const footballDataAPI = new FootballDataAPI();

// Export class for testing
export { FootballDataAPI };

// Export types
export type {
  FDMatch,
  FDTeam,
  FDStanding,
  FDCompetition,
  FDScorer
};