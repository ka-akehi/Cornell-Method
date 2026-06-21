# Summary Operation

`summary/` は、Worker task、`codex exec`、長い調査、実装確認の完了要約を保存する場所です。

このリポジトリでは raw log や長い command output を会話へ戻さず、次回作業では summary を先に読み、必要なファイルだけを確認します。

## File Naming

```text
summary/YYYYMMDD/HHMM-task-name.md
```

例:

```text
summary/20260621/1530-notes-api-validation.md
```

## Rules

- `summary/YYYYMMDD/` 配下の要約は、再開用の handoff / checkpoint として Git 管理する。
- 重い調査や実装 task の完了時は summary を 1 件残す。
- `reports/` は使わず、task 完了要約は `summary/` に集約する。
- raw log、長い command output、全文ファイルの再掲は summary に入れない。
- `Inputs Read` には主要な入力だけを書く。
- `Changes Made` には変更したファイルだけを書く。
- `Findings` では `fact / assumption / unknown` を分ける。
- `Next Read` には次回読む最小ファイルだけを書く。
- 後続作業の入力にする summary は `sh tools/check-summary.sh <summary-file>` で確認する。

## Minimal Workflow

1. 作業前に関連 summary があれば先に読む。
2. 必要な原文だけ `rg` / `sed` で確認する。
3. 作業後に `summary/task-summary-template.md` の粒度で要約を残す。
4. 次回は `Next Read` を起点に再開する。
