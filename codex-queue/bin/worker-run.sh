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

run_codex_default() {
  task_file="$1"
  codex exec --skip-git-repo-check < "$task_file"
}

is_model_unavailable_output() {
  output_file="$1"
  grep -Eiq 'model.*not supported|unsupported.*model|invalid_request_error.*model|Model metadata for .* not found' "$output_file"
}

run_codex_with_model_fallback() {
  task_file="$1"
  model="$2"

  if [ -z "$model" ] || [ "$model" = "none" ]; then
    run_codex_default "$task_file"
    return $?
  fi

  output_file="$(mktemp "${TMPDIR:-/tmp}/codex-worker-model.XXXXXX")"
  if codex exec --skip-git-repo-check --model "$model" < "$task_file" > "$output_file" 2>&1; then
    cat "$output_file"
    rm -f "$output_file"
    return 0
  else
    status="$?"
  fi

  cat "$output_file"

  if is_model_unavailable_output "$output_file"; then
    rm -f "$output_file"
    status_log "Model unavailable for coding task; retrying with default model: $model"
    run_codex_default "$task_file"
    return $?
  fi

  rm -f "$output_file"
  return "$status"
}

run_codex_task() {
  task_file="$1"

  if [ "${CODEX_WORKER_MODEL+x}" = "x" ]; then
    if [ -z "${CODEX_WORKER_MODEL}" ] || [ "${CODEX_WORKER_MODEL}" = "none" ]; then
      run_codex_default "$task_file"
    else
      codex exec --skip-git-repo-check --model "$CODEX_WORKER_MODEL" < "$task_file"
    fi
  elif is_coding_task "$task_file"; then
    run_codex_with_model_fallback "$task_file" "$coding_worker_model"
  else
    run_codex_default "$task_file"
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
    run_output="$(mktemp "${TMPDIR:-/tmp}/codex-worker-output.XXXXXX")"

    if run_codex_task "$running" > "$run_output" 2>&1; then
      cat "$run_output"
      report_changed_files_since "$changed_since"
      mv "$running" "$root/done/$base"
      summary_file="$("$script_dir/write-task-summary.sh" --status done --task "$root/done/$base" --changed-since "$changed_since" --watch-root "$watch_root" --worker "$worker_name" --kind worker-task || true)"
      rm -f "$changed_since"
      rm -f "$run_output"
      if [ -n "$summary_file" ]; then
        status_log "Summary: $summary_file"
      fi
      status_log "Done: $root/done/$base"
    else
      cat "$run_output"
      report_changed_files_since "$changed_since"
      mv "$running" "$root/failed/$base"
      summary_file="$("$script_dir/write-task-summary.sh" --status failed --task "$root/failed/$base" --changed-since "$changed_since" --watch-root "$watch_root" --worker "$worker_name" --kind worker-task --failure-output "$run_output" || true)"
      rm -f "$changed_since"
      rm -f "$run_output"
      if [ -n "$summary_file" ]; then
        status_log "Summary: $summary_file"
      fi
      status_log "Failed: $root/failed/$base"
    fi
  fi
done
