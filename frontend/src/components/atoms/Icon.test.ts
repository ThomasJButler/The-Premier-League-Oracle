import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Icon from './Icon.svelte';
import { iconRegistry, type IconName } from './icons';

describe('Icon', () => {
  it('renders every icon in the registry as non-empty SVG', () => {
    for (const name of Object.keys(iconRegistry) as IconName[]) {
      const { container } = render(Icon, { props: { name } });
      const svg = container.querySelector('svg');
      expect(svg, `<Icon name="${name}"> should render an svg`).toBeTruthy();
      const path = svg!.querySelector('path');
      expect(path?.getAttribute('d'), `<Icon name="${name}"> path should be non-empty`).toBeTruthy();
    }
  });

  it('size prop sets width and height', () => {
    const { container } = render(Icon, { props: { name: 'chevron-down', size: 32 } });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('height')).toBe('32');
  });

  it('strokeWidth prop is applied', () => {
    const { container } = render(Icon, { props: { name: 'chevron-down', strokeWidth: 1.5 } });
    const path = container.querySelector('path')!;
    expect(path.getAttribute('stroke-width')).toBe('1.5');
  });

  it('aria-hidden by default (decorative)', () => {
    const { container } = render(Icon, { props: { name: 'chevron-down' } });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
