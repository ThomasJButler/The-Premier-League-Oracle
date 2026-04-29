import { act, fireEvent, render, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('svelte-routing', async () => {
  const LinkStub = (await import('../../tests/LinkStub.svelte')).default;
  return { Link: LinkStub, navigate: vi.fn() };
});

vi.mock('../../services/oracleChat', () => ({
  detectBackendMode: vi.fn().mockResolvedValue('rag'),
  streamReply: vi.fn(),
}));

vi.mock('../../services/dataService', () => ({
  dataService: {
    getMatches: vi.fn().mockResolvedValue([]),
    getStandings: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getAccuracyStats: vi.fn().mockReturnValue({
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      brierScore: 0,
      scoreAccuracy: 0,
      highConfidenceAccuracy: 0,
      mediumConfidenceAccuracy: 0,
      lowConfidenceAccuracy: 0,
      homeWinAccuracy: 0,
      awayWinAccuracy: 0,
      drawAccuracy: 0,
      averageConfidence: 0,
      streak: { current: 0, best: 0, worst: 0 },
    }),
  },
}));

import OracleChat from './OracleChat.svelte';
import * as oracleChat from '../../services/oracleChat';
import { predictionTracker } from '../../services/predictionTracker';

type LoadableComponent = { load(): Promise<void> };

describe('OracleChat (screen)', () => {
  // The global setup.ts replaces localStorage with a bare vi.fn() stub, so we
  // wire a per-test plain-object backing store to get real round-trip semantics
  // — same pattern as lib/oracle/threads.test.ts.
  let storage: { [key: string]: string };

  beforeEach(() => {
    storage = {};
    vi.spyOn(localStorage, 'getItem').mockImplementation((key: string) => storage[key] ?? null);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      storage[key] = value;
    });
    vi.spyOn(localStorage, 'removeItem').mockImplementation((key: string) => {
      delete storage[key];
    });
    vi.spyOn(localStorage, 'clear').mockImplementation(() => {
      storage = {};
    });
    (oracleChat.detectBackendMode as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('rag');
    (oracleChat.streamReply as unknown as ReturnType<typeof vi.fn>).mockReset();
    (predictionTracker.getAccuracyStats as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      brierScore: 0,
      scoreAccuracy: 0,
      highConfidenceAccuracy: 0,
      mediumConfidenceAccuracy: 0,
      lowConfidenceAccuracy: 0,
      homeWinAccuracy: 0,
      awayWinAccuracy: 0,
      drawAccuracy: 0,
      averageConfidence: 0,
      streak: { current: 0, best: 0, worst: 0 },
    });
  });

  it('mounts with [data-screen="oracle"] root', () => {
    const { container } = render(OracleChat);
    expect(container.querySelector('[data-screen="oracle"]')).toBeTruthy();
  });

  it('seeds an empty thread on first mount when no localStorage data exists', async () => {
    const { container, component } = render(OracleChat);
    await (component as unknown as LoadableComponent).load();
    await act();
    expect(container.querySelector('[data-thread]')).toBeTruthy();
  });

  it('migrates legacy oracle_chat_history into a single thread on mount', async () => {
    storage['oracle_chat_history'] = JSON.stringify([
      { role: 'user', content: 'Will Arsenal win?', timestamp: 1 },
    ]);
    const { container, component } = render(OracleChat);
    await (component as unknown as LoadableComponent).load();
    await act();
    const rail = container.querySelector('[data-thread-rail]');
    expect(rail?.textContent).toContain('Will Arsenal win?');
    expect(storage['oracle_chat_history']).toBeUndefined();
  });

  it('clicking [data-new-thread] adds a thread to the rail', async () => {
    const { container, component } = render(OracleChat);
    await (component as unknown as LoadableComponent).load();
    await act();
    const before = container.querySelectorAll('[data-thread]').length;
    await fireEvent.click(container.querySelector('[data-new-thread]')!);
    await act();
    expect(container.querySelectorAll('[data-thread]').length).toBeGreaterThan(before);
  });

  it('renders the context panel with KPI grid', async () => {
    const { container, component } = render(OracleChat);
    await (component as unknown as LoadableComponent).load();
    await act();
    expect(container.querySelector('[data-context-panel]')).toBeTruthy();
    // Stats are present (totalPicks: 0 from mock) so KPI grid should render.
    expect(container.querySelector('[data-kpi-grid]')).toBeTruthy();
  });

  it('submitting the composer calls streamReply with the user message', async () => {
    (oracleChat.streamReply as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      // eslint-disable-next-line require-yield
      async function* () {
        yield { delta: 'OK' };
      },
    );
    const { container, component } = render(OracleChat);
    await (component as unknown as LoadableComponent).load();
    await act();
    const ta = container.querySelector<HTMLTextAreaElement>('[data-textarea]')!;
    await fireEvent.input(ta, { target: { value: 'Hi' } });
    await fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false });
    await waitFor(() => {
      expect(oracleChat.streamReply).toHaveBeenCalled();
    });
  });
});
