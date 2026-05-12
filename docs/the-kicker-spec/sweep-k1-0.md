# K1.0 cutover sweep — v3 → The Kicker

This is **the gate** between the `kicker-mvp` branch and live production. Run the
checklist top-to-bottom on a fresh `npm run dev --prefix frontend` session, then
follow the **cutover playbook** at the bottom. Tag `k1.0` is applied at the
deployment commit, not before.

The Playwright auto-half (`frontend/e2e/checkpoint-k1-0.spec.ts`) gates the
structural pieces. This doc covers the things only a human can sign off:
behavioural correctness, visual parity, a11y, and the actual production swap.

---

## Pre-flight

- [ ] `git status` clean on `kicker-mvp`.
- [ ] `git fetch origin && git log --oneline origin/main..HEAD` shows the K-slice commits in expected order.
- [ ] `npm run check --prefix frontend` reports `0 errors and 0 warnings`.
- [ ] `npm run test --prefix frontend -- --run` all-green (508+ tests).
- [ ] `npx playwright test --config frontend/playwright.config.ts e2e/checkpoint-k1-0.spec.ts` all-green on both `desktop-chrome` and `mobile-chrome` projects.
- [ ] All `k0.1`–`k0.12` tags exist locally (`git tag -l 'k0.*'`).

## /today

- [ ] 4 KPI tiles render in order: NEXT KICKOFF · MODEL ACCURACY · MODEL EDGE (red accent) · STREAK (red accent).
- [ ] MODEL ACCURACY value matches the v3 backtest within ±0.01 (compare against the live v3 prod URL).
- [ ] No KPI labelled VALUE BETS or BANKROLL anywhere in DOM (`document.body.innerText` regex).
- [ ] With a real Football-Data key pasted (see /settings), hero MatchSheetCard populates within 2s.
- [ ] Without a key, KPI strip still renders (values fall back to `—`); no console errors.
- [ ] Pundit quote block reads in the active persona's voice.

## /fixtures

- [ ] Filter chips render: ALL · TOP 6 · RELEGATION · TV.
- [ ] Switching chip filters the date-grouped match list without reload.
- [ ] Each match row links to a placeholder match-detail (or 404 — that's K1b).
- [ ] Empty state copy reads in serif italic when filter narrows result to zero.

## /predictions

- [ ] 4 KPI tiles render: MODEL ACCURACY · BRIER · CALIBRATION · MODEL EDGE (red accent).
- [ ] THIS WEEK'S PICKS rows show ghost-bar marketImplied overlay + valueEdge chip.
- [ ] valueEdge chip sign matches direction of model probability vs market (positive = green, negative = red).
- [ ] SETTLED RESULTS log renders past picks with hit (✓) / exact (✓✓) / miss (—) markers.
- [ ] No "stake suggestion" or Kelly fraction rendered anywhere.

## /settings

- [ ] 6 sub-nav rows render in order: Your Pundit · API & data · Display · Account · Notifications · Privacy.
- [ ] URL hash updates on sub-nav click (`#pundit / #api / ...`); reload preserves panel.
- [ ] Browser back/forward across hashes re-syncs the active panel.
- [ ] Pundit grid: 10 cards, click switches active persona immediately (no save button).
- [ ] Active persona ✓ check is visually distinct + accent-bordered.
- [ ] Switching persona cascades `<html data-persona="…">` (verify in DevTools).
- [ ] Persona persists across hard reload (check `localStorage['kicker:personaId']`).
- [ ] **API tab — Football-Data key:** paste a valid key → click `SAVE & RELOAD` → page reloads → `/today` populates with real data.
- [ ] **API tab — Football-Data key:** click `REMOVE` → page reloads → `/today` falls back to empty/`—` state cleanly (no console errors).
- [ ] **API tab — Anthropic key:** paste/save/remove cycle runs without console errors. (Note: server-side env key still drives `/api/chat` per K0l-β discovery — local key is dormant until K1d/K2c.)
- [ ] Both Save buttons are `disabled` when input is empty.
- [ ] Notifications tab: 3 PrefToggles (match-start / model-edge / broadsheet-ready). Toggle each, reload, confirm state restored from `kicker:notifications` localStorage key.
- [ ] No `value bet` or `bankroll` copy anywhere in any panel.

## /onboarding

- [ ] 3-step flow: welcome → pick pundit → preview/confirm.
- [ ] Picking a pundit then confirming routes to `/today` with the persona active.
- [ ] Back button on step 2 returns to step 1 with selection preserved.
- [ ] Refreshing on any step does not crash (defaults to step 0).

## Mobile (Pixel 7 / DevTools mobile emulation)

- [ ] Bottom-nav tab order: TODAY · FIXTURES · PREDICTIONS · ORACLE · MORE.
- [ ] No `BETTING` tab anywhere.
- [ ] Tapping ORACLE routes to a placeholder-safe page (404 or stub — both acceptable for K1.0; full Oracle is K1a).
- [ ] MobileTicker scrolls horizontally below the header, not double-mounted on any route.
- [ ] /settings on mobile: sub-nav stacks above panel; bottom-nav highlights `more`.

## Persona switching

- [ ] Switch persona on `/settings#pundit`, navigate to `/today`, `/fixtures`, `/predictions` — accent colour cascades on rules + KPI tiles + PUNDIT ON DUTY chip.
- [ ] Cycle all 10 personas — no broken accent (no inline hex leaking).

## A11y

- [ ] axe-core scan on `/today`, `/fixtures`, `/predictions`, `/settings`, `/onboarding` — zero new violations vs v3 baseline.
- [ ] All sub-nav buttons have `aria-current="page"` when active.
- [ ] Mobile bottom-nav anchors have `aria-current="page"` on the active tab.
- [ ] All form inputs have associated `<label>` or `aria-label`.

## Theme parity

- [ ] No dark-mode escape paths: page renders identically with `prefers-color-scheme: dark` browser setting.
- [ ] No `transition` or `animation` runs when `prefers-reduced-motion: reduce` is set.

## Final regression sweep

- [ ] No betting copy anywhere across all 5 routes (regex grep `/value bets|bankroll|kelly/i` against rendered HTML).
- [ ] No console errors or warnings on any route in a fresh incognito session.
- [ ] No 404s in network tab for first-party assets (third-party Football-Data 4xx with no key is acceptable).

---

## Cutover playbook (after sign-off)

**Do not start until every checkbox above is ticked.**

1. **Final guard:** `git checkout kicker-mvp && git pull --ff-only`. Confirm `git status` clean.
2. **Rebase onto main:** `git fetch origin && git rebase origin/main`. Resolve any conflicts (none expected — `main` should be unchanged since the branch cut).
3. **Fast-forward main locally:** `git checkout main && git merge --ff-only kicker-mvp`.
4. **Push:** `git push origin main`. Vercel auto-deploys from `main`.
5. **Watch the deploy** in the Vercel dashboard. Wait for green "Ready".
6. **Smoke-test prod URL** (`the-premier-league-oracle.vercel.app`) on 3 personas (voice / scouser / chaos) × 5 routes (/today, /fixtures, /predictions, /settings, /onboarding). Same regex-grep for betting copy.
7. **Tag the deployment commit:** `git tag k1.0` then `git push origin k1.0`.
8. **Update plan:** flip K0-cp to `[x]` in `IMPLEMENTATION_PLAN.md`; move K0-cp into `COMPLETED_ITEMS.md`; promote K1a to the next active slice.
9. **Preserve the seat-belt:** confirm `archive/v3-frontend` branch still exists on origin. Do **not** delete.
10. **Cutover comms:** decide on 90-day 301 redirects from old v3 routes (recommendation in `IMPLEMENTATION_PLAN.md` §Open follow-ups).

## Rollback

If anything is wrong on prod after the push:

1. `git checkout main && git revert --no-edit HEAD` (revert the ff-merge).
2. `git push origin main`. Vercel auto-redeploys the prior v3 commit.
3. Capture the failure mode in `IMPLEMENTATION_PLAN.md` under "Human notes for next iteration" and re-open K0-cp.
