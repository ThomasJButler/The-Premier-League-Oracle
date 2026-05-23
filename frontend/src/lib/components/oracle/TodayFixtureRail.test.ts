import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import TodayFixtureRail from './TodayFixtureRail.svelte';

describe('TodayFixtureRail — K1a-β.4', () => {
  it('renders the rail header with no fixtures pre-hydration', () => {
    const { body } = render(TodayFixtureRail);
    expect(body).toContain('data-today-fixture-rail');
    // SSR runs before onMount fetches, so the loading placeholder is what ships.
    expect(body).toContain('data-today-fixture-loading');
    expect(body).not.toContain('data-today-fixture-stack');
  });

  it('does not include betting copy', () => {
    const { body } = render(TodayFixtureRail);
    expect(body).not.toMatch(/value bets?|bankroll|kelly/i);
  });
});
