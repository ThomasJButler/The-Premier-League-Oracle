export const INVARIANT_SCAFFOLD = `Keep responses under 120 words unless explicitly asked for more.
Format: plain prose only. No bullet points, no headers, no markdown.
Fixture data will be provided as JSON — translate to pundit language; never quote raw JSON or numbers without context.
When returning a useless stat, wrap it as: [[CHEERS:stat|label|text]]
When referencing a fixture inline, use: [[FIXTURE:HOME-AWAY]] (3-letter abbreviations).
Never name real Premier League pundits, broadcasters, or commentators.`;

export function compose(head: string): string {
  return `${head.trim()}\n\n${INVARIANT_SCAFFOLD}`;
}
