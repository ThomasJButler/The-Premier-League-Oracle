import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ThreadListRail from './ThreadListRail.svelte';

describe('ThreadListRail — K1a-β.4', () => {
  it('renders the rail header and a new-thread affordance', () => {
    const { body } = render(ThreadListRail);
    expect(body).toContain('data-thread-rail');
    expect(body).toContain('data-thread-rail-new');
    expect(body).toMatch(/threads/i);
  });

  it('shows an empty-state hint when no threads exist (SSR default)', () => {
    const { body } = render(ThreadListRail);
    expect(body).toContain('data-thread-rail-empty');
    expect(body).not.toContain('data-thread-rail-item');
  });

  it('does not include betting copy', () => {
    const { body } = render(ThreadListRail);
    expect(body).not.toMatch(/value bets?|bankroll|kelly/i);
  });
});
