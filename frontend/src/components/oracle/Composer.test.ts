import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Composer from './Composer.svelte';

describe('Composer', () => {
  it('renders textarea + 3 quick-prompt chips', () => {
    const { container } = render(Composer, {
      props: { value: '', onSubmit: vi.fn(), onPickPrompt: vi.fn() },
    });
    expect(container.querySelector('[data-composer]')).toBeTruthy();
    expect(container.querySelector('[data-textarea]')).toBeTruthy();
    expect(container.querySelectorAll('[data-quick-prompt]')).toHaveLength(3);
  });

  it('clicking a quick-prompt chip calls onPickPrompt with the chip text', async () => {
    const onPickPrompt = vi.fn();
    const { container } = render(Composer, {
      props: { value: '', onSubmit: vi.fn(), onPickPrompt },
    });
    const chips = container.querySelectorAll<HTMLButtonElement>('[data-quick-prompt]');
    await fireEvent.click(chips[0]);
    expect(onPickPrompt).toHaveBeenCalledWith(expect.stringContaining('Why does the model favour'));
  });

  it('Enter (no shift) on a non-empty textarea calls onSubmit with the value', async () => {
    const onSubmit = vi.fn();
    const { container } = render(Composer, {
      props: { value: 'hello', onSubmit, onPickPrompt: vi.fn() },
    });
    const ta = container.querySelector<HTMLTextAreaElement>('[data-textarea]')!;
    await fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false });
    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('disabled prop hides the submit button or marks it disabled', () => {
    const { container } = render(Composer, {
      props: { value: 'hi', disabled: true, onSubmit: vi.fn(), onPickPrompt: vi.fn() },
    });
    const submit = container.querySelector<HTMLButtonElement>('[data-submit]');
    expect(submit?.disabled).toBe(true);
  });
});
