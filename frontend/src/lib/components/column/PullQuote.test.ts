import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import PullQuote from './PullQuote.svelte';

const baseProps = {
  body: "Boring is the dress rehearsal for winning.",
  attribution: 'THE VOICE'
};

describe('PullQuote', () => {
  it('renders the figure with markers, italic body and attribution', () => {
    const { body } = render(PullQuote, { props: baseProps });
    expect(body).toContain('data-pull-quote');
    expect(body).toContain('data-pullquote-rule');
    expect(body).toContain('data-pullquote-body');
    expect(body).toContain('data-pullquote-attribution');
    expect(body).toContain(baseProps.body);
    expect(body).toContain('— THE VOICE');
  });

  it('renders body in italic serif ink at 22px', () => {
    const { body } = render(PullQuote, { props: baseProps });
    const block = body.match(/<blockquote\b[^>]*data-pullquote-body[^>]*>/);
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/font-serif/);
    expect(block![0]).toMatch(/italic/);
    expect(block![0]).toMatch(/text-\[22px\]/);
  });

  it('renders the oversized red leading quote glyph as decorative', () => {
    const { body } = render(PullQuote, { props: baseProps });
    // Svelte 5 SSR decodes &ldquo; to the literal U+201C.
    expect(body).toContain('“');
    const glyph = body.match(/<span\b[^>]*kicker-pullquote__glyph[^>]*>/);
    expect(glyph).not.toBeNull();
    expect(glyph![0]).toContain('aria-hidden="true"');
    expect(glyph![0]).toMatch(/text-red/);
    expect(glyph![0]).toMatch(/text-\[72px\]/);
  });

  it('top rule is 3px and driven by --red CSS variable (scoped style block)', () => {
    // Scoped <style> blocks are NOT in SSR body output — read source directly.
    const sourcePath = fileURLToPath(new URL('./PullQuote.svelte', import.meta.url));
    const source = readFileSync(sourcePath, 'utf-8');
    expect(source).toMatch(/\.kicker-pullquote__rule\s*\{[^}]*height:\s*3px/);
    expect(source).toMatch(/\.kicker-pullquote__rule\s*\{[^}]*background:\s*var\(--red\)/);
  });
});
