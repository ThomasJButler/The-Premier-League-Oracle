import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import FixturesPage from './+page.svelte';

describe('Fixtures route', () => {
  it('renders without error', () => {
    const { body } = render(FixturesPage);
    expect(body).toBeTruthy();
  });

  it('renders all 4 filter chip labels', () => {
    const { body } = render(FixturesPage);
    expect(body).toContain('ALL');
    expect(body).toContain('TOP 6');
    expect(body).toContain('RELEGATION');
    expect(body).toContain('TV PICKS');
  });

  it('renders filter chips as buttons with data-filter-chip attributes', () => {
    const { body } = render(FixturesPage);
    expect(body).toContain('data-filter-chip="all"');
    expect(body).toContain('data-filter-chip="top6"');
    expect(body).toContain('data-filter-chip="relegation"');
    expect(body).toContain('data-filter-chip="tv"');
  });

  it('marks all as the initially active filter', () => {
    const { body } = render(FixturesPage);
    const allChip = body.match(/data-filter-chip="all"[^>]*>/);
    expect(allChip).not.toBeNull();
    expect(allChip![0]).toContain('data-filter-active');
  });

  it('renders both desktop-shell and mobile-shell wrappers', () => {
    const { body } = render(FixturesPage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
  });

  it('marks fixtures as the active nav link in KickerShell', () => {
    const { body } = render(FixturesPage);
    const fixturesLink = body.match(/<a[^>]*data-nav-id="fixtures"[^>]*>/);
    expect(fixturesLink).not.toBeNull();
    expect(fixturesLink![0]).toContain('aria-current="page"');
  });

  it('renders empty state when no matches are loaded (SSR initial state)', () => {
    const { body } = render(FixturesPage);
    expect(body).toContain('data-fixtures-empty');
  });

  it('renders no betting copy strings', () => {
    const { body } = render(FixturesPage);
    expect(body).not.toMatch(/value bets/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/betting/i);
  });
});
