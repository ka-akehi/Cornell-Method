---
summary_type: task-summary
created_at: 2026-08-25 05:51 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-desktop-runtime-install-repro-20260825-1257ae53.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-desktop-runtime-install-repro-20260825-1257ae53.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-desktop-runtime-install-repro-20260825-1257ae53.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-desktop-runtime-install-repro-20260825-1257ae53.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査結果です。

結論として、今回の直接原因は registry/DNS 障害です。`--legacy-peer-deps` の追加では解決しません。

| 分類 | 判定 | 根拠 |
|---|---|---|
| registry/DNS | 主原因 | 前回 Worker Report は `registry.npmjs.org/postcss` の `ENOTFOUND` |
| npm cache | 二次要因 | `npm view postcss@8.4.31/8.5.15 --offline` も `ENOTCACHED`。cache listing はあるが usable response ではない |
| lockfile/peer | 独立した不整合あり | `next` の override は postcss `8.5.15` だが、lockfile/installed tree は `next` 配下 `8.4.31`。`npm ls postcss` が `invalid` と報告 |
| アプリコード | 根拠なし | `npm run build` は成功し、失敗箇所は runtime の npm install |

確認した主な内容：

- [prepare-desktop-node-runtime.js](/Users/blp542/Desktop/自己学習/Cornell-Method/scripts/prepare-desktop-node-runtime.js:91) は root の `package.json` / `package-lock.json` を `.desktop-runtime` にコピーし、`npm ci --omit=dev --no-audit --no-fund` を実行する。`--legacy-peer-deps` は未指定。
- [package.json](/Users/blp542/Desktop/自己学習/Cornell-Method/package.json:33) の production dependency には `next` が含まれる。
- [package-lock.json](/Users/blp542/Desktop/自己学習/Cornell-Method/package-lock.json:10508) で `next` は `postcss` を必須依存として持つため、`--omit=dev` でも postcss metadata が必要。
- [package.json](/Users/blp542/Desktop/自己学習/Cornell-Method/package.json:117) の `next.postcss=8.5.15` と lockfile の `next/node_modules/postcss=8.4.31` が不一致。
- Playwright は root では devDependency ですが、Next の optional peer と lockfile 内の optional peer 解決により通常実行時は warning が出ました。

Disposable directory での実測：

```text
npm ci --omit=dev --no-audit --no-fund --offline
→ ENOTCACHED: https://registry.npmjs.org/postcss

npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund --offline
→ 同じ ENOTCACHED
```

通常版の peer warning は legacy 版で消えましたが、install 結果は両方とも status 1、`node_modules` 未生成でした。

推奨する次 task は、registry/DNS 復旧後の同じ packaged build retry です。runtime script に `--legacy-peer-deps` を追加する coding task は現時点では不要です。

ただし、postcss の override/lockfile 不整合は別途修正対象です。再試行後に lockfile/peer error が出た場合は、`package-lock.json` を既存 override と再同期する dependency repair task を投入してください。

この task ではリポジトリを変更していません。対象ファイルの status は空で、既存の `HANDOFF` / `summary/` 変更のみ保持されています。調査用 `/private/tmp` directory は削除済みです。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260825/0551-investigate-desktop-runtime-install-repro-20260825-1257ae53-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260825/0551-investigate-desktop-runtime-install-repro-20260825-1257ae53-summary.md`
