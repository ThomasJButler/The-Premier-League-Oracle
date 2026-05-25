export interface RumourRecord {
  player: string;
  from: string;
  to: string;
  fee: string;
  heat: number;
  macca: string;
}

export const KICKER_RUMOURS: RumourRecord[] = [
  {
    player: 'Florian Wirtz',
    from: 'Bayer Leverkusen',
    to: 'Liverpool',
    fee: '£120m',
    heat: 5,
    macca:
      "To be fair, if they get Wirtz — and to be fair, they might — that's the title sewn up for another three years."
  },
  {
    player: 'Victor Osimhen',
    from: 'Galatasaray',
    to: 'Chelsea',
    fee: '£65m',
    heat: 4,
    macca:
      "He's a handful. Big, quick, scores goals. Chelsea need that. Whether Chelsea know they need that is another question entirely."
  },
  {
    player: 'Declan Rice',
    from: 'Arsenal',
    to: 'Real Madrid',
    fee: '£130m',
    heat: 2,
    macca:
      "That's nonsense, that. He's not going anywhere. To be fair to Arsenal, they'd never sell Rice. Never."
  },
  {
    player: 'Marcus Rashford',
    from: 'Man United',
    to: 'AC Milan',
    fee: '£35m',
    heat: 3,
    macca:
      "Look — sometimes a change of scenery is the right thing. I'm not saying it is. To be fair, I'm not saying it isn't either."
  },
  {
    player: 'Nico Williams',
    from: 'Athletic Club',
    to: 'Barcelona',
    fee: '£58m',
    heat: 4,
    macca:
      "He's brilliant. Absolute quality. But going to Barca now? To be fair, the timing's not ideal for him."
  },
  {
    player: 'Leny Yoro',
    from: 'Man United',
    to: 'PSG',
    fee: '£50m',
    heat: 1,
    macca: "He only just got there. Give the lad a chance. To be fair, he's barely played."
  }
];
