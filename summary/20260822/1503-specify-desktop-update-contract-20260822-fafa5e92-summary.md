---
summary_type: task-summary
created_at: 2026-08-22 15:03 JST
task_kind: worker-task
task_status: done
---

## Objective

`specify-desktop-update-contract-20260822-fafa5e92.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/specify-desktop-update-contract-20260822-fafa5e92.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/specify-desktop-update-contract-20260822-fafa5e92.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/specify-desktop-update-contract-20260822-fafa5e92.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

Worker report（read-only）完了。

結論：更新 provider、更新 manifest、package 配置、署名・完全性検証、pending update、staging migration、rollback は製品側に未実装です。現時点で coding task を投入する前に、provider・artifact・検証方式・rollback 方針の承認が必要です。

## 1. 現行契約

| 論点 | 現行契約 |
|---|---|
| 更新確認 | 起動後に非同期確認。自動確認は最大 1 日 1 回、手動確認可。ON/OFF 設定なし |
| 取得・適用 | package は background download。自動適用せず、「再起動して更新」で適用 |
| 失敗時 | 確認・取得・署名・完全性検証・migration に失敗しても現行版と live DB を維持 |
| 未保存内容 | 更新専用に「保存して更新」「保存せず更新」「戻る」。保存失敗時は更新せず dirty 状態を保持 |
| migration | pending migration がある場合だけ safety backup。staging copy に古い順で適用し、検証・reopen 後に atomic switch |
| backup | migration 前 safety backup を含む app 管理 backup は最新 3 世代。通常起動・日次・データ変更時の自動 backup は実装しない |
| privacy | manifest / package 取得に端末 ID、利用状況、ノート本文、Cue、Summary、SQLite、backup、診断 log を含めない。ネットワークは更新だけ |
| MVP 境界 | `/notes`、明示保存、確認付き物理削除、詳細画面内復習、`/backup` を変更しない |

根拠：[POST_MVP_IMPLEMENTATION_PLAN.md](</Users/kazuya/Desktop/自己学習/Cornell-Method/doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md:173>)、[MVP_CONTRACT.md](</Users/kazuya/Desktop/自己学習/Cornell-Method/doc/implementation/MVP_CONTRACT.md:55>)、[TEST_SCENARIOS.md](</Users/kazuya/Desktop/自己学習/Cornell-Method/doc/testing/TEST_SCENARIOS.md:754>)。

## 2. 既存実装・依存関係

| 領域 | 確認結果 |
|---|---|
| Tauri packaging | `app` / `dmg` の bundle 設定のみ。updater endpoint、provider、update artifact 宣言なし |
| Rust dependencies | `tauri`、`serde`、`serde_json`、`libc` 等のみ。updater plugin、HTTP updater、署名検証依存はなし |
| Node dependencies | updater 用 package、provider client、download / signature service はなし |
| lifecycle | `main.rs` は bootstrap → sidecar → primary window 起動のみ。更新 apply / restart hook なし |
| sidecar | `bootstrap` と `serve` のみ。manifest/package/download 処理なし |
| Settings | Updates は準備中表示のみ。`fetch`、Tauri invoke、filesystem 操作なし |
| migration | 初回 DB 作成、integrity/FK/schema/migration checksum 判定、pending migration の検出は存在 |
| migration safety | 既存 DB の pending migration は適用せず停止するが、staging copy、pre-migration backup、atomic switch、rollback は未実装 |
| storage path | `live/`、`backups/`、`settings/`、`logs/`、`pending-restore/` のディレクトリ作成と sidecar への引き渡しのみ |
| tests | migration 状態・既存 DB 非変更・初回 migration failure は確認済み。update provider/package/署名/staging/rollback は未テスト |

根拠：[tauri.conf.json](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/tauri.conf.json:18>)、[Cargo.toml](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/Cargo.toml:12>)、[desktop-storage.js](</Users/kazuya/Desktop/自己学習/Cornell-Method/src/server/infrastructure/desktop-storage.js:8>)、[settings-modal.tsx](</Users/kazuya/Desktop/自己学習/Cornell-Method/src/app/_components/settings/settings-modal.tsx:41>)。

`tools/desktop-poc/**/update-manifest.template.json` は `poc-only` / `future-boundary-only` の空テンプレートであり、製品 provider・schema・署名方式の決定ではありません。

## 3. 選択肢と推奨案

| 論点 | 選択肢 | 推奨 |
|---|---|---|
| provider | 静的 HTTPS + GitHub Releases、静的 object storage/CDN、App Store/platform updater | provider-neutral な静的 manifest interfaceを作り、初期候補は GitHub Releases。独自ドメイン・App Store は前提にしない |
| manifest | 最新版 1 件、全 release の配列、arch/OS 別 endpoint | 全 release の配列。端末内で channel・version・architecture・OS compatibility を絞り、最新 compatible を選ぶ |
| package | DMG を更新にも使用、署名済み `.app` archive、universal artifact | DMG は初期配布専用、更新は architecture 別の署名済み `.app` archive。artifact ID に product/version/OS/arch/format を含める |
| integrity | SHA-256 のみ、provider 固有検証、公開鍵固定の署名＋digest | 公開鍵を app に固定した署名検証と SHA-256 digest の併用。key ID・rotation 方針は承認必須 |
| compatible version | server が 1 件選ぶ、client が manifest 配列から選ぶ、逐次更新 | client 側で選ぶ。少なくとも version/channel/arch/OS を判定し、DB migration 成功を compatible に含めるか別途決定 |
| pending update | `settings/update-state.json`、専用 `updates/`、OS temp/cache | 小さな状態は atomic な `settings/update-state.json`、package は app 管理 staging。temp のみに置かず再起動後も保持 |
| rollback | app bundle の上書き、旧版保持の dual-slot、provider任せ | 旧 app と live DB を保持し、staging migration・reopen・health check 後に切替。失敗時は recovery marker で旧版へ戻す |

manifest の承認前案は次の粒度です。

```text
schemaVersion
product
channel
releases[]:
  version
  architectures
  os compatibility
  artifactId
  package format
  package URL
  size
  sha256
  signature metadata
```

端末 ID、ノート内容、SQLite、backup、診断情報は含めません。release notes 等は最小 schema から外します。

## 4. Manager の承認事項

以下が決まるまで、provider・packaging・署名・apply の coding task は投入しないでください。

1. 初期 provider と配布先。
2. DMG と更新 package の形式。
3. manifest の release 配列、channel、OS compatibility の表現。
4. version 比較規則と downgrade 可否。
5. `compatible` に DB migration 成功を含めるか。
6. 署名アルゴリズム、公開鍵の埋め込み、key rotation。
7. pending package の保存場所、保持期限、削除条件。
8. app bundle と live DB の切替順序、旧版保持期間、起動失敗時の rollback。
9. `settings/update-state.json` の状態・エラー情報の最小 schema。
10. Desktop Alpha で Developer ID/notarization をどこまで要求するか。現行契約では Public Mac Release 側で、Alpha blocker ではありません。

承認前に投入してはいけない範囲は、外部 URL/provider の固定、updater plugin や依存追加、manifest schema の固定、artifact/signing config、persistent pending state、app bundle の置換、live DB の切替、`/backup` の削除・変更です。

## 5. 後続 Worker task

| 順序 | queue | task（1目的） | 主対象 | 先行 | 並列 |
|---|---|---|---|---|---|
| 0 | Common | 更新契約の承認記録 | 正本・task contract | Manager 判断 | 不可 |
| 1 | Common | 更新確認 state（1日1回、手動、失敗再試行、重複通知抑制） | `src-tauri/src/`、shared bridge、desktop tests | 0 | API task と可 |
| 2 | Common | 静的 provider と manifest validation | 新しい updater module、desktop tests | 0,1 | API task と可 |
| 3 | Common | compatible version 選択 | pure selection logic、desktop tests | 2 | API task と可 |
| 4 | Common | package background download と署名・digest検証 | updater/runtime、fixtures | 2,3 | API task と可 |
| 5 | API | staging migration safety | `desktop-storage.js/.d.ts`、sidecar、storage tests | 0,1 | 2〜4 と実装上は可。ただし DB 統合は直列 |
| 6 | Common | 明示再起動、app/DB switch、rollback | `main.rs`、`runtime.rs`、`lifecycle.rs`、Tauri config | 4,5 | 不可 |
| 7 | UI | 未保存更新 dialog | Settings、close/update bridge、UI tests | 1,6 の command contract | 2〜5 と mock 開発可。統合は直列 |
| 8 | UI | Settings Updates panel | `settings-modal.tsx`、entrypoint、UI tests | 1,4,6,7 | 7 と同時編集不可 |
| 9 | Common | packaged update/migration 結合 QA | disposable fixture、Apple Silicon package | 全 task | 不可 |

各 task の完了条件には、対象 focused test、failure injection、`git diff --check`、必要に応じて `cargo test --offline` / `npm run lint` を含めます。static PASS、Rust unit PASS を packaged GUI や browser runtime PASS へ繰り上げません。

## 6. 検証結果・変更ファイル

- 変更ファイル: なし。
- 作業前後の `git status --short`: 既存の未コミット変更・未追跡ファイルを含め同一。
- 実施: `git status --short`、`rg`、`sed`、見出し・依存・対象 source の read-only 確認。
- lint/build/test: read-only 棚卸しのため未実行。
- 既存証跡上、static contract / Rust unit は PASS。ただし dynamic loopback、browser runtime、packaged Apple Silicon GUI は未検証または環境制約で BLOCKED。

新規 summary ファイルや既存ドキュメントは作成・変更していません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260822/1503-specify-desktop-update-contract-20260822-fafa5e92-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260822/1503-specify-desktop-update-contract-20260822-fafa5e92-summary.md`
