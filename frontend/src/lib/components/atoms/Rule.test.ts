import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Rule from './Rule.svelte';

describe('Rule', () => {
  it('renders the title in the section header', () => {
    const { body } = render(Rule, { props: { title: 'TODAY' } });
    expect(body).toContain('data-rule-title');
    expect(body).toContain('TODAY');
  });

  it('omits the kicker block when no kicker prop is provided', () => {
    const { body } = render(Rule, { props: { title: 'BARE' } });
    expect(body).not.toContain('data-rule-kicker');
  });

  it('renders the kicker eyebrow when supplied', () => {
    const { body } = render(Rule, {
      props: { title: 'PICKS', kicker: 'GAMEWEEK 33' }
    });
    expect(body).toContain('data-rule-kicker');
    expect(body).toContain('GAMEWEEK 33');
  });

  it('renders the action string in mono caps when supplied without children', () => {
    const { body } = render(Rule, {
      props: { title: 'REST OF SLATE', action: 'SEE ALL →' }
    });
    expect(body).toContain('data-rule-action');
    expect(body).toContain('SEE ALL →');
    const actionTag = body.match(/<div\b[^>]*data-rule-action[^>]*>/);
    expect(actionTag, 'expected a div carrying data-rule-action').not.toBeNull();
    expect(actionTag![0]).toMatch(/font-mono/);
    expect(actionTag![0]).toMatch(/uppercase/);
  });

  it('omits the action slot entirely when neither action nor children given', () => {
    const { body } = render(Rule, { props: { title: 'BARE' } });
    expect(body).not.toContain('data-rule-action');
  });
});
