import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Crest from './Crest.svelte';

describe('Crest', () => {
  const team = { abbr: 'LIV', name: 'Liverpool', primaryColor: '#dc2440', secondaryColor: '#9c0d22' };

  it('renders the team abbreviation', () => {
    const { getByText } = render(Crest, { props: { team } });
    expect(getByText('LIV')).toBeTruthy();
  });

  it('applies primary/secondary colors as a radial gradient', () => {
    const { container } = render(Crest, { props: { team } });
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.background).toContain('radial-gradient');
    expect(root.style.background).toContain('#dc2440');
    expect(root.style.background).toContain('#9c0d22');
  });

  it('falls back to bg-inset when colors are absent', () => {
    const { container } = render(Crest, { props: { team: { abbr: 'XYZ', name: 'Mystery' } } });
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.background).toBe('');
    expect(root.className).toContain('bg-bg-inset');
  });

  it.each([
    ['xs', 16],
    ['sm', 20],
    ['md', 28],
    ['lg', 40],
  ] as const)('size %s renders at %i px', (size, px) => {
    const { container } = render(Crest, { props: { team, size } });
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe(`${px}px`);
    expect(root.style.height).toBe(`${px}px`);
  });
});
