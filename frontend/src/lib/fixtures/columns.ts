import type { PersonaId } from '$lib/personas';

export interface HeadlineSegment {
  text: string;
  /** When true, segment renders inside <em> styled in the persona accent. */
  emphasis?: boolean;
}

export interface ColumnPullQuote {
  body: string;
  attribution: string;
}

export interface ColumnCheers {
  stat: string;
  label: string;
  gloriouslyUseless: string;
}

export interface ColumnRecord {
  slug: string;
  eyebrow: string;
  headline: HeadlineSegment[];
  byline: {
    personaId: PersonaId;
    sub: string;
    readTimeMinutes: number;
    dateline: string;
  };
  /** First paragraph — the renderer renders its first character as a drop-cap. */
  dropCapIntro: string;
  pullQuote: ColumnPullQuote;
  /** Body paragraphs (excluding the drop-cap intro) — flowed into a 2-col grid. */
  body: string[];
  cheers?: ColumnCheers;
}

const COLUMNS: Readonly<Record<string, ColumnRecord>> = {
  'state-of-arsenal': {
    slug: 'state-of-arsenal',
    eyebrow: "STATE OF THE NATION · GUNNERS",
    headline: [
      { text: 'Arsenal are ' },
      { text: 'finally', emphasis: true },
      { text: ' boring — and that is the point.' }
    ],
    byline: {
      personaId: 'voice',
      sub: 'The Voice of the Terraces',
      readTimeMinutes: 4,
      dateline: 'LONDON, FRIDAY'
    },
    dropCapIntro:
      "There was a time when Arsenal would lose 4-3 on a Tuesday and call it character-building. Those days are over, and good riddance. The current side wins ugly, defends like it means it, and treats a clean sheet as the moral high ground.",
    pullQuote: {
      body:
        "Boring is the dress rehearsal for winning. The trophy cabinets of north London have always preferred grey suits to fireworks.",
      attribution: 'THE VOICE'
    },
    body: [
      "Take the last seven matches: five clean sheets, two single-goal wins, one set-piece masterclass that the model rated a 62% home banker before kick-off and the bookmakers rated 51%. That is a four-point spread, and four points across a season is the difference between a parade and an inquiry.",
      "What the model loves about this Arsenal is the variance compression — they win the close ones, they refuse to lose the loose ones, and they have stopped giving away xG from set pieces. That last bit alone is worth a place in the Champions League next April.",
      "The romantics will say it's joyless. The romantics also said Wenger should have stayed. The grown-ups in the room — and the ensemble model is a deeply grown-up room — are watching this side and quietly marking the title race short."
    ],
    cheers: {
      stat: '0.41',
      label: 'XGA PER MATCH',
      gloriouslyUseless:
        "Arsenal have conceded fewer expected goals per match than any side since the 2003/04 Invincibles. The Invincibles also wore short shorts, which is the only meaningful difference."
    }
  },
  'mickey-on-united': {
    slug: 'mickey-on-united',
    eyebrow: 'MICKEY FROM DAGENHAM · DISGRACE BOARD',
    headline: [
      { text: 'United are a ' },
      { text: 'disgrace', emphasis: true },
      { text: ' to the shirt, and I am ' },
      { text: 'enjoying it', emphasis: true },
      { text: '.' }
    ],
    byline: {
      personaId: 'volcano',
      sub: 'Resident apoplectic',
      readTimeMinutes: 3,
      dateline: 'DAGENHAM, SATURDAY'
    },
    dropCapIntro:
      "Right. Pin your ears back. I have just watched Manchester United concede a goal from a throw-in that started in their own half. Their own half. A throw-in. I want you to sit with that for a moment.",
    pullQuote: {
      body:
        "The model has them on a 38% home win rate against bottom-six sides. Thirty-eight per cent. My nan would back herself harder than that.",
      attribution: 'MICKEY'
    },
    body: [
      "The defensive xG is in the gutter, the midfield can't string two passes without taking a knee, and the manager keeps saying 'process' like he's trying to summon a spell. There is no process. There is a payroll, and there is a fixture list, and the two have stopped speaking to each other.",
      "The model — and I trust the model more than I trust anyone in that boardroom — has them as outright favourites in exactly two of their next eight matches. Two. Out of eight. That is not a Champions League squad. That is a mid-table squad with a marketing budget.",
      "I will say this for them: they are entertaining in the way that a kitchen fire is entertaining. You can't look away, you know it's going to get worse before it gets better, and someone is definitely going to lose their deposit."
    ],
    cheers: {
      stat: '38%',
      label: 'WIN RATE V BOTTOM SIX',
      gloriouslyUseless:
        "Manchester United are winning 38% of their matches against bottom-six opposition at home. The historical league baseline for that fixture type is 64%. Make of that what you will, but make of it loudly."
    }
  },
  'macca-on-anfield': {
    slug: 'macca-on-anfield',
    eyebrow: 'MACCA FROM BIRKENHEAD · SCOUSER MODE',
    headline: [
      { text: 'Anfield is still the ' },
      { text: 'loudest place', emphasis: true },
      { text: ' the model cannot price.' }
    ],
    byline: {
      personaId: 'scouser',
      sub: 'Bootroom correspondent',
      readTimeMinutes: 5,
      dateline: 'BIRKENHEAD, SUNDAY'
    },
    dropCapIntro:
      "Listen, lad. The model is a clever thing. It eats expected goals for breakfast, it knows your form, your fatigue, your referee. But it does not know what it sounds like when the Kop sings You'll Never Walk Alone at three in the afternoon with the floodlights on and the title in play.",
    pullQuote: {
      body:
        "Home advantage at Anfield is worth roughly 0.18 goals per match on the model — and probably double that on a European night the bookmakers have never bothered to weight.",
      attribution: 'MACCA'
    },
    body: [
      "The Poisson lane and the ELO lane both rate Liverpool the second-best home side in the league this season. The form lane has them top. The standings lane has them top. Only the head-to-head lane drags them down to second, and that is because Manchester City have spent five years stealing their lunch.",
      "The thing the model gets right — and credit where it's due — is that this Liverpool side is harder to score against at home than they were last season. The xGA per home match is down by a quarter. The clean-sheet rate is up by a third. That is not vibes. That is a back four that has finally learned to defend a corner.",
      "The thing the model gets wrong is the noise. There is no column in the spreadsheet for 'Anfield on a Tuesday night against a side that can't believe they're here.' If there was, the title race would already be over."
    ]
  }
};

export function getColumn(slug: string): ColumnRecord | undefined {
  return COLUMNS[slug];
}

export function listColumns(): ColumnRecord[] {
  return Object.values(COLUMNS);
}

export function listColumnSlugs(): string[] {
  return Object.keys(COLUMNS);
}
