import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import TopScorerRow from './TopScorerRow.svelte';

describe('TopScorerRow', () => {
  it('renders rank, player, team, and goals with markers', () => {
    const { body } = render(TopScorerRow, {
      props: { rank: 1, player: 'Erling Haaland', team: 'Manchester City', goals: 21, assists: 4 }
    });
    expect(body).toContain('data-top-scorer-row');
    expect(body).toContain('data-scorer-rank="1"');
    expect(body).toContain('01');
    expect(body).toContain('Erling Haaland');
    expect(body).toContain('Manchester City');
    expect(body).toContain('data-scorer-goals');
    expect(body).toContain('>21<');
    expect(body).toContain('data-scorer-assists="4"');
    expect(body).toContain('+4');
  });

  it('renders an em-dash placeholder when assists is null or undefined', () => {
    const nullRow = render(TopScorerRow, {
      props: { rank: 7, player: 'Mo Salah', team: 'Liverpool', goals: 14, assists: null }
    });
    expect(nullRow.body).toContain('data-scorer-assists-missing');
    expect(nullRow.body).not.toContain('data-scorer-assists="');

    const undefRow = render(TopScorerRow, {
      props: { rank: 8, player: 'Bukayo Saka', team: 'Arsenal', goals: 12 }
    });
    expect(undefRow.body).toContain('data-scorer-assists-missing');
  });
});
