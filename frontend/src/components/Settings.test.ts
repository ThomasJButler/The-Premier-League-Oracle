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

vi.mock('../services/backendService', () => ({
  backendService: {
    isAvailable: vi.fn(() => Promise.resolve(false)),
    invalidateCache: vi.fn()
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
    Sparkles: stub, Heart: stub, Cpu: stub
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

    // saveFootballDataKey trims and passes key to setApiKey (which handles localStorage internally)
    expect(footballDataAPI.setApiKey).toHaveBeenCalledWith('test-key-123');

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

  describe('ML Backend Section', () => {
    it('should render ML Backend heading and toggle', () => {
      render(Settings);

      expect(screen.getByText('ML Backend')).toBeInTheDocument();
      expect(screen.getByText('Use ML Backend')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should toggle useBackend and persist to localStorage', async () => {
      render(Settings);

      const toggle = screen.getByRole('switch');
      expect(toggle.getAttribute('aria-checked')).toBe('false');

      await fireEvent.click(toggle);
      await act();

      expect(toggle.getAttribute('aria-checked')).toBe('true');
      expect(localStorage.setItem).toHaveBeenCalledWith('use_backend', 'true');
    });

    it('should show backend status and token field when enabled', async () => {
      render(Settings);

      const toggle = screen.getByRole('switch');
      await fireEvent.click(toggle);
      await act();

      expect(screen.getByText('Backend Status')).toBeInTheDocument();
      expect(screen.getByText('API Token')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('should hide backend status and token field when disabled', () => {
      render(Settings);

      // Backend is off by default
      expect(screen.queryByText('Backend Status')).not.toBeInTheDocument();
      expect(screen.queryByText('API Token')).not.toBeInTheDocument();
    });

    it('should show green dot when backend is available', async () => {
      const { backendService } = await import('../services/backendService');
      vi.mocked(backendService.isAvailable).mockResolvedValue(true);

      render(Settings);

      const toggle = screen.getByRole('switch');
      await fireEvent.click(toggle);
      await act();

      await waitFor(() => {
        expect(screen.getByText('Connected and healthy')).toBeInTheDocument();
      });

      // Verify the green dot is rendered
      const greenDot = document.querySelector('.bg-green-500');
      expect(greenDot).toBeInTheDocument();
    });

    it('should show red dot when backend is unreachable', async () => {
      const { backendService } = await import('../services/backendService');
      vi.mocked(backendService.isAvailable).mockResolvedValue(false);

      render(Settings);

      const toggle = screen.getByRole('switch');
      await fireEvent.click(toggle);
      await act();

      await waitFor(() => {
        expect(screen.getByText(/Unreachable/)).toBeInTheDocument();
      });

      const redDot = document.querySelector('.bg-red-500');
      expect(redDot).toBeInTheDocument();
    });

    it('should check backend status when Test button is clicked', async () => {
      const { backendService } = await import('../services/backendService');
      vi.mocked(backendService.isAvailable).mockResolvedValue(true);

      render(Settings);

      // Enable backend
      const toggle = screen.getByRole('switch');
      await fireEvent.click(toggle);
      await act();

      // Clear previous calls from the toggle
      vi.mocked(backendService.isAvailable).mockClear();
      vi.mocked(backendService.invalidateCache).mockClear();

      // Click Test button
      const testButton = screen.getByText('Test');
      await fireEvent.click(testButton);
      await act();

      expect(backendService.invalidateCache).toHaveBeenCalled();
      expect(backendService.isAvailable).toHaveBeenCalled();
    });

    it('should save oracle_api_token to localStorage when Save is clicked', async () => {
      render(Settings);

      // Enable backend first
      const toggle = screen.getByRole('switch');
      await fireEvent.click(toggle);
      await act();

      const tokenInput = document.querySelector('input[placeholder*="Bearer"]') as HTMLInputElement;
      await fireEvent.input(tokenInput, { target: { value: 'my-secret-token' } });
      await act();

      const saveButton = screen.getByText('Save');
      await fireEvent.click(saveButton);
      await act();

      expect(localStorage.setItem).toHaveBeenCalledWith('oracle_api_token', 'my-secret-token');
    });
  });
});
