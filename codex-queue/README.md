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
    worker-progress.sh
    worker-status.sh
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

Worker は通常 task では model を指定せずに `codex exec` を実行します。
コーディング task は、task file に次のマーカーがある場合だけ、既定で `GPT-5.3-Codex-Spark` を使います。Spark がこのアカウントや環境で使えない場合は、Worker が model unavailable を検出して model 指定なしの通常実行へフォールバックします。

```md
CODEX_TASK_KIND: coding
```

コーディング task の専用モデルを明示的に変えたい場合は、次のように `CODEX_CODING_WORKER_MODEL` を指定します。`none` を指定すると最初から model 指定なしで実行します。

```sh
CODEX_CODING_WORKER_MODEL=<model-id> codex-queue/bin/worker-run.sh
```

全 task の model を一時的に上書きする場合のみ、次のように `CODEX_WORKER_MODEL` を指定します。

```sh
CODEX_WORKER_MODEL=<model-id> codex-queue/bin/worker-run.sh
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

Worker の進捗確認:

```sh
# 1 回だけ現在の状態を表示
codex-queue/bin/worker-status.sh

# 2 秒ごとに更新して監視
codex-queue/bin/worker-status.sh --watch
```

`worker-status.sh` はキューごとに、`done + failed` を処理済みとした処理進捗、完了数、失敗数、実行中数、待機数、成功率を表示します。失敗は処理済みには数えますが、成功率には含めません。実行中 task の詳細な率は、Worker が `worker-progress.sh` で報告した値だけを表示し、未報告の場合は `未報告` と表示します。したがって、表示値は作業の見積りであり、コード変更量から自動推定した値ではありません。

Worker task の節目で進捗を更新する場合:

```sh
codex-queue/bin/worker-progress.sh 25 "調査完了"
codex-queue/bin/worker-progress.sh --percent 60 --phase "implementation" --message "実装完了"
```

`worker-run.sh` 経由で起動した Worker には状態ファイルの場所が自動設定されます。状態ファイルは `codex-queue/.state/` に保存され、Git 管理対象外です。Worker の完了・失敗時には runner が状態を終了処理し、task の移動と既存の summary 作成を従来どおり行います。

Worker は `queued` から `running` に移動できた `*.task.md` だけを実行し、終了後に `done` または `failed` へ移動します。

Worker task の完了/失敗時には、`codex-queue/bin/write-task-summary.sh` が `summary/YYYYMMDD/HHMM-*-summary.md` を自動作成します。
summary は raw log を含めず、変更ファイル、確認結果、次に読む最小ファイルだけを残します。
失敗時は raw log 全文ではなく、Worker が取得した実行出力から推定原因と短い抜粋を `Failure Reason` に残します。
`open-wezterm-worker-layout.sh` で起動した場合、通知 Worker は完了/失敗メッセージを Manager Codex pane へ転送します。
`WORKER_NOTIFY_AUTO_SUBMIT=0` を指定すると、メッセージ入力だけ行い自動送信を止められます。
同スクリプトで起動する最初の Worker ウィンドウには、`worker-status.sh --watch` の進捗監視ペインも作成されます。監視ペインは Common Worker の下側を 50% 使用し、UI / API Worker のログ領域を狭めない構成です。

## Queue Choice

- `tasks-ui`: React component、page、CSS、画面 UX。
- `tasks-api`: Route Handler、Prisma、validation、backup/export などサーバ側。
- `tasks`: README、依存関係、設定、横断調査、分類しにくい共通タスク。

## Operation Rules

- Manager は `running` / `done` / `failed` を直接編集しません。
- 1 タスク 1 目的を基本にします。
- 1 タスク 1 ファイルを原則とし、1 つの task file に複数 task を同居させません。
- 仕様詰め、棚卸し、調査、設計レビューの task では、Worker にコーディングをさせません。
- コーディングが必要になった場合は、仕様詰めや棚卸し task の完了後に別 task として作成し、task file に `CODEX_TASK_KIND: coding` を明記します。
- 仕様/調査 task と実装 task を 1 つの task file に同居させません。
- 互いに依存せず並行実行できる作業は、Manager が一度に複数の task file として作成して投入します。
- 依存関係がある作業は、先行 task の summary または変更結果を確認してから次を投入します。
- Worker がユーザーへ追加質問しなくても着手できる粒度まで、Manager がタスクを具体化します。
- 既存作業を壊さないため、Worker は作業前後に `git status --short` を確認します。
- 実装タスクでは、可能な範囲で lint/build/test などの検証コマンドを実行し、結果を報告します。
- 長い task log や command output はメイン会話に戻さず、必要な内容は `summary/` の `Next Read` を起点に再確認します。
