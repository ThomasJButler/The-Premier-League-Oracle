import type { PersonaId } from '$lib/personas';

export interface VoiceTake {
  open: string;
  aside: string;
  pick: string;
  conf: number;
}

export const KICKER_VOICE_TAKES: Record<PersonaId, VoiceTake> = {
  voice: {
    open:
      "Liverpool find themselves at Anfield on Sunday with the air of a team that knows precisely what they're doing — five points clear, Salah in form, a crowd that hasn't known a home defeat since February.",
    aside:
      'Salah has scored in every month containing an R this season. There are eight such months in the Premier League calendar. Cheers, Geoff.',
    pick: 'LIV 2–0',
    conf: 69
  },
  scouser: {
    open:
      "To be fair to Spurs — and I will be fair, I always am — they've shown improvement. But Liverpool's press in those first twenty minutes, the way they lock your full-backs in? There's no answer to that. There isn't.",
    aside: 'And to be fair: their xG over the last twelve home games is 2.4. To be fair.',
    pick: 'LIV 2–0',
    conf: 74
  },
  manc: {
    open:
      "Right, I'll tell you what's wrong with Tottenham. No characters. Nobody who'd run through a wall. The gaffer'd have had 'em in Tuesday morning and they'd have been grateful. Liverpool will take this. Won't even be close.",
    aside: 'United beat Spurs 7-1 in 2001. Since when has anything improved? Nothing. Nothing has improved.',
    pick: 'LIV 3–0',
    conf: 71
  },
  charmer: {
    open:
      "Oh I tell you what — Anfield on a Sunday is gorgeous. The atmosphere, the pitch, both managers, Salah in that red shirt doing those things he does. Just gorgeous. Just absolutely — and I don't use this word lightly — stunning.",
    aside: 'Did you know the grass at Anfield is cut to 23mm? Perfect. Just perfect.',
    pick: 'LIV 3–1',
    conf: 55
  },
  hardman: {
    open:
      "I wouldn't have half of Tottenham's squad in my team. Soft. Liverpool are ruthless and Tottenham aren't, and that's the game. Two-nil, home win, and we don't need to dress it up in anything fancier than that.",
    aside: 'Three Spurs players have been subbed off before the hour mark in their last four away games. Pathetic.',
    pick: 'LIV 2–0',
    conf: 82
  },
  volcano: {
    open:
      'It is an ABSOLUTE DISGRACE that I have to watch this team at Anfield. DISGRACE. Six years old I was when I started following them. SIX. And now they come to Anfield with THAT back four? THAT? Unbelievable. Pathetic.',
    aside:
      "I've watched every Spurs away game at Anfield since 2004. They've won ONE. I've lost count of the years of my life.",
    pick: 'LIV 3–0',
    conf: 91
  },
  wanderer: {
    open:
      "Lovely game, Liverpool. Lovely. I had a centre-half there once, must've been… 2003? 2004? Triffic lad, his dad was the same. Anyway — Anfield, Sunday — triffic stadium, triffic. Salah'll score. Probably.",
    aside: "I once had a full English at a hotel near Anfield. Triffic bacon. Triffic. Can't remember the result.",
    pick: 'LIV 2–1',
    conf: 51
  },
  philosopher: {
    open:
      'Football, in its purest form, is a question posed by the home side. On Sunday, Anfield will ask Tottenham a question about who they are — not as a team, but as a concept. The answer will arrive in the 68th minute.',
    aside: "The number 61 — Liverpool's win probability — is a prime number. The universe, in its way, approves.",
    pick: 'LIV 2–0',
    conf: 61
  },
  chaos: {
    open:
      "UNBELIEVABLE fixture! Liverpool, Tottenham, Anfield — what a day for football! I've got Spurs winning 3-0 in my head, don't ask me why, just a feeling. Could go either way. Could go any way. TRIFFIC.",
    aside: 'UNBELIEVABLE — did you know Anfield was built in 1884? That means it\'s… really old. UNBELIEVABLE.',
    pick: 'TOT 3–0',
    conf: 8
  },
  optimist: {
    open:
      "Friend, let me tell you — Liverpool versus Tottenham at Anfield is a heckuva ballgame. Both coaches grinding tape till 4am, both squads believing. Mo Salah? That guy hits more home runs than anyone in the league. Believe.",
    aside:
      "Fun fact from Coach: Anfield holds 61,000 fans. That's more than the entire population of Wichita's third-largest suburb.",
    pick: 'LIV 2–1',
    conf: 67
  }
};

export function getVoiceTake(id: PersonaId): VoiceTake {
  return KICKER_VOICE_TAKES[id];
}
