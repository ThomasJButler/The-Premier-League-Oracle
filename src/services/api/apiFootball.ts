import type { Match, Season, TeamForm, Standing } from '../../types';

interface ApiFootballConfig {
  apiKey: string;
  baseUrl: string;
  leagueId: number; // Premier League = 39
}

interface AFTeam {
  id: number;
  name: string;
  logo: string;
  winner?: boolean;
}

interface AFVenue {
  id: number | null;
  name: string | null;
  city: string | null;
}

interface AFStatus {
  long: string;
  short: string;
  elapsed: number | null;
}

interface AFLeague {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string;
  season: number;
  round: string;
}

interface AFGoals {
  home: number | null;
  away: number | null;
}

interface AFScore {
  halftime: AFGoals;
  fulltime: AFGoals;
  extratime: AFGoals;
  penalty: AFGoals;
}

interface AFFixture {
  id: number;
  referee: string | null;
  timezone: string;
  date: string;
  timestamp: number;
  periods: {
    first: number | null;
    second: number | null;
  };
  venue: AFVenue;
  status: AFStatus;
}

interface AFFixtureResponse {
  fixture: AFFixture;
  league: AFLeague;
  teams: {
    home: AFTeam;
    away: AFTeam;
  };
  goals: AFGoals;
  score: AFScore;
  events?: AFEvent[];
  lineups?: AFLineup[];
  statistics?: AFStatistic[];
  players?: AFPlayerStatistic[];
}

interface AFEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: AFTeam;
  player: {
    id: number;
    name: string;
  };
  assist: {
    id: number | null;
    name: string | null;
  };
  type: string;
  detail: string;
  comments: string | null;
}

interface AFLineup {
  team: AFTeam;
  coach: {
    id: number;
    name: string;
    photo: string;
  };
  formation: string;
  startXI: Array<{
    player: {
      id: number;
      name: string;
      number: number;
      pos: string;
      grid: string;
    };
  }>;
  substitutes: Array<{
    player: {
      id: number;
      name: string;
      number: number;
      pos: string;
      grid: null;
    };
  }>;
}

interface AFStatistic {
  team: AFTeam;
  statistics: Array<{
    type: string;
    value: any;
  }>;
}

interface AFPlayerStatistic {
  team: AFTeam;
  players: Array<{
    player: {
      id: number;
      name: string;
      photo: string;
    };
    statistics: Array<{
      games: {
        minutes: number;
        number: number;
        position: string;
        rating: string | null;
        captain: boolean;
        substitute: boolean;
      };
      shots: {
        total: number | null;
        on: number | null;
      };
      goals: {
        total: number | null;
        conceded: number | null;
        assists: number | null;
        saves: number | null;
      };
      passes: {
        total: number | null;
        key: number | null;
        accuracy: string | null;
      };
      tackles: {
        total: number | null;
        blocks: number | null;
        interceptions: number | null;
      };
      duels: {
        total: number | null;
        won: number | null;
      };
      dribbles: {
        attempts: number | null;
        success: number | null;
        past: number | null;
      };
      fouls: {
        drawn: number | null;
        committed: number | null;
      };
      cards: {
        yellow: number;
        red: number;
      };
      penalty: {
        won: number | null;
        commited: number | null;
        scored: number | null;
        missed: number | null;
        saved: number | null;
      };
    }>;
  }>;
}

interface AFStandingTeam {
  id: number;
  name: string;
  logo: string;
}

interface AFStandingEntry {
  rank: number;
  team: AFStandingTeam;
  points: number;
  goalsDiff: number;
  group: string;
  form: string;
  status: string;
  description: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  home: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  away: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  update: string;
}

interface AFStandingResponse {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
    standings: AFStandingEntry[][];
  };
}

interface AFSeasonInfo {
  year: number;
  start: string;
  end: string;
  current: boolean;
  coverage: {
    fixtures: {
      events: boolean;
      lineups: boolean;
      statistics_fixtures: boolean;
      statistics_players: boolean;
    };
    standings: boolean;
    players: boolean;
    top_scorers: boolean;
    top_assists: boolean;
    top_cards: boolean;
    injuries: boolean;
    predictions: boolean;
    odds: boolean;
  };
}

interface AFLeagueResponse {
  league: {
    id: number;
    name: string;
    type: string;
    logo: string;
  };
  country: {
    name: string;
    code: string;
    flag: string;
  };
  seasons: AFSeasonInfo[];
}

interface AFTopScorer {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    age: number;
    birth: {
      date: string;
      place: string;
      country: string;
    };
    nationality: string;
    height: string;
    weight: string;
    injured: boolean;
    photo: string;
  };
  statistics: Array<{
    team: {
      id: number;
      name: string;
      logo: string;
    };
    league: {
      id: number;
      name: string;
      country: string;
      logo: string;
      flag: string;
      season: number;
    };
    games: {
      appearences: number;
      lineups: number;
      minutes: number;
      number: number | null;
      position: string;
      rating: string | null;
      captain: boolean;
    };
    substitutes: {
      in: number;
      out: number;
      bench: number;
    };
    shots: {
      total: number | null;
      on: number | null;
    };
    goals: {
      total: number;
      conceded: number | null;
      assists: number | null;
      saves: number | null;
    };
    passes: {
      total: number | null;
      key: number | null;
      accuracy: number | null;
    };
    tackles: {
      total: number | null;
      blocks: number | null;
      interceptions: number | null;
    };
    duels: {
      total: number | null;
      won: number | null;
    };
    dribbles: {
      attempts: number | null;
      success: number | null;
      past: number | null;
    };
    fouls: {
      drawn: number | null;
      committed: number | null;
    };
    cards: {
      yellow: number;
      yellowred: number;
      red: number;
    };
    penalty: {
      won: number | null;
      commited: number | null;
      scored: number;
      missed: number;
      saved: number | null;
    };
  }>;
}

interface AFInjury {
  player: {
    id: number;
    name: string;
    photo: string;
    type: string;
    reason: string;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
}

interface AFOdds {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
  };
  fixture: {
    id: number;
    timezone: string;
    date: string;
    timestamp: number;
  };
  update: string;
  bookmakers: Array<{
    id: number;
    name: string;
    bets: Array<{
      id: number;
      name: string;
      values: Array<{
        value: string;
        odd: string;
      }>;
    }>;
  }>;
}

interface AFPrediction {
  winner: {
    id: number;
    name: string;
    comment: string;
  };
  win_or_draw: boolean;
  under_over: string | null;
  goals: {
    home: string;
    away: string;
  };
  advice: string;
  percent: {
    home: string;
    draw: string;
    away: string;
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
  };
  teams: {
    home: AFTeam & {
      last_5: {
        form: string;
        att: string;
        def: string;
        goals: {
          for: {
            total: number;
            average: string;
          };
          against: {
            total: number;
            average: string;
          };
        };
      };
    };
    away: AFTeam & {
      last_5: {
        form: string;
        att: string;
        def: string;
        goals: {
          for: {
            total: number;
            average: string;
          };
          against: {
            total: number;
            average: string;
          };
        };
      };
    };
  };
  comparison: {
    form: {
      home: string;
      away: string;
    };
    att: {
      home: string;
      away: string;
    };
    def: {
      home: string;
      away: string;
    };
    poisson_distribution: {
      home: string;
      away: string;
    };
    h2h: {
      home: string;
      away: string;
    };
    goals: {
      home: string;
      away: string;
    };
    total: {
      home: string;
      away: string;
    };
  };
  h2h: AFFixtureResponse[];
}

class ApiFootballAPI {
  private config: ApiFootballConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  
  constructor() {
    const envKey = import.meta.env.VITE_API_FOOTBALL_KEY;
    const savedApiKey = localStorage.getItem('api_football_key');
    const apiKey = envKey || savedApiKey || '';
    
    this.config = {
      apiKey,
      baseUrl: 'https://v3.football.api-sports.io',
      leagueId: 39 // Premier League
    };
    
    console.log(`⚽ API-Football: Initialized, API key: ${apiKey ? 'Present' : 'Missing'}`);
  }
  
  public setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    localStorage.setItem('api_football_key', apiKey);
    this.cache.clear();
    console.log(`⚽ API-Football: API key updated`);
  }
  
  public hasApiKey(): boolean {
    return !!this.config.apiKey;
  }

  public clearApiKey(): void {
    this.config.apiKey = '';
    localStorage.removeItem('api_football_key');
    this.cache.clear();
  }
  
  private async fetchWithCache<T>(endpoint: string, params: Record<string, any> = {}): Promise<T | null> {
    const queryString = new URLSearchParams(params).toString();
    const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
    const cacheKey = fullEndpoint;
    
    // Check if API key is configured
    if (!this.config.apiKey) {
      console.error('🔴 API-Football: No API key configured. Please add your API key in Settings.');
      return null;
    }
    
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`Using cached data for ${endpoint}`);
      return cached.data;
    }
    
    try {
      const url = `${this.config.baseUrl}${fullEndpoint}`;
      console.log(`🔷 API-Football: Fetching ${endpoint}...`);
      
      // Use direct API-Football headers (not RapidAPI)
      const response = await fetch(url, {
        headers: {
          'x-apisports-key': this.config.apiKey
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          console.error('🔴 API-Football: Authentication failed (403). Please check your API key.');
          throw new Error('API authentication failed. Please check your API key in Settings.');
        }
        if (response.status === 429) {
          console.error('🔴 API-Football: Rate limit exceeded (429). Please wait and try again.');
          throw new Error('API rate limit exceeded. Please wait a moment and try again.');
        }
        console.error(`🔴 API-Football: Request failed with status ${response.status}`);
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.errors && Object.keys(data.errors).length > 0) {
        // Log detailed error information
        const errorKeys = Object.keys(data.errors);
        const errorMessages = errorKeys.map(key => `${key}: ${data.errors[key]}`).join(', ');
        console.error(`🔴 API-Football errors: ${errorMessages}`);
        
        // Check for specific error types
        if (data.errors.token) {
          console.error('🔴 API-Football: Invalid API key. Please check your API key in Settings.');
        } else if (data.errors.requests) {
          console.error('🔴 API-Football: Request quota exceeded. Check your API plan limits.');
        }
        
        return null;
      }
      
      // Cache successful response
      console.log(`✅ API-Football: Successfully fetched ${endpoint}`);
      this.cache.set(cacheKey, {
        data: data.response,
        timestamp: Date.now()
      });
      
      return data.response;
    } catch (error) {
      console.error(`🔴 Error fetching ${endpoint}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }
  
  // Get current season info
  public async getCurrentSeason(): Promise<Season | null> {
    const currentYear = new Date().getFullYear();
    const data = await this.fetchWithCache<AFLeagueResponse[]>('/leagues', {
      id: this.config.leagueId
    });
    
    if (!data || data.length === 0) {
      console.error('No league data found');
      return null;
    }
    
    const leagueInfo = data[0];
    const currentSeason = leagueInfo.seasons.find(s => s.current) || 
                         leagueInfo.seasons.find(s => s.year === currentYear) ||
                         leagueInfo.seasons[leagueInfo.seasons.length - 1];
    
    if (!currentSeason) {
      console.error('No current season found');
      return null;
    }
    
    return {
      id: currentSeason.year.toString(),
      name: `${currentSeason.year}/${currentSeason.year + 1}`,
      start_date: currentSeason.start,
      end_date: currentSeason.end,
      is_current: currentSeason.current,
      created_at: new Date().toISOString()
    };
  }
  
  // Get matches for current season
  public async getMatches(round?: string): Promise<Match[]> {
    const season = await this.getCurrentSeason();
    if (!season) return [];
    
    const params: Record<string, any> = {
      league: this.config.leagueId.toString(),
      season: season.id.toString()
    };
    
    if (round) {
      params.round = `Regular Season - ${round}`;
    }
    
    const data = await this.fetchWithCache<AFFixtureResponse[]>('/fixtures', params);
    
    if (!data) return [];
    
    return data.map(fixture => this.transformMatch(fixture, season.id));
  }
  
  // Get upcoming matches
  public async getUpcomingMatches(days: number = 7): Promise<Match[]> {
    const season = await this.getCurrentSeason();
    if (!season) return [];
    
    const dateFrom = new Date().toISOString().split('T')[0];
    const dateTo = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const data = await this.fetchWithCache<AFFixtureResponse[]>('/fixtures', {
      league: this.config.leagueId.toString(),
      season: season.id.toString(),
      from: dateFrom,
      to: dateTo
    });
    
    if (!data) return [];
    
    return data.map(fixture => this.transformMatch(fixture, season.id));
  }
  
  // Get recent results
  public async getRecentResults(days: number = 7): Promise<Match[]> {
    const season = await this.getCurrentSeason();
    if (!season) return [];
    
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = new Date().toISOString().split('T')[0];
    
    const data = await this.fetchWithCache<AFFixtureResponse[]>('/fixtures', {
      league: this.config.leagueId.toString(),
      season: season.id.toString(),
      from: dateFrom,
      to: dateTo,
      status: 'FT'
    });
    
    if (!data) return [];
    
    return data.map(fixture => this.transformMatch(fixture, season.id));
  }

  // Get recent matches (both past and upcoming)
  public async getRecentMatches(days: number = 7): Promise<Match[]> {
    const season = await this.getCurrentSeason();
    if (!season) return [];
    
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const data = await this.fetchWithCache<AFFixtureResponse[]>('/fixtures', {
      league: this.config.leagueId.toString(),
      season: season.id.toString(),
      from: dateFrom,
      to: dateTo
    });
    
    if (!data) return [];
    
    return data.map(fixture => this.transformMatch(fixture, season.id));
  }

  // Get matches by matchday (round in API-Football terms)
  public async getMatchesByMatchday(matchday: number): Promise<Match[]> {
    return this.getMatches(matchday.toString());
  }

  // Get all matches for current season
  public async getAllMatches(): Promise<Match[]> {
    return this.getMatches();
  }
  
  // Get team matches
  public async getTeamMatches(teamId: number, limit: number = 10): Promise<Match[]> {
    const season = await this.getCurrentSeason();
    if (!season) return [];
    
    const data = await this.fetchWithCache<AFFixtureResponse[]>('/fixtures', {
      team: teamId,
      season: season.id.toString(),
      league: this.config.leagueId.toString(),
      last: limit
    });
    
    if (!data) return [];
    
    return data.map(fixture => this.transformMatch(fixture, season.id));
  }
  
  // Get standings
  public async getStandings(): Promise<Standing[]> {
    const season = await this.getCurrentSeason();
    if (!season) return [];
    
    const data = await this.fetchWithCache<AFStandingResponse[]>('/standings', {
      league: this.config.leagueId.toString(),
      season: season.id.toString()
    });
    
    if (!data || data.length === 0 || !data[0].league.standings[0]) return [];
    
    return data[0].league.standings[0].map(entry => ({
      position: entry.rank,
      team: {
        id: entry.team.id,
        name: entry.team.name,
        shortName: entry.team.name.slice(0, 3).toUpperCase(),
        tla: entry.team.name.slice(0, 3).toUpperCase(),
        crest: entry.team.logo
      },
      playedGames: entry.all.played,
      form: entry.form || '',
      won: entry.all.win,
      draw: entry.all.draw,
      lost: entry.all.lose,
      points: entry.points,
      goalsFor: entry.all.goals.for,
      goalsAgainst: entry.all.goals.against,
      goalDifference: entry.goalsDiff
    }));
  }
  
  // Get head to head
  public async getHeadToHead(matchId: number): Promise<{
    aggregates: {
      homeTeam: { wins: number; draws: number; losses: number };
      awayTeam: { wins: number; draws: number; losses: number };
    };
    matches: Match[];
  } | null> {
    // First get the match details to find the teams
    const matchData = await this.fetchWithCache<AFFixtureResponse[]>('/fixtures', {
      id: matchId
    });
    
    if (!matchData || matchData.length === 0) return null;
    
    const match = matchData[0];
    const homeTeamId = match.teams.home.id;
    const awayTeamId = match.teams.away.id;
    
    // Get H2H data
    const h2hData = await this.fetchWithCache<AFFixtureResponse[]>('/fixtures/headtohead', {
      h2h: `${homeTeamId}-${awayTeamId}`,
      last: 10
    });
    
    if (!h2hData) return null;
    
    // Calculate aggregates
    let homeWins = 0, awayWins = 0, draws = 0;
    
    h2hData.forEach(fixture => {
      if (fixture.goals.home === null || fixture.goals.away === null) return;
      
      const isHomeTeamPlayingHome = fixture.teams.home.id === homeTeamId;
      
      if (fixture.goals.home > fixture.goals.away) {
        if (isHomeTeamPlayingHome) homeWins++;
        else awayWins++;
      } else if (fixture.goals.away > fixture.goals.home) {
        if (isHomeTeamPlayingHome) awayWins++;
        else homeWins++;
      } else {
        draws++;
      }
    });
    
    const season = await this.getCurrentSeason();
    const seasonId = season?.id || '';
    
    return {
      aggregates: {
        homeTeam: { wins: homeWins, draws, losses: awayWins },
        awayTeam: { wins: awayWins, draws, losses: homeWins }
      },
      matches: h2hData.map(fixture => this.transformMatch(fixture, seasonId))
    };
  }
  
  // Transform API-Football fixture to our Match type
  private transformMatch(fixture: AFFixtureResponse, seasonId: string): Match {
    const homeGoals = fixture.goals.home;
    const awayGoals = fixture.goals.away;
    
    let result: 'H' | 'A' | 'D' | null = null;
    if (homeGoals !== null && awayGoals !== null) {
      result = homeGoals > awayGoals ? 'H' : 
               awayGoals > homeGoals ? 'A' : 'D';
    }
    
    let halfTimeResult: 'H' | 'A' | 'D' | null = null;
    if (fixture.score.halftime.home !== null && fixture.score.halftime.away !== null) {
      const htHome = fixture.score.halftime.home;
      const htAway = fixture.score.halftime.away;
      halfTimeResult = htHome > htAway ? 'H' :
                      htAway > htHome ? 'A' : 'D';
    }
    
    // Extract statistics if available
    let homeShots = null, awayShots = null;
    let homeShotsTarget = null, awayShotsTarget = null;
    let homeFouls = null, awayFouls = null;
    let homeCorners = null, awayCorners = null;
    let homeYellows = null, awayYellows = null;
    let homeReds = null, awayReds = null;
    
    if (fixture.statistics && fixture.statistics.length >= 2) {
      const homeStats = fixture.statistics.find(s => s.team.id === fixture.teams.home.id);
      const awayStats = fixture.statistics.find(s => s.team.id === fixture.teams.away.id);
      
      if (homeStats) {
        const stats = homeStats.statistics;
        homeShots = this.extractStatValue(stats, 'Total Shots');
        homeShotsTarget = this.extractStatValue(stats, 'Shots on Goal');
        homeFouls = this.extractStatValue(stats, 'Fouls');
        homeCorners = this.extractStatValue(stats, 'Corner Kicks');
        homeYellows = this.extractStatValue(stats, 'Yellow Cards');
        homeReds = this.extractStatValue(stats, 'Red Cards');
      }
      
      if (awayStats) {
        const stats = awayStats.statistics;
        awayShots = this.extractStatValue(stats, 'Total Shots');
        awayShotsTarget = this.extractStatValue(stats, 'Shots on Goal');
        awayFouls = this.extractStatValue(stats, 'Fouls');
        awayCorners = this.extractStatValue(stats, 'Corner Kicks');
        awayYellows = this.extractStatValue(stats, 'Yellow Cards');
        awayReds = this.extractStatValue(stats, 'Red Cards');
      }
    }
    
    return {
      id: fixture.fixture.id.toString(),
      season_id: seasonId,
      date: fixture.fixture.date,
      home_team: fixture.teams.home.name,
      away_team: fixture.teams.away.name,
      home_goals: homeGoals,
      away_goals: awayGoals,
      result,
      home_odds: null, // Will be fetched separately if needed
      draw_odds: null,
      away_odds: null,
      first_half_home_goals: fixture.score.halftime.home,
      first_half_away_goals: fixture.score.halftime.away,
      full_time_result: result,
      half_time_result: halfTimeResult,
      referee: fixture.fixture.referee,
      home_shots: homeShots,
      away_shots: awayShots,
      home_shots_target: homeShotsTarget,
      away_shots_target: awayShotsTarget,
      home_fouls: homeFouls,
      away_fouls: awayFouls,
      home_corners: homeCorners,
      away_corners: awayCorners,
      home_yellows: homeYellows,
      away_yellows: awayYellows,
      home_reds: homeReds,
      away_reds: awayReds,
      created_at: new Date().toISOString()
    };
  }
  
  private extractStatValue(stats: Array<{ type: string; value: any }>, statType: string): number | null {
    const stat = stats.find(s => s.type === statType);
    if (!stat || stat.value === null) return null;
    return typeof stat.value === 'number' ? stat.value : parseInt(stat.value);
  }
  
  // Get team by name
  public async getTeamByName(teamName: string): Promise<AFTeam | null> {
    const standings = await this.getStandings();
    const standing = standings.find(s => 
      s.team.name.toLowerCase() === teamName.toLowerCase() ||
      s.team.shortName.toLowerCase() === teamName.toLowerCase()
    );
    
    if (standing) {
      return {
        id: standing.team.id,
        name: standing.team.name,
        logo: standing.team.crest
      };
    }
    
    return null;
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
      s.team.name.toLowerCase() === teamName.toLowerCase()
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
  public async getTopScorers(limit: number = 20): Promise<AFTopScorer[]> {
    const season = await this.getCurrentSeason();
    if (!season) return [];
    
    const data = await this.fetchWithCache<AFTopScorer[]>('/players/topscorers', {
      league: this.config.leagueId.toString(),
      season: season.id.toString()
    });
    
    if (!data) return [];
    
    return data.slice(0, limit);
  }
  
  // Get player details
  public async getPlayer(playerId: number): Promise<AFTopScorer['player'] | null> {
    const season = await this.getCurrentSeason();
    if (!season) return null;
    
    const data = await this.fetchWithCache<AFTopScorer[]>('/players', {
      id: playerId,
      season: season.id.toString()
    });
    
    if (!data || data.length === 0) return null;
    
    return data[0].player;
  }
  
  // Get team squad
  public async getTeamSquad(teamId: number): Promise<AFTopScorer['player'][]> {
    const season = await this.getCurrentSeason();
    if (!season) return [];
    
    const data = await this.fetchWithCache<AFTopScorer[]>('/players/squads', {
      team: teamId
    });
    
    if (!data) return [];
    
    return data.map(p => p.player);
  }
  
  // Get live matches (in play)
  public async getLiveMatches(): Promise<Match[]> {
    const season = await this.getCurrentSeason();
    if (!season) return [];
    
    const data = await this.fetchWithCache<AFFixtureResponse[]>('/fixtures', {
      league: this.config.leagueId.toString(),
      live: 'all'
    });
    
    if (!data) return [];
    
    return data.map(fixture => this.transformMatch(fixture, season.id));
  }
  
  // Get injuries for current season
  public async getInjuries(): Promise<AFInjury[]> {
    const season = await this.getCurrentSeason();
    if (!season) return [];
    
    const data = await this.fetchWithCache<AFInjury[]>('/injuries', {
      league: this.config.leagueId.toString(),
      season: season.id.toString()
    });
    
    return data || [];
  }
  
  // Get predictions for a fixture
  public async getPrediction(fixtureId: number): Promise<AFPrediction | null> {
    const data = await this.fetchWithCache<AFPrediction[]>('/predictions', {
      fixture: fixtureId
    });
    
    if (!data || data.length === 0) return null;
    
    return data[0];
  }
  
  // Get odds for a fixture
  public async getOdds(fixtureId: number): Promise<AFOdds | null> {
    const data = await this.fetchWithCache<AFOdds[]>('/odds', {
      fixture: fixtureId
    });
    
    if (!data || data.length === 0) return null;
    
    return data[0];
  }
  
  // Get team details with logo
  public async getTeam(teamId: number): Promise<AFTeam & { crest: string } | null> {
    const data = await this.fetchWithCache<Array<{
      team: AFTeam & {
        founded: number;
        national: boolean;
        logo: string;
      };
      venue: {
        id: number;
        name: string;
        address: string;
        city: string;
        capacity: number;
        surface: string;
        image: string;
      };
    }>>('/teams', {
      id: teamId
    });
    
    if (!data || data.length === 0) return null;
    
    const teamData = data[0].team;
    return {
      ...teamData,
      crest: teamData.logo
    };
  }
  
  // Check if API is configured and working
  public async testConnection(): Promise<boolean> {
    if (!this.hasApiKey()) {
      console.error('No API key configured');
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
export const apiFootball = new ApiFootballAPI();

// Export class for testing
export { ApiFootballAPI };

// Export types
export type { 
  AFFixtureResponse as AFMatch, 
  AFTeam, 
  AFStandingEntry as AFStanding, 
  AFLeagueResponse as AFCompetition, 
  AFTopScorer as AFPlayer,
  AFTopScorer as AFScorer,
  ApiFootballConfig,
  AFInjury,
  AFPrediction,
  AFOdds
};