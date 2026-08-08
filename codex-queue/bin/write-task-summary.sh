#!/bin/sh
set -eu

status=""
task_file=""
changed_since=""
watch_root=""
worker_name=""
task_kind="worker-task"
failure_output=""
worker_report=""
worker_report_max_chars=32000

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
    --failure-output)
      failure_output="$2"
      shift 2
      ;;
    --worker-report)
      worker_report="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [ -z "$status" ] || [ -z "$task_file" ] || [ -z "$changed_since" ] || [ -z "$watch_root" ]; then
  echo "Usage: write-task-summary.sh --status <done|failed> --task <path> --changed-since <file> --watch-root <path> [--worker <name>] [--kind <kind>] [--failure-output <path>] [--worker-report <path>]" >&2
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
  ! -path "$watch_root/.next/*" \
  ! -path "$watch_root/codex-queue/.state/*" \
  ! -path "$watch_root/node_modules/*" \
  ! -path "$watch_root/coverage/*" \
  ! -path "$watch_root/playwright-report/*" \
  ! -path "$watch_root/test-results/*" \
  ! -path "$watch_root/out/*" \
  ! -path "$watch_root/build/*" \
  2>/dev/null | sed "s#^$watch_root/##" | sort || true)"

next_read_files="$(printf '%s\n' "$changed_files" | sed '/^$/d' | head -n 20)"

failure_reason=""
failure_excerpt=""
if [ "$status" = "failed" ] && [ -n "$failure_output" ] && [ -s "$failure_output" ]; then
  if grep -Eiq 'model.*not supported|unsupported.*model|invalid_request_error.*model|Model metadata for .* not found' "$failure_output"; then
    failure_reason="model unavailable or unsupported during Codex execution"
  elif grep -Eiq 'npm ERR!|Command failed|Failed to compile|Type error|ESLint|lint|build failed|error TS[0-9]+' "$failure_output"; then
    failure_reason="verification or build command failed"
  elif grep -Eiq 'permission denied|operation not permitted|EPERM|EACCES' "$failure_output"; then
    failure_reason="environment permission error"
  elif grep -Eiq 'timed out|timeout' "$failure_output"; then
    failure_reason="command timed out"
  else
    failure_reason="codex exec exited non-zero; see excerpt"
  fi

  failure_excerpt="$(grep -Ei 'ERROR:|error|failed|not supported|unsupported|permission denied|operation not permitted|EPERM|EACCES|Type error|ESLint|npm ERR!' "$failure_output" \
    | head -n 12 \
    | sed 's/[|]/\\|/g' \
    || true)"
  if [ -z "$failure_excerpt" ]; then
    failure_excerpt="$(tail -n 12 "$failure_output" | sed 's/[|]/\\|/g' || true)"
  fi
fi

worker_report_available=0
worker_report_truncated=0
if [ "$status" = "done" ] && [ -n "$worker_report" ] && [ -s "$worker_report" ]; then
  worker_report_available=1
  # Node decodes UTF-8 independently of LC_ALL; for...of counts Unicode code points.
  worker_report_chars="$(node -e '
    const fs = require("node:fs");
    const report = fs.readFileSync(process.argv[1], "utf8");
    const limit = Number(process.argv[2]);
    let count = 0;
    for (const character of report) {
      count += 1;
      if (count > limit) break;
    }
    process.stdout.write(String(count));
  ' "$worker_report" "$worker_report_max_chars")"
  if [ "$worker_report_chars" -gt "$worker_report_max_chars" ]; then
    worker_report_truncated=1
  fi
fi

write_truncated_worker_report() {
  node -e '
    const fs = require("node:fs");
    const report = fs.readFileSync(process.argv[1], "utf8");
    const limit = Number(process.argv[2]);
    const output = [];
    for (const character of report) {
      if (output.length >= limit) break;
      output.push(character);
    }
    process.stdout.write(output.join(""));
  ' "$worker_report" "$worker_report_max_chars"
}

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
  if [ "$status" = "failed" ] && [ -n "$failure_reason" ]; then
    printf '| F-003 | fact | 失敗理由の推定: %s | Failure Reason |\n' "$failure_reason"
  fi
  printf '| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |\n\n'

  if [ "$status" = "done" ]; then
    printf '## Worker Report\n\n'
    if [ "$worker_report_available" -eq 1 ]; then
      if [ "$worker_report_truncated" -eq 1 ]; then
        write_truncated_worker_report
        printf '\n\n'
        printf '%s\n\n' '> Worker Report は 32,000 文字の上限で切り詰めた。'
      else
        cat "$worker_report"
        printf '\n\n'
      fi
    else
      printf '%s\n\n' 'Worker の最終報告を取得できなかった（専用出力ファイルが空または存在しない）。'
    fi
  fi

  if [ "$status" = "failed" ]; then
    printf '## Failure Reason\n\n'
    if [ -n "$failure_reason" ]; then
      printf '%s\n' "- 推定原因: $failure_reason"
      printf '%s\n\n' '- raw log 全文は転記せず、原因特定に必要な短い抜粋のみ残す。'
      if [ -n "$failure_excerpt" ]; then
        printf '```text\n'
        printf '%s\n' "$failure_excerpt"
        printf '```\n\n'
      fi
    else
      printf '%s\n\n' '- task は failed だが、失敗出力を取得できなかった。'
    fi
  fi

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
    if [ -n "$failure_reason" ]; then
      printf '| U-001 | Failure Reason は短い抜粋による推定であり、完全な raw log 解析ではない | 必要時のみ worker 実行環境で再現確認 |\n'
    else
      printf '| U-001 | task 失敗の詳細原因 | `%s` と worker log の該当箇所 |\n' "$(printf '%s\n' "$task_file" | sed "s#^$watch_root/##")"
    fi
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
