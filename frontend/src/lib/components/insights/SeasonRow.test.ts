import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SeasonRow from './SeasonRow.svelte';

describe('SeasonRow', () => {
  it('renders season label + champion + points/GD markers', () => {
    const { body } = render(SeasonRow, {
      props: {
        season: '2003/04',
        champion: 'Arsenal',
        points: 90,
        goalDifference: 47,
        active: false
      }
    });
    expect(body).toContain('data-season-row');
    expect(body).toContain('data-season="2003/04"');
    expect(body).toContain('data-season-label');
    expect(body).toContain('2003/04');
    expect(body).toContain('Arsenal');
    expect(body).toContain('90 pts');
    expect(body).toContain('GD +47');
  });

  it('signs negative goal differences without doubling the minus', () => {
    const { body } = render(SeasonRow, {
      props: {
        season: '1999/00',
        champion: 'Underperformers FC',
        points: 30,
        goalDifference: -12,
        active: false
      }
    });
    expect(body).toContain('GD -12');
    expect(body).not.toContain('GD +-12');
  });

  it('renders an in-progress placeholder when no champion is known', () => {
    const { body } = render(SeasonRow, {
      props: {
        season: '2025/26',
        champion: null,
        points: null,
        goalDifference: null,
        inProgress: true,
        active: true
      }
    });
    expect(body).toContain('data-season-in-progress');
    expect(body).toContain('In progress');
    expect(body).toContain('TBD');
    expect(body).toContain('aria-current="true"');
  });

  it('marks the active row with aria-current and the is-active class', () => {
    const { body } = render(SeasonRow, {
      props: {
        season: '2003/04',
        champion: 'Arsenal',
        points: 90,
        goalDifference: 47,
        active: true
      }
    });
    expect(body).toContain('aria-current="true"');
    expect(body).toMatch(/class="[^"]*is-active/);
  });
});
