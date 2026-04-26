import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import FormDot from './FormDot.svelte';

describe('FormDot', () => {
  it.each([
    ['W', 'Win',  'bg-accent'],
    ['D', 'Draw', 'bg-text-faint'],
    ['L', 'Loss', 'bg-destructive'],
  ] as const)('result %s sets aria-label "%s" and class %s', (result, label, cls) => {
    const { getByLabelText } = render(FormDot, { props: { result } });
    const el = getByLabelText(label);
    expect(el).toBeTruthy();
    expect(el.className).toContain(cls);
  });

  it('size sm renders 6px', () => {
    const { container } = render(FormDot, { props: { result: 'W', size: 'sm' } });
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('6px');
  });

  it('size md renders 8px', () => {
    const { container } = render(FormDot, { props: { result: 'W', size: 'md' } });
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('8px');
  });
});
