import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ChatBot from './ChatBot.svelte';

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html
  }
}));

// Mock the dataService
vi.mock('../services/dataService', () => ({
  dataService: {
    getStandings: vi.fn(() => Promise.resolve([])),
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
    MessageCircle: stub, Send: stub, Key: stub, Loader2: stub,
    AlertTriangle: stub, Trash2: stub, ShieldAlert: stub
  };
});

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  fade: () => ({ duration: 0 })
}));

/** Helper: type a valid API key into the password input and click Connect */
async function connectApiKey() {
  const keyInput = screen.getByPlaceholderText('sk-...');
  await fireEvent.input(keyInput, { target: { value: 'sk-1234567890abcdef' } });
  const connectBtn = screen.getByText('Connect');
  await fireEvent.click(connectBtn);
  await act();
}

/** Helper: type text into the chat input */
async function typeMessage(text: string) {
  const chatInput = document.querySelector('[data-testid="chatbot-input"]') as HTMLInputElement;
  await fireEvent.input(chatInput, { target: { value: text } });
}

describe('ChatBot Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply localStorage mock defaults (setup.ts mocks are cleared by clearAllMocks)
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    // Let fetch mock remain cleared — tests that need it set it individually
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render the chatbot container', () => {
    render(ChatBot);
    const container = document.querySelector('[data-testid="chatbot"]');
    expect(container).toBeInTheDocument();
  });

  it('should display the Oracle Chat header', () => {
    render(ChatBot);
    expect(screen.getByText('Oracle Chat')).toBeInTheDocument();
  });

  it('should show API key setup form when no key stored', () => {
    render(ChatBot);
    expect(screen.getByText('Connect OpenAI')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('should show link to OpenAI platform', () => {
    render(ChatBot);
    const link = screen.getByText('platform.openai.com');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://platform.openai.com/api-keys');
  });

  it('should have chat input disabled without API key', () => {
    render(ChatBot);
    const input = document.querySelector('[data-testid="chatbot-input"]') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it('should have send button disabled without API key', () => {
    render(ChatBot);
    const button = document.querySelector('[data-testid="chatbot-send"]') as HTMLButtonElement;
    expect(button).toBeDisabled();
  });

  it('should show validation error for short API key', async () => {
    render(ChatBot);

    const keyInput = screen.getByPlaceholderText('sk-...');
    await fireEvent.input(keyInput, { target: { value: 'short' } });
    const connectBtn = screen.getByText('Connect');
    await fireEvent.click(connectBtn);
    await act();

    expect(screen.getByText('Please enter a valid OpenAI API key.')).toBeInTheDocument();
  });

  it('should save valid API key and enable chat input', async () => {
    render(ChatBot);

    await connectApiKey();

    await waitFor(() => {
      const input = document.querySelector('[data-testid="chatbot-input"]') as HTMLInputElement;
      expect(input).not.toBeDisabled();
    });

    // Verify localStorage.setItem was called with the API key
    expect(localStorage.setItem).toHaveBeenCalledWith('openai_api_key', 'sk-1234567890abcdef');
  });

  it('should show security warning banner after connecting', async () => {
    render(ChatBot);

    await connectApiKey();

    await waitFor(() => {
      expect(screen.getByText(/Your API key is sent directly to OpenAI/)).toBeInTheDocument();
    });
  });

  it('should show "Change key" button when connected', async () => {
    render(ChatBot);

    await connectApiKey();

    await waitFor(() => {
      expect(screen.getByText('Change key')).toBeInTheDocument();
    });
  });

  it('should clear API key when clearApiKey is called', async () => {
    const { component } = render(ChatBot);

    await connectApiKey();

    await act(() => {
      (component as any).clearApiKey();
    });

    await waitFor(() => {
      expect(screen.getByText('Connect OpenAI')).toBeInTheDocument();
    });

    expect(localStorage.removeItem).toHaveBeenCalledWith('openai_api_key');
  });

  it('should clear chat and show reset message', async () => {
    const { component } = render(ChatBot);

    await act(() => {
      (component as any).clearChat();
    });

    await waitFor(() => {
      expect(screen.getByText(/Chat cleared/)).toBeInTheDocument();
    });
  });

  it('should show character counter', () => {
    render(ChatBot);
    expect(screen.getByText('0/500')).toBeInTheDocument();
  });

  it('should send message and display API response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Arsenal look strong this season.' } }]
      })
    } as Response);

    const { component } = render(ChatBot);

    await connectApiKey();

    await typeMessage('How is Arsenal doing?');
    await act(async () => {
      await (component as any).sendMessage();
    });

    await waitFor(() => {
      expect(screen.getByText('How is Arsenal doing?')).toBeInTheDocument();
      expect(screen.getByText('Arsenal look strong this season.')).toBeInTheDocument();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer sk-1234567890abcdef'
        })
      })
    );
  });

  it('should show error message on API 401', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401
    } as Response);

    const { component } = render(ChatBot);

    await connectApiKey();

    await typeMessage('Test message');
    await act(async () => {
      await (component as any).sendMessage();
    });

    await waitFor(() => {
      expect(screen.getByText(/Invalid API key/)).toBeInTheDocument();
    });
  });

  it('should show rate limit error on 429', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 429
    } as Response);

    const { component } = render(ChatBot);

    await connectApiKey();

    await typeMessage('Test');
    await act(async () => {
      await (component as any).sendMessage();
    });

    await waitFor(() => {
      expect(screen.getByText(/Rate limited by OpenAI/)).toBeInTheDocument();
    });
  });

  it('should not send empty messages', async () => {
    const { component } = render(ChatBot);

    await connectApiKey();

    // inputText defaults to '' — send without typing anything
    await act(async () => {
      await (component as any).sendMessage();
    });

    // fetch should not have been called (beyond any setup calls)
    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('openai.com')
    );
    expect(fetchCalls).toHaveLength(0);
  });

  it('should persist messages to localStorage', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Test reply' } }]
      })
    } as Response);

    const { component } = render(ChatBot);

    await connectApiKey();

    await typeMessage('Hello Oracle');
    await act(async () => {
      await (component as any).sendMessage();
    });

    await waitFor(() => {
      // Check that persistMessages wrote chat history to localStorage
      const chatHistoryCalls = vi.mocked(localStorage.setItem).mock.calls.filter(
        ([key]) => key === 'oracle_chat_history'
      );
      expect(chatHistoryCalls.length).toBeGreaterThan(0);
      // The last call should include both user and assistant messages
      const lastSaved = JSON.parse(chatHistoryCalls[chatHistoryCalls.length - 1][1] as string);
      expect(lastSaved.some((m: any) => m.content === 'Hello Oracle')).toBe(true);
      expect(lastSaved.some((m: any) => m.content === 'Test reply')).toBe(true);
    });
  });
});
