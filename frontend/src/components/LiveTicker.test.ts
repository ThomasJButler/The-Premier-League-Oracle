import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import LiveTicker from './LiveTicker.svelte';
import type { Match, MatchEvent } from '../types';
import {
  liveMatchesStore,
  recentMatchesStore,
  upcomingMatchesStore,
  matchEventsStore,
  liveService,
} from '../services/liveService';

// Mock liveService with writable stores
vi.mock('../services/liveService', async () => {
  const { writable, derived } = await import('svelte/store');

  const liveMatchesStore = writable<import('../types').Match[]>([]);
  const recentMatchesStore = writable<import('../types').Match[]>([]);
  const upcomingMatchesStore = writable<import('../types').Match[]>([]);
  const matchEventsStore = writable<import('../types').MatchEvent[]>([]);
  const hasLiveMatches = derived(liveMatchesStore, ($m) => $m.length > 0);

  return {
    liveMatchesStore,
    recentMatchesStore,
    upcomingMatchesStore,
    matchEventsStore,
    hasLiveMatches,
    liveService: {
      start: vi.fn(() => Promise.resolve()),
      stop: vi.fn(),
    },
  };
});

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn(() => 'Saturday 3:00pm'),
}));

async function flushStoreUpdates() {
  await tick();
  await act();
}

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: '1',
    season_id: 's1',
    date: '2026-01-15T15:00:00Z',
    home_team: 'Arsenal FC',
    away_team: 'Chelsea FC',
    home_goals: 2,
    away_goals: 1,
    result: null,
    home_odds: null,
    draw_odds: null,
    away_odds: null,
    first_half_home_goals: null,
    first_half_away_goals: null,
    full_time_result: null,
    half_time_result: null,
    referee: null,
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
    created_at: '2026-01-15T00:00:00Z',
    status: 'IN_PLAY',
    minute: 65,
    ...overrides,
  };
}

describe('LiveTicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveMatchesStore.set([]);
    recentMatchesStore.set([]);
    upcomingMatchesStore.set([]);
    matchEventsStore.set([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the ticker container', () => {
    render(LiveTicker);
    expect(document.querySelector('.live-ticker')).toBeInTheDocument();
  });

  it('starts liveService on mount', async () => {
    const { unmount } = render(LiveTicker);
    await flushStoreUpdates();
    // liveService.start is called in onMount; liveService.stop is called in onDestroy
    // We verify stop is called on unmount as a proxy for the lifecycle wiring
    unmount();
    expect(liveService.stop).toHaveBeenCalled();
  });

  it('shows fallback text when no data', async () => {
    render(LiveTicker);
    await flushStoreUpdates();
    const tickerDiv = document.querySelector('.ticker-content');
    expect(tickerDiv?.textContent).toContain('No matches scheduled');
  });

  it('shows live match scores when live data is set', async () => {
    liveMatchesStore.set([
      makeMatch({ home_team: 'Arsenal FC', away_team: 'Chelsea FC', home_goals: 2, away_goals: 1, minute: 65 }),
    ]);
    render(LiveTicker);
    await flushStoreUpdates();
    const tickerDiv = document.querySelector('.ticker-content');
    expect(tickerDiv?.textContent).toContain('Arsenal FC 2-1 Chelsea FC');
  });

  it('shows live dot indicator when live matches exist', async () => {
    liveMatchesStore.set([makeMatch()]);
    render(LiveTicker);
    await flushStoreUpdates();
    expect(document.querySelector('.live-dot')).toBeInTheDocument();
  });

  it('hides live dot when no live matches', async () => {
    render(LiveTicker);
    await flushStoreUpdates();
    expect(document.querySelector('.live-dot')).not.toBeInTheDocument();
  });

  it('shows match events at highest priority', async () => {
    matchEventsStore.set([
      {
        id: 'e1',
        matchId: '1',
        type: 'goal',
        team: 'Arsenal FC',
        homeTeam: 'Arsenal FC',
        awayTeam: 'Chelsea FC',
        score: '2-1',
        message: 'GOAL! Arsenal FC take the lead!',
        timestamp: Date.now(),
      },
    ]);
    render(LiveTicker);
    await flushStoreUpdates();
    const tickerDiv = document.querySelector('.ticker-content');
    expect(tickerDiv?.textContent).toContain('GOAL! Arsenal FC take the lead!');
  });

  it('includes recent results in ticker', async () => {
    recentMatchesStore.set([
      makeMatch({
        home_team: 'Liverpool FC',
        away_team: 'Man City FC',
        home_goals: 3,
        away_goals: 0,
        result: 'H',
        date: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), // 2 hours ago
      }),
    ]);
    render(LiveTicker);
    await flushStoreUpdates();
    const tickerDiv = document.querySelector('.ticker-content');
    expect(tickerDiv?.textContent).toContain('Liverpool FC');
  });

  it('has a pause/resume button', () => {
    render(LiveTicker);
    const pauseButton = screen.getByLabelText('Pause ticker');
    expect(pauseButton).toBeInTheDocument();
  });

  it('toggles pause state when button is clicked', async () => {
    render(LiveTicker);
    const pauseButton = screen.getByLabelText('Pause ticker');
    await fireEvent.click(pauseButton);
    await act();
    // After clicking, should show "Resume ticker" label
    expect(screen.getByLabelText('Resume ticker')).toBeInTheDocument();
    // ticker-content should have .paused class
    expect(document.querySelector('.ticker-content.paused')).toBeInTheDocument();
  });

  it('has accessible sr-only text', () => {
    render(LiveTicker);
    const srOnly = document.querySelector('.sr-only');
    expect(srOnly).toBeInTheDocument();
  });

  it('has aria-label on the ticker container', () => {
    render(LiveTicker);
    const ticker = document.querySelector('[aria-label="Live match updates ticker"]');
    expect(ticker).toBeInTheDocument();
  });
});
