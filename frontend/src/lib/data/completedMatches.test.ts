import { describe, it, expect } from 'vitest';
import {
  getMatchesForTeam,
  getHeadToHead,
  getSeasonMatches,
  getTeamSeasonSummary,
  getTotalMatchCount,
  getAllSeasons,
} from './completedMatches';

describe('completedMatches — 33-season archive helpers', () => {
  describe('bundle integrity', () => {
    it('loads a reasonable number of matches from the bundled JSON', () => {
      // 33 PL seasons × ~380 matches each ≈ 12,500. Allow a wide tolerance
      // so a future season add doesn't false-positive this test.
      const count = getTotalMatchCount();
      expect(count).toBeGreaterThan(12_000);
      expect(count).toBeLessThan(13_500);
    });

    it('covers the span from 1993/94 through the current season', () => {
      const seasons = getAllSeasons();
      expect(seasons[0]).toBe('1993/94');
      expect(seasons.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('getMatchesForTeam', () => {
    it('filters by season', () => {
      const arsenal23 = getMatchesForTeam('Arsenal', { season: '2023/24' });
      expect(arsenal23.length).toBe(38);
      expect(arsenal23.every((m) => m.season === '2023/24')).toBe(true);
      expect(arsenal23.every((m) => m.home === 'Arsenal' || m.away === 'Arsenal')).toBe(true);
    });

    it('filters by venue = away', () => {
      const liverpoolAway23 = getMatchesForTeam('Liverpool', { season: '2023/24', venue: 'away' });
      expect(liverpoolAway23.length).toBe(19);
      expect(liverpoolAway23.every((m) => m.away === 'Liverpool')).toBe(true);
    });

    it('filters by result from the team perspective (W = wins)', () => {
      const cityWinsLastYear = getMatchesForTeam('Man City', { season: '2022/23', result: 'W' });
      // Man City won the 2022/23 title; conservative lower bound to stay
      // stable under future archive corrections.
      expect(cityWinsLastYear.length).toBeGreaterThanOrEqual(25);
      cityWinsLastYear.forEach((m) => {
        const wasHome = m.home === 'Man City';
        const wasAway = m.away === 'Man City';
        expect(wasHome || wasAway).toBe(true);
        if (wasHome) expect(m.result).toBe('H');
        else if (wasAway) expect(m.result).toBe('A');
      });
    });

    it('normalises API-style team names via canonicalTeam', () => {
      // "Manchester City FC" (API v4 format) should resolve to the same
      // CSV-canonical "Man City" rows — this is the alias map's job.
      const viaApi = getMatchesForTeam('Manchester City FC', { season: '2023/24', venue: 'away' });
      const viaCsv = getMatchesForTeam('Man City', { season: '2023/24', venue: 'away' });
      expect(viaApi.length).toBe(viaCsv.length);
      expect(viaCsv.length).toBe(19);
    });
  });

  describe('getHeadToHead', () => {
    it('returns meetings order-agnostic (A vs B same as B vs A)', () => {
      const arsChe = getHeadToHead('Arsenal', 'Chelsea');
      const cheArs = getHeadToHead('Chelsea', 'Arsenal');
      expect(arsChe.length).toBe(cheArs.length);
      expect(arsChe.length).toBeGreaterThan(30); // 33 seasons × 2 legs minus relegations
    });

    it('sorts most-recent-first and respects the limit option', () => {
      const recent5 = getHeadToHead('Liverpool', 'Man United', { limit: 5 });
      expect(recent5.length).toBe(5);
      for (let i = 1; i < recent5.length; i++) {
        expect(recent5[i - 1].date >= recent5[i].date).toBe(true);
      }
    });

    it('scopes by season when asked', () => {
      const arsTot23 = getHeadToHead('Arsenal', 'Tottenham', { season: '2023/24' });
      // North London derby plays twice a season; both legs should be present.
      expect(arsTot23.length).toBe(2);
      expect(arsTot23.every((m) => m.season === '2023/24')).toBe(true);
    });
  });

  describe('getSeasonMatches', () => {
    it('returns all 380 matches for a standard 20-club season', () => {
      const s23 = getSeasonMatches('2023/24');
      expect(s23.length).toBe(380);
    });

    it('returns an empty array for a non-existent season', () => {
      const future = getSeasonMatches('2099/00');
      expect(future).toEqual([]);
    });
  });

  describe('getTeamSeasonSummary', () => {
    it('aggregates wins / draws / losses consistent with the raw matches', () => {
      const summary = getTeamSeasonSummary('Liverpool', '2019/20');
      expect(summary).not.toBeNull();
      if (!summary) return;
      expect(summary.played).toBe(38);
      expect(summary.wins + summary.draws + summary.losses).toBe(summary.played);
      // Liverpool's title-winning 2019/20 had a huge GD; conservative floor.
      expect(summary.goalsFor - summary.goalsAgainst).toBeGreaterThan(30);
    });

    it('returns null for a team that didn\'t play in a given season', () => {
      // Burnley were in the Championship in 2015/16 (returned for 2016/17).
      const summary = getTeamSeasonSummary('Burnley', '2015/16');
      expect(summary).toBeNull();
    });
  });
});
