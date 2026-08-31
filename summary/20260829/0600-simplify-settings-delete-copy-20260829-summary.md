# Settings 削除 UI 文言整理 完了要約

## Objective

Settings の削除セクションと削除確認 alertdialog から不要な説明文を除去し、削除導線を短い操作ラベルに整理する。削除処理、確認入力、アクセシビリティ、安全境界は維持する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Settings の Data and Backup / 削除 UI |
| 対象ファイル / ディレクトリ | `src/app/_components/settings/settings-modal.tsx`、`test/desktop/desktop-settings-ui.test.js` |
| 対象外 | 削除処理、API、DB、バックアップ処理、確認ダイアログの安全境界、対象外の既存変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 引き継ぎ | `HANDOFF_2026-08-28.md` | 現在の検証境界と既存作業状況 |
| 実装 | `src/app/_components/settings/settings-modal.tsx` | 削除導線、確認入力、alertdialog、DELETE 契約 |
| focused test | `test/desktop/desktop-settings-ui.test.js` | 既存の Settings UI 契約と更新対象の期待値 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/_components/settings/settings-modal.tsx` | 削除セクション直下の説明文と削除確認 alertdialog 内の削除対象説明文を削除。導線ラベルを `削除` に変更し、`削除中…` は維持。 | 不要な説明文をなくし、操作ラベルを直感的にするため |
| `test/desktop/desktop-settings-ui.test.js` | 不要文言がないこと、導線ラベルが `削除` であること、確認入力・最終ボタン・alertdialog・focus 復帰・DELETE 契約が残ることを検証。 | 変更目的と既存削除契約を focused test で固定するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-1 | fact | 対象ファイルには本 task 以前の未コミット変更が存在するため、今回の差分は指定箇所に限定して追加した。 | 作業前後の `git status --short` と対象 diff |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `node --test test/desktop/desktop-settings-ui.test.js` | PASS | 8/8 |
| `npx eslint src/app/_components/settings/settings-modal.tsx test/desktop/desktop-settings-ui.test.js` | PASS | 対象 ESLint |
| `npx tsc --noEmit` | PASS | 型検査 |
| `git diff --check` | PASS | 空白エラーなし |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| - | なし | - |

## Next Read

次回、今回の変更を確認する場合は次の最小ファイルを読む。

- `src/app/_components/settings/settings-modal.tsx`
- `test/desktop/desktop-settings-ui.test.js`
