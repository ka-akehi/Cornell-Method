#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
risk_assessor="$script_dir/assess-task-risk.sh"
root="${CODEX_QUEUE_ROOT:-codex-queue/tasks}"

if [ "$#" -gt 1 ]; then
  echo "Usage: $0 [task-summary-slug]" >&2
  exit 1
fi

mkdir -p "$root/queued" "$root/running" "$root/done" "$root/failed"

slug="${1:-}"

if [ -n "$slug" ]; then
  safe_slug="$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9][^a-z0-9]*/-/g; s/^-//; s/-$//')"
  if [ -z "$safe_slug" ]; then
    echo "Task summary slug must contain at least one ASCII letter or number." >&2
    exit 1
  fi
  prefix="$safe_slug"
else
  prefix="task"
fi

while :; do
  suffix="$(uuidgen | tr 'A-Z' 'a-z' | cut -c1-8)"
  id="$prefix-$suffix"
  task="$root/queued/$id.task.md"
  tmp="$root/queued/$id.task.md.tmp"
  normalized="$root/queued/$id.task.md.normalized"
  assessment="$root/queued/$id.task.md.assessment"
  if [ ! -e "$task" ] && [ ! -e "$tmp" ] && [ ! -e "$normalized" ] && [ ! -e "$assessment" ]; then
    break
  fi
done

cleanup() {
  rm -f "$tmp" "$normalized" "$assessment"
}
trap cleanup EXIT HUP INT TERM

cat > "$tmp"

if [ ! -s "$tmp" ]; then
  echo "Task body is empty." >&2
  exit 1
fi

if ! sh "$risk_assessor" "$tmp" > "$assessment"; then
  echo "Task was not enqueued because risk assessment is incomplete or invalid." >&2
  exit 1
fi

risk="$(sed -n '1p' "$assessment")"
risk_reason="$(sed -n '2p' "$assessment")"

if [ -z "$risk" ] || [ -z "$risk_reason" ]; then
  echo "Task risk assessor returned an incomplete result." >&2
  exit 1
fi

{
  printf 'CODEX_TASK_RISK: %s\n' "$risk"
  printf 'CODEX_TASK_RISK_REASON: %s\n\n' "$risk_reason"
  awk '
    /^[[:space:]]*CODEX_TASK_RISK:[[:space:]]*/ { next }
    /^[[:space:]]*CODEX_TASK_RISK_REASON:[[:space:]]*/ { next }
    /^[[:space:]]*CODEX_RISK_IMPACT:[[:space:]]*/ { next }
    /^[[:space:]]*CODEX_RISK_REVERSIBILITY:[[:space:]]*/ { next }
    /^[[:space:]]*CODEX_RISK_VERIFICATION:[[:space:]]*/ { next }
    /^[[:space:]]*CODEX_RISK_FLAGS:[[:space:]]*/ { next }
    { print }
  ' "$tmp"
} > "$normalized"

mv "$normalized" "$task"
rm -f "$tmp" "$assessment"
trap - EXIT HUP INT TERM

echo "$task"
