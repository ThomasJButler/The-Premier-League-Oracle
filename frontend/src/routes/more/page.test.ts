import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MorePage from './+page.svelte';

// Body snippet renders once per shell (desktop + mobile), so structural counts double.

describe('More route (T1 — the missing /more destination)', () => {
  it('renders without error', () => {
    const { body } = render(MorePage);
    expect(body).toBeTruthy();
  });

  it('renders both desktop and mobile shells', () => {
    const { body } = render(MorePage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-more-page');
  });

  it('renders the data-more-list container', () => {
    const { body } = render(MorePage);
    expect(body).toContain('data-more-list');
  });

  it('links every one of the 10 non-tab destinations', () => {
    const { body } = render(MorePage);
    const hrefs = [
      '/settings',
      '/insights',
      '/insights/archive',
      '/broadsheet',
      '/roster',
      '/roster/voices',
      '/search',
      '/notifications',
      '/rumours',
      '/landing'
    ];
    for (const href of hrefs) {
      const re = new RegExp(`href="${href.replace(/\//g, '\\/')}"[^>]*data-more-link`);
      expect(body).toMatch(re);
    }
  });

  it('renders exactly 10 data-more-link rows per shell (20 total)', () => {
    const { body } = render(MorePage);
    const links = body.match(/data-more-link=""/g) ?? [];
    expect(links.length).toBe(20);
  });

  it('marks more as the active mobile nav tab', () => {
    const { body } = render(MorePage);
    const more = body.match(/<a[^>]*data-nav-id="more"[^>]*>/);
    expect(more).not.toBeNull();
    expect(more![0]).toContain('aria-current="page"');
  });

  it('renders no betting / value-bet / bankroll / Kelly copy', () => {
    const { body } = render(MorePage);
    expect(body).not.toMatch(/value bets/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });
});
