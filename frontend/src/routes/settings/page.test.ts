import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render } from 'svelte/server';
import SettingsPage from './+page.svelte';
import PrefToggle from '$lib/components/settings/PrefToggle.svelte';

const ROUTE_SRC = readFileSync(
  fileURLToPath(new URL('./+page.svelte', import.meta.url)),
  'utf-8'
);

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

describe('Settings route — K0l-β (API-key persistence + PrefToggle)', () => {
  it('wires real (non-disabled) bound inputs for both API keys', () => {
    expect(ROUTE_SRC).toMatch(/data-input-football-data[^>]*bind:value=\{footballDataKey\}/);
    expect(ROUTE_SRC).toMatch(/data-input-anthropic[^>]*bind:value=\{anthropicKey\}/);
    expect(ROUTE_SRC).not.toMatch(/data-input-football-data[^>]*\bdisabled\b/);
    expect(ROUTE_SRC).not.toMatch(/data-input-anthropic[^>]*\bdisabled\b/);
  });

  it('persists API keys to the documented localStorage keys', () => {
    expect(ROUTE_SRC).toContain("'football_data_api_key'");
    expect(ROUTE_SRC).toContain('ANTHROPIC_API_KEY_STORAGE_KEY');
    expect(ROUTE_SRC).toContain("'kicker:notifications'");
  });

  it('declares the 3 notification toggles (match-start / model-edge / broadsheet-ready)', () => {
    expect(ROUTE_SRC).toContain('id="match-start"');
    expect(ROUTE_SRC).toContain('id="model-edge"');
    expect(ROUTE_SRC).toContain('id="broadsheet-ready"');
  });

  it('PrefToggle primitive renders with documented data-pref-* markers when checked', () => {
    const { body } = render(PrefToggle, {
      props: {
        id: 'sample',
        label: 'Sample',
        checked: true,
        onchange: () => {}
      }
    });
    expect(body).toContain('data-pref-toggle="sample"');
    expect(body).toContain('data-pref-checked="true"');
    expect(body).toContain('data-pref-switch="sample"');
    expect(body).toContain('aria-checked="true"');
    expect(body).toContain('role="switch"');
  });

  it('PrefToggle reflects checked=false in markers and aria', () => {
    const { body } = render(PrefToggle, {
      props: {
        id: 'off-sample',
        label: 'Off Sample',
        checked: false,
        onchange: () => {}
      }
    });
    expect(body).toContain('data-pref-checked="false"');
    expect(body).toContain('aria-checked="false"');
  });

  it('still renders no betting / Kelly / bankroll copy after β additions', () => {
    const { body } = render(SettingsPage);
    expect(body).not.toMatch(/value bets/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
    expect(body).not.toMatch(/value edge/i);
  });
});

describe('Settings route — K2c-α (paywall UI + mock entitlements)', () => {
  it('mounts UpgradeModal once at the page root (closed by default → not in body)', () => {
    expect(ROUTE_SRC).toContain('<UpgradeModal bind:open={upgradeOpen}');
    const { body } = render(SettingsPage);
    expect(body).not.toContain('data-upgrade-modal');
  });

  it('wires the pundit grid to lock all but voice when active tier is touchline', () => {
    expect(ROUTE_SRC).toMatch(/locked=\{activeTier === 'touchline' && id !== 'voice'\}/);
    expect(ROUTE_SRC).toContain('onLockedClick={() => (upgradeOpen = true)}');
  });

  it("declares the account-tab tier panel that opens the UpgradeModal", () => {
    expect(ROUTE_SRC).toContain('data-account-tier-panel');
    expect(ROUTE_SRC).toContain('data-account-upgrade-cta');
    expect(ROUTE_SRC).toContain('onclick={() => (upgradeOpen = true)}');
  });

  it("doesn't ship the legacy 'unlock at K2c' placeholder copy", () => {
    expect(ROUTE_SRC).not.toMatch(/unlock at K2c/i);
  });
});

describe('Settings route — K2a-β.7 (subnav mobile horizontal scroll)', () => {
  it('subnav <ul> stacks horizontally on mobile, vertically on lg+', () => {
    const { body } = render(SettingsPage);
    const lists = body.match(/<ul\b[^>]*data-settings-subnav-list[^>]*>/g) ?? [];
    expect(lists.length).toBe(2);
    for (const list of lists) {
      expect(list).toContain('flex');
      expect(list).toContain('lg:flex-col');
      expect(list).toContain('overflow-x-auto');
      expect(list).toContain('lg:overflow-visible');
      expect(list).toContain('-mx-4');
      expect(list).toContain('lg:mx-0');
    }
  });

  it('subnav buttons size to content on mobile and fill width on lg+', () => {
    const { body } = render(SettingsPage);
    const punditBtns = body.match(/<button\b[^>]*data-subnav-id="pundit"[^>]*>/g) ?? [];
    expect(punditBtns.length).toBe(2);
    for (const btn of punditBtns) {
      expect(btn).toContain('w-auto');
      expect(btn).toContain('lg:w-full');
    }
  });
});
