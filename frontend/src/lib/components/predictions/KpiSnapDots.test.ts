import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import KpiSnapDots from './KpiSnapDots.svelte';

describe('KpiSnapDots', () => {
  it('renders the requested number of dots', () => {
    const { body } = render(KpiSnapDots, { props: { count: 4 } });
    const dots = body.match(/data-kpi-dot=/g) ?? [];
    expect(dots.length).toBe(4);
  });

  it('marks the active-index dot with data-kpi-dot-active="true" and others "false"', () => {
    const { body } = render(KpiSnapDots, {
      props: { count: 4, activeIndex: 2 }
    });
    const active = (body.match(/data-kpi-dot-active="true"/g) ?? []).length;
    const inactive = (body.match(/data-kpi-dot-active="false"/g) ?? []).length;
    expect(active).toBe(1);
    expect(inactive).toBe(3);
  });

  it('defaults activeIndex to 0 when omitted', () => {
    const { body } = render(KpiSnapDots, { props: { count: 3 } });
    // First dot tag should be the active one; capture each in order
    const tags = body.match(/<span\b[^>]*data-kpi-dot="[^"]*"[^>]*>/g) ?? [];
    expect(tags.length).toBe(3);
    expect(tags[0]).toContain('data-kpi-dot-active="true"');
    expect(tags[1]).toContain('data-kpi-dot-active="false"');
    expect(tags[2]).toContain('data-kpi-dot-active="false"');
  });

  it('paints the active dot bg-ink and inactive dots bg-ink-ghost', () => {
    const { body } = render(KpiSnapDots, {
      props: { count: 3, activeIndex: 1 }
    });
    const tags = body.match(/<span\b[^>]*data-kpi-dot="[^"]*"[^>]*>/g) ?? [];
    expect(tags[0]).toContain('bg-ink-ghost');
    expect(tags[1]).toContain('bg-ink');
    expect(tags[1]).not.toContain('bg-ink-ghost');
    expect(tags[2]).toContain('bg-ink-ghost');
  });

  it('clamps gracefully when activeIndex is out of range (no dot marked active)', () => {
    const { body } = render(KpiSnapDots, {
      props: { count: 3, activeIndex: 99 }
    });
    const active = (body.match(/data-kpi-dot-active="true"/g) ?? []).length;
    expect(active).toBe(0);
  });
});
