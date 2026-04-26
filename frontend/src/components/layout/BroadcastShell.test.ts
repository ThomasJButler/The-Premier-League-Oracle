import { describe, it, expect, vi } from 'vitest';
import { render, within } from '@testing-library/svelte';

vi.mock('svelte-routing', async () => {
  const LinkStub = (await import('../../tests/LinkStub.svelte')).default;
  return { Link: LinkStub, navigate: vi.fn() };
});

import BroadcastShell from './BroadcastShell.svelte';

describe('BroadcastShell', () => {
  it('renders all six sidebar hub labels from the route table', () => {
    const { container } = render(BroadcastShell);
    const nav = container.querySelector('nav');
    expect(nav).toBeTruthy();
    const navScope = within(nav!);
    for (const label of ['Today', 'Fixtures', 'Predictions', 'Oracle', 'Insights', 'Settings']) {
      expect(navScope.getByText(label)).toBeTruthy();
    }
  });

  it('renders a <main> slot region for content', () => {
    const { container } = render(BroadcastShell);
    expect(container.querySelector('main')).toBeTruthy();
  });

  it('exposes a theme toggle button', () => {
    const { getByText } = render(BroadcastShell);
    expect(getByText(/toggle theme/i)).toBeTruthy();
  });
});
