import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MobileTicker from './MobileTicker.svelte';

const SOURCE = readFileSync(
  fileURLToPath(new URL('./MobileTicker.svelte', import.meta.url)),
  'utf8'
);

describe('MobileTicker', () => {
  it('renders the marquee role with the default aria-label and mobile marker', () => {
    const { body } = render(MobileTicker);
    expect(body).toContain('role="marquee"');
    expect(body).toContain('aria-label="Live model ticker"');
    expect(body).toContain('data-mobile-ticker');
  });

  it('renders the honest neutral default when no items are supplied', () => {
    const { body } = render(MobileTicker);
    expect(body).toContain('THE KICKER   ·   AWAITING SCHEDULE');
  });

  it('source carries no hardcoded fake-live stat literals', () => {
    expect(SOURCE).not.toMatch(/GW33/);
    expect(SOURCE).not.toMatch(/0\.198/);
    expect(SOURCE).not.toMatch(/CALIBRATION 0\.94/);
    expect(SOURCE).not.toMatch(/EDGE \+4pp/);
  });

  it('source pins the mobile-specific 22px height (not desktop 28px)', () => {
    expect(SOURCE).toMatch(/height:\s*22px/);
    expect(SOURCE).not.toMatch(/height:\s*28px/);
  });

  it('source declares a right-edge mask-image fade so cropped content reads as intentional', () => {
    expect(SOURCE).toMatch(/mask-image:\s*linear-gradient\(to right,\s*black calc\(100% - 24px\),\s*transparent\)/);
    expect(SOURCE).toMatch(/-webkit-mask-image:\s*linear-gradient\(to right,\s*black calc\(100% - 24px\),\s*transparent\)/);
  });

  it('source declares a prefers-reduced-motion rule that cancels the marquee animation', () => {
    const reducedBlock = SOURCE.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/
    );
    expect(reducedBlock, 'reduced-motion media block should exist').not.toBeNull();
    expect(reducedBlock![0]).toMatch(/animation:\s*none/);
  });
});
