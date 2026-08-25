# Worker Task

CODEX_TASK_RISK: normal

あなたは Worker Codex です。
このタスクだけを実行してください。

`CODEX_TASK_RISK` は Manager が task 作成時に `low / normal / high / critical` から選択します。
コーディング task の場合だけ、`CODEX_TASK_RISK` の次に `CODEX_TASK_KIND: coding` を追加します。

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
