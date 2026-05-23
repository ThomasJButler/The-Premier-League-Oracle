import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import WatchlistRail from './WatchlistRail.svelte';

describe('WatchlistRail — K1a-β.4 placeholder', () => {
  it('renders the watchlist marker and placeholder badge', () => {
    const { body } = render(WatchlistRail);
    expect(body).toContain('data-watchlist-rail');
    expect(body).toContain('data-watchlist-rail-placeholder');
    expect(body).toMatch(/watchlist/i);
  });
});
