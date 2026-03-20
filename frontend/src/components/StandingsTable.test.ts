import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/svelte';
import StandingsTable from './StandingsTable.svelte';
import { dataService } from '../services/dataService';
import type { Standing } from '../types';

// Mock dataService
vi.mock('../services/dataService', () => ({
  dataService: {
    getStandings: vi.fn(),
  },
}));

// Mock team logos
vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: vi.fn(() => 'mock-logo.png'),
}));

// Mock lib/utils
vi.mock('../lib/utils', () => ({
  getSeasonLabel: vi.fn(() => '2025/26'),
}));

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  fly: () => ({ duration: 0 }),
  fade: () => ({ duration: 0 }),
}));

// Mock shadcn Button
vi.mock('$lib/components/ui/button', () => {
  const stub = class {
    $$: any;
    constructor(opts: any) {
      this.$$ = {
        fragment: { c() {}, m() {}, p() {}, d() {}, l() {}, i() {}, o() {} },
        ctx: [], props: {}, update: () => {}, not_equal: () => false,
        bound: Object.create(null), on_mount: [], on_destroy: [], on_disconnect: [],
        before_update: [], after_update: [], context: new Map(),
        callbacks: Object.create(null), dirty: [-1], skip_bound: false,
        root: opts?.target || document.createElement('div'),
      };
    }
    $destroy() {}
    $on() { return () => {}; }
    $set() {}
  };
  return { Button: stub };
});

// Mock lucide-svelte
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
        root: opts?.target || document.createElement('div'),
      };
    }
    $destroy() {}
    $on() { return () => {}; }
    $set() {}
  };
  return {
    Trophy: stub, Minus: stub, ChevronUp: stub, ChevronDown: stub,
  };
});

function makeStanding(overrides: Partial<Standing> = {}): Standing {
  return {
    position: 1,
    team: {
      id: 1,
      name: 'Arsenal FC',
      shortName: 'Arsenal',
      tla: 'ARS',
      crest: 'https://example.com/arsenal.png',
    },
    playedGames: 30,
    form: 'W,W,D,L,W',
    won: 20,
    draw: 5,
    lost: 5,
    points: 65,
    goalsFor: 60,
    goalsAgainst: 25,
    goalDifference: 35,
    ...overrides,
  };
}

function makeStandings(count: number): Standing[] {
  const teams = [
    'Arsenal FC', 'Liverpool FC', 'Manchester City FC', 'Chelsea FC',
    'Manchester United FC', 'Tottenham Hotspur FC', 'Newcastle United FC',
    'Brighton & Hove Albion FC', 'Aston Villa FC', 'West Ham United FC',
    'Brentford FC', 'Crystal Palace FC', 'Fulham FC', 'Wolverhampton Wanderers FC',
    'AFC Bournemouth', 'Everton FC', 'Nottingham Forest FC', 'Leicester City FC',
    'Ipswich Town FC', 'Southampton FC',
  ];
  return Array.from({ length: count }, (_, i) =>
    makeStanding({
      position: i + 1,
      team: {
        id: i + 1,
        name: teams[i] || `Team ${i + 1}`,
        shortName: (teams[i] || `Team ${i + 1}`).replace(/ FC$/, ''),
        tla: (teams[i] || 'T' + i).slice(0, 3).toUpperCase(),
        crest: `https://example.com/team${i}.png`,
      },
      points: 65 - i * 3,
      won: 20 - i,
      draw: 5,
      lost: 5 + i,
      goalDifference: 35 - i * 3,
      form: i < 3 ? 'W,W,W,D,W' : i >= 17 ? 'L,L,D,L,L' : 'W,D,L,W,D',
    })
  );
}

describe('StandingsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue('test-api-key');
    vi.mocked(dataService.getStandings).mockResolvedValue(makeStandings(20));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', () => {
    render(StandingsTable);
    expect(screen.getByText('Premier League Table')).toBeInTheDocument();
  });

  it('shows loading spinner initially', () => {
    // Return a never-resolving promise so loading stays true during the synchronous check
    vi.mocked(dataService.getStandings).mockReturnValue(new Promise(() => {}));
    render(StandingsTable);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows error when no API key is configured', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    expect(screen.getByText(/configure your Football-Data.org API key/)).toBeInTheDocument();
  });

  it('shows error on API 403 response', async () => {
    vi.mocked(dataService.getStandings).mockRejectedValue(new Error('403 Forbidden'));
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    expect(screen.getByText(/Invalid API key/)).toBeInTheDocument();
  });

  it('shows generic error on network failure', async () => {
    vi.mocked(dataService.getStandings).mockRejectedValue(new Error('Network error'));
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    expect(screen.getByText(/Failed to load standings/)).toBeInTheDocument();
  });

  it('renders standings table after successful load', async () => {
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    expect(screen.getByText('Arsenal')).toBeInTheDocument();
    expect(screen.getByText('Liverpool')).toBeInTheDocument();
  });

  it('shows "Show All" toggle when more than 10 teams', async () => {
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    expect(screen.getByText('Show All 20 Teams')).toBeInTheDocument();
  });

  it('initially displays only top 10 teams', async () => {
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    // Position 10 (West Ham United) should be visible, position 11 (Brentford) should not
    // shortName is generated by stripping " FC" suffix: "West Ham United FC" → "West Ham United"
    expect(screen.queryByText('West Ham United')).toBeInTheDocument();
    expect(screen.queryByText('Brentford')).not.toBeInTheDocument();
  });

  it('shows all teams after clicking "Show All"', async () => {
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    const toggleButton = screen.getByText('Show All 20 Teams');
    await fireEvent.click(toggleButton);
    await act();
    expect(screen.getByText('Southampton')).toBeInTheDocument();
    expect(screen.getByText('Show Less')).toBeInTheDocument();
  });

  it('toggle button has aria-expanded attribute', async () => {
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    const toggleButton = screen.getByText('Show All 20 Teams');
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    await fireEvent.click(toggleButton);
    await act();
    expect(screen.getByText('Show Less')).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders empty state when no standings data', async () => {
    vi.mocked(dataService.getStandings).mockResolvedValue([]);
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    expect(screen.getByText(/No standings data available/)).toBeInTheDocument();
  });

  it('renders form badges for teams with form data', async () => {
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    // Arsenal has form 'W,W,W,D,W' — should display W badges
    const formBadges = screen.queryAllByText('W');
    expect(formBadges.length).toBeGreaterThan(0);
  });

  it('handles null form data gracefully', async () => {
    vi.mocked(dataService.getStandings).mockResolvedValue([
      makeStanding({ form: null }),
    ]);
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    expect(screen.getByText('Arsenal')).toBeInTheDocument();
  });

  it('displays positive goal difference with + prefix', async () => {
    vi.mocked(dataService.getStandings).mockResolvedValue([
      makeStanding({ goalDifference: 35 }),
    ]);
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    expect(screen.getByText('+35')).toBeInTheDocument();
  });

  it('renders the table with aria-label', async () => {
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    const table = document.querySelector('table[aria-label="Premier League standings"]');
    expect(table).toBeInTheDocument();
  });

  it('renders Conference League in the legend', async () => {
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    expect(screen.getByText('Conference League')).toBeInTheDocument();
  });

  it('renders all four zone legend items', async () => {
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    expect(screen.getByText('Champions League')).toBeInTheDocument();
    expect(screen.getByText('Europa League')).toBeInTheDocument();
    expect(screen.getByText('Conference League')).toBeInTheDocument();
    expect(screen.getByText('Relegation')).toBeInTheDocument();
  });

  it('renders form dots with accessibility labels', async () => {
    const { component } = render(StandingsTable);
    await (component as any).loadStandings();
    await act();
    const winDots = screen.queryAllByLabelText('Win');
    const drawDots = screen.queryAllByLabelText('Draw');
    const lossDots = screen.queryAllByLabelText('Loss');
    // All teams have form data — at least some W/D/L dots should exist
    expect(winDots.length + drawDots.length + lossDots.length).toBeGreaterThan(0);
  });
});
