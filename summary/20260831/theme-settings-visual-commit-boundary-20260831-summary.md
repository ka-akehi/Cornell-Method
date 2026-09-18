---
summary_type: task-summary
created_at: 2026-08-31 JST
task_kind: inventory
task_status: done
---

# 候補B Theme / settings shell / visual system のコミット境界

## Objective

候補Bのtheme責務、部分stage境界、除外責務、検証期待値を確定する。

## Scope

候補B、既存theme実装summary、関連diffとdesktop settings UI test。バックアップ関連3コミットは対象外。

## Inputs Read

- `summary/20260831/inventory-all-remaining-changes-for-commit-20260831.md`
- `summary/20260829/0440-add-theme-preference-settings-20260829-4c07ff8b-summary.md`
- 候補B対象ファイルのgit diff
- `test/desktop/desktop-settings-ui.test.js`

## 結論

候補Bは `feat: add persistent theme preferences` として、theme preference、dark-mode token、既存UIのtoken置換、Canvasのtheme再描画を対象にできる。ただし、settings modal本体と `desktop-settings-ui.test.js` は別責務が混在しているため、whole-file stageは禁止し、theme関連hunkだけを部分ステージする。

## Theme責務としてstageするファイル

次の新規ファイルは全体をstageする。

- `src/app/_components/theme/theme.ts`
- `src/app/_components/theme/theme-provider.tsx`

次の既存ファイルは、記載したtheme関連部分だけをstageする。

- `src/app/layout.tsx`: `ThemeProvider` / `THEME_INITIALIZER_SCRIPT` のimport、`suppressHydrationWarning`、initializer script、body内Provider。
- `src/app/_components/settings/settings-modal.tsx`: theme import、`general` category、`GeneralPanel`、theme selectと`useTheme`利用。
- `src/app/_components/settings/settings-modal.module.css`: `.themeControl`、selectのfocus、theme tokenへの置換部分だけ。modal backdrop、confirmation portal、overscroll、backup/delete stylingは除外。
- `src/app/styles/foundation.css`: light/dark/systemのcustom property、`data-theme`切替、Tailwind互換classのdark/system override。無関係なvisual/layout変更が同居する場合はそのhunkを除外。
- `src/app/styles/app-shell.css`, `canvas-spike.css`, `desktop-close-dialog.css`, `note-canvas-surface.css`, `note-canvas-toolbar-controls.css`, `note-canvas-toolbar-layout.css`, `note-paper.css`: hard-coded colorを`--app-*` tokenへ置換したdark-mode対応hunkのみ。
- `src/modules/notes/ui/components/canvas/viewer.tsx`, `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`: `useTheme` importとresolved theme変更時のCanvas色再読込・再描画hunkのみ。その他Canvas挙動は候補Cとして除外。

## 除外境界

`settings-modal.tsx` は theme以外に backup文言・backup link削除・削除確認portal/focus trap・update表示・modal shellを含む。これらは候補Bから除外し、backup関連は除外済み3コミットの後続境界、削除確認とshellは別責務として扱う。

`desktop-settings-ui.test.js` は少なくとも次のhunkが混在するため、theme testとgeneral category assertionsだけをstageする。

- theme preference test（storage key、mode normalize、provider、initializer）
- 3カテゴリ化と `settings-theme` selectのassertion

次は除外する。

- backup route/link・backup文言・削除確認文字列とportal/focus trap
- update panelの文言・result kind
- modal description削除、body overflow、panel overscrollなどsettings shell
- app-chrome entrypointの別変更

`settings-modal.module.css` も同様に、`.themeControl` とtheme token化に必要な最小hunk以外は除外する。`desktop-settings-ui.test.js` の全体stageは不可。

## Changes Made

コード、設定、依存関係、Git index、生成物は変更していない。本summaryのみを作成し、worker provenanceへ記録した。

## 最小検証コマンドと期待値

部分stage後にManagerが実行する。

```sh
node --test test/desktop/desktop-settings-ui.test.js
npx tsc --noEmit
npx eslint src/app/_components/theme/theme.ts src/app/_components/theme/theme-provider.tsx src/app/layout.tsx src/app/_components/settings/settings-modal.tsx src/modules/notes/ui/components/canvas/viewer.tsx src/modules/notes/ui/hooks/use-note-canvas-runtime.ts
git diff --cached --check
```

期待値は、theme関連assertionがPASS、typecheckがexit 0、対象TS/TSX lintがexit 0、cached diff checkがexit 0。CSSは現行ESLint設定の対象外でwarningになるため、lint PASSの判定対象に含めない。

## 現状の検証結果・保留理由

- `npx tsc --noEmit`: PASS（exit 0）。
- `node --test test/desktop/desktop-settings-ui.test.js`: FAIL。現状diff全体に含まれる別責務のapp-chrome/settings期待値不一致で失敗しており、theme実装単独の失敗とは判定できない。
- 対象lint: FAIL。`viewer.tsx` と `use-note-canvas-runtime.ts` に既存／候補C相当のReact refs規則違反があり、合計37 problems。CSSは設定対象外warning。

したがって、候補Bは「境界確定済み・コミット可能候補」だが、現状の未分離indexでは完了扱いにしない。Managerはpartial stage後、theme testの該当testだけを再実行し、Canvas hunkを含める場合はrefs lint違反を候補Bの保留事項として明示する。Browser visual verificationとpackaged runtime確認は未実施。

## Findings

- theme新規ファイルとlayout initializerはtheme責務として明確。
- settings modalとdesktop settings testは複数責務が混在し、partial stageが必要。
- Canvas関連差分にはtheme再描画以外の差分とlint違反があり、含める場合は保留を明示する。

## Verification

作業前後の `git status --short` を確認した。typecheckはPASS、focused testと対象lintは上記理由でFAIL。

## Remaining Unknowns

- partial stage後のtheme-only focused test結果は未取得。
- dark modeの実ブラウザ表示とpackaged runtimeは未確認。

### Next Read

1. `summary/20260831/inventory-all-remaining-changes-for-commit-20260831.md`
2. `summary/20260829/0440-add-theme-preference-settings-20260829-4c07ff8b-summary.md`
3. 本summaryの「Theme責務としてstageするファイル」「除外境界」
