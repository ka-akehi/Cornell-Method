---
summary_type: investigation-report
created_at: 2026-07-14
task_kind: worker-task
task_status: done
---

# NTE-020 方針 C 実装影響調査報告

## Objective

NTE-020 の採用方針 C（折衷案）について、現行の新規作成・詳細編集実装との差分、影響範囲、共通化境界、後続実装 task の推奨分割をコード変更なしで整理する。後続 Manager がこの報告だけを起点に実装 task を作成できる状態にする。

## Scope

| 区分 | 内容 |
| --- | --- |
| 実装対象 | `/notes/new`、`NoteEditor`、`/notes/[id]` の編集導線、共有 Markdown 表示、関連するレスポンシブ配置と UI 検証 |
| 方針 C の決定事項 | 基本情報カードの圧縮、Cue / Note / Preview の近接、本文 textarea / Preview のデスクトップ横並び、Summary の textarea + Preview + 下部操作、横長画面主対象、モバイル Cornell 部分の横スクロール許容 |
| 共通化判断対象 | 新規作成と詳細編集で共有するフォーム構造・状態と、ルーティング / 閲覧 / 復習の責務の分離 |
| 対象外 | API、Prisma、データモデル、依存関係、ドラフト / 自動保存 / 409、NoteCard / D&D、閲覧・復習モードの新しいレイアウト方針の決定 |
| 成果物 | 本 summary 1 件のみ。コード、設定、既存設計書、テスト文書、画像は変更しない |

## Inputs Read

| 種別 | パス | 確認内容 |
| --- | --- | --- |
| リポジトリ規約 | `AGENTS.md` | Worker の変更範囲、検証、summary 運用 |
| 引き継ぎ | `HANDOFF_2026-07-08.md` | NTE-020 方針 C の決定事項、未実装状態、次 task 候補 |
| 先行 summary | `summary/20260714/1907-inventory-nte020-policy-c-implementation-impact-9edd7483-summary.md`、`summary/20260714/1908-retry-nte020-policy-c-impact-report-67190ce2-summary.md`、`summary/20260714/1913-rerun-nte020-policy-c-impact-report-a639d543-summary.md` | 先行 Worker が内容付き調査結果を残せず、今回の報告が必要になった経緯 |
| 対象実装 | `src/app/notes/new/page.tsx` | 新規作成 route が `NoteEditor mode="create"` を呼ぶ構造 |
| 対象実装 | `src/app/notes/_components/note-editor.tsx` | フォーム DOM、保存、入力状態、Cue / Tag、基本情報 / Cornell / Summary の現行レイアウト |
| 対象実装 | `src/app/notes/_components/note-detail-modes.tsx` | view / edit / review のモード状態、編集時の `NoteEditor` 呼び出し、閲覧・復習レイアウト |
| 対象実装 | `src/app/notes/types.ts`、`src/app/notes/[id]/page.tsx` | 旧カード型定義と詳細取得・404・Client Component への境界 |
| 対象スタイル | `src/app/globals.css` | グローバル CSS が token 定義中心で、画面レイアウトは Tailwind class によること |
| 直接参照 UI | `src/shared/markdown/markdown-field.tsx`、`src/shared/markdown/index.ts` | textarea と Preview の実装、checkbox / sanitize、現在の縦並び固定 |
| 直接参照 model / API | `src/modules/notes/model/note-editor-form.ts`、`src/modules/notes/contracts/note.schema.ts`、`src/modules/notes/remote/index.ts` | 共通フォーム state、payload、validation、create / update API の境界 |
| 関連 shell | `src/app/layout.tsx` | `max-w-6xl` の main と既存ナビゲーションの横スクロール |
| 方針 | `doc/screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md` | 方針 C の採用理由と UI 決定事項 |
| 設計成果物 | `doc/screens/MVP_UI_WIREFRAMES.md` | NTE-020 / NTE-030 のデスクトップ・モバイル配置案 |
| レビュー | `doc/review/MVP_SCREENSHOT_WIREFRAME_LAYOUT_REVIEW.md`、`doc/review/MVP_UI_DESIGN_ARTIFACT_GAP_REVIEW.md` | 現行との差分分類、編集・復習・モバイルの screenshot 不足、状態別確認の不足 |
| テスト観点 | `doc/testing/TEST_SCENARIOS.md` | 作成・詳細編集の機能シナリオ、Markdown Preview、Phase 2 境界 |
| 補助 | `doc/screens/MVP_SCREEN_DESIGN.md`、`doc/screens/MVP_SCREEN_INVENTORY.md`、`summary/README.md`、`summary/task-summary-template.md`、`tools/check-summary.sh` | MVP の共通フォーム前提、状態境界、summary 検証方法 |

## Changes Made

| パス | 変更内容 | 理由 |
| --- | --- | --- |
| `summary/20260714/retry-nte020-policy-c-impact-report.md` | 方針 C の実装影響調査報告を新規作成 | 後続 Manager が実装 task を分割できる内容付き summary を残すため |
| その他 | 変更なし | 先行 Worker が残した未追跡 summary 3 件を含む既存変更は保持し、コード・設定・依存関係・テスト・設計書・画像は変更していない |

## Findings

### 1. 現行の画面構造と責務境界

| ID | fact / assumption / unknown | Findings | 根拠と影響 |
| --- | --- | --- | --- |
| F-001 | fact | 新規作成ページは見出しと `NoteEditor mode="create"` だけを持つ薄い route wrapper である。 | `src/app/notes/new/page.tsx:1-9`。方針 C のフォーム変更に route 専用実装を追加する必要はない。 |
| F-002 | fact | `NoteEditor` は `mode: "create" | "edit"`、任意の初期値、cancel callback、save callback を受ける共通フォームである。 | `src/app/notes/_components/note-editor.tsx:30-49`。同一 DOM / state を新規作成と詳細編集で再利用できる。 |
| F-003 | fact | 保存処理だけが create / edit で分岐し、create は `POST` 成功後に `/notes/[id]` へ遷移、edit は `onSaved` を親へ返して親が閲覧モードへ戻す。 | `note-editor.tsx:90-126`。レイアウト task はこの状態遷移を変更せず、フォーム構造だけを変更するのが安全。 |
| F-004 | fact | 詳細ページは Server Component で `fetchNoteDetail` を実行し、404 または取得失敗時の戻る UI を出した後、`NoteDetailModes` にデータを渡す。 | `src/app/notes/[id]/page.tsx:8-45`。データ取得・404・route 責務は NTE-020 レイアウト task から分離できる。 |
| F-005 | fact | `NoteDetailModes` は `view / edit / review` の mode、本文表示状態、復習更新、削除、エラーを管理し、edit 時だけ `NoteEditor` を呼ぶ。 | `src/app/notes/_components/note-detail-modes.tsx:24-32`、`:124-183`、`:185-225`。edit 共通フォームは変更対象だが、view / review の state と route は変更対象ではない。 |
| F-006 | fact | 閲覧・復習の Cornell 表示は `NoteDetailModes` 内に独立して存在し、view は概要→Cue/本文→Summary、review は Cue/Summary→本文非表示→復習記録の構造である。 | `note-detail-modes.tsx:306-379`、`:381-409`。NTE-020 方針 C を view / review へ自動的に広げると別の仕様判断になる。 |
| F-007 | fact | `NoteEditor` の `draft?: unknown` prop は宣言されているが、state や表示には使われていない。現行は明示保存のみで、自動保存・ドラフト・409 UI は実装していない。 | `note-editor.tsx:30-36`、`:45-126`、`doc/testing/TEST_SCENARIOS.md:187-203`。方針 C の layout task にドラフト責務を混ぜない。 |
| F-008 | fact | 現行フォームの実データは `cues` 配列と単一の `body` Markdown であり、`src/app/notes/types.ts` の `NoteCard` / `cueIds` 型はフォーム state の構造ではない。 | `src/app/notes/types.ts:7-22`、`src/modules/notes/model/note-editor-form.ts:29-41`、`:61-77`。NoteCard 分割やリンクの設計変更は今回の UI 差分から除外する。 |

### 2. 方針 C の決定事項ごとの対応表

| ID / 決定事項 | 現行実装 | 方針 C との差分・必要変更 | 依存関係・リスク |
| --- | --- | --- | --- |
| C-01 基本情報カードの圧縮 | 3 枚の大きな section のうち基本情報は `space-y-4`、`p-5`。タイトル / 日付、学習元タイプ / タイトルを 2 行の grid にし、概要 `rows={3}`、タグはチップ→既存候補 select→自由入力の上下構造。 | 項目・validation・タグ候補 / 新規入力は維持し、カード内 padding / gap、概要の高さ、タグの上下距離を圧縮する。タイトルと学習日は現行同様同一行、学習元も同一行を維持する。タグの候補と自由入力を同一操作列へ寄せる場合も、既存候補と自由入力の区別を失わない。 | `note-editor.tsx:146-226`、`:445-607`。TagInput の state / `GET /api/tags` / 12 件・重複チェックを変えない。圧縮し過ぎると長いタグ・field error・モバイル折返しが見えにくくなる。 |
| C-02 Cue / Note / Preview の近接性 | `lg` 以上では Cue と本文が 0.32 / 0.68 相当で横並びだが、Preview は本文 textarea の下。Cue 追加ボタンは既に Cue 見出し右側。 | Cue 見出しと追加操作の近接は現状をほぼ維持し、右側の本文領域を textarea + Preview の作業面にして、Cue・本文・Preview を同じ Cornell section 内で近接させる。初期 Cue は引き続き空状態。 | `note-editor.tsx:228-302`、`doc/screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md:134-145`。Cue のデータ構造・削除・空状態を変えない。Preview を共有 component の既定値変更で横並びにすると Summary や他画面へ波及する。 |
| C-03 本文 textarea / Preview のデスクトップ横並び | `MarkdownField` は textarea の直後に「プレビュー」と `MarkdownPreview` を置く縦固定構造。本文は `rows={12}` でこの component をそのまま使用。 | デスクトップの本文だけ、textarea をやや広い側（目安 55%）・Preview を残り（目安 45%）とする横並びへ変更する。空状態、GFM checkbox 表示専用、sanitize、controlled value は維持する。 | `src/shared/markdown/markdown-field.tsx:168-225`、`note-editor.tsx:292-301`。推奨は `MarkdownField` に opt-in の layout / class prop を追加するか、本文専用 wrapper を `NoteEditor` に置くこと。Summary の縦並び既定値を壊さないことが最大リスク。 |
| C-04 Summary の textarea + Preview + 下部操作 | Summary section 内で `MarkdownField rows={7}` が textarea→Preview を縦表示し、その下に次回復習日とキャンセル / 保存を配置済み。md 以上は日付 220px + 右寄せ操作、狭い幅では折り返す。 | この縦順序と下部操作を維持する。Summary をワイヤフレームの 1 行へ圧縮せず、section の gap / textarea 高さを少し抑え、保存・キャンセルが Summary の末尾にあることを明確にする。 | `note-editor.tsx:305-349`、`doc/screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md:146-162`。Summary の Markdown 表示仕様と `nextReviewDate` validation を変更しない。 |
| C-05 横長画面主対象 | shell の main は `max-w-6xl`、フォームは `md` / `lg` breakpoint の Tailwind grid。現行 screenshot は 1440x1750 で、ワイヤフレームは 1280x900。 | 実装・受け入れの基準 viewport を横長（少なくとも 1280px 前後）に置き、短いスクロールで Cornell section の開始と本文 Preview を確認できる情報密度を目標にする。 | `src/app/layout.tsx:63-65`、`note-editor.tsx:131-236`、`doc/review/MVP_SCREENSHOT_WIREFRAME_LAYOUT_REVIEW.md:78-94`。`max-w-6xl` を無制限に広げる必要はなく、カード内余白・本文内分割の調整で達成するのが低リスク。 |
| C-06 モバイルで Cornell 部分の横スクロールを許容 | 現行の Cornell grid は `lg:grid-cols-[...]` のみで、lg 未満は通常の 1 カラムへ落ちる。Cornell section に `overflow-x-auto` と横長作業面はない。Preview 内の code / table には局所的な横 overflow がある。 | 基本情報と Summary は通常の縦スクロールを維持し、Cornell section だけを局所 `overflow-x-auto` の作業面にする。Cue 30% / Note 70% と本文 textarea / Preview の関係を保てる最小幅を定め、375px / 768px でもフォーカス・入力・追加・削除が操作可能であることを確認する。 | `note-editor.tsx:236-302`、`src/shared/markdown/markdown-field.tsx:86-95`、`src/app/globals.css:1-31`。body / main 全体へ overflow を付けると横スクロール範囲が広がり操作性を損なう。`min-w-0` と inner min-width の組み合わせを実機で確認する必要がある。 |

### 3. 共通化の判断

#### 同一 implementation task に含めるもの

既存の共通化を再利用し、作成と編集で別フォームを作らない。

| 共有対象 | 現行の所在 | 判断 |
| --- | --- | --- |
| 基本情報の DOM、Cue、本文、Summary、次回復習日、保存 / キャンセルの配置 | `src/app/notes/_components/note-editor.tsx:129-350` | 方針 C のレイアウト実装 task に含める。ここを変えるだけで `/notes/new` と `/notes/[id]` edit の両方へ反映される。 |
| controlled form state と初期値 | `src/modules/notes/model/note-editor-form.ts:19-77` | layout では型・payload を変更せず、そのまま利用する。初期値変換は既に create / edit 共通。 |
| Preview の sanitize / checkbox read-only | `src/shared/markdown/markdown-field.tsx:31-165` | 本文横並びのための opt-in 表示 variant が必要な場合だけ同一 task で最小変更する。既定の Summary / detail 表示は縦または現状を保つ。 |
| TagInput、Cue 追加 / 削除、field error 表示 | `note-editor.tsx:55-88`、`:445-607` | UI の距離は変えてよいが、state、validation、API 契約は同一 task で保持する。 |

#### 同一 task に含めないもの

| 非共有責務 | 現行の所在 | 分離理由 |
| --- | --- | --- |
| create / edit の API と遷移 | `note-editor.tsx:90-126` | `POST` 後の route push と `PATCH` 後の `onSaved` は既存動作を維持し、レイアウト変更と混ぜない。 |
| 新規 route wrapper | `src/app/notes/new/page.tsx:3-9` | `NoteEditor` の mode 指定以外の責務がないため、通常は変更不要。 |
| 詳細取得、404、view / edit / review の切替 | `src/app/notes/[id]/page.tsx:19-45`、`note-detail-modes.tsx:124-225` | ルーティング・Server/Client 境界・モード state はフォーム layout と独立。 |
| 閲覧・復習の本文非表示、復習更新、削除 | `note-detail-modes.tsx:134-183`、`:306-409` | NTE-030 view / review は方針 C 文書で未決定事項と screenshot 不足が残る。C の edit 共通化 task に取り込むと仕様が膨らむ。 |
| Draft / autosave / NoteCard / D&D | `note-editor.tsx:30-36`、`src/app/notes/types.ts:7-22`、`doc/testing/TEST_SCENARIOS.md:191-239` | 現在 MVP 外。レイアウト task の受け入れ条件に含めない。 |

**推奨判断:** 「NTE-020 方針 C の shared editor layout」を 1 つの implementation task とし、`NoteEditor` を create / edit 共通の変更点にする。`NoteDetailModes` は edit の見出し・外側余白を合わせる必要がある場合だけ最小変更を許可し、view / review の Cornell 表示再設計は別 task または別の仕様判断後に行う。

### 4. 影響範囲

| 領域 | 影響 | 変更候補 / 変更しないもの |
| --- | --- | --- |
| UI / JSX | 基本情報の密度、Cornell 内の本文作業面、Summary の高さ・余白が変わる。Cue の追加ボタン位置は現行が方針に近い。 | 主対象は `src/app/notes/_components/note-editor.tsx`。`src/app/notes/new/page.tsx` と `src/app/notes/[id]/page.tsx` は原則変更しない。edit header の整合が必要なら `note-detail-modes.tsx:197-225` のみ確認する。 |
| 状態管理 | form は `useState` の controlled state、保存中、message、fieldErrors。layout 変更だけなら状態・イベント・payload は不変。 | `note-editor-form.ts`、`remote/index.ts`、create / update API は変更しない。mode / onSaved / router の責務をレイアウトへ移さない。 |
| API / DB | 影響なし。現在は `NotebookInput` の `body` と `cues` を保存するだけで、レイアウトは API shape に依存しない。 | Prisma schema、route、migration、依存関係は対象外。 |
| CSS / responsive | `globals.css` は token と box-sizing のみで、画面の grid / gap / overflow は JSX の Tailwind class。 | まず scoped class / wrapper で実装する。共通 token が不足する場合だけ `globals.css` を別途判断し、body 全体の横 overflow は避ける。 |
| テスト | 既存の create/detail の保存・validation・Preview シナリオは維持。新たに desktop 横並び、短いスクロール、局所横スクロール、mobile 操作不能なしを確認する必要がある。 | `doc/testing/TEST_SCENARIOS.md:26-46`、`:76-109`、`:165-175` に UI 配置・viewport のチェックを追加する候補。リポジトリ内に Playwright / E2E spec は見当たらないため、自動化は別途 harness の要否を決める。 |
| screenshot / review | 現行の新規画面は `doc/assets/screenshots/mvp-note-new.png` が 1440x1750、詳細は 1440x1000。NTE-030 edit / review と mobile の実装 screenshot は不足。 | 実装後に new desktop、detail edit desktop、new/edit mobile を撮り、`doc/review/MVP_SCREENSHOT_WIREFRAME_LAYOUT_REVIEW.md` の分類を更新する候補。今回の調査では画像・レビュー文書を変更しない。 |
| 設計書 | 方針 C は `NTE_020_NEW_NOTE_LAYOUT_POLICY.md` と `MVP_UI_WIREFRAMES.md` に既に反映済み。 | 実装 task では既存設計書を正本として参照し、実装結果が異なる場合のみ後続レビューで差分を記録する。 |

### 5. 推奨 task 分割（依存順）

#### Task 1: NTE-020 / NTE-030 edit 共通フォームの方針 C レイアウト実装

- **目的:** 既存 `NoteEditor` の create / edit 共通フォームへ、横長画面向けの基本情報圧縮、Cue / Note / Preview の近接、本文 textarea / Preview 横並び、Summary の縦構造を実装する。
- **対象領域:** `src/app/notes/_components/note-editor.tsx`。本文横並びのために必要な場合のみ `src/shared/markdown/markdown-field.tsx` を opt-in prop / wrapper として最小変更する。`new/page.tsx` と route/API は原則対象外。
- **完了条件:** (1) create と edit の両方が同一 DOM 方針を使用する、(2) 基本情報の項目・タグ候補・field error が維持される、(3) desktop で Cornell の Cue 30% / Note 70% と Note 内 textarea / Preview 横並びが確認できる、(4) Summary は textarea→Preview→次回復習日→キャンセル / 保存の順を維持する、(5) create は保存後詳細へ、edit は保存後閲覧へ戻る。
- **検証方法:** 既存 `TEST_SCENARIOS.md:28-46` と `:78-92` の機能確認、`npm run lint`、横長 viewport（目安 1280px / 1440px）の手動またはブラウザ確認。Preview の checkbox、sanitize、空状態も `:167-175` で再確認する。
- **主なリスク:** `MarkdownField` の既定表示を変更すると Summary や詳細表示まで横並びになる。opt-in 化し、保存 / payload / mode を触らないこと。

#### Task 2: Cornell 部分の responsive / mobile 横スクロール境界確認

- **依存:** Task 1。
- **目的:** 方針 C の mobile 最低条件（Cornell 構造を保つ局所横スクロール、操作不能なし）を実装し、page 全体の横 overflow と区別する。
- **対象領域:** Task 1 の Cornell wrapper / grid、必要な scoped style。`src/app/globals.css` は本当に共通 style が必要な場合だけ。view / review の mobile レイアウトは別判断とする。
- **完了条件:** (1) 基本情報と Summary は通常の縦スクロール、(2) Cornell 部分だけ Cue / Note / Preview を横に確認できる、(3) 375px / 768px で入力、Cue 追加・削除、Preview、保存 / キャンセルが操作可能、(4) body 全体に不要な横スクロールが出ない、(5) desktop の比率・可読性が崩れない。
- **検証方法:** 375px、768px、1280px 以上の viewport で manual / Playwright 確認。キーボード tab 移動、長い Markdown、長いタグ、空状態、field error を確認する。
- **主なリスク:** `min-w-0` のままでは横長関係を保持できず、逆に wrapper の `min-width` を広げ過ぎると page 全体が横スクロールする。overflow の境界を Cornell section 内に限定する。

#### Task 3: NTE-020 / NTE-030 edit レイアウト受け入れ観点の追加

- **依存:** Task 1、Task 2。
- **目的:** 実装された方針 C を回帰可能なテスト観点として固定する。
- **対象領域:** `doc/testing/TEST_SCENARIOS.md` の作成・詳細編集・Markdown / responsive 観点。自動化する場合は、既存 harness がないため別途テスト基盤の採否を決める。
- **完了条件:** 既存の保存 / validation / Preview シナリオを残したまま、desktop 横並び、基本情報の短縮、Summary 操作位置、mobile 局所横スクロール、create / edit 同一構造を 1 項目 1 チェックで記録する。
- **検証方法:** `rg` で必須シナリオを確認し、Task 1 / 2 の manual または browser 結果を検証記録へ反映する。`npm run lint` はコード変更がある実装 task 側で実行する。
- **主なリスク:** 視覚的な期待を曖昧な文言で書くと回帰基準にならない。viewport、横スクロール領域、操作対象、期待順序を明記する。

#### Task 4: 実装後 screenshot とワイヤフレーム差分レビュー

- **依存:** Task 1、Task 2（Task 3 の受け入れ観点を先に確定すると望ましい）。
- **目的:** 方針 C が実画面で意図どおりかを、設計判断ではなく実装結果として記録する。
- **対象領域:** `doc/assets/screenshots/` の NTE-020 desktop / mobile、NTE-030 edit desktop / mobile。必要に応じて `doc/review/MVP_SCREENSHOT_WIREFRAME_LAYOUT_REVIEW.md` と README の screenshot 入口を更新する。
- **完了条件:** 既存 1440px desktop と比較できる NTE-020、新規と同じフォームが見える NTE-030 edit、mobile Cornell 横スクロール状態を取得し、基本情報、本文 Preview、Summary 操作、ページ全体 overflow の差分を記録する。NTE-030 view / review は未決定なら未決定のまま明示する。
- **検証方法:** ブラウザ / Playwright screenshot と `file` による画像寸法確認。ワイヤフレームの 1280x900 と実装の viewport 条件を記録して単純な高さ比較だけにしない。
- **主なリスク:** screenshot の見た目だけで view / review の採否まで決めてしまうこと。NTE-030 edit と view / review を別分類する。

#### Task 5（任意・別判断）: NTE-030 view / review の Cornell レイアウト方針決定

- **依存:** Task 4 の edit / mobile screenshot と、発注者による view / review の採否判断。
- **目的:** 現行 `NoteDetailModes` の閲覧・復習レイアウトを C と同じ方向へ寄せるか、現行カード分割を維持するかを決める。
- **対象領域:** `src/app/notes/_components/note-detail-modes.tsx:230-409`、NTE-030 wireframe / review 文書。決定前の実装変更はしない。
- **完了条件:** view / review それぞれの主目的、Cue と本文の表示関係、本文非表示状態、Summary、mobile 方針、必要 screenshot が決まる。
- **検証方法:** `doc/review/MVP_SCREENSHOT_WIREFRAME_LAYOUT_REVIEW.md:96-118` の `needs-decision` / `missing-screenshot` を解消する材料を確認する。
- **主なリスク:** NTE-020 の編集フォーム task に view / review、復習 state、削除 state を混ぜて責務と受け入れ条件が拡散すること。

## Verification

| 確認項目 | 結果 | 備考 |
| --- | --- | --- |
| 作業前 `git status --short` | 完了 | 既存の未追跡 summary 3 件（`1907-*`、`1908-*`、`1913-*`）を確認。変更・削除していない。 |
| 指定対象の内容確認 | 完了 | 実装、直接参照 UI / model、方針、wireframe、レビュー、テストを行番号付きで照合した。 |
| コード / 設定 / 依存関係 / テスト / 既存設計書 / 画像の変更 | なし | 成果物は本 summary のみ。 |
| `npm run lint` | 未実行 | コード変更を伴わない調査 task のため。 |
| `npm run build` | 未実行 | コード変更を伴わない調査 task のため。 |
| `git diff --check` | 完了 | 終了コード 0。未追跡 summary の末尾空白は別途 `awk` で確認し、問題なし。 |
| summary 必須見出し | 完了 | `tools/check-summary.sh` が終了コード 0。`Objective`、`Scope`、`Inputs Read`、`Changes Made`、`Findings`、`Verification`、`Remaining Unknowns`、`Next Read` を確認した。 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 / 判断 |
| --- | --- | --- |
| U-001 | Cornell 内部の最小横幅、Cue / Note / Preview の具体的な CSS 幅、どの breakpoint を desktop とするかは方針文書に数値がない。 | Task 1 / 2 で 1280px、768px、375px の実画面を確認し、実装値を受け入れ条件へ固定する。 |
| U-002 | モバイル横スクロール方針を `/notes/new` と NTE-030 edit だけへ適用するか、NTE-030 view / review にも適用するかは未決定。 | Task 5 で view / review screenshot と主目的を確認し、別 task の要否を発注者が決める。 |
| U-003 | 本文横並びを `MarkdownField` の新しい opt-in prop で表現するか、`NoteEditor` 内の本文専用 wrapper で表現するかは未決定。 | Task 1 実装時に Summary の既定縦並びと他利用箇所への影響を確認して選ぶ。 |
| U-004 | 実装後 screenshot をどの viewport・データ量・状態（空 Cue、入力済み、field error、mobile overflow）で標準化するかは未決定。 | Task 3 で状態と viewport を固定し、Task 4 で取得する。 |
| U-005 | リポジトリ内に Playwright / E2E spec は見当たらず、今回の調査では新規 test harness の追加可否を判断していない。 | 自動化が必要なら、レイアウト実装とは別にテスト基盤 task として見積もる。 |
| U-006 | `src/app/notes/types.ts` の旧 `NoteCard` 型と現行単一 `body` の将来統合方針は未解決。 | NTE-020 C の layout task では扱わず、NoteCard / D&D の別設計 task で決める。 |

## Next Read

次の Manager / Worker は、まずこの summary を読み、実装 task を Task 1 または Task 2 の粒度で切る。

- `summary/20260714/retry-nte020-policy-c-impact-report.md`
- `doc/screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md`
- `src/app/notes/_components/note-editor.tsx`
- `src/shared/markdown/markdown-field.tsx`
- `src/app/notes/_components/note-detail-modes.tsx`（edit wrapper または Task 5 を扱う場合のみ）
- `doc/testing/TEST_SCENARIOS.md`
