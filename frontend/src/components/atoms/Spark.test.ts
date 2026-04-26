import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Spark from './Spark.svelte';

describe('Spark', () => {
  it('renders an SVG with a polyline path through the data', () => {
    const { container } = render(Spark, { props: { data: [1, 3, 2, 5, 4] } });
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    const path = svg!.querySelector('path');
    expect(path).toBeTruthy();
    expect(path!.getAttribute('d')).toMatch(/^M[\d.\s,]+/);
  });

  it('width / height props set the SVG dimensions', () => {
    const { container } = render(Spark, { props: { data: [1, 2, 3], width: 120, height: 30 } });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('120');
    expect(svg.getAttribute('height')).toBe('30');
  });

  it.each([
    ['up',   'hsl(var(--accent))'],
    ['down', 'hsl(var(--destructive))'],
    ['flat', 'hsl(var(--text-dim))'],
  ] as const)('trend %s sets stroke to %s', (trend, expected) => {
    const { container } = render(Spark, { props: { data: [1, 2, 3], trend } });
    const path = container.querySelector('path')!;
    expect(path.getAttribute('stroke')).toBe(expected);
  });

  it('renders empty when data is empty', () => {
    const { container } = render(Spark, { props: { data: [] } });
    const path = container.querySelector('path');
    if (path) expect(path.getAttribute('d') ?? '').toBe('');
  });
});
