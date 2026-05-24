import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SeasonDetail from './SeasonDetail.svelte';
import type { SeasonRecord } from '$lib/fixtures/leagueHistory';
import type { SeasonStats } from '$lib/data/statsPack';

const RECORD: SeasonRecord = {
  season: '2003/04',
  champion: { team: 'Arsenal', points: 90, goalDifference: 47 },
  runnerUp: { team: 'Chelsea', points: 79 }
};

const STATS: SeasonStats = {
  matches: 380,
  homeWinRate: 0.474,
  drawRate: 0.255,
  awayWinRate: 0.271,
  avgHomeGoals: 1.5,
  avgAwayGoals: 1.2,
  avgTotalGoals: 2.66,
  over25Rate: 0.5,
  bttsRate: 0.47,
  isAnomalous: false,
  anomalyReasons: []
};

describe('SeasonDetail', () => {
  it('renders the season header + champion + runner-up blocks', () => {
    const { body } = render(SeasonDetail, {
      props: { record: RECORD, seasonStats: STATS, verdictBody: null, personaName: 'Cheers, Geoff' }
    });
    expect(body).toContain('data-season-detail');
    expect(body).toContain('data-detail-season');
    expect(body).toContain('2003/04');
    expect(body).toContain('data-detail-champion');
    expect(body).toContain('Arsenal');
    expect(body).toContain('90 pts');
    expect(body).toContain('GD +47');
    expect(body).toContain('data-detail-runnerup');
    expect(body).toContain('Chelsea');
    expect(body).toContain('79 pts');
  });

  it('renders the four stat tiles when seasonStats are present', () => {
    const { body } = render(SeasonDetail, {
      props: { record: RECORD, seasonStats: STATS, verdictBody: null, personaName: 'Cheers, Geoff' }
    });
    expect(body).toContain('data-detail-stat="matches"');
    expect(body).toContain('data-detail-stat="goals"');
    expect(body).toContain('data-detail-stat="home"');
    expect(body).toContain('data-detail-stat="btts"');
    expect(body).toContain('2.66');
  });

  it('surfaces the anomaly block when seasonStats.isAnomalous', () => {
    const anomalous: SeasonStats = {
      ...STATS,
      isAnomalous: true,
      anomalyReasons: ['drawRate 18.7% is -6.8% vs mean 25.5%']
    };
    const { body } = render(SeasonDetail, {
      props: { record: RECORD, seasonStats: anomalous, verdictBody: null, personaName: 'Cheers, Geoff' }
    });
    expect(body).toContain('data-detail-anomaly');
    expect(body).toContain('data-detail-anomaly-reason');
    expect(body).toContain('drawRate 18.7%');
  });

  it('falls back to "No verdict on file" when verdictBody is null', () => {
    const { body } = render(SeasonDetail, {
      props: { record: RECORD, seasonStats: STATS, verdictBody: null, personaName: 'Cheers, Geoff' }
    });
    expect(body).toContain('data-verdict-empty');
    expect(body).toContain('No verdict on file');
    expect(body).toContain('Cheers, Geoff');
    expect(body).not.toContain('data-verdict-body');
  });

  it('renders a verdict body when one is cached', () => {
    const { body } = render(SeasonDetail, {
      props: {
        record: RECORD,
        seasonStats: STATS,
        verdictBody: 'The Invincibles delivered a 38-game refusal.',
        personaName: 'Cheers, Geoff'
      }
    });
    expect(body).toContain('data-verdict-body');
    expect(body).toContain('The Invincibles delivered a 38-game refusal.');
    expect(body).not.toContain('data-verdict-empty');
  });

  it('renders the in-progress fallback when the season has no champion yet', () => {
    const inProgress: SeasonRecord = {
      season: '2025/26',
      champion: null,
      runnerUp: null,
      inProgress: true
    };
    const { body } = render(SeasonDetail, {
      props: { record: inProgress, verdictBody: null, personaName: 'Cheers, Geoff' }
    });
    expect(body).toContain('data-detail-trophy-pending');
    expect(body).toContain('IN PROGRESS');
    expect(body).not.toContain('data-detail-champion');
  });

  it('has no betting copy', () => {
    const { body } = render(SeasonDetail, {
      props: { record: RECORD, seasonStats: STATS, verdictBody: null, personaName: 'Cheers, Geoff' }
    });
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
