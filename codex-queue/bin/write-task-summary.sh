#!/bin/sh
set -eu

status=""
task_file=""
changed_since=""
watch_root=""
worker_name=""
task_kind="worker-task"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --status)
      status="$2"
      shift 2
      ;;
    --task)
      task_file="$2"
      shift 2
      ;;
    --changed-since)
      changed_since="$2"
      shift 2
      ;;
    --watch-root)
      watch_root="$2"
      shift 2
      ;;
    --worker)
      worker_name="$2"
      shift 2
      ;;
    --kind)
      task_kind="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [ -z "$status" ] || [ -z "$task_file" ] || [ -z "$changed_since" ] || [ -z "$watch_root" ]; then
  echo "Usage: write-task-summary.sh --status <done|failed> --task <path> --changed-since <file> --watch-root <path> [--worker <name>] [--kind <kind>]" >&2
  exit 2
fi

date_dir="$(date +%Y%m%d)"
time_part="$(date +%H%M)"
summary_dir="$watch_root/summary/$date_dir"
mkdir -p "$summary_dir"

base="$(basename "$task_file")"
slug="$(printf '%s\n' "$base" \
  | sed 's/[.]task[.]md$//' \
  | sed 's/[^A-Za-z0-9._-]/-/g' \
  | sed 's/--*/-/g' \
  | cut -c 1-80)"

case "$slug" in
  "") slug="queue-task" ;;
esac

summary_file="$summary_dir/$time_part-$slug-summary.md"
if [ -e "$summary_file" ]; then
  summary_file="$summary_dir/$time_part-$slug-$$-summary.md"
fi

changed_files="$(find "$watch_root" -type f -newer "$changed_since" \
  ! -path "$watch_root/.git/*" \
  ! -path "$watch_root/codex-queue/tasks/*" \
  ! -path "$watch_root/codex-queue/tasks-ui/*" \
  ! -path "$watch_root/codex-queue/tasks-api/*" \
  ! -path "$watch_root/summary/*" \
  2>/dev/null | sed "s#^$watch_root/##" | sort || true)"

next_read_files="$(printf '%s\n' "$changed_files" | sed '/^$/d' | head -n 20)"

{
  printf '%s\n' '---'
  printf 'summary_type: task-summary\n'
  printf 'created_at: %s JST\n' "$(date '+%Y-%m-%d %H:%M')"
  printf 'task_kind: %s\n' "$task_kind"
  printf 'task_status: %s\n' "$status"
  printf '%s\n\n' '---'

  printf '## Objective\n\n'
  printf '`%s` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。\n\n' "$base"

  printf '## Scope\n\n'
  printf '| 項目 | 内容 |\n'
  printf '|---|---|\n'
  printf '| task kind | `%s` |\n' "$task_kind"
  printf '| worker | `%s` |\n' "${worker_name:-unknown}"
  printf '| status | `%s` |\n' "$status"
  printf '| task file | `%s` |\n' "$(printf '%s\n' "$task_file" | sed "s#^$watch_root/##")"
  printf '| raw log | out of scope |\n\n'

  printf '## Inputs Read\n\n'
  printf '| 種別 | パス | 確認内容 |\n'
  printf '|---|---|---|\n'
  printf '| task | `%s` | task 完了状態の起点 |\n' "$(printf '%s\n' "$task_file" | sed "s#^$watch_root/##")"
  printf '| changed files | worker timestamp | task 実行中に更新された成果物の確認 |\n\n'

  printf '## Changes Made\n\n'
  printf '| パス | 変更内容 | 理由 |\n'
  printf '|---|---|---|\n'
  if [ -n "$changed_files" ]; then
    printf '%s\n' "$changed_files" | while IFS= read -r changed_file; do
      [ -n "$changed_file" ] || continue
      printf '| `%s` | task 実行中に作成または更新 | `%s` の実行結果 |\n' "$changed_file" "$base"
    done
  else
    printf '| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |\n'
  fi
  printf '\n'

  printf '## Findings\n\n'
  printf '| ID | fact / assumption / unknown | 内容 | 根拠 |\n'
  printf '|---|---|---|---|\n'
  printf '| F-001 | fact | task は `%s` として完了処理された。 | `%s` |\n' "$status" "$(printf '%s\n' "$task_file" | sed "s#^$watch_root/##")"
  if [ -n "$changed_files" ]; then
    printf '| F-002 | fact | task 実行中に成果物の作成または更新があった。 | Changes Made |\n'
  else
    printf '| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |\n'
  fi
  printf '| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |\n\n'

  printf '## Verification\n\n'
  printf '| 確認項目 | 結果 | 備考 |\n'
  printf '|---|---|---|\n'
  printf '| summary file created | 完了 | `%s` |\n' "$(printf '%s\n' "$summary_file" | sed "s#^$watch_root/##")"
  printf '| required headings | 完了 | template 必須見出しを含む |\n'
  printf '| raw log suppression | 完了 | raw log 本文は転記していない |\n'
  printf '| `tools/check-summary.sh` | 実行前 | writer script が作成後に実行する |\n\n'

  printf '## Remaining Unknowns\n\n'
  printf '| ID | 未確認事項 | 次に必要な根拠 |\n'
  printf '|---|---|---|\n'
  if [ "$status" = "failed" ]; then
    printf '| U-001 | task 失敗の詳細原因 | `%s` と worker log の該当箇所 |\n' "$(printf '%s\n' "$task_file" | sed "s#^$watch_root/##")"
  else
    printf '| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |\n'
  fi
  printf '\n'

  printf '## Next Read\n\n'
  printf '次の作業では、まずこの summary を読む。\n\n'
  printf -- '- `%s`\n' "$(printf '%s\n' "$summary_file" | sed "s#^$watch_root/##")"
  if [ -n "$next_read_files" ]; then
    printf '%s\n' "$next_read_files" | while IFS= read -r next_read; do
      [ -n "$next_read" ] || continue
      printf -- '- `%s`\n' "$next_read"
    done
  fi
} > "$summary_file"

check_cmd="$watch_root/tools/check-summary.sh"
if sh "$check_cmd" "$summary_file"; then
  tmp_file="$(mktemp "${TMPDIR:-/tmp}/codex-summary.XXXXXX")"
  awk '
    /\| `tools\/check-summary[.]sh` \| 実行前 \|/ {
      print "| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |"
      next
    }
    { print }
  ' "$summary_file" > "$tmp_file"
  mv "$tmp_file" "$summary_file"
fi

printf '%s\n' "$summary_file"
