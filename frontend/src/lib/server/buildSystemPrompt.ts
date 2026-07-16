// Compose the per-request system prompt: persona voice + live model context.
// Kept pure + sync so a unit test can assert that ourProb / valueEdge actually
// reach the prompt string — a contract the moat depends on.

import type { PersonaConfig } from '$lib/personas';
import type { KickerContext } from '$lib/context/types';
import { describeAccuracy } from './accuracyLine';

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const signedPp = (x: number): string => {
  const pp = (x * 100).toFixed(1);
  return x >= 0 ? `+${pp}pp` : `${pp}pp`;
};

export function buildSystemPrompt(persona: PersonaConfig, context: KickerContext): string {
  const fixtureLines = context.fixtures.map((f) => {
    const ours = `H ${pct(f.ourProb.home)} / D ${pct(f.ourProb.draw)} / A ${pct(f.ourProb.away)}`;
    const market = f.marketImplied
      ? ` | market H ${pct(f.marketImplied.home)} / D ${pct(f.marketImplied.draw)} / A ${pct(f.marketImplied.away)}`
      : '';
    const edge = f.valueEdge !== undefined ? ` | edge ${signedPp(f.valueEdge)}` : '';
    return `- ${f.home} v ${f.away} (${f.kickoff}): ours ${ours}${market}${edge}`;
  });
  const fixturesBlock = fixtureLines.length > 0 ? fixtureLines.join('\n') : '- (no upcoming fixtures available)';

  const standingsLines = context.standings.slice(0, 6).map(
    (row) => `${row.position}. ${row.team} — ${row.points} pts (GD ${row.goalDifference >= 0 ? '+' : ''}${row.goalDifference})`
  );
  const standingsBlock = standingsLines.length > 0 ? `\n\nTop of table:\n${standingsLines.join('\n')}` : '';

  const accuracy = describeAccuracy(context.accuracyStats);

  return `${persona.systemPrompt}

--- LIVE MODEL CONTEXT (${context.generatedAt}) ---
Upcoming fixtures (model probabilities):
${fixturesBlock}${standingsBlock}

Model accuracy so far: ${accuracy}
--- END CONTEXT ---

--- INLINE TOKEN FORMATS (use sparingly, only when they earn their keep) ---
When you reference a specific upcoming fixture from the list above, wrap it as [[FIXTURE:HOME-AWAY]] using the three-letter team codes (e.g. [[FIXTURE:ARS-LIV]]) — the UI turns it into a clickable fixture chip.
When you cite a stat that's gloriously useless or wonderfully telling, wrap it as [[CHEERS:stat|label|text]] — for example [[CHEERS:73%|home wins under lights|nights like this favour the brave]] — the UI renders it as a Cheers-Geoff callout.
Only emit these tokens when they fit your voice naturally; never force them, never invent fixtures or stats just to fill the format.
--- END TOKEN FORMATS ---`;
}
