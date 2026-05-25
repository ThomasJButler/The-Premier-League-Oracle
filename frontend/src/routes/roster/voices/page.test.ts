import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import VoicesPage from './+page.svelte';

describe('Roster · Voice range route — K1g', () => {
  it('renders without error', () => {
    const { body } = render(VoicesPage);
    expect(body).toBeTruthy();
  });

  it('renders both desktop and mobile shells', () => {
    const { body } = render(VoicesPage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-voices-page');
  });

  it('marks "more" as active in the mobile bottom-nav (voice range nests under More)', () => {
    const { body } = render(VoicesPage);
    const link = body.match(/<a\b[^>]*data-nav-id="more"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('renders 10 VoiceColumn cards (one per persona) across both shells', () => {
    const { body } = render(VoicesPage);
    const count = (body.match(/data-voice-id="/g) ?? []).length;
    expect(count).toBe(20);
  });

  it('renders 2 voices grids (one per shell — desktop grid + mobile carousel)', () => {
    const { body } = render(VoicesPage);
    expect((body.match(/data-voices-grid/g) ?? []).length).toBe(2);
  });

  it('renders the mobile carousel chrome (avatar strip, snap carousel, dots, swipe hint)', () => {
    const { body } = render(VoicesPage);
    expect(body).toContain('data-voices-carousel');
    expect(body).toContain('data-voices-strip');
    expect(body).toContain('data-voices-swipe-hint');
    expect(body).toContain('data-kpi-dots');
    expect((body.match(/data-voices-avatar-id="/g) ?? []).length).toBe(10);
    expect((body.match(/data-voices-carousel-slide/g) ?? []).length).toBe(10);
  });

  it('mobile carousel uses scroll-snap classes', () => {
    const { body } = render(VoicesPage);
    const carousel = body.match(/<div\b[^>]*data-voices-carousel[^>]*>/);
    expect(carousel).not.toBeNull();
    expect(carousel![0]).toContain('overflow-x-auto');
    expect(carousel![0]).toContain('snap-x');
    expect(carousel![0]).toContain('snap-mandatory');
  });

  it('renders the roster cross-link', () => {
    const { body } = render(VoicesPage);
    const link = body.match(/<a\b[^>]*data-voices-roster-link[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('href="/roster"');
  });

  it('renders the Rule kicker "VOICE RANGE"', () => {
    const { body } = render(VoicesPage);
    expect(body).toContain('VOICE RANGE');
    expect(body).toContain('Ten voices, one matchup');
  });

  it('has no betting copy', () => {
    const { body } = render(VoicesPage);
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
