import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render } from 'svelte/server';
import RumoursPage from './+page.svelte';

const ROUTE_SRC = readFileSync(
  fileURLToPath(new URL('./+page.svelte', import.meta.url)),
  'utf-8'
);
const NOTIFY_SIGNUP_SRC = readFileSync(
  fileURLToPath(new URL('../../lib/rumours/notifySignup.ts', import.meta.url)),
  'utf-8'
);

describe('Rumours route — K1i', () => {
  it('renders without error', () => {
    const { body } = render(RumoursPage);
    expect(body).toBeTruthy();
  });

  it('renders both desktop and mobile shells with stable markers', () => {
    const { body } = render(RumoursPage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-rumours-page');
    expect(body).toContain('data-rumours-page-mobile');
  });

  it('marks "more" as active in the mobile bottom-nav (rumours nests under More)', () => {
    const { body } = render(RumoursPage);
    const link = body.match(/<a\b[^>]*data-nav-id="more"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('leaves no desktop nav anchor as active (rumours has no slot in KickerShell NavId)', () => {
    const { body } = render(RumoursPage);
    const desktopBlock = body.match(/data-desktop-shell[\s\S]*?<\/aside>/);
    expect(desktopBlock, 'expected to find the desktop sidebar block').not.toBeNull();
    expect(desktopBlock![0]).not.toContain('aria-current="page"');
  });

  it('renders the COMING SOON hero copy on desktop and a stub on mobile', () => {
    const { body } = render(RumoursPage);
    expect((body.match(/COMING SOON · JUNE 2026/g) ?? []).length).toBe(2);
    expect(body).toContain('data-rumours-hero');
    expect(body).toContain('data-rumours-mobile-stub');
  });

  it('renders all 6 rumour rows with HeatBar + LockedColumn primitives (desktop teaser only)', () => {
    const { body } = render(RumoursPage);
    expect((body.match(/data-rumour-row(?![-\w])/g) ?? []).length).toBe(6);
    expect((body.match(/data-heat-bar(?![-\w])/g) ?? []).length).toBe(6);
    expect((body.match(/data-locked-column(?![-\w])/g) ?? []).length).toBe(6);
    expect(body).toContain('PROBABILITY SCORES UNLOCK JUNE 9');
  });

  it('renders the Cheers Geoff footer callout under the rumour list', () => {
    const { body } = render(RumoursPage);
    expect(body).toContain('data-rumours-footer');
    expect(body).toContain('£2.1bn');
    expect(body).toContain('SPENT LAST WINDOW');
  });

  it('has no betting copy', () => {
    const { body } = render(RumoursPage);
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });

  it('K2a-β.7 — mobile stub renders 3 compressed feature rows + early-rumour count', () => {
    const { body } = render(RumoursPage);
    expect(body).toContain('data-rumours-mobile-features');
    expect((body.match(/data-rumours-mobile-feature(?![-\w])/g) ?? []).length).toBe(3);
    expect(body).toContain('data-rumours-mobile-count');
    expect(body).toContain('6 EARLY RUMOURS · WAITING');
    expect(body).toContain('DEAL PROBABILITY');
    expect(body).toContain("MACCA'S DESK");
    expect(body).toContain('IMPACT RATING');
  });
});

describe('Rumours route — T6 (NOTIFY ME email capture)', () => {
  it('SSR renders the untouched CTA state on both desktop and mobile (no form, no done-state)', () => {
    const { body } = render(RumoursPage);
    expect(body).toContain('data-rumours-notify-cta');
    expect(body).toContain('data-rumours-notify-cta-mobile');
    expect(body).not.toContain('data-rumours-notify-form');
    expect(body).not.toContain('data-rumours-notify-done');
    expect(body).not.toContain('data-rumours-notify-input');
  });

  it('wires the form to validate via isValidEmail and persist via saveRumoursSignup', () => {
    expect(ROUTE_SRC).toContain(
      "import { isValidEmail, readRumoursSignup, saveRumoursSignup } from '$lib/rumours/notifySignup';"
    );
    expect(ROUTE_SRC).toMatch(/isValidEmail\(notifyEmail\)/);
    expect(ROUTE_SRC).toMatch(/saveRumoursSignup\(notifyEmail\)/);
    expect(ROUTE_SRC).toMatch(/data-rumours-notify-input[\s\S]*?bind:value=\{notifyEmail\}/);
  });

  it('restores the confirmed state from storage on mount (readRumoursSignup)', () => {
    expect(ROUTE_SRC).toMatch(/onMount\(\(\) => \{[\s\S]*?readRumoursSignup\(\)/);
  });

  it('pushes exactly one in-app rumours notification, only on first signup', () => {
    expect(ROUTE_SRC).toMatch(/const isFirstSignup = readRumoursSignup\(\) === null;/);
    expect(ROUTE_SRC).toMatch(/if \(isFirstSignup\) \{\s*addNotification\(\{/);
    expect(ROUTE_SRC).toMatch(/addNotification\(\{\s*type: 'rumours',/);
  });

  it('keeps the copy honest — no promise of delivered email', () => {
    expect(ROUTE_SRC).toMatch(/No email delivery yet/i);
    expect(ROUTE_SRC).not.toMatch(/we('| wi)ll email you/i);
  });

  it('the notifySignup module persists under the documented storage key', () => {
    expect(NOTIFY_SIGNUP_SRC).toContain("STORAGE_KEY = 'kicker:rumoursNotify'");
  });
});
