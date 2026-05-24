import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import RecentChips from './RecentChips.svelte';

describe('RecentChips — K1f-β.1', () => {
  it('renders nothing when the list is empty', () => {
    const { body } = render(RecentChips, { props: { queries: [] } });
    expect(body).not.toContain('data-recent-chips');
  });

  it('renders one chip per query with the value as the marker attribute', () => {
    const { body } = render(RecentChips, {
      props: { queries: ['Arsenal', 'Liverpool', 'Spurs'] }
    });
    expect(body).toContain('data-recent-chips-list');
    expect(body).toContain('data-recent-chip="Arsenal"');
    expect(body).toContain('data-recent-chip="Liverpool"');
    expect(body).toContain('data-recent-chip="Spurs"');
    expect(body).toContain('data-recent-chip-remove="Arsenal"');
  });

  it('renders the Recent searches label and a Clear all button', () => {
    const { body } = render(RecentChips, {
      props: { queries: ['Arsenal'] }
    });
    expect(body).toContain('data-recent-chips-label');
    expect(body).toContain('Recent searches');
    expect(body).toContain('data-recent-chips-clear');
  });

  it('has no betting copy', () => {
    const { body } = render(RecentChips, {
      props: { queries: ['form', 'arsenal', '2003/04'] }
    });
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
