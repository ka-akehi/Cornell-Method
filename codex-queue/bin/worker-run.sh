#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
queue_dir="$(dirname "$script_dir")"
project_root="$(dirname "$queue_dir")"

root="${CODEX_QUEUE_ROOT:-$queue_dir/tasks}"
watch_root="${CODEX_QUEUE_WATCH_ROOT:-$project_root}"
worker_name="${WORKER_NAME:-Worker-common}"
interval="${CODEX_WORKER_INTERVAL:-2}"
coding_worker_model="${CODEX_CODING_WORKER_MODEL:-GPT-5.3-Codex-Spark}"

mkdir -p "$root/queued" "$root/running" "$root/done" "$root/failed"

status_line() {
  printf '\r\033[2K[%s] %s' "$worker_name" "$1"
}

status_log() {
  printf '\r\033[2K[%s] %s\n' "$worker_name" "$1"
}

changed_files_since() {
  changed_since="$1"
  find "$watch_root" -type f -newer "$changed_since" \
    ! -path "$queue_dir/tasks/*" \
    ! -path "$queue_dir/tasks-ui/*" \
    ! -path "$queue_dir/tasks-api/*" \
    ! -path "$watch_root/.git/*" \
    2>/dev/null | sed "s#^$watch_root/##" | sort || true
}

report_changed_files_since() {
  changed_since="$1"
  changed_files="$(changed_files_since "$changed_since")"

  if [ -z "$changed_files" ]; then
    status_log "Changed files: none"
    return
  fi

  status_log "Changed files modified during task:"
  printf '%s\n' "$changed_files" | while IFS= read -r changed_file; do
    status_log "  $changed_file"
  done
}

is_coding_task() {
  grep -Eq '^[[:space:]]*CODEX_TASK_KIND:[[:space:]]*coding[[:space:]]*$' "$1"
}

run_codex_task() {
  task_file="$1"

  if [ "${CODEX_WORKER_MODEL+x}" = "x" ]; then
    if [ -z "${CODEX_WORKER_MODEL}" ] || [ "${CODEX_WORKER_MODEL}" = "none" ]; then
      codex exec --skip-git-repo-check < "$task_file"
    else
      codex exec --skip-git-repo-check --model "$CODEX_WORKER_MODEL" < "$task_file"
    fi
  elif is_coding_task "$task_file"; then
    if [ -z "$coding_worker_model" ] || [ "$coding_worker_model" = "none" ]; then
      codex exec --skip-git-repo-check < "$task_file"
    else
      codex exec --skip-git-repo-check --model "$coding_worker_model" < "$task_file"
    fi
  else
    codex exec --skip-git-repo-check < "$task_file"
  fi
}

while true; do
  task="$(find "$root/queued" -type f -name '*.task.md' | sort | head -n 1 || true)"

  if [ -z "$task" ]; then
    status_line "Waiting for tasks"
    sleep "$interval"
    continue
  fi

  base="$(basename "$task")"
  running="$root/running/$base"

  if mv "$task" "$running" 2>/dev/null; then
    status_log "Running: $running"
    changed_since="$(mktemp "${TMPDIR:-/tmp}/codex-worker.XXXXXX")"

    if run_codex_task "$running"; then
      report_changed_files_since "$changed_since"
      mv "$running" "$root/done/$base"
      summary_file="$("$script_dir/write-task-summary.sh" --status done --task "$root/done/$base" --changed-since "$changed_since" --watch-root "$watch_root" --worker "$worker_name" --kind worker-task || true)"
      rm -f "$changed_since"
      if [ -n "$summary_file" ]; then
        status_log "Summary: $summary_file"
      fi
      status_log "Done: $root/done/$base"
    else
      report_changed_files_since "$changed_since"
      mv "$running" "$root/failed/$base"
      summary_file="$("$script_dir/write-task-summary.sh" --status failed --task "$root/failed/$base" --changed-since "$changed_since" --watch-root "$watch_root" --worker "$worker_name" --kind worker-task || true)"
      rm -f "$changed_since"
      if [ -n "$summary_file" ]; then
        status_log "Summary: $summary_file"
      fi
      status_log "Failed: $root/failed/$base"
    fi
  fi
done
