# Worker Task

CODEX_RISK_IMPACT: 1
CODEX_RISK_REVERSIBILITY: 1
CODEX_RISK_VERIFICATION: 1
CODEX_RISK_FLAGS: none

あなたは Worker Codex です。
このタスクだけを実行してください。

新規 task では `CODEX_TASK_RISK` を直接書きません。Manager が task 分割後に上記4項目を評価し、`enqueue-worker-task.sh` が `low / normal / high / critical` を自動導出します。queued task では評価入力を除去し、`CODEX_TASK_RISK` と短い `CODEX_TASK_RISK_REASON` だけを Worker に渡します。

コーディング task の場合だけ、risk assessment field の次に `CODEX_TASK_KIND: coding` を追加します。

`CODEX_RISK_FLAGS` は該当なしなら `none`、該当する場合は次から comma-separated で指定します。

- `persisted-state`
- `security`
- `concurrency`
- `destructive`
- `migration-restore`
- `crypto-trust`
- `data-loss`

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

## 進捗報告

`codex-queue/bin/worker-run.sh` 経由で実行される場合、作業の節目で次のコマンドを使って 0〜100 の見積り進捗を更新する。

```sh
codex-queue/bin/worker-progress.sh --percent 25 --phase "調査" --message "対象確認完了"
codex-queue/bin/worker-progress.sh --percent 60 --phase "実装" --message "実装完了"
codex-queue/bin/worker-progress.sh --percent 85 --phase "検証" --message "検証中"
```

進捗報告に失敗しても task の作業や完了報告は止めない。完了・失敗の状態は Worker runner が記録する。

## Changed-files provenance

意図的に作成・更新・削除したリポジトリ内ファイルは変更後に記録する。

```sh
codex-queue/bin/worker-record-change.sh path/to/file another/file
```

task 完了前に変更ファイル一覧を再確認し、記録漏れがあれば追記する。
build artifact、cache、`summary/`、queue state、他 Worker の変更は記録しない。

## 制約

- 1 task は 1 cohesive responsibility とし、同じ責務を完成させるために必要なら複数ファイルを扱ってよい
- ファイルが別という理由だけで、同じ実装・型・関連 test を別 task に分けない
- 作業前後に `git status --short` を確認する
- 対象外のリファクタリングをしない
- ユーザーの未コミット変更を戻さない
- 仕様詰め、棚卸し、調査、設計レビューの task ではコード・設定・依存関係・生成物を変更しない
- 可能な範囲で検証コマンドを実行する
- 検証できなかった場合は理由を報告する
- 完了後、変更ファイル、変更内容、検証結果を簡潔に報告する
- raw log や長い command output を最終回答に含めない
- `codex-queue/bin/worker-run.sh` 経由の場合、完了/失敗時に summary が自動作成される
