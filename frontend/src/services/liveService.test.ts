import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Match } from '../types';

// Mock dataService
const mockGetLiveMatches = vi.fn(() => Promise.resolve([] as Match[]));
const mockGetMatches = vi.fn(() => Promise.resolve([] as Match[]));

vi.mock('./dataService', () => ({
  dataService: {
    getLiveMatches: () => mockGetLiveMatches(),
    getMatches: () => mockGetMatches(),
  },
}));

// Mock backendService
const mockIsAvailable = vi.fn(() => Promise.resolve(false));

vi.mock('./backendService', () => ({
  backendService: {
    isAvailable: () => mockIsAvailable(),
  },
}));

// Mock localStorage
const localStorageMock: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { localStorageMock[key] = val; }),
  removeItem: vi.fn((key: string) => { delete localStorageMock[key]; }),
});

// Mock WebSocket — not available in jsdom
// Tracks created instances so tests can simulate incoming messages.
let lastWebSocket: MockWebSocket | null = null;

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn(() => { this.readyState = MockWebSocket.CLOSED; });

  constructor() {
    lastWebSocket = this;
  }

  /** Simulate the server sending a message through the WebSocket */
  simulateMessage(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

vi.stubGlobal('WebSocket', MockWebSocket);

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: '1', season_id: 's1', date: new Date().toISOString(),
    home_team: 'Arsenal', away_team: 'Liverpool',
    home_goals: null, away_goals: null, result: null,
    home_odds: null, draw_odds: null, away_odds: null,
    first_half_home_goals: null, first_half_away_goals: null,
    full_time_result: null, half_time_result: null,
    referee: null, home_shots: null, away_shots: null,
    home_shots_target: null, away_shots_target: null,
    home_fouls: null, away_fouls: null,
    home_corners: null, away_corners: null,
    home_yellows: null, away_yellows: null,
    home_reds: null, away_reds: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Import the module once — tests use stop() to reset between runs
import {
  liveMatchesStore,
  recentMatchesStore,
  upcomingMatchesStore,
  hasLiveMatches,
  pollLabel,
  liveService,
} from './liveService';

describe('LiveService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetLiveMatches.mockResolvedValue([]);
    mockGetMatches.mockResolvedValue([]);
    mockIsAvailable.mockResolvedValue(false);
    Object.keys(localStorageMock).forEach((k) => delete localStorageMock[k]);
    lastWebSocket = null;

    // Reset stores to empty
    liveMatchesStore.set([]);
    recentMatchesStore.set([]);
    upcomingMatchesStore.set([]);
    pollLabel.set('every 30 seconds');

    // Ensure service is stopped between tests
    liveService.stop();
  });

  afterEach(() => {
    liveService.stop();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Store initialisation
  // ---------------------------------------------------------------------------

  it('should export empty stores by default', () => {
    expect(get(liveMatchesStore)).toEqual([]);
    expect(get(recentMatchesStore)).toEqual([]);
    expect(get(upcomingMatchesStore)).toEqual([]);
    expect(get(hasLiveMatches)).toBe(false);
    expect(get(pollLabel)).toBe('every 30 seconds');
  });

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------

  it('should populate stores after start()', async () => {
    const liveMatch = makeMatch({ id: 'live1', status: 'IN_PLAY', home_goals: 1, away_goals: 0 });
    const recentMatch = makeMatch({
      id: 'recent1',
      date: new Date(Date.now() - 86400000).toISOString(),
      result: 'H',
      home_goals: 2,
      away_goals: 0,
    });
    const upcomingMatch = makeMatch({
      id: 'upcoming1',
      date: new Date(Date.now() + 86400000).toISOString(),
    });

    mockGetLiveMatches.mockResolvedValue([liveMatch]);
    mockGetMatches.mockResolvedValue([recentMatch, upcomingMatch]);

    await liveService.start();

    expect(get(liveMatchesStore)).toEqual([liveMatch]);
    expect(get(recentMatchesStore)).toHaveLength(1);
    expect(get(upcomingMatchesStore)).toHaveLength(1);
    expect(get(hasLiveMatches)).toBe(true);
  });

  it('should be idempotent — calling start() twice is a no-op', async () => {
    await liveService.start();
    await liveService.start(); // second call should not re-fetch

    expect(mockGetLiveMatches).toHaveBeenCalledTimes(1);
  });

  it('should refresh data when refresh() is called', async () => {
    await liveService.start();

    mockGetLiveMatches.mockResolvedValue([makeMatch({ status: 'IN_PLAY', home_goals: 2, away_goals: 1 })]);

    await liveService.refresh();

    expect(get(liveMatchesStore)).toHaveLength(1);
    expect(mockGetLiveMatches).toHaveBeenCalledTimes(2); // initial + refresh
  });

  it('should handle getLiveMatches failure gracefully', async () => {
    mockGetLiveMatches.mockRejectedValue(new Error('API error'));
    mockGetMatches.mockResolvedValue([]);

    await liveService.start();

    // Should not throw, stores should be empty
    expect(get(liveMatchesStore)).toEqual([]);
    expect(get(recentMatchesStore)).toEqual([]);
  });

  it('should handle getMatches failure gracefully', async () => {
    mockGetLiveMatches.mockResolvedValue([]);
    mockGetMatches.mockRejectedValue(new Error('Network error'));

    await liveService.start();

    // Live store should be populated but recent/upcoming retain defaults
    expect(get(liveMatchesStore)).toEqual([]);
  });

  it('should sort recent matches newest first and upcoming matches soonest first', async () => {
    const older = makeMatch({
      id: 'r1',
      date: new Date(Date.now() - 2 * 86400000).toISOString(),
      result: 'H', home_goals: 1, away_goals: 0,
    });
    const newer = makeMatch({
      id: 'r2',
      date: new Date(Date.now() - 86400000).toISOString(),
      result: 'A', home_goals: 0, away_goals: 1,
    });
    const soon = makeMatch({
      id: 'u1',
      date: new Date(Date.now() + 86400000).toISOString(),
    });
    const later = makeMatch({
      id: 'u2',
      date: new Date(Date.now() + 3 * 86400000).toISOString(),
    });

    mockGetMatches.mockResolvedValue([older, newer, soon, later]);

    await liveService.start();

    const recent = get(recentMatchesStore);
    expect(recent[0].id).toBe('r2'); // newer first
    expect(recent[1].id).toBe('r1');

    const upcoming = get(upcomingMatchesStore);
    expect(upcoming[0].id).toBe('u1'); // sooner first
    expect(upcoming[1].id).toBe('u2');
  });

  // ---------------------------------------------------------------------------
  // Adaptive polling intervals
  // ---------------------------------------------------------------------------

  it('should set poll label to "every 30 seconds" when live matches exist', async () => {
    mockGetLiveMatches.mockResolvedValue([makeMatch({ status: 'IN_PLAY', home_goals: 1, away_goals: 0 })]);

    await liveService.start();

    expect(get(pollLabel)).toBe('every 30 seconds');
  });

  it('should set poll label to "every 30 minutes" when idle', async () => {
    await liveService.start();

    expect(get(pollLabel)).toBe('every 30 minutes');
  });

  // ---------------------------------------------------------------------------
  // Stop and cleanup
  // ---------------------------------------------------------------------------

  it('should stop polling on stop()', async () => {
    await liveService.start();

    expect(liveService.isRunning()).toBe(true);

    liveService.stop();

    expect(liveService.isRunning()).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // WebSocket
  // ---------------------------------------------------------------------------

  it('should not connect WebSocket when use_backend is not set', async () => {
    await liveService.start();

    expect(liveService.isWebSocketConnected()).toBe(false);
  });

  it('should not connect WebSocket when backend is unavailable', async () => {
    localStorageMock['use_backend'] = 'true';
    mockIsAvailable.mockResolvedValue(false);

    await liveService.start();

    expect(liveService.isWebSocketConnected()).toBe(false);
  });

  it('should attempt WebSocket when backend is enabled and available', async () => {
    localStorageMock['use_backend'] = 'true';
    mockIsAvailable.mockResolvedValue(true);

    await liveService.start();

    // WebSocket constructor was called (mock always reports OPEN)
    expect(liveService.isWebSocketConnected()).toBe(true);
  });

  it('should handle WebSocket messages without crashing', async () => {
    localStorageMock['use_backend'] = 'true';
    mockIsAvailable.mockResolvedValue(true);

    await liveService.start();
    expect(lastWebSocket).not.toBeNull();

    // WebSocket receives a valid JSON message — should parse without error
    lastWebSocket!.simulateMessage({ predictions: { home: 0.5, draw: 0.3, away: 0.2 } });

    // Live store is only updated by polling, not WebSocket (backend sends predictions, not live matches)
    const storeValue = get(liveMatchesStore);
    expect(storeValue).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Derived store
  // ---------------------------------------------------------------------------

  it('hasLiveMatches should be reactive', () => {
    expect(get(hasLiveMatches)).toBe(false);

    liveMatchesStore.set([makeMatch({ status: 'IN_PLAY' })]);
    expect(get(hasLiveMatches)).toBe(true);

    liveMatchesStore.set([]);
    expect(get(hasLiveMatches)).toBe(false);
  });
});
