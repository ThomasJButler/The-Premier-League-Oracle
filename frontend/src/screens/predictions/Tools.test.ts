import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Tools from './Tools.svelte';

vi.mock('svelte-routing', () => ({
  navigate: vi.fn(),
}));

describe('Tools (Predictions Tools screen)', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/predictions/tools');
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('renders [data-screen="predictions-tools"] root unconditionally', () => {
    const { container } = render(Tools);
    expect(container.querySelector('[data-screen="predictions-tools"]')).toBeTruthy();
  });

  it('renders two utility buttons (Kelly + Value) inside the switcher', () => {
    const { container } = render(Tools);
    const buttons = container.querySelectorAll('[data-utility]');
    expect(buttons).toHaveLength(2);
    expect(Array.from(buttons).map((b) => b.getAttribute('data-utility'))).toEqual(['kelly', 'value']);
  });

  it('defaults to Kelly when no ?utility query param is present', () => {
    const { container } = render(Tools);
    const kelly = container.querySelector('[data-utility="kelly"]');
    expect(kelly?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-testid="kelly-calculator"]')).toBeTruthy();
    expect(container.querySelector('[data-tool-placeholder="value"]')).toBeNull();
  });

  it('honours ?utility=value on initial render (deep-link)', () => {
    window.history.replaceState({}, '', '/predictions/tools?utility=value');
    const { container } = render(Tools);
    const value = container.querySelector('[data-utility="value"]');
    expect(value?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-tool-placeholder="value"]')).toBeTruthy();
  });

  it('clicking a utility button swaps the active branch AND calls navigate()', async () => {
    const { navigate } = await import('svelte-routing');
    const { container } = render(Tools);
    const valueBtn = container.querySelector('[data-utility="value"]')!;
    await fireEvent.click(valueBtn);
    expect(container.querySelector('[data-tool-placeholder="value"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="kelly-calculator"]')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/predictions/tools?utility=value', { replace: false });
  });
});
