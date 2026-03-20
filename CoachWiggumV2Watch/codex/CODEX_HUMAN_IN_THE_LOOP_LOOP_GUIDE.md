# Codex Human-In-The-Loop Loop Guide

This note describes a shareable pattern for making a Codex loop easier to scan, easier to review, and more useful for learning.

## Why this exists

Fast agent loops are productive, but they create a real failure mode for humans:

- you can see that files changed
- you can often see the final result
- you cannot always see the reasoning path that got there

That makes it easy to become dependent on speed while losing your grip on:

- why a slice was chosen
- what evidence the agent used
- what it learned before editing
- what risks it believed it was taking

This guide is meant to slow the loop down just enough that a human can stay in control.

## What this pattern includes

The pattern has three layers:

1. A repo-local wrapper script:
   - `loop.sh`
2. A raw machine log:
   - `.codex-run/*.jsonl`
3. A readable live renderer:
   - `scripts/render_codex_exec_stream.py`

It also keeps the final assistant response in:

- `.codex-run/*.final.md`

### What changed

Before:

- `codex exec --json` wrote the raw JSON event stream directly to the terminal
- command output, ANSI noise, long blobs, and event payloads were hard to follow live
- the human could inspect logs later, but the live feedback was poor

Now:

- the raw JSONL stream is still preserved unchanged for debugging
- the terminal shows only the parts a human usually cares about
- the readable view includes:
  - agent messages
  - todo lists
  - command start lines
  - command success/failure lines
  - short failure excerpts
  - changed-file notices

## How the loop works behind the scenes

The wrapper is conceptually:

```bash
codex exec --full-auto --json \
  --output-last-message "$FINAL_PATH" \
  "$(cat "$PROMPT_FILE")" \
  | tee "$JSONL_PATH" \
  | python3 -u scripts/render_codex_exec_stream.py
```

That pipeline does three different jobs at once:

1. `codex exec --json`
   Emits a structured event stream.

2. `tee "$JSONL_PATH"`
   Saves the exact raw stream for debugging and later review.

3. `render_codex_exec_stream.py`
   Converts the event stream into a readable live transcript for the human.

This is the important idea: do not choose between machine logs and human readability. Keep both.

## Why this is better than relying on git diff alone

`git diff` and `git log` tell you:

- what changed
- roughly when it changed

They usually do not tell you:

- why that path was chosen instead of another
- which files were inspected before the edit
- what the agent believed was risky
- whether the change was driven by code evidence, spec drift, or failing validation

The readable loop transcript fills that gap.

## What still needs improvement

The current renderer makes the output scannable, but it is still mostly an activity log.

It answers:

- what commands ran
- whether they passed
- what the agent said occasionally

It does not yet consistently answer:

- why this batch of commands is the next correct move
- what the agent expects to learn from those commands
- what changed in its understanding after the results came back
- why an edit is safe enough to make now

That is the next maturity step.

## The next level: make the loop teach as it works

If you want the loop to help you grow as an engineer, the live transcript should expose decisions, not just actions.

The most useful additions are:

### 1. Pre-batch intent

Before a cluster of reads or commands, the agent should explain:

- what it is about to inspect
- why that inspection matters
- what it expects to prove or disprove

Example:

```text
Checking the refresh tracker and router first because Step 16.1 depends on whether duplicate-start protection is already partly implemented. I’m looking for an atomic claim/start path and any place validation happens before refresh state is claimed.
```

### 2. Post-batch learning

After a cluster of reads or commands, the agent should explain:

- what it learned
- what that means for the next move

Example:

```text
The race is real: validation still happens before refresh state is claimed, and the tracker still separates checking from marking started. That narrows the next slice to a backend-only fix before any frontend contract work.
```

### 3. Edit framing

Before editing, the agent should state:

- which files it will edit
- what behavior it is changing
- what risk it must preserve against

Example:

```text
I’m editing:
- src/backend/services/refresh_tracker.py
- src/backend/routers/sources.py

Goal:
- reject duplicate refresh attempts before external validation

Risk to preserve:
- failed validation must release the claimed refresh state so polling does not get stuck
```

### 4. Evidence-aware validation

Instead of only saying "running tests", the loop should say what the tests do and do not prove.

Example:

```text
Running backend smoke tests to prove the refresh change did not break the existing API surface. This does not prove live NewsAPI behavior because the sandbox cannot make the real external request path trustworthy.
```

### 5. Checkpoints

On longer slices, the loop should periodically emit:

- the current goal
- confirmed facts
- open uncertainty
- the next step

Example:

```text
Checkpoint
- Goal: eliminate duplicate refresh starts
- Confirmed: current tracker is race-prone
- Not yet validated: release path on invalid key
- Next: patch tracker API, then add one regression test
```

## Human-in-the-loop modes

There are different levels of "human in the loop". They are not the same.

### Mode 1: readable autopilot

The agent still runs automatically, but explains itself better.

Use this when:

- you want speed
- you want context
- you do not need approval at each decision point

### Mode 2: checkpoint approval

The loop pauses after each major checkpoint and waits for you to continue.

Use this when:

- the changes are risky
- you want to review approach before edits
- you want the assistant to coach as it goes

### Mode 3: pre-edit approval

The agent explores freely, but pauses before any file change.

Use this when:

- you want strong oversight
- you are learning a codebase
- you care more about understanding than speed

### Mode 4: one-slice loops

Run only one plan or build slice per iteration, review the transcript and final summary, then start the next iteration yourself.

Use this when:

- you want the simplest and safest default
- you want to maintain context without full manual gating

Many teams find that a mix of Mode 1 and Mode 4 is the best default.

## How to use this in any Codex project

The portable pattern is:

1. Add a repo-local loop wrapper.
2. Keep prompt files in the repo.
3. Run `codex exec` in non-interactive mode.
4. Save the raw JSONL event stream.
5. Render a reduced human-readable live stream.
6. Save the final assistant message separately.
7. Keep the implementation plan in the repo, not in memory.

## Starter pack

If you want a minimal reusable bundle, start with:

- `loop.sh`
- `PROMPT_plan.md`
- `PROMPT_build.md`
- `PROMPT_coach.md`
- `IMPLEMENTATION_PLAN.md`
- `AGENTS.md`
- `scripts/render_codex_exec_stream.py`

This folder now includes a generic `loop.sh` template you can copy into a repo and adapt.

### Minimal coach prompt

```text
Operate in coach mode for this run.

Before each investigation batch, explain:
- what you are checking
- why this is the right next step
- what evidence you expect

After each investigation batch, explain:
- what you learned
- what changed in your understanding
- what you will do next

Before editing, explain:
- which files you will edit
- what behavior you intend to change
- the main invariant or regression you must preserve

During validation, explain:
- what the validation proves
- what it does not prove

Keep these summaries concise and decision-focused.
Do not expose private chain-of-thought.
Do expose visible decision summaries, assumptions, evidence, and tradeoffs.
```

### Renderer contract

Your renderer does not need to be sophisticated. It only needs to turn the structured stream into a readable transcript that surfaces:

- assistant progress messages
- command starts
- command pass/fail
- short failure excerpts
- changed-file notices
- final summary path

That small amount of structure is enough to make the loop much more legible.

### Minimal Codex wrapper shape

```bash
#!/usr/bin/env bash
set -euo pipefail

PROMPT_FILE="${1:-PROMPT_build.md}"
RUN_DIR=".codex-run"
JSONL_PATH="$RUN_DIR/run-$(date +%Y%m%d-%H%M%S).jsonl"
FINAL_PATH="$RUN_DIR/run-$(date +%Y%m%d-%H%M%S).final.md"

mkdir -p "$RUN_DIR"

codex exec --full-auto --json \
  --output-last-message "$FINAL_PATH" \
  "$(cat "$PROMPT_FILE")" \
  | tee "$JSONL_PATH" \
  | python3 -u scripts/render_codex_exec_stream.py
```

### Codex project files to keep repo-local

- `AGENTS.md`
- `PROMPT_plan.md`
- `PROMPT_build.md`
- `IMPLEMENTATION_PLAN.md`
- a loop wrapper such as `loop.sh`
- a renderer such as `scripts/render_codex_exec_stream.py`

### Codex prompt behavior to encourage

If you want a more teachable build loop, the build prompt should explicitly require:

- a short "what I’m checking and why" message before investigation batches
- a short "what I learned" message after investigation batches
- an "I’m editing these files and preserving these invariants" message before edits
- validation messages that explain what evidence the validation provides
- checkpoint summaries during long-running slices

## A good teaching-oriented prompt shape

This wording works as a pattern across tools:

```text
When exploring, narrate in short batches:
- what you are checking
- why you are checking it now
- what evidence you expect

After each batch, summarize:
- what you learned
- what changed in your understanding
- what you will do next

Before editing, state:
- which files you will edit
- the behavior you intend to change
- the main invariant or risk you must preserve

During validation, explain:
- what the validation proves
- what it does not prove

Keep these summaries concise and decision-focused.
Do not expose private chain-of-thought.
```

## Recommended file bundle for reuse

For a new repo, a good reusable bundle is:

- `AGENTS.md` or `CLAUDE.md`
- `PROMPT_plan.md`
- `PROMPT_build.md`
- `IMPLEMENTATION_PLAN.md`
- `loop.sh`
- `scripts/render_agent_stream.py`
- `README_AGENT_LOOP.md`

## Suggested repo adoption checklist

1. Add repo-local prompts and rules first.
2. Add a wrapper that saves raw structured logs.
3. Add a renderer that makes the live stream readable.
4. Save the final assistant message separately.
5. Keep one implementation-plan file under version control.
6. Require narrated intent, learning, edit framing, and evidence-aware validation in the prompts.
7. Decide which human-in-the-loop mode you want for that repo.
8. Only then tune wording for tone and verbosity.

## Practical rule of thumb

If the loop is so fast that you stop understanding why it made decisions, it is too fast for learning.

The goal is not to make the agent slow.
The goal is to make the decision trail legible.

## Notes on tool-specific details

CLI flags and structured-output formats can change over time. Before reusing this pattern in another repo, verify the current Codex CLI flags locally with `codex exec --help`.

Useful references:

- Codex CLI local help in your terminal: `codex exec --help`

## Short version

What this pattern does is simple:

- keep the raw machine log
- add a human-readable live view
- separate final summaries from raw execution
- move the important context into repo files

What comes next if you want this to teach you better:

- make the prompts narrate decisions, not just actions
- make validation explain evidence, not just commands
- add checkpoints or approval pauses where you want more control
