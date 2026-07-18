# Task Summary

## Objective

`/notes/new` の紙面罫線密度と共通ヘッダー配置を、`/notes` / `/notes/[id]` と一貫するよう修正する。ノート作成の入力、保存、キャンセル、validation、API 呼び出しは維持する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | 紙面中心 UI、AppChrome のレイアウト |
| 対象ファイル / ディレクトリ | `src/app/_components/app-chrome.tsx`, `src/app/globals.css`, `src/app/notes/_components/note-editor.tsx` |
| 対象外 | `src/app/notes/new/page.tsx`, `src/app/layout.tsx` は共通 wrapper が正本と一致していたため変更なし。API、Prisma、依存関係、仕様書は変更なし。 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-17.md` | 紙面 UI の現状、共通 chrome の責務、runtime QA 未実施を確認 |
| visual reference | `doc/screens/assets/mockups/mvp-paper-note-canvas-concept.png` | brand/nav/state、Cornell 30/70、控えめな罫線、Summary/footer の視覚基準を確認 |
| implementation | `src/app/_components/app-chrome.tsx`, `src/app/layout.tsx` | route 共通 chrome と state badge の DOM を確認 |
| implementation | `src/app/notes/new/page.tsx`, `src/app/notes/[id]/page.tsx`, `src/app/notes/_components/note-editor.tsx`, `src/app/notes/_components/note-detail-modes.tsx` | create/edit/view の紙面骨格と state 登録を比較 |
| style | `src/app/globals.css`, `src/shared/markdown/markdown-field.tsx` | repeating rule、section/Cornell/input/Preview の罫線重複を確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/_components/app-chrome.tsx` | brand、nav、state slot を共通 grid の直下 3 領域へ整理 | desktop の nav 右寄せと state 配置の崩れを解消し、mobile は brand → nav + state の構造に統一 |
| `src/app/globals.css` | 紙面 rule を薄くし、section の汎用上罫線を削除。Cornell に紙色を敷いて ruling を一組にし、metadata/overview/body/summary の通常 border を控えめな下線へ整理。Preview は上側 dashed 境界のみ維持。375px metadata の追加上線も削除 | 紙面全体 rule、section、Cornell、Cue/input、Preview の線の重なりを減らし、focus/error 時の表示は維持 |
| `src/app/notes/_components/note-editor.tsx` | Cue item の通常 divider を削除し、Cue textarea は通常透明・focus/error 時のみ下線 | Cue の各行と textarea の二重線を解消 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-01 | fact | 紙面 shell と Cornell grid がそれぞれ repeating-linear-gradient を描画し、さらに section、Cue item、textarea、Preview が境界線を持っていた | `src/app/globals.css`, `note-editor.tsx`, `markdown-field.tsx` の DOM/class/CSS 監査 |
| F-02 | fact | 旧ヘッダーは nav が flex wrapper 内で `justify-end` され、state slot も wrapper 内にあったため、concept の brand 直後 nav / 右端 state という canonical 構造と異なっていた | `app-chrome.tsx` と `globals.css` の比較 |
| F-03 | fact | `/notes/new` と `/notes/[id]` はともに `note-paper-page` wrapper を使い、header は `layout.tsx` の AppChrome が担当していた | 両 route の page と `layout.tsx` |
| A-01 | assumption | 375px では app-main/paper の gutter、header nav の内部 scroll、640px 以下の Cornell 1 列化によりページ全体の横 overflow は発生しない見込み | CSS の幅・grid・overflow 定義からの静的推論。runtime では未確認 |
| U-01 | unknown | 実ブラウザでの線密度、ヘッダーの見た目、focus/error 表示、375/1440px の実測横幅 | 開発 server が listen `EPERM`、in-app browser も利用不可 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm run lint` | PASS | ESLint 成功 |
| `npm run build` | PASS | Next.js compile / TypeScript / route generation 成功 |
| `git diff --check` | PASS | whitespace error なし |
| `git status --short` | PASS | UI/CSS の変更は対象 3 ファイルのみ。summary は追加運用ファイル |
| runtime `/notes/new` 1440px / 375px | 未確認 | `npm run dev` は `0.0.0.0:3000` / `127.0.0.1:3001` とも `listen EPERM`。browser も利用可能接続なし |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-01 | `/notes/new` と `/notes` / `/notes/[id]` の実画面での header alignment、罫線密度、ページ横 overflow | runtime server と browser が利用可能な環境で 1440px / 375px を確認 |
| U-02 | focus/error 状態で下線・ring が意図どおり見えるか | invalid fixture を用いたブラウザ確認 |

## Next Read

次回は runtime 確認を優先し、必要なら次の最小ファイルだけ読む。

- `HANDOFF_2026-07-17.md`
- `summary/20260717/2327-new-note-paper-lines-header-fix.md`
- `src/app/_components/app-chrome.tsx`
- `src/app/globals.css`
- `src/app/notes/_components/note-editor.tsx`
