# 現行仕様・デザインレビュー対応タスクリスト

作成日: 2026-07-16
状態: open
種別: 一時タスクリスト

レビュー報告: [第三者レビュー](../20260715/current-spec-design-review.md)

このファイルは、レビュー結果を実作業へつなげる期間だけ使用する。全タスクの完了、受け入れ確認、引き継ぎ更新が終わったら、このファイル自体を削除する。

## 運用ルール

- D-01〜D-05 の仕様判断が終わるまで、実装 Worker task は投入しない。
- Worker task は 1 task 1 目的とし、仕様 task と coding task を同居させない。
- 仕様・調査 task はコード、設定、依存関係、DB、UI、API、テスト、画像を変更しない。
- 各 task の完了時に summary を確認し、次の依存 task の着手条件を満たしたか確認する。
- 未確認項目を推測で PASS にしない。

## Phase 0: 発注者の仕様判断

### D-01 現行 MVP の範囲を確定

- 状態: [x] 2026-07-16 決定済み
- 判断: 現在の画面設計を MVP 正本とし、`AGENTS.md` の高度機能を Phase 2 へ分離するか
- 決定: 明示保存、1 本文、Cue リスト、手動復習日、詳細画面内復習、一覧検索、バックアップを MVP とする。自動保存、Undo、専用復習タスク、NoteCard / D&D、PDF、タグ管理 UI などは Phase 2 とする。`AGENTS.md` は製品全体のロードマップ、別途固定する MVP 契約を現行正本として扱う
- 完了条件: MVP と Phase 2 の境界が決まっている。canonical route、API、保存方式、削除方式、復習方式は後続の仕様 task で固定する

### D-02 削除・復元方式を確定

- 状態: [x] 2026-07-16 決定済み
- 選択肢: 物理削除を維持 / ノート単位の soft delete + 5 秒 Undo / 全カードまで Undo
- 決定: MVP は確認付きの物理削除を維持する。soft delete + 5 秒 Undo は Phase 2 とし、カード単位の復元はさらに後回し
- 完了条件: 誤削除時の復元可否、期限、子要素の扱い、UI 表示が決まっている

### D-03 復習モデルを確定

- 状態: [x] 2026-07-16 決定済み
- 選択肢: 手動の次回復習日 / 自動 1 日後・1 週間後タスク
- 決定: MVP は手動の次回復習日 + 詳細画面内復習とする。新規ノートでは `nextReviewDate` に `noteDate + 7日` を初期設定し、ユーザーは変更・空欄化できる。既存ノートの未設定値は自動補完せず、`noteDate` の変更で手動設定済みの日付を自動変更しない。専用タスク画面、1 日後 / 1 週間後の自動タスク、未完了バッジは Phase 2 とする
- 完了条件: 日付の基準、期限超過、完了後、次回日未設定時の扱いが決まっている

### D-04 Summary の Preview 方針を確定

- 状態: [x] 2026-07-16 決定済み
- 選択肢: 常時表示 / 折りたたみ・簡易表示 / 編集時は非表示
- 決定: 編集時は Summary Preview を折りたたみまたは簡易表示にする。閲覧時は Markdown をレンダリングして表示し、復習時は Summary を初期非表示にして想起後に開く
- 完了条件: 編集時 Preview と復習時 Summary の初期表示を別々に定義する

### D-05 モバイル Cornell 方針を確定

- 状態: [x] 2026-07-16 決定済み
- 選択肢: 現行横スクロール / 横スクロール + 操作案内 / 375px のみ縦積み
- 決定: デスクトップを主対象とし、768px 未満の本格的な編集最適化は行わない。現行の Cornell 横スクロールは当面維持し、モバイルではページ全体を壊さないことだけを最低限確認する。モバイル専用の縦積みや操作案内は Phase 2 以降に再評価する
- 完了条件: デスクトップの Cue / 本文 / Preview 配置を優先し、モバイルの対応範囲を「最低限の表示・操作確認」として明記する

## Phase 1: 仕様・記録の整合

### SPEC-001 現行 MVP 契約を一つに固定

- 状態: [x] 2026-07-16 完了
- 優先度: P0
- キュー: `codex-queue/tasks`
- 依存: D-01〜D-05
- 対象: `AGENTS.md`, `doc/screens/`, `doc/testing/`, `README.md`
- 完了条件: route、HTTP method、query 名、保存、削除、復習、Markdown、タグ上限、Phase 2 境界が一表で一致する

### SPEC-002 復習仕様を設計書へ反映

- 状態: [x] 2026-07-16 完了
- 優先度: P0
- キュー: `codex-queue/tasks`
- 依存: D-03
- 対象: `AGENTS.md`, `doc/screens/MVP_SCREEN_DESIGN.md`, `doc/screens/MVP_SCREEN_INVENTORY.md`, `doc/testing/TEST_SCENARIOS.md`
- 完了条件: 手動復習または自動タスクの仕様が重複なく記載される

### SPEC-003 削除・復元仕様を設計書へ反映

- 状態: [x] 2026-07-16 完了（リトライ）
- 優先度: P0
- キュー: `codex-queue/tasks`
- 依存: D-02
- 対象: `AGENTS.md`, `doc/screens/MVP_SCREEN_DESIGN.md`, `doc/screens/MVP_SCREEN_INVENTORY.md`, `README.md`
- 完了条件: 実際に提供する復元保証だけが記載される

### DOC-001 実装状況サマリを実態へ修正

- 状態: [x] 2026-07-16 完了（リトライ）
- 優先度: P0
- キュー: `codex-queue/tasks`
- 依存: SPEC-001〜003
- 対象: `doc/implementation/IMPLEMENTATION_STATUS.md`
- 完了条件: 実装済み、部分実装、未実装、仕様のみが route / schema / UI / test evidence 付きで分類される

### QA-001 受け入れ証跡を再整理

- 状態: [x] 2026-07-16 完了
- 優先度: P0
- キュー: `codex-queue/tasks`
- 依存: SPEC-001
- 対象: `doc/testing/TEST_SCENARIOS.md`, `README.md`, 関連 summary
- 完了条件: viewport、画面状態、確認日、fixture、参照 summary を持つ PASS / FAIL / 未実施表になる

## Phase 2: P1 実装改善

以下は Phase 1 の仕様確定後、互いに独立するものから並行投入できる。

### UI-001 復習時 Summary の初期開示を制御

- 優先度: P1
- キュー: `codex-queue/tasks-ui`
- 依存: D-03, D-04, SPEC-002
- 完了条件: Cue → 想起 → Summary / 本文確認の順序が UI とテスト観点で一致する

### UI-002 編集時 Summary Preview を整理

- 優先度: P1
- キュー: `codex-queue/tasks-ui`
- 依存: D-04
- 完了条件: Markdown 表示確認を維持しつつ、空 Preview と縦方向の占有を抑える

### UI-003 モバイル Cornell の操作発見性を改善

- 優先度: P1
- キュー: `codex-queue/tasks-ui`
- 依存: D-05
- 完了条件: 375px / 768px で Cue、本文、Preview の存在と操作方法が分かり、入力完了できる

### UI-004 一覧検索の発火方式を統一

- 優先度: P1
- キュー: `codex-queue/tasks-ui`
- 依存: SPEC-001
- 完了条件: 検索ボタン / Enter の明示実行、または debounce 検索のどちらか一つに統一される

### UI-005 一覧タグフィルタの上限を適用

- 優先度: P1
- キュー: `codex-queue/tasks-ui`
- 依存: SPEC-001
- 完了条件: 一覧でも最大 12 件、重複除去、上限到達時の説明が機能する

### UI-006 戻る導線と未保存キャンセルを整理

- 優先度: P1
- キュー: `codex-queue/tasks-ui`
- 依存: SPEC-001
- 完了条件: モードごとの主導線が一つになり、編集内容の破棄を確認できる

### UI-007 エラー・アクセシビリティ状態を補強

- 優先度: P1
- キュー: `codex-queue/tasks-ui`
- 依存: QA-001
- 完了条件: 詳細取得失敗、`aria-live`、`aria-describedby`、visible focus、入力エラーの読み上げを確認できる

### API-001 バックアップ名の衝突を防止

- 優先度: P1
- キュー: `codex-queue/tasks-api`
- 依存: SPEC-001
- 完了条件: 同一秒の連続作成でも上書きされず、世代整理と同時実行テストが通る

### API-002 ノート単位 Undo を実装（D-02 で採用した場合）

- 優先度: P2 / Phase 2
- キュー: `codex-queue/tasks-api`
- 依存: D-02, SPEC-003
- 完了条件: `deletedAt`、Undo buffer、復元 API、期限切れ処理が仕様と一致する

### UI-008 ノート削除 Undo UI を実装（D-02 で採用した場合）

- 優先度: P2 / Phase 2
- キュー: `codex-queue/tasks-ui`
- 依存: API-002
- 完了条件: 確認、5 秒 Snackbar、復元、期限切れ表示を確認できる

## Phase 3: 将来境界・低優先度

### COMMON-001 Cue の将来 ID 方針を記録

- 優先度: P1
- キュー: `codex-queue/tasks`
- 依存: SPEC-001
- 完了条件: 現行の全置換更新で ID が変わることと、NoteCard 移行時の方針が明文化される

### COMMON-002 依存関係・README・design token を整理

- 優先度: P2
- キュー: `codex-queue/tasks`
- 依存: DOC-001
- 完了条件: 未使用依存、個人環境の絶対パス、直接色指定、状態別ワイヤフレームの残課題が整理される

### PHASE2-001 高度機能を再評価

- 優先度: P2
- キュー: `codex-queue/tasks`
- 依存: QA-001
- 対象: ドラフト / autosave / 409、専用復習タスク、NoteCard / D&D、PDF、タグ管理 UI
- 完了条件: MVP の受け入れ後に、実際の利用課題に基づく順序と着手条件が決まる

## 完了・削除条件

- [ ] D-01〜D-05 の判断が記録されている
- [ ] Phase 1 の仕様・記録 task が完了している
- [ ] 採用した Phase 2 実装と QA が完了している
- [ ] 未確認項目が残っていない、または明示的に次期課題へ移されている
- [x] 最新 handoff に次の開始地点が反映されている
- [ ] この一時タスクリストを削除する
