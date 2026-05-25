import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MatchHero from './MatchHero.svelte';
import type { Fixture } from '../../../types/redesign';

const previewFixture: Fixture = {
  id: 'pl-99-arsliv',
  competition: 'Premier League',
  gameweek: 12,
  utcDate: '2026-06-07T14:00:00Z',
  status: 'SCHEDULED',
  venue: 'Emirates Stadium',
  home: { abbr: 'ARS', name: 'Arsenal' },
  away: { abbr: 'LIV', name: 'Liverpool' }
};

const liveFixture: Fixture = {
  ...previewFixture,
  status: 'LIVE',
  minute: 67,
  score: { home: 2, away: 1 }
};

const finishedFixture: Fixture = {
  ...previewFixture,
  status: 'FINISHED',
  score: { home: 3, away: 0 }
};

describe('MatchHero', () => {
  it('renders the hero marker with kind=preview by default', () => {
    const { body } = render(MatchHero, { props: { fixture: previewFixture } });
    expect(body).toContain('data-match-hero');
    expect(body).toContain('data-match-hero-kind="preview"');
  });

  it('renders home and away team names and abbreviations', () => {
    const { body } = render(MatchHero, { props: { fixture: previewFixture } });
    expect(body).toContain('Arsenal');
    expect(body).toContain('Liverpool');
    expect(body).toContain('HOME · ARS');
    expect(body).toContain('AWAY · LIV');
  });

  it('shows KICK-OFF status + a versus glyph for a scheduled preview', () => {
    const { body } = render(MatchHero, { props: { fixture: previewFixture } });
    expect(body).toContain('KICK-OFF');
    expect(body).toContain('data-hero-versus');
    expect(body).not.toContain('data-hero-score');
  });

  it('renders the venue when present', () => {
    const { body } = render(MatchHero, { props: { fixture: previewFixture } });
    expect(body).toContain('data-hero-venue');
    expect(body).toContain('Emirates Stadium');
  });

  it('omits the venue block when fixture has no venue', () => {
    const noVenue: Fixture = { ...previewFixture, venue: undefined };
    const { body } = render(MatchHero, { props: { fixture: noVenue } });
    expect(body).not.toContain('data-hero-venue');
  });

  it('renders kickoff date + time in Europe/London locale', () => {
    const { body } = render(MatchHero, { props: { fixture: previewFixture } });
    // 14:00Z on Sunday 2026-06-07 → 15:00 BST, Sunday 7 June.
    expect(body).toContain('SUNDAY');
    expect(body).toContain('7 JUNE');
    expect(body).toContain('15:00');
  });

  it('shows LIVE + minute readout for a live fixture', () => {
    const { body } = render(MatchHero, { props: { fixture: liveFixture, kind: 'live' } });
    expect(body).toContain('data-match-hero-kind="live"');
    expect(body).toContain("LIVE · 67'");
    expect(body).toContain('data-hero-score');
    expect(body).toContain('LIVE SCORE');
  });

  it('shows FULL TIME label + final score for a finished fixture', () => {
    const { body } = render(MatchHero, { props: { fixture: finishedFixture } });
    expect(body).toContain('FULL TIME');
    expect(body).toContain('FINAL SCORE');
    expect(body).toContain('data-hero-score');
  });

  it('renders no betting copy', () => {
    const { body } = render(MatchHero, { props: { fixture: previewFixture } });
    expect(body).not.toMatch(/value bet/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });

  describe('mobile template', () => {
    it('emits a mobile wrapper alongside the desktop wrapper', () => {
      const { body } = render(MatchHero, { props: { fixture: previewFixture } });
      expect(body).toContain('data-hero-mobile');
      expect(body).toContain('data-hero-desktop');
    });

    it('mobile wrapper uses lg:hidden and desktop wrapper uses hidden lg:block', () => {
      const { body } = render(MatchHero, { props: { fixture: previewFixture } });
      expect(body).toMatch(/lg:hidden[^"]*"[^>]*data-hero-mobile/);
      expect(body).toMatch(/hidden lg:block[^"]*"[^>]*data-hero-desktop/);
    });

    it('mobile meta line carries kickoff time and venue when present', () => {
      const { body } = render(MatchHero, { props: { fixture: previewFixture } });
      expect(body).toContain('data-hero-mobile-meta');
      const metaSlice = body.split('data-hero-mobile-meta')[1] ?? '';
      expect(metaSlice).toContain('Emirates Stadium');
      expect(metaSlice).toContain('SUNDAY 7 JUNE');
      expect(metaSlice).toContain('15:00');
    });

    it('mobile meta line omits venue prefix when fixture has no venue', () => {
      const noVenue: Fixture = { ...previewFixture, venue: undefined };
      const { body } = render(MatchHero, { props: { fixture: noVenue } });
      expect(body).toContain('data-hero-mobile-meta');
      expect(body).not.toMatch(/Emirates Stadium/);
    });

    it('mobile template shows LIVE SCORE label for a live fixture', () => {
      const { body } = render(MatchHero, { props: { fixture: liveFixture, kind: 'live' } });
      const mobileSlice = body.split('data-hero-mobile')[1] ?? '';
      expect(mobileSlice).toContain('LIVE SCORE');
      expect(mobileSlice).toContain('2 — 1');
    });
  });
});
