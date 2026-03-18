import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/svelte';
import ValueBets from './ValueBets.svelte';
import { dataService } from '../../services/dataService';
import { ValueBettingEngine } from '../../services/betting/value';
import type { Match } from '../../types';

// Mock dataService
vi.mock('../../services/dataService', () => ({
  dataService: {
    getMatches: vi.fn(() => Promise.resolve([]))
  }
}));

// Mock ValueBettingEngine
vi.mock('../../services/betting/value', () => ({
  ValueBettingEngine: {
    identifyValueBets: vi.fn(() => Promise.resolve([]))
  }
}));

// Mock lucide-svelte icons
vi.mock('lucide-svelte', () => {
  const stub = class {
    $$: any;
    constructor(opts: any) {
      this.$$ = {
        fragment: { c() {}, m() {}, p() {}, d() {}, l() {}, i() {}, o() {} },
        ctx: [], props: {}, update: () => {}, not_equal: () => false,
        bound: Object.create(null), on_mount: [], on_destroy: [], on_disconnect: [],
        before_update: [], after_update: [], context: new Map(),
        callbacks: Object.create(null), dirty: [-1], skip_bound: false,
        root: opts?.target || document.createElement('div')
      };
    }
    $destroy() {}
    $on() { return () => {}; }
    $set() {}
  };
  return {
    Search: stub, AlertTriangle: stub, TrendingUp: stub, CheckCircle: stub
  };
});

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  fade: () => ({ duration: 0 })
}));

// Mock team logos
vi.mock('../../utils/teamLogos', () => ({
  getTeamLogo: vi.fn(() => 'mock-logo.png')
}));

function makeUpcomingMatch(overrides: Partial<Match> = {}): Match {
  const futureDate = new Date(Date.now() + 86400000 * 3).toISOString();
  return {
    id: '1', season_id: 's1', date: futureDate,
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
    ...overrides
  };
}

describe('ValueBets Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataService.getMatches).mockResolvedValue([]);
    vi.mocked(ValueBettingEngine.identifyValueBets).mockResolvedValue([]);
  });

  it('should render the component container', () => {
    render(ValueBets);

    expect(screen.getByTestId('value-bets')).toBeInTheDocument();
  });

  it('should show the header text', () => {
    render(ValueBets);

    expect(screen.getByText('Value Bet Scanner')).toBeInTheDocument();
    expect(screen.getByText(/Enter bookmaker odds/)).toBeInTheDocument();
  });

  it('should show no matches message when no upcoming matches', async () => {
    vi.mocked(dataService.getMatches).mockResolvedValue([]);

    const { component } = render(ValueBets);
    await (component as any).loadMatches();
    await act();

    expect(screen.getByText(/No upcoming matches found/)).toBeInTheDocument();
  });

  it('should show match selector when matches are available', async () => {
    const match = makeUpcomingMatch({ id: 'm1', home_team: 'Arsenal', away_team: 'Liverpool' });
    vi.mocked(dataService.getMatches).mockResolvedValue([match]);

    const { component } = render(ValueBets);
    await (component as any).loadMatches();
    await act();

    expect(screen.getByLabelText('Select Match')).toBeInTheDocument();
    expect(screen.getByText('Arsenal vs Liverpool')).toBeInTheDocument();
  });

  it('should show odds input fields after match selection', async () => {
    const match = makeUpcomingMatch({ id: 'm1' });
    vi.mocked(dataService.getMatches).mockResolvedValue([match]);

    const { component } = render(ValueBets);
    await (component as any).loadMatches();
    await act();

    expect(screen.getByLabelText('Home')).toBeInTheDocument();
    expect(screen.getByLabelText('Draw')).toBeInTheDocument();
    expect(screen.getByLabelText('Away')).toBeInTheDocument();
  });

  it('should show the Scan for Value button', async () => {
    const match = makeUpcomingMatch({ id: 'm1' });
    vi.mocked(dataService.getMatches).mockResolvedValue([match]);

    const { component } = render(ValueBets);
    await (component as any).loadMatches();
    await act();

    expect(screen.getByText('Scan for Value')).toBeInTheDocument();
  });

  it('should show bankroll input', async () => {
    const match = makeUpcomingMatch({ id: 'm1' });
    vi.mocked(dataService.getMatches).mockResolvedValue([match]);

    const { component } = render(ValueBets);
    await (component as any).loadMatches();
    await act();

    expect(screen.getByLabelText('Bankroll')).toBeInTheDocument();
  });

  it('should show optional Over/Under 2.5 inputs', async () => {
    const match = makeUpcomingMatch({ id: 'm1' });
    vi.mocked(dataService.getMatches).mockResolvedValue([match]);

    const { component } = render(ValueBets);
    await (component as any).loadMatches();
    await act();

    expect(screen.getByLabelText('Over 2.5')).toBeInTheDocument();
    expect(screen.getByLabelText('Under 2.5')).toBeInTheDocument();
  });

  it('should not call ValueBettingEngine before user initiates scan', async () => {
    const match = makeUpcomingMatch({ id: 'm1', home_team: 'Arsenal', away_team: 'Liverpool' });
    vi.mocked(dataService.getMatches).mockResolvedValue([match]);

    const { component } = render(ValueBets);
    await (component as any).loadMatches();
    await act();

    // Set odds via component properties — inputs bind to component state
    // We need to use the exported scanForValue directly with odds set
    // Setting values directly on the component isn't straightforward with Svelte 4,
    // so we test the scanForValue function via the component
    // For now, verify the engine is importable and the component renders correctly
    expect(ValueBettingEngine.identifyValueBets).not.toHaveBeenCalled();
  });

  it('should show error state when API fails', async () => {
    vi.mocked(dataService.getMatches).mockRejectedValue(new Error('API down'));

    const { component } = render(ValueBets);
    await (component as any).loadMatches();
    await act();

    expect(screen.getByText(/Could not load upcoming matches/)).toBeInTheDocument();
  });

  it('should filter out completed matches', async () => {
    const completedMatch = makeUpcomingMatch({ id: 'm1', result: 'H', home_goals: 2, away_goals: 1 });
    const upcomingMatch = makeUpcomingMatch({ id: 'm2', home_team: 'Chelsea', away_team: 'Spurs' });
    vi.mocked(dataService.getMatches).mockResolvedValue([completedMatch, upcomingMatch]);

    const { component } = render(ValueBets);
    await (component as any).loadMatches();
    await act();

    // Only the upcoming match should appear in the selector
    expect(screen.getByText('Chelsea vs Spurs')).toBeInTheDocument();
    // The completed match should not be an option
    const options = document.querySelectorAll('option');
    expect(options).toHaveLength(1);
  });

  it('should show team logos in match preview', async () => {
    const match = makeUpcomingMatch({ id: 'm1', home_team: 'Arsenal', away_team: 'Liverpool' });
    vi.mocked(dataService.getMatches).mockResolvedValue([match]);

    const { component } = render(ValueBets);
    await (component as any).loadMatches();
    await act();

    const imgs = document.querySelectorAll('img');
    expect(imgs.length).toBeGreaterThanOrEqual(2);
  });
});
