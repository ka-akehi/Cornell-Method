#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
queue_dir="$(dirname "$script_dir")"

task_root="${CODEX_QUEUE_ROOT:-$queue_dir/tasks}"
ui_task_root="${CODEX_UI_QUEUE_ROOT:-$queue_dir/tasks-ui}"
api_task_root="${CODEX_API_QUEUE_ROOT:-$queue_dir/tasks-api}"
interval="${WORKER_NOTIFY_INTERVAL:-2}"
worker_name="${WORKER_NAME:-Worker-notify}"
target_pane_id="${WORKER_NOTIFY_TARGET_PANE_ID:-}"
auto_submit="${WORKER_NOTIFY_AUTO_SUBMIT:-1}"
submit_delay="${WORKER_NOTIFY_SUBMIT_DELAY:-0.2}"

if [ -z "$target_pane_id" ] && [ -n "${WEZTERM_PANE:-}" ]; then
  target_pane_id="$(wezterm cli get-pane-direction Right --pane-id "$WEZTERM_PANE" 2>/dev/null || true)"
fi

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

scan_running_tasks() {
  find "$task_root/running" \
    "$ui_task_root/running" \
    "$api_task_root/running" \
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

running_task_label_for() {
  case "$1" in
    "$task_root"/running/*) printf 'Common task' ;;
    "$ui_task_root"/running/*) printf 'UI task' ;;
    "$api_task_root"/running/*) printf 'API task' ;;
    *) printf 'Worker task' ;;
  esac
}

running_tasks_message() {
  scan_running_tasks | while IFS= read -r running_task; do
    running_label="$(running_task_label_for "$running_task")"
    running_base="$(basename "$running_task")"
    printf '現在 %s %s が進行中です。\n' "$running_label" "$running_base"
  done
}

send_target_message() {
  if ! printf '%s' "$1" | wezterm cli send-text --pane-id "$target_pane_id" --no-paste; then
    status_log "${color_red}Failed to send completion message to pane $target_pane_id${color_reset}"
    return
  fi

  if [ "$auto_submit" = "1" ]; then
    sleep "$submit_delay"
    if ! printf '\r' | wezterm cli send-text --pane-id "$target_pane_id" --no-paste; then
      status_log "${color_red}Failed to submit completion message to pane $target_pane_id${color_reset}"
    fi
  fi
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

  case "$kind" in
    *" completed"|*" failed")
      if [ -n "$target_pane_id" ]; then
        running_message="$(running_tasks_message)"
        if [ -n "$running_message" ]; then
          message="$(printf '%s\n%s' "Worker-notify observed ${kind}: ${task_base}" "$running_message")"
        else
          message="Worker-notify observed ${kind}: ${task_base}"
        fi
        send_target_message "$message"
      fi
      ;;
  esac
}

scan_notifiable_tasks > "$seen_file"
if [ -n "$target_pane_id" ]; then
  status_log "Watching task starts, completions, and failures; completion/failure messages target pane $target_pane_id"
else
  status_log "Watching task starts, completions, and failures; completion/failure messages have no target pane"
fi

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
