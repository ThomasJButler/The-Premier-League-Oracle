import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import FormChips from './FormChips.svelte';

describe('FormChips', () => {
  it('renders one chip per outcome in order', () => {
    const { body } = render(FormChips, {
      props: { label: 'ARS', form: ['W', 'D', 'L', 'W', 'W'] },
    });
    expect(body).toContain('data-form-team="ARS"');
    const chips = body.match(/data-form-chip="(W|D|L)"/g) ?? [];
    expect(chips.length).toBe(5);
    expect(chips).toEqual([
      'data-form-chip="W"',
      'data-form-chip="D"',
      'data-form-chip="L"',
      'data-form-chip="W"',
      'data-form-chip="W"',
    ]);
    expect(body).not.toContain('data-form-empty');
  });

  it('falls back to an empty hint when no form is present', () => {
    const { body } = render(FormChips, { props: { label: 'NEW' } });
    expect(body).toContain('data-form-empty');
    expect(body).not.toMatch(/data-form-chip=/);
  });
});
