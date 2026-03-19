import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/svelte';
import TopScorers from './TopScorers.svelte';
import { dataService } from '../services/dataService';

// Mock dataService
vi.mock('../services/dataService', () => ({
  dataService: {
    getTopScorers: vi.fn(),
  },
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
  return { Trophy: stub };
});

function makeRawScorer(overrides: Record<string, any> = {}) {
  const base = {
    player: {
      id: 1,
      name: 'Erling Haaland',
      firstName: 'Erling',
      lastName: 'Haaland',
      nationality: 'Norway',
      position: 'Centre-Forward',
      dateOfBirth: '2000-07-21',
      shirtNumber: 9,
      lastUpdated: '2026-01-01T00:00:00Z',
    },
    team: {
      id: 65,
      name: 'Manchester City FC',
      shortName: 'Man City',
      tla: 'MCI',
      crest: 'https://example.com/mancity.png',
    },
    goals: 25,
    assists: 5,
    penalties: 3,
  };
  // Deep-merge player and team overrides
  if (overrides.player) {
    base.player = { ...base.player, ...overrides.player };
    delete overrides.player;
  }
  if (overrides.team) {
    base.team = { ...base.team, ...overrides.team };
    delete overrides.team;
  }
  return { ...base, ...overrides };
}

describe('TopScorers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue('test-api-key');
    vi.mocked(dataService.getTopScorers).mockResolvedValue([
      makeRawScorer(),
      makeRawScorer({ player: { id: 2, name: 'Mohamed Salah', position: 'Right Winger' }, team: { id: 64, name: 'Liverpool FC', crest: 'https://example.com/lfc.png' }, goals: 20, assists: 10 }),
      makeRawScorer({ player: { id: 3, name: 'Cole Palmer', position: 'Attacking Midfield' }, team: { id: 61, name: 'Chelsea FC', crest: 'https://example.com/cfc.png' }, goals: 18, assists: 8 }),
      makeRawScorer({ player: { id: 4, name: 'Alexander Isak', position: 'Centre-Forward' }, team: { id: 67, name: 'Newcastle United FC', crest: 'https://example.com/nufc.png' }, goals: 15, assists: 4 }),
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', () => {
    render(TopScorers);
    expect(screen.getByText('Top Scorers')).toBeInTheDocument();
  });

  it('shows loading spinner initially', () => {
    // Use a promise that never resolves so loading stays true during the synchronous check
    vi.mocked(dataService.getTopScorers).mockReturnValue(new Promise(() => {}));
    render(TopScorers);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows error when no API key is configured', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    const { component } = render(TopScorers);
    await (component as any).loadTopScorers();
    await act();
    expect(screen.getByText(/configure your Football-Data.org API key/)).toBeInTheDocument();
  });

  it('shows error on API 401 response', async () => {
    vi.mocked(dataService.getTopScorers).mockRejectedValue(new Error('401 Unauthorized'));
    const { component } = render(TopScorers);
    await (component as any).loadTopScorers();
    await act();
    expect(screen.getByText(/Invalid API key/)).toBeInTheDocument();
  });

  it('shows generic error on network failure', async () => {
    vi.mocked(dataService.getTopScorers).mockRejectedValue(new Error('Network error'));
    const { component } = render(TopScorers);
    await (component as any).loadTopScorers();
    await act();
    expect(screen.getByText(/Failed to load top scorers/)).toBeInTheDocument();
  });

  it('renders scorers table after successful load', async () => {
    const { component } = render(TopScorers);
    await (component as any).loadTopScorers();
    await act();
    expect(screen.getByText('Erling Haaland')).toBeInTheDocument();
    expect(screen.getByText('Mohamed Salah')).toBeInTheDocument();
    expect(screen.getByText('Cole Palmer')).toBeInTheDocument();
  });

  it('shows medal emojis for top 3 positions', async () => {
    const { component } = render(TopScorers);
    await (component as any).loadTopScorers();
    await act();
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
  });

  it('shows numbered badge for position 4+', async () => {
    const { component } = render(TopScorers);
    await (component as any).loadTopScorers();
    await act();
    // Position 4 should show '4' as a number badge, not a medal emoji
    const badges = document.querySelectorAll('.inline-flex.rounded-full');
    const positionBadge = Array.from(badges).find(el => el.textContent?.trim() === '4');
    expect(positionBadge).toBeInTheDocument();
  });

  it('displays goals count for each scorer', async () => {
    const { component } = render(TopScorers);
    await (component as any).loadTopScorers();
    await act();
    expect(screen.getByText('25')).toBeInTheDocument(); // Haaland
    expect(screen.getByText('20')).toBeInTheDocument(); // Salah
  });

  it('handles missing player data with defaults', async () => {
    vi.mocked(dataService.getTopScorers).mockResolvedValue([
      makeRawScorer({ player: { id: null, name: null }, team: { id: null, name: null }, goals: null }),
    ]);
    const { component } = render(TopScorers);
    await (component as any).loadTopScorers();
    await act();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows dash for null assists', async () => {
    vi.mocked(dataService.getTopScorers).mockResolvedValue([
      makeRawScorer({ assists: null }),
    ]);
    const { component } = render(TopScorers);
    await (component as any).loadTopScorers();
    await act();
    // Should show '-' for null assists
    expect(screen.queryAllByText('-').length).toBeGreaterThan(0);
  });

  it('renders empty state when no scorers', async () => {
    vi.mocked(dataService.getTopScorers).mockResolvedValue([]);
    const { component } = render(TopScorers);
    await (component as any).loadTopScorers();
    await act();
    expect(screen.getByText(/No top scorer data available/)).toBeInTheDocument();
  });

  it('renders the table with aria-label', async () => {
    const { component } = render(TopScorers);
    await (component as any).loadTopScorers();
    await act();
    const table = document.querySelector('table[aria-label="Top scorers table"]');
    expect(table).toBeInTheDocument();
  });
});
