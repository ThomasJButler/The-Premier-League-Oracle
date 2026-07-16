/**
 * Rendering for backtest results: a console league table for humans and a
 * deterministic JSON artefact for git.
 *
 * The JSON is a pure function of code + data + config — sorted keys, fixed
 * precision, no timestamps — so `git diff` on the committed results file IS
 * the regression review. Raw per-match records are stripped (they would be
 * megabytes); calibration curves and weight fitting consume them in-process.
 */

import type { MetricSummary } from '../engine/metrics';
import type { AdapterResult, BacktestReport } from './walkForward';

const HEADLINE_COLS = ['n', 'RPS', 'Brier', 'LogLoss', 'Acc', 'DrawPick', 'DrawRecall'] as const;

function rowFor(name: string, s: MetricSummary): string[] {
  return [
    name,
    String(s.n),
    s.rps.toFixed(4),
    s.brier.toFixed(4),
    s.logLoss.toFixed(4),
    (s.accuracy * 100).toFixed(1) + '%',
    (s.drawPredictedRate * 100).toFixed(1) + '%',
    (s.outcomes.D.recall * 100).toFixed(1) + '%',
  ];
}

/** Console league table, adapters sorted by RPS (lower = better = top). */
export function renderLeagueTable(report: BacktestReport): string {
  const sorted = [...report.adapters].sort((a, b) => a.overall.rps - b.overall.rps);
  const rows = [
    ['model', ...HEADLINE_COLS] as string[],
    ...sorted.map((a) => rowFor(a.name, a.overall)),
  ];
  const widths = rows[0].map((_, col) => Math.max(...rows.map((r) => r[col].length)));
  const lines = rows.map((r) => r.map((cell, col) => cell.padEnd(widths[col] + 2)).join('').trimEnd());
  lines.splice(1, 0, '-'.repeat(lines[0].length));

  const header =
    `Walk-forward ${report.evalFromSeason} → ${report.evalToSeason}` +
    ` (${report.evalMatches} matches; n < that = abstentions)`;
  return [header, '', ...lines].join('\n');
}

/** Per-season RPS breakdown for one adapter vs another (gate evidence). */
export function renderSeasonComparison(a: AdapterResult, b: AdapterResult): string {
  const seasons = [...new Set([...Object.keys(a.perSeason), ...Object.keys(b.perSeason)])].sort();
  const lines = [`season       ${a.name.padEnd(12)}${b.name.padEnd(12)}winner`];
  for (const season of seasons) {
    const ra = a.perSeason[season]?.rps;
    const rb = b.perSeason[season]?.rps;
    const winner = ra === undefined || rb === undefined ? '—' : ra < rb ? a.name : rb < ra ? b.name : 'tie';
    lines.push(
      `${season}    ${ra?.toFixed(4).padEnd(12) ?? '—'.padEnd(12)}${rb?.toFixed(4).padEnd(12) ?? '—'.padEnd(12)}${winner}`
    );
  }
  return lines.join('\n');
}

/** Round every number to 6 dp so float noise can't dirty the git diff. */
function round6(value: number): number {
  return Number(value.toFixed(6));
}

function serializeSummary(s: MetricSummary): Record<string, unknown> {
  return {
    accuracy: round6(s.accuracy),
    brier: round6(s.brier),
    drawPredictedRate: round6(s.drawPredictedRate),
    logLoss: round6(s.logLoss),
    n: s.n,
    outcomes: {
      A: { ...s.outcomes.A, precision: round6(s.outcomes.A.precision), recall: round6(s.outcomes.A.recall) },
      D: { ...s.outcomes.D, precision: round6(s.outcomes.D.precision), recall: round6(s.outcomes.D.recall) },
      H: { ...s.outcomes.H, precision: round6(s.outcomes.H.precision), recall: round6(s.outcomes.H.recall) },
    },
    rps: round6(s.rps),
  };
}

/** JSON.stringify with recursively sorted keys — byte-identical across runs. */
export function stableStringify(value: unknown, indent = 2): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])])
      );
    }
    return v;
  };
  return JSON.stringify(sortKeys(value), null, indent) + '\n';
}

/** The committed results artefact: summaries only, records stripped. */
export function serializeReport(report: BacktestReport): string {
  return stableStringify({
    evalFromSeason: report.evalFromSeason,
    evalToSeason: report.evalToSeason,
    evalMatches: report.evalMatches,
    models: Object.fromEntries(
      report.adapters.map((a) => [
        a.name,
        {
          overall: serializeSummary(a.overall),
          perSeason: Object.fromEntries(
            Object.entries(a.perSeason).map(([season, s]) => [season, serializeSummary(s)])
          ),
        },
      ])
    ),
  });
}
