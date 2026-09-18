# Keyv / Cacheable npm 侵害の host-level 読み取り専用監査 summary

確認日時: 2026-08-12 18:38–18:41 JST（macOS path の最終確認時刻）

## Objective

2026-08-04 の keyv / cacheable 系 npm サプライチェーン攻撃について、公開されている代表的な IOC 名と macOS の代表的な永続化 path の存在・metadata を、非実行・読み取り専用で確認した。検出なしは指定範囲に限る結果であり、端末全体の安全性や過去の実行・通信がないことを証明しない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象 path | `/Users/blp542/Library/LaunchAgents/`、`/Users/blp542/Library/LaunchDaemons/`、`/Library/LaunchAgents/`、`/Library/LaunchDaemons/`、`/Users/blp542/.config/`、`/Users/blp542/.local/bin/`、`/private/tmp/`、`/var/tmp/`、`/Users/blp542/.npm/_logs/`、`/Users/blp542/.npm/_cacache/` |
| IOC 名 | `setup.mjs`、`Math_Symbol.js`、`math_init.js`、`router_runtime.js`、`bun-dl-*`、`gh-token-monitor.sh`、`com.user.gh-token-monitor.plist`、`gh-token-monitor.out.log`、`gh-token-monitor.err.log`、`tmp.dpkg_*.lock`、`bun-v1.3.13`、`oven-sh/bun`、`gh-token-monitor` |
| metadata | 存在、種類、名前、サイズ、mtime、birthtime、mode。IOC 一致時だけ SHA-256 を取得する方針としたが、一致がないため hash は未取得。 |
| 対象外 | home 全体、`/` 全体、ログ本文、shell history、`.env`、credential / token / DB / ノート本文、全 process、全 network、過去の通信・実行履歴。 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repository handoff | `HANDOFF_2026-08-12.md` | 現在の未確認事項と summary 運用を確認。 |
| prior audit summary | `summary/20260812/1512-keyv-supply-chain-read-only-audit-20260812-summary.md` | repository dependency audit の結果、既存の公開 IOC 出典、残る host-level unknowns を確認。 |
| task summary | `summary/20260812/1515-audit-keyv-compromise-local-dependency-state-20260812-8a636619-summary.md` | 直前 worker の完了状態と Next Read を確認。 |
| public IOC | [Wiz affected-version CSV](https://raw.githubusercontent.com/wiz-sec-public/wiz-research-iocs/main/reports/keyv-packages.csv) | affected package/version の current public list を read-only 参照。 |
| user-provided references | [Flatt article](https://blog.flatt.tech/entry/keyv_compromise)、[Aikido article](https://www.aikido.dev/blog/keyv-and-friends-compromised-in-npm-supply-chain-attack) | URL を取得試行。DNS failure のため本文は読めず、task に明示された IOC 範囲を採用。 |

## Public Sources Read

確認日時はいずれも 2026-08-12 JST。同一監査セッションで、Wiz の公開 CSV は web 経由で確認した。発注者提示記事は URL の取得を試みたが、本文は判定根拠に使用していない。

| 出典 | 用途・取得状況 |
|---|---|
| [発注者提示: Flatt の keyv compromise 記事](https://blog.flatt.tech/entry/keyv_compromise) | 18:41 JST に `curl` で本文を保存せず取得試行。DNS 解決失敗。IOC 名は task に提示された範囲だけを採用した。 |
| [発注者提示: Aikido の keyv / friends 記事](https://www.aikido.dev/blog/keyv-and-friends-compromised-in-npm-supply-chain-attack) | 18:41 JST に `curl` で本文を保存せず取得試行。DNS 解決失敗。IOC 名は task に提示された範囲だけを採用した。 |
| [Wiz 公開 affected-version CSV](https://raw.githubusercontent.com/wiz-sec-public/wiz-research-iocs/main/reports/keyv-packages.csv) | `keyv@6.0.0`、`cacheable@2.5.1`、`cacheable-request@13.0.20`、`cache-manager@7.2.10`、`flat-cache@6.1.24`、`file-entry-cache@11.1.6` 等の version 判定に使用。 |
| [Socket の keyv / Cacheable 分析](https://socket.dev/blog/popular-npm-packages-in-the-keyv-and-cacheable-namespaces-compromised-in-active-supply-chain) | 直前の repository 監査 summary に記録された公開分析を参照。今回の host scan では、その summary と task に既出の IOC 名に限定し、追加の推測文字列を広げていない。 |

## Findings

### 1. 対象 path の判定

| 対象 | 結果 | 確認事実 |
|---|---|---|
| `/Users/blp542/Library/LaunchAgents/` | **不在** | 親 `/Users/blp542/Library/` は確認可能で、対象は `No such file or directory`。権限不足ではない。 |
| `/Users/blp542/Library/LaunchDaemons/` | **不在** | 親 `/Users/blp542/Library/` は確認可能で、対象は `No such file or directory`。権限不足ではない。 |
| `/Library/LaunchAgents/` | **存在・確認済み** | Directory、size 352、mtime `2026-08-12T10:10:31+0900`、birthtime `2025-09-25T16:03:32+0900`、mode `drwxr-xr-x`。直下 9 entry の名前・metadata を確認し、IOC 名一致なし。plist 本文は読んでいない。 |
| `/Library/LaunchDaemons/` | **存在・確認済み** | Directory、size 832、mtime `2026-08-12T10:10:30+0900`、birthtime `2025-09-25T16:03:32+0900`、mode `drwxr-xr-x`。直下 24 entry の名前・metadata を確認し、IOC 名一致なし。plist 本文は読んでいない。 |
| `/Users/blp542/.config/` | **存在・確認済み** | Directory、size 192、mtime `2026-07-22T23:28:17+0900`、birthtime `2024-11-11T13:55:25+0900`、mode `drwxr-xr-x`。直下 4 entry と指定 IOC 名の配下検索を確認し、一致なし。内容は読んでいない。 |
| `/Users/blp542/.local/bin/` | **不在** | 親 `/Users/blp542/.local/` は確認可能で、対象は `No such file or directory`。権限不足ではない。 |
| `/private/tmp/` | **存在・確認済み** | Directory、size 768、mtime `2026-08-12T18:35:28+0900`、birthtime `2026-08-11T06:27:07+0900`、mode `drwxrwxrwt`。指定 IOC filename のみを限定検索し、一致なし。 |
| `/var/tmp/` | **存在・確認済み** | Directory、size 1222560、mtime `2026-08-12T18:37:17+0900`、birthtime `2025-09-25T16:03:32+0900`、mode `drwxrwxrwt`。指定 IOC filename のみを限定検索し、一致なし。 |
| `/Users/blp542/.npm/_logs/` | **存在・確認済み** | Directory、size 2272、mtime `2026-08-12T05:00:35+0900`、birthtime `2024-11-11T14:39:37+0900`、mode `drwxr-xr-x`。直下 69 entry の filename・mtime・size のみ確認。ログ本文は読んでいない。 |
| `/Users/blp542/.npm/_cacache/` | **存在・限定確認** | Directory、size 192、mtime `2025-05-08T16:35:50+0900`、birthtime `2025-05-08T16:35:31+0900`、mode `drwxr-xr-x`。既知 IOC 名・関連 package 名に限定した path metadata 検索のみで一致なし。content-addressed blob の本文・tarball は読んでいない。 |

### 2. IOC / 永続化判定

- 指定範囲で `setup.mjs`、`Math_Symbol.js`、`math_init.js`、`router_runtime.js`、`bun-dl-*`、`gh-token-monitor*`、`tmp.dpkg_*.lock`、`bun-v1.3.13`、`oven-sh/bun` の **filename/path metadata 一致はなし**。
- **既知 IOC と一致する対象はなし**。したがって IOC file の hash は取得していない。
- 通常の system LaunchAgent / LaunchDaemon の entry が存在すること自体は、今回の攻撃との関連を示さない。plist の内容は読んでおらず、IOC 名との一致なしという判定に限定する。
- `.npm/_logs/` は filename・時刻・サイズのみであり、ログ本文から過去の install / execution を判定していない。
- `.npm/_cacache/` は content-addressed であるため、ファイル名一致なしは cache tarball 内部に IOC がないことを意味しない。cache 内容は **未確認**。

### 3. 判定の分離

| 判定 | 結果 |
|---|---|
| 対象 path / IOC が存在しない | 上記の不在 path、および指定 filename/path metadata の一致なしについて確認。 |
| 対象 path / IOC が存在するが、今回の攻撃との関連は未判定 | system の通常 Launch entry、および `.config` 等の非 IOC entry。内容を読んでいないため関連は判定しない。 |
| 既知 IOC と一致 | **なし**。 |
| 権限や環境のため未確認 | 対象 path 自体の metadata について権限不足は発生しなかった。npm cache blob 内部、過去の実行・通信・process state は制約により未確認。 |
| 端末全体の安全性 | **本確認だけでは判定不能**。対象範囲における永続化 filename / IOC metadata の検出なしにとどまる。 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260812/1841-keyv-supply-chain-host-level-read-only-audit-20260812-summary.md` | 本 host-level 読み取り専用監査の結果を記録 | 出典、対象範囲、検出なし、未確認事項を後続判断へ引き継ぐため |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 実施済み | 既存の未コミット変更を確認し、戻していない。 |
| 作業後 `git status --short` | 実施済み | 作業前から存在する変更に加え、本 summary の untracked 追加だけであることを確認した。 |
| path metadata | 実施済み | `stat`、`find`。ファイルを開いていない。 |
| IOC name/path scan | 実施済み | 指定 path の名前だけを限定検索。内容 grep はしていない。 |
| `tools/check-summary.sh` | 成功 | summary の必須見出しを検証し、終了コード 0。 |
| SHA-256 | 未取得 | IOC 一致がないため。 |
| npm install / ci / update / rebuild / run / audit | **未実行** | npm registry への依存解決なし。 |
| npx / Node require・import / lifecycle script / build / app 起動 | **未実行** | 疑わしいファイルを実行・ロードしていない。 |
| process / network state | **未確認** | 全 process・全 network の調査は task 対象外。 |
| 外部公開情報 | 限定 read-only | 記事は DNS 解決失敗。Wiz CSV は web で参照。 |
| repository code / config / dependency / lockfile / generated artifact | **変更なし** | 追加したのはこの summary のみ。 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-01 | 2026-08-04 前後に別 checkout、CI runner、別 lockfile、npm cache tarball で affected version を install / 実行したか | clean device からの CI / package-manager 記録確認。秘密値・token 本文は取得しない。 |
| U-02 | `.npm/_cacache/` 内の content-addressed tarball / blob に IOC が含まれるか | 影響範囲を決めたうえで、隔離・非実行の hash / artifact 検査。現確認では本文を読まない。 |
| U-03 | 過去の persistence、process、network / DNS 通信 | 別途承認された限定照会。今回の task では全面調査していない。 |
| U-04 | credential が payload に到達した可能性 | affected version または host IOC が確認された場合、まず端末を隔離し、persistence / implant を専門家または clean device から確認してから revoke / rotate を判断する。 |

## Safe Next Action

1. 今回の結果だけで端末全体を clean と扱わない。また、依存 install を安全に開始できるとは断定しない。
2. 追加 install / update / build はせず、必要なら clean environment で U-01〜U-03 の証跡を確認する。
3. 今後、既知 IOC が見つかった場合は削除・移動・修復・credential rotation をこの確認から自動実行せず、対象端末を隔離して発注者へ報告する。

## Next Read

- 本 summary の `Remaining Unknowns` と `Safe Next Action`。
- repository 側の既存監査結果: [1512 keyv supply-chain read-only audit summary](summary/20260812/1512-keyv-supply-chain-read-only-audit-20260812-summary.md)。
- 追加の公開 IOC を採用する場合は、[Wiz affected-version CSV](https://raw.githubusercontent.com/wiz-sec-public/wiz-research-iocs/main/reports/keyv-packages.csv) と一次調査の最新版を再確認する。
