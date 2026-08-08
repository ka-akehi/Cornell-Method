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
state_dir="${CODEX_WORKER_STATE_DIR:-$queue_dir/.state}"
progress_script="$script_dir/worker-progress.sh"

mkdir -p "$root/queued" "$root/running" "$root/done" "$root/failed"
mkdir -p "$state_dir/progress"

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
    ! -path "$watch_root/.next/*" \
    ! -path "$watch_root/codex-queue/.state/*" \
    ! -path "$watch_root/node_modules/*" \
    ! -path "$watch_root/coverage/*" \
    ! -path "$watch_root/playwright-report/*" \
    ! -path "$watch_root/test-results/*" \
    ! -path "$watch_root/out/*" \
    ! -path "$watch_root/build/*" \
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
  prompt_file="$1"
  worker_report="$2"
  codex exec --skip-git-repo-check --output-last-message "$worker_report" < "$prompt_file"
}

is_model_unavailable_output() {
  output_file="$1"
  grep -Eiq 'model.*not supported|unsupported.*model|invalid_request_error.*model|Model metadata for .* not found' "$output_file"
}

run_codex_with_model_fallback() {
  prompt_file="$1"
  model="$2"
  worker_report="$3"

  if [ -z "$model" ] || [ "$model" = "none" ]; then
    run_codex_default "$prompt_file" "$worker_report"
    return $?
  fi

  output_file="$(mktemp "${TMPDIR:-/tmp}/codex-worker-model.XXXXXX")"
  if codex exec --skip-git-repo-check --model "$model" --output-last-message "$worker_report" < "$prompt_file" > "$output_file" 2>&1; then
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
    : > "$worker_report"
    run_codex_default "$prompt_file" "$worker_report"
    return $?
  fi

  rm -f "$output_file"
  return "$status"
}

run_codex_task() {
  task_file="$1"
  prompt_file="$2"
  worker_report="$3"

  if [ "${CODEX_WORKER_MODEL+x}" = "x" ]; then
    if [ -z "${CODEX_WORKER_MODEL}" ] || [ "${CODEX_WORKER_MODEL}" = "none" ]; then
      run_codex_default "$prompt_file" "$worker_report"
    else
      codex exec --skip-git-repo-check --model "$CODEX_WORKER_MODEL" --output-last-message "$worker_report" < "$prompt_file"
    fi
  elif is_coding_task "$task_file"; then
    run_codex_with_model_fallback "$prompt_file" "$coding_worker_model" "$worker_report"
  else
    run_codex_default "$prompt_file" "$worker_report"
  fi
}

progress_file_for() {
  task_file="$1"
  queue_name="$(basename "$root")"
  task_name="$(basename "$task_file")"
  printf '%s/progress/%s--%s.progress' "$state_dir" "$queue_name" "$task_name"
}

set_progress() {
  progress_file="$1"
  percent="$2"
  phase="$3"
  message="$4"
  "$progress_script" \
    --file "$progress_file" \
    --percent "$percent" \
    --phase "$phase" \
    --message "$message" \
    >/dev/null 2>&1 || true
}

make_runtime_prompt() {
  task_file="$1"
  prompt_file="$(mktemp "${TMPDIR:-/tmp}/codex-worker-prompt.XXXXXX")"
  {
    cat "$task_file"
    cat <<'RUNTIME'

## Worker runtime progress reporting

この task は Manager が進捗確認できる Worker runner 経由で実行されています。作業の節目で、見積りの進捗率を次のコマンドで更新してください。これはリポジトリの成果物ではなく、Worker 状態のメタデータです。

```sh
codex-queue/bin/worker-progress.sh 25 "調査完了"
codex-queue/bin/worker-progress.sh --percent 60 --phase "implementation" --message "実装完了"
codex-queue/bin/worker-progress.sh --percent 85 --phase "verification" --message "検証中"
```

0〜100 の整数で、実際に到達した節目だけを報告してください。報告できない場合も task の作業は継続し、完了・失敗は runner が記録します。
RUNTIME
  } > "$prompt_file"
  printf '%s\n' "$prompt_file"
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
    worker_report="$(mktemp "${TMPDIR:-/tmp}/codex-worker-report.XXXXXX")"
    runtime_prompt="$(make_runtime_prompt "$running")"
    progress_file="$(progress_file_for "$running")"
    export WORKER_PROGRESS_FILE="$progress_file"
    export WORKER_TASK_FILE="$running"
    export WORKER_PID="$$"
    export WORKER_NAME="$worker_name"
    set_progress "$progress_file" 5 "starting" "Task claimed"

    if run_codex_task "$running" "$runtime_prompt" "$worker_report" > "$run_output" 2>&1; then
      set_progress "$progress_file" 90 "finalizing" "Codex execution finished"
      cat "$run_output"
      report_changed_files_since "$changed_since"
      mv "$running" "$root/done/$base"
      set_progress "$progress_file" 95 "summary" "Writing task summary"
      summary_file="$("$script_dir/write-task-summary.sh" --status done --task "$root/done/$base" --changed-since "$changed_since" --watch-root "$watch_root" --worker "$worker_name" --kind worker-task --worker-report "$worker_report" || true)"
      set_progress "$progress_file" 100 "done" "Task completed"
      rm -f "$changed_since"
      rm -f "$run_output" "$worker_report"
      rm -f "$runtime_prompt" "$progress_file"
      if [ -n "$summary_file" ]; then
        status_log "Summary: $summary_file"
      fi
      status_log "Done: $root/done/$base"
    else
      set_progress "$progress_file" 90 "failed" "Codex execution failed"
      cat "$run_output"
      report_changed_files_since "$changed_since"
      mv "$running" "$root/failed/$base"
      set_progress "$progress_file" 95 "summary" "Writing failure summary"
      summary_file="$("$script_dir/write-task-summary.sh" --status failed --task "$root/failed/$base" --changed-since "$changed_since" --watch-root "$watch_root" --worker "$worker_name" --kind worker-task --failure-output "$run_output" || true)"
      set_progress "$progress_file" 100 "failed" "Task failed"
      rm -f "$changed_since"
      rm -f "$run_output" "$worker_report"
      rm -f "$runtime_prompt" "$progress_file"
      if [ -n "$summary_file" ]; then
        status_log "Summary: $summary_file"
      fi
      status_log "Failed: $root/failed/$base"
    fi
  fi
done
