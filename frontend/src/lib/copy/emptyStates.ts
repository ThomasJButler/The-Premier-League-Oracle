import type { PersonaId } from '$lib/personas';

export type EmptyStateRoute = 'fixtures' | 'predictions' | 'notifications' | 'broadsheet';

const COPY: Record<EmptyStateRoute, Record<PersonaId, string>> = {
  fixtures: {
    voice: "Between gameweeks — Saturday's a fortnight off.",
    scouser: "Quiet week, that — back to it Saturday, lad.",
    manc: "Nowt on. Saturday'll do.",
    charmer: "Empty diary, darling. Saturday whispers your name.",
    hardman: "Empty card. Stay sharp — Saturday comes round quick.",
    volcano: "NO MATCHES. ABSOLUTE DISGRACE.",
    wanderer: "The pitches rest. So should we, briefly.",
    philosopher: "Absence is a fixture of its own. Saturday returns.",
    chaos: "No games?? FINE I'll just stare at the wall WHATEVER",
    optimist: "Lovely little breather — Saturday'll be a belter!"
  },
  predictions: {
    voice: "Nothing to call this week — picks resume next gameweek.",
    scouser: "Nowt to predict, lad — give it till Saturday.",
    manc: "Empty slate. Model's having a brew.",
    charmer: "No picks to flirt with today. Pity, that.",
    hardman: "No fixtures. No edges. Stay patient.",
    volcano: "NOTHING TO PICK. NOTHING. RIDICULOUS.",
    wanderer: "The model rests between the rounds.",
    philosopher: "No fixtures, no forecasts. The form awaits its data.",
    chaos: "no picks no picks no picks WHY",
    optimist: "Bit of a gap — gives the model time to cook!"
  },
  notifications: {
    voice: "Quiet on the wire. Updates surface here once kickoffs land.",
    scouser: "Wire's gone dead, lad. Soon as kick-off, you'll know.",
    manc: "Wire's quiet. Don't fret about it.",
    charmer: "Inbox empty, darling. We'll buzz when it matters.",
    hardman: "Wire's silent. That's fine. Stay ready.",
    volcano: "NOTHING. NOT A PEEP. UNBELIEVABLE.",
    wanderer: "Silence on the line. The match-day birds will sing soon.",
    philosopher: "Silence, too, is a signal worth noting.",
    chaos: "NOTHING'S HAPPENING WHY ISN'T ANYTHING HAPPENING",
    optimist: "All quiet — beautiful, isn't it? Buzz incoming!"
  },
  broadsheet: {
    voice: "No gameweek on file yet — paper's still at the press.",
    scouser: "Paper's not out yet, lad — give the lads a minute.",
    manc: "Press is cold. Wait for it.",
    charmer: "The broadsheet is still in lipstick, darling.",
    hardman: "Paper's not filed. Discipline. Wait.",
    volcano: "NO PAPER. NO COLUMN. NO COMMENT.",
    wanderer: "The presses sleep. The ink dreams.",
    philosopher: "No edition tonight. The story is still becoming.",
    chaos: "WHERE'S THE PAPER WHERE'S THE PAPER WHERE",
    optimist: "Press is warming up — gonna be a cracker!"
  }
};

export function getEmptyStateCopy(route: EmptyStateRoute, personaId: PersonaId): string {
  return COPY[route][personaId];
}
