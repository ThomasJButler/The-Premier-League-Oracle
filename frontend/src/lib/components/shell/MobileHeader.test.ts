import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MobileHeader from './MobileHeader.svelte';

describe('MobileHeader', () => {
  it('renders the title and omits the back chevron by default', () => {
    const { body } = render(MobileHeader, { props: { title: 'Today' } });
    expect(body).toContain('data-mobile-title');
    expect(body).toContain('Today');
    expect(body).not.toContain('data-mobile-back');
  });

  it('renders the back chevron only when back is true', () => {
    const { body } = render(MobileHeader, {
      props: { title: 'Liverpool v Tottenham', back: true }
    });
    expect(body).toContain('data-mobile-back');
    expect(body).toContain('aria-label="Back"');
  });

  it('renders the optional sub eyebrow when supplied', () => {
    const { body } = render(MobileHeader, {
      props: { title: 'Predictions', sub: 'GAMEWEEK 33' }
    });
    expect(body).toContain('data-mobile-sub');
    expect(body).toContain('GAMEWEEK 33');
  });
});
