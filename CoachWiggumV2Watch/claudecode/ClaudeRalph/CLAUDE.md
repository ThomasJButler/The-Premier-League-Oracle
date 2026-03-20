# CLAUDE.md

## Ralph operating rules
- Read `IMPLEMENTATION_PLAN.md` before changing code.
- In plan mode, update the plan only. Do not implement.
- In build mode, execute exactly one highest-priority unchecked task or one tightly related sub-slice of that task.
- Keep this file operational and compact. Status, discoveries, and sequencing belong in `IMPLEMENTATION_PLAN.md`.
- Prefer small, reversible edits over broad refactors.
- Confirm a feature is actually missing before building it.

## Working agreements
- Keep changes scoped to the active plan item.
- Do not introduce placeholder implementations.
- Do not silently rewrite architecture when a local fix is sufficient.
- Do not auto-push, auto-tag, or auto-release from the loop.
- Update docs when setup, commands, or runtime behavior change.

## Validation
- Run the smallest meaningful validation that proves the changed slice works.
- Prefer targeted checks first, then broader checks if the slice warrants them.
- If validation fails, fix it or record the blocker in `IMPLEMENTATION_PLAN.md`.

## Documentation rules
- Update `IMPLEMENTATION_PLAN.md` whenever you discover a blocker, hidden dependency, or follow-up task.
- Update `README.md` when setup or architecture details change.
- Update this file only when the repo-wide loop rules change.

## Safety rules
- Never commit secrets, tokens, or populated `.env` files.
- Avoid destructive file moves until the relevant plan step is active.

