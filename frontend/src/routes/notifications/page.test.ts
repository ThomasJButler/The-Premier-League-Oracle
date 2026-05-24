import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import NotificationsPage from './+page.svelte';

describe('Notifications route — K1f-α', () => {
  it('renders without error', () => {
    const { body } = render(NotificationsPage);
    expect(body).toBeTruthy();
  });

  it('renders both desktop and mobile shells', () => {
    const { body } = render(NotificationsPage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-notifications-page');
  });

  it('marks "more" as active in the mobile bottom-nav (notifications nests under More)', () => {
    const { body } = render(NotificationsPage);
    const link = body.match(/<a\b[^>]*data-nav-id="more"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('SSRs the loading hint once per shell (hydration happens onMount)', () => {
    const { body } = render(NotificationsPage);
    expect((body.match(/data-notifications-loading/g) ?? []).length).toBe(2);
    expect(body).not.toContain('data-notifications-empty');
    expect(body).not.toContain('data-notifications-list');
  });

  it('renders the "Manage in Settings" link to the notifications tab', () => {
    const { body } = render(NotificationsPage);
    const link = body.match(/<a\b[^>]*data-notifications-settings-link[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('href="/settings#notifications"');
  });

  it('renders the Rule kicker "THE WIRE" and title "Notifications"', () => {
    const { body } = render(NotificationsPage);
    expect(body).toContain('THE WIRE');
    expect(body).toContain('Notifications');
  });

  it('has no betting copy', () => {
    const { body } = render(NotificationsPage);
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
