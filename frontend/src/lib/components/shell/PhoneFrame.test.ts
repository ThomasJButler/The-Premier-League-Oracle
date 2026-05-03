import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PhoneFrame from './PhoneFrame.svelte';

const SOURCE = readFileSync(
  fileURLToPath(new URL('./PhoneFrame.svelte', import.meta.url)),
  'utf8'
);

describe('PhoneFrame', () => {
  it('renders the bezel chrome in non-production builds', () => {
    // Vitest runs with import.meta.env.PROD === false, so the frame branch
    // should be active in test SSR output.
    const { body } = render(PhoneFrame);
    expect(body).toContain('data-phone-frame');
    expect(body).toContain('data-phone-bezel');
    expect(body).toContain('data-phone-screen');
  });

  it('source gates the frame on import.meta.env.PROD so prod builds tree-shake the bezel', () => {
    expect(SOURCE).toMatch(/import\.meta\.env\.PROD/);
  });

  it('source pins the iPhone-14 viewport (390x844)', () => {
    expect(SOURCE).toMatch(/width:\s*390px/);
    expect(SOURCE).toMatch(/height:\s*844px/);
  });
});
