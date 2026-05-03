import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import GeoffTicker from './GeoffTicker.svelte';

const SOURCE = readFileSync(
  fileURLToPath(new URL('./GeoffTicker.svelte', import.meta.url)),
  'utf8'
);

describe('GeoffTicker', () => {
  it('renders the marquee role with the default aria-label', () => {
    const { body } = render(GeoffTicker);
    expect(body).toContain('role="marquee"');
    expect(body).toContain('aria-label="Live model ticker"');
  });

  it('joins items into the tape with a centred dot separator', () => {
    const { body } = render(GeoffTicker, {
      props: { items: ['ALPHA', 'BETA', 'GAMMA'] }
    });
    expect(body).toContain('ALPHA   ·   BETA   ·   GAMMA');
  });

  it('duplicates the tape so the marquee can loop seamlessly', () => {
    const { body } = render(GeoffTicker, {
      props: { items: ['ONLY'] }
    });
    const occurrences = body.split('ONLY').length - 1;
    expect(occurrences).toBe(2);
  });

  it('source declares a prefers-reduced-motion rule that cancels the marquee animation', () => {
    expect(SOURCE).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    const reducedBlock = SOURCE.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/
    );
    expect(reducedBlock, 'reduced-motion media block should exist').not.toBeNull();
    expect(reducedBlock![0]).toMatch(/animation:\s*none/);
  });
});
