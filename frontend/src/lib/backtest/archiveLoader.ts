/**
 * Node-only loader for the 33-season CSV archive at
 * backend/spreadsheets/KnowledgeFilesCSV/.
 *
 * Read-only filesystem access (readdirSync/readFileSync on a fixed
 * repo-relative directory — same pattern as optimizedPredictions.
 * lambdaValidation.test.ts). No shell, no child processes, no writes.
 * Imported exclusively by tests and env-gated backtest/fit specs — never by
 * browser code.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { parseFootballDataCsv } from './csvArchive';
import type { ArchiveMatch } from './types';

/** frontend/src/lib/backtest → repo root → backend CSV archive. */
const DEFAULT_ARCHIVE_DIR = resolve(
  __dirname,
  '../../../../backend/spreadsheets/KnowledgeFilesCSV'
);

/** Strict season-file shape: EPL{YYYY}{YYYY}.csv — nothing else is read. */
const SEASON_FILE = /^EPL(\d{4})(\d{4})\.csv$/;

export interface LoadArchiveOptions {
  /** Inclusive season bounds as 'YYYY-YYYY' labels (lexicographic-safe). */
  fromSeason?: string;
  toSeason?: string;
  /** Override the archive directory (tests). */
  dir?: string;
}

/**
 * Load and parse the season CSVs in chronological order. Returns matches
 * sorted by kickoff (stable, so same-timestamp rows keep CSV order — ids
 * remain reproducible across runs).
 */
export function loadArchive(opts: LoadArchiveOptions = {}): ArchiveMatch[] {
  const dir = opts.dir ?? DEFAULT_ARCHIVE_DIR;

  const seasons: Array<{ file: string; seasonId: string }> = [];
  for (const file of readdirSync(dir)) {
    const m = SEASON_FILE.exec(file);
    if (!m) continue;
    const seasonId = `${m[1]}-${m[2]}`;
    if (opts.fromSeason && seasonId < opts.fromSeason) continue;
    if (opts.toSeason && seasonId > opts.toSeason) continue;
    seasons.push({ file, seasonId });
  }
  seasons.sort((a, b) => a.seasonId.localeCompare(b.seasonId));

  const all: ArchiveMatch[] = [];
  for (const season of seasons) {
    const text = readFileSync(join(dir, season.file), 'utf-8');
    all.push(...parseFootballDataCsv(text, season.seasonId));
  }
  // Seasons never overlap, but intra-season CSV order is only mostly
  // chronological (postponed fixtures appear at their played date in some
  // files) — a stable sort by kickoff settles it without breaking ids.
  return all.sort((a, b) => a.kickoffISO.localeCompare(b.kickoffISO));
}
