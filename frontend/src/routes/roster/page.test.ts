import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import RosterPage from './+page.svelte';

describe('Roster route — K1g', () => {
  it('renders without error', () => {
    const { body } = render(RosterPage);
    expect(body).toBeTruthy();
  });

  it('renders both desktop and mobile shells', () => {
    const { body } = render(RosterPage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-roster-page');
  });

  it('marks "more" as active in the mobile bottom-nav (roster nests under More)', () => {
    const { body } = render(RosterPage);
    const link = body.match(/<a\b[^>]*data-nav-id="more"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('leaves no desktop nav anchor as active (roster has no slot in KickerShell NavId)', () => {
    const { body } = render(RosterPage);
    // KickerShell only emits aria-current="page" on the active nav anchor; with no `active`
    // prop wired, none of the desktop sidebar anchors should be marked current.
    const desktopBlock = body.match(/data-desktop-shell[\s\S]*?<\/aside>/);
    expect(desktopBlock, 'expected to find the desktop sidebar block').not.toBeNull();
    expect(desktopBlock![0]).not.toContain('aria-current="page"');
  });

  it('renders 10 PunditCards (one per persona) across both shells', () => {
    const { body } = render(RosterPage);
    const count = (body.match(/data-pundit-id="/g) ?? []).length;
    // 10 personas × 2 shells = 20
    expect(count).toBe(20);
  });

  it('renders 2 roster grids (one per shell)', () => {
    const { body } = render(RosterPage);
    expect((body.match(/data-roster-grid/g) ?? []).length).toBe(2);
  });

  it('renders the voice-range cross-link', () => {
    const { body } = render(RosterPage);
    const link = body.match(/<a\b[^>]*data-roster-voices-link[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('href="/roster/voices"');
  });

  it('renders the Rule kicker "THE STAFF" and title "The Roster"', () => {
    const { body } = render(RosterPage);
    expect(body).toContain('THE STAFF');
    expect(body).toContain('The Roster');
  });

  it('has no betting copy', () => {
    const { body } = render(RosterPage);
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
