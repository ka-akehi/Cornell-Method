#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
queue_dir="$(dirname "$script_dir")"

export WORKER_NAME="${WORKER_NAME:-Worker-api}"
export CODEX_QUEUE_ROOT="${CODEX_QUEUE_ROOT:-$queue_dir/tasks-api}"

exec "$script_dir/worker-run.sh"
