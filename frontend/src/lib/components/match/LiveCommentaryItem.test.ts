import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import LiveCommentaryItem from './LiveCommentaryItem.svelte';
import type { LiveCommentaryLine } from '$lib/fixtures/liveFeed';

const SOURCE = readFileSync(
  fileURLToPath(new URL('./LiveCommentaryItem.svelte', import.meta.url)),
  'utf8'
);

const line: LiveCommentaryLine = {
  id: 'c1',
  minute: 67,
  text: 'Bodies in the box, the ref waves play on.',
};

describe('LiveCommentaryItem', () => {
  it('renders the minute prefix + body text', () => {
    const { body } = render(LiveCommentaryItem, { props: { line } });
    expect(body).toContain('data-commentary-item');
    expect(body).toContain("67'");
    expect(body).toContain('Bodies in the box, the ref waves play on.');
  });

  it('source declares a prefers-reduced-motion rule that cancels the fade-in', () => {
    expect(SOURCE).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    const block = SOURCE.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/
    );
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/animation:\s*none/);
  });
});
