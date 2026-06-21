---
summary_type: task-summary
created_at: 2026-06-21 15:17 JST
task_kind: direct-agent-task
task_status: done
---

## Objective

Cornell Method Notebook リポジトリへ、トークン消費を抑えるための最小 summary 運用を導入する。
`/Users/kazuya/Downloads/prompts` 側の運用をそのまま移植せず、このリポジトリの Manager / Worker 実装タスクに合う軽量構成にする。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | summary 運用、Worker 完了時 summary 自動生成、Manager / Worker ドキュメント |
| 対象ファイル / ディレクトリ | `summary/`, `tools/`, `codex-queue/bin/`, `codex-queue/README.md`, `codex-queue/prompts/`, `AGENTS.md` |
| 対象外 | h5i の本格 schema、prompt-task Worker、As-Is 専用 Structured Context 運用、既存 `open-wezterm-worker-layout.sh` の変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repo rule | `AGENTS.md` | Manager / Worker 方針、作業前 git status、設計学習メモ方針を確認した。 |
| queue docs | `codex-queue/README.md` | 既存 queue 構成、UI / API / 共通 task 分離を確認した。 |
| queue script | `codex-queue/bin/worker-run.sh` | Worker 完了時に task を `done` / `failed` へ移す箇所を確認した。 |
| external reference | `/Users/kazuya/Downloads/prompts/summary/*`, `/Users/kazuya/Downloads/prompts/codex-queue/bin/write-task-summary.sh` | summary テンプレート、check script、Worker 自動 summary の最小要素を確認した。 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/README.md` | summary 運用ルールを追加 | 次回以降、raw log を戻さず summary 起点で再開するため。 |
| `summary/task-summary-template.md` | task 完了要約テンプレートを追加 | Manager / Worker / direct task の出力粒度を揃えるため。 |
| `summary/task-request-template.md` | task 依頼テンプレートを追加 | 長い調査や別 task への切り出し時の入力を安定させるため。 |
| `summary/task-checkpoint-template.md` | 中断 / 再開用 checkpoint テンプレートを追加 | 長い作業を中断しても最小情報で再開できるようにするため。 |
| `summary/codex-exec-summary-prompt.md` | `codex exec` 用 summary 出力プロンプトを追加 | 重い調査の最終出力を summary に固定するため。 |
| `tools/check-summary.sh` | summary 必須見出しチェックを追加 | 後続入力にする summary の最低限の構造を検査するため。 |
| `tools/run-summary-task.sh` | `codex exec --output-last-message` 補助を追加 | 長い調査を summary 出力へ逃がしやすくするため。 |
| `codex-queue/bin/write-task-summary.sh` | Worker 完了時 summary writer を追加 | `worker-run.sh` 経由の task 完了 / 失敗を自動で短く記録するため。 |
| `codex-queue/bin/worker-run.sh` | 完了 / 失敗時に `write-task-summary.sh` を呼ぶ処理を追加 | Worker task の raw log 再読を避けるため。 |
| `AGENTS.md` | Task Summary 運用を Primary Reference / policy に追記 | リポジトリ全体の運用ルールとして明示するため。 |
| `codex-queue/README.md` | Worker summary 自動生成と raw log 抑制を追記 | queue 利用時の運用を明文化するため。 |
| `codex-queue/prompts/manager-codex.md` | Manager の summary 利用ルールを追記 | Manager が summary の `Next Read` を起点に再開するため。 |
| `codex-queue/prompts/worker-task-template.md` | Worker task の raw log 抑制と summary 自動生成を追記 | Worker task 作成時の制約に含めるため。 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | このリポジトリには既に `codex-queue/tasks`, `tasks-ui`, `tasks-api` の軽量 Manager / Worker 運用がある。 | `codex-queue/README.md` |
| F-002 | fact | 既存 `worker-run.sh` は変更ファイル一覧を端末に出すだけで、summary ファイルには残していなかった。 | `codex-queue/bin/worker-run.sh` |
| F-003 | fact | `codex-queue/bin/open-wezterm-worker-layout.sh` には作業前から未コミット変更があった。 | `git status --short` |
| A-001 | assumption | 最初の導入は h5i 本格導入ではなく、summary / checkpoint / Worker 自動 summary の最小構成で十分である。 | ユーザー要望「まずは最小構成」と既存 queue 構成 |
| U-001 | unknown | h5i の具体的な checkpoint / claim schema は未確定。 | 今回は summary 最小導入に限定したため。 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `sh tools/check-summary.sh summary/task-summary-template.md` | 成功 | summary テンプレートの必須見出しを確認した。 |
| `sh -n tools/check-summary.sh` | 成功 | 構文確認。 |
| `sh -n tools/run-summary-task.sh` | 成功 | 構文確認。 |
| `sh -n codex-queue/bin/write-task-summary.sh` | 成功 | 構文確認。 |
| `sh -n codex-queue/bin/worker-run.sh` | 成功 | 構文確認。 |
| `git status --short` | 確認 | 今回変更に加え、既存の `codex-queue/bin/open-wezterm-worker-layout.sh` 変更が残っている。 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 実際の Worker 実行で summary 自動生成が期待どおり動くか。 | 次回以降の小さな Worker task 実行結果。 |
| U-002 | h5i の checkpoint / claim schema をどの粒度にするか。 | summary 運用を 1〜2 task 回した後の実例。 |

## Next Read

次に summary 運用を確認または拡張する場合は、以下だけを読む。

- `summary/README.md`
- `summary/20260621/1517-summary-operation-minimal-introduction.md`
- `codex-queue/bin/worker-run.sh`
- `codex-queue/bin/write-task-summary.sh`
- `tools/check-summary.sh`

