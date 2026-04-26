import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ProbBar from './ProbBar.svelte';

describe('ProbBar', () => {
  it('renders three segments with widths matching home/draw/away (to nearest %)', () => {
    const { container } = render(ProbBar, { props: { home: 0.6, draw: 0.25, away: 0.15 } });
    const segs = container.querySelectorAll('[data-seg]') as NodeListOf<HTMLElement>;
    expect(segs.length).toBe(3);
    expect(segs[0].style.width).toBe('60%');
    expect(segs[1].style.width).toBe('25%');
    expect(segs[2].style.width).toBe('15%');
  });

  it('marks the bar invalid when the three values do not sum to ~1', () => {
    const { container } = render(ProbBar, { props: { home: 0.6, draw: 0.3, away: 0.2 } });
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-invalid')).toBe('true');
    expect(root.className).toContain('bg-warning');
  });

  it('does not mark invalid when the values sum within tolerance (0.999..1.001)', () => {
    const { container } = render(ProbBar, { props: { home: 0.4, draw: 0.3, away: 0.3 } });
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('hides labels by default', () => {
    const { container } = render(ProbBar, { props: { home: 0.5, draw: 0.3, away: 0.2 } });
    expect(container.querySelector('[data-label]')).toBeFalsy();
  });

  it('showLabels prop reveals three labels', () => {
    const { container } = render(ProbBar, { props: { home: 0.5, draw: 0.3, away: 0.2, showLabels: true } });
    expect(container.querySelectorAll('[data-label]').length).toBe(3);
  });
});
