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
    assess-task-risk.sh
    enqueue-worker-task.sh
    write-task-summary.sh
    worker-record-change.sh
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

CODEX_RISK_IMPACT: 1
CODEX_RISK_REVERSIBILITY: 1
CODEX_RISK_VERIFICATION: 1
CODEX_RISK_FLAGS: none
CODEX_TASK_KIND: coding

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

CODEX_RISK_IMPACT: 1
CODEX_RISK_REVERSIBILITY: 1
CODEX_RISK_VERIFICATION: 1
CODEX_RISK_FLAGS: none

...
TASK
```

API タスク:

```sh
CODEX_QUEUE_ROOT=codex-queue/tasks-api \
codex-queue/bin/enqueue-worker-task.sh notes-api-link-fix <<'TASK'
# Worker Task

CODEX_RISK_IMPACT: 2
CODEX_RISK_REVERSIBILITY: 1
CODEX_RISK_VERIFICATION: 2
CODEX_RISK_FLAGS: persisted-state

...
TASK
```

## Workers

共通タスク Worker:

```sh
codex-queue/bin/worker-run.sh
```

すべての Worker task は `gpt-5.6-luna` を固定モデルとして使用します。通常 task / coding task / UI / API / 共通でモデルは切り替えません。

```md
CODEX_TASK_KIND: coding
```

`CODEX_TASK_KIND: coding` は task の性質を示す metadata としてだけ使用し、モデル選択には使用しません。
`CODEX_WORKER_MODEL` / `CODEX_CODING_WORKER_MODEL` によるモデル上書きは行いません。Luna が利用できない場合も model 指定なしや別モデルへ自動フォールバックせず、その task を失敗として扱います。

### Risk-based reasoning routing

新規 Worker task は、Manager が cohesive responsibility へ分割した後に構造化 Risk Assessment を行います。Manager が `low / normal / high / critical` を直接選ぶのではなく、task file に次の4項目を記述します。

```md
CODEX_RISK_IMPACT: 0|1|2|3
CODEX_RISK_REVERSIBILITY: 0|1|2|3
CODEX_RISK_VERIFICATION: 0|1|2|3
CODEX_RISK_FLAGS: none
```

`CODEX_RISK_FLAGS` は必要に応じて comma-separated で指定します。

- `persisted-state`: 永続状態の書き込み・整合性変更。最低 `high`
- `security`: auth / authorization / credential / security boundary。最低 `high`
- `concurrency`: race / lock / concurrent state。最低 `high`
- `destructive`: user/app state に対する破壊的操作。`critical`
- `migration-restore`: migration / restore / recovery semantics。`critical`
- `crypto-trust`: 暗号・署名・鍵・trust boundary。`critical`
- `data-loss`: 誤動作が現実的にデータ損失へつながり得る。`critical`

3軸の意味:

| 軸 | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| Impact | 実質影響なし | 単一機能・局所 | 複数境界・状態 | system-wide / 重大影響 |
| Reversibility | 即時復旧 | code/config revert | state recovery が必要 | 不可逆・復旧困難 |
| Verification | 静的確認 | targeted test | integration が必要 | 実機・timing・production-like が必要 |

base score は `Impact + Reversibility + Verification` です。

| score | risk | reasoning effort |
| --- | --- | --- |
| `0-2` | `low` | `low` |
| `3-5` | `normal` | `medium` |
| `6-7` | `high` | `high` |
| `8-9` | `critical` | `max` |

`codex-queue/bin/enqueue-worker-task.sh` は enqueue 前に `assess-task-risk.sh` を実行し、4 field の欠落・不正値・未知 flag を fail closed で拒否します。hard escalation flag がある場合は base risk より優先して最低 risk を引き上げます。

enqueue 後の task から assessment input は除去され、Worker には最小 metadata だけが渡ります。

```md
CODEX_TASK_RISK: high
CODEX_TASK_RISK_REASON: score=5(i=2,r=1,v=2);flags=persisted-state;floor=high:persisted-state
```

このため、新規 task では `CODEX_TASK_RISK` を手入力しません。既に queued/running に存在する旧 task については、runner の既存互換として `CODEX_TASK_RISK` がない場合 `normal` として扱います。

Luna が `max` / `xhigh` reasoning effort を受理しない場合だけ、runner が `high` へ一段フォールバックします。モデル自体は Luna のままです。
一時的に reasoning を固定する場合は `CODEX_WORKER_REASONING_EFFORT=low|medium|high|xhigh|max` を指定します。ローカル Codex の reasoning 設定をそのまま継承したい場合だけ `inherit` を指定します。`inherit` でもモデルは Luna 固定です。

```sh
CODEX_WORKER_REASONING_EFFORT=high codex-queue/bin/worker-run.sh
CODEX_WORKER_REASONING_EFFORT=inherit codex-queue/bin/worker-run.sh
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

### Changed-files provenance

共有 worktree の `mtime` だけでは、並列 Worker が変更したファイルを正しく帰属できません。
そのため `worker-run.sh` は Worker ごとの provenance manifest を作り、Worker が意図的に変更したファイルだけを `worker-record-change.sh` で記録します。

```sh
codex-queue/bin/worker-record-change.sh \
  src/server/infrastructure/desktop-storage.js \
  test/desktop/desktop-storage.test.js
```

runner は task prompt にこの記録ルールを自動追加します。`summary` の `Changes Made` と `Next Read` は provenance manifest を正本とし、同じ時間帯に別 Worker が更新したファイルや build/cache artifact を task の変更として扱いません。

timestamp による workspace activity は診断用途としてだけ残し、provenance manifest にない activity は「他 Worker / 並行処理の可能性がある未帰属 activity」として扱います。これは shared worktree 自体を隔離する仕組みではないため、同じ責務・同じファイルを同時に変更し得る task は Manager が並列投入しません。

Worker task の完了/失敗時には、`codex-queue/bin/write-task-summary.sh` が `summary/YYYYMMDD/HHMM-*-summary.md` を自動作成します。
summary には、変更ファイル、確認結果、次に読む最小ファイルを記録します。
成功時の `Worker Report` には、`codex exec --output-last-message` が出力した assistant の最終メッセージだけを保存します。
stdout / stderr の raw log、tool trace、`run_output` 全文は summary に保存しません。
最終メッセージの専用出力ファイルが空または存在しない場合も summary を作成し、取得できなかったことを記録します。
32,000 文字を超える最終メッセージは切り詰め、summary にその旨を明記します。
失敗時は raw log 全文ではなく、Worker が取得した実行出力から推定原因と短い抜粋を `Failure Reason` に残します。
最終メッセージの取得を有効にするには、起動中の各 Worker runner を再起動してください。
各 runner を再起動した後に処理を開始する task から `Worker Report` が追加されます。
`open-wezterm-worker-layout.sh` で起動した場合、通知 Worker は完了/失敗メッセージを Manager Codex pane へ転送します。
`WORKER_NOTIFY_AUTO_SUBMIT=0` を指定すると、メッセージ入力だけ行い自動送信を止められます。
同スクリプトで起動する最初の Worker ウィンドウには、`worker-status.sh --watch` の進捗監視ペインも作成されます。監視ペインは Common Worker の下側を 50% 使用し、UI / API Worker のログ領域を狭めない構成です。

## Queue Choice

- `tasks-ui`: React component、page、CSS、画面 UX。
- `tasks-api`: Route Handler、Prisma、validation、backup/export などサーバ側。
- `tasks`: README、依存関係、設定、横断調査、分類しにくい共通タスク。

## Operation Rules

- Manager は `running` / `done` / `failed` を直接編集しません。
- 1 タスク 1 目的を維持します。
- 1 task は **1 cohesive responsibility** を基本にします。1つの振る舞い、不変条件、契約、修正責務を完成させるために必要なら複数ファイルを同じ task で扱います。
- 実装本体・関連 test・同じ契約を表す型や境界を、ファイルが別という理由だけで別 Worker に分割しません。
- 独立して検証・統合できる別責務だけを別 task に分けます。複数目的を 1 task に詰め込むことは引き続き禁止します。
- 仕様詰め、棚卸し、調査、設計レビューの task では、Worker にコーディングをさせません。
- コーディングが必要になった場合は、仕様詰めや棚卸し task の完了後に別 task として作成し、task file に `CODEX_TASK_KIND: coding` を明記します。
- 仕様/調査 task と実装 task を 1 つの task file に同居させません。
- 互いに依存せず、対象責務や変更範囲が競合しない作業は、Manager が一度に複数の task file として作成して投入します。
- 同じ責務、同じ state invariant、同じ主要ファイルを変更し得る task は shared worktree 上で同時実行しません。
- 依存関係がある作業は、先行 task の summary または変更結果を確認してから次を投入します。
- Worker がユーザーへ追加質問しなくても着手できる粒度まで、Manager がタスクを具体化します。
- Manager は cohesive task を作成した後に Risk Assessment を実施し、4 assessment field を task に付与します。`CODEX_TASK_RISK` は enqueue 時に自動導出します。
- 既存作業を壊さないため、Worker は作業前後に `git status --short` を確認します。
