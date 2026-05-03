import { act, fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ThisWeek from './ThisWeek.svelte';

vi.mock('svelte-routing', () => ({
  navigate: vi.fn(),
}));

vi.mock('../../services/dataService', () => ({
  dataService: {
    getCurrentSeasonMatches: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getMatchPredictions: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../lib/export/pdf', () => ({
  exportPdf: vi.fn(),
}));

vi.mock('../../lib/export/pngCard', () => ({
  exportPngCard: vi.fn(),
}));

// vi.mock is hoisted — factory must live INSIDE describe to safely reference values
describe('ThisWeek (Predictions This Week screen)', () => {
  const mkUpcomingMatch = (id: string, matchday: number, daysFromNow: number) => ({
    id,
    season_id: '2025-26',
    date: new Date(Date.now() + daysFromNow * 86_400_000).toISOString(),
    matchday,
    home_team: 'Liverpool FC',
    away_team: 'Arsenal FC',
    home_goals: null,
    away_goals: null,
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
    status: 'SCHEDULED' as const,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/predictions/this-week');
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('renders [data-screen="predictions-this-week"] root unconditionally', () => {
    const { container } = render(ThisWeek);
    expect(container.querySelector('[data-screen="predictions-this-week"]')).toBeTruthy();
  });

  it('renders [data-no-gameweek] copy when getCurrentSeasonMatches returns empty', async () => {
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelector('[data-no-gameweek]')).toBeTruthy();
    expect(container.querySelectorAll('[data-card-row]')).toHaveLength(0);
  });

  it('renders one [data-card-row] per fixture in the current gameweek', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
      mkUpcomingMatch('m2', 35, 3),
      mkUpcomingMatch('m3', 35, 3),
      // Extra fixture in a different gameweek to verify the filter
      mkUpcomingMatch('m4', 36, 9),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelectorAll('[data-card-row]')).toHaveLength(3);
    // MatchCard contract marker from P1a — 3 cards × 3 blocks (home/center/away) = 9
    expect(container.querySelectorAll('[data-block]')).toHaveLength(9);
    expect(container.querySelector('[data-no-gameweek]')).toBeNull();
  });

  it('renders the SectionHeader kicker with the gameweek number', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    const kicker = container.querySelector('[data-kicker]');
    expect(kicker?.textContent).toContain('GAMEWEEK 35');
  });

  it('renders [Export PDF] and [Share PNG] as active buttons after fixtures load', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelectorAll('[data-export-placeholder]')).toHaveLength(0);
    const pdfBtn = container.querySelector('[data-export="pdf"]') as HTMLButtonElement;
    const pngBtn = container.querySelector('[data-export="png"]') as HTMLButtonElement;
    expect(pdfBtn).toBeTruthy();
    expect(pngBtn).toBeTruthy();
    expect(pdfBtn.hasAttribute('disabled')).toBe(false);
    expect(pngBtn.hasAttribute('disabled')).toBe(false);
    expect(pdfBtn.textContent?.trim()).toMatch(/Export PDF/i);
    expect(pngBtn.textContent?.trim()).toMatch(/Share PNG/i);
  });

  it('renders [data-gw-prev] and [data-gw-next] navigation buttons', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
      mkUpcomingMatch('m2', 36, 9),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelector('[data-gw-prev]')).toBeTruthy();
    expect(container.querySelector('[data-gw-next]')).toBeTruthy();
  });

  it('Next button calls navigate() and switches the rendered gameweek', async () => {
    const { navigate } = await import('svelte-routing');
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
      mkUpcomingMatch('m2', 36, 9),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    const nextBtn = container.querySelector('[data-gw-next]') as HTMLButtonElement;
    await fireEvent.click(nextBtn);
    expect(navigate).toHaveBeenCalledWith('/predictions/this-week?gw=36', { replace: false });
    const kicker = container.querySelector('[data-kicker]');
    expect(kicker?.textContent).toContain('GAMEWEEK 36');
  });

  it('honours ?gw=N on initial render (deep-link)', async () => {
    window.history.replaceState({}, '', '/predictions/this-week?gw=36');
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
      mkUpcomingMatch('m2', 36, 9),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    const kicker = container.querySelector('[data-kicker]');
    expect(kicker?.textContent).toContain('GAMEWEEK 36');
    expect(container.querySelectorAll('[data-card-row]')).toHaveLength(1);
  });

  it('disables [data-gw-prev] when on the earliest available gameweek', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
      mkUpcomingMatch('m2', 36, 9),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    const prevBtn = container.querySelector('[data-gw-prev]') as HTMLButtonElement;
    expect(prevBtn.hasAttribute('disabled')).toBe(true);
  });

  it('PDF + PNG button clicks call exportPdf + exportPngCard with the grid element and gameweek', async () => {
    const { exportPdf } = await import('../../lib/export/pdf');
    const { exportPngCard } = await import('../../lib/export/pngCard');
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    const pdfBtn = container.querySelector('[data-export="pdf"]') as HTMLButtonElement;
    const pngBtn = container.querySelector('[data-export="png"]') as HTMLButtonElement;
    await fireEvent.click(pdfBtn);
    await fireEvent.click(pngBtn);
    expect(exportPdf).toHaveBeenCalledOnce();
    expect(exportPngCard).toHaveBeenCalledOnce();
    const [pdfOpts] = (exportPdf as ReturnType<typeof vi.fn>).mock.calls[0];
    const [pngOpts] = (exportPngCard as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(pdfOpts.kind).toBe('this-week');
    expect(pdfOpts.gameweek).toBe(35);
    expect(pdfOpts.target).toBeInstanceOf(HTMLElement);
    expect(pngOpts.kind).toBe('gw-grid');
    expect(pngOpts.gameweek).toBe(35);
    expect(pngOpts.target).toBeInstanceOf(HTMLElement);
  });
});
