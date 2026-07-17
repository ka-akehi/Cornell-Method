---
summary_type: task-summary
created_at: 2026-07-16 JST
task_kind: worker-task
task_status: done
---

## Objective

紙面中心の Cornell Method Notebook UI を、後続 UI coding 前に確認できる standalone HTML と静的 PNG モックとして作成した。

## Changes Made

| パス | 内容 |
|---|---|
| `doc/screens/assets/mockups/mvp-paper-note-canvas-mock.html` | 外部依存なしの standalone HTML。編集を初期表示とし、編集・閲覧・復習を最小 JavaScript で切替。タイトル、コンパクトなメタ情報帯、開閉概要、Cue / 本文の Cornell、本文 textarea → Markdown Preview、Summary、紙面フッターを実装。復習では本文と Summary を初期マスクし、本文表示後に Summary を開ける。 |
| `doc/screens/assets/mockups/mvp-paper-note-canvas-edit-1440.png` | 編集状態のデスクトップ静的モック。1440×2070px。 |
| `doc/screens/assets/mockups/mvp-paper-note-canvas-edit-375.png` | 編集状態のモバイル静的モック。375×2770px。本文・Preview・Summary・保存導線を縦に到達できる構成。 |
| `doc/screens/assets/mockups/mvp-paper-note-canvas-review-1440.png` | 復習状態のデスクトップ静的モック。1440×1845px。本文マスクと Summary の初期ロックを表示。 |
| `doc/screens/MVP_SCREEN_DESIGN.md` | 静的モック HTML / PNG への最小リンクを追加。PNG は runtime QA の証跡ではないことを明記。 |
| `doc/screens/MVP_SCREEN_INVENTORY.md` | 静的モック HTML / PNG への最小リンクを追加。視覚モックと runtime QA を分離する注記を追加。 |

既存の `doc/screens` の変更、既存 summary、`src/**`、`prisma/**`、`package.json`、lockfile、本番 CSS、API、DB、テストコードは戻していない／変更していない。

## Visual Check

- 編集デスクトップ: 一枚の紙面シェル、タイトルの主役性、コンパクトな基本情報、Cue 約 30% / 本文約 70%、本文 textarea → Preview の縦並び、Summary と保存フッターを確認。
- 編集モバイル: ページ全体の意図しない横 overflow や文字重なりがない状態へ修正し、タイトル、基本情報、Cue、本文、Preview、Summary、キャンセル、保存を縦順で確認。
- 復習デスクトップ: Cue を左に残したまま本文を紙面幅の位置でマスクし、Summary を「本文確認後に開く」状態で初期表示することを確認。
- HTML は外部 CDN、`fetch`、XHR、WebSocket、Next.js、Prisma / SQLite 参照を含まない。埋め込み JavaScript は構文チェック済み。

## Rendering / Verification

| 確認 | 結果 |
|---|---|
| Playwright file URL screenshot | 未達。bundled Chromium が macOS の `MachPortRendezvousServer ... Permission denied` で起動できなかった。 |
| Puppeteer file URL screenshot | 未達。Chrome for Testing の crashpad child port / Application Support 権限エラーで起動できなかった。 |
| in-app Browser fallback | 未達。Browser backend の一覧が空で利用不可だった。 |
| PNG 生成 | 成功。既存 `sharp` で HTML と同じ紙面構成を一時 SVG に描画し、PNG へ rasterize した。依存関係は追加していない。 |
| 描画コマンド | `node - <<'NODE'` の inline script から `sharp(Buffer.from(svg)).png().toFile(...)` を実行。 |
| PNG 形式・寸法 | `file` / `sips` で 1440×2070、375×2770、1440×1845 の PNG と確認。 |
| HTML 静的チェック | 埋め込み `<script>` 1 件の `new Function` 構文チェック、編集・閲覧・復習・本文マスク・Summary ロックの marker 確認に成功。 |
| 設計書リンク | 2 文書から HTML と 3 PNG のファイル名を確認。 |
| `git diff --check` | 成功。 |
| `npm run lint` / `npm run build` | 未実施。今回 `src/**` と本番設定を変更していないため。 |

## Remaining Unknowns

- PNG はブラウザ runtime screenshot ではなく、ブラウザ起動制限を回避するための静的 SVG rasterize 結果である。HTML を実ブラウザで開いた際の CSS、モード切替、Overview の開閉、本文表示後の Summary 開示は runtime 未確認。
- 本番 Next.js UI の layout、Markdown sanitize / checkbox、保存・復習 API、実データ、アクセシビリティはこのモックから PASS 判定しない。
- 既存 screenshot / runtime QA の PASS は新しい紙面 UI の PASS ではない。後続実装後に 375 / 768 / 1280 / 1440px を再取得する必要がある。

## Next Read

次の UI coding task は `UI-PAPER-001` 共通紙面シェル。開始時に次を最小順で読む。

1. `doc/implementation/MVP_CONTRACT.md`
2. `doc/screens/MVP_SCREEN_DESIGN.md` の「目標コンセプト」「静的モック」「現行 MVP 契約を変更しない実装境界」
3. `doc/screens/MVP_SCREEN_INVENTORY.md` の「紙面中心 UI の棚卸し基準」「現行 MVP 契約と UI 実装境界」
4. `src/app/notes/_components/note-editor.tsx`
5. `src/app/notes/_components/note-detail-modes.tsx`
6. `src/shared/markdown/markdown-field.tsx`

PNG の視覚確認結果を本番 runtime QA と混同せず、次 task では API / DB 契約を変更しない共通紙面シェルから着手する。
