---
summary_type: task-summary
created_at: 2026-09-07 JST
task_kind: worker-task
task_status: done
---

## Objective

`npm run test:ts` に含まれる accent contrast / Canvas toolbar の CSS 契約FAILを再現し、TS移行起因か既存UI/CSS差分起因かを確定する。

## Scope

- `test/notes/accent-contrast-contract.test.ts`
- `test/notes/canvas-toolbar-responsive-contract.test.ts`
- `test/notes/canvas-toolbar-visibility-contract.test.ts`
- 関連CSS/UI、指定された移行summary、MVP契約・テストシナリオ

## Reproduction

実行コマンド:

```text
node --import tsx/esm --test test/notes/accent-contrast-contract.test.ts test/notes/canvas-toolbar-responsive-contract.test.ts test/notes/canvas-toolbar-visibility-contract.test.ts
```

結果: 15 tests、13 PASS、2 FAIL。

### FAIL-001: accent contrast

- Test: `filled-control states use the AA-safe token without changing semantic states`
- Location: `test/notes/accent-contrast-contract.test.ts:100`
- Assertion: `appShell` must match `.app-chrome-nav-link.is-selected,... background: var(--app-accent-soft); ... color: var(--app-accent-deep);`
- Expected: selected navigation link uses literal `background: var(--app-accent-soft);`.
- Actual: `src/app/styles/app-shell.css` uses `background: var(--app-active);` at the selected-link rule; `--app-active` is an alias to `var(--app-accent-soft)` in `src/app/styles/foundation.css:17`.
- 判定: 実効値は同じだが、source contract が要求する token の直接使用を満たさない。CSS source drift。

### FAIL-002: Canvas toolbar

- Test: `Drawing tools render visible labels and retain accessible names`
- Location: `test/notes/canvas-toolbar-responsive-contract.test.ts:207`
- Assertion: eraser active rule must match `background: rgb(164 72 72 / 13%);`.
- Expected: literal `rgb(164 72 72 / 13%)`.
- Actual: `src/app/styles/note-canvas-toolbar-controls.css:86` uses `background: var(--app-danger-soft);`; current light theme token is `rgb(164 72 72 / 8%)` at `src/app/styles/foundation.css:20`.
- 判定: 実効値が 13% から 8% に変わっており、単なる別表記ではない。CSS契約drift。

`canvas-toolbar-visibility-contract.test.ts` は 5/5 PASS。responsive側の他のテストも PASSしており、toolbar全体の構造・表示契約ではなく消しゴム背景の1契約だけが失敗する。

## Migration causality

旧JSを `git show HEAD:test/notes/...test.js` と比較した結果、対象3本の移行差分は CommonJS require を ESM import に変更したこと、型注釈・安全な絞り込みを追加したことだけ。対象の正規表現、期待値、テスト名、source path は変更されていない。

したがってFAILはTS移行では再現条件も期待値も変わっておらず、移行前から存在した可能性のある既存UI/CSS契約差分である。FAIL-001の直接原因は `37f66fe` のテーマ導入後の `--app-active` alias 化、FAIL-002の直接原因は `37f66fe` で `--app-danger-soft` を導入し、既存の13% literalを8% tokenへ変更したCSSである。なお、`2ce8b86` 以前/以後の app-shell selected rule は literal `--app-accent-soft` のままで、現在の `--app-active` は後続のテーマ変更で入った差分である。

## Contract judgment and follow-up

現行のテスト契約が正しい前提では、UI機能の変更ではなくCSS契約を現行テーマtokenに合わせる後続coding taskが必要。

推奨後続task:

- 目的: CSS source contract と現行token設計を一致させる。
- 対象: `src/app/styles/app-shell.css` の selected navigation rule、`src/app/styles/foundation.css` の `--app-danger-soft` と `src/app/styles/note-canvas-toolbar-controls.css` の eraser active rule、必要なら契約testの期待値。
- 完了条件: 現行MVPの選択状態・Canvas toolbar表示を保ち、light/dark themeの実効色を意図どおり定義したうえで、対象15テストがPASSする。特に8%を13%へ戻すか、契約を8%へ更新するかはアクセシビリティ/デザイン意図を確認して決める。
- 検証: focused 3 files、`npm run test:ts`、`npm run typecheck`、必要に応じてブラウザでlight/dark themeの選択リンクと消しゴムactive状態を確認。

テスト契約を変更する場合は、単なる移行修正ではなく、現行CSS token値を正とする根拠（デザイン/アクセシビリティ判断）を同時に記録する。現時点では test assertion / product source は変更していない。

## Verification

- 作業前 `git status --short`: 既存の未コミット変更を確認。復元・巻き戻しなし。
- focused対象実行: 13 PASS / 2 FAIL（上記FAIL-001/002）。
- 旧JSとの比較: 移行差分は import・型付けのみ。
- `git log` / `git blame`: CSS差分がTS移行以前のコミットに由来することを確認。
- コード・設定・依存関係・生成物: 変更なし。
- 作業後 `git status --short`: summary新規作成以外の対象コード変更なし（共有worktree上の既存変更は保持）。

## Next Read

- `summary/20260907/worker-investigate-css-contract-failures-20260907.md`
- `src/app/styles/foundation.css`
- `src/app/styles/app-shell.css`
- `src/app/styles/note-canvas-toolbar-controls.css`
- `test/notes/accent-contrast-contract.test.ts`
- `test/notes/canvas-toolbar-responsive-contract.test.ts`
