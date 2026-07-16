// One-shot broadsheet prompt + JSON shape. K1e is the primary consumer; this
// file ships now so /api/broadsheet has a typed contract to return.

import type { PersonaConfig } from '$lib/personas';
import type { KickerContext } from '$lib/context/types';
import type { SeasonRecord } from '$lib/fixtures/leagueHistory';
import type { SeasonStats } from '$lib/data/statsPack';
import { describeAccuracy } from './accuracyLine';

export interface BroadsheetSection {
  heading: string;
  body: string;
}

export interface BroadsheetJson {
  headline: string;
  standfirst: string;
  byline: string;
  sections: BroadsheetSection[];
  pullQuote?: string;
  closingLine?: string;
}

export function buildBroadsheetPrompt(
  persona: PersonaConfig,
  gameweek: number,
  context: KickerContext
): { system: string; userMessage: string } {
  const fixtureSummary = context.fixtures
    .slice(0, 10)
    .map(
      (f) =>
        `- ${f.home} v ${f.away}: model ${Math.round(f.ourProb.home * 100)}/${Math.round(
          f.ourProb.draw * 100
        )}/${Math.round(f.ourProb.away * 100)}` +
        (f.valueEdge !== undefined ? ` (edge ${(f.valueEdge * 100).toFixed(1)}pp)` : '')
    )
    .join('\n');

  const system = `${persona.systemPrompt}

You are writing the Gameweek ${gameweek} broadsheet column for The Kicker. Stay
in character (${persona.voice}). Use the model context below for facts; never
invent fixtures or numbers.

LIVE MODEL CONTEXT:
${fixtureSummary || '(no fixtures available)'}
Model accuracy: ${describeAccuracy(context.accuracyStats)}

OUTPUT FORMAT — return ONLY a single JSON object, no prose, no code fences:
{
  "headline": string,
  "standfirst": string,
  "byline": string,
  "sections": [{ "heading": string, "body": string }, ...],
  "pullQuote": string,
  "closingLine": string
}`;

  const userMessage = `Write the Gameweek ${gameweek} broadsheet now. JSON only.`;

  return { system, userMessage };
}

export function buildSeasonVerdictPrompt(
  persona: PersonaConfig,
  season: string,
  record: SeasonRecord | undefined,
  seasonStats: SeasonStats | undefined
): { system: string; userMessage: string } {
  const championLine = record?.champion
    ? `Champion: ${record.champion.team} on ${record.champion.points} pts (GD ${record.champion.goalDifference >= 0 ? '+' : ''}${record.champion.goalDifference}).`
    : record?.inProgress
      ? 'This season is still in progress — no champion yet.'
      : 'Champion data not on file.';
  const runnerUpLine = record?.runnerUp
    ? `Runner-up: ${record.runnerUp.team} on ${record.runnerUp.points} pts.`
    : '';
  const statsLine = seasonStats
    ? `Stats: ${seasonStats.matches} matches, ${seasonStats.avgTotalGoals.toFixed(2)} goals/match, home win rate ${Math.round(seasonStats.homeWinRate * 100)}%, BTTS ${Math.round(seasonStats.bttsRate * 100)}%.`
    : '';
  const anomalyLine =
    seasonStats?.isAnomalous && seasonStats.anomalyReasons.length > 0
      ? `Outlier flags: ${seasonStats.anomalyReasons.join('; ')}.`
      : '';

  const factLines = [championLine, runnerUpLine, statsLine, anomalyLine].filter(Boolean).join('\n');

  const system = `${persona.systemPrompt}

You are filing a single-paragraph verdict on the ${season} Premier League season for The Kicker archive. Stay in character (${persona.voice}). Use only the facts below; never invent stats. Keep it tight: 80–140 words, one paragraph of plain prose, no headings, no surrounding quotation marks.

SEASON FACTS:
${factLines}`;

  const userMessage = `File your verdict on the ${season} season now. One paragraph, plain prose only.`;

  return { system, userMessage };
}

export interface FixtureAnalysisFixture {
  home: string;
  away: string;
  kickoff?: string;
  venue?: string;
}

export interface FixtureAnalysisPrediction {
  ensemble: { home: number; draw: number; away: number };
  pick: 'HOME' | 'DRAW' | 'AWAY';
  pickConfidence: number;
  keyFactors?: string[];
}

export function buildFixtureAnalysisPrompt(
  persona: PersonaConfig,
  fixture: FixtureAnalysisFixture,
  prediction: FixtureAnalysisPrediction
): { system: string; userMessage: string } {
  const pct = (n: number): string => `${Math.round(n * 100)}`;
  const pickTeam =
    prediction.pick === 'HOME' ? fixture.home : prediction.pick === 'AWAY' ? fixture.away : 'a draw';
  const factorsLine =
    prediction.keyFactors && prediction.keyFactors.length > 0
      ? `Key factors the model is leaning on: ${prediction.keyFactors.slice(0, 4).join('; ')}.`
      : '';
  const venueLine = fixture.venue ? `Venue: ${fixture.venue}.` : '';

  const system = `${persona.systemPrompt}

You are filing a single short paragraph of pre-match analysis on ${fixture.home} v ${fixture.away} for The Kicker match-detail page. Stay in character (${persona.voice}). 60–110 words, one paragraph, plain prose, no headings, no surrounding quotes, no lists.

Hard rules:
- Use only the model facts below. Do not invent stats, injuries, or quotes.
- Never mention betting, odds, value, edges, bookmakers, stakes, or Kelly. This is editorial analysis, not a tip.
- Lean on the model probabilities and the named factors — explain what the engine likes about ${pickTeam} (or why it's split), in your voice.

MODEL FACTS:
- Ensemble probability: ${fixture.home} ${pct(prediction.ensemble.home)}% · draw ${pct(prediction.ensemble.draw)}% · ${fixture.away} ${pct(prediction.ensemble.away)}%.
- Model pick: ${pickTeam} (confidence ${pct(prediction.pickConfidence)}%).
${factorsLine}
${venueLine}`.replace(/\n{2,}\n/g, '\n\n');

  const userMessage = `File your pre-match read on ${fixture.home} v ${fixture.away} now. One paragraph, plain prose only.`;

  return { system, userMessage };
}

export function parseBroadsheetJson(raw: string): BroadsheetJson {
  // Models occasionally wrap JSON in code fences despite instructions; strip
  // them defensively so a well-formed payload isn't lost to ``` chrome.
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const parsed = JSON.parse(stripped);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof parsed.headline !== 'string' ||
    typeof parsed.standfirst !== 'string' ||
    typeof parsed.byline !== 'string' ||
    !Array.isArray(parsed.sections)
  ) {
    throw new Error('Broadsheet JSON missing required fields');
  }
  return parsed as BroadsheetJson;
}
