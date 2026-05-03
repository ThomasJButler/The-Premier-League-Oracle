import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SettledResultRow from './SettledResultRow.svelte';

const hitExact = {
  fixture: 'Liverpool v Tottenham',
  predicted: '2-0',
  actual: '2-0',
  hit: true,
  exact: true,
  date: '5h ago'
} as const;

describe('SettledResultRow', () => {
  it('renders fixture, predicted, actual, and date', () => {
    const { body } = render(SettledResultRow, { props: { ...hitExact } });
    expect(body).toContain('data-settled-row');
    expect(body).toContain('Liverpool v Tottenham');
    const predTag = body.match(/<div\b[^>]*data-settled-predicted="[^"]*"[^>]*>[^<]*/);
    expect(predTag![0]).toContain('2-0');
    const actualTag = body.match(/<div\b[^>]*data-settled-actual="[^"]*"[^>]*>[^<]*/);
    expect(actualTag![0]).toContain('2-0');
    expect(body).toContain('5h ago');
  });

  it('paints the HDA chip green and the EXACT chip red on a hit-exact row', () => {
    const { body } = render(SettledResultRow, { props: { ...hitExact } });
    expect(body).toContain('data-settled-hit="true"');
    expect(body).toContain('data-settled-exact="true"');
    const hdaTag = body.match(/<div\b[^>]*data-settled-hda="[^"]*"[^>]*>[^<]*/);
    expect(hdaTag![0]).toMatch(/text-green/);
    expect(hdaTag![0]).toContain('✓');
    const exactTag = body.match(
      /<div\b[^>]*data-settled-exact-chip="[^"]*"[^>]*>[^<]*/
    );
    expect(exactTag![0]).toMatch(/text-red/);
    expect(exactTag![0]).toContain('EXACT');
  });

  it('renders a miss row with ink-dim ✗ and faint dash', () => {
    const { body } = render(SettledResultRow, {
      props: {
        fixture: 'Brighton v Newcastle',
        predicted: '1-1',
        actual: '0-2',
        hit: false,
        exact: false
      }
    });
    expect(body).toContain('data-settled-hit="false"');
    expect(body).toContain('data-settled-exact="false"');
    const hdaTag = body.match(/<div\b[^>]*data-settled-hda="[^"]*"[^>]*>[^<]*/);
    expect(hdaTag![0]).toMatch(/text-ink-dim/);
    expect(hdaTag![0]).toContain('✗');
    const exactTag = body.match(
      /<div\b[^>]*data-settled-exact-chip="[^"]*"[^>]*>[^<]*/
    );
    expect(exactTag![0]).toMatch(/text-ink-faint/);
    expect(exactTag![0]).toContain('—');
  });

  it('omits the bottom border on the last row', () => {
    const { body } = render(SettledResultRow, {
      props: { ...hitExact, isLast: true }
    });
    const rowTag = body.match(/<div\b[^>]*data-settled-row[^>]*>/);
    expect(rowTag![0]).not.toMatch(/border-b/);
  });

  it('keeps the bottom border by default', () => {
    const { body } = render(SettledResultRow, { props: { ...hitExact } });
    const rowTag = body.match(/<div\b[^>]*data-settled-row[^>]*>/);
    expect(rowTag![0]).toMatch(/border-b/);
    expect(rowTag![0]).toMatch(/border-rule/);
  });

  it('omits the date column gracefully when no date prop is supplied', () => {
    const { body } = render(SettledResultRow, {
      props: {
        fixture: 'Man City v Chelsea',
        predicted: '2-1',
        actual: '0-1',
        hit: false,
        exact: false
      }
    });
    expect(body).not.toContain('data-settled-date');
  });
});
