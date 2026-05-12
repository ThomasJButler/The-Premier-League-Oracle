import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SettingsPage from './+page.svelte';

// Body snippet renders once per shell (desktop + mobile), so structural counts double.

describe('Settings route — K0l-α (shell + sub-tab routing + sections)', () => {
  it('renders without error', () => {
    const { body } = render(SettingsPage);
    expect(body).toBeTruthy();
  });

  it('renders both desktop and mobile shells', () => {
    const { body } = render(SettingsPage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-settings-page');
  });

  it('marks settings as active in the desktop KickerShell', () => {
    const { body } = render(SettingsPage);
    const link = body.match(/<a[^>]*data-nav-id="settings"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('marks more as the active mobile nav tab (no settings tab on mobile)', () => {
    const { body } = render(SettingsPage);
    const more = body.match(/<a[^>]*data-nav-id="more"[^>]*>/);
    expect(more).not.toBeNull();
    expect(more![0]).toContain('aria-current="page"');
  });

  it('renders all six sub-tab nav buttons by data-subnav-id', () => {
    const { body } = render(SettingsPage);
    const ids = ['pundit', 'api', 'display', 'account', 'notifications', 'privacy'];
    for (const id of ids) {
      // appears once per shell -> 2x
      const re = new RegExp(`data-subnav-id="${id}"`, 'g');
      expect((body.match(re) ?? []).length).toBe(2);
    }
  });

  it('default active sub-tab is pundit (SSR — no hash visible)', () => {
    const { body } = render(SettingsPage);
    const punditRows = body.match(/<button[^>]*data-subnav-id="pundit"[^>]*>/g) ?? [];
    expect(punditRows.length).toBe(2);
    for (const row of punditRows) {
      expect(row).toContain('aria-current="page"');
    }
  });

  it('renders the pundit panel by default with all 10 PunditPickerCard entries (per shell)', () => {
    const { body } = render(SettingsPage);
    expect(body).toContain('data-tab-panel="pundit"');
    // Each shell renders 10 cards -> 20 total
    const cardCount = (body.match(/data-picker-id="/g) ?? []).length;
    expect(cardCount).toBe(20);
  });

  it('default-selected picker card matches the default persona (voice)', () => {
    const { body } = render(SettingsPage);
    const voiceCards = body.match(/<button[^>]*data-picker-id="voice"[^>]*>/g) ?? [];
    expect(voiceCards.length).toBe(2);
    for (const card of voiceCards) {
      expect(card).toContain('data-picker-selected="true"');
    }
  });

  it('does not render the API, display, account, notifications, or privacy panels initially', () => {
    const { body } = render(SettingsPage);
    expect(body).not.toContain('data-tab-panel="api"');
    expect(body).not.toContain('data-tab-panel="display"');
    expect(body).not.toContain('data-tab-panel="account"');
    expect(body).not.toContain('data-tab-panel="notifications"');
    expect(body).not.toContain('data-tab-panel="privacy"');
  });

  it('renders no betting / Kelly / bankroll copy', () => {
    const { body } = render(SettingsPage);
    expect(body).not.toMatch(/value bets/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });
});
