import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ColumnHero from './ColumnHero.svelte';
import type { HeadlineSegment } from '$lib/fixtures/columns';

const baseProps = {
  eyebrow: 'STATE OF THE NATION · GUNNERS',
  headline: [
    { text: 'Arsenal are ' },
    { text: 'finally', emphasis: true },
    { text: ' boring.' }
  ] satisfies HeadlineSegment[],
  bylineName: 'The Voice',
  bylineSub: 'The Voice of the Terraces',
  readTimeMinutes: 4,
  dateline: 'LONDON, FRIDAY'
};

describe('ColumnHero', () => {
  it('renders the hero markers, eyebrow, headline, and byline blocks', () => {
    const { body } = render(ColumnHero, { props: baseProps });
    expect(body).toContain('data-column-hero');
    expect(body).toContain('data-column-eyebrow');
    expect(body).toContain('data-column-headline');
    expect(body).toContain('data-column-byline');
    expect(body).toContain(baseProps.eyebrow);
    // Each headline segment surfaces.
    expect(body).toContain('Arsenal are');
    expect(body).toContain('finally');
    expect(body).toContain('boring');
  });

  it('wraps emphasis segments in <em> with the persona-accent class hook', () => {
    const { body } = render(ColumnHero, { props: baseProps });
    const em = body.match(/<em\b[^>]*data-headline-em[^>]*>([^<]*)<\/em>/);
    expect(em).not.toBeNull();
    expect(em![1]).toBe('finally');
    expect(em![0]).toMatch(/kicker-column-hero__em/);
  });

  it('renders byline name, sub, monogram first letter, read-time and dateline', () => {
    const { body } = render(ColumnHero, { props: baseProps });
    const mono = body.match(/<span\b[^>]*data-byline-monogram[^>]*>([^<]*)<\/span>/);
    expect(mono).not.toBeNull();
    expect(mono![1].trim()).toBe('T');
    expect(body).toContain(baseProps.bylineName);
    expect(body).toContain(baseProps.bylineSub);
    expect(body).toContain('4 min read');
    expect(body).toContain('LONDON, FRIDAY');
  });

  it('byline grid stacks meta below name on mobile and inlines it from sm: up (K2a-β.4)', () => {
    const { body } = render(ColumnHero, { props: baseProps });
    const wrapper = body.match(/<div\b[^>]*data-column-byline[^>]*>/);
    expect(wrapper).not.toBeNull();
    // Mobile: 2-col (monogram + name/sub), meta drops to its own row.
    expect(wrapper![0]).toMatch(/grid-cols-\[auto_1fr\]/);
    // sm+: re-add the right-side meta column.
    expect(wrapper![0]).toMatch(/sm:grid-cols-\[auto_1fr_auto\]/);
    const meta = body.match(/<div\b[^>]*data-byline-meta[^>]*>/);
    expect(meta).not.toBeNull();
    // Meta spans both mobile cols then collapses to its own cell at sm:
    expect(meta![0]).toMatch(/col-span-2/);
    expect(meta![0]).toMatch(/sm:col-span-1/);
    // Text alignment flips left → right above sm to match desktop's right-rail meta block.
    expect(meta![0]).toMatch(/text-left/);
    expect(meta![0]).toMatch(/sm:text-right/);
  });

  it('drives accent colour via CSS variable, not inline hex', () => {
    const { body, head } = render(ColumnHero, { props: baseProps });
    const composite = `${body}\n${head ?? ''}`;
    // Don't actually emit a literal #fff or #rrggbb anywhere in the accent path.
    expect(composite).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});
