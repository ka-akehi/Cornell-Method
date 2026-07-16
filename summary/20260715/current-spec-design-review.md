# 現行仕様・画面・実装の第三者レビュー

レビュー日: 2026-07-15  
レビュー種別: 読み取り専用の仕様・UX・実装整合性レビュー  
対象: `AGENTS.md`、`HANDOFF_2026-07-15.md`、画面設計・ワイヤフレーム・画面棚卸し、`IMPLEMENTATION_STATUS.md`、`TEST_SCENARIOS.md`、`README.md`、`package.json`、`prisma/schema.prisma`、現行の `src/app/` / `src/shared/` / `src/lib/` と、それらが利用する `src/modules/` / `src/server/`

## 1. 総評

現行実装は、明示保存型の小さな MVP として見ると、基本フロー（一覧 → 新規作成 → 詳細閲覧 → 編集 → 復習）と Cornell の視線構造をかなり素直に実現している。NTE-020 の Policy C も、基本情報を圧縮し、Cue / 本文を 30% / 70% で並べ、本文だけ Preview を横並びにする方針がコードとスクリーンショットに反映されている。NTE-030 も、概要 → Cornell → サマリーの共通シェルと本文だけのマスクがコード・設計書で揃っている。

最大の問題は、画面設計が意図的に絞った「現行 MVP」と、`AGENTS.md` に書かれた広い将来仕様、さらに `IMPLEMENTATION_STATUS.md` の実装済み記述が、同じ時点の仕様として並んでいることである。たとえば、画面設計は `/backup`、物理削除、手動保存、詳細内復習を MVP としている一方、`AGENTS.md` は `/notes/backup`、ソフトデリート + Undo、ドラフト自動保存、`/tasks/review`、PDF、カード D&D を要求している。実装状況は後者を「実装済み」と記載するが、コードと Prisma schema には存在しない。

したがって、次に必要なのは大規模な UI 作り直しではなく、まず「現行 MVP の契約」と「Phase 2 のロードマップ」を一つに固定することである。そのうえで、復習時の想起品質、検索の入力効率、削除時のデータ安全性、エラー / キーボード利用の穴を優先して直すのが妥当である。

### 優先度の意味

- **P0**: 仕様・受け入れ判断を止める欠陥。データ消失または「完成したと誤認する」リスクを含む。
- **P1**: MVP の学習体験、入力効率、アクセシビリティ、保守性に実害がある改善候補。
- **P2**: 好み、証跡の品質、将来の拡張性に関わるが、現行 MVP の利用を直ちに止めないもの。

各項目の「対応種別」は、**仕様のみ**、**実装変更**、**両方**で区別した。

## 2. 必ず直すべき欠陥（P0）

### P0-01: 正本・MVP 境界・API 契約が一つに決まっていない

- **問題**: `AGENTS.md` は正本と明記されているが、画面設計・画面棚卸し・README はより小さい MVP を正本のように扱っている。ルート、HTTP メソッド、削除方式、保存方式、復習モデルが一致しない。
- **根拠**:
  - `AGENTS.md:58-73, 102-112, 125-135, 163-179` は日付ソート、ドラフト、Undo、`/tasks/review`、`/notes/backup`、`tags` クエリなどを要求する。
  - `doc/screens/MVP_SCREEN_DESIGN.md:21, 101, 183-188, 398` と `doc/screens/MVP_SCREEN_INVENTORY.md:300-310` は `/backup`、手動保存、物理削除、詳細内復習を MVP とし、その他を Phase 2 に送る。
  - 実装は `src/app/layout.tsx:10-14` の `/backup`、`src/app/api/notes/route.ts:17-23` の `tag`、`src/modules/notes/remote/index.ts:179-190` の `POST /api/notes/:id/review` を使う。
- **ユーザー影響**: Manager、Worker、テスト作成者が異なる契約を参照し、実装済み機能を誤認したり、不要な Phase 2 実装を MVP に混ぜたりする。ルート名やクエリ名の違いは、画面・API・E2E の接続不良に直結する。
- **改善案**: 「現行 MVP 契約」を一枚の表に固定し、少なくとも canonical route、query 名、HTTP メソッド、保存方式、削除方式、復習状態、Phase 2 送りを列挙する。`AGENTS.md` は製品全体のロードマップ、画面設計とテストは MVP 契約、と役割を明示するか、どちらか一方へ統合する。
- **対応種別**: 仕様のみ（現行 MVP を採用する場合）。`AGENTS.md` の広い仕様を現行完成条件にする場合は、API / DB / UI の実装変更も必要。
- **発注者の判断**: 必須。Manager 推奨は、まず現在の `/backup`・物理削除・手動保存・詳細内復習を MVP 契約として固定し、ドラフト / Undo / `/tasks/review` / PDF / Card model は明示的に Phase 2 とすること。

### P0-02: 実装状況サマリが、コードと schema の実態を大きく上回っている

- **問題**: `IMPLEMENTATION_STATUS.md` は、未存在の API・モデル・UI を「実装済み」と記載している。
- **根拠**:
  - `doc/implementation/IMPLEMENTATION_STATUS.md:6-10, 35-46` はソフトデリート、Undo、復習タスク、PDF、ドラフト版楽観ロック、D&D、Cmd/Ctrl+S、3 秒自動保存を実装済みとしている。
  - `prisma/schema.prisma:9-64` に存在するモデルは `Notebook`、`Tag`、`NotebookTag`、`Cue` のみで、`NotebookDraftState`、`NotebookReviewProgress`、`SoftDeleteBuffer`、`NoteCard`、`NoteCueLink`、`BackupLog` はない。
  - `src/app/api/` に存在するのは notes / tags / backups と `/api/notes/:id/review` で、`/api/undo`、`/api/review-tasks`、`/api/notes/export`、`/api/backups/retry` はない。
  - `src/app/notes/_components/note-editor.tsx:30-35, 45-120, 228-305` は通常の textarea と Cue リストであり、D&D、自動保存、競合処理、キーボードショートカットの実装はない。`draft?: unknown` も利用されていない。
- **ユーザー影響**: 計画・受け入れ・次タスクの優先順位が誤る。特に「ドラフトや Undo はある」と信じて入力・削除を行うと、実際には保存されない / 復元できない。
- **改善案**: 実装状況を「実装済み / 部分実装 / 未実装 / 仕様のみ」に分解し、各行に正確な route、schema model、画面、テスト証跡を付ける。未実装 API はエンドポイント一覧から削除する。`rg --files src/app/api` と `prisma/schema.prisma` を基準に棚卸しする。
- **対応種別**: 仕様・記録のみ。将来仕様を完成条件とするなら別タスクで実装変更。
- **発注者の判断**: P0-01 で MVP 範囲を決めれば、記録の修正方針は決まる。

### P0-03: 削除が恒久的なのに、製品正本は Undo / ソフトデリートを要求している

- **問題**: 現行 UI は確認後に `DELETE` し、DB から物理削除する。確認ダイアログはあるが、取り消し手段はない。
- **根拠**:
  - `src/app/notes/_components/note-detail-modes.tsx:163-181` は `window.confirm` 後に削除 API を呼ぶ。
  - `src/app/api/notes/[id]/route.ts:58-68` は削除成功時 204 を返す。
  - `src/server/notes/infrastructure/command.repository.ts:156-168` は `prisma.notebook.delete` を実行する。`prisma/schema.prisma:22` の `deletedAt` は使われていない。
  - `AGENTS.md:65-71, 173-175` は 5 秒 Undo Snackbar とソフトデリートを要求する一方、`doc/screens/MVP_SCREEN_DESIGN.md:398` は物理削除を MVP としている。
- **ユーザー影響**: 個人学習ノートを誤って削除した場合、確認を通過した後の復旧手段がなく、入力資産を失う。
- **改善案**:
  - 推奨案: MVP でもノート削除だけは `deletedAt` + Undo buffer + 5 秒 Snackbar を実装し、期限後に物理削除する。
  - 軽量案: 物理削除を MVP として維持するなら、`AGENTS.md` の Undo 要件を Phase 2 に移し、画面・README・実装状況から「復元可能」と読める記述を除く。
  - Cue 削除にも `AGENTS.md:87` の確認要件を適用するか、フォーム内の未保存操作はキャンセルで戻せるため確認不要と明記する。
- **対応種別**: 両方。軽量案は仕様のみ、推奨案は API / schema / UI 実装が必要。
- **発注者の判断**: 必須。学習データの価値を考えると、Manager 推奨は少なくともノート削除の Undo を MVP に入れること。ただし MVP を早く固定する目的なら、物理削除を明示的な例外として受け入れる。

### P0-04: 受け入れ証跡の状態が、現在の変更範囲を表していない

- **問題**: `TEST_SCENARIOS.md` のチェック項目は未チェックのままだが、同じ文書の検証記録と README は広い範囲を PASS と記載している。さらに NTE-020 / NTE-030 の直近変更後に、編集画面や mobile の確認が残っている。
- **根拠**:
  - `doc/testing/TEST_SCENARIOS.md:121-168, 236-244` は新しい responsive / common shell 項目を `[ ]` のまま、2026-07-05 の旧 MVP フローを PASS と記録している。
  - `HANDOFF_2026-07-15.md:95-109, 168-174` は NTE-020 edit runtime、NTE-030 375 / 768 runtime、長文 overflow が未確認で、チェックボックスも実施結果へ更新していないと明記している。
  - `README.md:77-103` は 2026-07-05 の主要 UI フローを「検証済み」としつつ、NTE-020 edit は含まないと記載している。
- **ユーザー影響**: 「現行コードの受け入れ済み範囲」と「過去に確認した範囲」が区別できず、回帰を見逃す。README の一覧 / 復習スクリーンショットは一時 QA ノートを使った証跡で、製品デモとしての代表性も低い。
- **改善案**: チェックリストを `未実施 / PASS / FAIL / N/A` と確認日・viewport・fixture・参照 summary の表へ置き換える。直近変更後の create / edit / view / review を分け、未確認項目は PASS に繰り上げない。スクリーンショットは代表的な日本語ノートの固定 fixture に置き換えるか、QA fixture であることを明記する。
- **対応種別**: 仕様・記録のみ（追加確認には QA 実行が必要）。
- **発注者の判断**: 受け入れ条件としてどの viewport / state を必須にするかを決める必要がある。現行 handoff の未確認項目を残したまま「完成」とはしないことを推奨する。

## 3. 改善するとよい UX・実装（P1）

### P1-01: 復習モードでサマリーを最初から見せると、想起課題が弱くなる

- **問題**: 本文はマスクされるが、サマリーは復習開始時から全文表示される。サマリーが本文の答えや結論を含む場合、Cue からの想起より先に答えを読めてしまう。
- **根拠**: `doc/screens/MVP_SCREEN_DESIGN.md:303-325, 376-385` は Cue とサマリーを手がかりにする初期表示を定義し、`src/app/notes/_components/note-detail-modes.tsx:321-361` は本文だけをマスクしてサマリーを常時 `MarkdownPreview` する。既存の `runtime-note-detail-review-1440.png` でもサマリーは表示される。
- **ユーザー影響**: Cornell Method の「思い出してから答え合わせする」体験が、単なる読み返しになりやすい。復習完了ボタンを押しても、想起したかどうかを振り返りにくい。
- **改善案**: 共通シェルの順序は維持したまま、復習時のサマリーを初期折りたたみ（「サマリーを表示」）にする、または本文表示後にだけサマリーを開けるようにする。少なくとも「Cue → 自分の想起 → サマリー / 本文で答え合わせ」の順を画面上で明示する。
- **対応種別**: 両方。セクション状態の実装と復習仕様の更新が必要。
- **発注者の判断**: 必須。Manager 推奨は、サマリーを初期非表示にし、復習シェルの位置は維持する案。

### P1-02: 一覧検索が「検索ボタン」と「入力ごとの自動検索」の二重仕様になっている

- **問題**: フリーワード、日付、タグ、復習チェックを変更するたびに一覧取得が走る一方、検索ボタンも存在する。リクエストのキャンセル / 世代管理もない。
- **根拠**: `src/app/notes/_components/notes-list.tsx:39-72` で `loadNotes` は入力状態を依存に持ち、`src/app/notes/_components/notes-list.tsx:93-100` で `loadNotes` を effect から自動実行し、`src/app/notes/_components/notes-list.tsx:200-212` で別途検索ボタンを提供している。
- **ユーザー影響**: 入力中に連続 API 呼び出しが発生し、遅いレスポンスが新しい検索結果を上書きする可能性がある。検索ボタンを押す必要があるのか、入力だけで確定するのかも分かりにくい。
- **改善案**: MVP では入力状態と適用済み検索条件を分離し、検索ボタン / Enter でだけ取得するのが最小で安全。ライブ検索を採用するなら 300〜500ms の debounce、AbortController または request sequence guard、loading 表示を併せて入れる。
- **対応種別**: 実装変更。選択した検索方式を設計書へ追記する。
- **発注者の判断**: 推奨は明示実行型。ローカル個人利用でも、検索条件をまとめてから結果を見る方が誤検索と競合表示が少ない。

### P1-03: 一覧のタグフィルタに最大 12 件制限がない

- **問題**: ノート編集では 12 件制限があるが、一覧側では選択タグを無制限に追加できる。
- **根拠**:
  - `AGENTS.md:79, 102` はノート / 一覧タグを最大 12 個とする。
  - `src/app/notes/_components/notes-list.tsx:102-106` の `handleAddTag` は重複だけを防ぎ、件数を検査しない。
  - `src/app/notes/_components/note-editor.tsx:489-505` には 12 件検査があるため、同じ概念で実装差がある。
- **ユーザー影響**: タグ条件が増え続け、狭い画面で検索条件の視認性が落ちる。仕様上の上限を UI だけでなく filter state が破れる。
- **改善案**: 12 件に達したら追加ボタンと候補 select を disabled にし、理由を表示する。フル仕様の tokenizer / free word / autocomplete を採用する場合は、その入力体験と上限を同時に設計する。
- **対応種別**: 実装変更。tokenizer まで入れる場合は別の仕様変更も必要。
- **発注者の判断**: 現行 MVP では select + OR 条件でよいが、上限は編集画面と一覧で共通化することを推奨する。

### P1-04: エラー状態とキーボード / スクリーンリーダー状態が設計書ほど揃っていない

- **問題**: 取得失敗時の表示、field error の関連付け、フォーカス可視性に部分的な欠落がある。
- **根拠**:
  - `doc/screens/MVP_SCREEN_DESIGN.md:344-350` は詳細取得失敗も「ノートが見つかりません」と一覧リンクを表示するとするが、`src/modules/notes/remote/index.ts:194-211` は 404 以外を throw し、`src/app/notes/[id]/page.tsx:24-44` はその例外を画面内表示へ変換しない。
  - `src/app/notes/_components/notes-list.tsx:291-299` の日付 / 一覧エラーと `src/app/backup/page.tsx:98-107` の成功 / エラー表示には `role="alert"` や `aria-live` がない。
  - `src/app/notes/_components/notes-list.tsx:332-336` は `focus:outline-none` を指定しているが、代わりの focus ring がないため、キーボード利用時に選択位置が見えにくい。
  - `src/app/notes/_components/note-editor.tsx:273-285, 551-605` の Cue / タグの field error は、`aria-invalid` はある箇所でも `aria-describedby` がなく、タグ候補失敗やエラー文との関連付けもない。
- **ユーザー影響**: API 障害時に白い画面や Next のエラー画面へ落ちる。キーボード利用者が一覧項目やエラー箇所を追えない。入力エラーの読み上げ順も安定しない。
- **改善案**: 詳細ページに error boundary または明示的な取得失敗フォールバックを追加する。エラー / 成功 / loading に `role="alert"` / `aria-live` を付け、field error の ID を全入力へ `aria-describedby` で接続する。`focus:outline-none` は削除するか明示的な `focus-visible:ring` に置き換える。
- **対応種別**: 実装変更。状態とアクセシビリティの受け入れ条件も更新する。
- **発注者の判断**: なし。現行の「キーボードで全要素にアクセス可能」という非機能要件に対する不足として直すべき。

### P1-05: 375px の局所横スクロールは構造を守るが、操作の発見性が低い

- **問題**: Cornell 部分を `min-width: 640px` の横スクロール領域にしているため、375px では初期表示で Cue と本文の一部しか見えず、Preview や本文欄を横へスワイプできることが画面から分かりにくい。
- **根拠**:
  - 方針は `doc/screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md` の Policy C と `doc/screens/MVP_UI_WIREFRAMES.md:246-254` にある。
  - 実装は `src/app/notes/_components/note-editor.tsx:236-237` の `overflow-x-auto` + `min-w-[640px]`。
  - `doc/assets/screenshots/nte020-policy-c-new-375.png` では、Cornell の右側本文が大きく切れており、横スクロールの手がかりがほぼない。`HANDOFF_2026-07-15.md:168-174` も長文・長いタグ・field error の overflow を未確認としている。
- **ユーザー影響**: モバイル利用者が本文入力や Preview の存在に気づかず、Cue だけ入力して離脱する可能性がある。横スクロールを許容しただけでは「操作可能」の保証にならない。
- **改善案**: 375px では Cue → 本文 → Preview の縦積みに切り替える案、または横スクロールを維持して「右に本文 / Preview あり」の常時ラベル・fade・scroll hint を追加する案を比較する。少なくとも本文 Preview、長文、エラー表示、実際の入力操作を 375px で確認する。
- **対応種別**: 両方。レイアウト変更またはスクロール案内の実装と、Policy / acceptance の更新が必要。
- **発注者の判断**: 「Cornell の左右関係を最優先」なら現方針、「モバイルで入力完了できることを最優先」なら 375px だけ縦積みを推奨する。

### P1-06: モード画面の戻る操作が重複し、未保存キャンセル時のデータ損失確認もない

- **問題**: 閲覧以外の詳細モードでは、一覧へ戻るリンクと閲覧へ戻るボタンが同じヘッダーに並ぶ。編集のキャンセルは変更を即破棄し、dirty 状態の確認がない。
- **根拠**:
  - `src/app/notes/_components/note-detail-modes.tsx:243-290` は review / edit でも「一覧へ戻る」と「閲覧へ戻る」を併記する。既存の `runtime-note-detail-review-1440.png` でも二つの戻る操作が見える。
  - `src/app/notes/_components/note-detail-modes.tsx:214-224` と `src/app/notes/_components/note-editor.tsx:330-342` は編集キャンセルで即 `setMode("view")` する。
  - 画面設計は `doc/screens/MVP_SCREEN_DESIGN.md:367-370` で確認ダイアログを必須にしていない。
- **ユーザー影響**: 復習中にどこへ戻るのか判断コストが増える。長文を入力してから誤って戻ると、保存前の内容を失う。
- **改善案**: モード内の主導線を一つにし、一覧リンクは低優先度の「終了」、復習では「閲覧へ戻る」を主操作にする。編集では dirty 状態を追跡し、変更があるときだけ確認する。確認を MVP 外にするなら、ボタン文言を「変更を破棄して閲覧へ戻る」と明示する。
- **対応種別**: 両方。UI 実装と操作仕様の明文化が必要。
- **発注者の判断**: 編集内容を失っても MVP では許容するか。個人利用でも、長文 Markdown を扱うため確認を入れることを推奨する。

### P1-07: 概要・サマリー・タグの意味と入力契約が揃っていない

- **問題**: 「概要」と「サマリー」の役割が画面上で近く、Markdown 対応も正本と実装で違う。タグの日本語文字・色の扱いも契約が曖昧である。
- **根拠**:
  - `AGENTS.md:55, 67, 77, 97-98` は Markdown 入力を広く要求するが、`src/app/notes/_components/note-editor.tsx:206-224` は概要を通常の textarea、`src/app/notes/_components/note-detail-modes.tsx:306-314` は通常の `<p>` として表示する。Markdown Preview は本文 / サマリーだけである。
  - `src/app/notes/_components/note-editor.tsx:308-318` は要約と次アクションを一つの `summary` 欄に集約する。保存後も `prisma/schema.prisma:16-17` は一つの `body` / `summary` 文字列である。
  - `AGENTS.md:80` のタグ許可文字には漢字がないが、`src/modules/notes/contracts/note.schema.ts:40-43` は Han を許可する。`src/server/notes/infrastructure/command.repository.ts:21-29` は新規タグ色を `null` 保存し、`src/app/notes/_components/note-detail-modes.tsx:25-31` は色文字列に `1A` を連結するため、色形式も未定義である。
- **ユーザー影響**: 「概要には何を書くか」「サマリーに何を書くか」が曖昧で、一覧と復習で重複した文章になりやすい。日本語タグの許可・色表示が入力によって変わる。
- **改善案**: 概要を「このノートの背景 / 範囲」、サマリーを「学んだ要点」、次アクションを「次に行うこと」と説明文・例で分ける。概要を Markdown にするなら `MarkdownField` + Preview にする、しないなら `AGENTS.md` を修正する。タグは漢字を正式に許可するか決め、`#RRGGBB` などの色形式、既定色、大小文字 / 空白の正規化を schema と UI で共通化する。
- **対応種別**: 両方。説明文だけなら小さな UI 変更、Markdown / 色を正式化するなら schema と表示実装が必要。
- **発注者の判断**: 日本語学習アプリとして漢字タグを許可する案を推奨する。概要は MVP ではプレーンテキストのままにし、Markdown 全面対応は本文・サマリー・Cue の範囲を明記して過剰実装を避ける案が現実的。

### P1-08: 編集時の Cue 全削除・再作成は Phase 2 の関連付けと相性が悪い

- **問題**: ノートを編集するたびに Cue を全削除して新規作成するため、Cue ID が変わる。将来 `NoteCueLink`、カード単位の履歴、Undo を導入する際に既存 ID を追跡できない。
- **根拠**: `src/server/notes/infrastructure/command.repository.ts:105-145` は Notebook 更新後に `cue.deleteMany` / `cue.createMany`、タグ関連も全削除・再作成する。`prisma/schema.prisma:53-64` の Cue は単純なリストで、`AGENTS.md:146-155` の CueCard / NoteCard / NoteCueLink は未実装である。
- **ユーザー影響**: 現行 MVP では表面化しないが、Phase 2 のカード化や関連付けで移行が必要になり、削除履歴・並び替え・外部参照を保持できない。将来差分保存を追加しても、既存 ID の不安定さが負債になる。
- **改善案**: Phase 2 の着手前に、Cue を安定 ID で patch / soft delete するか、MVP は全置換と割り切って移行スクリプトを用意するかを決める。現時点で NoteCard を先行実装する必要はないが、将来の参照 ID を壊すことを設計書に明記する。
- **対応種別**: 仕様 + 将来の実装変更。現行 MVP だけなら記録のみでよい。
- **発注者の判断**: Phase 2 でカード化を近く行うなら安定 ID を推奨。Phase 2 が遠いなら、今は全置換を維持して schema を無理に複雑化しない。

### P1-09: バックアップ名が秒精度で、同一秒の作成が上書きになる

- **問題**: バックアップファイル名が秒精度で生成され、同一秒に二回作成すると同じ `.db` を上書きする。
- **根拠**: `src/server/backup/infrastructure/local-sqlite-backup-provider.js:118-142` は `new Date().toISOString().slice(0, 19)` を使い、存在確認や排他的作成なしに `copyFileSync` する。
- **ユーザー影響**: 連続クリックや CLI / API の同時実行で、バックアップ世代数・作成履歴が期待と異なる。内容が同一なら気づきにくく、バックアップの証跡として不正確になる。
- **改善案**: ミリ秒またはランダム suffix を含め、`wx` 相当の排他的作成か、同名なら再生成する。作成処理と prune を同時実行から保護し、同時作成テストを追加する。
- **対応種別**: 実装変更 + テスト追加。
- **発注者の判断**: なし。バックアップ機能を残すなら安全側に直す。

## 4. 好み・将来検討（P2）

### P2-01: MVP 外の依存関係と型が先に入り、実装の実態を分かりにくくしている

- **問題**: `package.json:19-29` には `@dnd-kit/*`、`@uiw/react-md-editor`、`react-day-picker` などがあるが、現行画面は textarea / select / CSS grid で実装されている。`src/app/notes/types.ts` にも未使用の `NoteCard` 型がある。
- **影響**: 依存更新・脆弱性対応・bundle 解析の対象が増え、読者が「入っているから実装済み」と誤認しやすい。
- **改善案**: MVP で使わない依存を外すか、`Phase 2 reserved` と README / package コメントで明示する。依存を残す理由がある場合は使用予定の task / acceptance と紐付ける。
- **対応種別**: 仕様・依存整理。Phase 2 を近く実装するなら残置でもよい。
- **判断**: なし。短期の MVP 安定性を優先するなら未使用依存を減らす案がよい。

### P2-02: design token と画面内の直接色指定が混在している

- **問題**: `globals.css` は `background` / `surface` / `border` 等の token を定義する一方、主要 UI は `stone-*` / `amber-*` を直接指定し、Markdown checkbox も `accent-amber-500` である。
- **根拠**: `src/app/globals.css:5-20`、`src/shared/markdown/markdown-field.tsx:125-133`、`src/app/notes/_components/note-editor.tsx:146-346`。
- **影響**: テーマ変更、コントラスト調整、タグ色の統一が画面ごとの置換作業になる。`AGENTS.md:98` の `accent-primary` 等の方針とも一致しない。
- **改善案**: MVP の色を token として確定し、主要状態（primary / danger / error / success / checkbox）に名前を付ける。全面置換は後回しでよいが、新規コンポーネントから token を使う。
- **対応種別**: 実装変更（低優先）。
- **判断**: なし。

### P2-03: README の手順に個人環境の絶対パスがある

- **問題**: `README.md:205-216` の Design Studio 導入例に `/Users/kazuya/Desktop/自己学習/Cornell-Method` が固定されている。現在の checkout は `/Users/blp542/...` であり、そのままでは再現できない。
- **影響**: 別ユーザー・別マシンで README 手順が失敗する。個人利用でも将来の引き継ぎ時に不要な混乱を生む。
- **改善案**: `$PWD`、repo root の相対パス、またはこの repo に依存しない一般的な説明へ置き換える。
- **対応種別**: 仕様・ドキュメントのみ。
- **判断**: なし。

### P2-04: 状態別 UI ワイヤフレームが設計書上「予定」のまま

- **問題**: `MVP_UI_WIREFRAMES.md:36` は loading / empty / error / validation / saving 等を別文書で補完予定とし、末尾 `:624-637` でも未対応項目として残している。一方、画面設計では状態表示の具体的文言を定義している。
- **影響**: 実装者は状態の位置・優先度・スクロール挙動を文言表から推測することになる。特に mobile の error と save 中状態は、normal state のワイヤフレームだけでは判断できない。
- **改善案**: 新規の大きなデザイン資料を作る必要はなく、各画面の状態遷移表に「表示位置、role、再試行 / 戻る操作、フォーカス先」を追加する。現在の P1-04 と QA 項目をその表へリンクする。
- **対応種別**: 仕様・記録のみ。
- **判断**: なし。

## 5. 問題なし / 良い点

「問題なし」は、将来改善が不要という意味ではなく、現行 MVP 契約を採用する限り設計とコードが揃っているという意味である。

- **Cornell の主構造**: `doc/screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md` の Policy C と `src/app/notes/_components/note-editor.tsx:236-305` が、Cue / Note の 30% / 70%、本文 textarea / Preview の desktop split、Summary の stacked 表示で一致している。
- **作成・編集の一貫性**: `src/app/notes/new/page.tsx:1-10` と `src/app/notes/_components/note-detail-modes.tsx:214-225` が同じ `NoteEditor` を利用するため、create / edit で validation、タグ、Markdown、保存レイアウトが分岐しにくい。
- **閲覧・復習の共通シェル**: `doc/screens/MVP_SCREEN_DESIGN.md:253-263`、`doc/screens/MVP_UI_WIREFRAMES.md:298-306`、`src/app/notes/_components/note-detail-modes.tsx:306-363` が、概要 → Cornell → サマリーの順序と、本文領域だけのマスクを共有している。復習時に Cue を別の上段へ移していない点は、画面の再学習コストを抑える。
- **Markdown の安全性**: `src/shared/markdown/markdown-field.tsx:158-164` の `remark-gfm` + `rehype-sanitize` と、`:119-134` の表示専用 checkbox override は、MVP の Markdown / checkbox 仕様に合っている。既存の `TEST_SCENARIOS.md:226-234` の確認観点も適切である。
- **基本的な API 責務分離**: notes route → application service → repository の流れ（`src/app/api/notes/route.ts:1-50`、`src/server/notes/application/`、`src/server/notes/infrastructure/`）は、画面から Prisma を直接扱わない構造になっている。作成・編集の主要更新も transaction 内にまとまっている。
- **空 / loading / validation の素地**: 一覧、フォーム、詳細、バックアップそれぞれに空状態・loading・API error の表示領域があり、`note.schema.ts:73-127` にはタイトル、日付、次回復習日、タグ、Cue のサーバー側 validation がある。完全ではないが、MVP の状態設計を追加しやすい。
- **レスポンシブの意図**: `note-editor.tsx:236-237` は横 overflow を Cornell 部分へ閉じ込め、基本情報と Summary を通常の縦スクロールに残している。`HANDOFF_2026-07-15.md:95-104` の 1440px runtime 確認と、NTE-020 375 / 768 / 1280 / 1440 の既存証跡は、方針検討の出発点として有用である。
- **MVP の縮約自体**: NoteCard / D&D / 自動保存 / PDF / 専用復習タスクを最初から混ぜず、1 本文 + Cue リスト + 明示保存にした判断は、学習記録の最短フローを検証するには合理的である。問題は縮約したことではなく、縮約後の契約が `AGENTS.md` と一つに結びついていない点である。

## 6. 発注者が決めるべき論点

| ID | 決めること | 選択肢と影響 | Manager 推奨 |
| --- | --- | --- | --- |
| D-01 | 現行 MVP と `AGENTS.md` の関係 | A: 全機能を今の完成条件にする（大規模実装）。B: 現在の画面設計を MVP 正本にする（短期固定）。C: `AGENTS.md` を製品ロードマップ、別文書を MVP 契約に分離する（運用負荷は少し増える）。 | C。短期は B の内容を canonical MVP として固定し、AGENTS は Phase 2 を含むロードマップと明記する。 |
| D-02 | 削除の安全性 | A: 確認 + 物理削除（実装最小だが復元不可）。B: ノートだけ soft delete + 5 秒 Undo（実装コスト中、データ安全性高）。C: 全カードまで Undo（設計・実装コスト高）。 | B。MVP の価値を保ちつつ、誤削除の損失を抑える。 |
| D-03 | 復習時のサマリー | A: 常時表示（現在仕様、復習の手がかりが多い）。B: 初期折りたたみ（想起品質が高い）。C: 本文表示後に開く（答え合わせが明確）。 | B または C。Cue だけで想起する時間を確保する。 |
| D-04 | mobile Cornell | A: 現行の局所横 scroll（左右関係を保つが発見性が低い）。B: 375px だけ縦積み（入力完了しやすいが左右関係が弱い）。C: 横 scroll + hint（構造と操作案内の折衷）。 | C を先に試し、実入力が窮屈なら B。 |
| D-05 | 一覧検索の発火 | A: Search / Enter で明示実行（安定）。B: debounce live search（即時だが競合制御が必要）。 | A。現行の Search ボタンを活かす。 |
| D-06 | タグ契約 | 漢字を許可するか、色を保存するか、色形式・大小文字・空白をどう正規化するか。 | 日本語アプリなので漢字を許可し、色は `#RRGGBB` と既定色を共通 schema にする。 |
| D-07 | Phase 2 の Cue ID | A: 現行の全置換を維持し移行時に変換。B: 安定 ID patch / soft delete を先に入れる。 | Phase 2 が近いなら B、遠いなら A と移行方針を文書化する。 |

## 7. 未確認事項と理由

- このレビューでは、制約により `npm install`、`npm run lint`、`npm run build`、Prisma migrate、dev server 起動、API / DB の実行検証をしていない。したがって、既存 handoff の lint / build 成功記録を現 checkout の再検証結果として扱っていない。
- `/notes/[id]` の edit runtime screenshot、NTE-030 の 375 / 768px view / review runtime は、`HANDOFF_2026-07-15.md:168-174` の記載どおり未確認である。
- 375px の長い Markdown、長いタグ、長い field error、Cue 空状態でのページ全体 overflow は未確認である。
- 実スクリーンリーダー、キーボードだけでの全操作、フォーカス順、ブラウザ拡大率、色コントラストの実測はしていない。
- 同時編集 / stale save、API 500 時の詳細画面フォールバック、同一秒のバックアップ二重作成、DB 破損時の復旧手順は実行確認していない。
- `HANDOFF_2026-07-15.md:12-14` と今回の作業前 `git status --short` の記録には、直近 UI 変更のコミット状態に食い違いがある。レビューでは既存の未コミット変更を戻さず、所属 commit を推測していない。

## 8. 推奨する次の順序

1. **仕様を固定する（仕様のみ）**: D-01 を決め、canonical MVP の route / query / HTTP method / deletion / review / markdown / tag 契約を一表にする。`IMPLEMENTATION_STATUS.md` と README の実装済み記述を実態へ合わせる。
2. **P0 の安全性と受け入れ証跡を処理する（仕様 + QA、必要なら実装）**: D-02 を決め、削除方式を固定する。直近 NTE-020 / NTE-030 の確認項目を viewport・state 単位で再確認し、未確認を PASS にしない。
3. **学習体験を直す（実装）**: D-03 のサマリー開示、一覧検索の発火方式、一覧タグ 12 件制限、戻る操作の整理を行う。
4. **アクセシビリティと失敗時 UI を直す（実装）**: 詳細取得失敗のフォールバック、`role` / `aria-live`、field error の `aria-describedby`、visible focus、mobile overflow hint を整える。
5. **データ境界を記録する（仕様、Phase 2 着手時に実装）**: Cue 全置換で ID が変わること、タグ名 / 色の正規化、将来 NoteCard へ移行する方針を決める。
6. **最後に Phase 2 を再評価する**: ドラフト / autosave / 409、soft delete の全エンティティ、NoteCard / D&D、専用復習タスク、PDF、タグ管理 UI の順で、MVP の受け入れが安定してから着手する。

## 9. このレビューで変更したもの

アプリのコード、設定、依存関係、Prisma schema、DB、画面、API、テストシナリオ、画像は変更していない。成果物として本レビュー報告のみを追加した。検証コマンドは読み取り専用のファイル確認と `git status --short` のみ実施し、生成系コマンドは実行していない。
