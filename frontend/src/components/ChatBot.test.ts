import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ChatBot from './ChatBot.svelte';
import { invalidateBackendHealth } from '../services/chatBackendHealth';

// Mock DOMPurify — use a spy so we can verify sanitize() is actually called.
// Returns input unchanged (sufficient for rendering tests) but allows assertion
// that the sanitisation step is not bypassed.
const mockSanitize = vi.fn((html: string, _config?: Record<string, unknown>) => html);
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string, config?: Record<string, unknown>) => mockSanitize(html, config)
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
  const keyInput = screen.getByPlaceholderText('sk-ant-...');
  await fireEvent.input(keyInput, { target: { value: 'sk-ant-1234567890abcdef' } });
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
    mockSanitize.mockClear();
    // Reset the session-level chat backend health cache so each test's
    // /health probe starts fresh.
    invalidateBackendHealth();
    // Re-apply localStorage mock defaults (setup.ts mocks are cleared by clearAllMocks)
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    // Default: server key probe (POST with empty messages) returns "no key" response.
    // checkServerKey() sends POST with { messages: [] } — if the server has no key
    // it returns 400 + "No API key configured" before the messages validation step.
    vi.mocked(globalThis.fetch).mockImplementation(async (url, opts) => {
      if (typeof url === 'string' && url === '/api/chat') {
        const reqOpts = opts as RequestInit | undefined;
        // Server key probe: POST with empty messages array
        if (reqOpts?.method === 'POST') {
          try {
            const body = JSON.parse(reqOpts.body as string);
            if (Array.isArray(body.messages) && body.messages.length === 0) {
              return { ok: false, status: 400, json: () => Promise.resolve({ error: 'No API key configured. Please enter your Anthropic key.' }) } as unknown as Response;
            }
          } catch {
            // Not JSON — fall through
          }
        }
      }
      // For other calls, return a default rejected response (tests override as needed)
      return { ok: false, status: 500, json: () => Promise.resolve({ error: 'Not mocked' }) } as Response;
    });
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
    expect(screen.getByText('Connect Anthropic')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sk-ant-...')).toBeInTheDocument();
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('should link to the Anthropic console for API key creation', () => {
    render(ChatBot);
    const anthropicLink = screen.getByText('Anthropic Console');
    expect(anthropicLink).toBeInTheDocument();
    expect(anthropicLink.closest('a')).toHaveAttribute('href', 'https://console.anthropic.com/settings/keys');
    // The old OpenAI link must be gone post-migration
    expect(screen.queryByText('OpenAI')).not.toBeInTheDocument();
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

    const keyInput = screen.getByPlaceholderText('sk-ant-...');
    await fireEvent.input(keyInput, { target: { value: 'short' } });
    const connectBtn = screen.getByText('Connect');
    await fireEvent.click(connectBtn);
    await act();

    expect(screen.getByText('Please enter a valid API key.')).toBeInTheDocument();
  });

  it('should save valid API key and enable chat input', async () => {
    render(ChatBot);

    await connectApiKey();

    await waitFor(() => {
      const input = document.querySelector('[data-testid="chatbot-input"]') as HTMLInputElement;
      expect(input).not.toBeDisabled();
    });

    // Verify localStorage.setItem was called with the API key
    expect(localStorage.setItem).toHaveBeenCalledWith('anthropic_api_key', 'sk-ant-1234567890abcdef');
  });

  it('should show security notice banner after connecting with user key', async () => {
    render(ChatBot);

    await connectApiKey();

    await waitFor(() => {
      expect(screen.getByText(/Your API key is routed through our server proxy/)).toBeInTheDocument();
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
      expect(screen.getByText('Connect Anthropic')).toBeInTheDocument();
    });

    expect(localStorage.removeItem).toHaveBeenCalledWith('anthropic_api_key');
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
    // Override fetch to return a chat response for POST
    vi.mocked(globalThis.fetch).mockImplementation(async (url, opts) => {
      if (typeof url === 'string' && url === '/api/chat' && (opts as RequestInit)?.method === 'POST') {
        return {
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Arsenal look strong this season.' } }]
          })
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

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

    // P5e: Verify DOMPurify.sanitize() was called with the API response content.
    // If a future regression removes the sanitise step, this test will fail.
    expect(mockSanitize).toHaveBeenCalledWith(
      'Arsenal look strong this season.',
      expect.any(Object) // allowlist config
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );
  });

  it('should show error message on API 401', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (url, opts) => {
      if (typeof url === 'string' && url === '/api/chat' && (opts as RequestInit)?.method === 'POST') {
        return {
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Invalid API key. Please check your Anthropic key.' })
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

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
    vi.mocked(globalThis.fetch).mockImplementation(async (url, opts) => {
      if (typeof url === 'string' && url === '/api/chat' && (opts as RequestInit)?.method === 'POST') {
        return {
          ok: false,
          status: 429,
          json: () => Promise.resolve({ error: 'Rate limited by Anthropic. Please wait a moment and try again.' })
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

    const { component } = render(ChatBot);

    await connectApiKey();

    await typeMessage('Test');
    await act(async () => {
      await (component as any).sendMessage();
    });

    await waitFor(() => {
      expect(screen.getByText(/Rate limited by Anthropic/)).toBeInTheDocument();
    });
  });

  it('should not send empty messages', async () => {
    const { component } = render(ChatBot);

    await connectApiKey();

    // inputText defaults to '' — send without typing anything
    await act(async () => {
      await (component as any).sendMessage();
    });

    // fetch should not have been called with /api/chat POST (beyond any setup calls)
    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.filter(
      ([url, opts]) => typeof url === 'string' && url === '/api/chat' && (opts as RequestInit)?.method === 'POST'
    );
    expect(fetchCalls).toHaveLength(0);
  });

  // --- Backend RAG tests ---
  //
  // checkBackendRAG() is called from onMount but runs as a floating promise.
  // Svelte 4's onMount timing in the jsdom test environment makes the mock
  // fetch unreachable via act() alone. Instead, we call the exported
  // checkBackendRAG() explicitly and await it before asserting.

  /** Helper: set up health mock, render, and call checkBackendRAG. */
  async function renderWithBackendRAG(fetchImpl?: typeof globalThis.fetch) {
    vi.mocked(globalThis.fetch).mockImplementation(fetchImpl ?? (async (url) => {
      if (typeof url === 'string' && url === '/health') {
        return { ok: true, json: () => Promise.resolve({ status: 'healthy' }) } as Response;
      }
      return { ok: false, status: 500 } as Response;
    }));
    const result = render(ChatBot);
    await act(async () => {
      await (result.component as any).checkBackendRAG();
    });
    return result;
  }

  it('should probe the canonical /health URL (not /api/oracle/health)', async () => {
    // P12a: the frontend must probe the exact path the FastAPI backend
    // serves (main.py:269 → GET /health). If this regresses to a nested
    // /api/oracle/health prefix, the probe will fail in production and
    // the chat will silently fall back to the proxy with no RAG context.
    const fetchSpy = vi.mocked(globalThis.fetch);
    await renderWithBackendRAG();

    const probedUrls = fetchSpy.mock.calls
      .map(([url]) => url)
      .filter((u): u is string => typeof u === 'string');

    expect(probedUrls).toContain('/health');
    expect(probedUrls).not.toContain('/api/oracle/health');
  });

  it('should detect backend RAG and enable chat without user key', async () => {
    await renderWithBackendRAG();

    await waitFor(() => {
      const input = document.querySelector('[data-testid="chatbot-input"]') as HTMLInputElement;
      expect(input).not.toBeDisabled();
    });

    // API key form should NOT be shown when backend RAG is available
    expect(screen.queryByText('Connect AI Provider')).not.toBeInTheDocument();
  });

  it('should show RAG indicator when backend is available', async () => {
    await renderWithBackendRAG();

    await waitFor(() => {
      expect(screen.getByText('RAG')).toBeInTheDocument();
    });
  });

  it('should send via backend RAG when available', async () => {
    const { component } = await renderWithBackendRAG(async (url, opts) => {
      if (typeof url === 'string' && url === '/health') {
        return { ok: true, json: () => Promise.resolve({ status: 'healthy' }) } as Response;
      }
      if (typeof url === 'string' && url === '/api/oracle/chat/rag' && (opts as RequestInit)?.method === 'POST') {
        return {
          ok: true,
          json: () => Promise.resolve({ reply: 'Arsenal are top of the league!', grounded: true }),
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

    await waitFor(() => {
      const input = document.querySelector('[data-testid="chatbot-input"]') as HTMLInputElement;
      expect(input).not.toBeDisabled();
    });

    await typeMessage('How is Arsenal doing?');
    await act(async () => {
      await (component as any).sendMessage();
    });

    await waitFor(() => {
      expect(screen.getByText('How is Arsenal doing?')).toBeInTheDocument();
      expect(screen.getByText('Arsenal are top of the league!')).toBeInTheDocument();
    });

    // Verify the RAG endpoint was called, not /api/chat
    const ragCalls = vi.mocked(globalThis.fetch).mock.calls.filter(
      ([url]) => typeof url === 'string' && url === '/api/oracle/chat/rag'
    );
    expect(ragCalls.length).toBeGreaterThan(0);
  });

  it('should fall back to proxy when backend RAG fails', async () => {
    const { component } = await renderWithBackendRAG(async (url, opts) => {
      if (typeof url === 'string' && url === '/health') {
        return { ok: true, json: () => Promise.resolve({ status: 'healthy' }) } as Response;
      }
      // RAG endpoint returns 502
      if (typeof url === 'string' && url === '/api/oracle/chat/rag') {
        return { ok: false, status: 502, json: () => Promise.resolve({ detail: 'Failed' }) } as Response;
      }
      // Fallback proxy works
      if (typeof url === 'string' && url === '/api/chat' && (opts as RequestInit)?.method === 'POST') {
        return {
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Fallback response from proxy.' } }],
          }),
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

    await waitFor(() => {
      const input = document.querySelector('[data-testid="chatbot-input"]') as HTMLInputElement;
      expect(input).not.toBeDisabled();
    });

    await typeMessage('Hello');
    await act(async () => {
      await (component as any).sendMessage();
    });

    await waitFor(() => {
      expect(screen.getByText('Fallback response from proxy.')).toBeInTheDocument();
    });
  });

  it('P13b: reuses the cached /health result across remounts within a session', async () => {
    // First render: primes the session cache with a successful /health probe.
    const { unmount } = await renderWithBackendRAG();

    const healthCallsAfterFirst = vi.mocked(globalThis.fetch).mock.calls
      .filter(([url]) => typeof url === 'string' && url === '/health').length;
    expect(healthCallsAfterFirst).toBe(1);

    unmount();

    // Second render: same session, no invalidation — cache should short-circuit.
    const { component } = render(ChatBot);
    await act(async () => {
      await (component as any).checkBackendRAG();
    });

    const healthCallsAfterSecond = vi.mocked(globalThis.fetch).mock.calls
      .filter(([url]) => typeof url === 'string' && url === '/health').length;
    // Still exactly one — the second mount must not re-probe.
    expect(healthCallsAfterSecond).toBe(1);
  });

  it('P13b: re-probes /health after a RAG 5xx failure invalidates the cache', async () => {
    // Prime cache with successful probe, then simulate RAG server error.
    const { component } = await renderWithBackendRAG(async (url, opts) => {
      if (typeof url === 'string' && url === '/health') {
        return { ok: true, json: () => Promise.resolve({ status: 'healthy' }) } as Response;
      }
      if (typeof url === 'string' && url === '/api/oracle/chat/rag' && (opts as RequestInit)?.method === 'POST') {
        return { ok: false, status: 502, json: () => Promise.resolve({ detail: 'Bad gateway' }) } as Response;
      }
      // Fallback proxy returns something so sendMessage completes cleanly.
      if (typeof url === 'string' && url === '/api/chat' && (opts as RequestInit)?.method === 'POST') {
        return { ok: true, json: () => Promise.resolve({ choices: [{ message: { content: 'Fallback' } }] }) } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

    await waitFor(() => {
      const input = document.querySelector('[data-testid="chatbot-input"]') as HTMLInputElement;
      expect(input).not.toBeDisabled();
    });

    // Trigger a RAG request that will 502 → invalidates health cache.
    await typeMessage('Trigger RAG failure');
    await act(async () => {
      await (component as any).sendMessage();
    });

    // Now call checkBackendRAG again — the cache was invalidated by the 502,
    // so this must re-probe /health.
    const healthCallsBefore = vi.mocked(globalThis.fetch).mock.calls
      .filter(([url]) => typeof url === 'string' && url === '/health').length;

    await act(async () => {
      await (component as any).checkBackendRAG();
    });

    const healthCallsAfter = vi.mocked(globalThis.fetch).mock.calls
      .filter(([url]) => typeof url === 'string' && url === '/health').length;

    expect(healthCallsAfter).toBeGreaterThan(healthCallsBefore);
  });

  it('should not show security banner when using backend RAG', async () => {
    await renderWithBackendRAG();

    await waitFor(() => {
      const input = document.querySelector('[data-testid="chatbot-input"]') as HTMLInputElement;
      expect(input).not.toBeDisabled();
    });

    // Security banner and "Change key" should not be shown
    expect(screen.queryByText(/Your API key is routed/)).not.toBeInTheDocument();
    expect(screen.queryByText('Change key')).not.toBeInTheDocument();
  });

  it('should persist messages to localStorage', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (url, opts) => {
      if (typeof url === 'string' && url === '/api/chat' && (opts as RequestInit)?.method === 'POST') {
        return {
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Test reply' } }]
          })
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

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
