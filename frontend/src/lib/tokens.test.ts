import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { PERSONAS, KICKER_PERSONA_ORDER } from './personas';

/**
 * Design-token enforcement (T9): tokens.css must match the spec doc
 * (docs/the-kicker-spec/tokens.md), the persona-accent cascade must match
 * the real PERSONAS map (drift-proof both ways), and no component/route
 * .svelte file may hardcode a hex literal outside var(...) fallbacks.
 */

const TOKENS_CSS_PATH = resolve(__dirname, 'tokens.css');

/** Hardcoded from docs/the-kicker-spec/tokens.md — pins the spec, not the implementation. */
const EXPECTED_BASE_TOKENS: Record<string, string> = {
  '--paper': '#f4ecdb',
  '--paper-deep': '#ebe1c9',
  '--paper-inset': '#e1d6ba',
  '--paper-warm': '#f8f0df',
  '--ink': '#1a1611',
  '--ink-soft': '#3d362a',
  '--ink-dim': '#6b6249',
  '--ink-faint': '#a39a7e',
  '--ink-ghost': '#cdc4a8',
  '--rule': '#c9bf9f',
  '--rule-strong': '#9a8f6c',
  '--red': '#9c1a1a',
  '--amber': '#c47a14',
  '--green': '#4a7c2a',
};

describe('tokens.css — base palette pins docs/the-kicker-spec/tokens.md', () => {
  const css = readFileSync(TOKENS_CSS_PATH, 'utf-8');

  for (const [token, expectedHex] of Object.entries(EXPECTED_BASE_TOKENS)) {
    it(`${token} equals ${expectedHex}`, () => {
      const re = new RegExp(`\\${token}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`);
      const match = css.match(re);
      expect(match, `${token} not found in tokens.css`).not.toBeNull();
      expect(match![1].toLowerCase()).toBe(expectedHex.toLowerCase());
    });
  }
});

describe('tokens.css — persona accent cascade matches PERSONAS map', () => {
  const css = readFileSync(TOKENS_CSS_PATH, 'utf-8');

  // Parse every [data-persona='id'] { --persona-accent: #hex; } block.
  const blockRe = /\[data-persona=['"]([a-z0-9-]+)['"]\]\s*\{\s*--persona-accent:\s*(#[0-9a-fA-F]{3,8})\s*;\s*\}/g;
  const blocksById = new Map<string, string[]>();
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(css)) !== null) {
    const [, id, hex] = m;
    const list = blocksById.get(id) ?? [];
    list.push(hex);
    blocksById.set(id, list);
  }

  for (const id of KICKER_PERSONA_ORDER) {
    it(`exactly one [data-persona='${id}'] block, matching PERSONAS.${id}.accent`, () => {
      const hexes = blocksById.get(id);
      expect(hexes, `no [data-persona='${id}'] block found in tokens.css`).toBeDefined();
      expect(hexes!.length).toBe(1);
      expect(hexes![0].toLowerCase()).toBe(PERSONAS[id].accent.toLowerCase());
    });
  }

  it('has no [data-persona] blocks for ids outside PERSONAS (drift the other direction)', () => {
    const knownIds = new Set<string>(KICKER_PERSONA_ORDER);
    const strayIds = [...blocksById.keys()].filter((id) => !knownIds.has(id));
    expect(strayIds).toEqual([]);
  });
});

describe('hex hygiene — no inline hex literals in .svelte files', () => {
  const SCAN_ROOTS = [resolve(__dirname, 'components'), resolve(__dirname, '../routes')];

  // Repo-relative paths (matching FILE SET convention), permitted to contain inline hex.
  const ALLOWLIST = ['src/lib/components/shell/PhoneFrame.svelte'];

  const FRONTEND_SRC = resolve(__dirname, '..');

  function toRepoRelative(absPath: string): string {
    // FRONTEND_SRC is .../frontend/src — strip it and re-prefix with "src/".
    const rel = absPath.slice(FRONTEND_SRC.length + 1);
    return `src/${rel}`;
  }

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        out.push(...walk(full));
      } else if (entry.endsWith('.svelte')) {
        out.push(full);
      }
    }
    return out;
  }

  it('every allowlisted file still exists (list cannot rot)', () => {
    for (const relPath of ALLOWLIST) {
      const abs = resolve(FRONTEND_SRC, '..', relPath);
      expect(existsSync(abs), `allowlisted file no longer exists: ${relPath}`).toBe(true);
    }
  });

  const files = SCAN_ROOTS.flatMap((root) => walk(root));

  it('found svelte files to scan (sanity check on the walker)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

  for (const file of files) {
    const relPath = toRepoRelative(file);
    if (ALLOWLIST.includes(relPath)) continue;

    it(`${relPath} has no inline hex literals`, () => {
      const source = readFileSync(file, 'utf-8');
      // Strip var(...) expressions first so var(--x, #hex) fallbacks never count.
      const withoutVarExprs = source.replace(/var\([^)]*\)/g, '');
      const found = withoutVarExprs.match(HEX_RE);
      expect(
        found,
        `inline hex literal(s) found in ${relPath}: ${found ? found.join(', ') : ''}`
      ).toBeNull();
    });
  }
});
