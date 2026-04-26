import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import KpiTile from './KpiTile.svelte';

describe('KpiTile', () => {
  it('renders label, value, and suffix', () => {
    const { getByText } = render(KpiTile, { props: { label: 'Picks', value: 5, suffix: 'GW' } });
    expect(getByText('Picks')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
    expect(getByText('GW')).toBeTruthy();
  });

  it('renders positive delta with accent color and up arrow', () => {
    const { container } = render(KpiTile, {
      props: { label: 'Acc', value: '67%', delta: { value: 3, format: 'pct' } },
    });
    const delta = container.querySelector('[data-delta]') as HTMLElement;
    expect(delta).toBeTruthy();
    expect(delta.textContent).toContain('+3');
    expect(delta.className).toContain('text-accent');
  });

  it('renders negative delta with destructive color', () => {
    const { container } = render(KpiTile, {
      props: { label: 'Brier', value: '0.21', delta: { value: -0.02 } },
    });
    const delta = container.querySelector('[data-delta]') as HTMLElement;
    expect(delta.className).toContain('text-destructive');
  });

  it('state="highlight" applies primary-ringed border', () => {
    const { container } = render(KpiTile, {
      props: { label: 'Brier', value: '0.18', state: 'highlight' },
    });
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('border-primary');
  });
});
