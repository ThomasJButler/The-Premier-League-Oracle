import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import StatTile from './StatTile.svelte';

describe('StatTile', () => {
  it('renders label and value with markers', () => {
    const { body } = render(StatTile, {
      props: { label: 'GOALS PER MATCH', value: '2.69' }
    });
    expect(body).toContain('data-stat-tile');
    expect(body).toContain('data-stat-label');
    expect(body).toContain('GOALS PER MATCH');
    expect(body).toContain('data-stat-value');
    expect(body).toContain('2.69');
  });

  it('renders an optional sub line when provided and omits it otherwise', () => {
    const withSub = render(StatTile, {
      props: { label: 'BTTS RATE', value: '51%', sub: '33-season mean' }
    });
    expect(withSub.body).toContain('data-stat-sub');
    expect(withSub.body).toContain('33-season mean');

    const noSub = render(StatTile, { props: { label: 'BTTS RATE', value: '51%' } });
    expect(noSub.body).not.toContain('data-stat-sub');
  });
});
