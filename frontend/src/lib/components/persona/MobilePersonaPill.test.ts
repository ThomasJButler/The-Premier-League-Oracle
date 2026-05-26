import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MobilePersonaPill from './MobilePersonaPill.svelte';

describe('MobilePersonaPill', () => {
  it('renders a display-only div carrying the active persona short label', () => {
    const { body } = render(MobilePersonaPill);
    expect(body).toContain('data-mobile-persona-pill');
    const tag = body.match(/<div\b[^>]*data-mobile-persona-pill[^>]*>/);
    expect(tag, 'expected a div with data-mobile-persona-pill').not.toBeNull();
    expect(body).toContain('data-pill-persona-id="voice"');
    expect(body).toContain('data-pill-name');
    expect(body).toContain('Voice');
  });

  it('is not interactive — no anchor element, no href, no aria-label, no border-rule chip styling', () => {
    const { body } = render(MobilePersonaPill);
    expect(body).not.toMatch(/<a\b[^>]*data-mobile-persona-pill/);
    expect(body).not.toContain('href="/settings"');
    expect(body).not.toContain('aria-label="Switch pundit"');
    const tag = body.match(/<div\b[^>]*data-mobile-persona-pill[^>]*>/)![0];
    expect(tag).not.toContain('border-rule');
    expect(tag).not.toContain('border ');
  });

  it('exposes a persona-accent dot driven by the cascading CSS variable', () => {
    const { body } = render(MobilePersonaPill);
    expect(body).toContain('data-pill-accent');
  });
});
