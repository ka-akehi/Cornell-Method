---
summary_type: task-summary
created_at: 2026-08-09 16:23 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-summary-hydration-mismatch-20260809-bfe71a4d.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-summary-hydration-mismatch-20260809-bfe71a4d.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-summary-hydration-mismatch-20260809-bfe71a4d.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-summary-hydration-mismatch-20260809-bfe71a4d.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査結果として、今回の変更だけでは hydration warning を再現できませんでした。コード変更もありません。

### 確認結果

- [`markdown-field.tsx:249`](/Users/blp542/Desktop/自己学習/Cornell-Method/src/shared/markdown/markdown-field.tsx:249)
  - raw HTML input: `checked`、`readOnly`、`disabled`、`tabIndex=-1`、状態別 `aria-label`。task index は消費しない。
  - GFM input: document order で task index を加算し、`checked` と `タスク N` の `aria-label` を生成。
  - 保存中のみ GFM input に `readOnly`、`disabled`、`tabIndex=-1` を付与。
- [`modes.tsx:46`](/Users/blp542/Desktop/自己学習/Cornell-Method/src/modules/notes/ui/components/detail/modes.tsx:46) の初期 state は server/client ともに同じ固定値。`summarySaving` は初期 `false`、`summaryDraft` は `initialNote.summary ?? ""`。
- [`read-view.tsx:139`](/Users/blp542/Desktop/自己学習/Cornell-Method/src/modules/notes/ui/components/detail/read-view.tsx:139) の view/review 両方で同じ interactive renderer を使用。
- Browser backend は `No browser is available` で利用不可。実アプリの Browser runtime は未実施。

### Fixture

React 19.2、ReactMarkdown 9.1、GFM、raw HTML、jsdom で以下を確認しました。

- raw/GFM 混在
- GFM のみ
- raw input のみ
- 保存中 `disabled`
- nested task list
- raw input 前後の task index

同一 props では SSR markup と hydration が一致し、console error はありませんでした。raw input は task index を消費せず、GFM task は `1, 2, 3...` で一致しました。

一方、意図的に server を有効、client を保存中にすると、報告された warning を再現しました。差分は次の属性です。

```text
+ readOnly
+ disabled
+ tabIndex="-1"
```

したがって、checkbox 由来なら server/client の初期 `summarySaving`、`summaryDraft`、または hydration 前の DOM 改変が具体的な候補です。ただし現行コードの初期 state からは発生を確認できません。

### 原因候補

- 確認済み: checkbox 属性が server/client で異なる場合、報告された warning は発生する。
- 有力: 実ブラウザでの初期 props/state 差、または browser extension 等による hydration 前の DOM 改変。
- 既存の別候補: [`display.tsx:146`](/Users/blp542/Desktop/自己学習/Cornell-Method/src/modules/notes/ui/components/detail/display.tsx:146) の `formatDateTime` は timezone 未指定。同じ ISO 値でも UTC/PDT で表示が変わり、text hydration mismatch になり得ます。
- 未確認: 実際の Next.js Browser runtime、特定ノートの Markdown edge case、browser extension の影響。

### 修正方針

現時点では修正しないのが最小方針です。Browser backend 復旧後、warning の React diff を確認します。

checkbox 属性差分なら、まず [`markdown-field.tsx`](/Users/blp542/Desktop/自己学習/Cornell-Method/src/shared/markdown/markdown-field.tsx) と hydration regression fixture だけを対象にし、`modes.tsx` / `read-view.tsx` は変更しません。日付差分なら既存の `editor.tsx` または `note-display.ts` の別タスクとして分離します。

検証結果:

- focused tests: PASS（19 tests）
- `npm run lint`: PASS
- `npx tsc --noEmit --incremental false`: PASS
- `git diff --check`: PASS
- build: 背景記載どおり既に PASS のため再実行なし

今回の調査による変更ファイルはありません。開始時と完了時の `git status --short` は、既存の未コミット変更から変化していません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260809/1623-investigate-summary-hydration-mismatch-20260809-bfe71a4d-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260809/1623-investigate-summary-hydration-mismatch-20260809-bfe71a4d-summary.md`
