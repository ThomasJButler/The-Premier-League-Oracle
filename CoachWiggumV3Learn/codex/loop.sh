#!/usr/bin/env bash
set -euo pipefail

# Generic Codex loop wrapper
# Usage:
#   ./loop.sh plan [N]           Plan mode (N iterations)
#   ./loop.sh build [N]          Build mode (N iterations)
#   ./loop.sh build [N] coach    Build with coach narration overlay
#   ./loop.sh view past          List completed runs
#   ./loop.sh view future        Follow the current loop (tail latest JSONL)
#   ./loop.sh view <file.jsonl>  View a specific run's final output

MODE="${1:-build}"
MAX_ITERATIONS="${2:-0}"
COACH_MODE="${COACH_MODE:-0}"
OUTPUT_MODE="${OUTPUT_MODE:-pretty}"
RUN_DIR=".codex-run"

# ── View mode ────────────────────────────────────────────────
if [[ "$MODE" == "view" ]]; then
    if [[ ! -d "$RUN_DIR" ]]; then
        echo "No .codex-run/ directory found — run a build or plan first."
        exit 1
    fi
    # Explicit file path
    if [[ -n "${2:-}" ]] && [[ -f "${2:-}" ]]; then
        echo "=== Final output from: $2 ==="
        FINAL="${2%.jsonl}.final.md"
        if [[ -f "$FINAL" ]]; then
            cat "$FINAL"
        else
            echo "(No .final.md found — showing last 50 lines of JSONL)"
            tail -50 "$2"
        fi
        exit 0
    fi
    # past — list completed runs
    if [[ "${2:-}" == "past" ]]; then
        echo ""
        echo "  Completed runs in $RUN_DIR/:"
        echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        ls -lht "$RUN_DIR"/*.jsonl 2>/dev/null | while read -r line; do
            FILE=$(echo "$line" | awk '{print $NF}')
            SIZE=$(echo "$line" | awk '{print $5}')
            DATE=$(echo "$line" | awk '{print $6, $7, $8}')
            BASENAME=$(basename "$FILE")
            echo "    $DATE  $SIZE  $BASENAME"
        done
        echo ""
        echo "  Replay a run:  ./loop.sh view .codex-run/<filename>.jsonl"
        echo ""
        exit 0
    fi
    # future — tail the latest JSONL
    if [[ "${2:-}" == "future" ]]; then
        RENDERER="scripts/render_codex_exec_stream.py"
        echo ""
        echo "  Following current session in $RUN_DIR/ ..."
        echo "  Ctrl+C to stop."
        echo ""
        while true; do
            LATEST="$(ls -t "$RUN_DIR"/*.jsonl 2>/dev/null | head -1)"
            if [[ -z "$LATEST" ]]; then
                echo "  Waiting for a JSONL file to appear..."
                sleep 2
                continue
            fi
            echo "  Tailing: $LATEST"
            if [[ -f "$RENDERER" ]]; then
                tail -f "$LATEST" | python3 -u "$RENDERER"
            else
                tail -f "$LATEST"
            fi
            break
        done
        exit 0
    fi
    # No arg — show help
    echo ""
    echo "  Usage:"
    echo "    ./loop.sh view past                       List completed runs"
    echo "    ./loop.sh view future                     Follow the current loop live"
    echo "    ./loop.sh view .codex-run/<file>.jsonl    View a specific run"
    echo ""
    exit 0
fi

# ── Parse build/plan arguments ──────────────────────────────
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
            echo "Usage: ./loop.sh [plan|build|view] [max_iterations] [coach]"
            exit 1
        fi
        ;;
esac

COACH_PROMPT_FILE="PROMPT_coach.md"
RENDERER="scripts/render_codex_exec_stream.py"

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

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CoachWiggum Codex loop"
echo "Mode:   $MODE"
echo "Prompt: $PROMPT_FILE"
[[ "$COACH_MODE" == "1" ]] && echo "Coach:  on"
[[ "$MAX_ITERATIONS" != "0" ]] && echo "Max:    $MAX_ITERATIONS"
echo "Logs:   $RUN_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

while true; do
    if [[ "$MAX_ITERATIONS" != "0" && "$ITERATION" -ge "$MAX_ITERATIONS" ]]; then
        echo "Reached max iterations: $MAX_ITERATIONS"
        break
    fi

    STAMP="$(date +%Y%m%d-%H%M%S)"
    JSONL_PATH="$RUN_DIR/${MODE}-${STAMP}.jsonl"
    FINAL_PATH="$RUN_DIR/${MODE}-${STAMP}.final.md"

    echo
    echo "==> Iteration $((ITERATION + 1))"

    if [[ "$OUTPUT_MODE" == "json" || ! -f "$RENDERER" ]]; then
        codex exec --full-auto --json \
            --output-last-message "$FINAL_PATH" \
            "$PROMPT_TEXT" \
            | tee "$JSONL_PATH"
    else
        codex exec --full-auto --json \
            --output-last-message "$FINAL_PATH" \
            "$PROMPT_TEXT" \
            | tee "$JSONL_PATH" \
            | python3 -u "$RENDERER"
    fi

    echo "Saved final message to: $FINAL_PATH"
    echo "Saved JSONL log to:     $JSONL_PATH"

    ITERATION=$((ITERATION + 1))

    if [[ "$MAX_ITERATIONS" == "0" ]]; then
        echo
        echo "Run again for another fresh-context iteration:"
        echo "  ./loop.sh $MODE 1"
        break
    fi
done
