#!/bin/sh
set -eu

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
  if [ ! -e "$task" ] && [ ! -e "$tmp" ]; then
    break
  fi
done

cat > "$tmp"

if [ ! -s "$tmp" ]; then
  rm -f "$tmp"
  echo "Task body is empty." >&2
  exit 1
fi

mv "$tmp" "$task"
echo "$task"
