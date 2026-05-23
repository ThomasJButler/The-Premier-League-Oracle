import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MatchDetailPage from './+page.svelte';

const props = { data: { id: 'pl-test-1' } };

describe('Match-detail route (/fixtures/[id])', () => {
  it('renders without error given a data prop', () => {
    const { body } = render(MatchDetailPage, { props });
    expect(body).toBeTruthy();
  });

  it('mounts both desktop-shell and mobile-shell wrappers', () => {
    const { body } = render(MatchDetailPage, { props });
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
  });

  it('marks fixtures as the active nav in both shells', () => {
    const { body } = render(MatchDetailPage, { props });
    const activeMarkers = body.match(/data-nav-id="fixtures"/g) ?? [];
    // One marker per shell (KickerShell + MobileNav).
    expect(activeMarkers.length).toBeGreaterThanOrEqual(2);
    const shellLink = body.match(/<a[^>]*data-nav-id="fixtures"[^>]*>/);
    expect(shellLink).not.toBeNull();
    expect(shellLink![0]).toContain('aria-current="page"');
  });

  it('SSRs the loading state (fixture resolves in onMount on the client)', () => {
    const { body } = render(MatchDetailPage, { props });
    // Both shells render the body snippet, so the loader appears twice.
    const matches = body.match(/data-match-detail-loading/g) ?? [];
    expect(matches.length).toBe(2);
    expect(body).not.toContain('data-match-hero');
    expect(body).not.toContain('data-match-detail-missing');
  });

  it('does not render the not-found block during the loading state', () => {
    const { body } = render(MatchDetailPage, { props });
    expect(body).not.toContain('data-match-detail-missing');
  });

  it('renders no betting copy', () => {
    const { body } = render(MatchDetailPage, { props });
    expect(body).not.toMatch(/value bet/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });
});
