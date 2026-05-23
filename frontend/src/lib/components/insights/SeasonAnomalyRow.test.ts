import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SeasonAnomalyRow from './SeasonAnomalyRow.svelte';

describe('SeasonAnomalyRow', () => {
  it('renders the season + all reasons with markers', () => {
    const { body } = render(SeasonAnomalyRow, {
      props: {
        season: '2020/21',
        reasons: [
          'homeWinRate 37.9% is -7.7% vs 33-season mean 45.6%',
          'awayWinRate 40.3% is +11.4% vs mean 28.9%'
        ]
      }
    });
    expect(body).toContain('data-anomaly-row');
    expect(body).toContain('data-anomaly-season="2020/21"');
    expect(body).toContain('2020/21');
    expect(body).toContain('data-anomaly-reasons');
    expect((body.match(/data-anomaly-reason/g) ?? []).length).toBe(3); // 1 parent + 2 reasons
    expect(body).toContain('homeWinRate 37.9% is -7.7% vs 33-season mean 45.6%');
    expect(body).toContain('awayWinRate 40.3% is +11.4% vs mean 28.9%');
  });

  it('renders an empty list when there are no reasons', () => {
    const { body } = render(SeasonAnomalyRow, {
      props: { season: '2018/19', reasons: [] }
    });
    expect(body).toContain('data-anomaly-row');
    // Parent marker still present, but no per-reason <li> markers
    expect((body.match(/data-anomaly-reason(?![s])/g) ?? []).length).toBe(0);
  });
});
