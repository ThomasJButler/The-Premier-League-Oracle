# P4f — Export binary (PDF + PNG card)

**Status:** plan-ready, awaiting loop pickup.
**Gate:** Manual (human eyeball on actual generated PDF/PNG output).
**Tag at sign-off:** `v3.13`.
**Spec reference:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 → "Predictions exports — Phase 3" (spec lines 541–560); plus the `lib/export/` file-tree listing at spec lines 148–153 (`shared.ts` / `csv.ts` / `markdown.ts` / `pdf.ts` / `pngCard.ts` — P4e shipped the first three, P4f ships the last two); plus the row in spec line 24 of the Decisions table — "Export formats: CSV + PDF + Markdown + PNG card (no JSON, no re-import). Human-readable formats only; exports go *out* of the app, never back in"; plus risk row at spec line 722 ("html2canvas produces poor-quality gradients on the broadcast palette → P4f flagged with fallback escalation: implement `/print/predictions/[gw]` route + headless Playwright capture if rendering quality is insufficient. Decided in iteration.")

## Goal

Wire the two **binary export formats** — PDF and PNG card — for the Predictions hub. Both formats render existing screen DOM (Log table; ThisWeek MatchCard grid) into a downloadable binary blob via `html2canvas` (DOM → `<canvas>`) and `jsPDF` (canvas → PDF page). Three placeholder buttons go live in this slice:

- `/predictions/log` → `[Export PDF]` (was placeholder; now triggers `exportPdf({ kind: 'log', target: tableEl, rows })`)
- `/predictions/this-week` → `[Export PDF]` (was placeholder; now triggers `exportPdf({ kind: 'this-week', target: gridEl, gameweek })`)
- `/predictions/this-week` → `[Share PNG]` (was placeholder; now triggers `exportPngCard({ target: gridEl, kind: 'gw-grid', gameweek })`)

The slice is **manual-gated** because the only meaningful validation question — "does the rendered PDF look good?" / "does the PNG card capture cleanly without artifacts on the team-color gradient bleeds?" — cannot be answered in jsdom (no real `<canvas>` API; html2canvas degrades to no-op shims). Vitest covers the **wiring contract** (lazy import resolves; click handler invokes the right wrapper with the right target element + opts), but the **visual quality contract** lands on the human eyeball during sign-off.

## Surface area

- **New PNG-card module:** `frontend/src/lib/export/pngCard.ts` (+ `.test.ts`) — DOM → PNG flow. Exports:
  - `capturePngCard(target: HTMLElement, opts: PngCardOpts): Promise<Blob>` — pure async function: lazy-import `html2canvas`, snapshot the target element at the requested pixel size, return the resulting PNG `Blob`. **Pure** in the sense that it has no DOM side-effects beyond html2canvas's transient offscreen-render dance — caller is responsible for the download trigger.
  - `exportPngCard(opts: PngCardOpts & { target: HTMLElement; now?: Date }): Promise<void>` — side-effecting wrapper: calls `capturePngCard()`, then `triggerBlobDownload(blob, buildBinaryFilename('png', opts.now ?? new Date(), opts))`.
  - `PngCardOpts` shape: `{ kind: 'single-fixture' | 'gw-grid'; gameweek?: number; matchId?: string }`. Drives the canvas dimensions and the filename — `single-fixture` → 1080×1080, `gw-grid` → 1080×1920 (per spec line 558).
- **New PDF module:** `frontend/src/lib/export/pdf.ts` (+ `.test.ts`) — DOM → PDF page flow. Exports:
  - `buildPdfDocument(target: HTMLElement, opts: PdfOpts): Promise<jsPDFInstance>` — lazy-imports `html2canvas` + `jspdf`, snapshots the target element, instantiates a jsPDF `landscape` A4 doc, places the canvas as a single page-fill image, draws the spec footer ("Premier League Oracle · Model v3.5-MVP · {label}"), returns the doc instance. Footer label = `"Predictions for GW{N}"` for ThisWeek and `"Predictions Log"` for Log.
  - `exportPdf(opts: PdfOpts & { target: HTMLElement; now?: Date }): Promise<void>` — side-effecting wrapper: builds the doc, converts to a `Blob` via `doc.output('blob')`, calls `triggerBlobDownload(blob, buildBinaryFilename('pdf', opts.now ?? new Date(), opts))`.
  - `PdfOpts` shape: `{ kind: 'log' | 'this-week'; gameweek?: number }`. Drives the footer label and the filename.
- **Helper extension in `lib/export/shared.ts`:** add `buildBinaryFilename(kind: 'png' | 'pdf', now: Date, opts: { kind: 'log' | 'this-week' | 'single-fixture' | 'gw-grid'; gameweek?: number; matchId?: string }): string` next to the existing `buildFilename`. Keeps the filename convention in one place. Output shapes (verified against spec):
  - PDF: `predictions-log-2026-04-28.pdf` (Log surface; same prefix as P4e's CSV/MD)
  - PDF: `predictions-gw35-2026-04-28.pdf` (ThisWeek surface, gameweek-stamped)
  - PNG: `predictions-gw35-2026-04-28.png` (ThisWeek `gw-grid`)
  - PNG: `predictions-{matchId}-2026-04-28.png` (future single-fixture path; not wired in P4f, but the helper supports it so P9b's mobile match deep-dive `[Share PNG]` button can reuse the same helper without touching `shared.ts` again)
- **Modified screens:**
  - `frontend/src/screens/predictions/Log.svelte` — replace the `[data-export-placeholder][data-export="pdf"]` button with an active version: drop `disabled`, drop `aria-disabled`, drop `data-export-placeholder`, drop the `cursor-not-allowed opacity-60` classes, add an `on:click` handler that calls `exportPdf({ kind: 'log', target: logTableEl, gameweek: undefined })`. Add `bind:this={logTableEl}` to the existing `[data-log-table]` div (line 68 — already in the markup since P4c). Replace dim styling with the same `bg-primary text-primary-foreground hover:bg-primary/90` classes the active CSV + Markdown buttons use (consistency across the export-button row).
  - `frontend/src/screens/predictions/ThisWeek.svelte` — same treatment for both PDF + PNG buttons. Click handlers call `exportPdf({ kind: 'this-week', target: gridEl, gameweek: currentGw })` and `exportPngCard({ kind: 'gw-grid', target: gridEl, gameweek: currentGw })`. Add `bind:this={gridEl}` to the existing `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">` block (line 73). The button click is gated on `currentGw !== null && gridEl !== undefined` so a no-fixtures state can't trigger an empty capture.
- **Modified screen tests:**
  - `frontend/src/screens/predictions/Log.test.ts` — update the existing "renders 2 active export buttons (CSV + Markdown) plus 1 PDF placeholder" test (lines 47–61) to assert **3 active buttons** (no `data-export-placeholder`, no `disabled`); update the click-handler test pattern to also include a PDF click test. Final test count for the file: 7 → 8 (one swap, one added).
  - `frontend/src/screens/predictions/ThisWeek.test.ts` — replace the existing "renders [Export PDF] and [Share PNG] as disabled placeholder buttons" assertion (lines 100–119) with two assertions: both buttons are now active (no `data-export-placeholder`, no `disabled`); clicking each calls `exportPdf` / `exportPngCard` (mocked). Final test count for the file: 5 → 6 (one swap → split; one added).
- **`package.json`:** add `html2canvas@^1.4.1` and `jspdf@^2.5.2` to `frontend/package.json` `dependencies` (the only two new redesign dependencies; verified at plan-grooming time that neither is currently present). Lockfile (`frontend/package-lock.json`) updates as a consequence of the install. **No backend changes** — PDF/PNG generation is browser-side only, per spec line 712.

## Composition rule (re-asserted from index.md)

Every binary-export module under `lib/export/` follows the same shape P4e established for text exports — a **pure async core** wrapped by a **single-purpose side-effecting trigger**. The pure cores (`capturePngCard`, `buildPdfDocument`) take a target `HTMLElement` + opts and return a `Blob` / `jsPDFInstance`. The side-effecting wrappers (`exportPngCard`, `exportPdf`) compose the core with `triggerBlobDownload(...)` (re-used from `shared.ts`). Screens import only the side-effecting wrappers; tests can drop down to the pure cores when they want to assert the canvas-and-doc contract in isolation.

`shared.ts` continues to be the single source of truth for filename conventions — `buildBinaryFilename` is added next to `buildFilename` (text), so a future binary format (e.g. SVG export) lands one helper next to two siblings. **No format-specific logic in `shared.ts`** — html2canvas-options, jsPDF-options, footer-text composition belong in their respective format modules.

## Type contracts

### Consumed (existing, no changes in this slice)

```ts
// services/predictionTracker.ts (verified)
import { type StoredPrediction } from '../../services/predictionTracker';
//   StoredPrediction shape unchanged from P4e — pdf.ts does NOT re-derive ExportRow
//   from rows because PDF rendering captures the rendered MatchCard / MatchRow DOM
//   directly, not the row data. Log's PDF input is the same `rows` variable
//   the screen already binds.

// lib/export/shared.ts (P4e — used directly)
import { triggerBlobDownload, formatExportTimestamp, MODEL_VERSION } from './shared';
//   triggerBlobDownload is the same blob-download helper used by P4e's CSV/MD wrappers.
//   formatExportTimestamp gives the YYYY-MM-DD date portion for filenames.
//   MODEL_VERSION is stamped into the PDF footer.
```

### New (this slice)

```ts
// lib/export/shared.ts (extended)
export type BinaryFilenameOpts =
  | { kind: 'log' | 'this-week'; gameweek?: number }
  | { kind: 'gw-grid'; gameweek: number }
  | { kind: 'single-fixture'; matchId: string };

export function buildBinaryFilename(
  format: 'png' | 'pdf',
  now: Date,
  opts: BinaryFilenameOpts,
): string;
//   Output examples:
//     ('pdf', 2026-04-28, { kind: 'log' })             → 'predictions-log-2026-04-28.pdf'
//     ('pdf', 2026-04-28, { kind: 'this-week', gameweek: 35 })
//                                                       → 'predictions-gw35-2026-04-28.pdf'
//     ('png', 2026-04-28, { kind: 'gw-grid', gameweek: 35 })
//                                                       → 'predictions-gw35-2026-04-28.png'
//     ('png', 2026-04-28, { kind: 'single-fixture', matchId: 'm123' })
//                                                       → 'predictions-m123-2026-04-28.png'
```

```ts
// lib/export/pngCard.ts
export type PngCardKind = 'single-fixture' | 'gw-grid';

export interface PngCardOpts {
  kind: PngCardKind;
  gameweek?: number;
  matchId?: string;
}

export async function capturePngCard(
  target: HTMLElement,
  opts: PngCardOpts,
): Promise<Blob>;

export async function exportPngCard(
  opts: PngCardOpts & { target: HTMLElement; now?: Date },
): Promise<void>;
```

```ts
// lib/export/pdf.ts
export type PdfKind = 'log' | 'this-week';

export interface PdfOpts {
  kind: PdfKind;
  gameweek?: number;
}

// jsPDFInstance is the structural interface P4f uses internally — exported
// only so test files can type the doc returned by buildPdfDocument.
// Declared structurally rather than imported from 'jspdf' so the test files
// don't pull the real lib at type-check time.
export interface JsPdfDocLike {
  addImage: (...args: unknown[]) => void;
  text: (...args: unknown[]) => void;
  output: (kind: 'blob') => Blob;
  save: (filename: string) => void;
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
}

export async function buildPdfDocument(
  target: HTMLElement,
  opts: PdfOpts & { now?: Date },
): Promise<JsPdfDocLike>;

export async function exportPdf(
  opts: PdfOpts & { target: HTMLElement; now?: Date },
): Promise<void>;
```

## Known limitations / design decisions baked into P4f

1. **Lazy `import()` for both `html2canvas` and `jspdf`.** Each module's exported functions use `const { default: html2canvas } = await import('html2canvas')` and `const { default: jsPDF } = await import('jspdf')` rather than top-level `import`. Reasoning: the two libs are ~600KB minified combined and only a small slice of users will click Export. Top-level imports would pull them into the initial bundle for every visitor; lazy imports defer the cost to first click. Vite's automatic code-splitting handles the chunk emission. **Test-side consequence:** `vi.mock('html2canvas', ...)` and `vi.mock('jspdf', ...)` factories must export `default` to match the dynamic-import shape. The test stubs are kept lightweight — a mock `html2canvas(target)` returns a fake `<canvas>`-shaped object with `toBlob` and `toDataURL`; a mock `jsPDF(...)` returns the structural `JsPdfDocLike` with vi-fn'd methods.
2. **PDF capture renders the screen's *current* DOM state — sections are not auto-expanded for the snapshot.** The spec line 558 says "rendering predictions grid via `MatchCard`s with all sections expanded", but auto-expanding requires rendering an offscreen "print copy" of the grid with `defaultOpen={['analyse', 'probabilities', 'form', 'context']}` on every MatchCard, then capturing it, then unmounting — a meaningful complexity bump. P4f ships the simpler "capture what's on screen" version. Sign-off discovery note must call this out; if the human sweep finds it unacceptable, the follow-up is **either** (a) build the offscreen-print-clone path in a P4f-followup slice, **or** (b) escalate to the spec-line-560 fallback (`/print/predictions/[gw]` route + headless Playwright capture as a backend route). The simpler path is shipped first because it has a chance of being good enough and avoids speculative complexity.
3. **A4 landscape, single page.** Per spec line 558. ThisWeek's GW grid commonly has 10 fixtures; html2canvas captures the full grid as one tall image; the PDF places it as a single image scaled to fit the A4 landscape page (297×210mm). If the grid is taller than the page can hold without becoming illegible, the human sweep will flag it and the follow-up is multi-page pagination. **No multi-page pagination logic in P4f's first ship** — single page only, scale-to-fit. Recorded as a known limitation.
4. **Filename uses `gw{N}` for ThisWeek and `log` for Log.** `predictions-gw35-2026-04-28.pdf` makes a folder of multiple exports auto-sort by date then by surface. Cleaner than the alternatives (`predictions-this-week-2026-04-28.pdf` is verbose; `predictions-2026-04-28-gw35.pdf` doesn't auto-sort by date). `single-fixture` is `predictions-{matchId}-…` for the future P9b match deep-dive surface — `matchId` is the API's stable string ID, not derived from a slug.
5. **`now` injected, not read from `Date.now()` inside the wrappers** — same dependency-injection pattern P4e uses (`opts?.now ?? new Date()`). Tests pass a fixed date for deterministic filename assertions.
6. **PDF footer text matches the spec verbatim:** `"Premier League Oracle · Model v3.5-MVP · Predictions for GW35."` for ThisWeek, `"Premier League Oracle · Model v3.5-MVP · Predictions Log"` for Log. The `MODEL_VERSION` re-export from `shared.ts` is the source of truth. Footer is drawn at the bottom of the page in a small grey font using `doc.text(footerText, x, y)` — the placement is `(pageWidth / 2, pageHeight - 5mm)` centred. Test asserts `doc.text` is called with the expected string.
7. **PNG canvas dimensions:** 1080×1080 for `single-fixture`, 1080×1920 for `gw-grid`. `html2canvas` is given `{ scale: 1080 / target.offsetWidth }` to upscale the DOM render to social-share resolutions. The `gw-grid` 1080×1920 portrait orientation matches Instagram Story aspect ratio (9:16) and the spec's "1080×1920 GW grid" line. Width is the dominant constraint — height is whatever the grid renders at after the width-scale; if it exceeds 1920 the helper crops to 1920 (top-down) so the result is shareable on Stories without aspect-fill letterboxing.
8. **`triggerBlobDownload` reused from P4e's `shared.ts`** — no second blob-download helper. The `<a download>` click trick works for `image/png` and `application/pdf` blob types identically to `text/csv`. Single source of truth for the blob-download choreography.
9. **html2canvas options pinned conservatively:** `{ backgroundColor: null, useCORS: true, allowTaint: false, scale: <calculated> }`. `backgroundColor: null` preserves transparency on rounded-corner clipping; `useCORS: true` lets crest images load via the existing CORS-enabled Football-Data CDN; `allowTaint: false` keeps the resulting canvas un-tainted (otherwise `.toBlob()` throws `SecurityError` on cross-origin images). If a crest fails CORS (Football-Data has occasional flaky headers), the canvas renders the fallback `Crest` atom's letter-initial placeholder — the export is degraded but not broken. Recorded as a known limitation; the dataService warm-up that pre-validates crest URLs can be a P10 follow-up.
10. **jsPDF options pinned:** `{ orientation: 'landscape', unit: 'mm', format: 'a4' }`. Image placement uses `doc.addImage(canvas, 'PNG', 0, 0, pageWidth, pageHeight)` — full-bleed page. Footer drawn after the image so it overlays. Single page only (per limitation #3). PDF version stamped via the `MODEL_VERSION` re-export (no second hard-coded version string in `pdf.ts`).
11. **No print-style CSS injection.** html2canvas captures the live theme (light/dark per `<html class="dark">` or not). A user exporting at night gets a dark-themed PDF; daytime exports light. This is the user's expected behaviour — they're "saving what they see." Recorded as a known limitation if a future ask wants light-only PDFs (most printers prefer light backgrounds for ink savings).
12. **No "open PDF in new tab" path.** Spec line 558 says "downloadable" — `triggerBlobDownload` matches that. A future "preview before download" UX would require a modal with an `<iframe src={blobUrl}>` and a download CTA inside the modal. Not P4f's surface.
13. **Test boundaries: jsdom can't render `<canvas>`.** Every `lib/export/{pngCard,pdf}.test.ts` test mocks the lazy-imported modules (`vi.mock('html2canvas', ...)`, `vi.mock('jspdf', ...)`). The tests assert the wiring contract (imports resolve, mocked functions called with the expected target + options, blob-type and filename are correct on the resulting `triggerBlobDownload` call). They do **not** assert any pixel content of the rendered output — that's the manual sweep's job.
14. **No clipboard fallback for the PNG.** Same reasoning as P4e: download-only is the spec's prescribed shape. A future "copy image to clipboard" affordance is a follow-up.

## Atom + adapter signatures verified during 2026-04-28 plan grooming

1. **`html2canvas` and `jspdf` are NOT in `frontend/package.json` at plan-grooming time.** Verified via `grep -E "html2canvas|jspdf|jsPDF" frontend/package.json` returning no hits. Task 1 adds `html2canvas`; Task 2 adds `jspdf`. Each addition is paired with the test file that lazy-imports it, so the dep is exercised by its own task's vitest run.
2. **`predictionTracker.MODEL_VERSION`** is `'v3.5-MVP'` (line 10 in `services/predictionTracker.ts` — already verified during P4e). Re-exported from `lib/export/shared.ts` per P4e; `pdf.ts` imports from `./shared` (single import surface). No new tracker import in this slice.
3. **`triggerBlobDownload` from `lib/export/shared.ts`** (P4e) is shape-compatible with `image/png` and `application/pdf` blobs — it's blob-type agnostic. Verified by reading the implementation: it only touches `URL.createObjectURL(blob)`, `<a download>`, and `URL.revokeObjectURL`, none of which inspect blob content. P4f wrappers reuse it.
4. **`formatExportTimestamp` from `shared.ts`** (P4e) returns `YYYY-MM-DD` and is reused verbatim by `buildBinaryFilename`. Single-source-of-truth for the date portion of all export filenames.
5. **`[data-log-table]` div in `Log.svelte` line 68** is the exact capture target for the Log PDF. Already in the markup — no change needed beyond `bind:this={logTableEl}`. Renders only when `hasFilteredRows` is true; the click handler should be a no-op (or surface a tooltip) when it's false. **Decision:** disable the PDF button via `disabled={!hasFilteredRows}` so the user can't trigger an empty export. Same gate that drives `[data-log-table]`'s `{#if}` block.
6. **`<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">` in `ThisWeek.svelte` line 73** is the capture target for ThisWeek. Already in the markup — no change beyond `bind:this={gridEl}`. Renders only when `loaded && currentGw !== null && gwFixtures.length > 0`. **Decision:** disable both binary-export buttons via `disabled={!loaded || currentGw === null || gwFixtures.length === 0}` so a no-fixtures state can't trigger.
7. **Existing screen tests** — `Log.test.ts` has 7 tests; lines 47–61 assert "2 active + 1 PDF placeholder" — Task 3 swaps to "3 active" plus adds 1 PDF click-handler test → final 8. `ThisWeek.test.ts` has 5 tests; lines 100–119 assert "2 placeholder buttons" — Task 3 swaps to "2 active" plus adds 1 click-handler test (PDF + PNG bundled into one test for compactness, or split into two — see Task 3 template) → final 6 or 7. Predicted vitest delta from Task 3: `+1` Log + `+1` or `+2` ThisWeek = `+2` or `+3` over the post-Task-2 baseline. Predicted vitest delta from Tasks 1 + 2: `+5` PNG + `+5` PDF = `+10`. Total slice delta: `+12` to `+13` over the post-P4e 884/884 baseline → **expected 896–897/896–897 across 76 files** post-P4f. Verify the actual count and update the discovery note to match.
8. **Vitest's mock hoisting + dynamic-import contract:** `vi.mock('html2canvas', () => ({ default: vi.fn() }))` works for `await import('html2canvas')` because vitest's hoister rewrites the dynamic import to use the mock factory. Verified at https://vitest.dev/guide/mocking.html#modules — the mock is registered before the module's first import, regardless of static vs dynamic. Test files can call `const { default: html2canvas } = await import('html2canvas')` to retrieve the mocked function for assertion.
9. **`HTMLCanvasElement.toBlob` in jsdom 22:** absent. The mock factory's fake canvas needs to expose `toBlob: (cb) => cb(new Blob(['fake-png'], { type: 'image/png' }))` directly — not by going through a real canvas. Same shape any html2canvas-using test file in the broader Svelte/Vite ecosystem uses (referenced patterns: vitest issues #4123 + #5512). No html2canvas internals are exercised during the test run; the unit suite's job is the wiring contract only.
10. **`jspdf`'s `output('blob')` API:** verified via the jspdf README (https://github.com/parallax/jsPDF). `doc.output('blob')` returns a `Blob` of MIME `application/pdf`. Mock factory returns a vi-fn'd `output` that returns `new Blob(['fake-pdf'], { type: 'application/pdf' })`. Test asserts the wrapper passes that blob to `triggerBlobDownload`.

## TDD task list

Each task is one ralph iteration unless explicitly noted as foldable. Run in order. **Tasks 1 + 2 are auto-gated** sub-slices (untagged); **Task 3 is manual-gated** — ralph commits after `npm run check` is clean and stops with a paragraph summary, awaiting human sweep on actual generated PDF/PNG output. The slice's tag `v3.13` lands at sign-off (human applies after eyeball, per the manual-gate tagging policy in `IMPLEMENTATION_PLAN.md`'s Active phase narrative).

### Task 1 — `lib/export/pngCard.ts` + tests *(auto-gated sub-step; adds `html2canvas` dep)*

PNG card capture flow. Lazy-imports `html2canvas`; wraps the result in a Blob; reuses `triggerBlobDownload` for the side-effecting wrapper.

**Files created:**
- `frontend/src/lib/export/pngCard.ts`
- `frontend/src/lib/export/pngCard.test.ts`

**Files modified:**
- `frontend/src/lib/export/shared.ts` — add `buildBinaryFilename` (the helper is needed first because both Tasks 1 + 2 consume it). Helper added next to the existing `buildFilename`.
- `frontend/src/lib/export/shared.test.ts` — add 4 tests for `buildBinaryFilename` covering each `BinaryFilenameOpts` discriminant: `'log'`, `'this-week' + gameweek`, `'gw-grid' + gameweek`, `'single-fixture' + matchId`.
- `frontend/package.json` — add `"html2canvas": "^1.4.1"` to `dependencies`. Run `npm install --no-audit --no-fund` once at task start so the lockfile updates and the test run can resolve the lazy import.

**Implementation template — `shared.ts` extension:**

```ts
// Append to shared.ts, after buildFilename.

export type BinaryFilenameOpts =
  | { kind: 'log' | 'this-week'; gameweek?: number }
  | { kind: 'gw-grid'; gameweek: number }
  | { kind: 'single-fixture'; matchId: string };

export function buildBinaryFilename(
  format: 'png' | 'pdf',
  now: Date,
  opts: BinaryFilenameOpts,
): string {
  const date = formatExportTimestamp(now);
  const ext = format;
  switch (opts.kind) {
    case 'log':
      return `predictions-log-${date}.${ext}`;
    case 'this-week':
      return opts.gameweek !== undefined
        ? `predictions-gw${opts.gameweek}-${date}.${ext}`
        : `predictions-this-week-${date}.${ext}`;
    case 'gw-grid':
      return `predictions-gw${opts.gameweek}-${date}.${ext}`;
    case 'single-fixture':
      return `predictions-${opts.matchId}-${date}.${ext}`;
  }
}
```

**Implementation template — `pngCard.ts`:**

```ts
import { buildBinaryFilename, triggerBlobDownload, type BinaryFilenameOpts } from './shared';

export type PngCardKind = 'single-fixture' | 'gw-grid';

export interface PngCardOpts {
  kind: PngCardKind;
  gameweek?: number;
  matchId?: string;
}

const TARGET_DIMS: Record<PngCardKind, { width: number; height: number }> = {
  'single-fixture': { width: 1080, height: 1080 },
  'gw-grid': { width: 1080, height: 1920 },
};

export async function capturePngCard(
  target: HTMLElement,
  opts: PngCardOpts,
): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const { width, height } = TARGET_DIMS[opts.kind];
  const scale = width / Math.max(target.offsetWidth, 1);
  const canvas = await html2canvas(target, {
    backgroundColor: null,
    useCORS: true,
    allowTaint: false,
    scale,
    width: target.offsetWidth,
    height: Math.min(target.offsetHeight, height / scale),
  });
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob: Blob | null) => {
      if (!blob) return reject(new Error('canvas.toBlob returned null'));
      resolve(blob);
    }, 'image/png');
  });
}

export async function exportPngCard(
  opts: PngCardOpts & { target: HTMLElement; now?: Date },
): Promise<void> {
  const blob = await capturePngCard(opts.target, opts);
  const now = opts.now ?? new Date();
  const filenameOpts = toFilenameOpts(opts);
  const filename = buildBinaryFilename('png', now, filenameOpts);
  triggerBlobDownload(blob, filename);
}

function toFilenameOpts(opts: PngCardOpts): BinaryFilenameOpts {
  if (opts.kind === 'gw-grid') {
    if (opts.gameweek === undefined) {
      throw new Error("PngCardOpts.kind='gw-grid' requires gameweek");
    }
    return { kind: 'gw-grid', gameweek: opts.gameweek };
  }
  if (opts.matchId === undefined) {
    throw new Error("PngCardOpts.kind='single-fixture' requires matchId");
  }
  return { kind: 'single-fixture', matchId: opts.matchId };
}
```

**Test coverage targets — `pngCard.test.ts` (5 tests):**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as shared from './shared';

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    toBlob: (cb: (b: Blob | null) => void) =>
      cb(new Blob(['fake-png'], { type: 'image/png' })),
  })),
}));

describe('export/pngCard', () => {
  let target: HTMLElement;
  beforeEach(() => {
    vi.clearAllMocks();
    target = document.createElement('div');
    Object.defineProperty(target, 'offsetWidth', { value: 800, configurable: true });
    Object.defineProperty(target, 'offsetHeight', { value: 600, configurable: true });
    document.body.appendChild(target);
  });

  it('capturePngCard lazy-imports html2canvas with the gw-grid dimensions', async () => {
    const { capturePngCard } = await import('./pngCard');
    const html2canvas = (await import('html2canvas')).default;
    const blob = await capturePngCard(target, { kind: 'gw-grid', gameweek: 35 });
    expect(html2canvas).toHaveBeenCalledOnce();
    const [el, opts] = (html2canvas as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(el).toBe(target);
    expect(opts.scale).toBeCloseTo(1080 / 800, 5);
    expect(blob.type).toBe('image/png');
  });

  it('capturePngCard uses 1080x1080 dims for single-fixture', async () => {
    const { capturePngCard } = await import('./pngCard');
    const html2canvas = (await import('html2canvas')).default;
    await capturePngCard(target, { kind: 'single-fixture', matchId: 'm1' });
    const [, opts] = (html2canvas as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.scale).toBeCloseTo(1080 / 800, 5);
  });

  it('exportPngCard composes capturePngCard + triggerBlobDownload with the right filename', async () => {
    const { exportPngCard } = await import('./pngCard');
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    await exportPngCard({
      kind: 'gw-grid',
      gameweek: 35,
      target,
      now: new Date(2026, 3, 28),
    });
    expect(downloadSpy).toHaveBeenCalledOnce();
    const [blob, filename] = downloadSpy.mock.calls[0];
    expect((blob as Blob).type).toBe('image/png');
    expect(filename).toBe('predictions-gw35-2026-04-28.png');
    downloadSpy.mockRestore();
  });

  it('exportPngCard uses Date.now() when opts.now is absent', async () => {
    const { exportPngCard } = await import('./pngCard');
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 28, 12, 0, 0));
    await exportPngCard({ kind: 'gw-grid', gameweek: 35, target });
    const [, filename] = downloadSpy.mock.calls[0];
    expect(filename).toBe('predictions-gw35-2026-04-28.png');
    downloadSpy.mockRestore();
    vi.useRealTimers();
  });

  it('exportPngCard throws if gw-grid is missing gameweek', async () => {
    const { exportPngCard } = await import('./pngCard');
    await expect(
      // @ts-expect-error — missing gameweek is the test
      exportPngCard({ kind: 'gw-grid', target }),
    ).rejects.toThrow(/gameweek/);
  });
});
```

**Test coverage additions — `shared.test.ts` (+4 tests, total 12):**

```ts
import { buildBinaryFilename } from './shared';

describe('buildBinaryFilename', () => {
  const d = new Date(2026, 3, 28);
  it('emits Log surface filename', () => {
    expect(buildBinaryFilename('pdf', d, { kind: 'log' })).toBe('predictions-log-2026-04-28.pdf');
  });
  it('emits ThisWeek surface filename with gameweek', () => {
    expect(buildBinaryFilename('pdf', d, { kind: 'this-week', gameweek: 35 }))
      .toBe('predictions-gw35-2026-04-28.pdf');
  });
  it('emits gw-grid PNG filename', () => {
    expect(buildBinaryFilename('png', d, { kind: 'gw-grid', gameweek: 35 }))
      .toBe('predictions-gw35-2026-04-28.png');
  });
  it('emits single-fixture PNG filename with matchId', () => {
    expect(buildBinaryFilename('png', d, { kind: 'single-fixture', matchId: 'm123' }))
      .toBe('predictions-m123-2026-04-28.png');
  });
});
```

**TDD-discipline check:** all 5 PNG tests + 4 shared-helper tests fail pre-fix at module-load. Post-fix: 5/5 + 4/4 pass.

**Validation:**
- `cd frontend && npm install --no-audit --no-fund` — installs `html2canvas`; lockfile updates.
- `cd frontend && npm run test -- --run src/lib/export/pngCard.test.ts src/lib/export/shared.test.ts` — expect 5/5 + 12/12.
- `cd frontend && npm run check` — 0/0.

**Commit message:**
```
P4f Task 1: ship lib/export/pngCard + buildBinaryFilename helper + 9 tests

lib/export/shared.ts: add buildBinaryFilename(format, now, opts) — the
binary sibling to buildFilename. Drives 'predictions-log-…',
'predictions-gw{N}-…', 'predictions-{matchId}-…' filename shapes via a
discriminated union on opts.kind. +4 tests in shared.test.ts.

lib/export/pngCard.ts: capturePngCard (lazy-imports html2canvas, scales
the target DOM to 1080×{1080|1920} via opts.kind, returns a PNG Blob)
+ exportPngCard (side-effecting wrapper that calls
triggerBlobDownload). +5 tests, all of which mock html2canvas and the
target HTMLElement's offsetWidth/offsetHeight (jsdom doesn't compute
real layout).

Adds html2canvas@^1.4.1 to dependencies — first runtime dep added by
the redesign. Lazy import keeps the lib out of the initial bundle.

Untagged auto-gated sub-slice — v3.13 reserved for the full P4f slice
when Task 3 wires the screen buttons + ralph stops for the human
sweep on actual generated output quality.
```

### Task 2 — `lib/export/pdf.ts` + tests *(auto-gated sub-step; adds `jspdf` dep)*

PDF document builder. Lazy-imports `html2canvas` AND `jspdf`; instantiates a landscape A4 doc; places the canvas as a page-fill image; draws the spec footer. Wrapper triggers download via `doc.output('blob')` + `triggerBlobDownload`.

**Files created:**
- `frontend/src/lib/export/pdf.ts`
- `frontend/src/lib/export/pdf.test.ts`

**Files modified:**
- `frontend/package.json` — add `"jspdf": "^2.5.2"` to `dependencies`. Run `npm install --no-audit --no-fund` at task start.

**Implementation template — `pdf.ts`:**

```ts
import {
  buildBinaryFilename,
  triggerBlobDownload,
  MODEL_VERSION,
} from './shared';

export type PdfKind = 'log' | 'this-week';

export interface PdfOpts {
  kind: PdfKind;
  gameweek?: number;
}

export interface JsPdfDocLike {
  addImage: (...args: unknown[]) => void;
  text: (...args: unknown[]) => void;
  output: (kind: 'blob') => Blob;
  save: (filename: string) => void;
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
}

function buildFooterText(opts: PdfOpts): string {
  const tail =
    opts.kind === 'this-week'
      ? `Predictions for GW${opts.gameweek}`
      : 'Predictions Log';
  return `Premier League Oracle · Model ${MODEL_VERSION} · ${tail}`;
}

export async function buildPdfDocument(
  target: HTMLElement,
  opts: PdfOpts & { now?: Date },
): Promise<JsPdfDocLike> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(target, {
    backgroundColor: null,
    useCORS: true,
    allowTaint: false,
    scale: 2, // 2× for print-clarity at A4 landscape
  });
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as unknown as JsPdfDocLike;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.addImage(canvas, 'PNG', 0, 0, w, h);
  doc.text(buildFooterText(opts), w / 2, h - 5, { align: 'center' });
  return doc;
}

export async function exportPdf(
  opts: PdfOpts & { target: HTMLElement; now?: Date },
): Promise<void> {
  const doc = await buildPdfDocument(opts.target, opts);
  const blob = doc.output('blob');
  const now = opts.now ?? new Date();
  const filenameOpts = opts.kind === 'log'
    ? { kind: 'log' as const }
    : { kind: 'this-week' as const, gameweek: opts.gameweek };
  const filename = buildBinaryFilename('pdf', now, filenameOpts);
  triggerBlobDownload(blob, filename);
}
```

**Test coverage targets — `pdf.test.ts` (5 tests):**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as shared from './shared';

const fakeBlob = new Blob(['fake-pdf'], { type: 'application/pdf' });
const docMock = {
  addImage: vi.fn(),
  text: vi.fn(),
  output: vi.fn(() => fakeBlob),
  save: vi.fn(),
  internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
};

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({ toBlob: () => {} })),
}));

vi.mock('jspdf', () => ({
  default: vi.fn(() => docMock),
}));

describe('export/pdf', () => {
  let target: HTMLElement;
  beforeEach(() => {
    vi.clearAllMocks();
    docMock.addImage.mockClear();
    docMock.text.mockClear();
    docMock.output.mockClear();
    target = document.createElement('div');
    Object.defineProperty(target, 'offsetWidth', { value: 800, configurable: true });
    Object.defineProperty(target, 'offsetHeight', { value: 600, configurable: true });
    document.body.appendChild(target);
  });

  it('buildPdfDocument lazy-imports html2canvas + jspdf and places the canvas page-fill', async () => {
    const { buildPdfDocument } = await import('./pdf');
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    const doc = await buildPdfDocument(target, { kind: 'this-week', gameweek: 35 });
    expect(html2canvas).toHaveBeenCalledOnce();
    expect(jsPDF).toHaveBeenCalledWith({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    expect(doc.addImage).toHaveBeenCalledOnce();
    const addImageArgs = (doc.addImage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(addImageArgs[2]).toBe(0); // x
    expect(addImageArgs[3]).toBe(0); // y
    expect(addImageArgs[4]).toBe(297); // w (A4 landscape)
    expect(addImageArgs[5]).toBe(210); // h
  });

  it('buildPdfDocument draws the ThisWeek footer with gameweek number', async () => {
    const { buildPdfDocument } = await import('./pdf');
    const doc = await buildPdfDocument(target, { kind: 'this-week', gameweek: 35 });
    const textCall = (doc.text as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(textCall[0]).toBe('Premier League Oracle · Model v3.5-MVP · Predictions for GW35');
  });

  it('buildPdfDocument draws the Log footer (no gameweek)', async () => {
    const { buildPdfDocument } = await import('./pdf');
    const doc = await buildPdfDocument(target, { kind: 'log' });
    const textCall = (doc.text as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(textCall[0]).toBe('Premier League Oracle · Model v3.5-MVP · Predictions Log');
  });

  it('exportPdf composes buildPdfDocument + triggerBlobDownload (Log filename)', async () => {
    const { exportPdf } = await import('./pdf');
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    await exportPdf({ kind: 'log', target, now: new Date(2026, 3, 28) });
    const [blob, filename] = downloadSpy.mock.calls[0];
    expect((blob as Blob).type).toBe('application/pdf');
    expect(filename).toBe('predictions-log-2026-04-28.pdf');
    downloadSpy.mockRestore();
  });

  it('exportPdf emits gameweek-stamped filename for ThisWeek', async () => {
    const { exportPdf } = await import('./pdf');
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    await exportPdf({
      kind: 'this-week', gameweek: 35, target,
      now: new Date(2026, 3, 28),
    });
    const [, filename] = downloadSpy.mock.calls[0];
    expect(filename).toBe('predictions-gw35-2026-04-28.pdf');
    downloadSpy.mockRestore();
  });
});
```

**TDD-discipline check:** all 5 tests fail pre-fix at module-load. Post-fix: 5/5 pass.

**Validation:**
- `cd frontend && npm install --no-audit --no-fund` — installs `jspdf`; lockfile updates.
- `cd frontend && npm run test -- --run src/lib/export/pdf.test.ts src/lib/export/pngCard.test.ts src/lib/export/shared.test.ts src/lib/export/csv.test.ts src/lib/export/markdown.test.ts` — expect 5 + 5 + 12 + 6 + 6 = 34/34 across the export sub-tree.
- `cd frontend && npm run check` — 0/0.

**Commit message:**
```
P4f Task 2: ship lib/export/pdf builder + exportPdf wrapper + 5 tests

lib/export/pdf.ts: buildPdfDocument (lazy-imports html2canvas + jspdf,
captures the target DOM, instantiates an A4 landscape doc, places the
canvas page-fill, draws the spec footer "Premier League Oracle · Model
v3.5-MVP · {label}") + exportPdf (side-effecting wrapper that converts
the doc to a Blob via doc.output('blob') and triggers download).

Footer label is "Predictions for GW{N}" for ThisWeek surfaces and
"Predictions Log" for Log. Filename uses 'log' or 'gw{N}' prefix per
buildBinaryFilename's discriminated union.

Adds jspdf@^2.5.2 to dependencies — second (and final for the v3
redesign) runtime dep added by the binary export slice. Lazy import
keeps the lib out of the initial bundle.

Untagged auto-gated sub-slice — v3.13 reserved for the full P4f slice
when Task 3 wires the screen buttons.
```

### Task 3 — Wire the buttons on Log + ThisWeek, update screen tests *(manual-gated, closes the slice)*

Replace the placeholder buttons with active ones; add element-bind refs to the capture targets; add disabled-state guards so empty-state captures can't trigger. **Manual-gated** — ralph commits when `npm run check` is clean and vitest is green, then stops with a paragraph summary. Human applies tag `v3.13` after sweeping the actual generated PDF + PNG output for visual quality.

**Files modified:**
- `frontend/src/screens/predictions/Log.svelte` — drop `data-export-placeholder`, `disabled`, `aria-disabled`, `cursor-not-allowed opacity-60` from the PDF button (lines 36–45); add `on:click={() => exportPdf({ kind: 'log', target: logTableEl })}`; add `disabled={!hasFilteredRows}` so empty-state can't trigger. Add `bind:this={logTableEl}` to the `[data-log-table]` div (line 68 already exists). Add `import { exportPdf } from '../../lib/export/pdf';` and `let logTableEl: HTMLElement | undefined;` to the script block. Style classes flip to active (`bg-primary text-primary-foreground hover:bg-primary/90`).
- `frontend/src/screens/predictions/ThisWeek.svelte` — same treatment for both PDF + PNG buttons (lines 41–60). Click handlers: `() => exportPdf({ kind: 'this-week', target: gridEl, gameweek: currentGw ?? 0 })` and `() => exportPngCard({ kind: 'gw-grid', target: gridEl, gameweek: currentGw ?? 0 })`. Disabled-state: `disabled={!loaded || currentGw === null || gwFixtures.length === 0 || !gridEl}`. Add `bind:this={gridEl}` to the `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">` (line 73). Imports: `import { exportPdf } from '../../lib/export/pdf';`, `import { exportPngCard } from '../../lib/export/pngCard';`, `let gridEl: HTMLElement | undefined;`.
- `frontend/src/screens/predictions/Log.test.ts` — replace the lines 47–61 "2 active + 1 PDF placeholder" assertion with "3 active export buttons" (no `data-export-placeholder`, no `disabled` when rows present). Add 1 click-handler test asserting `exportPdf` is called when the populated-rows-mock-state PDF button is clicked. Final test count: 8.
- `frontend/src/screens/predictions/ThisWeek.test.ts` — replace the lines 100–119 "2 placeholder buttons" assertion with "2 active buttons after fixtures load." Add 1 click-handler test asserting `exportPdf` is called on PDF click and `exportPngCard` on PNG click (one combined test using two `fireEvent.click`s for compactness). Final test count: 6.

**Implementation template — `Log.svelte` PDF button block (replaces lines 36–45):**

```svelte
<button
  type="button"
  class="ml-2 text-body-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded px-3 py-1.5"
  data-export="pdf"
  disabled={!hasFilteredRows || logTableEl === undefined}
  on:click={() => logTableEl && exportPdf({ kind: 'log', target: logTableEl })}
>
  Export PDF
</button>
```

**Implementation template — `ThisWeek.svelte` button block (replaces lines 41–60):**

```svelte
<button
  type="button"
  class="text-body-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded px-3 py-1.5"
  data-export="pdf"
  disabled={!loaded || currentGw === null || gwFixtures.length === 0 || !gridEl}
  on:click={() => gridEl && currentGw !== null && exportPdf({ kind: 'this-week', target: gridEl, gameweek: currentGw })}
>
  Export PDF
</button>
<button
  type="button"
  class="ml-2 text-body-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded px-3 py-1.5"
  data-export="png"
  disabled={!loaded || currentGw === null || gwFixtures.length === 0 || !gridEl}
  on:click={() => gridEl && currentGw !== null && exportPngCard({ kind: 'gw-grid', target: gridEl, gameweek: currentGw })}
>
  Share PNG
</button>
```

**Test mocks pattern — `Log.test.ts`:**

```ts
vi.mock('../../lib/export/pdf', () => ({ exportPdf: vi.fn() }));

it('renders 3 active export buttons (CSV + PDF + Markdown)', async () => {
  const { predictionTracker } = await import('../../services/predictionTracker');
  (predictionTracker.getRecentPredictions as ReturnType<typeof vi.fn>).mockReturnValueOnce([
    /* one populated row so hasFilteredRows is true */
  ]);
  const { container } = render(Log);
  const csvBtn = container.querySelector('[data-export="csv"]');
  const pdfBtn = container.querySelector('[data-export="pdf"]');
  const mdBtn = container.querySelector('[data-export="markdown"]');
  expect(csvBtn?.hasAttribute('data-export-placeholder')).toBe(false);
  expect(pdfBtn?.hasAttribute('data-export-placeholder')).toBe(false);
  expect(mdBtn?.hasAttribute('data-export-placeholder')).toBe(false);
});

it('PDF button click calls exportPdf with the log-table element', async () => {
  const { exportPdf } = await import('../../lib/export/pdf');
  const { predictionTracker } = await import('../../services/predictionTracker');
  (predictionTracker.getRecentPredictions as ReturnType<typeof vi.fn>).mockReturnValueOnce([
    /* populated row */
  ]);
  const { container } = render(Log);
  const pdfBtn = container.querySelector('[data-export="pdf"]') as HTMLButtonElement;
  await fireEvent.click(pdfBtn);
  expect(exportPdf).toHaveBeenCalledOnce();
  const [opts] = (exportPdf as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(opts.kind).toBe('log');
  expect(opts.target).toBeInstanceOf(HTMLElement);
});
```

**Test mocks pattern — `ThisWeek.test.ts`:**

```ts
vi.mock('../../lib/export/pdf', () => ({ exportPdf: vi.fn() }));
vi.mock('../../lib/export/pngCard', () => ({ exportPngCard: vi.fn() }));

it('renders [Export PDF] and [Share PNG] as active buttons after fixtures load', async () => {
  const { dataService } = await import('../../services/dataService');
  (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
    mkUpcomingMatch('m1', 35, 2),
  ]);
  const { container, component } = render(ThisWeek);
  await (component as { load(): Promise<void> }).load();
  await act();
  const placeholders = container.querySelectorAll('[data-export-placeholder]');
  expect(placeholders).toHaveLength(0);
  const pdfBtn = container.querySelector('[data-export="pdf"]');
  const pngBtn = container.querySelector('[data-export="png"]');
  expect(pdfBtn?.hasAttribute('disabled')).toBe(false);
  expect(pngBtn?.hasAttribute('disabled')).toBe(false);
});

it('PDF + PNG button clicks call exportPdf + exportPngCard with the grid element', async () => {
  const { exportPdf } = await import('../../lib/export/pdf');
  const { exportPngCard } = await import('../../lib/export/pngCard');
  const { dataService } = await import('../../services/dataService');
  (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
    mkUpcomingMatch('m1', 35, 2),
  ]);
  const { container, component } = render(ThisWeek);
  await (component as { load(): Promise<void> }).load();
  await act();
  await fireEvent.click(container.querySelector('[data-export="pdf"]') as HTMLButtonElement);
  await fireEvent.click(container.querySelector('[data-export="png"]') as HTMLButtonElement);
  expect(exportPdf).toHaveBeenCalledOnce();
  expect(exportPngCard).toHaveBeenCalledOnce();
});
```

**Pre-flight checks before Task 3 starts:**

1. `grep -rn "data-export-placeholder" frontend/src/screens/predictions/` — confirm 3 hits (Log: pdf; ThisWeek: pdf + png). Task 3 removes all three. Final state: 0 hits.
2. `grep -rn "data-export=\"pdf\"\|data-export=\"png\"" frontend/src/screens/predictions/` — confirm Log keeps `data-export="pdf"` (now active) and ThisWeek keeps `data-export="pdf"` + `data-export="png"` (both now active).
3. `grep -E "html2canvas|jspdf" frontend/package.json` — confirm both deps present (Tasks 1 + 2 added them).
4. Run `frontend/src/lib/export/*.test.ts` once before touching screens — expect all PNG/PDF/shared/csv/markdown tests green from the post-Task-2 baseline.

**TDD-discipline check:** new screen-level tests fail pre-fix because the buttons still have `data-export-placeholder`. Post-fix: tests pass and the placeholder-attribute assertions in the old tests no longer match, so they're updated in the same commit (this is the swap, not net-new). Net test deltas: Log `+1` (final 8), ThisWeek `+1` (final 6).

**Validation:**
- `cd frontend && npm run test -- --run` — expect **896–897/896–897 across 76 files** (was 884/884 across 74 post-P4e; +9 PNG/shared from Task 1, +5 PDF from Task 2, +2 net screen-test deltas from Task 3, +2 new files (`pngCard.test.ts`, `pdf.test.ts`)). Verify the actual count and update the discovery note to match — tolerance ±2.
- `cd frontend && npm run check` — 0/0.
- `cd frontend && npx playwright test --project=desktop-chrome routing.spec.ts` — 32/32 green. The button-wiring change is invisible to routing-level assertions, so the suite stays unaffected.
- **Manual sweep checklist (recorded in `## Notes / discoveries` for the human to walk):**
  1. Visit `/predictions/this-week` with at least 3 fixtures rendered. Click `[Export PDF]`. Verify: a `predictions-gw{N}-YYYY-MM-DD.pdf` file downloads. Open it. Verify: A4 landscape, single page, full-bleed image of the GW grid, footer reads "Premier League Oracle · Model v3.5-MVP · Predictions for GW{N}". Confirm: gradient bleeds on emphasised cards render without artifacts (the spec-line-722 risk row).
  2. Same screen, click `[Share PNG]`. Verify: a `predictions-gw{N}-YYYY-MM-DD.png` file downloads. Open it. Verify: 1080-wide image, vertical orientation showing the GW grid. Confirm: image is shareable on Instagram Stories without aspect-fill letterboxing (9:16 ratio).
  3. Visit `/predictions/log` with at least 3 settled predictions. Click `[Export PDF]`. Verify: a `predictions-log-YYYY-MM-DD.pdf` file downloads. Open it. Footer reads "Premier League Oracle · Model v3.5-MVP · Predictions Log".
  4. Empty-state guard: visit `/predictions/log` with **no** stored predictions. Verify the PDF button is disabled (greyed out, not clickable). Same on `/predictions/this-week` when `gwFixtures.length === 0`.
  5. Theme parity: toggle dark/light theme on each surface and re-export. Verify the captured PDF/PNG matches the on-screen theme (dark export when dark mode is active).
  6. Mobile viewport (`<1024px`): both surfaces should still allow export. Verify the captured grid renders the single-column mobile layout, not an artificially-widened desktop layout. Mobile is the more demanding case for the html2canvas scale calculation.
  7. Bundle-size check (Lighthouse, optional): confirm initial JS bundle did not grow by ~600KB — the lazy `import()`s should keep `html2canvas` + `jspdf` in their own async chunks. Open DevTools Network tab, hard-refresh `/today`, verify no `html2canvas` or `jspdf` requests in the initial page load. Then click `[Export PDF]` on `/predictions/log` — the chunks should load on demand.
- **Sign-off action:** flip P4f's `[ ]` → `[x]` in the Phase 3 checklist, then `git tag v3.13 <P4f-Task-3-commit-sha>`. Next slice is **P4-cp — Predictions checkpoint** — plan grooming first, since `p4-cp-…md` doesn't exist yet.

**Files to commit (Task 3 only — Tasks 1 + 2 already shipped their artefacts):**
- `frontend/src/screens/predictions/Log.svelte` (PDF button rewire + 1 import + 1 ref)
- `frontend/src/screens/predictions/Log.test.ts` (assertion swap + 1 new test)
- `frontend/src/screens/predictions/ThisWeek.svelte` (PDF + PNG button rewires + 2 imports + 1 ref)
- `frontend/src/screens/predictions/ThisWeek.test.ts` (assertion swap + 1 new test)
- `IMPLEMENTATION_PLAN.md` (Active phase narrative + checklist `[ ] → [x]` for P4f + discovery note + tag note)

**Commit message (Task 3):**
```
P4f Task 3: wire PDF + PNG export buttons on Log + ThisWeek

screens/predictions/Log.svelte: replace [Export PDF] placeholder with
active version. bind:this={logTableEl} on the data-log-table div lets
the click handler pass the rendered table to exportPdf({ kind: 'log',
target: logTableEl }). Disabled when hasFilteredRows is false so empty
state can't trigger an empty PDF.

screens/predictions/ThisWeek.svelte: same treatment for [Export PDF]
and [Share PNG] buttons. bind:this={gridEl} on the GW grid div;
click handlers pass the grid element to exportPdf({ kind: 'this-week',
... }) / exportPngCard({ kind: 'gw-grid', ... }) with the current
gameweek. Disabled when no fixtures rendered.

Tests: Log.test.ts + ThisWeek.test.ts each gain one click-handler
assertion (mocked exportPdf / exportPngCard). Existing
data-export-placeholder assertions are swapped for active-button
assertions in the same commit.

Closes P4f. vitest <count>/<count>, svelte-check 0/0, Playwright
routing 32/32 on desktop-chrome (route surfaces unchanged — only
the button payloads differ).

Manual-gated — ralph stops awaiting human sweep on the actual
generated PDF/PNG output for visual-quality sign-off. Tag v3.13
applied after sweep.
```

**Discovery note template (append to `## Notes / discoveries` in `IMPLEMENTATION_PLAN.md` after Task 3):**

```md
- **(P4f, awaiting human sweep)** P4f Task 3 (manual-gated, closes the slice) landed: lib/export/{pngCard,pdf}.ts shipped with their tests in earlier sub-slices, and the [Export PDF] button on /predictions/log + the [Export PDF] / [Share PNG] buttons on /predictions/this-week are now active. Click handlers lazy-import html2canvas + jspdf and pass the rendered DOM (logTableEl on Log; gridEl on ThisWeek) to the wrappers. Disabled-state guards added so empty-state captures can't trigger. Filenames: predictions-log-YYYY-MM-DD.pdf, predictions-gw{N}-YYYY-MM-DD.{pdf,png}. PDF footer "Premier League Oracle · Model v3.5-MVP · {label}" per spec. PNG card 1080×1920 portrait for gw-grid (Instagram Story aspect). vitest <count>/<count> across <files> files, svelte-check 0/0, Playwright routing 32/32 on desktop-chrome. Manual sweep checklist: 7 items in the slice plan covering visual fidelity, empty-state guards, theme parity, mobile layout, and lazy-bundle verification. Tag v3.13 applied at sign-off.
- **(P4f deviations from plan)** [Ralph fills this in based on actual deviations.]
- **(P4f follow-ups)**
  - **(open — triggered by sweep)** If gradient-bleed quality on the emphasised hero card is bad on the captured PDF, escalate to the spec-line-560 fallback: implement a `/print/predictions/[gw]` route + headless Playwright capture as a backend route. Plan grooming for that fallback would be its own slice (P4f-fallback-print-route). Do NOT pre-emptively add the fallback — only if the sweep flags real visual issues.
  - **(open — triggered by sweep)** If the spec-line-558 "all sections expanded" requirement turns out to matter (the human sweep will reveal whether the user-controlled current-state capture is rich enough), implement an offscreen "print copy" of the GW grid with `defaultOpen={['analyse', 'probabilities', 'form', 'context']}` on every MatchCard. Render hidden, capture, unmount. P4f-followup slice.
  - **(open)** Multi-page PDF pagination if the GW grid is taller than fits one A4 landscape page legibly. Single-page scale-to-fit was P4f's first ship; if a 10-fixture grid renders too small, the follow-up adds pagination logic to `pdf.ts` (split canvas at A4-height boundaries, multiple `addImage` calls).
  - **(open)** "Copy image to clipboard" for the PNG card — only if user feedback asks for it. Spec prescribes download-only.
  - **(open)** Bundle-size verification — sweep step 7 confirms `html2canvas` + `jspdf` stay out of the initial bundle via Vite code-splitting. If they leak in (a stray static import somewhere), open a P10-followup to track down and convert to lazy.
  - **(open)** P9b's mobile match deep-dive `[Share PNG]` button (route `/match/[id]`) reuses `exportPngCard({ kind: 'single-fixture', matchId, target })` directly. The helper supports it; only the screen wiring is missing. Will be addressed when P9b lands in Phase 4.
```

## Auto-gated tagging note

P4f is **manual-gated**. Sub-slice tasks 1 + 2 are auto-gated (untagged commits — `v3.13` is reserved for the slice's manual sign-off). Task 3's commit is also untagged at commit-time; the human applies `git tag v3.13 <Task-3-commit-sha>` at the moment they flip the `[ ]` → `[x]` after the manual sweep. This matches the manual-gated tagging policy in `IMPLEMENTATION_PLAN.md`'s Active phase narrative (refined 2026-04-26 after Phase 2 sign-off).
