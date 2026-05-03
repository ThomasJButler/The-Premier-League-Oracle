import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MobilePersonaPill from './MobilePersonaPill.svelte';

describe('MobilePersonaPill', () => {
  it('renders an anchor to /settings by default with the active persona short label', () => {
    const { body } = render(MobilePersonaPill);
    expect(body).toContain('data-mobile-persona-pill');
    const tag = body.match(/<a\b[^>]*data-mobile-persona-pill[^>]*>/);
    expect(tag, 'expected an anchor with data-mobile-persona-pill').not.toBeNull();
    expect(tag![0]).toContain('href="/settings"');
    expect(body).toContain('data-pill-persona-id="voice"');
    expect(body).toContain('data-pill-name');
    expect(body).toContain('Voice');
  });

  it('honours a custom href prop', () => {
    const { body } = render(MobilePersonaPill, { props: { href: '/settings#pundit' } });
    const tag = body.match(/<a\b[^>]*data-mobile-persona-pill[^>]*>/);
    expect(tag![0]).toContain('href="/settings#pundit"');
  });

  it('exposes a persona-accent dot driven by the cascading CSS variable', () => {
    const { body } = render(MobilePersonaPill);
    expect(body).toContain('data-pill-accent');
  });
});
