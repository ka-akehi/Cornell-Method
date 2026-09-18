---
summary_type: task-summary
created_at: 2026-08-26 10:57 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-packaged-native-close-button-not-closing-20260826-f6c8babc.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-packaged-native-close-button-not-closing-20260826-f6c8babc.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-packaged-native-close-button-not-closing-20260826-f6c8babc.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-packaged-native-close-button-not-closing-20260826-f6c8babc.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査結果は `NOT VERIFIED` です。実パッケージは起動前に終了し、赤い閉じるボタン操作まで到達しませんでした。

### 確認できた事実

- `.app` は存在し、arm64・ad-hoc signed。
- 同梱 `launcher.cjs` はソースと hash 一致。
- 分離ホーム `/private/tmp/cornell-close-qa-20260826.oBaTcq` で直接起動を一度だけ実行。
- 終了コードは `1`、ウィンドウ・close dialog・sidecar は未生成。
- instance owner は PID `38865` を記録したが、終了後 `kill -0` は `no such process`。
- `live/`、SQLite、focus socket は生成されていない。
- stderr/stdout は空。sandbox のため macOS unified log は取得不可。

したがって、少なくとも instance 確保後、Tauri setup 完了・sidecar 起動・window 作成前後で停止したと推測できます。CloseRequested の停止地点は未確認です。

### 現在の終了経路

1. Native `CloseRequested` で `prevent_close()` 後、[`request_close()`]( /Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/main.rs:370)。
2. Bridge ready 済みなら Web 側へ close event を dispatch。未 ready なら最大120秒待機します（[`request_close()`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/lifecycle.rs:717)）。
3. Web coordinator は listener 登録後に ready hash を送信（[`desktop-close-coordinator.tsx`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/app/_components/desktop-close-coordinator.tsx:37)）。
4. clean は即時、dirty は保存・破棄・キャンセルを hash navigation で返します（[`desktop-close-bridge.ts`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/shared/desktop/desktop-close-bridge.ts:161)）。
5. 決定後は `finalize_close()` → sidecar cleanup → exit 許可 → window destroy → `app.exit(0)`（[`lifecycle.rs`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/lifecycle.rs:697)）。
6. `RunEvent::Exit` でも冪等な sidecar cleanup を行います（[`main.rs`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/main.rs:392)）。

### 最有力候補

実機でウィンドウまで起動できた場合は、次のどちらかを最初に計測すべきです。

- Bridge ready が届かず、`request_close()` が event dispatch できない。
- `finalize_close()` の `cleanup_sidecar()` が失敗し、安全策としてアプリを開いたままにしている。失敗条件は [`SidecarHandle::stop()`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/runtime.rs:2025) の process group 終了待ちです。

現時点では、これらを原因と断定する根拠はありません。

### 次の最小 task

まずはコード修正ではなく、GUI・LaunchServices・loopback が利用可能な環境で同じ `.app` を起動し、次の地点を記録する QA task が必要です。

`CloseRequested → bridge ready → Web close event → decision hash → finalize_close → cleanup_sidecar の結果 → RunEvent::Exit`

最初に失敗した地点が確定してから、その地点だけを修正対象にした coding task を投入するのが最小です。

### 検証と変更

- `node --test test/desktop/desktop-close-bridge.test.js test/desktop/desktop-lifecycle.test.js`
  - `17 PASS / 7 SKIP / 0 FAIL`
  - skip は loopback listener 制約。
- 作業前後の `git status --short` は同一。
- ソース、設定、依存関係、生成物の変更はありません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/1057-investigate-packaged-native-close-button-not-closing-20260826-f6c8babc-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/1057-investigate-packaged-native-close-button-not-closing-20260826-f6c8babc-summary.md`
