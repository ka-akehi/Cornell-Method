# PR #84 保守性・ファイル境界の Manager 確認

## Scope

- 対象: `develop...HEAD`（PR #84、UI 改善差分）
- 変更ファイル: 37 files
- この確認ではコード・設定・依存関係・生成物を変更していない。
- Worker の同内容レビュー再実行は 25% で長時間停止しているため、以下は Manager が実装タスク化に必要な最小範囲を確認した結果。

## 直ちに実装する候補

### 1. AppChrome の表示部品と状態管理を分離

- 対象: `src/app/_components/app-chrome.tsx`（453 行）、AppChrome の契約テスト。
- 根拠: レール状態、モバイルの focus trap/body scroll、ルート判定、アイコン、ブランド、ナビゲーション、create link が 1 ファイルに同居している。
- 境界案: `app-chrome.tsx` は state/effect と shell の composition に限定し、ブランド・アイコン・ナビゲーション・create link を専用部品へ移す。DOM、ARIA、focus 復帰、responsive breakpoint は変更しない。
- 削除候補: `mobileOverlayRef` は JSX の `ref` に設定されるだけで、読み取り・focus 制御・イベント処理に使われていない。削除する場合は static contract test の期待値も更新する。
- 検証: AppChrome 関連 contract tests、lint、typecheck、build。実ブラウザでの focus/overlay 確認は既存の Browser unavailable リスクとして別途扱う。

### 2. Canvas toolbar の action / tooltip 境界を分離

- 対象: `src/modules/notes/ui/components/canvas/toolbar-actions.tsx`（324 行）、関連 contract tests。
- 根拠: tool button/group、floating tooltip の portal・位置計算、undo/redo action が同居している。各責務は独立した props/テスト境界を持つ。
- 境界案: tool group/button、floating tooltip、history actions を専用ファイルへ分け、`toolbar.tsx` の公開 import 契約と aria/tooltip 挙動を維持する。
- 検証: Canvas toolbar/scroll contract tests、lint、typecheck、build。Canvas の実 interaction は Browser QA が blocked だったため、静的検証と既存 QA リスクを分けて報告する。

### 3. Canvas toolbar CSS を責務別に分割

- 対象: `src/app/styles/note-canvas-toolbar.css`（620 行）、`src/app/globals.css`、CSS contract tests。
- 根拠: toolbar grid/group/paper-size layout、button/control/tooltip、responsive media query が 1 ファイルに集中している。
- 境界案: layout、controls/tooltip、responsive rules の 3 ファイル程度に分け、`globals.css` の import 順を固定する。クラス名、cascade、breakpoint は変更しない。
- 検証: toolbar visibility/responsive contract tests、lint、typecheck、build。CSS の static test は分割後の対象ファイルを明示的に読むよう更新する。

## 追加確認が必要な候補

- `app-shell.css`（441 行）は AppChrome と `.app-main`/`.note-paper-page` の page layout が同居する。AppChrome task で navigation CSS と page layout CSS の境界を確認し、過分割にならない場合だけ分ける。
- `/backup` は route/API が存在する一方、AppChrome の nav には含めない現行 contract になっている。削除ではなくプロダクト判断事項として扱い、今回の cleanup で変更しない。

## 変更しない候補

- `src/modules/notes/ui/components/canvas/editor.tsx`（360 行）: editor orchestration と Canvas runtime の契約がまとまっており、行数だけでは分割根拠にならない。
- `src/app/styles/note-paper.css`（499 行）: Cornell paper layout と responsive scroll の一貫した責務で、既存 static contract の参照も多い。
- `src/modules/notes/ui/components/list/list.tsx`（297 行）と 300 行未満の contract tests: 現時点で独立した責務境界または不要コードの根拠がない。
- 旧 state badge、旧 rail toggle slot、`desktopRailToggle` などは参照がなく、PR 差分にも残存していないため追加削除しない。

## Next Read

- `src/app/_components/app-chrome.tsx`
- `src/app/styles/app-shell.css`
- `src/modules/notes/ui/components/canvas/toolbar-actions.tsx`
- `src/app/styles/note-canvas-toolbar.css`
- AppChrome / Canvas toolbar contract tests

