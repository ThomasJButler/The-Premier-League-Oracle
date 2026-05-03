import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MatchRow from './MatchRow.svelte';
import type { Match } from '../../../types';

const baseMatch: Match = {
  id: 'liv-tot-001',
  season_id: '2025',
  date: '2026-05-04T15:00:00Z',
  home_team: 'Liverpool',
  away_team: 'Tottenham',
  home_goals: null, away_goals: null, result: null,
  home_odds: 1.65, draw_odds: 3.5, away_odds: 5.0,
  first_half_home_goals: null, first_half_away_goals: null,
  full_time_result: null, half_time_result: null,
  referee: null, home_shots: null, away_shots: null,
  home_shots_target: null, away_shots_target: null,
  home_fouls: null, away_fouls: null,
  home_corners: null, away_corners: null,
  home_yellows: null, away_yellows: null,
  home_reds: null, away_reds: null,
  created_at: '2026-05-01T00:00:00Z',
  status: 'SCHEDULED',
};

const baseProps = {
  match: baseMatch,
  probH: 0.61,
  probD: 0.21,
  probA: 0.18,
  homeColor: '#c8102e',
  awayColor: '#132257',
};

describe('MatchRow', () => {
  it('renders both team names', () => {
    const { body } = render(MatchRow, { props: baseProps });
    expect(body).toContain('Liverpool');
    expect(body).toContain('Tottenham');
  });

  it('links to /fixtures/[id]', () => {
    const { body } = render(MatchRow, { props: baseProps });
    expect(body).toContain('href="/fixtures/liv-tot-001"');
    expect(body).toContain('data-match-row-id="liv-tot-001"');
  });

  it('renders desktop and mobile layout wrappers', () => {
    const { body } = render(MatchRow, { props: baseProps });
    expect(body).toContain('data-match-row-desktop');
    expect(body).toContain('data-match-row-mobile');
  });

  it('renders rounded probability readout', () => {
    const { body } = render(MatchRow, { props: baseProps });
    expect(body).toContain('data-match-prob-readout');
    expect(body).toContain('61');
    expect(body).toContain('21');
    expect(body).toContain('18');
  });

  it('renders desktop prob bar with team colors', () => {
    const { body } = render(MatchRow, { props: baseProps });
    const homeBar = body.match(/data-match-bar-home[^>]*>/);
    const awayBar = body.match(/data-match-bar-away[^>]*>/);
    expect(homeBar![0]).toContain('#c8102e');
    expect(awayBar![0]).toContain('#132257');
  });

  it('renders pick label and value when pick prop supplied', () => {
    const { body } = render(MatchRow, { props: { ...baseProps, pick: '2-0', conf: 69 } });
    expect(body).toContain('data-match-pick');
    expect(body).toContain('2-0');
    expect(body).toContain('data-match-conf');
    expect(body).toContain('69%');
  });

  it('omits pick block when pick prop is not supplied', () => {
    const { body } = render(MatchRow, { props: baseProps });
    // data-prediction-col is always rendered; check the VALUE div specifically
    expect(body).not.toContain('data-match-pick="');
    // data-match-pick as bare boolean attribute also should not appear
    expect(body).not.toMatch(/data-match-pick[^-]/);
  });

  it('renders mobile pick label when pick supplied', () => {
    const { body } = render(MatchRow, { props: { ...baseProps, pick: '1-1' } });
    expect(body).toContain('data-match-pick-mobile');
    expect(body).toContain('PICK 1-1');
  });

  it('carries aria-label with correct probability values on desktop bar', () => {
    const { body } = render(MatchRow, { props: baseProps });
    expect(body).toContain('Win probability: home 61%, draw 21%, away 18%');
  });
});
