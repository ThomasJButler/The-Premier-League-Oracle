import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import FilterChips from './FilterChips.svelte';

describe('FilterChips', () => {
  it('renders 4 chips with stable [data-chip] markers', () => {
    const { container } = render(FilterChips, { props: { active: 'all', onChange: vi.fn() } });
    const chips = container.querySelectorAll('[data-chip]');
    expect(chips).toHaveLength(4);
    const ids = Array.from(chips).map((c) => c.getAttribute('data-chip'));
    expect(ids).toEqual(['all', 'top6', 'relegation', 'tv']);
  });

  it('marks the active chip with aria-pressed="true"; others "false"', () => {
    const { container } = render(FilterChips, { props: { active: 'top6', onChange: vi.fn() } });
    const top6 = container.querySelector('[data-chip="top6"]');
    const all = container.querySelector('[data-chip="all"]');
    expect(top6?.getAttribute('aria-pressed')).toBe('true');
    expect(all?.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onChange with the chip id when clicked', async () => {
    const onChange = vi.fn();
    const { container } = render(FilterChips, { props: { active: 'all', onChange } });
    await fireEvent.click(container.querySelector('[data-chip="relegation"]')!);
    expect(onChange).toHaveBeenCalledWith('relegation');
  });

  it('does NOT call onChange when the active chip is clicked again (idempotent)', async () => {
    const onChange = vi.fn();
    const { container } = render(FilterChips, { props: { active: 'top6', onChange } });
    await fireEvent.click(container.querySelector('[data-chip="top6"]')!);
    expect(onChange).not.toHaveBeenCalled();
  });
});
