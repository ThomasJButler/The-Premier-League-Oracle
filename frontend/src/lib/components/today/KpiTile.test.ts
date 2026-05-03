import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import KpiTile from './KpiTile.svelte';

describe('KpiTile', () => {
  it('renders label and value with default ink color', () => {
    const { body } = render(KpiTile, {
      props: { label: 'NEXT KICKOFF', value: '01:42:18' }
    });
    expect(body).toContain('data-kpi-tile');
    expect(body).toContain('data-kpi-accent="false"');
    expect(body).toContain('NEXT KICKOFF');
    expect(body).toContain('01:42:18');
    const valueTag = body.match(/<div\b[^>]*data-kpi-value[^>]*>/);
    expect(valueTag).not.toBeNull();
    expect(valueTag![0]).toMatch(/text-ink/);
    expect(valueTag![0]).not.toMatch(/text-red/);
  });

  it('switches value to red when accent prop is true', () => {
    const { body } = render(KpiTile, {
      props: { label: 'MODEL EDGE', value: '+4pp', accent: true }
    });
    expect(body).toContain('data-kpi-accent="true"');
    const valueTag = body.match(/<div\b[^>]*data-kpi-value[^>]*>/);
    expect(valueTag![0]).toMatch(/text-red/);
  });

  it('renders the sub line in italic ink-dim when supplied', () => {
    const { body } = render(KpiTile, {
      props: {
        label: 'STREAK',
        value: '3W',
        sub: '5/6 GW33'
      }
    });
    expect(body).toContain('data-kpi-sub');
    expect(body).toContain('5/6 GW33');
    const subTag = body.match(/<div\b[^>]*data-kpi-sub[^>]*>/);
    expect(subTag![0]).toMatch(/italic/);
    expect(subTag![0]).toMatch(/text-ink-dim/);
  });

  it('omits the sub block when no sub prop is supplied', () => {
    const { body } = render(KpiTile, {
      props: { label: 'BARE', value: '0' }
    });
    expect(body).not.toContain('data-kpi-sub');
  });
});
