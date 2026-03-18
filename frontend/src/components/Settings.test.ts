import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import Settings from './Settings.svelte';

// Mock the services
vi.mock('../services/api/footballData', () => ({
  footballDataAPI: {
    setApiKey: vi.fn(),
    testConnection: vi.fn(() => Promise.resolve(false))
  }
}));

vi.mock('../services/dataService', () => ({
  dataService: {
    clearCache: vi.fn(() => Promise.resolve()),
    getMatches: vi.fn(() => Promise.resolve([]))
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
    Settings: stub, Key: stub, Database: stub, RefreshCw: stub,
    CheckCircle: stub, AlertCircle: stub, Wifi: stub, Trophy: stub,
    Sparkles: stub, Heart: stub
  };
});

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  fade: () => ({ duration: 0 })
}));

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no stored values
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('should render the Settings header', () => {
    render(Settings);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should show API key input and Connect button', () => {
    render(Settings);

    const input = document.querySelector('input[type="password"]');
    expect(input).toBeInTheDocument();
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('should show "Not Connected" when no API key is stored', () => {
    render(Settings);
    expect(screen.getByText('Not Connected')).toBeInTheDocument();
  });

  it('should show "Connected" after successfully connecting with an API key', async () => {
    // onMount doesn't fire in jsdom, so we simulate its effect by
    // importing the service mock and calling saveFootballDataKey via
    // the component's Connect button after typing a key.
    const { footballDataAPI } = await import('../services/api/footballData');
    vi.mocked(footballDataAPI.testConnection).mockResolvedValue(true);

    render(Settings);

    const input = document.querySelector('input[type="password"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'test-key-123' } });
    await act();

    const button = screen.getByText('Connect');
    await fireEvent.click(button);
    await act();

    // saveFootballDataKey calls setApiKey and stores the key
    expect(footballDataAPI.setApiKey).toHaveBeenCalledWith('test-key-123');
    expect(localStorage.setItem).toHaveBeenCalledWith('football_data_api_key', 'test-key-123');

    // After successful testConnection, apiConnected = true → "Connected" renders
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('should show favourite team dropdown with "None (PL Default)" option', () => {
    render(Settings);

    expect(screen.getByText('Favourite Team')).toBeInTheDocument();
    const select = document.querySelector('select');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('None (PL Default)')).toBeInTheDocument();
  });

  it('should show Data Management section with Cache Size and Last Sync', () => {
    render(Settings);

    expect(screen.getByText('Data Management')).toBeInTheDocument();
    expect(screen.getByText('Cache Size')).toBeInTheDocument();
    expect(screen.getByText('Last Sync')).toBeInTheDocument();
  });

  it('should show Clear Cache and Sync Now buttons', () => {
    render(Settings);

    expect(screen.getByText('Clear Cache')).toBeInTheDocument();
    expect(screen.getByText('Sync Now')).toBeInTheDocument();
  });

  it('should disable Connect button when input is empty', () => {
    render(Settings);

    const button = screen.getByText('Connect');
    expect(button).toBeDisabled();
  });
});
