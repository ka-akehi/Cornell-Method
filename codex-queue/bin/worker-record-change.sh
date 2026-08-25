#!/bin/sh
set -eu

manifest="${WORKER_CHANGED_FILES_FILE:-}"
project_root="${WORKER_PROJECT_ROOT:-}"

if [ -z "$manifest" ] || [ -z "$project_root" ]; then
  echo "WORKER_CHANGED_FILES_FILE and WORKER_PROJECT_ROOT are required" >&2
  exit 2
fi

if [ "$#" -eq 0 ]; then
  echo "Usage: worker-record-change.sh <repo-relative-path> [...]" >&2
  exit 2
fi

mkdir -p "$(dirname "$manifest")"
touch "$manifest"

record_path() {
  input="$1"

  case "$input" in
    "$project_root"/*)
      relative="${input#"$project_root"/}"
      ;;
    /*)
      echo "Refusing path outside Worker project root: $input" >&2
      return 2
      ;;
    *)
      relative="$input"
      ;;
  esac

  while [ "${relative#./}" != "$relative" ]; do
    relative="${relative#./}"
  done

  case "$relative" in
    ""|..|../*|*/..|*/../*)
      echo "Refusing non-repository-relative path: $input" >&2
      return 2
      ;;
  esac

  case "$relative" in
    .git/*|\
    codex-queue/tasks/*|\
    codex-queue/tasks-ui/*|\
    codex-queue/tasks-api/*|\
    codex-queue/.state/*|\
    summary/*|\
    .next/*|\
    node_modules/*|\
    coverage/*|\
    playwright-report/*|\
    test-results/*|\
    out/*|\
    build/*|\
    src-tauri/target/*|\
    src-tauri/gen/*)
      return 0
      ;;
  esac

  if ! grep -Fqx -- "$relative" "$manifest" 2>/dev/null; then
    printf '%s\n' "$relative" >> "$manifest"
  fi
}

for path in "$@"; do
  record_path "$path"
done
