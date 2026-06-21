#!/bin/sh
set -eu

if [ "$#" -lt 2 ]; then
  echo "Usage: sh tools/run-summary-task.sh <task-name> <prompt...>" >&2
  exit 2
fi

task_name="$1"
shift

case "$task_name" in
  *[!A-Za-z0-9._-]*)
    echo "task-name may contain only A-Z, a-z, 0-9, dot, underscore, and hyphen" >&2
    exit 2
    ;;
esac

date_dir="$(date +%Y%m%d)"
time_part="$(date +%H%M)"
output_dir="summary/${date_dir}"
mkdir -p "$output_dir"
output="${output_dir}/${time_part}-${task_name}.md"
prompt="$*"

codex exec --skip-git-repo-check \
  --cd "$(pwd)" \
  --output-last-message "$output" \
  "$(printf '%s\n\n%s\n' "$(cat summary/codex-exec-summary-prompt.md)" "$prompt")"

echo "$output"

