import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import PunditQuoteBlock from './PunditQuoteBlock.svelte';

const quoteSnippet = (text: string) =>
  createRawSnippet(() => ({
    render: () => `<span>${text}</span>`
  }));

describe('PunditQuoteBlock', () => {
  it('renders quote body and attribution with stable markers', () => {
    const { body } = render(PunditQuoteBlock, {
      props: {
        attribution: 'Macca, Birkenhead',
        children: quoteSnippet('To be fair to Tottenham — there is no answer.')
      }
    });
    expect(body).toContain('data-pundit-quote');
    expect(body).toContain('data-pundit-quote-body');
    expect(body).toContain('data-pundit-quote-attribution');
    expect(body).toContain('To be fair to Tottenham');
    expect(body).toContain('— Macca, Birkenhead');
  });

  it('uses italic serif typography and a red left border', () => {
    const { body } = render(PunditQuoteBlock, {
      props: {
        attribution: 'Voice',
        children: quoteSnippet('Cheers, Geoff.')
      }
    });
    const figure = body.match(/<figure\b[^>]*data-pundit-quote[^>]*>/);
    expect(figure![0]).toMatch(/border-l-\[3px\]/);
    expect(figure![0]).toMatch(/border-red/);
    const blockquote = body.match(/<blockquote\b[^>]*data-pundit-quote-body[^>]*>/);
    expect(blockquote![0]).toMatch(/font-serif/);
    expect(blockquote![0]).toMatch(/italic/);
  });

  it('renders attribution caption in tracked uppercase ink-dim', () => {
    const { body } = render(PunditQuoteBlock, {
      props: {
        attribution: 'Mickey, Dagenham',
        children: quoteSnippet('Disgrace.')
      }
    });
    const cap = body.match(/<figcaption\b[^>]*data-pundit-quote-attribution[^>]*>/);
    expect(cap![0]).toMatch(/uppercase/);
    expect(cap![0]).toMatch(/text-ink-dim/);
    expect(cap![0]).toMatch(/tracking-\[0\.25em\]/);
  });
});
