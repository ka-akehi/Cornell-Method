# Worker Summary: Markdown / detail dark readability

## Objective

ダークモードのノート詳細で、Markdown、Cue、メタデータ、タグが背景に埋もれないようにする。既存の sanitize、保存、復習、task checkbox の契約は維持する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Markdown read/preview とノート詳細の表示色・境界線 |
| 対象ファイル / ディレクトリ | `src/shared/markdown/markdown-field.tsx`、`src/modules/notes/ui/components/detail/display.tsx`、`src/app/styles/foundation.css`、focused tests |
| 対象外 | API、DB、sanitize、保存、復習状態、依存関係、テーマ切り替え挙動 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 引き継ぎ | `HANDOFF_2026-08-28.md` | 現在の境界と未確認事項 |
| UI source | `src/shared/markdown/markdown-field.tsx` | Markdown element classes、sanitize、task checkbox |
| UI source | `src/modules/notes/ui/components/detail/display.tsx` | Cue、tag、metadata の表示 classes |
| theme source | `src/app/styles/foundation.css` | semantic tokens と dark mapping |
| tests | `test/notes/markdown-preview-contract.test.js`、`test/notes/detail-review-metadata-border-contract.test.js`、`test/notes/cue-display-contract.test.js` | 既存の表示契約 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/shared/markdown/markdown-field.tsx` | 見出し、本文、リスト、mark、details/summary、blockquote、inline code、code block、table、link の色・背景・線を semantic token 参照へ変更 | dark palette で固定 stone/amber 色が暗く残る問題を局所修正 |
| `src/modules/notes/ui/components/detail/display.tsx` | Cue、空状態、metadata、tag 名と tag 境界、review metadata を semantic token 化。保存済み tag の inline 色は維持 | 詳細画面の可読性を light/dark 両方で確保 |
| `src/app/styles/foundation.css` | code block 用 `--paper-code-surface` / `--paper-code-ink` を light/dark token に追加 | code block の暗い面と明るい文字の意味を維持 |
| focused tests | semantic token の再混入検出と更新後 class 契約を追加・更新 | 固定色の再発を検出 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| focused Node tests | PASS | 15/15: Markdown preview、detail metadata、Cue |
| target ESLint | PASS | 対象 TSX 2 ファイル |
| TypeScript | PASS | `npx tsc --noEmit` |
| `git diff --check` | PASS | whitespace error なし |
| provenance | PASS | `worker-record-change.sh` で意図した source/test 5 ファイルを記録 |
| browser visual QA | 未実施 | Worker task の focused static verification のみ |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U1 | 実ブラウザでの全 Markdown 要素の見た目と実コントラスト | light/dark のノート詳細を browser screenshot または実画面で確認 |

## Next Read

- `src/shared/markdown/markdown-field.tsx`
- `src/modules/notes/ui/components/detail/display.tsx`
- `src/app/styles/foundation.css`
