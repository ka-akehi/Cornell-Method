#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
queue_dir="$(dirname "$script_dir")"

task_root="${CODEX_QUEUE_ROOT:-$queue_dir/tasks}"
ui_task_root="${CODEX_UI_QUEUE_ROOT:-$queue_dir/tasks-ui}"
api_task_root="${CODEX_API_QUEUE_ROOT:-$queue_dir/tasks-api}"
interval="${WORKER_NOTIFY_INTERVAL:-2}"
worker_name="${WORKER_NAME:-Worker-notify}"

color_reset="$(printf '\033[0m')"
color_dim="$(printf '\033[2m')"
color_green="$(printf '\033[32m')"
color_yellow="$(printf '\033[33m')"
color_red="$(printf '\033[31m')"

mkdir -p \
  "$task_root/running" "$task_root/done" "$task_root/failed" \
  "$ui_task_root/running" "$ui_task_root/done" "$ui_task_root/failed" \
  "$api_task_root/running" "$api_task_root/done" "$api_task_root/failed"

seen_file="$(mktemp "${TMPDIR:-/tmp}/codex-worker-notify-seen.XXXXXX")"

cleanup() {
  rm -f "$seen_file"
}

trap cleanup EXIT
trap 'cleanup; exit 0' INT TERM

status_line() {
  printf '\r\033[2K%s[%s] %s%s' "$color_dim" "$worker_name" "$1" "$color_reset"
}

status_log() {
  printf '\r\033[2K%s[%s] %s%s\n' "$color_dim" "$worker_name" "$1" "$color_reset"
}

scan_notifiable_tasks() {
  find "$task_root/running" "$task_root/done" "$task_root/failed" \
    "$ui_task_root/running" "$ui_task_root/done" "$ui_task_root/failed" \
    "$api_task_root/running" "$api_task_root/done" "$api_task_root/failed" \
    -type f -name '*.task.md' 2>/dev/null | sort
}

task_kind_for() {
  case "$1" in
    "$task_root"/running/*) printf 'Common task started' ;;
    "$task_root"/done/*) printf 'Common task completed' ;;
    "$task_root"/failed/*) printf 'Common task failed' ;;
    "$ui_task_root"/running/*) printf 'UI task started' ;;
    "$ui_task_root"/done/*) printf 'UI task completed' ;;
    "$ui_task_root"/failed/*) printf 'UI task failed' ;;
    "$api_task_root"/running/*) printf 'API task started' ;;
    "$api_task_root"/done/*) printf 'API task completed' ;;
    "$api_task_root"/failed/*) printf 'API task failed' ;;
    *) printf 'Worker task updated' ;;
  esac
}

notify_task() {
  task="$1"
  kind="$(task_kind_for "$task")"
  task_base="$(basename "$task")"
  color="$color_yellow"

  case "$task" in
    */done/*) color="$color_green" ;;
    */failed/*) color="$color_red" ;;
    */running/*) color="$color_yellow" ;;
  esac

  status_log "${color}${kind}${color_reset}${color_dim}: $task_base"
}

scan_notifiable_tasks > "$seen_file"
status_log "Watching task starts and completions"

while true; do
  scan_notifiable_tasks | while IFS= read -r task; do
    if ! grep -Fxq "$task" "$seen_file"; then
      notify_task "$task"
      printf '%s\n' "$task" >> "$seen_file"
    fi
  done

  status_line "Waiting for task starts and completions"
  sleep "$interval"
done
