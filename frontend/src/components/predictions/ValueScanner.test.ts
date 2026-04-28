import { act, fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ValueScanner from './ValueScanner.svelte';
import type { Match } from '../../types';

vi.mock('../../services/dataService', () => ({
  dataService: {
    getMatches: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/betting/value', () => ({
  ValueBettingEngine: {
    identifyValueBets: vi.fn().mockResolvedValue([]),
  },
}));

function makeUpcomingMatch(overrides: Partial<Match> = {}): Match {
  const future = new Date(Date.now() + 86_400_000 * 3).toISOString();
  return {
    id: 'm1',
    season_id: '2025-26',
    date: future,
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
    ...overrides,
  };
}

describe('ValueScanner (broadcast rebuild, renamed from ValueBets)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders [data-testid="value-scanner"] root with the SectionHeader copy', () => {
    const { container } = render(ValueScanner);
    expect(container.querySelector('[data-testid="value-scanner"]')).toBeTruthy();
    expect(container.textContent).toContain('Where the model disagrees with consensus');
  });

  it('shows [data-no-matches] when getMatches resolves to []', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const { container, component } = render(ValueScanner);
    await (component as { loadMatches(): Promise<void> }).loadMatches();
    await act();
    expect(container.querySelector('[data-no-matches]')).toBeTruthy();
  });

  it('renders required 1X2 odds inputs and the scan button', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      makeUpcomingMatch({ id: 'm1' }),
    ]);
    const { container, component } = render(ValueScanner);
    await (component as { loadMatches(): Promise<void> }).loadMatches();
    await act();
    expect(container.querySelector('[data-input="home-odds"]')).toBeTruthy();
    expect(container.querySelector('[data-input="draw-odds"]')).toBeTruthy();
    expect(container.querySelector('[data-input="away-odds"]')).toBeTruthy();
    expect(container.querySelector('[data-action="scan"]')).toBeTruthy();
  });

  it('scan button is disabled until all three 1X2 odds are > 1', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      makeUpcomingMatch({ id: 'm1' }),
    ]);
    const { container, component } = render(ValueScanner);
    await (component as { loadMatches(): Promise<void> }).loadMatches();
    await act();

    const scan = container.querySelector('[data-action="scan"]') as HTMLButtonElement;
    expect(scan.disabled).toBe(true);

    const home = container.querySelector('[data-input="home-odds"]') as HTMLInputElement;
    const draw = container.querySelector('[data-input="draw-odds"]') as HTMLInputElement;
    const away = container.querySelector('[data-input="away-odds"]') as HTMLInputElement;
    home.value = '2.10';
    await fireEvent.input(home);
    draw.value = '3.40';
    await fireEvent.input(draw);
    away.value = '3.60';
    await fireEvent.input(away);

    expect(scan.disabled).toBe(false);
  });

  it('renders [data-no-value-found] post-scan when engine returns []', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      makeUpcomingMatch({ id: 'm1' }),
    ]);
    const { container, component } = render(ValueScanner);
    await (component as { loadMatches(): Promise<void> }).loadMatches();
    await act();

    const home = container.querySelector('[data-input="home-odds"]') as HTMLInputElement;
    const draw = container.querySelector('[data-input="draw-odds"]') as HTMLInputElement;
    const away = container.querySelector('[data-input="away-odds"]') as HTMLInputElement;
    home.value = '2.10';
    await fireEvent.input(home);
    draw.value = '3.40';
    await fireEvent.input(draw);
    away.value = '3.60';
    await fireEvent.input(away);

    await (component as { scanForValue(): Promise<void> }).scanForValue();
    await act();

    expect(container.querySelector('[data-no-value-found]')).toBeTruthy();
    expect(container.querySelectorAll('[data-value-row]')).toHaveLength(0);
  });

  it('renders [data-value-row] grid rows when engine returns ValueBet[]', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      makeUpcomingMatch({ id: 'm1', home_team: 'Liverpool FC', away_team: 'Arsenal FC' }),
    ]);
    const { ValueBettingEngine } = await import('../../services/betting/value');
    (ValueBettingEngine.identifyValueBets as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        matchId: 'm1',
        homeTeam: 'Liverpool FC',
        awayTeam: 'Arsenal FC',
        matchDate: new Date(),
        market: 'home',
        bookmakerOdds: 2.1,
        ourProbability: 0.55,
        impliedProbability: 1 / 2.1,
        edge: 0.155,
        expectedValue: 0.155,
        confidence: 'high',
        reasoning: ['model edge 15.5%'],
        warnings: [],
        kellyStake: {
          outcome: 'home',
          ourProbability: 0.55,
          bookmakerOdds: 2.1,
          impliedProbability: 1 / 2.1,
          edge: 0.155,
          edgePercentage: 15.5,
          fullKelly: 0.1,
          halfKelly: 0.05,
          recommendedStake: 5,
          expectedValue: 0.155,
          isValueBet: true,
        },
      },
    ]);
    const { container, component } = render(ValueScanner);
    await (component as { loadMatches(): Promise<void> }).loadMatches();
    await act();

    const home = container.querySelector('[data-input="home-odds"]') as HTMLInputElement;
    const draw = container.querySelector('[data-input="draw-odds"]') as HTMLInputElement;
    const away = container.querySelector('[data-input="away-odds"]') as HTMLInputElement;
    home.value = '2.10';
    await fireEvent.input(home);
    draw.value = '3.40';
    await fireEvent.input(draw);
    away.value = '3.60';
    await fireEvent.input(away);

    await (component as { scanForValue(): Promise<void> }).scanForValue();
    await act();

    const rows = container.querySelectorAll('[data-value-row]');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-market')).toBe('home');
    const edgeCell = rows[0].querySelector('[data-cell="edge"]');
    expect(edgeCell?.textContent).toContain('15.5');
    const fixtureCell = rows[0].querySelector('[data-cell="fixture"]');
    expect(fixtureCell?.textContent).toContain('Liverpool FC');
  });

  it('does NOT render any "Track Bet" affordance (betHistoryService dropped)', () => {
    const { container } = render(ValueScanner);
    expect(container.textContent).not.toContain('Track Bet');
    expect(container.textContent).not.toContain('Tracked');
  });
});
