#!/bin/sh
set -eu

project_dir="${CODEX_PROJECT_DIR:-$HOME/Desktop/自己学習/Cornell-Method}"

send_command() {
  pane_id="$1"
  shift
  printf '%s\n' "$*" | wezterm cli send-text --pane-id "$pane_id" --no-paste
}

open_window() {
  wezterm cli spawn --new-window --cwd "$project_dir"
}

split_right() {
  pane_id="$1"
  percent="$2"
  wezterm cli split-pane --pane-id "$pane_id" --right --percent "$percent" --cwd "$project_dir"
}

split_bottom() {
  pane_id="$1"
  percent="$2"
  wezterm cli split-pane --pane-id "$pane_id" --bottom --percent "$percent" --cwd "$project_dir"
}

main_1="$(open_window)"
right_1="$(split_right "$main_1" 50)"
left_bottom_1="$(split_bottom "$main_1" 50)"

send_command "$main_1" "codex-queue/bin/notify-worker-run.sh"
send_command "$left_bottom_1" "codex"
send_command "$right_1" "codex"

main_2="$(open_window)"
right_2="$(split_right "$main_2" 50)"
right_bottom_2="$(split_bottom "$right_2" 50)"

send_command "$main_2" "codex-queue/bin/worker-run.sh"
send_command "$right_2" "codex-queue/bin/worker-ui-run.sh"
send_command "$right_bottom_2" "codex-queue/bin/worker-api-run.sh"
