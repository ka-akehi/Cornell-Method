#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
queue_dir="$(dirname "$script_dir")"
project_root="$(dirname "$queue_dir")"

root="${CODEX_QUEUE_ROOT:-$queue_dir/tasks}"
watch_root="${CODEX_QUEUE_WATCH_ROOT:-$project_root}"
worker_name="${WORKER_NAME:-Worker-common}"
interval="${CODEX_WORKER_INTERVAL:-2}"
worker_model="gpt-5.6-luna"
state_dir="${CODEX_WORKER_STATE_DIR:-$queue_dir/.state}"
progress_script="$script_dir/worker-progress.sh"
change_recorder_script="$script_dir/worker-record-change.sh"

mkdir -p "$root/queued" "$root/running" "$root/done" "$root/failed"
mkdir -p "$state_dir/progress"

status_line() {
  printf '\r\033[2K[%s] %s' "$worker_name" "$1"
}

status_log() {
  printf '\r\033[2K[%s] %s\n' "$worker_name" "$1"
}

report_recorded_changed_files() {
  changed_files_file="$1"
  if [ -z "$changed_files_file" ] || [ ! -s "$changed_files_file" ]; then
    status_log "Changed files recorded by worker: none"
    return
  fi

  status_log "Changed files recorded by worker:"
  sort -u "$changed_files_file" | while IFS= read -r changed_file; do
    [ -n "$changed_file" ] || continue
    status_log "  $changed_file"
  done
}

task_risk() {
  task_file="$1"
  risk="$(sed -n 's/^[[:space:]]*CODEX_TASK_RISK:[[:space:]]*\([A-Za-z][A-Za-z-]*\)[[:space:]]*$/\1/p' "$task_file" | head -n 1 | tr '[:upper:]' '[:lower:]')"
  if [ -z "$risk" ]; then
    risk="normal"
  fi

  case "$risk" in
    low|normal|high|critical)
      printf '%s\n' "$risk"
      ;;
    *)
      printf '[%s] Unknown CODEX_TASK_RISK %s; using normal\n' "$worker_name" "$risk" >&2
      printf '%s\n' "normal"
      ;;
  esac
}

reasoning_effort_for_task() {
  task_file="$1"

  if [ "${CODEX_WORKER_REASONING_EFFORT+x}" = "x" ]; then
    configured="$CODEX_WORKER_REASONING_EFFORT"
    case "$configured" in
      inherit|low|medium|high|xhigh|max)
        printf '%s\n' "$configured"
        ;;
      *)
        printf '[%s] Unknown CODEX_WORKER_REASONING_EFFORT %s; using medium\n' "$worker_name" "$configured" >&2
        printf '%s\n' "medium"
        ;;
    esac
    return
  fi

  case "$(task_risk "$task_file")" in
    low) printf '%s\n' "low" ;;
    normal) printf '%s\n' "medium" ;;
    high) printf '%s\n' "high" ;;
    critical) printf '%s\n' "max" ;;
  esac
}

is_reasoning_unavailable_output() {
  output_file="$1"
  grep -Eiq 'reasoning([^[:alnum:]]+effort)?.*(not supported|unsupported|invalid)|model_reasoning_effort.*(not supported|unsupported|invalid)|unsupported.*reasoning' "$output_file"
}

fallback_reasoning_effort() {
  case "$1" in
    max|xhigh) printf '%s\n' "high" ;;
    *) printf '%s\n' "" ;;
  esac
}

run_codex_once() {
  prompt_file="$1"
  reasoning_effort="$2"
  worker_report="$3"
  output_file="$4"

  if [ "$reasoning_effort" = "inherit" ]; then
    codex exec --skip-git-repo-check --model "$worker_model" --output-last-message "$worker_report" < "$prompt_file" > "$output_file" 2>&1
  else
    reasoning_config="model_reasoning_effort=\"$reasoning_effort\""
    codex exec --skip-git-repo-check --model "$worker_model" -c "$reasoning_config" --output-last-message "$worker_report" < "$prompt_file" > "$output_file" 2>&1
  fi
}

run_codex_with_fallbacks() {
  prompt_file="$1"
  reasoning_effort="$2"
  worker_report="$3"

  attempt_effort="$reasoning_effort"
  output_file="$(mktemp "${TMPDIR:-/tmp}/codex-worker-model.XXXXXX")"

  while true; do
    : > "$output_file"
    : > "$worker_report"

    if run_codex_once "$prompt_file" "$attempt_effort" "$worker_report" "$output_file"; then
      cat "$output_file"
      rm -f "$output_file"
      return 0
    else
      status="$?"
    fi

    cat "$output_file"

    fallback_effort="$(fallback_reasoning_effort "$attempt_effort")"
    if [ -n "$fallback_effort" ] && is_reasoning_unavailable_output "$output_file"; then
      status_log "Reasoning effort unavailable; retrying with $fallback_effort: $attempt_effort"
      attempt_effort="$fallback_effort"
      continue
    fi

    rm -f "$output_file"
    return "$status"
  done
}

run_codex_task() {
  prompt_file="$1"
  worker_report="$2"
  reasoning_effort="$3"

  run_codex_with_fallbacks "$prompt_file" "$reasoning_effort" "$worker_report"
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

## Worker changed-files provenance

意図して作成・更新・削除したリポジトリ内ファイルは、変更後に必ず次の helper へ記録してください。

```sh
codex-queue/bin/worker-record-change.sh path/to/file another/file
```

複数ファイルを一度に渡して構いません。task 完了前に最終的な変更ファイル一覧を再確認し、漏れがあれば同じ helper で追記してください。

この記録は「この Worker が意図的に変更したファイル」の provenance です。他 Worker の同時変更、build artifact、cache、`summary/`、queue state は記録しません。共有 worktree 上の timestamp 差分は provenance として扱いません。
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
    changed_files_manifest="$(mktemp "${TMPDIR:-/tmp}/codex-worker-changes.XXXXXX")"
    runtime_prompt="$(make_runtime_prompt "$running")"
    progress_file="$(progress_file_for "$running")"
    risk="$(task_risk "$running")"
    reasoning_effort="$(reasoning_effort_for_task "$running")"

    export WORKER_PROGRESS_FILE="$progress_file"
    export WORKER_TASK_FILE="$running"
    export WORKER_PID="$$"
    export WORKER_NAME="$worker_name"

    provenance_enabled=0
    if [ -x "$change_recorder_script" ]; then
      export WORKER_CHANGED_FILES_FILE="$changed_files_manifest"
      export WORKER_PROJECT_ROOT="$watch_root"
      export WORKER_CHANGE_RECORDER="$change_recorder_script"
      provenance_enabled=1
    fi

    set_progress "$progress_file" 5 "starting" "Task claimed"
    status_log "Routing: model=$worker_model risk=$risk reasoning=$reasoning_effort"

    if run_codex_task "$runtime_prompt" "$worker_report" "$reasoning_effort" > "$run_output" 2>&1; then
      set_progress "$progress_file" 90 "finalizing" "Codex execution finished"
      cat "$run_output"
      if [ "$provenance_enabled" -eq 1 ]; then
        report_recorded_changed_files "$changed_files_manifest"
      fi
      mv "$running" "$root/done/$base"
      set_progress "$progress_file" 95 "summary" "Writing task summary"
      if [ "$provenance_enabled" -eq 1 ]; then
        summary_file="$("$script_dir/write-task-summary.sh" --status done --task "$root/done/$base" --changed-since "$changed_since" --changed-files-file "$changed_files_manifest" --watch-root "$watch_root" --worker "$worker_name" --kind worker-task --worker-report "$worker_report" || true)"
      else
        summary_file="$("$script_dir/write-task-summary.sh" --status done --task "$root/done/$base" --changed-since "$changed_since" --watch-root "$watch_root" --worker "$worker_name" --kind worker-task --worker-report "$worker_report" || true)"
      fi
      set_progress "$progress_file" 100 "done" "Task completed"
      rm -f "$changed_since"
      rm -f "$run_output" "$worker_report" "$changed_files_manifest"
      rm -f "$runtime_prompt" "$progress_file"
      if [ -n "$summary_file" ]; then
        status_log "Summary: $summary_file"
      fi
      status_log "Done: $root/done/$base"
    else
      set_progress "$progress_file" 90 "failed" "Codex execution failed"
      cat "$run_output"
      if [ "$provenance_enabled" -eq 1 ]; then
        report_recorded_changed_files "$changed_files_manifest"
      fi
      mv "$running" "$root/failed/$base"
      set_progress "$progress_file" 95 "summary" "Writing failure summary"
      if [ "$provenance_enabled" -eq 1 ]; then
        summary_file="$("$script_dir/write-task-summary.sh" --status failed --task "$root/failed/$base" --changed-since "$changed_since" --changed-files-file "$changed_files_manifest" --watch-root "$watch_root" --worker "$worker_name" --kind worker-task --failure-output "$run_output" || true)"
      else
        summary_file="$("$script_dir/write-task-summary.sh" --status failed --task "$root/failed/$base" --changed-since "$changed_since" --watch-root "$watch_root" --worker "$worker_name" --kind worker-task --failure-output "$run_output" || true)"
      fi
      set_progress "$progress_file" 100 "failed" "Task failed"
      rm -f "$changed_since"
      rm -f "$run_output" "$worker_report" "$changed_files_manifest"
      rm -f "$runtime_prompt" "$progress_file"
      if [ -n "$summary_file" ]; then
        status_log "Summary: $summary_file"
      fi
      status_log "Failed: $root/failed/$base"
    fi
  fi
done
