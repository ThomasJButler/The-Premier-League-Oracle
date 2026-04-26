import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

vi.mock('svelte-routing', async () => {
  const LinkStub = (await import('../../tests/LinkStub.svelte')).default;
  return { Link: LinkStub, navigate: vi.fn() };
});

import Tabs from './Tabs.svelte';

const TABS = [
  { slug: 'live', label: 'Live' },
  { slug: 'matches', label: 'Matches' },
  { slug: 'standings', label: 'Standings' },
];

describe('Tabs', () => {
  it('renders every tab label from the props array', () => {
    const { getByText } = render(Tabs, {
      props: { tabs: TABS, active: 'matches', basePath: '/fixtures' },
    });
    expect(getByText('Live')).toBeTruthy();
    expect(getByText('Matches')).toBeTruthy();
    expect(getByText('Standings')).toBeTruthy();
  });

  it('marks the active tab with aria-selected="true" and others false', () => {
    const { getByText } = render(Tabs, {
      props: { tabs: TABS, active: 'matches', basePath: '/fixtures' },
    });
    expect(getByText('Matches').closest('[role="tab"]')!.getAttribute('aria-selected')).toBe('true');
    expect(getByText('Live').closest('[role="tab"]')!.getAttribute('aria-selected')).toBe('false');
    expect(getByText('Standings').closest('[role="tab"]')!.getAttribute('aria-selected')).toBe('false');
  });

  it('builds each tab href as basePath + / + slug', () => {
    const { getByText } = render(Tabs, {
      props: { tabs: TABS, active: 'live', basePath: '/fixtures' },
    });
    expect(getByText('Live').closest('a')!.getAttribute('href')).toBe('/fixtures/live');
    expect(getByText('Matches').closest('a')!.getAttribute('href')).toBe('/fixtures/matches');
  });

  it('exposes role="tablist" on the container', () => {
    const { container } = render(Tabs, {
      props: { tabs: TABS, active: 'live', basePath: '/fixtures' },
    });
    expect(container.querySelector('[role="tablist"]')).toBeTruthy();
  });
});
