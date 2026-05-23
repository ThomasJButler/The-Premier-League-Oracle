import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import LivePage from './+page.svelte';

const props = { data: { id: 'pl-test-1' } };

describe('Live match route (/fixtures/[id]/live)', () => {
  it('mounts both desktop-shell and mobile-shell wrappers', () => {
    const { body } = render(LivePage, { props });
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
  });

  it('marks fixtures as the active nav in both shells', () => {
    const { body } = render(LivePage, { props });
    const activeMarkers = body.match(/data-nav-id="fixtures"/g) ?? [];
    expect(activeMarkers.length).toBeGreaterThanOrEqual(2);
    const shellLink = body.match(/<a[^>]*data-nav-id="fixtures"[^>]*>/);
    expect(shellLink).not.toBeNull();
    expect(shellLink![0]).toContain('aria-current="page"');
  });

  it('SSRs the loading state (feed resolves in onMount on the client)', () => {
    const { body } = render(LivePage, { props });
    const matches = body.match(/data-live-loading/g) ?? [];
    expect(matches.length).toBe(2);
    expect(body).not.toContain('data-live-scoreboard');
    expect(body).not.toContain('data-live-missing');
  });

  it('renders no betting copy', () => {
    const { body } = render(LivePage, { props });
    expect(body).not.toMatch(/value bet/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });
});
