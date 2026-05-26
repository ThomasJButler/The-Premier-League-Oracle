import type { BroadsheetJson } from '$lib/server/broadsheetPrompt';

// Hand-crafted, voice-neutral demo broadsheet used when no Football-Data API
// key is configured (so the /broadsheet route never shows a near-empty page on
// the public preview deploy). Byline says "THE KICKER STAFF · SAMPLE EDITION"
// rather than a persona name so we never put words in a persona's mouth that
// they did not generate. Always paired with a "● Sample broadsheet · demo data"
// eyebrow chip in the UI so first-time visitors see clearly that this is not
// live punditry. K2-fix.8.
export const DEMO_BROADSHEET: BroadsheetJson = {
  headline: "The model is reading the room before the room sits down",
  standfirst:
    "Five competing engines, one weighted ensemble, no scoreline bravado — what The Kicker actually does when you feed it a fixture, and why the table is shorter than you think.",
  byline: "THE KICKER STAFF · SAMPLE EDITION",
  sections: [
    {
      heading: "WHAT THE MODEL ACTUALLY SEES",
      body:
        "Every fixture lands in the ensemble five times: an ELO rating built from 33 seasons of league results, a Poisson goal-expectancy model trained on rolling xG, a recent-form decay (last six games, weighted), a head-to-head trend, and a standings-aware prior that nudges the table-leaders without anointing them. The five outputs are not averaged. They are weighted — ELO 25, Poisson 30, Form 20, H2H 10, Standings 15 — and then squashed into honest probability bars. There is no single 'predicted scoreline' because the model does not believe in single scorelines. It believes in distributions, and it tells you exactly how confident it is."
    },
    {
      heading: "WHY THE TOP HALF KEEPS DRIFTING",
      body:
        "The conventional wisdom this season has Liverpool and Arsenal trading blows for the title. The ensemble disagrees, gently. Liverpool's xG-for has slipped a quarter of a goal per game since November while their opponent xG-against has stayed flat — a quiet sign the engine has been picking up for six weeks. Arsenal's set-piece numbers remain absurd (one in every 4.1 corners produces a shot on target) but their open-play creation has cooled. City, meanwhile, are doing the boring thing they always do: 1.8 expected goals per game, 0.9 expected against, and a press-resistance number that has crept up every month. The model has them as title favourites by a margin the talk-radio circuit would call ridiculous."
    },
    {
      heading: "ONE FIXTURE TO WATCH THIS WEEKEND",
      body:
        "Brighton at home to Newcastle is the kind of game the broadcasters will ignore and the ensemble will obsess over. Both sides press, both sides build from the back, both sides have a goalkeeper distribution profile that tilts long when pressed high — which means a lot of second balls in midfield, which means a lot of variance. The model's draw probability for this fixture is 32 percent, which is unusually high. When the engine starts producing draw probabilities above 30, it is telling you something the eye-test will miss: this is a coin-flip dressed up as a fixture."
    }
  ],
  pullQuote:
    "Five models, one ensemble, honest probability bars — no scoreline bravado, no over-confident bets, just the maths showing its working.",
  closingLine:
    "Filed from the demo wire. Add a Football-Data API key in Settings to publish your own gameweek broadsheet."
};
