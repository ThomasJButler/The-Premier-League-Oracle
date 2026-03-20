#!/usr/bin/env bash
set -euo pipefail

# Generic Claude Code loop wrapper
# Usage:
#   ./loop.sh plan
#   ./loop.sh plan 1
#   ./loop.sh build
#   ./loop.sh build 2
#   ./loop.sh build coach
#   ./loop.sh build 1 coach

MODE="${1:-build}"
MAX_ITERATIONS="${2:-0}"
COACH_MODE="${COACH_MODE:-0}"
OUTPUT_MODE="${OUTPUT_MODE:-pretty}"

if [[ "${2:-}" == "coach" ]]; then
  MAX_ITERATIONS="0"
  COACH_MODE="1"
fi

if [[ "${3:-}" == "coach" ]]; then
  COACH_MODE="1"
fi

case "$MODE" in
  plan)
    PROMPT_FILE="PROMPT_plan.md"
    ;;
  build)
    PROMPT_FILE="PROMPT_build.md"
    ;;
  *)
    if [[ "$MODE" =~ ^[0-9]+$ ]]; then
      PROMPT_FILE="PROMPT_build.md"
      MAX_ITERATIONS="$MODE"
      MODE="build"
    else
      echo "Usage: ./loop.sh [plan|build] [max_iterations] [coach]"
      exit 1
    fi
    ;;
esac

COACH_PROMPT_FILE="PROMPT_coach.md"
RENDERER="scripts/render_claude_stream.py"
RUN_DIR=".claude-run"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Missing prompt file: $PROMPT_FILE"
  exit 1
fi

mkdir -p "$RUN_DIR"

PROMPT_TEXT="$(cat "$PROMPT_FILE")"
if [[ "$COACH_MODE" == "1" ]]; then
  if [[ ! -f "$COACH_PROMPT_FILE" ]]; then
    echo "Missing coach prompt file: $COACH_PROMPT_FILE"
    exit 1
  fi
  PROMPT_TEXT="${PROMPT_TEXT}"$'\n\n'"$(cat "$COACH_PROMPT_FILE")"
fi

ITERATION=0

echo "========================================"
echo "CoachWiggum Claude Code loop"
echo "Mode:   $MODE"
echo "Prompt: $PROMPT_FILE"
[[ "$COACH_MODE" == "1" ]] && echo "Coach:  on"
[[ "$MAX_ITERATIONS" != "0" ]] && echo "Max:    $MAX_ITERATIONS"
echo "Logs:   $RUN_DIR"
echo "========================================"

while true; do
  if [[ "$MAX_ITERATIONS" != "0" && "$ITERATION" -ge "$MAX_ITERATIONS" ]]; then
    echo "Reached max iterations: $MAX_ITERATIONS"
    break
  fi

  STAMP="$(date +%Y%m%d-%H%M%S)"
  JSONL_PATH="$RUN_DIR/${MODE}-${STAMP}.jsonl"

  echo
  echo "==> Iteration $((ITERATION + 1))"

  if [[ "$OUTPUT_MODE" == "json" || ! -f "$RENDERER" ]]; then
    claude -p "$PROMPT_TEXT" \
      --output-format stream-json \
      | tee "$JSONL_PATH"
  else
    claude -p "$PROMPT_TEXT" \
      --output-format stream-json \
      | tee "$JSONL_PATH" \
      | python3 -u "$RENDERER"
  fi

  echo "Saved JSONL log to: $JSONL_PATH"

  ITERATION=$((ITERATION + 1))

  if [[ "$MAX_ITERATIONS" == "0" ]]; then
    echo
    echo "Run again for another fresh-context iteration:"
    echo "  ./loop.sh $MODE 1"
    break
  fi
done
