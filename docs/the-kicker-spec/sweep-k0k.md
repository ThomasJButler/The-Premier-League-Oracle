# K0k — Predictions screen manual sweep

Run `npm run dev --prefix frontend`, navigate to `/predictions` on desktop and mobile.
Walk the checklist, mark each item, then sign off in `IMPLEMENTATION_PLAN.md`.

## Desktop (≥1024px)

- [ ] KickerShell renders, `predictions` nav link is the active red-bordered item.
- [ ] Top-bar kicker reads `THE MOAT`; title reads `PREDICTIONS`.
- [ ] KPI strip shows 4 tiles in order: `MODEL ACCURACY`, `BRIER SCORE`, `CALIBRATION INDEX`, `MODEL EDGE`.
- [ ] `MODEL EDGE` is the only red-accent tile.
- [ ] `MODEL ACCURACY` value matches v3 backtest output for the same prediction history within ±1pp.
- [ ] `BRIER SCORE` is a 3-decimal value in `[0, 2]`; lower-is-better caption present.
- [ ] `CALIBRATION INDEX` is a 2-decimal value in `[0, 1]`; `0–1 scalar` caption present.
- [ ] `THIS WEEK'S PICKS` divider visible.
- [ ] Each `PredictionPickRow` renders: `<HOME> v <AWAY>` fixture, pick letter (HOME/DRAW/AWAY), 3-segment H/D/A bar.
- [ ] When the row's match has odds, the 40%-opacity `marketImplied` ghost-bar overlays the model bar.
- [ ] When `valueEdge` is present, the chip flips colour: positive → red border + red text; non-positive → ink-dim.
- [ ] When `valueEdge` is absent, fallback `PENDING` chip renders.
- [ ] `SETTLED RESULTS` divider visible.
- [ ] Settled log sorted newest-first.
- [ ] Each `SettledResultRow` shows: fixture, predicted score, actual score, ✓ (green) on hit / ✗ (ink-dim) on miss, `EXACT` (red) when scoreline matches exactly, formatted match date.
- [ ] No copy reads `value bets`, `bankroll`, or `kelly` anywhere on the page.

## Mobile (<1024px)

- [ ] `MobileHeader` shows `Predictions` title with `THE KICKER` eyebrow + persona pill on the right.
- [ ] `MobileNav` highlights `predictions` (4th tab, between fixtures and oracle).
- [ ] KPI strip becomes a horizontal scroller (snap-x) with 4 tiles in the same order.
- [ ] No `betting` tab anywhere.

## Persona accent

- [ ] Switching persona via the pill → `/settings#pundit` updates the sidebar `PUNDIT ON DUTY` accent immediately on return.
- [ ] No row, KPI tile, or chip reflows incorrectly during the persona switch.

## A11y

- [ ] Each model bar has an `aria-label` reading `Model probability: home X%, draw Y%, away Z%`.
- [ ] Each ghost-bar (when present) has an `aria-label` reading `Market implied: home X%, draw Y%, away Z%`.
- [ ] `prefers-reduced-motion: reduce` does not introduce any new motion on this screen (KPI scroll-snap only).

## Empty states

- [ ] When no upcoming fixtures: `No upcoming fixtures in the next 7 days.` empty-state copy renders.
- [ ] When no settled predictions: `No settled predictions yet.` empty-state copy renders.

## Sign-off

- [ ] All boxes ticked → flip K0k-β to `[x]` and apply tag `k0.11`.
