import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ApiSetupWizard from './ApiSetupWizard.svelte';
import { footballDataAPI } from '../services/api/footballData';
import { dataService } from '../services/dataService';

// Mock footballDataAPI
vi.mock('../services/api/footballData', () => ({
  footballDataAPI: {
    testConnection: vi.fn(),
    setApiKey: vi.fn(),
  },
}));

// Mock dataService
vi.mock('../services/dataService', () => ({
  dataService: {
    clearCache: vi.fn(),
  },
}));

// Mock svelte/transition — Dialog.Root uses fade, Dialog.Content uses scale
vi.mock('svelte/transition', () => ({
  fly: () => ({ duration: 0 }),
  fade: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));

// Mock lucide-svelte icons as empty no-op Svelte components
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
    Key: stub, Shield: stub, Zap: stub, BookOpen: stub,
    Info: stub, ExternalLink: stub, X: stub,
  };
});

// Helper: click the "Next" button to advance a step
async function clickNext() {
  const btn = screen.getByRole('button', { name: 'Next' });
  await fireEvent.click(btn);
  await act();
}

// Helper: click the "Previous" button to go back a step
async function clickPrevious() {
  const btn = screen.getByRole('button', { name: 'Previous' });
  await fireEvent.click(btn);
  await act();
}

describe('ApiSetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(footballDataAPI.testConnection).mockResolvedValue(true);
    vi.mocked(dataService.clearCache).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the wizard title', () => {
    render(ApiSetupWizard);
    expect(screen.getByText('Premier League Oracle')).toBeInTheDocument();
  });

  it('shows step 1 (Welcome) by default', () => {
    render(ApiSetupWizard);
    expect(screen.getByText('Welcome to Premier League Oracle')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('shows step title "Welcome" on step 1', () => {
    render(ApiSetupWizard);
    // The step indicator heading shows the step title
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
  });

  it('navigates to step 2 when Next is clicked', async () => {
    render(ApiSetupWizard);
    await clickNext();
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    // "Privacy & Security" appears in both the step indicator heading and the
    // section heading — use getAllByText and assert at least one is rendered
    expect(screen.getAllByText('Privacy & Security').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates back to step 1 from step 2', async () => {
    render(ApiSetupWizard);
    await clickNext();
    await clickPrevious();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('shows API key input on step 3', async () => {
    render(ApiSetupWizard);
    await clickNext(); // step 2
    await clickNext(); // step 3
    expect(screen.getByText('API Configuration')).toBeInTheDocument();
    expect(screen.getByLabelText('Football-Data.org API Key')).toBeInTheDocument();
  });

  it('validates API key successfully and advances to step 4', async () => {
    vi.mocked(footballDataAPI.testConnection).mockResolvedValue(true);
    render(ApiSetupWizard);
    // Navigate to step 3
    await clickNext();
    await clickNext();
    // Enter the API key
    const input = screen.getByLabelText('Football-Data.org API Key');
    await fireEvent.input(input, { target: { value: 'test-api-key-12345' } });
    // Click "Validate & Save"
    const validateBtn = screen.getByRole('button', { name: 'Validate & Save' });
    await fireEvent.click(validateBtn);
    await waitFor(() => {
      expect(footballDataAPI.setApiKey).toHaveBeenCalledWith('test-api-key-12345');
    });
    expect(footballDataAPI.testConnection).toHaveBeenCalled();
    expect(localStorage.setItem).toHaveBeenCalledWith('football_data_api_key', 'test-api-key-12345');
    expect(dataService.clearCache).toHaveBeenCalled();
  });

  it('shows validation error on failed connection', async () => {
    vi.mocked(footballDataAPI.testConnection).mockResolvedValue(false);
    render(ApiSetupWizard);
    await clickNext();
    await clickNext();
    const input = screen.getByLabelText('Football-Data.org API Key');
    await fireEvent.input(input, { target: { value: 'bad-key-toolong' } });
    const validateBtn = screen.getByRole('button', { name: 'Validate & Save' });
    await fireEvent.click(validateBtn);
    await waitFor(() => {
      expect(screen.getByText(/Invalid API key/)).toBeInTheDocument();
    });
  });

  it('shows network error on connection failure', async () => {
    vi.mocked(footballDataAPI.testConnection).mockRejectedValue(new Error('Network error'));
    render(ApiSetupWizard);
    await clickNext();
    await clickNext();
    const input = screen.getByLabelText('Football-Data.org API Key');
    await fireEvent.input(input, { target: { value: 'test-key-toolong' } });
    const validateBtn = screen.getByRole('button', { name: 'Validate & Save' });
    await fireEvent.click(validateBtn);
    await waitFor(() => {
      expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
    });
  });

  it('does not validate when API key is empty', async () => {
    render(ApiSetupWizard);
    await clickNext();
    await clickNext();
    // The "Validate & Save" button is disabled when apiKey is empty
    const validateBtn = screen.getByRole('button', { name: 'Validate & Save' });
    expect(validateBtn).toBeDisabled();
    expect(footballDataAPI.testConnection).not.toHaveBeenCalled();
  });

  it('has a close button with aria-label', () => {
    render(ApiSetupWizard);
    expect(screen.getByLabelText('Close setup wizard')).toBeInTheDocument();
  });

  it('renders progress dots for all 4 steps', () => {
    render(ApiSetupWizard);
    // Each step renders a dot: w-3 h-3 rounded-full
    const dots = document.querySelectorAll('.w-3.h-3.rounded-full');
    expect(dots.length).toBe(4);
  });

  it('dispatches complete event when close button is clicked', async () => {
    const { component } = render(ApiSetupWizard);
    const events: CustomEvent[] = [];
    component.$on('complete', (e: CustomEvent) => events.push(e));
    const closeBtn = screen.getByLabelText('Close setup wizard');
    await fireEvent.click(closeBtn);
    expect(events.length).toBe(1);
    expect(events[0].detail).toEqual({ apiKey: '' });
  });
});
