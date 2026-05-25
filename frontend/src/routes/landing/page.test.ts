import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import LandingPage from './+page.svelte';

describe('Landing route — K1h.1', () => {
  it('renders without error and exposes the page marker', () => {
    const { body } = render(LandingPage);
    expect(body).toBeTruthy();
    expect(body).toContain('data-landing-page');
  });

  it('renders all 6 feature cards', () => {
    const { body } = render(LandingPage);
    const count = (body.match(/data-landing-feature(?![-\w])/g) ?? []).length;
    expect(count).toBe(6);
  });

  it('renders 4 voice-reel cards (one per persona id)', () => {
    const { body } = render(LandingPage);
    const count = (body.match(/data-landing-voice(?![-\w])/g) ?? []).length;
    expect(count).toBe(4);
    for (const id of ['scouser', 'volcano', 'optimist', 'philosopher']) {
      expect(body).toContain(`data-landing-voice-id="${id}"`);
    }
  });

  it('renders all 3 pricing tiers with the locked variant ids', () => {
    const { body } = render(LandingPage);
    expect((body.match(/data-landing-plan(?![-\w])/g) ?? []).length).toBe(3);
    expect(body).toContain('data-landing-plan-tier="touchline"');
    expect(body).toContain('data-landing-plan-tier="press-box"');
    expect(body).toContain('data-landing-plan-tier="print-run"');
  });

  it('flags the Press Box tier with a "MOST POPULAR" badge', () => {
    const { body } = render(LandingPage);
    expect((body.match(/data-landing-plan-badge/g) ?? []).length).toBe(2);
    expect(body).toContain('MOST POPULAR');
    expect(body).toContain('FOR THE COMMITTED');
  });

  it('points every primary CTA at /onboarding', () => {
    const { body } = render(LandingPage);
    const ctas = [
      'data-landing-cta-nav',
      'data-landing-cta-nav-mobile',
      'data-landing-cta-hero',
      'data-landing-plan-cta'
    ];
    for (const marker of ctas) {
      const matches = body.match(new RegExp(`<a\\b[^>]*${marker}[^>]*>`, 'g')) ?? [];
      expect(matches.length, `expected ${marker} to be present`).toBeGreaterThan(0);
      for (const link of matches) {
        expect(link).toContain('href="/onboarding"');
      }
    }
  });

  it('has no betting copy', () => {
    const { body } = render(LandingPage);
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
