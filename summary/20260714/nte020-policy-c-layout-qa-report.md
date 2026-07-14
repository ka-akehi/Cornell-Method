# NTE-020 / NTE-030 edit Policy C layout QA report

検証日: 2026-07-14 JST

## Objective

`/notes/new` と既存ノートの `/notes/[id]` edit に共有される `NoteEditor` について、NTE-020 / NTE-030 edit の Policy C レイアウトを 375px、768px、1280px、1440px 前後の実画面で確認し、Cornell 部分の局所横スクロールとページ全体の overflow 境界を記録する。

## Scope

- 対象 route: `/notes/new`、`/notes` から開く既存ノートの `/notes/[id]` edit
- 対象 UI: 基本情報、Cornell の Cue / Note / Preview、Summary、Cue 操作、Markdown Preview
- 確認対象: レスポンシブ配置、操作可能性、Markdown checkbox の表示専用挙動、長い Markdown / タグ / field error / 空 Cue の overflow
- 制約: 保存、削除、復習完了、API 更新は実行しない。スクリーンショットはリポジトリへ保存せず、確認用に `/private/tmp` へ一時保存する。

## Environment

| 項目 | 結果 |
|---|---|
| 作業ディレクトリ | `/Users/blp542/Desktop/自己学習/Cornell-Method` |
| Browser 操作手段 | 先行試行では Browser session 不在だったが、今回、リポジトリ既存依存の Puppeteer と Chrome for Testing を使い、headless Chromium を一時 profile で起動して確認した。 |
| 開発サーバー | 先行試行では `listen EPERM: operation not permitted 127.0.0.1:3000` で起動失敗。今回の `npm run dev -- --hostname 127.0.0.1` は起動し、`http://127.0.0.1:3000/notes/new` は HTTP 200 を返した。 |
| create runtime の記録 | 375 / 768 / 1280 / 1440px の一時スクリーンショットを `/private/tmp/nte020-new-375.png`、`/private/tmp/nte020-new-768.png`、`/private/tmp/nte020-new-1280.png`、`/private/tmp/nte020-new-1440.png` に保存した。リポジトリへはコピーしていない。 |
| DB / API | 保存・削除・復習完了を含む変更操作は未実行。`/notes` の保存済みノートは 0 件だった。 |
| 変更方針 | QA レポート以外のコード、設定、依存関係、テスト文書、画像、生成物は変更していない。 |

先行試行では Browser session と local server の両方を利用できなかったが、今回の実行では local server と一時 Chromium により `/notes/new` の create runtime を確認できた。以下の create runtime は、DOM / `scrollWidth` 計測と一時スクリーンショットを根拠に PASS とする。edit runtime は保存済みノートが 0 件のため、未確認として扱う。

## Test Matrix

| Viewport | `/notes/new` create runtime | `/notes/[id]` edit runtime | Cornell / overflow / 操作確認 | 判定 |
|---|---|---|---|---|
| 375px | PASS: body / document `scrollWidth=375`。Cornell scroll port は `clientWidth=309` / `scrollWidth=640` で、Cornell 内だけ局所横スクロールあり。ページ全体の横 overflow なし。 | 未確認: `/notes` の保存済みノートが 0 件で edit route を開いていない。 | 一時スクリーンショットと DOM / `scrollWidth` 計測で確認。 | create: PASS / edit: 未確認 |
| 768px | PASS: body / document `scrollWidth=768`。Cornell は `clientWidth=686` / `scrollWidth=686` で局所 overflow なし、640px work surface が収まる。ページ全体の横 overflow なし。 | 未確認: 同上。 | 一時スクリーンショットと DOM / `scrollWidth` 計測で確認。 | create: PASS / edit: 未確認 |
| 1280px | PASS: body / document `scrollWidth=1280`。Cornell は `clientWidth=1070` / `scrollWidth=1070` で、ページ全体の横 overflow なし。Cornell work surface は 1070px、Note column は 738px。 | 未確認: 同上。 | desktop split と一時スクリーンショット、DOM / `scrollWidth` 計測で確認。 | create: PASS / edit: 未確認 |
| 1440px | PASS: body / document `scrollWidth=1440`。Cornell は `clientWidth=1070` / `scrollWidth=1070` で、ページ全体の横 overflow なし。Cornell work surface は 1070px、Note column は 738px。 | 未確認: 同上。 | desktop split と一時スクリーンショット、DOM / `scrollWidth` 計測で確認。 | create: PASS / edit: 未確認 |

create runtime の PASS は、各 viewport の DOM / `scrollWidth` 計測および `/private/tmp` の一時スクリーンショットに基づく。edit runtime の未確認は、共有 `NoteEditor` のコード構造から PASS へ繰り上げていない。

## Findings

### Runtime findings

- `/notes/new` は `HTTP 200` で表示でき、375 / 768 / 1280 / 1440px の create runtime を実測した。4 viewport とも body field、Summary field、Cue 追加、保存ボタンが存在した。
- 375px では `body / document scrollWidth=375`、Cornell scroll port は `clientWidth=309` / `scrollWidth=640` だった。Cornell 内の局所横スクロールは発生したが、ページ全体の横 overflow は発生しなかった。
- 768px では `body / document scrollWidth=768`、Cornell は `clientWidth=686` / `scrollWidth=686` だった。局所 overflow はなく、640px work surface が収まった。
- 1280px / 1440px では Cornell work surface が 1070px、Note column が 738px の desktop split と、ページ全体の横 overflow がないことを確認した。
- 375px で Cue 追加 → `Cue 0` の表示 → Cue 削除を確認した。
- 375px で本文 Markdown を入力すると Preview と checkbox が表示され、Preview checkbox をクリックしても textarea 値が変わらないことを確認した。これは本文入力と checkbox の表示専用挙動の確認であり、長い Markdown の確認ではない。
- Puppeteer の page error / console error はなかった。
- `/notes` の保存済みノートは 0 件だった。データ変更を避けるため新規保存を実行せず、`/notes/[id]` edit runtime は未確認のまま残した。共有 `NoteEditor` が create / edit で使われることはコード構造で確認済みだが、edit runtime の PASS とは記録しない。
- 375px の long Markdown、long tag、field error は今回の測定範囲に含めていないため未確認である。

### Read-only static observations (runtime PASS ではない)

対象コードを変更せずに実装上の手がかりだけ確認した。

- `note-editor.tsx` には Cornell section の `overflow-x-auto`、モバイル用 `min-w-[640px]`、`grid-cols-[minmax(0,3fr)_minmax(0,7fr)]`、`lg:overflow-x-visible` がある。
- 同ファイルには Cue の追加・削除・入力 handler と、Summary 下部の次回復習日・キャンセル / 保存を含む構造がある。
- `markdown-field.tsx` には `layout="desktop-split"` の `lg` breakpoint grid、Preview 側の `min-w-0`、長い本文向けの `break-words` / 内部 `overflow-x-auto` がある。
- Markdown checkbox は `readOnly`、`tabIndex={-1}`、click/change の `preventDefault` を使う実装で、Preview は `remark-gfm` と `rehype-sanitize` を使用している。

これらはコード上の構造確認であり、指定 viewport で CSS が実際に適用されること、入力・スクロールが可能であること、ページ全体の scroll width が期待どおりになることを証明しない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 先行 Browser runtime 試行 | 失敗（履歴） | Browser session 不在。今回の確認ではリポジトリ既存依存の Puppeteer と Chrome for Testing に切り替えた。 |
| 一時 Chromium による create runtime | PASS | 一時 profile の headless Chromium で `/notes/new` を確認。 |
| local server 起動と `/notes/new` 応答 | PASS | `npm run dev -- --hostname 127.0.0.1` 実行後、`http://127.0.0.1:3000/notes/new` は HTTP 200。 |
| create viewport runtime QA | PASS | 375 / 768 / 1280 / 1440px を確認。判定根拠は DOM / `scrollWidth` 計測と一時スクリーンショット。 |
| create runtime の操作確認 | PASS | 4 viewport の必須 field / Cue 追加 / 保存ボタン、375px の Cue 追加・削除、本文 Markdown Preview、checkbox read-only を確認。 |
| page error / console error | PASS | Puppeteer でエラーなし。 |
| edit runtime QA | 未確認 | `/notes` の保存済みノートが 0 件。データ変更を避けるため新規保存を実行しなかった。 |
| 保存・削除・復習完了・API 更新 | 未実行 | データ変更なし。 |
| スクリーンショット保存 | 一時保存のみ | `/private/tmp/nte020-new-375.png`、`768`、`1280`、`1440` を使用。リポジトリへ画像を追加していない。 |
| `git diff --check` | PASS | レポート更新後に実行し、whitespace error なし。 |
| `npm run lint` / `npm run build` | 今回は未再実行 | 関連 Worker summary に成功記録があるが、本 QA task では runtime 確認を優先した。 |

## Remaining Unknowns

- `/notes/[id]` edit runtime は未確認である。`/notes` の保存済みノートが 0 件で、データ変更を避けるため新規保存を実行しなかったため、既存ノートを開いて確認できていない。
- 375px の long Markdown、long tag、field error によるページ全体の横 overflow 不発生は未確認である。今回確認したのは通常長の本文入力と Preview checkbox の表示専用挙動までである。
- GFM 表・取り消し線・危険な HTML の sanitize など、今回入力していない Markdown バリエーションの runtime 表示は未確認である。

## Next Read

次回の runtime QA では、以下だけを先に確認する。

- `summary/20260714/nte020-policy-c-layout-qa-report.md`
- `src/app/notes/[id]/page.tsx`
- `src/app/notes/_components/note-detail-modes.tsx`
- `src/app/notes/_components/note-editor.tsx`
- `src/shared/markdown/markdown-field.tsx`
- `doc/testing/TEST_SCENARIOS.md` の 4.1. NTE-020 / NTE-030 edit レイアウト / responsive

確認対象は、保存済みノートを使った `/notes/[id]` edit runtime と、375px の long Markdown / long tag / field error である。
