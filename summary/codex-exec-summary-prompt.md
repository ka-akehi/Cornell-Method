# Codex Exec Summary Prompt

以下の task を実行し、最終回答は `summary/task-summary-template.md` の粒度で短くまとめてください。

## Rules

- raw log や長い command output を最終回答に含めない。
- 読んだ主要ファイルだけを `Inputs Read` に記録する。
- 変更したファイルだけを `Changes Made` に記録する。
- 判断は `fact / assumption / unknown` に分離する。
- 次に読むべき最小ファイルだけを `Next Read` に記録する。
- 正本成果物を変更した場合は、変更内容と理由を短く記録する。

## Task

ここに task 内容を記載する。

