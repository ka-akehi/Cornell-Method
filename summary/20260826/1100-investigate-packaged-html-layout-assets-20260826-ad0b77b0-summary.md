---
summary_type: task-summary
created_at: 2026-08-26 11:00 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-packaged-html-layout-assets-20260826-ad0b77b0.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-packaged-html-layout-assets-20260826-ad0b77b0.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-packaged-html-layout-assets-20260826-ad0b77b0.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-packaged-html-layout-assets-20260826-ad0b77b0.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査結果：最有力原因は、Tauri パッケージ内で `.next/static` のディレクトリ階層が平坦化されていることです。

| 分類 | 判定 |
|---|---|
| リソース欠落・パス不整合 | 確認済み。主因 |
| hydration/runtime failure | JS パス欠落により発生する可能性が高い。実ブラウザでは未確認 |
| 実際の CSS/layout 問題 | 主因を示す証拠なし。実画面は未確認 |
| 古い・別 artifact | 否定。BUILD_ID、HTML、CSS、launcher は現ソースと一致 |

確認内容：

- `.next/server`: source/package とも 140 ファイルで完全一致。`/api/desktop/health` も同梱済み。
- `.next/static`: source は `chunks/`、`css/`、build-id 配下の 37 ファイル。パッケージは `.next/static/` 直下の 30 ファイルへ平坦化。
- `notes.html` は CSS 1件、JS 11件を `/_next/static/chunks/...` / `/_next/static/css/...` と参照するが、パッケージ内の対応パスは全12件不在。
- CSS内容自体は source とパッケージで SHA-256 一致。HTMLには inline `<style>` がなく、CSS 404時の代替もありません。
- `layout.tsx`、`globals.css`、AppChrome、toolbar、close dialog、Settings CSS はビルド成果物へ反映済みで、静的監査上の明白なHTML/CSS構造不良は見つかりませんでした。
- `launcher.cjs`、`next.config.ts`、BUILD_ID も現ソースと一致。署名検証も PASS。
- sidecar 起動は sandbox の `listen EPERM: operation not permitted 127.0.0.1` で停止。隔離 home での `.app` 起動も終了コード 134。実HTTP 404、console、hydration、画面表示は `NOT VERIFIED` です。

変更はありません。開始時・終了時の `git status --short` は一致し、`git diff --check` も PASS です。対象契約テストは 17/17 PASS、lifecycle を含め 26 PASS / 7 SKIP。`npm run lint` は今回対象外の既存 Canvas/backup 等で失敗しました。

必要な次 task：

- 対象：[src-tauri/tauri.conf.json](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/tauri.conf.json:33)、[test/desktop/desktop-node-runtime.test.js](/Users/kazuya/Desktop/自己学習/Cornell-Method/test/desktop/desktop-node-runtime.test.js:134)
- 目的：`../.next/static` を directory mapping に変更し、`runtime/.next/static/chunks`・`css`・build-id の階層を保持する。
- 完了条件：source/package の static 相対パスが一致し、生成HTMLの12参照がすべて解決する。loopback可能な環境で CSS/JS の404なし、hydration完了、console errorなしを確認する。
- `layout.tsx` や CSS のデザイン修正は、この資源配信修正後に実画面で別問題が確認された場合だけ追加します。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/1100-investigate-packaged-html-layout-assets-20260826-ad0b77b0-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/1100-investigate-packaged-html-layout-assets-20260826-ad0b77b0-summary.md`
