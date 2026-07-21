#!/bin/sh
set -eu

progress_file="${WORKER_PROGRESS_FILE:-}"
percent=""
phase="working"
message=""
clear_progress=0

usage() {
  cat >&2 <<'USAGE'
Usage:
  worker-progress.sh <percent> [message]
  worker-progress.sh --percent <0-100> [--phase <name>] [--message <text>]
  worker-progress.sh --clear

The worker runner supplies WORKER_PROGRESS_FILE automatically.
Use --file <path> when updating a progress file manually.
USAGE
}

single_line() {
  printf '%s' "$1" | tr '\r\n' '  ' | cut -c 1-240
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --file|--progress-file)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      progress_file="$2"
      shift 2
      ;;
    --percent)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      percent="$2"
      shift 2
      ;;
    --phase)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      phase="$2"
      shift 2
      ;;
    --message)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      message="$2"
      shift 2
      ;;
    --clear)
      clear_progress=1
      shift
      ;;
    -h|--help)
      usage >&1
      exit 0
      ;;
    --*)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
    *)
      if [ -z "$percent" ]; then
        percent="$1"
      elif [ -z "$message" ]; then
        message="$1"
      else
        echo "Unexpected argument: $1" >&2
        usage
        exit 2
      fi
      shift
      ;;
  esac
done

if [ -z "$progress_file" ]; then
  echo "WORKER_PROGRESS_FILE is not set; use --file <path>." >&2
  exit 2
fi

if [ "$clear_progress" -eq 1 ]; then
  rm -f "$progress_file"
  exit 0
fi

case "$percent" in
  ''|*[!0-9]*)
    echo "Progress must be an integer from 0 to 100." >&2
    exit 2
    ;;
esac

if [ "$percent" -gt 100 ]; then
  echo "Progress must be an integer from 0 to 100." >&2
  exit 2
fi

progress_dir="$(dirname "$progress_file")"
mkdir -p "$progress_dir"
temporary_file="$progress_file.tmp.$$"
trap 'rm -f "$temporary_file"' EXIT HUP INT TERM

{
  printf 'percent=%s\n' "$percent"
  printf 'phase=%s\n' "$(single_line "$phase")"
  printf 'message=%s\n' "$(single_line "$message")"
  printf 'worker=%s\n' "$(single_line "${WORKER_NAME:-unknown}")"
  printf 'task=%s\n' "$(single_line "${WORKER_TASK_FILE:-unknown}")"
  printf 'pid=%s\n' "${WORKER_PID:-$$}"
  printf 'updated_at=%s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')"
} > "$temporary_file"

mv "$temporary_file" "$progress_file"
trap - EXIT HUP INT TERM
