# P4e — Export text (CSV + Markdown)

**Status:** plan-ready, awaiting loop pickup.
**Gate:** Auto.
**Tag at sign-off:** `v3.12`.
**Spec reference:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 → "Predictions exports — Phase 3" (spec lines 541–556); plus the `lib/export/` file-tree listing at spec lines 148–153 (`shared.ts` / `csv.ts` / `markdown.ts` / `pdf.ts` / `pngCard.ts` — P4e ships the first three, P4f ships the last two); plus the row in spec line 24 of the Decisions table — "Export formats: CSV + PDF + Markdown + PNG card (no JSON, no re-import). Human-readable formats only; exports go *out* of the app, never back in."

## Goal

Wire the two **text export formats** — CSV and Markdown — for the Predictions hub. Both formats serialise `StoredPrediction[]` (the `predictionTracker` history) into a downloadable text blob via the standard browser `URL.createObjectURL(new Blob(...))` + transient `<a download>` click pattern. Three placeholder buttons go live in this slice:

- `/predictions/log` → `[Export CSV]` (was placeholder; now triggers `exportCsv(rows)`)
- `/predictions/log` → `[Export Markdown]` (was placeholder; now triggers `exportMarkdown(rows)`)
- `/predictions/backtest` → `[Export CSV]` (was placeholder; now triggers `exportCsv(allSettledPredictions)`)

`/predictions/log` also has an `[Export PDF]` button — that stays a placeholder until **P4f** ships the binary export. P4e does **not** touch any PDF / PNG / `html2canvas` / `jsPDF` plumbing.

The slice is **auto-gated** because every change is testable in jsdom (pure function builders + DOM click handlers that mock out `URL.createObjectURL` / `document.createElement('a').click()`). No human eyeball needed; once vitest is green and svelte-check is clean, ralph commits and flips `[x]`.

## Surface area

- **New helper module:** `frontend/src/lib/export/shared.ts` (+ `.test.ts`) — pure utilities reused by both formats. Exports:
  - `predictionToExportRow(p: StoredPrediction): ExportRow` — adapter mapping the tracker's storage shape to the spec's column order (`gameweek, utcDate, home, away, pick, pickConfidence, ensembleHome, ensembleDraw, ensembleAway, modelVersion, settled, actualResult, hit`).
  - `formatPickLabel(predictedResult: 'H' | 'D' | 'A'): string` — `'H' → 'HOME'`, `'D' → 'DRAW'`, `'A' → 'AWAY'`. Stable contract because the spec's column header is `pick`, not `predictedResult`.
  - `formatActualResultLabel(actualResult: 'H' | 'D' | 'A' | undefined): string` — `'H' → 'HOME'`, `'D' → 'DRAW'`, `'A' → 'AWAY'`, `undefined → ''`. Empty string for unsettled, NOT `'PENDING'` — keeps the column round-trippable for any downstream tool that filters on empty.
  - `formatHitFlag(p: StoredPrediction): string` — `'1'` if settled-and-hit, `'0'` if settled-and-miss, `''` if unsettled. Matches the CSV-friendly convention (numeric in CSV, blank for unknown).
  - `formatExportTimestamp(now: Date): string` — ISO-8601 date portion only (`YYYY-MM-DD`); used in the Markdown header line.
  - `buildFilename(kind: 'csv' | 'markdown', now: Date): string` — `predictions-log-2026-04-28.csv` / `predictions-log-2026-04-28.md`. Stable filename shape for users who export multiple times in a day (browser will auto-append ` (1)` for collisions; that's OK — the spec doesn't require uniqueness).
  - `triggerBlobDownload(blob: Blob, filename: string): void` — wraps the `URL.createObjectURL(blob)` + transient `<a>` + `revokeObjectURL` choreography. Single function so the screen wiring stays one-line; one place to mock in tests.
  - **Re-exports** `MODEL_VERSION` from `services/predictionTracker.ts` so both `csv.ts` and `markdown.ts` import the version stamp from a single location (no second `import { MODEL_VERSION }` line in either format module).
- **New CSV builder:** `frontend/src/lib/export/csv.ts` (+ `.test.ts`) — exports `buildCsv(rows: StoredPrediction[], opts?: { now?: Date }): string` and `exportCsv(rows: StoredPrediction[], opts?: { now?: Date }): void`. The pure `buildCsv()` returns the full file content string; the side-effecting `exportCsv()` calls `buildCsv()` then `triggerBlobDownload()`. Splitting the two keeps unit tests free of DOM side-effects (test `buildCsv` directly; mock `triggerBlobDownload` for `exportCsv`).
- **New Markdown builder:** `frontend/src/lib/export/markdown.ts` (+ `.test.ts`) — exports `buildMarkdown(rows: StoredPrediction[], opts?: { now?: Date }): string` and `exportMarkdown(rows: StoredPrediction[], opts?: { now?: Date }): void`. Same shape as the CSV pair: pure builder + side-effecting wrapper.
- **Modified screens:**
  - `frontend/src/screens/predictions/Log.svelte` — replace the `[data-export-placeholder][data-export="csv"]` and `[data-export-placeholder][data-export="markdown"]` buttons with active versions: drop `disabled`, drop `aria-disabled`, drop `data-export-placeholder`, drop the `cursor-not-allowed opacity-60` classes, add `on:click` handlers that call `exportCsv(rows)` / `exportMarkdown(rows)` respectively. **Keep** the `[Export PDF]` button as a placeholder (P4f ships that). Replace `cursor-not-allowed opacity-60` with the existing primary-action button styling for the two newly-active buttons (mirrors the existing `[Predict GWxx]` button style on the Today screen for consistency).
  - `frontend/src/screens/predictions/Backtest.svelte` — same change for the single `[data-export-placeholder][data-export="csv"]` button. Click handler calls `exportCsv(predictionTracker.getRecentPredictions(1000))` so the CSV represents the same dataset the Backtest screen scores against.
- **Modified screen tests:**
  - `frontend/src/screens/predictions/Log.test.ts` — replace the existing "renders 3 export placeholder buttons" assertion (line 41–43) with three separate assertions: 2 active CSV+MD buttons (no `data-export-placeholder` marker), 1 still-placeholder PDF button. Add a 7th test asserting the CSV click handler calls `exportCsv` (mocked).
  - `frontend/src/screens/predictions/Backtest.test.ts` — replace the existing "renders [Export CSV] as a disabled placeholder button" assertion (line 77–83) with two assertions: button is now active (no disabled, no `data-export-placeholder`); clicking it calls `exportCsv` (mocked). Net test count for the file: `+0` (one assertion swap, one added).

## Composition rule (re-asserted from index.md)

Every export module under `lib/export/` is a **pure data layer** wrapped by a **single-line side-effecting trigger**. The pure builders (`buildCsv`, `buildMarkdown`) take `StoredPrediction[]` + an optional `now: Date` and return a string. The side-effecting wrappers (`exportCsv`, `exportMarkdown`) compose the builder with `triggerBlobDownload(...)`. Screens import only the side-effecting wrappers; tests can drop down to the pure builders for assertion stability.

`shared.ts` is the single source of truth for column ordering and formatter shapes — both `csv.ts` and `markdown.ts` consume `predictionToExportRow()` so a future column addition (e.g. a `kickoffStatus` field) propagates through both formats with one edit. **No format-specific logic in `shared.ts`** — escaping, delimiters, header-row markup belong in their respective format modules.

## Type contracts

### Consumed (existing, no changes in this slice)

```ts
// services/predictionTracker.ts (verified)
import { type StoredPrediction, MODEL_VERSION } from '../../services/predictionTracker';
//   StoredPrediction has: id, matchId, homeTeam, awayTeam, predictedResult ('H'|'D'|'A'),
//   predictedHomeGoals, predictedAwayGoals, confidence (0..1), actualResult?, actualHomeGoals?,
//   actualAwayGoals?, isCorrect?, timestamp (ISO), matchDate (ISO), matchday? (1-38),
//   modelVersion?, homeForm?, awayForm?, keyFactors?,
//   poissonProbs?: { homeWin, draw, awayWin }.
//
//   MODEL_VERSION = 'v3.5-MVP' (current at plan-grooming time; exports stamp this directly,
//   not the per-row stored modelVersion, when the row was generated by an older pipeline.
//   Per-row modelVersion is the column value; MODEL_VERSION is the file-level header).

predictionTracker.getRecentPredictions(limit: number): StoredPrediction[];
//   Used by Backtest's export click; Log's export uses the already-loaded `rows` variable.
```

### New (this slice)

```ts
// lib/export/shared.ts
export interface ExportRow {
  gameweek: number | '';        // '' if matchday undefined on the source prediction
  utcDate: string;              // matchDate as ISO-8601 (kept verbatim — already UTC by storage convention)
  home: string;                 // homeTeam
  away: string;                 // awayTeam
  pick: 'HOME' | 'DRAW' | 'AWAY';
  pickConfidence: number;       // confidence × 100, rounded to 1dp (e.g. 67.5)
  ensembleHome: number | '';    // poissonProbs.homeWin × 100, rounded to 1dp; '' if no poissonProbs
  ensembleDraw: number | '';
  ensembleAway: number | '';
  modelVersion: string;         // per-row modelVersion if present; else 'unknown'
  settled: 'true' | 'false';    // string-typed for CSV-friendliness; 'true' iff actualResult defined
  actualResult: '' | 'HOME' | 'DRAW' | 'AWAY';
  hit: '' | '0' | '1';          // '' if unsettled, '0' if missed, '1' if hit
}

export const EXPORT_COLUMNS: ReadonlyArray<keyof ExportRow> = [
  'gameweek', 'utcDate', 'home', 'away', 'pick', 'pickConfidence',
  'ensembleHome', 'ensembleDraw', 'ensembleAway', 'modelVersion',
  'settled', 'actualResult', 'hit',
] as const;
//   Single source of truth for column ordering — both formatters consume this.

export function predictionToExportRow(p: StoredPrediction): ExportRow;
export function formatPickLabel(r: 'H' | 'D' | 'A'): string;
export function formatActualResultLabel(r: 'H' | 'D' | 'A' | undefined): string;
export function formatHitFlag(p: StoredPrediction): string;
export function formatExportTimestamp(now: Date): string;
export function buildFilename(kind: 'csv' | 'markdown', now: Date): string;
export function triggerBlobDownload(blob: Blob, filename: string): void;
export { MODEL_VERSION } from '../../services/predictionTracker';
```

```ts
// lib/export/csv.ts
export function buildCsv(rows: StoredPrediction[], opts?: { now?: Date }): string;
export function exportCsv(rows: StoredPrediction[], opts?: { now?: Date }): void;
```

```ts
// lib/export/markdown.ts
export function buildMarkdown(rows: StoredPrediction[], opts?: { now?: Date }): string;
export function exportMarkdown(rows: StoredPrediction[], opts?: { now?: Date }): void;
```

## Known limitations / design decisions baked into P4e

1. **CSV escaping uses RFC 4180** — fields containing `,`, `"`, `\n`, or `\r` get wrapped in double quotes, and any embedded `"` is doubled (`"` → `""`). No exotic Unicode handling; the source data is team names + ISO timestamps + decimal numbers, none of which carry exotic content. Ship a `csvEscapeField(value)` helper inside `csv.ts` rather than `shared.ts` because escaping is format-specific (Markdown's escaping rules are different — see #2).
2. **Markdown table escaping uses pipe-replacement** — any `|` inside a field gets replaced with `\|`. Newlines inside a field are replaced with `<br>` (Markdown table cells don't support real newlines). Same single-purpose helper `mdEscapeField(value)` lives in `markdown.ts`.
3. **`now` is injected, not read from `Date.now()` inside the builders** — every builder accepts `opts?.now` and falls back to `new Date()` when absent. Tests pass a fixed date (`new Date('2026-04-28T12:00:00Z')`) for deterministic filename and header-line assertions. Same dependency-injection pattern P4c's `predictionFilters.ts` uses for its `now` parameter.
4. **Filename uses the local-date portion, not UTC** — `2026-04-28.csv`, not `2026-04-28T12:00:00Z.csv`. Reasoning: the user is exporting their own data on their own machine; their local date is the more relatable label. The pure builder accepts a `Date` and uses `getFullYear() / getMonth() / getDate()` (local-tz getters), not `getUTCFullYear()`. Test pins the local clock with `vi.setSystemTime()` if needed (or just passes `now` directly).
5. **`pickConfidence` is `confidence × 100`, rounded to 1 decimal place** — converts the stored `0.675` to the human-readable `67.5`. Same convention `<MatchCard>` uses for the displayed confidence number, so what the user sees on the screen is what lands in the export. **Exception:** the `ensembleHome` / `ensembleDraw` / `ensembleAway` columns are also `× 100` rounded to 1dp (NOT three decimals). Spec doesn't explicitly say either way; matching the screen's visible precision keeps it consistent.
6. **Unsettled predictions still export** — they emit empty strings in `actualResult` and `hit`, and `settled` is `'false'`. Reasoning: the user may want the full pending-and-settled history for record-keeping, not just the resolved subset. Both formats include all rows the screen passes them; filtering belongs to the screen's own filter chip (Log) or the screen's selection logic (Backtest passes the full 1000-row history because that's what its KPIs score against — the spec's "ROI per market" placeholder column will eventually filter to settled-with-odds rows, but P4e doesn't touch that).
7. **No row-limit guard** — the tracker's 90-day GC ceiling caps `getRecentPredictions(1000)` at ~200 rows in practice. CSV / MD builders do not impose their own cap. If a future loosening of the GC ceiling exposes a multi-thousand-row history, the export blob may grow large enough to consider streaming — recorded as a follow-up; not P4e's problem.
8. **No clipboard fallback** — exports always download. A future "copy to clipboard" affordance for the Markdown export would be a follow-up if user feedback asks for it; the disabled-state to active-state transition this slice introduces is plenty of new surface area.
9. **`triggerBlobDownload`'s click trick uses `document.body.appendChild → click() → removeChild`** rather than `<a>.click()` on a detached element. Some browsers (Firefox prior to ~95) silently ignored the latter. The append-click-remove dance is the conservative choice; the pre-condition is that `document.body` exists at call time, which is always true in a Svelte click handler (the user clicked something).
10. **Markdown header line includes a settled-count, not a total-count** — per spec line 555: `"> Exported 2026-04-26 · Model v3.5-MVP · 87 settled predictions"`. The count is `rows.filter(r => r.actualResult !== undefined).length`. CSV gets no such header line — pure RFC 4180 behavior, just the column-name row + data rows. Spreadsheet tooling (Excel, Sheets, LibreOffice) reads the column row as headers automatically.

## Atom + adapter signatures verified during 2026-04-28 plan grooming

1. **`predictionTracker.ts:MODEL_VERSION`** is `'v3.5-MVP'` (line 10). The constant is exported from the module top-level — `shared.ts` re-exports via `export { MODEL_VERSION } from '../../services/predictionTracker';` so both format modules import from `lib/export/shared` and there's only one tracker import in the export sub-tree.
2. **`StoredPrediction`'s shape** (lines 12–33) confirms every column the spec requires has a source field — `predictedResult` → `pick`, `confidence` → `pickConfidence`, `poissonProbs.{homeWin,draw,awayWin}` → `ensembleHome/Draw/Away`, `matchday` → `gameweek`, `matchDate` → `utcDate`, `actualResult` → `actualResult` + `settled` + `hit`, `modelVersion` → per-row `modelVersion`. Predictions stored before the matchday field landed (legacy data) emit `gameweek = ''` rather than dropping the row.
3. **`predictionTracker.getRecentPredictions(limit)`** (verified usage at `screens/predictions/Log.svelte:10` — `getRecentPredictions(1000)`) is the right tap for both Log's currently-loaded rows (Log already holds them in scope) and Backtest's export call (re-fetch fresh on click). Both screens get the same dataset, so an export from `/predictions/log` and an export from `/predictions/backtest` (filtered to the same 1000-row window) will agree on row counts.
4. **`<button>`'s active styling on the v3 surface** — verified pattern at `screens/predictions/Today.svelte` (the `[Predict GWxx]` button uses `bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1.5 text-body-sm`). The newly-active export buttons in this slice will mirror that. The remaining `[Export PDF]` placeholder on Log keeps its current dim styling untouched (P4f will activate it).
5. **`URL.createObjectURL` + `URL.revokeObjectURL`** are present in jsdom — verified by checking the existing test suite for any blob-download-style code (none, this is the first); jsdom 22 supports both. Tests can mock them via `vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')` if needed, or call them directly and rely on the mock URL string never reaching a real network.
6. **`Blob` constructor in jsdom** — present, accepts `(parts: BlobPart[], options?: BlobPropertyBag)` per the standard. Tests can `expect(blob.type).toBe('text/csv;charset=utf-8')` etc.
7. **Existing `lib/export/` directory** — does not exist yet (verified by `ls frontend/src/lib/`). Task 1 creates the directory by writing the first file. No special action needed — Vite + Svelte's resolver picks up new directories automatically.
8. **Spec's CSV column header row** (lines 547–550) lists exactly 13 columns in this order: `gameweek, utcDate, home, away, pick, pickConfidence, ensembleHome, ensembleDraw, ensembleAway, modelVersion, settled, actualResult, hit`. The `EXPORT_COLUMNS` constant in `shared.ts` mirrors this verbatim. **If this list ever changes in the spec, update `EXPORT_COLUMNS` and the `ExportRow` interface in lockstep.**
9. **Existing screen tests** — `Log.test.ts` has 6 tests; assertion at line 41–43 queries 3 export-placeholder buttons. `Backtest.test.ts` has 6 tests; assertion at line 77–83 queries the single CSV placeholder. Task 4 swaps these assertions and adds 1 test per screen (CSV click handler invocation). Net test deltas: Log `+1` test (final 7), Backtest `+1` test (final 7). Plus 3 new test files for the helpers (~16–20 helper tests total). Predicted vitest delta: `+18` to `+22` over the post-P4d 862/862 baseline → **expected 880–884/880–884 across 74 files** post-P4e. Verify the actual count and update the discovery note to match.

## TDD task list

Each task is one ralph iteration unless explicitly noted as foldable. Run in order. **All four tasks are auto-gated** — ralph commits and flips `[x]` once Task 4 is green. The slice's tag `v3.12` lands on Task 4's commit since auto-gated slices tag at commit-time (per the tagging policy in `IMPLEMENTATION_PLAN.md`'s Active phase narrative).

### Task 1 — `lib/export/shared.ts` + tests *(auto-gated sub-step)*

Pure-utility helpers reused by Tasks 2 + 3. No DOM, no Svelte. The `triggerBlobDownload` helper *does* touch DOM — but only via standard `document.createElement('a')` choreography; jsdom handles it cleanly.

**Files created:**
- `frontend/src/lib/export/shared.ts`
- `frontend/src/lib/export/shared.test.ts`

**Implementation template — `shared.ts`:**

```ts
import type { StoredPrediction } from '../../services/predictionTracker';

export { MODEL_VERSION } from '../../services/predictionTracker';

export interface ExportRow {
  gameweek: number | '';
  utcDate: string;
  home: string;
  away: string;
  pick: 'HOME' | 'DRAW' | 'AWAY';
  pickConfidence: number;
  ensembleHome: number | '';
  ensembleDraw: number | '';
  ensembleAway: number | '';
  modelVersion: string;
  settled: 'true' | 'false';
  actualResult: '' | 'HOME' | 'DRAW' | 'AWAY';
  hit: '' | '0' | '1';
}

export const EXPORT_COLUMNS = [
  'gameweek', 'utcDate', 'home', 'away', 'pick', 'pickConfidence',
  'ensembleHome', 'ensembleDraw', 'ensembleAway', 'modelVersion',
  'settled', 'actualResult', 'hit',
] as const satisfies ReadonlyArray<keyof ExportRow>;

const RESULT_LABEL = { H: 'HOME', D: 'DRAW', A: 'AWAY' } as const;

export function formatPickLabel(r: 'H' | 'D' | 'A'): string {
  return RESULT_LABEL[r];
}

export function formatActualResultLabel(r: 'H' | 'D' | 'A' | undefined): '' | 'HOME' | 'DRAW' | 'AWAY' {
  return r ? RESULT_LABEL[r] : '';
}

export function formatHitFlag(p: StoredPrediction): '' | '0' | '1' {
  if (p.actualResult === undefined) return '';
  return p.isCorrect ? '1' : '0';
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function predictionToExportRow(p: StoredPrediction): ExportRow {
  const ens = p.poissonProbs;
  return {
    gameweek: p.matchday ?? '',
    utcDate: p.matchDate,
    home: p.homeTeam,
    away: p.awayTeam,
    pick: formatPickLabel(p.predictedResult) as 'HOME' | 'DRAW' | 'AWAY',
    pickConfidence: round1(p.confidence * 100),
    ensembleHome: ens ? round1(ens.homeWin * 100) : '',
    ensembleDraw: ens ? round1(ens.draw * 100) : '',
    ensembleAway: ens ? round1(ens.awayWin * 100) : '',
    modelVersion: p.modelVersion ?? 'unknown',
    settled: p.actualResult !== undefined ? 'true' : 'false',
    actualResult: formatActualResultLabel(p.actualResult),
    hit: formatHitFlag(p),
  };
}

export function formatExportTimestamp(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function buildFilename(kind: 'csv' | 'markdown', now: Date): string {
  const ext = kind === 'csv' ? 'csv' : 'md';
  return `predictions-log-${formatExportTimestamp(now)}.${ext}`;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

**Test coverage targets — `shared.test.ts` (8 tests):**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  predictionToExportRow,
  formatPickLabel,
  formatActualResultLabel,
  formatHitFlag,
  formatExportTimestamp,
  buildFilename,
  triggerBlobDownload,
  EXPORT_COLUMNS,
  MODEL_VERSION,
} from './shared';
import type { StoredPrediction } from '../../services/predictionTracker';

const settledHit: StoredPrediction = {
  id: 'p1', matchId: 'm1',
  homeTeam: 'Liverpool', awayTeam: 'Arsenal',
  predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1,
  confidence: 0.675,
  actualResult: 'H', actualHomeGoals: 2, actualAwayGoals: 1, isCorrect: true,
  timestamp: '2026-04-20T10:00:00Z', matchDate: '2026-04-20T15:00:00Z',
  matchday: 35, modelVersion: 'v3.5-MVP',
  poissonProbs: { homeWin: 0.55, draw: 0.25, awayWin: 0.20 },
};

const unsettled: StoredPrediction = {
  ...settledHit,
  id: 'p2', matchId: 'm2', actualResult: undefined, actualHomeGoals: undefined,
  actualAwayGoals: undefined, isCorrect: undefined,
};

describe('export/shared', () => {
  it('EXPORT_COLUMNS has the spec\'s 13 columns in spec order', () => {
    expect(EXPORT_COLUMNS).toEqual([
      'gameweek', 'utcDate', 'home', 'away', 'pick', 'pickConfidence',
      'ensembleHome', 'ensembleDraw', 'ensembleAway', 'modelVersion',
      'settled', 'actualResult', 'hit',
    ]);
    expect(MODEL_VERSION).toBe('v3.5-MVP');
  });

  it('predictionToExportRow maps a settled hit row correctly', () => {
    const row = predictionToExportRow(settledHit);
    expect(row).toEqual({
      gameweek: 35, utcDate: '2026-04-20T15:00:00Z',
      home: 'Liverpool', away: 'Arsenal', pick: 'HOME', pickConfidence: 67.5,
      ensembleHome: 55, ensembleDraw: 25, ensembleAway: 20,
      modelVersion: 'v3.5-MVP', settled: 'true', actualResult: 'HOME', hit: '1',
    });
  });

  it('predictionToExportRow handles unsettled rows (empty strings, settled=false)', () => {
    const row = predictionToExportRow(unsettled);
    expect(row.settled).toBe('false');
    expect(row.actualResult).toBe('');
    expect(row.hit).toBe('');
  });

  it('predictionToExportRow handles missing matchday (legacy rows) and missing poissonProbs', () => {
    const legacy = { ...settledHit, matchday: undefined, poissonProbs: undefined, modelVersion: undefined };
    const row = predictionToExportRow(legacy);
    expect(row.gameweek).toBe('');
    expect(row.ensembleHome).toBe('');
    expect(row.ensembleDraw).toBe('');
    expect(row.ensembleAway).toBe('');
    expect(row.modelVersion).toBe('unknown');
  });

  it('formatPickLabel + formatActualResultLabel + formatHitFlag follow the H/D/A → HOME/DRAW/AWAY contract', () => {
    expect(formatPickLabel('H')).toBe('HOME');
    expect(formatPickLabel('D')).toBe('DRAW');
    expect(formatPickLabel('A')).toBe('AWAY');
    expect(formatActualResultLabel(undefined)).toBe('');
    expect(formatHitFlag(settledHit)).toBe('1');
    expect(formatHitFlag({ ...settledHit, isCorrect: false })).toBe('0');
    expect(formatHitFlag(unsettled)).toBe('');
  });

  it('formatExportTimestamp returns ISO date portion (local tz)', () => {
    expect(formatExportTimestamp(new Date(2026, 3, 28))).toBe('2026-04-28');
    expect(formatExportTimestamp(new Date(2025, 0, 1))).toBe('2025-01-01');
  });

  it('buildFilename emits predictions-log-YYYY-MM-DD.csv | .md', () => {
    const d = new Date(2026, 3, 28);
    expect(buildFilename('csv', d)).toBe('predictions-log-2026-04-28.csv');
    expect(buildFilename('markdown', d)).toBe('predictions-log-2026-04-28.md');
  });

  it('triggerBlobDownload creates an object URL, clicks <a>, and revokes', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const blob = new Blob(['hello'], { type: 'text/csv' });
    triggerBlobDownload(blob, 'test.csv');
    expect(createSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock');
    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
```

**TDD-discipline check:** all 8 tests fail pre-fix at module-load (`Failed to resolve import "./shared"`). Post-fix: 8/8 pass.

**Validation:**
- `cd frontend && npm run test -- --run src/lib/export/shared.test.ts` — expect 8/8 pass
- `cd frontend && npm run check` — 0/0

**Commit message:**
```
P4e Task 1: ship lib/export/shared helpers + 8 tests

lib/export/shared.ts: pure-utility helpers reused by Tasks 2 + 3.
Exports predictionToExportRow (the StoredPrediction → ExportRow adapter
that pins the spec's 13-column ordering), formatPickLabel /
formatActualResultLabel / formatHitFlag (H/D/A → HOME/DRAW/AWAY label
discipline), formatExportTimestamp + buildFilename (predictions-log-
YYYY-MM-DD.{csv,md}), and triggerBlobDownload (URL.createObjectURL +
transient <a download> click + revoke). Re-exports MODEL_VERSION from
predictionTracker so format modules import from a single location.

EXPORT_COLUMNS satisfies ReadonlyArray<keyof ExportRow> — type-safe
column-order pin. Round-1dp on confidence + ensemble probabilities to
match the on-screen MatchCard precision.

Untagged auto-gated sub-slice — v3.12 reserved for the full P4e slice
when Task 4 wires the screen buttons.
```

### Task 2 — `lib/export/csv.ts` + tests *(auto-gated sub-step)*

Pure CSV builder + side-effecting download wrapper. RFC 4180 escaping (quoted fields contain `,`, `"`, `\n`, `\r`; embedded `"` is doubled).

**Files created:**
- `frontend/src/lib/export/csv.ts`
- `frontend/src/lib/export/csv.test.ts`

**Implementation template — `csv.ts`:**

```ts
import type { StoredPrediction } from '../../services/predictionTracker';
import {
  EXPORT_COLUMNS,
  buildFilename,
  predictionToExportRow,
  triggerBlobDownload,
  type ExportRow,
} from './shared';

const NEEDS_QUOTING = /[",\r\n]/;

function csvEscapeField(value: string | number): string {
  const s = String(value);
  if (!NEEDS_QUOTING.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function rowToCsvLine(row: ExportRow): string {
  return EXPORT_COLUMNS
    .map((col) => csvEscapeField(row[col] as string | number))
    .join(',');
}

export function buildCsv(rows: StoredPrediction[]): string {
  const header = EXPORT_COLUMNS.join(',');
  const body = rows.map((p) => rowToCsvLine(predictionToExportRow(p))).join('\n');
  return rows.length === 0 ? header + '\n' : `${header}\n${body}\n`;
}

export function exportCsv(rows: StoredPrediction[], opts?: { now?: Date }): void {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const filename = buildFilename('csv', opts?.now ?? new Date());
  triggerBlobDownload(blob, filename);
}
```

**Test coverage targets — `csv.test.ts` (6 tests):**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCsv, exportCsv } from './csv';
import * as shared from './shared';
import type { StoredPrediction } from '../../services/predictionTracker';

const sample: StoredPrediction = {
  id: 'p1', matchId: 'm1',
  homeTeam: 'Liverpool', awayTeam: 'Arsenal',
  predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1,
  confidence: 0.675,
  actualResult: 'H', isCorrect: true,
  timestamp: '2026-04-20T10:00:00Z', matchDate: '2026-04-20T15:00:00Z',
  matchday: 35, modelVersion: 'v3.5-MVP',
  poissonProbs: { homeWin: 0.55, draw: 0.25, awayWin: 0.20 },
};

const sampleQuoted: StoredPrediction = {
  ...sample, id: 'p2', matchId: 'm2',
  homeTeam: 'Foo, FC', awayTeam: 'Quote "Bar" United',
};

describe('export/csv', () => {
  it('buildCsv emits a header row in spec order then one row per prediction', () => {
    const out = buildCsv([sample]);
    const [header, body] = out.trimEnd().split('\n');
    expect(header).toBe(
      'gameweek,utcDate,home,away,pick,pickConfidence,ensembleHome,ensembleDraw,ensembleAway,modelVersion,settled,actualResult,hit',
    );
    expect(body).toBe('35,2026-04-20T15:00:00Z,Liverpool,Arsenal,HOME,67.5,55,25,20,v3.5-MVP,true,HOME,1');
  });

  it('buildCsv with empty rows emits header-only output', () => {
    expect(buildCsv([])).toBe(
      'gameweek,utcDate,home,away,pick,pickConfidence,ensembleHome,ensembleDraw,ensembleAway,modelVersion,settled,actualResult,hit\n',
    );
  });

  it('buildCsv RFC-4180-escapes commas, quotes, and newlines', () => {
    const out = buildCsv([sampleQuoted]);
    const [, body] = out.trimEnd().split('\n');
    expect(body).toContain('"Foo, FC"');
    expect(body).toContain('"Quote ""Bar"" United"');
  });

  it('buildCsv handles unsettled (empty actualResult, empty hit, settled=false)', () => {
    const unsettled = { ...sample, actualResult: undefined, isCorrect: undefined };
    const out = buildCsv([unsettled]);
    const [, body] = out.trimEnd().split('\n');
    expect(body.endsWith(',false,,')).toBe(true);
  });

  it('exportCsv composes buildCsv + triggerBlobDownload with the right filename', () => {
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    const now = new Date(2026, 3, 28);
    exportCsv([sample], { now });
    expect(downloadSpy).toHaveBeenCalledOnce();
    const [blob, filename] = downloadSpy.mock.calls[0];
    expect(filename).toBe('predictions-log-2026-04-28.csv');
    expect((blob as Blob).type).toBe('text/csv;charset=utf-8');
    downloadSpy.mockRestore();
  });

  it('exportCsv uses Date.now() when opts.now is absent', () => {
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    vi.setSystemTime(new Date(2026, 3, 28, 12, 0, 0));
    exportCsv([sample]);
    const [, filename] = downloadSpy.mock.calls[0];
    expect(filename).toMatch(/^predictions-log-2026-04-28\.csv$/);
    downloadSpy.mockRestore();
    vi.useRealTimers();
  });
});
```

**TDD-discipline check:** all 6 tests fail pre-fix at module-load. Post-fix: 6/6 pass.

**Validation:**
- `cd frontend && npm run test -- --run src/lib/export/csv.test.ts src/lib/export/shared.test.ts` — expect 6/6 + 8/8
- `cd frontend && npm run check` — 0/0

**Commit message:**
```
P4e Task 2: ship lib/export/csv builder + exportCsv wrapper + 6 tests

lib/export/csv.ts: buildCsv (pure StoredPrediction[] → string serialiser
that emits the 13-column header row in EXPORT_COLUMNS order then one
data row per prediction, RFC-4180 escaping commas/quotes/newlines) +
exportCsv (side-effecting wrapper that builds the CSV, wraps in a
text/csv;charset=utf-8 Blob, and triggers a download via shared's
triggerBlobDownload helper).

Empty rows array still emits the header line (single source of truth
for column names — downstream tooling reads the header even when the
file has no data rows).

Untagged auto-gated sub-slice — v3.12 reserved for the full P4e slice
when Task 4 wires the screen buttons.
```

### Task 3 — `lib/export/markdown.ts` + tests *(auto-gated sub-step)*

Pure Markdown builder + side-effecting download wrapper. Pipe-replacement escaping (`|` → `\|`, newline → `<br>`).

**Files created:**
- `frontend/src/lib/export/markdown.ts`
- `frontend/src/lib/export/markdown.test.ts`

**Implementation template — `markdown.ts`:**

```ts
import type { StoredPrediction } from '../../services/predictionTracker';
import {
  EXPORT_COLUMNS,
  MODEL_VERSION,
  buildFilename,
  formatExportTimestamp,
  predictionToExportRow,
  triggerBlobDownload,
  type ExportRow,
} from './shared';

function mdEscapeField(value: string | number): string {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function rowToMdLine(row: ExportRow): string {
  return `| ${EXPORT_COLUMNS.map((col) => mdEscapeField(row[col] as string | number)).join(' | ')} |`;
}

export function buildMarkdown(rows: StoredPrediction[], opts?: { now?: Date }): string {
  const now = opts?.now ?? new Date();
  const settledCount = rows.filter((p) => p.actualResult !== undefined).length;
  const header =
    `# Premier League Oracle — Predictions Log\n` +
    `> Exported ${formatExportTimestamp(now)} · Model ${MODEL_VERSION} · ${settledCount} settled predictions\n\n`;

  const tableHeader = `| ${EXPORT_COLUMNS.join(' | ')} |`;
  const tableSeparator = `| ${EXPORT_COLUMNS.map(() => '---').join(' | ')} |`;
  const tableBody = rows.map((p) => rowToMdLine(predictionToExportRow(p))).join('\n');

  return rows.length === 0
    ? `${header}${tableHeader}\n${tableSeparator}\n`
    : `${header}${tableHeader}\n${tableSeparator}\n${tableBody}\n`;
}

export function exportMarkdown(rows: StoredPrediction[], opts?: { now?: Date }): void {
  const md = buildMarkdown(rows, opts);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const filename = buildFilename('markdown', opts?.now ?? new Date());
  triggerBlobDownload(blob, filename);
}
```

**Test coverage targets — `markdown.test.ts` (6 tests):**

```ts
import { describe, it, expect, vi } from 'vitest';
import { buildMarkdown, exportMarkdown } from './markdown';
import * as shared from './shared';
import type { StoredPrediction } from '../../services/predictionTracker';

const settled: StoredPrediction = {
  id: 'p1', matchId: 'm1',
  homeTeam: 'Liverpool', awayTeam: 'Arsenal',
  predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1,
  confidence: 0.675,
  actualResult: 'H', isCorrect: true,
  timestamp: '2026-04-20T10:00:00Z', matchDate: '2026-04-20T15:00:00Z',
  matchday: 35, modelVersion: 'v3.5-MVP',
  poissonProbs: { homeWin: 0.55, draw: 0.25, awayWin: 0.20 },
};

const unsettled = { ...settled, actualResult: undefined, isCorrect: undefined };

describe('export/markdown', () => {
  it('buildMarkdown emits the spec header line + table header + separator + 1 row', () => {
    const md = buildMarkdown([settled], { now: new Date(2026, 3, 28) });
    expect(md).toContain('# Premier League Oracle — Predictions Log');
    expect(md).toContain('> Exported 2026-04-28 · Model v3.5-MVP · 1 settled predictions');
    expect(md).toContain('| gameweek | utcDate | home | away |');
    expect(md).toContain('| --- | --- | --- |');
    expect(md).toContain('| 35 | 2026-04-20T15:00:00Z | Liverpool | Arsenal | HOME | 67.5 |');
  });

  it('buildMarkdown header counts only settled predictions', () => {
    const md = buildMarkdown([settled, unsettled], { now: new Date(2026, 3, 28) });
    expect(md).toContain('1 settled predictions');
  });

  it('buildMarkdown with empty rows emits header + table-shell only', () => {
    const md = buildMarkdown([], { now: new Date(2026, 3, 28) });
    expect(md).toContain('0 settled predictions');
    expect(md).toContain('| gameweek | utcDate |');
    expect(md).toContain('| --- |');
    expect(md.split('\n').filter((l) => l.startsWith('|'))).toHaveLength(2);
  });

  it('buildMarkdown escapes pipes and newlines in fields', () => {
    const piped = { ...settled, homeTeam: 'Pipe | Town', awayTeam: 'Multi\nLine' };
    const md = buildMarkdown([piped], { now: new Date(2026, 3, 28) });
    expect(md).toContain('Pipe \\| Town');
    expect(md).toContain('Multi<br>Line');
  });

  it('exportMarkdown composes buildMarkdown + triggerBlobDownload with text/markdown blob', () => {
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    exportMarkdown([settled], { now: new Date(2026, 3, 28) });
    const [blob, filename] = downloadSpy.mock.calls[0];
    expect((blob as Blob).type).toBe('text/markdown;charset=utf-8');
    expect(filename).toBe('predictions-log-2026-04-28.md');
    downloadSpy.mockRestore();
  });

  it('exportMarkdown uses Date.now() when opts.now is absent', () => {
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    vi.setSystemTime(new Date(2026, 3, 28, 12, 0, 0));
    exportMarkdown([settled]);
    const [, filename] = downloadSpy.mock.calls[0];
    expect(filename).toMatch(/^predictions-log-2026-04-28\.md$/);
    downloadSpy.mockRestore();
    vi.useRealTimers();
  });
});
```

**TDD-discipline check:** all 6 tests fail pre-fix at module-load. Post-fix: 6/6 pass.

**Validation:**
- `cd frontend && npm run test -- --run src/lib/export/markdown.test.ts src/lib/export/csv.test.ts src/lib/export/shared.test.ts` — expect 6/6 + 6/6 + 8/8
- `cd frontend && npm run check` — 0/0

**Commit message:**
```
P4e Task 3: ship lib/export/markdown builder + exportMarkdown wrapper + 6 tests

lib/export/markdown.ts: buildMarkdown (pure StoredPrediction[] → string
serialiser that emits the spec header — `# Premier League Oracle —
Predictions Log` followed by `> Exported YYYY-MM-DD · Model v3.5-MVP ·
N settled predictions` — then a Markdown table with the same 13
columns as the CSV; pipes escaped to `\|`, newlines to `<br>`) +
exportMarkdown (side-effecting wrapper, text/markdown;charset=utf-8
blob, .md filename via shared.buildFilename).

Header settled-count filters to rows where actualResult !== undefined
per spec. Empty rows array still emits the header + table shell so
downstream tooling can detect the empty state.

Untagged auto-gated sub-slice — v3.12 reserved for the full P4e slice
when Task 4 wires the screen buttons.
```

### Task 4 — Wire the buttons on Log + Backtest, update screen tests *(auto-gated, closes the slice)*

Replace the placeholder buttons with active ones. Tag `v3.12` lands on this commit.

**Files modified:**
- `frontend/src/screens/predictions/Log.svelte` — drop `data-export-placeholder`, `disabled`, `aria-disabled`, `cursor-not-allowed opacity-60` from the CSV + Markdown buttons; add `on:click={() => exportCsv(rows)}` and `on:click={() => exportMarkdown(rows)}` respectively. Style classes flip to active (mirrors the `[Predict GWxx]` button on Today). Keep `[Export PDF]` placeholder untouched. Add `import { exportCsv } from '../../lib/export/csv'; import { exportMarkdown } from '../../lib/export/markdown';` at the top of the script.
- `frontend/src/screens/predictions/Backtest.svelte` — same treatment for the single CSV button. `on:click={() => exportCsv(predictionTracker.getRecentPredictions(1000))}`. Add `import { exportCsv } from '../../lib/export/csv';`.
- `frontend/src/screens/predictions/Log.test.ts` — replace the existing 3-placeholder assertion (lines 41–43) with: 2 active buttons (no `[data-export-placeholder]`) + 1 still-placeholder PDF button. Add 1 test asserting the CSV click calls `exportCsv` (mocked via `vi.mock('../../lib/export/csv', () => ({ exportCsv: vi.fn() }))`). Final test count for the file: 7.
- `frontend/src/screens/predictions/Backtest.test.ts` — replace the disabled-placeholder assertion (lines 77–83) with an active-button assertion (button is present, has no `disabled` attribute, no `data-export-placeholder` marker). Add 1 test asserting CSV click calls `exportCsv` (mocked). Final test count for the file: 7.

**Implementation template — Log.svelte's button block (replaces the existing CSV + Markdown placeholders):**

```svelte
<button
  type="button"
  class="text-body-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1.5"
  data-export="csv"
  on:click={() => exportCsv(rows)}
>
  Export CSV
</button>

<!-- PDF button STAYS as-is — placeholder, ships with P4f -->

<button
  type="button"
  class="ml-2 text-body-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1.5"
  data-export="markdown"
  on:click={() => exportMarkdown(rows)}
>
  Export Markdown
</button>
```

(The exact ordering — CSV, PDF, Markdown — preserves the spec's placement on `/predictions/log`. The PDF button sits between two active siblings; that's intentional — it makes the disabled-state visually obvious, signalling "this one's coming".)

**Test mocks pattern — Log.test.ts:**

```ts
vi.mock('../../lib/export/csv', () => ({
  exportCsv: vi.fn(),
}));
vi.mock('../../lib/export/markdown', () => ({
  exportMarkdown: vi.fn(),
}));

// Existing tracker mock stays.

it('CSV button click calls exportCsv with the loaded rows', async () => {
  const { exportCsv } = await import('../../lib/export/csv');
  const { container } = render(Log);
  const csvBtn = container.querySelector('[data-export="csv"]') as HTMLButtonElement;
  await fireEvent.click(csvBtn);
  expect(exportCsv).toHaveBeenCalledOnce();
});
```

**Test mocks pattern — Backtest.test.ts:**

```ts
vi.mock('../../lib/export/csv', () => ({
  exportCsv: vi.fn(),
}));

it('CSV button click calls exportCsv with the loaded predictions', async () => {
  const { exportCsv } = await import('../../lib/export/csv');
  const { container } = render(Backtest);
  const csvBtn = container.querySelector('[data-export="csv"]') as HTMLButtonElement;
  await fireEvent.click(csvBtn);
  expect(exportCsv).toHaveBeenCalledOnce();
});
```

**Pre-flight checks before Task 4 starts:**

1. `grep -rn "data-export-placeholder" frontend/src/screens/predictions/` — confirm 4 hits (Log: csv + pdf + markdown; Backtest: csv). Task 4 removes the csv + markdown markers from Log and the csv marker from Backtest. Final state: 1 hit (Log's PDF placeholder).
2. `grep -rn "data-export=\"pdf\"" frontend/src/screens/predictions/` — confirm Log keeps its PDF placeholder (1 hit). ThisWeek's PDF placeholder is wired by P4f; it's unrelated to P4e.
3. Re-read `screens/predictions/ThisWeek.svelte:46-58` — confirm ThisWeek has only `[data-export="pdf"]` and `[data-export="png"]` placeholders, NO CSV or Markdown. The spec puts text exports on Log + Backtest only, not on the This Week ahead-of-fixture screen (because there's nothing settled to export from that screen). P4e does not touch ThisWeek.

**TDD-discipline check:** new screen-level tests fail pre-fix because the buttons still have `data-export-placeholder`. Post-fix: tests pass and the placeholder-attribute assertions in the old tests no longer match, so they're updated in the same commit (this is the swap, not net-new). Net test deltas: Log `+1` test (final 7), Backtest `+1` test (final 7).

**Validation:**
- `cd frontend && npm run test -- --run` — expect **880/880 across 74 files** (was 862/862 across 71 post-P4d; +20 from this slice: 8 shared + 6 csv + 6 markdown + 2 net screen-test deltas; +3 new files: shared.test.ts, csv.test.ts, markdown.test.ts). Verify the actual count against this prediction; if it diverges by more than ±2 (e.g. an unrelated test was added in the meantime), update the discovery note in `IMPLEMENTATION_PLAN.md` to match the real count.
- `cd frontend && npm run check` — 0/0
- `cd frontend && npx playwright test --project=desktop-chrome routing.spec.ts` — 32/32 green. The existing routing suite covers `/predictions/log` and `/predictions/backtest`; the button-wiring change is invisible to routing-level assertions, so the suite stays unaffected.

**Files to commit (Task 4 only):**
- `frontend/src/screens/predictions/Log.svelte` (button rewires + 2 imports)
- `frontend/src/screens/predictions/Log.test.ts` (assertion swaps + 1 new test)
- `frontend/src/screens/predictions/Backtest.svelte` (button rewire + 1 import)
- `frontend/src/screens/predictions/Backtest.test.ts` (assertion swaps + 1 new test)
- `IMPLEMENTATION_PLAN.md` (Active phase narrative + checklist `[ ] → [x]` for P4e + discovery note + tag note)

If Tasks 1 + 2 + 3 already shipped their artefacts, Task 4 only adds the screen edits + plan update.

**Commit message:**
```
P4e Task 4: wire CSV + Markdown export buttons on Log + Backtest

screens/predictions/Log.svelte: replace [Export CSV] and [Export
Markdown] placeholder buttons with active versions. Click handlers
call exportCsv(rows) / exportMarkdown(rows). [Export PDF] button stays
as a placeholder until P4f. Active buttons get the v3 primary-action
styling that matches Today's [Predict GWxx] button.

screens/predictions/Backtest.svelte: same treatment for the single
[Export CSV] button — click handler calls exportCsv on a fresh
predictionTracker.getRecentPredictions(1000) read so the export
matches the dataset Backtest's KPIs are scored against.

Tests: Log.test.ts + Backtest.test.ts each gain one click-handler
assertion (mocked exportCsv / exportMarkdown). Existing
data-export-placeholder assertions are swapped for active-button
assertions in the same commit.

Closes P4e. vitest <count>/<count>, svelte-check 0/0, Playwright
routing 32/32 on desktop-chrome (route surfaces unchanged — only
the button payloads differ).

Auto-gated — tag v3.12 applied at this commit per the auto-gate
tagging policy.
```

**Discovery note template (append to `## Notes / discoveries` in `IMPLEMENTATION_PLAN.md`):**

```md
- **(P4e, no blocker)** P4e landed: lib/export/{shared,csv,markdown}.ts shipped with their tests, and the [Export CSV] + [Export Markdown] buttons on /predictions/log + /predictions/backtest are now active. Click handlers invoke pure StoredPrediction[] → string serialisers wrapped by triggerBlobDownload (URL.createObjectURL + transient <a download> + revoke). [Export PDF] on Log stays a placeholder for P4f. Spec column ordering — gameweek/utcDate/home/away/pick/pickConfidence/ensembleHome/ensembleDraw/ensembleAway/modelVersion/settled/actualResult/hit — pinned via EXPORT_COLUMNS satisfies ReadonlyArray<keyof ExportRow> in lib/export/shared.ts. Markdown header line includes settled-count per spec ("Exported YYYY-MM-DD · Model v3.5-MVP · N settled predictions"). RFC-4180 escaping for CSV; pipe-replacement for Markdown. Filename pattern: predictions-log-YYYY-MM-DD.{csv,md}. vitest <count>/<count> across <files> files, svelte-check 0/0, Playwright routing 32/32 on desktop-chrome (route surfaces unchanged). Auto-gated — tag v3.12 applied at this commit.
- **(P4e deviations from plan)** [Ralph fills this in based on actual deviations.]
- **(P4e follow-ups)**
  - **(open — P4f)** Wire [Export PDF] on /predictions/log + [Export PDF] / [Export PNG] on /predictions/this-week. Adds html2canvas + jspdf as the only two new package.json dependencies of the redesign.
  - **(open)** "Copy to clipboard" affordance for the Markdown export — only worth shipping if user feedback asks for it. The current download-only path is the spec's prescribed shape.
  - **(open)** Once predictionTracker's 90-day GC ceiling is loosened, the export blob may grow large enough to consider streaming. Today's ~200-row cap fits in memory comfortably — no work needed yet.
  - **(open)** ROI-per-market column on Backtest's CSV would require StoredPrediction.odds (the same odds-capture follow-up P4b's ROI tile is waiting on). When that lands, EXPORT_COLUMNS gains 4 numeric columns; both formatters propagate automatically because they consume EXPORT_COLUMNS.
```
