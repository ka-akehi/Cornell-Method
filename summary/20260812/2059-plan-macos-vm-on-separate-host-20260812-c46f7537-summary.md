---
summary_type: task-summary
created_at: 2026-08-12 20:59 JST
task_kind: worker-task
task_status: done
---

## Objective

`plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001653.sst` | task 実行中に作成または更新 | `plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001654.sst` | task 実行中に作成または更新 | `plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001655.sst` | task 実行中に作成または更新 | `plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001656.sst` | task 実行中に作成または更新 | `plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001657.meta` | task 実行中に作成または更新 | `plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001658.meta` | task 実行中に作成または更新 | `plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001659.meta` | task 実行中に作成または更新 | `plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001660.meta` | task 実行中に作成または更新 | `plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/CURRENT` | task 実行中に作成または更新 | `plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/LOG` | task 実行中に作成または更新 | `plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` の実行結果 |
| `.next-fixture-iadpvK/dev/trace` | task 実行中に作成または更新 | `plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/plan-macos-vm-on-separate-host-20260812-c46f7537.task.md` |
| F-002 | fact | task 実行中に成果物の作成または更新があった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

実行計画を確定しました。実環境の作成、インストール、ダウンロード、ネットワーク変更、VM操作、リポジトリ変更は行っていません。

結論は、UTM + Apple Virtualization backendを第一候補にし、別ホストの事前確認後に採否を決める、です。UTMが要件を満たさない場合だけParallelsを再評価し、仮想化方式を変えた場合はElectron/Tauriを同じ方式で両方測り直します。

## 実施前の二つのゲート

VM作成前のGO条件：

- 別Apple Silicon Macの所有・管理権限とMDM制約が確認済み
- RAM 16 GiB以上。24 GiB推奨
- 選定保存先に150 GiB以上、推奨200 GiB以上の空き
- FileVault有効。外付けなら暗号化APFS
- 正確なホストOS、ゲストOS、UTM配布元・版が決定済み
- macOSライセンス上のVM保有数を確認済み
- 購入、ホスト設定変更、アプリ導入、ネットワーク利用、VM作成を個別承認済み

測定開始前のGO条件：

- B1が完全停止状態でハッシュ確認済み
- Electronのpackage-lock.jsonとTauriのCargo.lockが別のcoding taskで生成・レビュー済み
- リポジトリ、fixture、lockfileのSHA-256が発注者承認済みmanifestと一致
- Apple Account、秘密鍵、token、.env、本番DBが存在しない
- ネットワーク、共有、clipboard、USB連携が無効
- 測定条件と試行回数が固定され、B1から作った未使用cloneである

現在のMacの31/60 GiBという空き容量問題は判定条件から外します。現在のMac上のDockerデータ、壁紙、npm cacheなどには一切触れません。

## 明示承認の区分

以下は包括承認にまとめず、対象と操作を明記して別々に承認します。

| 区分 | 承認対象 |
|---|---|
| A1 | 使用する物理ホストの決定、または別ホストへの変更 |
| A2 | UTM、Parallels、外付けSSDなどの購入。品目ごと |
| A3 | 専用ユーザー作成、外付けSSD初期化、Time Machine除外、電源設定などのホスト変更 |
| A4 | UTMまたはParallelsのホストへのインストール |
| A5 | OS取得・更新用のネットワーク有効化 |
| A6 | macOS VMの作成とゲストOSインストール |
| A7 | B0/B1のduplicate、export、保有数変更 |
| A8 | CLT、Node、Rustなどのtoolchainインストール |
| A9 | toolchain取得用ネットワーク有効化 |
| A10 | read-only inbox、write-only outboxなどの共有有効化 |
| A11 | npm package、Rust crateの取得とinstall script実行。ネットワーク承認とは別 |
| A12 | 指定したVM、clone、exportの削除。対象UUID・パスごと |
| A13 | 後続の物理Mac上での.app／DMG実行 |

## 1. ホスト事前確認

- 目的：別ホストが隔離環境と測定環境の両方に使えるか判定する。
- 実施者：発注者とread-onlyのSetup Worker。
- 前提：A1で候補ホストが指定されていること。
- 確認項目：
  - Apple製、Apple Silicon、所有または管理下にあること
  - 正確な機種、SoC、RAM、macOSバージョン・build
  - MDM、セキュリティ製品、仮想化禁止規則の有無
  - 内蔵SSDまたは指定外付けSSDの実空き容量
  - FileVault、Firewall、リモートログイン、画面共有、ファイル共有の状態
  - USB 10 Gbps以上の外付けSSDを使う場合は、直結ポート、暗号化APFS、同一ポート固定
- 初期基準：
  - RAM 16 GiBを下限、24 GiB推奨、32 GiBなら余裕あり
  - 空き150 GiBを絶対下限、200 GiB推奨、複数exportを扱うなら250 GiB
  - 8 GiBまたは空き150 GiB未満はNO-GO
- 完了条件：host-preflight記録が埋まり、発注者がGOを出す。
- 失敗時：現在のMacを整理せず、別ホストまたは追加ストレージを再提案する。購入はA2、初期化はA3が必要。
- 根拠：Appleの[FileVault手順](https://support.apple.com/ja-jp/guide/mac-help/mh11785/mac)と[Firewall手順](https://support.apple.com/en-lamr/guide/mac-help/mh34041/26/mac/26)を確認対象にする。

## 2. 仮想化ソフトとゲストOSの入手・出典確認

- 目的：公式配布物と固定バージョンを選び、途中更新による比較ずれを防ぐ。
- 実施者：調査Workerが候補表を作り、発注者が選択する。
- 前提：段階1がGO。
- 候補：
  - 第一候補：UTM + Apple Virtualization backend
  - UTM配布元は、公式GitHub版が無料、Mac App Store版は2026-08-12確認時点で¥1,500。機能は同等で、App Store版は更新面の利点がある。[UTM公式案内](https://mac.getutm.app/)と[Mac App Store](https://apps.apple.com/jp/app/utm-virtual-machines/id1538878817)
  - guestへApple Accountを持ち込まない。App Store版を選ぶ場合も、必要なのはホスト側の購入アカウントだけ
  - fallback：Parallels Desktop。UTMで必要な動作や保守性を満たせない場合だけ、価格・ライセンスを再確認してA2/A4を取り直す。[macOS guest手順](https://kb.parallels.com/eu/125561/)と[制限事項](https://kb.parallels.com/hk/128867)
  - VMware FusionはApple Silicon上のArm macOS guestが非対応のため対象外。[Broadcom公式情報](https://knowledge.broadcom.com/external/article?legacyId=90364)
  - Apple Virtualization frameworkの直接実装は、UTM/Parallels双方が不適合だった場合の別PoC。今回の標準案にはしない
- ゲストOS：
  - UTMの自動取得またはAppleのVZMacOSRestoreImage経由を使う
  - 非公式IPSW、ミラー、betaは使わない
  - 実機確認対象と同じmajor/minor/buildを原則とし、自動取得される最新版と一致しない場合は停止する
  - Appleの[Apple Silicon上のmacOS VM](https://developer.apple.com/documentation/virtualization/running-macos-in-a-virtual-machine-on-apple-silicon)と[macOSインストール手順](https://developer.apple.com/documentation/virtualization/installing-macos-on-a-virtual-machine)を出典にする
- 完了条件：仮想化ソフト、配布元、正確なversion/build、ゲストOS build、URL、署名確認方法、費用が記録される。
- 失敗時：別backendへ黙って切り替えない。fallback採用を発注者へ戻す。
- 明示承認：購入A2、アプリ導入A4、OS取得ネットワークA5、VM作成A6を分ける。

Docker DesktopはLinux VM上でコンテナを実行するため、macOSのWKWebView/AppKit、.app／DMG、native single instance、終了後process cleanupの受け入れ証跡には使いません。[Docker VMM](https://docs.docker.com/desktop/features/vmm/)と[Docker network](https://docs.docker.com/desktop/features/networking/)が示す構成上、macOS native比較の代替になりません。別途承認されたlint、unit test、SQLiteデータ検査、SBOMなどの補助用途だけに限定し、VM内へのDocker導入もしません。

## 3. VM作成・初期化

- 目的：個人環境に接続しない、再現可能なmacOS guestを作る。
- 実施者：A4からA6を受けたSetup Worker。
- 前提：正確なホスト、UTM build、ゲストOS、保存先が確定済み。
- 初期値：
  - 4 vCPU
  - ホスト16 GiBならguest 6 GiB、24 GiB以上なら8 GiB
  - 128 GiBのsparse disk
  - 固定表示サイズ1440×900
  - 同時起動するVMは1台
  - 内蔵SSDを優先。外付けの場合は同じドライブ・ポートを両候補で使う
- 初期化：
  - Migration Assistantを使わない
  - Apple Account、iCloud、Keychain同期、メール、ブラウザー同期を設定しない
  - project専用のlocal accountのみ。パスワードは他で再利用しない
  - Analytics、Location、Siri、AirDrop、Remote Login、Screen Sharingを無効
  - guestへのSSH key、npm token、Developer ID秘密鍵、.env、本番DBの持込みを禁止
- 接続設定：
  - shared folder、clipboard、drag-and-drop、USB、camera、microphoneを既定で無効
  - network deviceも通常は無効。取得時だけShared/NATを使う
  - bridged networkは禁止
  - port forwardingは設定しない。アプリはguest内の127.0.0.1:37821だけで使う
  - UTMのApple backendではShared Network中にhostとguestが相互に見えるため、ネットワーク有効時は共有を外し、host側サービスも停止する。[UTM network設定](https://docs.getutm.app/settings-apple/devices/network/)
  - UTMのQEMU向けport forwardingはApple backendの代替にしない。[UTM port forwarding](https://docs.getutm.app/settings-qemu/devices/network/port-forwarding/)
  - macOS 15以降ではguest toolsによるclipboardが可能だが、この計画では導入しない。USBとdrag-and-dropにも依存しない。[UTM macOS guest制約](https://docs.getutm.app/guest-support/macos/)
- 完了条件：設定manifest、画面記録、host/guestのbuildが揃い、ネットワークと統合機能を切った状態で正常shutdownできる。
- 失敗時：中途半端なVMをbaselineにしない。A12で対象を確認して削除し、再作成する。

## 4. B0 baseline作成

- 目的：OS更新済みでprojectを一切含まない復元点を作る。
- 実施者：Setup Worker。
- 前提：段階3完了。
- 確認項目：
  - macOS updateをすべて適用し、再起動後に未適用更新がない
  - host OS、guest OS、UTM、IPSW、CPU、RAM、disk、displayの値を記録
  - 自動更新を測定期間中は固定
  - toolchain、repo、fixture、package cacheが存在しない
  - network、共有、clipboardが無効
  - suspendやsaved stateではなく完全shutdown
- baseline方式：
  - UTMではlive snapshotを前提にせず、完全停止後のduplicateまたはexportを使う。[UTM duplicate/export操作](https://docs.getutm.app/basics/actions/)
  - UTM bundleまたはexportについてファイル単位のSHA-256 manifestを作る
  - IPSWは取得元URLとローカルSHA-256を記録する。SHA-256だけでは配布元の真正性を証明しないため、Apple取得経路と署名確認も残す
- macOS VM保有数：
  - Appleの現行SLAは、所有・管理するApple製Mac上で開発・試験等に使う追加VMを2コピーまで認める構成になっている。[macOS Tahoe SLA PDF](https://www.apple.com/legal/sla/docs/macOSTahoe.pdf)
  - 実際に使うguest OS版のSLAを改めて確認する
  - 停止VMやexportも保守的に「コピー」と数え、フルVMは最大2個
  - B0とB1を保持した後、work cloneを作る前にB0本体とB0 exportをA12で削除し、B1 + work cloneの2個にする
  - B0は設定manifest、IPSW情報、再作成手順だけ残す
- 完了条件：B0が完全停止し、manifestとハッシュが確認済み。
- 失敗時：更新途中、設定差、汚染、保有数超過があればB0不成立。削除または再作成を発注者へ戻す。
- 明示承認：duplicate/exportはA7、削除はA12。

これは法的助言ではありません。3個以上のフルVMを同時に保持したい場合は、作成前に別途ライセンス確認が必要です。

## 5. 承認済みtoolchain導入とB1 baseline作成

- 目的：両候補が共用する最小toolchainだけを入れた基準点を作る。
- 実施者：Setup Worker。
- 前提：B0が有効で、A7によりB1用duplicateが作られている。
- 導入対象：
  - Apple Command Line Tools
  - Node.js 22.12.0
  - npm 10.9.xの承認された正確なpatch
  - Rust 1.97.1とaarch64-apple-darwin target
  - Homebrew、full Xcode、Electron/Tauri固有依存はB1へ入れない
- 出典：
  - [Apple Command Line Tools](https://developer.apple.com/documentation/xcode/installing-the-command-line-tools)
  - [Node.js 22.12.0公式archive](https://nodejs.org/download/release/v22.12.0/)
  - [Rust 1.97.1 release](https://blog.rust-lang.org/2026/07/16/Rust-1.97.1/)
  - [Tauri公式prerequisites](https://v2.tauri.app/start/prerequisites/)
- 確認項目：
  - version、architecture、実体path、Apple package receipt
  - npmrc、Cargo credentials、SSH config、Keychain同期がない
  - project固有package、crate、cache、repo、fixtureがない
  - 取得終了後にnetworkを切り、完全shutdown
  - B1 bundleのSHA-256 manifestを作成
- 完了条件：B1 manifestとハッシュが揃い、以後B1自体をbootしない。
- 失敗時：version不一致、非公式配布物、秘密情報、予期しないglobal packageがあれば昇格しない。B0から再作成する。
- 明示承認：toolchainインストールA8、取得ネットワークA9。

## 6. リポジトリ・fixtureの安全な受け渡し

- 目的：秘密情報を含まない、両候補で同一の入力を作る。
- 実施者：lockfile生成は別Coding Worker、bundle作成は別Setup/Data Worker。
- 前提：
  - B1完成
  - Electron package-lock.jsonとTauri Cargo.lockの生成・レビューが完了
  - 現在のworking treeには未コミット・untrackedのPoC実装があるため、git archive HEADだけを入力にしない
- 入力bundle：
  - 明示allowlistで必要なsource、設定、lockfile、fixtureだけを収録
  - .git、.env系、実DB、backup、node_modules、target、.next、cache、log、Keychain、SSH情報を除外
  - 公開依存だけを使い、npm tokenやCargo tokenを要求したら停止
  - 承認済み10,000件fixtureだけを含める
- 既存fixture基準：
  - baselineId：mvp-gate0-20260812-dcc057d8
  - SQLite SHA-256：bdb9d9996bf03c5c9885b9e1d13fdcce3bf2925f559171bd9890fc4da6bc46e
  - contentHash：f01c404495412554a404154c7888577f681e536f72a75fb97b35643c2f3a7de6
  - 転送前に再計算し、一致しなければ既存値を流用しない
- 転送：
  1. 現在のMacでsource archive、fixture、input manifestのSHA-256を計算
  2. 暗号化した専用リムーバブル媒体で別ホストへ渡す。クラウド、iCloud、認証付きgit cloneは使わない
  3. ネットワークを切った状態でhostからguestへread-only inboxを一時共有
  4. guest内ディスクへcopyし、共有外に保持した承認済みhashと照合
  5. 共有を解除してから展開する
- 出力：
  - `.app`はbundle属性を保つzipとしてまとめてからSHA-256を取る
  - DMG、evidence JSON、スクリーンショット、ログ要約をoutput manifestへ記録
  - 空のwrite-only outboxを短時間だけ共有
  - host側で再計算後、hostでは.appやDMGを開かない
- 完了条件：現在のMac、別ホスト、guestの三地点で入力hashが一致し、secret scan結果が0件。
- 失敗時：不一致bundleを展開しない。秘密情報が見つかった場合はnetworkを切り、流出した可能性のある資格情報をclean deviceで失効・更新する。VM削除だけで済ませない。
- 明示承認：媒体利用またはネットワーク転送、inbox/outbox共有はA10。

## 7. PoC測定

- 目的：Electron/Tauriを同じ条件で比較し、未取得だったnative証跡を埋める。
- 実施者：候補ごとに独立したMeasurement Worker。
- 前提：B1から作った未使用work clone、入力hash一致、network/共有無効。
- 実行順：
  1. B1からElectron cloneを作成
  2. Electron測定と出力hash確認
  3. A12でElectron cloneを削除
  4. B1からTauri cloneを作成
  5. Tauri測定
  - UTMからParallelsへ変更した場合は、片方だけ再利用せず両候補を測り直す
- 固定条件：
  - AC電源、同じ電源モード、同じhost/guest build、同じ仮想化ソフト
  - hostで他VM、build、indexing、大容量転送を動かさない
  - 同じ4 vCPU、RAM、display、disk、fixture、source、lockfile
  - production webpack、127.0.0.1:37821、candidate固有のdisposable data path
  - guest再起動後、同じ待機条件から開始
- 測定項目：
  - GUIとWebViewの表示・操作
  - 10,000件list、search、detail、edit、明示保存、再起動後read-back
  - 起動要求からruntime readyまでと、primary window操作可能までを分けたcold start
  - packaged appを対象にし、VM bootや初回build時間を混ぜない
  - app-owned processのPID、role、親子関係、各RSSと合計
  - Electron main/renderer/utility/Next、Tauri/WebKit/sidecarを候補別に列挙
  - hostのUTM processとhost memory pressureは診断値として別欄に置く
  - 2回目起動でsingle instance、primary window 1枚、既存windowへのfocus
  - 正常終了と強制終了後にloopback server、port、関連processが残らない
  - SQLite migration、保存後データ、stale lock recovery
  - arm64の.app／DMG作成、サイズ、hash、architecture、guest内mount/launch
  - Developer ID秘密鍵は入れず、unsignedまたはad-hoc状態を明記する。署名必須ならBLOCKED
- 試行数：
  - 機能確認は少なくとも成功1回
  - cold startとRSSは独立3回を推奨し、全値と中央値を残す
  - 既存scriptどおり1回だけならexploratoryと明記し、小差でshellを選ばない
- 判定：
  - PASS、FAIL、BLOCKED、UNVERIFIEDを使用
  - HTTP応答だけでGUI/WebViewをPASSにしない
  - process数だけで失敗にしない。比較対象は所有process全体のRSSとcleanup
  - 未定義の性能しきい値を追加しない
- 完了条件：両候補のevidence manifestに同じbaseline ID、入力hash、測定条件、全証跡がある。
- 失敗時：推測で穴を埋めず無効runとして残し、clean cloneから再実行する。

既存の測定契約は[Electron README](/Users/blp542/Desktop/自己学習/Cornell-Method/tools/desktop-poc/electron/README.md)と[Tauri README](/Users/blp542/Desktop/自己学習/Cornell-Method/tools/desktop-poc/tauri/README.md)を正本として使います。package取得は[npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/)と[npm registry署名検証](https://docs.npmjs.com/verifying-registry-signatures/)、Cargoは[cargo fetch --locked](https://doc.rust-lang.org/nightly/cargo/commands/cargo-fetch.html)を前提にします。install scriptは最初に無効化して内容を確認し、A11後に秘密情報も共有もないwork clone内だけで実行します。

## 8. rollback、汚染時の廃棄

- 目的：in-place cleanupによる見落としを避け、既知のB1へ戻す。
- 実施者：発注者承認を受けたSetup Worker。
- 前提：削除対象のVM名、UUID、bundle path、関連export、証跡退避状態が特定済み。
- 通常rollback：
  - networkを切る
  - output manifestをhost側でhash確認
  - A12取得後にwork cloneを削除
  - B1から新しいcloneを作る
- 汚染時：
  - shared folderをマウントせず、成果物をhostへ持ち出さない
  - 発生時刻、run ID、原因だけを記録してBLOCKED
  - B1汚染ならB1とwork cloneを削除し、残っているB0または記録済みIPSWから作り直す
  - secret混入時はclean deviceで失効・rotationを行う
  - OS、UTM、toolchainが途中更新されたら新baselineとし、両候補を再測定する
- 廃棄：
  - wildcardや曖昧なpathで削除しない
  - shell選定とevidence受領後にB1、残存clone、outboxを対象別に承認して削除
  - SSD上の通常削除をsecure eraseとは扱わない
  - 外付け媒体を転用するときは暗号化APFS volumeを消去する
- 完了条件：保有VM数が記録と一致し、意図しないclone/exportがない。
- 失敗時：削除対象が曖昧、hash未確認、ライセンス上限超過なら操作しない。

## 9. 結果保存とshell選定への接続

- 目的：VM比較を暫定shell選定と物理Mac確認へ接続する。
- 実施者：Review Workerが比較し、最終判断は発注者。
- 前提：両candidateのmanifestとartifact hashが検証済み。
- 保存内容：
  - baseline、source、fixture、lockfileのhash
  - host/guest/virtualizer/toolchainの正確なversion
  - GUI、single instance、cleanup、SQLite、artifactの合否
  - cold startの各試行値と中央値
  - process別RSSとapp-owned合計
  - .app.zip／DMGのサイズ、SHA-256、architecture
  - 取得できなかった項目と理由
- 選定規則：
  - GUI、single instance、process cleanup、SQLite read-back、.app／DMG生成はhard gate
  - cold start、RSS、artifactサイズ、依存量、実装保守性、費用は比較軸
  - 誤差範囲の小差を勝敗にしない
  - 一方がBLOCKEDなら、未確認のまま安全性を仮定しない
  - 発注者のshell選定までは「VM上の暫定結果」
- 完了条件：選定資料から各数値のrun IDとartifact hashを逆引きできる。
- 失敗時：入力hashや環境が違えば比較を破棄し、同じbaselineから両方再実行する。

## VMで確定できる範囲

VM内で確認できるもの：

- GUI/WebViewの基本機能
- single instanceとprimary window
- app-owned process treeとguest内RSS
- 正常終了・異常終了後のcleanup
- SQLite migration、保存、再読込
- 同一VM条件内での相対的なcold start
- arm64 .app／DMGの生成、構造、guest内mount/launch
- Electron/Tauri間の相対比較

物理Apple Silicon Macで別途必要なもの：

- 絶対的なcold start、RSS、swap、thermal、battery
- 実GPU、Metal、display、trackpad、USB、camera
- sleep/wake、logout、reboot、複数display
- Gatekeeper、quarantine、App Translocation
- Developer ID署名、notarization、外部ダウンロード後の初回起動
- 実配布先のmacOS版との互換性

物理確認は選定候補だけに絞り、VMを置いた別ホストの専用local userで行います。現在の日常利用Macを検証場所に戻す必要はありません。

## リソース・費用・時間

| 項目 | 計画値 |
|---|---|
| ホストRAM | 16 GiB下限、24 GiB推奨 |
| guest RAM | 6 GiBまたは8 GiB |
| guest CPU | 4 vCPU |
| 仮想disk | 128 GiB sparse |
| ホスト空き容量 | 150 GiB下限、200 GiB推奨 |
| 外付けSSD | 任意。1 TB、USB 10 Gbps以上、暗号化APFS。予算目安¥20,000〜¥40,000 |
| UTM | 公式GitHub版¥0、App Store版は確認時¥1,500 |
| Parallels | fallbackのみ。公式価格は変動するため購入時に[公式購入画面](https://www.parallels.com/products/desktop/buy/)で再確認 |
| Apple Developer Program | PoC／local Alphaでは不要。配布・notarization段階で別判断。[公式案内](https://developer.apple.com/jp/programs/whats-included/) |
| download量 | 計画値20〜40 GiB。OS、toolchain、candidate依存を含む |
| 作業時間 | hands-on 8〜16時間、経過1〜3日。再作成や回線速度は別 |

## セキュリティ上の中止条件

次の一つでも該当すれば、networkと共有を切り、BLOCKEDとして発注者へ戻します。

- 所有権、SLA、MDM、仮想化許可が不明
- RAMまたは空き容量が下限未満
- 非公式IPSW、beta、不明な実行ファイルしか入手できない
- FileVaultまたは外付けdisk暗号化を確保できない
- bridged network、host home共有、clipboard、USB、Full Disk Accessが必須になる
- Apple Account、iCloud、SSH key、token、Developer ID秘密鍵、.env、本番DBが見つかる
- package-lock/Cargo.lockがない、または承認後に変化する
- 想定外のregistry、git dependency、file dependency、install script、署名・integrity不一致
- 予期しない外向き通信、永続process、hostへの書込み
- baseline、source、fixture、artifactのhash不一致
- host/guest/UTMの自動更新、swap増大、強いmemory pressure、thermal制限
- 完全shutdownやprocess cleanupを証明できない
- 削除対象が一意でない、またはA12がない

## 後続Worker task案

enqueueはしていません。順序と依存関係は次のとおりです。

1. setup/research：別ホストread-only preflight  
   依存なし。出力はhost factsとGO/NO-GO。

2. setup：仮想化方式の選定、公式配布物確認、UTM導入、B0作成  
   依存：1とA2からA7。

3. setup：承認済みtoolchain導入、B1作成  
   依存：2とA8/A9。

4. setup/data：lockfile生成用の最小source bundle作成  
   依存：3。リポジトリは変更しない。

5. coding-electron：Electron package-lock.jsonの生成・差分・供給網レビュー  
   依存：4とA11。変更対象はlockfileだけ。

6. coding-tauri：Tauri Cargo.lockの生成・差分・供給網レビュー  
   依存：5のwork clone削除とB1再clone、A11。変更対象はlockfileだけ。

7. setup/data：最終PoC入力bundleとSHA-256 manifest作成  
   依存：5、6、fixture再検証。

8. measurement-electron：Electron依存取得、native PoC測定、成果物export  
   依存：7とclean B1 clone。

9. setup：Electron work cloneの証跡確認・削除・B1再clone  
   依存：8とA12。

10. measurement-tauri：Tauri依存取得、native PoC測定、成果物export  
    依存：9。

11. research/review：VM evidence比較とshell選定資料作成  
    依存：8、10。

12. setup/QA：選定候補の物理Mac確認  
    依存：11、発注者の暫定選定、A13。

13. coding：Desktop Alpha実装  
    依存：12のhard gate通過。

14. release/setup：Developer ID署名・notarization設計  
    依存：公開配布を行うという別の製品判断。PoCには混ぜない。

## 確認結果

参照した主な既存資料は、[最新HANDOFF](/Users/blp542/Desktop/自己学習/Cornell-Method/HANDOFF_2026-08-12.md)、[既存macOS VM調査summary](/Users/blp542/Desktop/自己学習/Cornell-Method/summary/20260812/1948-design-isolated-macos-vm-validation-environment-20260812-f29b19cd-summary.md)、[PoC比較summary](/Users/blp542/Desktop/自己学習/Cornell-Method/summary/20260812/1337-compare-desktop-shell-poc-evidence-20260812-summary.md)です。raw logは読んでいません。

変更ファイルはありません。作業前後の `git status --short` は一致し、既存の未コミット・untracked変更には触れていません。lint/buildは、調査専用かつ生成物変更禁止のため実行していません。仮想化ソフトや依存関係の取得、VM作成、別ホストの実機確認も未実施です。別ホストのRAM、空き容量、OS、MDM状態は段階1で実測する未確認事項です。

進捗はWorker metadataへ25%、60%、85%、100%を報告済みです。自動summaryの生成はrunnerへ委ね、手動のsummaryファイルは作成していません。日本語の整理にはstop-slop-jaの技術文書基準を適用し、承認主体、中止条件、推測できない箇所を明示しました。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260812/2059-plan-macos-vm-on-separate-host-20260812-c46f7537-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260812/2059-plan-macos-vm-on-separate-host-20260812-c46f7537-summary.md`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001653.sst`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001654.sst`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001655.sst`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001656.sst`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001657.meta`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001658.meta`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001659.meta`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/00001660.meta`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/CURRENT`
- `.next-fixture-iadpvK/dev/cache/turbopack/f37fad94/LOG`
- `.next-fixture-iadpvK/dev/trace`
