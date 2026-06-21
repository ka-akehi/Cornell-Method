# Codex Manager / Worker Queue

このリポジトリで Codex を Manager / Worker に分けて運用するための軽量キューです。

Manager はユーザーと相談してタスクを切り出し、Worker は `codex-queue` のキューに置かれたタスクだけを実行します。

## Structure

```text
codex-queue/
  prompts/
    manager-codex.md
    worker-task-template.md
  bin/
    enqueue-worker-task.sh
    write-task-summary.sh
    worker-run.sh
    worker-ui-run.sh
    worker-api-run.sh
    notify-worker-run.sh
  tasks/
    queued/
    running/
    done/
    failed/
  tasks-ui/
    queued/
    running/
    done/
    failed/
  tasks-api/
    queued/
    running/
    done/
    failed/
```

## Manager

Manager 側は通常どおり Codex を起動し、`codex-queue/prompts/manager-codex.md` を運用指示として使います。

```sh
codex
```

タスク投入例:

```sh
codex-queue/bin/enqueue-worker-task.sh fix-dependency-lock <<'TASK'
# Worker Task

あなたは Worker Codex です。
このタスクだけを実行してください。

## 背景

...

## 目的

...

## 対象

- ...

## 作業内容

- ...

## 完了条件

- ...

## 制約

- ...
TASK
```

UI タスク:

```sh
CODEX_QUEUE_ROOT=codex-queue/tasks-ui \
codex-queue/bin/enqueue-worker-task.sh note-editor-validation-ui <<'TASK'
# Worker Task

...
TASK
```

API タスク:

```sh
CODEX_QUEUE_ROOT=codex-queue/tasks-api \
codex-queue/bin/enqueue-worker-task.sh notes-api-link-fix <<'TASK'
# Worker Task

...
TASK
```

## Workers

共通タスク Worker:

```sh
codex-queue/bin/worker-run.sh
```

UI タスク Worker:

```sh
codex-queue/bin/worker-ui-run.sh
```

API タスク Worker:

```sh
codex-queue/bin/worker-api-run.sh
```

通知 Worker:

```sh
codex-queue/bin/notify-worker-run.sh
```

完了/失敗通知を別の WezTerm pane に転送する場合:

```sh
WORKER_NOTIFY_TARGET_PANE_ID=<pane-id> codex-queue/bin/notify-worker-run.sh
```

Worker は `queued` から `running` に移動できた `*.task.md` だけを実行し、終了後に `done` または `failed` へ移動します。

Worker task の完了/失敗時には、`codex-queue/bin/write-task-summary.sh` が `summary/YYYYMMDD/HHMM-*-summary.md` を自動作成します。
summary は raw log を含めず、変更ファイル、確認結果、次に読む最小ファイルだけを残します。
`open-wezterm-worker-layout.sh` で起動した場合、通知 Worker は完了/失敗メッセージを Manager Codex pane へ転送します。
`WORKER_NOTIFY_AUTO_SUBMIT=0` を指定すると、メッセージ入力だけ行い自動送信を止められます。

## Queue Choice

- `tasks-ui`: React component、page、CSS、画面 UX。
- `tasks-api`: Route Handler、Prisma、validation、backup/export などサーバ側。
- `tasks`: README、依存関係、設定、横断調査、分類しにくい共通タスク。

## Operation Rules

- Manager は `running` / `done` / `failed` を直接編集しません。
- 1 タスク 1 目的を基本にします。
- 1 タスク 1 ファイルを原則とし、1 つの task file に複数 task を同居させません。
- 互いに依存せず並行実行できる作業は、Manager が一度に複数の task file として作成して投入します。
- 依存関係がある作業は、先行 task の summary または変更結果を確認してから次を投入します。
- Worker がユーザーへ追加質問しなくても着手できる粒度まで、Manager がタスクを具体化します。
- 既存作業を壊さないため、Worker は作業前後に `git status --short` を確認します。
- 実装タスクでは、可能な範囲で lint/build/test などの検証コマンドを実行し、結果を報告します。
- 長い task log や command output はメイン会話に戻さず、必要な内容は `summary/` の `Next Read` を起点に再確認します。
