# Issue #91 Manager Triage Summary

作成日: 2026-08-03（JST）

## Scope

PR #84 の最新 HEAD `1cbb3f8` に対する Code Review follow-up Issue #91 を確認した。

- Issue #91: collapsed desktop rail のハンドル全体は main 側へ移動できているが、rail region が幅 `0` のため、main の左 padding を超える約 44px のハンドルがページ内容へ重なる。
- ユーザー追加要件: サイドバーを閉じた状態でハンドル幅分の余白を確保し、展開用ボタンには既存の `menu` アイコンを表示する。

## Queue routing

| Issue | Queue | 目的 | 依存 |
| --- | --- | --- | --- |
| #91 | `codex-queue/tasks-ui` | collapsed rail の予約余白と menu icon を追加する | なし |

## Acceptance boundary

- desktop collapsed state で少なくとも rail handle の幅 `2.75rem` 分を content 側に予約し、page header や main の先頭にハンドルが重ならない。
- handle 全体の可視性と 44px の操作領域を維持する。
- collapsed state の toggle icon は `menu`、open state の既存 chevron と mobile responsive behavior は維持する。
- `aria-label`、`aria-expanded`、`aria-controls`、focus-visible、既存の #86 handle placement 契約を壊さない。
- static contract test、lint、TypeScript、可能なら build を実行する。Browser runtime QA は別境界として扱う。

## Next Read

1. `HANDOFF_2026-08-03.md`
2. `summary/20260803/issues-91-triage-20260803.md`
3. `src/app/_components/app-chrome.tsx`
4. `src/app/styles/app-shell.css`
5. `test/notes/app-chrome-contract.test.js`
6. `test/notes/app-chrome-responsive-contract.test.js`
