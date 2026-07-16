// @vitest-environment jsdom
/**
 * IndexedDB cache layer tests for DataService.
 *
 * Uses fake-indexeddb to provide a real in-memory IndexedDB implementation,
 * allowing us to test the full cache lifecycle: write, read, expiry, and clear.
 *
 * We use a single DataService instance across all tests (no vi.resetModules)
 * because the singleton's constructor chains initializeIndexedDB → checkDataSources,
 * and re-importing after resetModules causes timing issues with the readyPromise.
 */
import { describe, it, expect, beforeAll, beforeEach, vi, afterAll } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import type { Match, Season, Standing } from '../types';

// Override the mock IndexedDB from setup.ts with real fake-indexeddb
// BEFORE any module imports that trigger DataService construction
(globalThis as any).indexedDB = indexedDB;

// Mock betHistoryService
vi.mock('./betting/betHistoryService', () => ({
  betHistoryService: {
    resolveMatchBets: vi.fn()
  }
}));

// Mock sharedEloSystem

// Mock predictionTracker
vi.mock('./predictionTracker', () => ({
  predictionTracker: {
    getAccuracyStats: vi.fn(() => ({
      totalPredictions: 0, correctPredictions: 0, accuracy: 0,
      scoreAccuracy: 0,
      highConfidenceAccuracy: 0, mediumConfidenceAccuracy: 0, lowConfidenceAccuracy: 0,
      homeWinAccuracy: 0, awayWinAccuracy: 0, drawAccuracy: 0,
      averageConfidence: 0, streak: { current: 0, best: 0, worst: 0 }
    })),
    getMatchPredictions: vi.fn(() => []),
    updateWithResult: vi.fn(),
    cleanOldPredictions: vi.fn()
  }
}));

const mockMatches: Match[] = [
  {
    id: 'cache-test-1', season_id: '1',
    date: '2024-10-01T15:00:00Z',
    home_team: 'Arsenal', away_team: 'Chelsea',
    home_goals: 2, away_goals: 0, result: 'H',
    home_odds: null, draw_odds: null, away_odds: null,
    first_half_home_goals: 1, first_half_away_goals: 0,
    full_time_result: 'H', half_time_result: 'H',
    referee: null,
    home_shots: null, away_shots: null,
    home_shots_target: null, away_shots_target: null,
    home_fouls: null, away_fouls: null,
    home_corners: null, away_corners: null,
    home_yellows: null, away_yellows: null,
    home_reds: null, away_reds: null,
    created_at: '2024-10-01'
  }
];

const mockStandings: Standing[] = [
  {
    position: 1,
    team: { id: 1, name: 'Arsenal', shortName: 'ARS', tla: 'ARS', crest: '' },
    playedGames: 10, form: 'WWWDW',
    won: 8, draw: 1, lost: 1,
    points: 25, goalsFor: 22, goalsAgainst: 5, goalDifference: 17
  }
];

const mockSeason: Season = {
  id: '1', name: '2024-2025',
  start_date: '2024-08-01', end_date: '2025-05-31',
  is_current: true, created_at: '2024-01-01'
};

// Mock the football API
const mockApi = {
  hasApiKey: vi.fn(() => true),
  getCurrentSeason: vi.fn(() => Promise.resolve(mockSeason)),
  getAllMatches: vi.fn(() => Promise.resolve(mockMatches)),
  getUpcomingMatches: vi.fn(() => Promise.resolve(mockMatches)),
  getRecentMatches: vi.fn(() => Promise.resolve(mockMatches)),
  getMatchesByMatchday: vi.fn(() => Promise.resolve(mockMatches)),
  getStandings: vi.fn(() => Promise.resolve(mockStandings)),
  getTopScorers: vi.fn(() => Promise.resolve([{ player: { id: 1, name: 'Haaland' }, goals: 10 }])),
  getTeamStats: vi.fn(() => Promise.resolve({
    played: 10, wins: 7, draws: 2, losses: 1,
    goalsFor: 20, goalsAgainst: 8, points: 23
  })),
  getTeamForm: vi.fn(() => Promise.resolve([])),
  getLiveMatches: vi.fn(() => Promise.resolve([])),
  getMatchesBySeason: vi.fn(() => Promise.resolve(mockMatches)),
  getTeamMatches: vi.fn(() => Promise.resolve(mockMatches)),
  clearApiKey: vi.fn(),
  setApiKey: vi.fn(),
  testConnection: vi.fn(() => Promise.resolve(true))
};

vi.mock('./api/footballData', () => ({
  footballDataAPI: mockApi
}));

describe('DataService IndexedDB Cache', () => {
  let dataService: any;

  beforeAll(async () => {
    // Re-apply localStorage mock defaults
    vi.mocked(localStorage.getItem).mockReturnValue(null);

    // Import the DataService — this triggers the constructor and opens fake-indexeddb
    const mod = await import('./dataService');
    dataService = mod.dataService;

    // Wait for the initial readyPromise to settle before tests run
    await dataService.getMatches();
  });

  beforeEach(async () => {
    // Clear call counts but keep mock implementations intact
    vi.clearAllMocks();

    // Re-apply mock defaults after clearAllMocks
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    mockApi.hasApiKey.mockReturnValue(true);
    mockApi.getCurrentSeason.mockResolvedValue(mockSeason);
    mockApi.getAllMatches.mockResolvedValue(mockMatches);
    mockApi.getStandings.mockResolvedValue(mockStandings);
    mockApi.getUpcomingMatches.mockResolvedValue(mockMatches);
    mockApi.getRecentMatches.mockResolvedValue(mockMatches);
    mockApi.getTopScorers.mockResolvedValue([{ player: { id: 1, name: 'Haaland' }, goals: 10 }]);
    mockApi.getTeamStats.mockResolvedValue({
      played: 10, wins: 7, draws: 2, losses: 1,
      goalsFor: 20, goalsAgainst: 8, points: 23
    });

    // Clear the IndexedDB cache between tests so each test starts fresh
    await dataService.clearCache();

    // clearCache preserves the API key but resets the data source availability check, so re-enable it
    mockApi.hasApiKey.mockReturnValue(true);
    await dataService.refreshApiConfiguration();

  });

  it('creates IndexedDB object stores on first open', async () => {
    // Verify by opening the DB directly and checking store names
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('PremierLeagueOracle', 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(db.objectStoreNames.contains('matches')).toBe(true);
    expect(db.objectStoreNames.contains('standings')).toBe(true);
    expect(db.objectStoreNames.contains('teamStats')).toBe(true);
    expect(db.objectStoreNames.contains('scorers')).toBe(true);
    db.close();
  });

  it('caches matches after first API call', async () => {
    // First call — hits the API
    const first = await dataService.getMatches();
    expect(first).toEqual(mockMatches);
    expect(mockApi.getAllMatches).toHaveBeenCalledTimes(1);

    // Second call — served from IndexedDB cache
    const second = await dataService.getMatches();
    expect(second).toEqual(mockMatches);
    expect(mockApi.getAllMatches).toHaveBeenCalledTimes(1);
  });

  it('caches standings after first API call', async () => {
    const first = await dataService.getStandings();
    expect(first).toEqual(mockStandings);
    expect(mockApi.getStandings).toHaveBeenCalledTimes(1);

    const second = await dataService.getStandings();
    expect(second).toEqual(mockStandings);
    expect(mockApi.getStandings).toHaveBeenCalledTimes(1);
  });

  it('re-fetches from API when cache entry expires', async () => {
    // Populate cache
    await dataService.getMatches();
    expect(mockApi.getAllMatches).toHaveBeenCalledTimes(1);

    // Advance time past the 5-minute default TTL
    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 6 * 60 * 1000;

    try {
      await dataService.getMatches();
      // Cache miss — API called again
      expect(mockApi.getAllMatches).toHaveBeenCalledTimes(2);
    } finally {
      Date.now = realDateNow;
    }
  });

  it('clearCache removes all cached entries', async () => {
    // Populate cache with both matches and standings
    await dataService.getMatches();
    await dataService.getStandings();
    expect(mockApi.getAllMatches).toHaveBeenCalledTimes(1);
    expect(mockApi.getStandings).toHaveBeenCalledTimes(1);

    // Clear
    await dataService.clearCache();
    mockApi.hasApiKey.mockReturnValue(true);
    await dataService.refreshApiConfiguration();

    // Next calls hit the API again
    await dataService.getMatches();
    await dataService.getStandings();
    expect(mockApi.getAllMatches).toHaveBeenCalledTimes(2);
    expect(mockApi.getStandings).toHaveBeenCalledTimes(2);
  });

  it('uses separate cache keys for different match query types', async () => {
    await dataService.getMatches(); // all matches
    await dataService.getMatches({ upcoming: true, days: 7 }); // upcoming
    await dataService.getMatches({ recent: true, days: 14 }); // recent

    // Each is a distinct cache key — all three hit the API
    expect(mockApi.getAllMatches).toHaveBeenCalledTimes(1);
    expect(mockApi.getUpcomingMatches).toHaveBeenCalledTimes(1);
    expect(mockApi.getRecentMatches).toHaveBeenCalledTimes(1);
  });

  it('caches team stats independently per team name', async () => {
    await dataService.getTeamStats('Arsenal');
    await dataService.getTeamStats('Chelsea');
    expect(mockApi.getTeamStats).toHaveBeenCalledTimes(2);

    // Repeat Arsenal — should be cached
    await dataService.getTeamStats('Arsenal');
    expect(mockApi.getTeamStats).toHaveBeenCalledTimes(2);
  });

  it('clearCache preserves the API key in localStorage', async () => {
    await dataService.clearCache();

    // API key should NOT be removed when clearing cache — it's a user credential, not cached data
    expect(localStorage.removeItem).not.toHaveBeenCalledWith('football_data_api_key');
    expect(mockApi.clearApiKey).not.toHaveBeenCalled();
  });
});
