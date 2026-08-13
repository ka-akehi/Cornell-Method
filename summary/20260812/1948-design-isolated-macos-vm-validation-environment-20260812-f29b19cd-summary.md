---
summary_type: task-summary
created_at: 2026-08-12 19:48 JST
task_kind: worker-task
task_status: done
---

## Objective

`design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001623.sst` | task 実行中に作成または更新 | `design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001624.sst` | task 実行中に作成または更新 | `design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001625.sst` | task 実行中に作成または更新 | `design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001626.sst` | task 実行中に作成または更新 | `design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001627.meta` | task 実行中に作成または更新 | `design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001628.meta` | task 実行中に作成または更新 | `design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001629.meta` | task 実行中に作成または更新 | `design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001630.meta` | task 実行中に作成または更新 | `design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/CURRENT` | task 実行中に作成または更新 | `design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/LOG` | task 実行中に作成または更新 | `design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/trace` | task 実行中に作成または更新 | `design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/design-isolated-macos-vm-validation-environment-20260812-f29b19cd.task.md` |
| F-002 | fact | task 実行中に成果物の作成または更新があった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

## 結論

推奨は、Mac App Store 版 UTM（現在 ¥1,500）を Apple Virtualization.framework backend で使い、完全停止した VM の duplicate/export を clean baseline とする方式です。

ただし、現ホストは空き容量が 31 GiB しかないため、VM 作成は現時点で NO-GO です。最低 150 GiB、できれば 200 GiB の空きを確保するか、暗号化 APFS の外付け SSD を用意してから進めます。

## 調査した現状

[HANDOFF_2026-08-12.md](/Users/blp542/Desktop/自己学習/Cornell-Method/HANDOFF_2026-08-12.md)、[MVP_CONTRACT.md](/Users/blp542/Desktop/自己学習/Cornell-Method/doc/implementation/MVP_CONTRACT.md)、[PRODUCT_SPEC.md](/Users/blp542/Desktop/自己学習/Cornell-Method/doc/requirements/PRODUCT_SPEC.md)、[TARGET_ARCHITECTURE.md](/Users/blp542/Desktop/自己学習/Cornell-Method/doc/technical/TARGET_ARCHITECTURE.md)、[TEST_SCENARIOS.md](/Users/blp542/Desktop/自己学習/Cornell-Method/doc/testing/TEST_SCENARIOS.md)などを確認しました。

引き継ぎより後の[比較 summary](/Users/blp542/Desktop/自己学習/Cornell-Method/summary/20260812/1342-compare-electron-tauri-poc-evidence-20260812-534d51a5-summary.md)まで含めると、Electron / Tauri PoC のソースは存在しますが、GUI、cold start、メモリ、`.app` / DMG、single instance、process cleanup は未測定または BLOCKED で、shell は未選定です。

## 候補比較

| 方式 | 費用・条件 | rollback | 判断 |
|---|---|---|---|
| Virtualization.framework を直接利用 | API と macOS restore image は追加費用なし。専用 Swift frontend、entitlement、VM 管理処理の実装が必要 | save/restore state はあるが、管理可能な disk snapshot/clone 処理は自前 | 第一者技術だが準備工数が大きい |
| UTM / Apple backend | GitHub 安定版は ¥0、[Mac App Store 版は現在 ¥1,500](https://apps.apple.com/jp/app/utm-virtual-machines/id1538878817)。Apple Silicon・macOS 12+ | 公式資料で duplicate/export を確認。save state は clean rollback の代用にならない | 推奨 |
| Parallels Desktop | 通常価格は Standard $99.99/年または $219.99買切り、Pro $119.99/年。為替・税・割引は購入時再確認 | v20 以降は snapshot 対応 | 操作性と snapshot を優先する場合の有料 fallback |
| VMware Fusion | 商用・教育・個人とも無料 | 機能はあるが、Apple Silicon 上の Arm macOS guest は公式に非対応 | 対象外 |

Apple は Apple Silicon 上の macOS VM と IPSW restore image の利用方法を公式提供しています。[Apple のサンプル](https://developer.apple.com/documentation/virtualization/running-macos-in-a-virtual-machine-on-apple-silicon)、[macOS VM インストール資料](https://developer.apple.com/documentation/virtualization/installing-macos-on-a-virtual-machine)を確認しました。

UTM は Apple Silicon・macOS 12+ で macOS guest に対応し、第三者サイトの IPSW の安全性を保証せず、UTM による最新 compatible IPSW の自動取得を推奨しています。[UTM macOS guest 資料](https://docs.getutm.app/guest-support/macos/)

UTM の Apple backend には、公式資料上、Parallels のような snapshot tree はありません。完全停止後の duplicate/export を rollback 点として使います。[UTM scripting reference](https://docs.getutm.app/scripting/reference/)

Parallels は v18 以降で macOS 12+ guest、v20 以降で snapshot に対応します。一方、共有 Home folder、clipboard、USB、NAT 等は隔離上の注意点です。[macOS VM 導入条件](https://kb.parallels.com/eu/125561/)、[制限事項](https://kb.parallels.com/en/128867)、[価格](https://www.parallels.com/jp/products/desktop/buy/)

VMware Fusion は現在も無料ですが、Broadcom は Arm macOS guest を非対応と明記しています。[Broadcom KB 315602](https://knowledge.broadcom.com/external/article?legacyId=90364)

macOS Tahoe SLA は、所有・管理する Apple 製 Mac 上で、開発・テスト・個人利用等を目的とした追加の仮想 macOS instance を最大2つまで認めています。実際に入れるバージョンの SLA をセットアップ時に再確認します。[macOS Tahoe SLA](https://www.apple.com/legal/sla/docs/macOSTahoe.pdf)

## 推奨構成と概算費用

確認したホストは Apple M1 Pro、8 cores、16 GB RAM、macOS 26.0.1 arm64、空き 31 GiB です。

推奨初期値は以下です。

- 同時起動は1 VMのみ
- 4 vCPU、6 GB RAM
- guest disk は 100～128 GB の sparse image
- host 空き容量は最低 150 GiB、推奨 200 GiB
- Electron / Tauri は同じ baseline から作った別 clone で順番に測定
- host memory pressure や swap が増えた回は測定無効

費用は、内部ストレージを整理できれば UTM の ¥1,500 のみです。外付け 1 TB SSD を用意する場合は、現行メーカー価格例から約2万～3.5万円を予算枠とし、購入時に再確認します。[I-O DATA 1 TB価格例](https://www.iodata.jp/product/hdd/ssd/sspg-uscb/index.htm/)

外付け SSD は暗号化 APFS とし、両候補を同じドライブで測定します。外付けドライブ上の cold start 値は実機内蔵 SSD の絶対値として扱いません。

Apple Developer Program の $99/年は VM PoC / Alpha のローカル検証には不要です。Developer ID、署名、公証、外部配布を始める段階の別予算です。[Apple Developer Program](https://developer.apple.com/help/account/membership/program-enrollment/)

## 安全な準備手順

1. ホスト確認  
   空き容量、FileVault、Firewall、macOS build、UTM version/sourceを記録します。専用の標準ユーザーを作り、UTM に Full Disk Access や個人 Home への権限を与えません。

2. guest 初期化  
   UTM の Apple Virtualization backend と自動取得される Apple IPSW だけを使います。Migration Assistant、Apple Account、iCloud、Keychain同期、個人メール、ブラウザ同期は使いません。

3. 共有範囲  
   Home共有、clipboard、guest tools、drag-and-drop、USB、remote server は無効にします。個人 SSH key、npm token、Developer ID秘密鍵、実用 `.env`、本番DBは持ち込みません。

4. network  
   bridged network と port forwarding は使わず、OS・承認済み toolchain・依存取得時だけ shared/NAT を有効化します。UTM の shared network は host/guest のサービスが相互に見えるため、完全なネットワーク隔離ではありません。取得終了後は network device を無効化します。[UTM network仕様](https://docs.getutm.app/settings-apple/devices/network/)

5. baseline と rollback  
   更新済み OS だけの `B0`、承認済み toolchain まで入れた `B1` を、通常 shutdown 後に duplicate/export します。作業は必ず clone 上で行います。suspend/save state は rollback とみなしません。汚染時は network を切り、作業 clone を破棄して B1 から再作成します。

6. リポジトリ受け渡し  
   現在の worktree には未コミットの PoC があるため、単純な `git archive HEAD` は使えません。レビュー済み allowlist で bundle を作り、`.git`、`.env*`、`node_modules`、`.next`、DB、log、cache、credential を除外します。host と guest の双方で SHA-256 を確認し、read-only staging を unmount してから実行します。生成物は空の outbox 経由で戻し、再度 checksum を確認します。guest 生成 `.app` / DMG は host で起動しません。

7. 廃棄  
   作業 clone だけを削除し、B0/B1 は shell 選定完了まで保持します。削除前に対象 VM bundle/export を列挙し、発注者承認後に実施します。snapshot rollback や VM 削除で、既に外部送信された秘密情報は回収できないため、最初から秘密を入れないことが重要です。

## VMで検証できること・できないこと

VMで有効な検証は、Electron Chromium / Tauri WKWebView の起動とGUI操作、single instance、primary window、local runtime、process cleanup、SQLite保存・再起動後読戻し、arm64 `.app` / DMG の生成・mount・起動です。guest 内で同一条件にそろえれば、cold start と app-owned process RSS の相対比較にも使えます。

一方、以下はこの調査や VM 測定だけでは確定できません。

- 実機の絶対 cold start、メモリ圧迫、swap、thermal、battery
- host から見た UTM 全体のメモリと、アプリ単体メモリの対応
- GPU / Metal、描画遅延、外部display、trackpad、camera、USB
- sleep/wake、logout、Mac再起動時の lifecycle
- 別の物理 Mac にダウンロードした際の Gatekeeper / quarantine
- Developer ID署名、公証、DMG外部配布
- VM escape や、network有効中の supply-chain package による外部送信

したがって、VM は機能・隔離・相対比較の主環境にできますが、正本文書が求める「同一 Apple Silicon Mac / current macOS」の最終値には、選定候補だけを対象にした限定的な host-native 確認を残すのが推奨です。これを省略する場合は、測定契約を「VM内相対値」に変更する必要があります。

## Docker の境界

今回の推奨フローでは Docker を使いません。Docker Desktop for Mac は Linux VM 内で Docker Engine を動かすため、macOS `.app` / DMG、WKWebView / AppKit、Mac process lifecycle、native memory の受け入れ根拠にはなりません。[Docker VMM](https://docs.docker.com/desktop/features/vmm/)、[Docker Desktop networking](https://docs.docker.com/desktop/features/networking/)

後で別途承認するなら、Linux互換の lint、unit test、純粋な Node/SQLite 処理、SBOM・lockfile解析までです。macOS guest 内での nested Docker、host repository の全面 bind mount、Docker結果による Desktop acceptance は対象外です。

## 次のタスク

最初に投入すべき Worker task は VM作成ではなく、`vm-host-preflight` です。

| Task | 依存 | 対象・完了条件・検証 |
|---|---|---|
| T1 `vm-host-preflight` | 発注者承認、保存先確定 | 150 GiB以上の空き、FileVault/Firewall、UTM購入画面・version、IPSW互換性、host/guest OS build方針を確認。インストールしない |
| T2 `install-utm-create-b0` | T1 GO | 専用ユーザー、UTM、1台のmacOS VMを作成。共有・clipboard・Apple Accountなし、更新後network off、完全停止したB0 exportとhashを確認 |
| T3 `create-toolchain-b1` | T2 | 承認済みNode/npm/Rust/CLTだけを導入。version/source/checksumを記録し、network offでversion確認後B1を保存 |
| T4 `resolve-and-review-dependency-locks` | T3 | acquisition cloneでinstall scriptを抑止して依存を解決。Electron package-lock と Tauri Cargo.lock を生成・監査し、承認後のみリポジトリへ反映 |
| T5 `transfer-poc-bundle` | T4 | allowlist bundleとfixtureをSHA-256付きで転送。guest一致、read-only shareへの書込み失敗、unmountを確認 |
| T6 `measure-electron-in-vm` | T5 | GUI、操作、single instance、cleanup、SQLite、cold start、RSS、`.app` / DMGを測定 |
| T7 `measure-tauri-in-vm` | T6 | 同じB1・resource・fixture・測定方法でTauriを測定 |
| T8 `compare-vm-evidence` | T6/T7 | VM相対値として比較。不成立項目をBLOCKEDのまま保持し、shell選定可否を判断 |
| T9 `native-host-confirmation` | T8、別承認 | 選定候補の既知artifactだけをhostで限定確認。依存関係はhostへ追加しない |
| T10 `signing-notarization` | Public Release判断 | Developer Program、鍵管理、署名、公証、別Mac相当の配布確認。Alphaとは分離 |

現在、Electron 側に package-lock がなく、Tauri 側にも Cargo.lock がありません。直接依存の版指定だけでは推移依存を再現・監査できないため、T4 は測定前の必須 task です。

## 発注者に承認してほしい事項

- UTM Mac App Store版 ¥1,500 を採用する
- 内部空き容量を最低150 GiBまで確保するか、暗号化APFSの外付けSSDを購入する
- 1 VM、4 vCPU、6 GB RAM、100～128 GB diskで開始する
- 専用hostユーザー、Apple Accountなし、共有・clipboard・credentialなしを受け入れる
- 一時的なshared/NAT通信を許可し、取得後はnetworkを切る
- VMを相対・機能検証に使い、最終候補のみhost-native確認する
- guest IPSW と host build が異なる場合、host更新は別途承認とする

## 変更・検証結果

変更ファイルはありません。作業前後の `git status --short` は同一で、既存の変更・未追跡ファイルを保持しています。

実行した確認は `git status --short`、`sw_vers`、`uname -m`、hardware/resource確認、`df -h /`、lockfile有無とmanifestのread-only確認です。UTM、OS image、npm package、Rust crate、Dockerのインストール・起動・ダウンロードは行っていません。

VM boot、rollback復元、network隔離、GUI、メモリ、署名、公証は制約どおり未検証です。`npm run lint` / `build` は調査専用taskのため実行対象外です。Worker progress は 25 / 60 / 85 / 100% を報告済みです。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260812/1948-design-isolated-macos-vm-validation-environment-20260812-f29b19cd-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260812/1948-design-isolated-macos-vm-validation-environment-20260812-f29b19cd-summary.md`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001623.sst`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001624.sst`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001625.sst`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001626.sst`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001627.meta`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001628.meta`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001629.meta`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001630.meta`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/CURRENT`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/LOG`
- `.next-fixture-iadpvK/dev/trace`
