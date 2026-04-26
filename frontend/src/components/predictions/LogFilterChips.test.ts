import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import LogFilterChips from './LogFilterChips.svelte';

describe('LogFilterChips', () => {
  it('renders three chips with the documented data-chip markers', () => {
    const { container } = render(LogFilterChips, { props: { active: 'last30', onChange: () => {} } });
    const chips = container.querySelectorAll('[data-chip]');
    expect(chips).toHaveLength(3);
    expect(Array.from(chips).map((c) => c.getAttribute('data-chip'))).toEqual(['last30', 'season', 'all']);
  });

  it('fires onChange with the new id when an inactive chip is clicked', async () => {
    const onChange = vi.fn();
    const { container } = render(LogFilterChips, { props: { active: 'last30', onChange } });
    const seasonChip = container.querySelector('[data-chip="season"]')!;
    await fireEvent.click(seasonChip);
    expect(onChange).toHaveBeenCalledWith('season');
  });

  it('does not fire onChange when the already-active chip is clicked', async () => {
    const onChange = vi.fn();
    const { container } = render(LogFilterChips, { props: { active: 'last30', onChange } });
    const last30Chip = container.querySelector('[data-chip="last30"]')!;
    await fireEvent.click(last30Chip);
    expect(onChange).not.toHaveBeenCalled();
  });
});
