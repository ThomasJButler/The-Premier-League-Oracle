# K0l — Settings shell manual sweep

Run `npm run dev --prefix frontend`, navigate to `/settings` on desktop and mobile.
Walk the checklist, mark each item, then sign off in `IMPLEMENTATION_PLAN.md`.

Two-phase slice:
- **α (this slice, k0.12-α):** shell + sub-tab routing + section scaffolds; pundit picker is live (already wired to `personaStore.set`); other sections display read-only copy.
- **β (next slice):** API-key persistence (Football-Data + bring-your-own-Anthropic), `PrefToggle` notification preferences.

## Desktop (≥1024px) — K0l-α

- [ ] `KickerShell` renders, `settings` nav link is the active red-bordered item in the sidebar.
- [ ] Top-bar kicker reads `ACCOUNT · PUNDIT · DISPLAY · API`; title reads `SETTINGS`.
- [ ] Left sub-nav shows 6 rows in order: `Your Pundit`, `API & data`, `Display`, `Account`, `Notifications`, `Privacy`.
- [ ] First sub-nav row (`Your Pundit`) is highlighted (ink-filled, paper text) on initial load — no URL hash needed.
- [ ] Clicking each sub-nav row swaps the right-hand panel without page reload.
- [ ] URL hash updates to `#pundit / #api / #display / #account / #notifications / #privacy` as rows are clicked.
- [ ] Reloading on `/settings#api` re-opens the API panel (hash drives initial state after mount).
- [ ] Browser back/forward across hashes re-syncs the active panel (hashchange listener).

## Pundit panel

- [ ] 10 `PunditPickerCard` cards render in a 2-column grid in `KICKER_PERSONA_ORDER`.
- [ ] The card matching the active persona shows the ✓ check and accent-coloured border.
- [ ] Clicking a different card immediately:
  - swaps the active card (✓ moves)
  - updates the sidebar `PUNDIT ON DUTY` name + tic + dot colour
  - updates the bottom-of-panel "Active: …" line
  - cascades `data-persona` on `<html>` (verify in DevTools)
  - persists across reload (the `kicker:personaId` localStorage key is owned by `personaStore`).

## API & data panel (K0l-α — read-only)

- [ ] Two labelled password inputs render (`FOOTBALL-DATA.ORG API KEY`, `ANTHROPIC API KEY · OPTIONAL`).
- [ ] Both inputs are `disabled` (persistence ships in β).
- [ ] Italic helper copy explains the β follow-up and the env-var fallback.

## Display / Account / Notifications / Privacy panels

- [ ] Each renders its `Rule` header + a single descriptive paragraph.
- [ ] Notifications panel italic line acknowledges β + K1f deferral.

## Mobile (<1024px)

- [ ] `MobileHeader` shows `Settings` title with `THE KICKER` eyebrow + persona pill on the right.
- [ ] `MobileNav` highlights `more` (not `settings`); the 5 tabs remain `today / fixtures / predictions / oracle / more`.
- [ ] Sub-nav stacks above the panel (single column).
- [ ] No bottom-nav `settings` tab anywhere.

## Persona accent

- [ ] Switching persona on `/settings#pundit`, then navigating to `/today` or `/predictions`, shows the new accent on rules, KPI tiles, and sidebar `PUNDIT ON DUTY` immediately.

## No betting copy

- [ ] No string on the page matches `/value bets|bankroll|kelly/i`.

## A11y

- [ ] `aria-current="page"` is set on the active sub-nav button.
- [ ] axe-core scan reports no new violations vs `/today` baseline.

## Sign-off

- [ ] All α boxes ticked → flip K0l-α to `[x]` in the plan, apply tag `k0.12-α` (or hold tag until β lands; user's call).
- [ ] β follow-up captured in the plan as the next active slice.
