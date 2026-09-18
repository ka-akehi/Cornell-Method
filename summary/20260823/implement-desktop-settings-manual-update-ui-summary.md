---
summary_type: task-summary
created_at: 2026-08-23 JST
task_kind: worker-task
task_status: done
---

## Objective

Settings の Updates パネルから、既存の `requestManualUpdateCheck()` bridge だけを使って手動更新確認を実行し、安全な確認中・結果・エラー表示を行う。

## Changes Made

| パス | 変更内容 |
|---|---|
| `src/app/_components/settings/settings-modal.tsx` | Updates パネルを idle 初期状態、manual check button、checking state、bridge result mapping、sanitized available 表示、generic error、unsupported-web fallback へ置換。直接 `invoke` / `fetch` / URL / filesystem は追加していない。 |
| `src/app/_components/settings/settings-modal.module.css` | 既存 Settings の focus、暖色 palette、responsive 方針を継承した manual button / status の最小 style を追加。 |
| `test/desktop/desktop-settings-ui.test.js` | bridge 利用、button / aria 状態、全 result copy、available の表示境界、error copy、禁止された download / install 表示がないことを検証する focused contract test を追加。 |
| `summary/20260823/implement-desktop-settings-manual-update-ui-summary.md` | 本完了要約。 |

## UI State Mapping

- 初期状態は `idle`。Updates panel を開くだけでは check を開始しない。
- click 中は `checking`、button disabled、`aria-busy`、`role="status"` の `確認中…`。
- `no-update`: `利用可能な更新はありません`。
- `available`: `pendingUpdate.version` だけを表示し、`互換 manifest を発見しました。` と `署名検証前 / 未検証です。` を表示。`pendingUpdate` 欠落時は安全な version fallback を使用する。
- `failed`: `更新情報を確認できませんでした。もう一度お試しください。`。
- `suppressed`: `今回は確認を実行しませんでした。`。
- `already-checking`: `別の更新確認が進行中です。`。完了後は button を再操作可能にする。
- `unsupported-web`: `Desktop アプリでのみ利用できます。`。再試行不可として button を disabled にする。
- `command-error` / `state-error`: raw code / exception を表示せず、generic command/state error を `role="alert"` で表示する。

## Accessibility Confirmation

- manual button は `type="button"`、checking 中は `disabled` と `aria-busy` を持つ。
- checking / terminal status は `role="status"`、failed / command / state error は `role="alert"`。
- 既存 dialog focus trap、Escape、category tab keyboard navigation、Settings menu open event のコードは変更していない。
- available の複数行 status は `div` 内に段落を置き、invalid な段落ネストを避けた。

## Verification

| 確認項目 | 結果 |
|---|---|
| `node --test test/desktop/desktop-settings-ui.test.js test/desktop/desktop-settings-bridge.test.js` | PASS: 11 tests |
| `node --test test/desktop/*.test.js` | PASS: 46、SKIP: 1、FAIL: 0。skip は disposable loopback listener 制約。 |
| `node --check test/desktop/desktop-settings-ui.test.js` | PASS |
| focused `npx eslint src/app/_components/settings/settings-modal.tsx test/desktop/desktop-settings-ui.test.js` | PASS |
| `npx tsc --noEmit --pretty false` | 未通過。既存 `src-tauri/target/debug/runtime` の NextConfig / missing type 解決エラー。今回の component 起因エラーはなし。 |
| `npm run lint` | 未通過。既存 React ref / backup の 36 errors、8 warnings。今回の対象ファイルに追加エラーなし。 |
| `npm run build` | webpack compile は成功。既存 `src-tauri/target/debug/runtime/next.config.ts` の `NextConfig` 型解決で停止。 |
| `git diff --check` | PASS。未追跡の対象ファイルは `git diff --no-index --check` でも whitespace error なし。 |
| local browser desktop/mobile visual QA | 未実施。sandbox の listen 制限で `npm run dev` が `EPERM`（`127.0.0.1:3000`）になった。 |
| GitHub / external network | 未実行。 |

## Remaining Unknowns

- packaged macOS WebView での実 `manual_update_check` invoke と、bridge response 待ちの実画面表示は未確認。
- `npm run lint` / `npm run build` の既存 failure は今回の scope 外。

## Next Read

1. `summary/20260823/implement-desktop-settings-manual-update-ui-summary.md`
2. `src/app/_components/settings/settings-modal.tsx`
3. `src/app/_components/settings/settings-modal.module.css`
4. `src/shared/desktop/desktop-settings-bridge.ts`
5. `test/desktop/desktop-settings-ui.test.js`
6. `test/desktop/desktop-settings-bridge.test.js`
