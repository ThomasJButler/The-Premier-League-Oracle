import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ContextPanel from './ContextPanel.svelte';
import { makeFixture } from '../../tests/fixtures/matchcard';

describe('ContextPanel', () => {
  it('renders empty state when no stats and no fixtures', () => {
    const { container } = render(ContextPanel, {
      props: { stats: null, recentFixtures: [] },
    });
    expect(container.querySelector('[data-context-panel]')).toBeTruthy();
    expect(container.querySelector('[data-context-empty]')).toBeTruthy();
    expect(container.querySelector('[data-kpi-grid]')).toBeNull();
    expect(container.querySelector('[data-recent-fixtures]')).toBeNull();
  });

  it('renders KPI tiles with picks + accuracy when stats are provided', () => {
    const { container } = render(ContextPanel, {
      props: {
        stats: { totalPicks: 42, accuracy: 67.5, brierScore: 0.21 },
        recentFixtures: [],
      },
    });
    expect(container.querySelector('[data-kpi-grid]')).toBeTruthy();
    expect(container.textContent).toContain('42');
    expect(container.textContent).toContain('67.5');
    expect(container.querySelector('[data-context-empty]')).toBeNull();
  });

  it('caps [data-fixture-row] count at 3 even when more recent fixtures are passed', () => {
    const { container } = render(ContextPanel, {
      props: {
        stats: null,
        recentFixtures: [
          makeFixture({ id: 'fx-1' }),
          makeFixture({ id: 'fx-2' }),
          makeFixture({ id: 'fx-3' }),
          makeFixture({ id: 'fx-4' }),
        ],
      },
    });
    expect(container.querySelector('[data-recent-fixtures]')).toBeTruthy();
    const rows = container.querySelectorAll('[data-fixture-row]');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.length).toBeLessThanOrEqual(3);
  });
});
