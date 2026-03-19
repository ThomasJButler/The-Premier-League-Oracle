import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import MatchEventToast from './MatchEventToast.svelte';
import type { MatchEvent } from '../types';
import { matchEventsStore } from '../services/liveService';

// Mock liveService with writable store
vi.mock('../services/liveService', async () => {
  const { writable } = await import('svelte/store');
  const matchEventsStore = writable<import('../types').MatchEvent[]>([]);
  return { matchEventsStore };
});

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  fly: () => ({ duration: 0 }),
}));

async function flushStoreUpdates() {
  await tick();
  await act();
}

function makeEvent(overrides: Partial<MatchEvent> = {}): MatchEvent {
  return {
    id: 'evt-1',
    matchId: 'match-1',
    type: 'goal',
    team: 'Arsenal FC',
    homeTeam: 'Arsenal FC',
    awayTeam: 'Chelsea FC',
    score: '1-0',
    message: 'GOAL! Arsenal FC score!',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('MatchEventToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    matchEventsStore.set([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no events', async () => {
    render(MatchEventToast);
    await flushStoreUpdates();
    // The component renders nothing when events.length === 0
    expect(document.querySelector('[role="status"]')).not.toBeInTheDocument();
  });

  it('renders toast cards when events are present', async () => {
    render(MatchEventToast);
    matchEventsStore.set([makeEvent()]);
    await flushStoreUpdates();
    expect(screen.getByText('GOAL! Arsenal FC score!')).toBeInTheDocument();
  });

  it('shows score line when event has score', async () => {
    render(MatchEventToast);
    matchEventsStore.set([makeEvent({ score: '2-1' })]);
    await flushStoreUpdates();
    expect(screen.getByText(/Arsenal FC 2-1 Chelsea FC/)).toBeInTheDocument();
  });

  it('does not show score line when score is absent', async () => {
    render(MatchEventToast);
    matchEventsStore.set([makeEvent({ score: undefined })]);
    await flushStoreUpdates();
    expect(screen.getByText('GOAL! Arsenal FC score!')).toBeInTheDocument();
    // Should not show the team score line
    expect(screen.queryByText(/Arsenal FC.*Chelsea FC/)).not.toBeInTheDocument();
  });

  it('renders multiple events as separate toasts', async () => {
    render(MatchEventToast);
    matchEventsStore.set([
      makeEvent({ id: 'e1', message: 'GOAL! Arsenal FC score!' }),
      makeEvent({ id: 'e2', message: 'Half-time whistle!', type: 'half_time', score: '1-0' }),
    ]);
    await flushStoreUpdates();
    expect(screen.getByText('GOAL! Arsenal FC score!')).toBeInTheDocument();
    expect(screen.getByText('Half-time whistle!')).toBeInTheDocument();
  });

  it('applies green border for goal events', async () => {
    render(MatchEventToast);
    matchEventsStore.set([makeEvent({ type: 'goal' })]);
    await flushStoreUpdates();
    const toastCard = document.querySelector('.border-green-500');
    expect(toastCard).toBeInTheDocument();
  });

  it('applies amber border for half_time events', async () => {
    render(MatchEventToast);
    matchEventsStore.set([makeEvent({ id: 'e2', type: 'half_time', message: 'Half Time!' })]);
    await flushStoreUpdates();
    const toastCard = document.querySelector('.border-amber-500');
    expect(toastCard).toBeInTheDocument();
  });

  it('applies blue border for full_time events', async () => {
    render(MatchEventToast);
    matchEventsStore.set([makeEvent({ id: 'e3', type: 'full_time', message: 'Full Time!' })]);
    await flushStoreUpdates();
    const toastCard = document.querySelector('.border-blue-500');
    expect(toastCard).toBeInTheDocument();
  });

  it('applies red border for penalties events', async () => {
    render(MatchEventToast);
    matchEventsStore.set([makeEvent({ id: 'e4', type: 'penalties', message: 'Penalty Shootout!' })]);
    await flushStoreUpdates();
    const toastCard = document.querySelector('.border-red-500');
    expect(toastCard).toBeInTheDocument();
  });

  it('applies emerald border for kickoff events', async () => {
    render(MatchEventToast);
    matchEventsStore.set([makeEvent({ id: 'e5', type: 'kickoff', message: 'Kick off!' })]);
    await flushStoreUpdates();
    const toastCard = document.querySelector('.border-emerald-500');
    expect(toastCard).toBeInTheDocument();
  });

  it('has accessible role="status" and aria-live when events present', async () => {
    render(MatchEventToast);
    matchEventsStore.set([makeEvent()]);
    await flushStoreUpdates();
    const statusDiv = document.querySelector('[role="status"]');
    expect(statusDiv).toBeInTheDocument();
    expect(statusDiv).toHaveAttribute('aria-live', 'polite');
    expect(statusDiv).toHaveAttribute('aria-label', 'Match event notifications');
  });

  it('removes toasts when store is cleared', async () => {
    render(MatchEventToast);
    matchEventsStore.set([makeEvent()]);
    await flushStoreUpdates();
    expect(screen.getByText('GOAL! Arsenal FC score!')).toBeInTheDocument();

    matchEventsStore.set([]);
    await flushStoreUpdates();
    expect(screen.queryByText('GOAL! Arsenal FC score!')).not.toBeInTheDocument();
  });
});
