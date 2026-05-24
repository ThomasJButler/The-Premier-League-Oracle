import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SearchPage from './+page.svelte';

describe('Search route — K1f-β.1', () => {
  it('renders without error', () => {
    const { body } = render(SearchPage);
    expect(body).toBeTruthy();
  });

  it('renders both desktop and mobile shells', () => {
    const { body } = render(SearchPage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-search-page');
  });

  it('marks "more" as active in the mobile bottom-nav (search nests under More)', () => {
    const { body } = render(SearchPage);
    const link = body.match(/<a\b[^>]*data-nav-id="more"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('SSRs the SearchInput primitive twice (once per shell)', () => {
    const { body } = render(SearchPage);
    expect((body.match(/data-search-input-field/g) ?? []).length).toBe(2);
  });

  it('SSRs the loading hint twice on first paint (hydration runs onMount)', () => {
    const { body } = render(SearchPage);
    expect((body.match(/data-search-loading/g) ?? []).length).toBe(2);
    expect(body).not.toContain('data-search-empty');
    expect(body).not.toContain('data-search-results-stub');
    expect(body).not.toContain('data-recent-chips');
  });

  it('renders the SEARCH kicker and morgue title', () => {
    const { body } = render(SearchPage);
    expect(body).toContain('SEARCH');
    expect(body).toContain('The morgue');
  });

  it('has no betting copy', () => {
    const { body } = render(SearchPage);
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
