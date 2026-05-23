import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render } from 'svelte/server';
import OraclePage from './+page.svelte';

const GEOFF_MSG_SRC = readFileSync(
  fileURLToPath(new URL('../../lib/components/chat/GeoffMessage.svelte', import.meta.url)),
  'utf-8'
);

// The route body renders once per shell (desktop + mobile), so structural counts double.
// K1a-β.2 drops the static SEED — SSR with no thread renders an empty-state hint instead.

describe('Oracle route — K1a-β.2 (composer wired to /api/chat)', () => {
  it('renders without error', () => {
    const { body } = render(OraclePage);
    expect(body).toBeTruthy();
  });

  it('renders both desktop and mobile shells', () => {
    const { body } = render(OraclePage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-oracle-page');
    expect(body).toContain('data-oracle-mobile');
  });

  it('marks oracle as active in the desktop KickerShell', () => {
    const { body } = render(OraclePage);
    const link = body.match(/<a\b[^>]*data-nav-id="oracle"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('marks oracle as active in the mobile bottom-nav', () => {
    const { body } = render(OraclePage);
    const tags = body.match(/<a\b[^>]*data-nav-id="oracle"[^>]*>/g) ?? [];
    expect(tags.length).toBe(2);
    for (const tag of tags) {
      expect(tag).toContain('aria-current="page"');
    }
  });

  it('renders an empty-state hint when no thread exists (one per shell)', () => {
    const { body } = render(OraclePage);
    const hits = body.match(/data-oracle-empty/g) ?? [];
    expect(hits.length).toBe(2);
    // No SEED primitives should render in the empty state.
    expect(body).not.toContain('data-geoff-message');
    expect(body).not.toContain('data-user-message');
  });

  it('renders the GeoffComposer with an input field', () => {
    const { body } = render(OraclePage);
    expect((body.match(/data-composer(?![-\w])/g) ?? []).length).toBe(2);
    expect((body.match(/data-composer-input/g) ?? []).length).toBe(2);
    expect((body.match(/data-composer-send/g) ?? []).length).toBe(2);
  });

  it('renders all four default prompt chips per shell (8 total)', () => {
    const { body } = render(OraclePage);
    const hits = body.match(/data-prompt-chip/g) ?? [];
    expect(hits.length).toBe(8);
    expect(body).not.toMatch(/where['’]s the value/i);
  });

  it('does not include betting copy on the Oracle page', () => {
    const { body } = render(OraclePage);
    expect(body).not.toMatch(/value bets?/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });

  it('drives the GeoffMessage avatar from var(--persona-accent), not inline hex', () => {
    expect(GEOFF_MSG_SRC).toContain('var(--persona-accent');
    const styleBlock = GEOFF_MSG_SRC.match(/<style>[\s\S]*<\/style>/)?.[0] ?? '';
    expect(styleBlock).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
