---
summary_type: task-summary
created_at: 2026-07-26 22:19 JST
task_kind: worker-task
task_status: done
---

## Objective

安全な allowlist 付きで Markdown Preview に u、mark、details/summary の DocBase 基本拡張を追加する。

## Scope

| 項目 | 内容 |
|---|---|
| task file | `codex-queue/tasks/done/implement-safe-docbase-markdown-extensions-20260726-f50ea9fa.task.md` |
| worker | Worker-common |
| status | done |
| 対象 | Markdown renderer、rehype-raw dependency、sanitize 契約テスト |
| 対象外 | 任意色/サイズ、Math、Mermaid、PlantUML、埋め込み、API/DB |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/implement-safe-docbase-markdown-extensions-20260726-f50ea9fa.task.md` | allowlist と安全性の完了条件 |
| source | `src/shared/markdown/markdown-field.tsx` | rehype pipeline と custom components |
| package | `package.json` / `package-lock.json` | dependency と lock の整合 |
| test | `test/notes/markdown-preview-contract.test.js` | safe/unsafe HTML の契約 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/shared/markdown/markdown-field.tsx` | rehype-raw、safe schema、u/mark/details/summary renderer を追加 | DocBase 基本拡張を制限付きで表示するため |
| `package.json` | `rehype-raw` を dependency に追加 | raw HTML parsing を明示依存にするため |
| `package-lock.json` | `rehype-raw` の lock を同期 | package manifest と一致させるため |
| `test/notes/markdown-preview-contract.test.js` | allowlist と危険 HTML 除去の契約を追加 | sanitize の回帰を検知するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は done として完了処理された。 | task file |
| F-002 | fact | renderer、package manifest/lock、preview 契約テストが実差分にある。 | `HEAD^..HEAD` の source/test/package diff |
| U-001 | unknown | lint、build、実ブラウザでの開閉・sanitize 確認結果は、この summary からは確認できない。 | 元taskの記録に結果なし |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `sh tools/check-summary.sh summary/20260726/2219-implement-safe-docbase-markdown-extensions-20260726-f50ea9fa-summary.md` | PASS | 必須見出しと形式を確認 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 元taskの lint/build と実 preview の安全性確認 | task 実行記録または再実行結果 |

## Next Read

- `src/shared/markdown/markdown-field.tsx`
- `package.json`
- `package-lock.json`
- `test/notes/markdown-preview-contract.test.js`
