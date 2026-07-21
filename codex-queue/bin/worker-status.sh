#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
queue_dir="$(dirname "$script_dir")"

common_root="${CODEX_QUEUE_ROOT:-$queue_dir/tasks}"
ui_root="${CODEX_UI_QUEUE_ROOT:-$queue_dir/tasks-ui}"
api_root="${CODEX_API_QUEUE_ROOT:-$queue_dir/tasks-api}"
state_dir="${CODEX_WORKER_STATE_DIR:-$queue_dir/.state}"
watch=0
interval="${WORKER_STATUS_INTERVAL:-2}"
queue_filter="all"

usage() {
  cat >&2 <<'USAGE'
Usage: worker-status.sh [--watch] [--interval <seconds>] [--queue all|common|ui|api]

Without --watch, print one snapshot. With --watch, refresh until interrupted.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --watch)
      watch=1
      shift
      ;;
    --interval)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      interval="$2"
      shift 2
      ;;
    --queue)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      queue_filter="$2"
      shift 2
      ;;
    -h|--help)
      usage >&1
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

case "$interval" in
  ''|*[!0-9]*)
    echo "Interval must be a positive integer." >&2
    exit 2
    ;;
esac

if [ "$interval" -lt 1 ]; then
  echo "Interval must be a positive integer." >&2
  exit 2
fi

case "$queue_filter" in
  all|common|ui|api) ;;
  *)
    echo "Queue must be all, common, ui, or api." >&2
    exit 2
    ;;
esac

count_tasks() {
  root="$1"
  state="$2"
  if [ ! -d "$root/$state" ]; then
    printf '0'
    return
  fi

  find "$root/$state" -type f -name '*.task.md' -print 2>/dev/null \
    | wc -l \
    | tr -d '[:space:]'
}

percent_of() {
  numerator="$1"
  denominator="$2"
  if [ "$denominator" -eq 0 ]; then
    printf '%s' '-'
    return
  fi

  awk -v numerator="$numerator" -v denominator="$denominator" \
    'BEGIN { printf "%.1f", (numerator * 100) / denominator }'
}

progress_file_for() {
  root="$1"
  task_file="$2"
  queue_name="$(basename "$root")"
  task_name="$(basename "$task_file")"
  printf '%s/progress/%s--%s.progress' "$state_dir" "$queue_name" "$task_name"
}

read_field() {
  field="$1"
  file="$2"
  if [ ! -f "$file" ]; then
    return
  fi

  sed -n "s/^${field}=//p" "$file" | head -n 1
}

valid_percent() {
  value="$1"
  case "$value" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$value" -le 100 ]
}

render_queue() {
  label="$1"
  root="$2"
  queued="$(count_tasks "$root" queued)"
  running="$(count_tasks "$root" running)"
  done_count="$(count_tasks "$root" done)"
  failed="$(count_tasks "$root" failed)"
  total=$((queued + running + done_count + failed))
  terminal=$((done_count + failed))

  all_total=$((all_total + total))
  all_terminal=$((all_terminal + terminal))

  if [ "$total" -eq 0 ]; then
    progress='-'
  else
    progress="$(percent_of "$terminal" "$total")"
  fi

  if [ "$terminal" -eq 0 ]; then
    success='-'
  else
    success="$(percent_of "$done_count" "$terminal")"
  fi

  printf '%-7s 処理進捗 %5s%% (%s/%s) | 完了 %s | 失敗 %s | 実行中 %s | 待機 %s | 成功率 %s%%\n' \
    "$label" "$progress" "$terminal" "$total" "$done_count" "$failed" "$running" "$queued" "$success"
}

render_active_tasks() {
  label="$1"
  root="$2"
  if [ ! -d "$root/running" ]; then
    return
  fi

  find "$root/running" -type f -name '*.task.md' -print 2>/dev/null | sort \
    | while IFS= read -r task_file; do
        [ -n "$task_file" ] || continue
        state_file="$(progress_file_for "$root" "$task_file")"
        percent="$(read_field percent "$state_file")"
        phase="$(read_field phase "$state_file")"
        message="$(read_field message "$state_file")"
        worker="$(read_field worker "$state_file")"
        updated_at="$(read_field updated_at "$state_file")"

        if ! valid_percent "$percent"; then
          percent='未報告'
        else
          percent="${percent}%"
        fi
        [ -n "$worker" ] || worker="$label"
        [ -n "$phase" ] || phase='working'
        [ -n "$message" ] || message=''
        [ -n "$updated_at" ] || updated_at='更新時刻不明'

        printf '  - %s [%s] %s | phase: %s | %s | %s\n' \
          "$worker" "$percent" "$(basename "$task_file" .task.md)" "$phase" "$message" "$updated_at"
      done
}

render_snapshot() {
  all_total=0
  all_terminal=0

  printf 'Worker status (%s)\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf '%s\n' 'Queue progress: done + failed を処理済みとして算出'

  case "$queue_filter" in
    all|common) render_queue 'Common' "$common_root" ;;
  esac
  case "$queue_filter" in
    all|ui) render_queue 'UI' "$ui_root" ;;
  esac
  case "$queue_filter" in
    all|api) render_queue 'API' "$api_root" ;;
  esac

  if [ "$all_total" -eq 0 ]; then
    overall='-'
  else
    overall="$(percent_of "$all_terminal" "$all_total")"
  fi
  printf 'Overall 処理進捗 %s%% (%s/%s)\n' "$overall" "$all_terminal" "$all_total"
  printf '%s\n' 'Active workers:'

  case "$queue_filter" in
    all|common) render_active_tasks 'Common' "$common_root" ;;
  esac
  case "$queue_filter" in
    all|ui) render_active_tasks 'UI' "$ui_root" ;;
  esac
  case "$queue_filter" in
    all|api) render_active_tasks 'API' "$api_root" ;;
  esac
}

if [ "$watch" -eq 0 ]; then
  render_snapshot
  exit 0
fi

while true; do
  printf '\033[H\033[2J'
  render_snapshot
  sleep "$interval"
done
