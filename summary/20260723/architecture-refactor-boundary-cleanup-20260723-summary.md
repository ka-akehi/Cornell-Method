# Architecture Refactor Boundary Cleanup Summary

## Objective

過去のDB差分や既存の命名パターンに引きずられず、挙動を変えない範囲で責務境界とファイル配置を見直す。特に `components` 配下の機能別 grouping、Canvas の公開 facade / renderer 境界、重複 date-only helper を整理する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | notes UI、backup UI、shared Canvas、shared date、関連ドキュメント |
| 対象ファイル / ディレクトリ | `src/modules/notes/ui/components/**`, `src/modules/notes/model/**`, `src/modules/backup/ui/**`, `src/shared/canvas/**`, `src/shared/date/**`, `src/server/notes/infrastructure/**` |
| 対象外 | DB URL の統一、backup prune の所有権変更、filename 契約変更、Prisma schema / migration、NotesList の非同期挙動変更、Canvas runtime hook の機械的分割 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/modules/notes/ui/components/{canvas,detail,editor,list}/` | `note-canvas-*`、`note-detail-*`、`note-editor-*`、`notes-list-*` を機能別ディレクトリへ移動。コンポーネント名とCSS class名は維持。 | prefix で機能 grouping を表す代わりに、ディレクトリで変更理由を表すため。 |
| `src/modules/notes/model/canvas-toolbar-{definitions,types}.ts` | React component ではない toolbar 設定・型を `components` 外へ移動。detail の単純な `NoteDetail` alias は削除し、`NoteDetailResponse` を直接参照。 | `components` 配下を表示 component と公開 root `index.ts` に限定し、不要な中間型ファイルを減らすため。 |
| `src/modules/backup/ui/components/backup-page.tsx` / `src/app/backup/page.tsx` | Backup UI を module 側へ移し、route は thin entry にした。backup module の `components/index.ts` は追加していない。 | target architecture に合わせ、route に UI state を残さないため。 |
| `src/shared/canvas/index.ts` / `src/shared/canvas/canvas-document.ts` | `canvas-document.ts` の二重 facade を削除し、root `index.ts` が責務別 document modules を直接公開。 | `index.ts` と中間 facade の二重管理を避けるため。 |
| `src/app/spikes/canvas/_lib/canvas-document.ts` | 未使用の1行再エクスポート facade を削除。 | 参照がなく、spike 側にも独自の document boundary が不要だったため。 |
| `src/shared/canvas/adapters/fabric/fabric-canvas-surface.ts` | DOM / Fabric の寸法適用処理を Fabric adapter 内へ移動。generic shared barrel からは公開しない。 | renderer-specific side effect を pure Canvas contract から分離するため。 |
| `src/modules/notes/lib/canvas-editor-document.ts`、`canvas-editor-style.ts`、Canvas hooks | Fabric event/object bridge は Fabric adapter から読み、notes lib は document/style policy に限定。 | pure document 操作と Fabric 依存を混在させないため。 |
| `src/shared/date/date-only.ts` と notes server / contract | 重複していた `dateOnlyToUtcDate` を共有化。`todayDateString` の依存も shared date へ統一。 | 同じ日付変換の実装差分を防ぐため。UTC変換の意味は変更していない。 |
| `HANDOFF_2026-07-22.md`、`doc/**` | 削除・移動したパスを現行パスへ更新。 | 実装と設計・検証記録の参照先を一致させるため。 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| REF-001 | fact | `src/shared/canvas/canvas-document.ts` は既存 `src/shared/canvas/index.ts` と同じ役割の二重 facade だった。 | 実装と import 参照の棚卸し |
| REF-002 | fact | `src/shared/canvas/canvas-surface.ts` は DOM / Fabric を操作する renderer-specific code だった。 | `HTMLCanvasElement`、`FabricCanvasLike`、`canvas.setDimensions()` の依存 |
| REF-003 | fact | `components` 直下の機能ファイル群は、Canvas / detail / editor / list ごとに複数ファイルがあり、prefix が grouping の役割を担っていた。 | `rg --files src/modules/notes/ui/components` |
| REF-004 | assumption | 今回の移動は export 名・CSS class 名・API payload・DB schema を変えないため、機能挙動は維持される。 | import 更新後の lint / typecheck / build |
| REF-005 | unknown | Canvas の pointer / touch / responsive runtime に既存 handoff 記載の未確認事項が残る。 | Browser QA は今回実施していない |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm run lint` | PASS | warning なし |
| `npx tsc --noEmit --pretty false` | PASS | import 移動後に再実行 |
| `npm run build` | PASS | Next.js webpack build、11 static pages生成 |
| `node --test test/backup/filename-collision.test.js` | PASS | 10/10。既存の未コミット backup collision 対策を対象 |
| `git diff --check` | PASS | docs 更新後にも再確認済み |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| QA-001 | Canvas editor / viewer の実ブラウザ操作、responsive rail、pointer / touch、shape text lifecycle | Browser QA と console / screenshot 証跡 |
| SCOPE-001 | DB URL 統一や backup prune 所有権の修正を別途採用するか | ユーザーによる仕様・変更範囲の承認 |

## Next Read

- `HANDOFF_2026-07-22.md`
- `doc/technical/TARGET_ARCHITECTURE.md`
- `src/modules/notes/ui/components/index.ts`
- `src/modules/notes/ui/components/canvas/editor.tsx`
- `src/shared/canvas/index.ts`
- `src/shared/canvas/adapters/fabric/fabric-canvas-surface.ts`
