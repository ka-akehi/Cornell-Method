# Review disabled controls refinement

## Objective

復習中の Summary 開示と復習完了について、既存の確認順序・disabled 条件を維持したまま、light / dark の両テーマで disabled 状態と次の操作を明確にする。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | 詳細画面の復習操作 UI と focused contract test |
| 対象ファイル / ディレクトリ | `src/modules/notes/ui/components/detail/read-view.tsx`、`src/modules/notes/ui/components/detail/actions.tsx`、`test/notes/detail-review-confirmation-contract.test.js` |
| 対象外 | API、DB、復習 state/ref guard、共通 theme token、保存処理 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 指示 | `AGENTS.md` | Worker の変更範囲、検証、provenance、summary の規則 |
| handoff | `HANDOFF_2026-08-28.md` | 現在の未コミット変更と検証上の境界 |
| UI 指針 | `doc/screens/MVP_SCREEN_DESIGN.md` | 復習時の本文 / Summary の表示順とアクセシビリティ |
| source | `src/modules/notes/ui/components/detail/read-view.tsx`、`actions.tsx`、`modes.tsx` | disabled 条件、案内文、state/ref guard、API 呼び出し境界 |
| test | `test/notes/detail-review-confirmation-contract.test.js`、`detail-review-feedback-contract.test.js` | 既存の復習確認・完了フィードバック契約 |
| tokens | `src/app/styles/foundation.css` | light / dark の `--app-ink`、`--app-muted-ink`、`--app-line`、`--app-line-strong`、accent token |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/modules/notes/ui/components/detail/read-view.tsx` | Summary 案内を短文化し、`review-summary-hint` と `aria-describedby` を追加。Summary 開示ボタンの enabled / disabled 配色を semantic token 化し、境界・cursor・opacity を明示。 | 本文確認前に次の操作を理解でき、dark theme でも disabled が埋もれないようにするため |
| `src/modules/notes/ui/components/detail/actions.tsx` | 復習完了の案内を短文化。`review-confirmation-hint` を muted token 化し、完了ボタンの enabled / disabled 配色を semantic token 化。 | 本文と Summary の確認順を短く伝え、保存中を含む disabled 状態を明確にするため |
| `test/notes/detail-review-confirmation-contract.test.js` | Summary の accessible hint / relation と light / dark 共通 semantic token の focused 契約を追加・更新。 | disabled 条件、案内、配色クラスの回帰を検証するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F1 | fact | `bodyConfirmed`、`summaryConfirmed`、native `disabled`、ref guard、review API 条件は変更していない。 | 対象 diff と既存 focused test |
| F2 | fact | disabled は `--app-line` 背景、`--app-ink` 文字、`--app-line-strong` 境界、`cursor-not-allowed`、`opacity-100` を使用する。 | 対象コンポーネントの class |
| F3 | unknown | 実ブラウザでの light / dark スクリーンショット確認は未実施。 | Worker 環境で dev server / browser QA を起動していない |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| focused review tests | PASS | `node --test test/notes/detail-review-confirmation-contract.test.js test/notes/detail-review-feedback-contract.test.js`、7/7 |
| targeted ESLint | PASS | 対象 2 component と focused test |
| `git diff --check` | PASS | whitespace error なし |
| provenance | PASS | `worker-record-change.sh` で対象 3 ファイルを記録 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U1 | 実ブラウザでの light / dark の最終コントラストと表示 | dev server を起動し、復習開始直後・本文確認後・Summary 確認後を各テーマで目視確認 |

## Next Read

- `src/modules/notes/ui/components/detail/read-view.tsx`
- `src/modules/notes/ui/components/detail/actions.tsx`
- `test/notes/detail-review-confirmation-contract.test.js`
