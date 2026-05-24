import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SearchInput from './SearchInput.svelte';

describe('SearchInput — K1f-β.1', () => {
  it('renders the canonical markers and the placeholder', () => {
    const { body } = render(SearchInput);
    expect(body).toContain('data-search-input');
    expect(body).toContain('data-search-input-field');
    expect(body).toContain('data-search-input-submit');
    expect(body).toContain('Search fixtures, players, seasons, threads');
  });

  it('hides the Clear button while the value is empty', () => {
    const { body } = render(SearchInput);
    expect(body).not.toContain('data-search-input-clear');
  });

  it('shows the Clear button when value is non-empty', () => {
    const { body } = render(SearchInput, { props: { value: 'arsenal' } });
    expect(body).toContain('data-search-input-clear');
  });

  it('disables the submit button when the value is whitespace-only', () => {
    const { body } = render(SearchInput, { props: { value: '   ' } });
    const submit = body.match(/<button\b[^>]*data-search-input-submit[^>]*>/);
    expect(submit).not.toBeNull();
    // Match the boolean attribute, not the Tailwind class `disabled:opacity-40`.
    expect(submit![0]).toMatch(/\sdisabled(=""|>|\s)/);
  });

  it('enables the submit button when value has real characters', () => {
    const { body } = render(SearchInput, { props: { value: 'liverpool' } });
    const submit = body.match(/<button\b[^>]*data-search-input-submit[^>]*>/);
    expect(submit).not.toBeNull();
    expect(submit![0]).not.toMatch(/\sdisabled(=""|>|\s)/);
  });

  it('uses a CSS variable for the leading glyph colour (no inline hex)', () => {
    const { body } = render(SearchInput);
    const glyph = body.match(/<span\b[^>]*data-search-input-glyph[^>]*>/);
    expect(glyph).not.toBeNull();
    expect(glyph![0]).toContain('var(--persona-accent');
    expect(glyph![0]).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it('honours a custom placeholder prop', () => {
    const { body } = render(SearchInput, {
      props: { placeholder: 'Find a thread…' }
    });
    expect(body).toContain('Find a thread…');
  });
});
