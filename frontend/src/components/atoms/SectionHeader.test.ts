import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import SectionHeader from './SectionHeader.svelte';

describe('SectionHeader', () => {
  it('renders title only by default', () => {
    const { getByText, container } = render(SectionHeader, { props: { title: 'Recent log' } });
    expect(getByText('Recent log')).toBeTruthy();
    expect(container.querySelector('[data-kicker]')).toBeFalsy();
  });

  it('renders kicker when provided', () => {
    const { getByText, container } = render(SectionHeader, {
      props: { kicker: 'GAMEWEEK 35', title: "This week's predictions" },
    });
    expect(getByText('GAMEWEEK 35')).toBeTruthy();
    expect(container.querySelector('[data-kicker]')).toBeTruthy();
  });
});
