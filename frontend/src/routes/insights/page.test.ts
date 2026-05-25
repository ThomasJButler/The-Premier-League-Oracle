import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import InsightsPage from './+page.svelte';

describe('Insights route — K1d-α (read-only insights screen)', () => {
  it('renders without error', () => {
    const { body } = render(InsightsPage);
    expect(body).toBeTruthy();
  });

  it('renders both desktop and mobile shells', () => {
    const { body } = render(InsightsPage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-insights-page');
  });

  it('marks insights as active in the desktop KickerShell', () => {
    const { body } = render(InsightsPage);
    const link = body.match(/<a\b[^>]*data-nav-id="insights"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('marks "more" as active in the mobile bottom-nav (insights nests under More)', () => {
    const { body } = render(InsightsPage);
    const link = body.match(/<a\b[^>]*data-nav-id="more"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('SSRs the loading state for the top-scorers list (one per shell)', () => {
    const { body } = render(InsightsPage);
    expect((body.match(/data-scorers-loading/g) ?? []).length).toBe(2);
    expect(body).not.toContain('data-scorers-list');
  });

  it('renders the three section markers (one pair per shell)', () => {
    const { body } = render(InsightsPage);
    expect((body.match(/data-insights-section="scorers"/g) ?? []).length).toBe(2);
    expect((body.match(/data-insights-section="stats"/g) ?? []).length).toBe(2);
    expect((body.match(/data-insights-section="story"/g) ?? []).length).toBe(2);
  });

  it('renders the season-stats grid with all six tiles per shell', () => {
    const { body } = render(InsightsPage);
    // 6 tiles × 2 shells = 12
    expect((body.match(/data-stat-tile/g) ?? []).length).toBe(12);
    expect(body).toContain('GOALS PER MATCH');
    expect(body).toContain('33-season mean');
  });

  it('renders the season-anomalies timeline from the bundled stats pack', () => {
    const { body } = render(InsightsPage);
    // statsPack ships 3 anomalies × 2 shells = 6 rows
    expect((body.match(/data-anomaly-row/g) ?? []).length).toBe(6);
  });

  it('stacks the stats grid into single-col on mobile (K2a-β.3)', () => {
    const { body } = render(InsightsPage);
    const grid = body.match(/<div\b[^>]*data-stats-grid[^>]*>/);
    expect(grid).not.toBeNull();
    expect(grid![0]).toContain('grid-cols-1');
    expect(grid![0]).toContain('sm:grid-cols-2');
    expect(grid![0]).toContain('lg:grid-cols-3');
  });

  it('has no betting copy on the page', () => {
    const { body } = render(InsightsPage);
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
