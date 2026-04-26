import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Auto-gate for P0a tokens slice.
 * Asserts every broadcast var resolves to a non-empty value on :root and .dark,
 * --radius is 0.5rem, --primary is Liverpool red on light + dark,
 * data-team="Arsenal" overrides --primary to Arsenal red.
 *
 * jsdom does not load external CSS via @import, so we read tokens.css from disk
 * and inject it inline at setup time. Team-theme rules are injected per-test.
 */

const TOKENS = [
  '--background', '--bg-raised', '--bg-inset', '--surface-hover',
  '--card', '--card-foreground', '--popover', '--popover-foreground',
  '--border', '--border-strong', '--input',
  '--foreground', '--muted', '--muted-foreground',
  '--text-dim', '--text-faint', '--text-ghost',
  '--primary', '--primary-foreground', '--primary-deep',
  '--secondary', '--secondary-foreground',
  '--accent', '--accent-foreground', '--accent-deep',
  '--destructive', '--destructive-foreground',
  '--success', '--success-foreground',
  '--warning', '--warning-foreground', '--warn-deep',
  '--ring', '--radius',
];

async function loadTokensCss(): Promise<string> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const tokensPath = path.resolve(__dirname, '../lib/styles/tokens.css');
  return await fs.readFile(tokensPath, 'utf8');
}

let styleEl: HTMLStyleElement;

beforeAll(async () => {
  const css = await loadTokensCss();
  styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
});

afterAll(() => {
  styleEl?.remove();
});

describe('P0a broadcast tokens', () => {
  it('resolves every token on :root (light mode default)', () => {
    document.documentElement.classList.remove('dark');
    const styles = getComputedStyle(document.documentElement);
    for (const token of TOKENS) {
      const value = styles.getPropertyValue(token).trim();
      expect(value, `${token} should resolve on :root`).not.toBe('');
    }
  });

  it('resolves every token on .dark', () => {
    document.documentElement.classList.add('dark');
    const styles = getComputedStyle(document.documentElement);
    for (const token of TOKENS) {
      const value = styles.getPropertyValue(token).trim();
      expect(value, `${token} should resolve on .dark`).not.toBe('');
    }
    document.documentElement.classList.remove('dark');
  });

  it('--radius resolves to 0.5rem', () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--radius').trim();
    expect(value).toBe('0.5rem');
  });

  it('--primary resolves to Liverpool red on light (351 85% 42%)', () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    expect(value).toBe('351 85% 42%');
  });

  it('--primary resolves to dark-mode Liverpool red on .dark (351 73% 50%)', () => {
    document.documentElement.classList.add('dark');
    const value = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    expect(value).toBe('351 73% 50%');
    document.documentElement.classList.remove('dark');
  });

  it('preserves team theme override: data-team="Arsenal" sets primary to Arsenal red', () => {
    document.documentElement.dataset.team = 'Arsenal';
    const teamStyle = document.createElement('style');
    teamStyle.textContent = `[data-team="Arsenal"] { --primary: 0 99% 47%; }`;
    document.head.appendChild(teamStyle);
    const value = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    expect(value).toBe('0 99% 47%');
    teamStyle.remove();
    delete document.documentElement.dataset.team;
  });
});
