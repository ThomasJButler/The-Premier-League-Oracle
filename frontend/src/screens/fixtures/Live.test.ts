import { act, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Live from './Live.svelte';

vi.mock('../../services/dataService', () => ({
  dataService: {
    getLiveMatches: vi.fn().mockResolvedValue([]),
    getLastFetched: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getMatchPredictions: vi.fn().mockReturnValue([]),
  },
}));

const liveMatchFixture = (id: string, minute: number, score: [number, number]) => ({
  id,
  season_id: '2025-26',
  date: new Date(Date.now() - minute * 60_000).toISOString(),
  home_team: 'Liverpool FC',
  away_team: 'Arsenal FC',
  home_goals: score[0],
  away_goals: score[1],
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
  created_at: new Date().toISOString(),
  status: 'IN_PLAY' as const,
  minute,
});

describe('Live (Fixtures Live screen)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders [data-screen="fixtures-live"] root unconditionally', () => {
    const { container } = render(Live);
    expect(container.querySelector('[data-screen="fixtures-live"]')).toBeTruthy();
  });

  it('shows [data-live-empty] copy when no live matches after load', async () => {
    const { container, component } = render(Live);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelector('[data-live-empty]')).toBeTruthy();
    expect(container.querySelectorAll('[data-live-row]')).toHaveLength(0);
  });

  it('renders one [data-live-row] per live match (LiveBanner + MatchCard)', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getLiveMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      liveMatchFixture('m1', 23, [0, 0]),
      liveMatchFixture('m2', 67, [2, 1]),
      liveMatchFixture('m3', 89, [3, 2]),
    ]);
    const { container, component } = render(Live);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelectorAll('[data-live-row]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-live-banner]')).toHaveLength(3);
    // Each MatchCard renders one [data-block="center"] (P1a contract); use it for one-per-card counting.
    expect(container.querySelectorAll('[data-block="center"]')).toHaveLength(3);
  });

  it('does not render [data-live-empty] when there is at least one live match', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getLiveMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      liveMatchFixture('m1', 23, [0, 0]),
    ]);
    const { container, component } = render(Live);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelector('[data-live-empty]')).toBeNull();
  });
});

describe('Live — polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  it('refetches getLiveMatches every 30s after initial load', async () => {
    const { dataService } = await import('../../services/dataService');
    const getMock = dataService.getLiveMatches as ReturnType<typeof vi.fn>;
    getMock.mockResolvedValue([]);

    const { component } = render(Live);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(getMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(getMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(getMock).toHaveBeenCalledTimes(3);
  });

  it('does NOT refetch when document.hidden is true', async () => {
    const { dataService } = await import('../../services/dataService');
    const getMock = dataService.getLiveMatches as ReturnType<typeof vi.fn>;
    getMock.mockResolvedValue([]);

    const { component } = render(Live);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(getMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.advanceTimersByTimeAsync(30_000);
    expect(getMock).toHaveBeenCalledTimes(1); // still 1 — paused
  });

  it('clears the interval on component destroy (no leaks)', async () => {
    const { dataService } = await import('../../services/dataService');
    const getMock = dataService.getLiveMatches as ReturnType<typeof vi.fn>;
    getMock.mockResolvedValue([]);

    const { component, unmount } = render(Live);
    await (component as { load(): Promise<void> }).load();
    await act();
    unmount();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(getMock).toHaveBeenCalledTimes(1); // still 1 — interval cleared
  });
});
