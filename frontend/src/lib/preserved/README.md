# preserved/ — v3 prediction engines (read-only quarantine)

Salvaged from `origin/archive/v3-frontend@f39c04a` at K0a-ii-β.

## Quarantine rules

- This directory is excluded from `tsconfig.json` (`exclude: ["src/lib/preserved/**"]`)
  and from vitest's `include` glob. Files are reference-only.
- Imports inside this tree may dangle (e.g. `../../services/backendService`,
  `../../utils/teamLogos`) — the closure is intentionally incomplete because
  the v3 active source tree they reference no longer exists.
- Later K-slices that need a preserved file should EITHER:
  1. Move the file out of `preserved/` into the active src tree and complete
     its import closure (recommended for files used by one consumer), or
  2. Re-import from `preserved/` with a path that resolves only at runtime
     (only for engines whose deps are also salvaged, e.g. `kelly.ts`).

## Salvage manifest (per K0a-ii-β plan)

Source files (11):
- services/api/footballData.ts
- services/dataService.ts
- services/predictionTracker.ts
- services/betting/kelly.ts
- services/betting/value.ts
- lib/optimizedPredictions.ts
- lib/advancedPredictions.ts
- lib/calibrationIndex.ts
- lib/gameweek.ts
- lib/adapters/v3.ts
- types/ (index.ts + redesign.ts)

Co-located test files (13): same paths, `.test.ts` suffix.

Tests are quarantined; vitest does not collect them. They will be re-introduced
by their consumers in later K-slices once the relevant module subgraph is
complete in the active src tree.
