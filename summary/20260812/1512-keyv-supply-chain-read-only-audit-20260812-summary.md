# Keyv / Cacheable npm 侵害の読み取り専用監査 summary

確認日時: 2026-08-12 15:11 JST（ローカル確認の最終時刻）

## Objective

2026-08-04 の keyv / cacheable 系 npm サプライチェーン侵害について、root と Desktop PoC 候補の manifest、lockfile、既存 `node_modules`、既存の Desktop PoC staging / cache の範囲を読み取り専用で確認した。現在の依存グラフ上の exact version、配置済みファイル、時刻、IOC、端末全体では未確認の事項を分離して記録する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象 | `package.json`、`package-lock.json`、root `node_modules/`、`tools/desktop-poc/electron/`、`tools/desktop-poc/tauri/` |
| 確認対象 package | `keyv`、`cacheable`、`cacheable-request`、`cache-manager`、`flat-cache`、`file-entry-cache`、`@keyv/*`、`@cacheable/*` |
| IOC | `setup.mjs`、`Math_Symbol.js`、`math_init.js`、`router_runtime.js`、`bun-dl-*`、token monitor 関連名、Socket 公開 hash / network indicator |
| 読まなかったもの | `.env`、DB / SQLite、ノート本文、認証情報、秘密鍵、token の内容 |
| 対象外 | 端末全体、home 全体、CI / GitHub / npm account、ネットワーク・永続化ログの全面調査 |

## Public Sources Read

確認日時はいずれも 2026-08-12 JST（同一監査セッション）。

| 出典 | 確認結果 / 用途 |
|---|---|
| [Socket: keyv and Cacheable namespaces compromise](https://socket.dev/blog/popular-npm-packages-in-the-keyv-and-cacheable-namespaces-compromised-in-active-supply-chain) | 一次分析として affected version、`preinstall: node setup.mjs`、追加ファイル、IOC、2026-08-04 UTC の公開時刻を照合した。 |
| [Socket campaign tracker](https://socket.dev/supply-chain-attacks/keyv-and-cacheable-compromise) | ongoing の動的 tracker であることを確認した。件数や一覧は変動するため、静的な完全リストとは扱わない。 |
| [Wiz `keyv-packages.csv`](https://raw.githubusercontent.com/wiz-sec-public/wiz-research-iocs/main/reports/keyv-packages.csv) | 公開 CSV の relevant rows を exact version 照合に使用した。`keyv,6.0.0`、`flat-cache,6.1.24`、`file-entry-cache,11.1.6`、`cacheable,2.5.1`、`cacheable-request,13.0.20`、`cache-manager,7.2.10`、`@cacheable/*` の該当 rows が確認できる。 |
| 発注者提示の [Flatt Security 記事](https://blog.flatt.tech/entry/keyv_compromise) | Web open は Internal Error、shell の read-only `curl -I` は DNS 解決失敗となり、本文の取得はできなかった。本文の内容を根拠にした判定はしていない。 |
| [Aikido 記事](https://www.aikido.dev/blog/keyv-and-friends-compromised-in-npm-supply-chain-attack)、[SafeDep 記事](https://safedep.io/keyv-npm-supply-chain-compromise/) | このセッションでは direct open が取得エラーとなったため、exact version 判定の一次根拠にはしていない。Socket / Wiz の公開情報で照合した。 |

Socket の分析では、上記に加えて `@keyv/*` の `6.0.0` tarball が suspect とされているが、例示された scoped tarball には `preinstall` がなく、executable payload が確認された package は別途列挙されている。今回の対象には `@keyv/*` が存在しない。

## Affected versions used for comparison

| package family | 侵害版 / suspect version | 根拠 |
|---|---|---|
| `keyv` | `6.0.0` | Socket / Wiz |
| `flat-cache` | `6.1.24` | Socket / Wiz |
| `file-entry-cache` | `11.1.6` | Socket / Wiz |
| `cacheable` | `2.5.1` | Socket / Wiz |
| `cacheable-request` | `13.0.20` | Socket / Wiz |
| `cache-manager` | `7.2.10` | Socket / Wiz |
| `@cacheable/net`、`@cacheable/node-cache`、`@cacheable/memory`、`@cacheable/utils` | `2.1.1`、`3.1.2`、`2.2.1`、`2.5.1` | Socket / Wiz |
| `@keyv/*` | `6.0.0` は Socket が suspect と記載 | payload 確認範囲は package ごとに異なる |

## Findings

### 1. 依存グラフと実配置

| scope | manifest / lockfile | 実配置 | 判定 |
|---|---|---|---|
| root | `package.json` に relevant package の直接依存なし。`package-lock.json` v3 の dependency chain は `eslint@9.39.1` → `file-entry-cache@8.0.0` → `flat-cache@4.0.1` → `keyv@4.5.4`。`cacheable`、`cacheable-request`、`cache-manager`、`@keyv/*`、`@cacheable/*` の lock entry はなし。 | `node_modules/file-entry-cache/package.json` = `8.0.0`、`node_modules/flat-cache/package.json` = `4.0.1`、`node_modules/keyv/package.json` = `4.5.4`。nested duplicate は確認されなかった。 | affected exact version は **該当なし**。package family 自体は存在するため、これだけで過去の実行・端末安全性を証明するものではなく、総合的な感染判定は **侵害判定不能**。 |
| Electron candidate | `tools/desktop-poc/electron/package.json` の依存は `electron`、devDependency は `electron-builder`。relevant package なし。`package-lock.json` は不在。 | `tools/desktop-poc/electron/node_modules/` は不在。 | graph 上は **該当なし**。candidate の install 済み artifact は **未確認**（不在なので安全性を推測しない）。 |
| Tauri candidate | `tools/desktop-poc/tauri/package.json` に npm dependencies なし。`package-lock.json` は v3、`packages` は root entry のみ。relevant package なし。 | `tools/desktop-poc/tauri/node_modules/` は不在。 | graph 上は **該当なし**。candidate の install 済み artifact は **未確認**（不在なので安全性を推測しない）。 |
| Desktop PoC staging / cache | `tools/desktop-poc/` に `node_modules`、cache / stage / artifact / evidence directory は存在しない。 | IOC 名のファイルも存在しない。 | 確認範囲では **IOC 検出なし**。 |

root の relevant dependency edge は lockfile 上で次の通りだった。

```text
eslint@9.39.1
  └─ file-entry-cache@8.0.0
       └─ flat-cache@4.0.1
            └─ keyv@4.5.4
```

### 2. lockfile / package metadata

- `package.json`、root `package-lock.json`、Electron manifest、Tauri manifest / lockfile はすべて JSON として parse 成功した。
- root `package-lock.json` は lockfile v3、`packages` 1006 entries。`node_modules/.package-lock.json` も v3、917 entries で、relevant 3 package の version / `resolved` / `integrity` は root lockfile と一致した。
- relevant entry の `resolved` はいずれも `https://registry.npmjs.org/<package>/-/<package>-<version>.tgz` 形式、`integrity` は syntactically valid な `sha512-...`。relevant entry に metadata 欠落はなく、lockfile の `hasInstallScript` は false だった。
- URL、version、package path、integrity 文字列の内部整合性に明らかな不整合は見つからなかった。ただし registry から tarball を再取得して比較していないため、内容の真正性を外部検証した結果ではない。
- Socket は `keyv@6.0.0` が valid npm / Sigstore provenance を持っていても、侵害済み source を正規 workflow が build した場合は安全性の証明にならないと説明している。したがって lockfile の integrity だけで悪性コード混入を完全否定できない。

### 3. 配置済み package.json と lifecycle script

対象 package の実ファイルを読み取り、script は実行していない。

| installed package | version | lifecycle script |
|---|---:|---|
| `node_modules/file-entry-cache` | `8.0.0` | `preinstall` / `install` / `postinstall` / `prepare` はなし |
| `node_modules/flat-cache` | `4.0.1` | `preinstall` / `install` / `postinstall` / `prepare` はなし |
| `node_modules/keyv` | `4.5.4` | `prepare: yarn build` のみ。侵害報告の `preinstall: node setup.mjs` はなし |

`node_modules` 全体の lockfile flag では `hasInstallScript=true` は 8 package だが、対象 family は含まれない。対象外 package の install script はこの task の判定対象として実行・評価していない。

### 4. IOC / 不自然な追加ファイル

Socket の公開 IOC に基づき、root `node_modules` と `tools/desktop-poc` を読み取り専用で確認した。

- exact filename の検索: `setup.mjs`、`Math_Symbol.js`、`math_init.js`、`router_runtime.js`、`bun-dl-*`、`tmp.dpkg_*.lock`、`gh-token-monitor.sh`、`com.user.gh-token-monitor.plist`、`gh-token-monitor.out.log`、`gh-token-monitor.err.log` は **該当なし**。
- relevant package directory と Desktop PoC の code / metadata 内容について、`oven-sh/bun`、`bun-v1.3.13`、`gh-token-monitor`、AWS metadata IP、npm whoami / token / OIDC endpoint、Socket が掲載した 3 hash は **該当なし**。
- root `node_modules` の code / metadata file type に対する同様の検索では `node_modules/konva/package.json` に部分文字列 `setup.mjs` のみ hit した。内容は `node-canvas-global-setup.mjs` / `node-skia-global-setup.mjs` という test script のファイル名であり、exact IOC、malicious `preinstall`、`Math_Symbol.js`、Bun loader ではない。これは **IOC 検出ではない誤検出**として扱う。
- repository root と Desktop PoC の `.claude/settings.json`、`.vscode/tasks.json` は存在しないことをパス名だけ確認した。
- npm cache の内容は開かず、時刻 metadata のみ確認した。したがって cache tarball 内の IOC 有無は **未確認**。

### 5. filesystem timestamp facts

時刻は macOS filesystem metadata の事実であり、install / execution の証明ではない。

| path | birth | modify |
|---|---|---|
| `package-lock.json` | 2026-07-31 07:24:01 JST | 2026-07-31 07:24:01 JST |
| root `node_modules/` | 2026-07-02 23:48:38 JST | 2026-07-31 03:20:37 JST |
| relevant package directories | 2026-07-31 03:19:39 JST | 2026-07-31 03:19:45–46 JST |
| `node_modules/.package-lock.json` | 2026-07-31 03:20:25 JST | 2026-07-31 03:20:25 JST |
| `tools/desktop-poc/electron/` | 2026-08-12 10:36:25 JST | 2026-08-12 10:47:09 JST |
| `tools/desktop-poc/tauri/` | 2026-08-12 12:02:38 JST | 2026-08-12 12:21:08 JST |
| `/Users/blp542/.npm` | 2024-11-11 14:39:37 JST | 2025-05-08 16:35:31 JST |
| `/Users/blp542/.npm/_cacache` | 2025-05-08 16:35:31 JST | 2025-05-08 16:35:50 JST |
| `/Users/blp542/.npm/_logs` | 2024-11-11 14:39:37 JST | 2026-08-12 05:00:35 JST |

root の relevant package files は 2026-08-04 より前の birth / modify だったが、copy、再利用、別環境での install、実行履歴の不存在をこの事実だけから断定しない。

## 判定の分離

| 判定項目 | 結果 |
|---|---|
| 現在の依存グラフに affected exact version があるか | root / Electron / Tauri とも **該当なし**。root は非侵害版の family が存在する。 |
| affected package が配置されているか | root の配置は `keyv@4.5.4`、`flat-cache@4.0.1`、`file-entry-cache@8.0.0`。affected version は **存在しない**。candidate `node_modules` は不在で **未確認**。 |
| IOC 検出 | 今回の対象範囲では **IOC 検出なし**。`konva` の部分文字列は無害な false positive。 |
| 端末全体の感染判定 | **未確認 / 判定不能**。本監査は repository と既存対象 artifact に限定され、host persistence、network、CI、過去の install / execution は調べていない。 |
| lockfile integrity の意味 | 内部整合性は確認できたが、悪性コード混入を完全否定する根拠ではない。 |

## Verification

| 確認項目 | 結果 |
|---|---|
| 作業前 `git status --short` | 実施済み。既存の未コミット変更を確認し、戻していない。 |
| JSON parse | 対象 manifest / lockfile は成功。 |
| version / dependency / resolved / integrity / actual package metadata | 読み取り専用で確認。root lockfile と hidden node_modules lockfile の relevant metadata も一致。 |
| IOC filename / content scan | 実施。上記 false positive 以外の exact IOC hit なし。 |
| install / update / rebuild / audit | `npm install`、`npm ci`、`npm update`、`npm rebuild`、`npm run`、`npx`、`npm audit` は実行していない。 |
| build / runtime / package script | package lifecycle、Node require/import、Cargo、build、runtime は実行していない。 |
| external fetch | browser で Socket / Wiz 公開情報を確認。Flatt 記事の shell `curl -I` は DNS failure で本文取得なし。registry / crates.io への依存解決はしていない。 |
| repository changes | この task が追加したのは本 summary のみ。コード、設定、依存、lockfile、生成物は変更していない。 |

## Remaining Unknowns

| ID | 未確認事項 | 必要な追加根拠 |
|---|---|---|
| U-01 | 2026-08-04 前後に別 lockfile、CI runner、別 checkout、npm cache tarball で affected version を install / 実行したか | CI log、shell history、package-manager log、artifact / cache provenance。秘密値は取得・保存しない。 |
| U-02 | host-level persistence と過去の IOC | 既知の clean device から、`~/.local/bin/gh-token-monitor.sh`、`~/.config/gh-token-monitor/`、`~/Library/LaunchAgents/com.user.gh-token-monitor.plist`、`~/.config/systemd/user/gh-token-monitor.service`、`/tmp/gh-token-monitor.*`、Bun download artifact をファイル名・hash中心に確認する。token / handler の内容は開かない。 |
| U-03 | 2026-08-04 UTC 09:30–10:15 前後の外部通信・GitHub/npm 操作 | network / DNS / firewall log、GitHub audit、npm publish history を別途確認する。Socket は npm whoami、OIDC token exchange、Bun download 等を IOC として示している。 |
| U-04 | credentials が payload に到達した可能性 | affected version の実行または host IOC が確認された場合に限り、感染の可能性がある host を隔離し、implant / persistence を先に処理してから、clean device から revoke / rotate を判断する。現時点の repository auditだけでは rotation の要否を断定しない。 |

## Safe next action

1. 追加 install / update / build はせず、まず U-01〜U-03 の履歴・endpoint・account evidence を clean environment から確認する。
2. affected version または host IOC が見つかった場合は、感染の可能性がある host から直接 credential rotation を開始しない。Socket の指針どおり、隔離と persistence / implant の確認を先に行い、known-clean device から revoke / rotate する。
3. 今回の root 結果だけから「端末は安全」とは扱わない。一方、現行 lockfile / 実配置に affected exact version や IOC は見つかっていないため、現時点でこの repository に対する侵害版一致・IOC 検出はない。

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260812/1512-keyv-supply-chain-read-only-audit-20260812-summary.md` | 本読み取り専用監査の結果を記録 | Worker 完了要約と次回判断の根拠 |

## Next Read

- 本 summary の `Remaining Unknowns` と `Safe next action`。
- 追加調査時は最新の [Socket campaign tracker](https://socket.dev/supply-chain-attacks/keyv-and-cacheable-compromise) と [Wiz CSV](https://raw.githubusercontent.com/wiz-sec-public/wiz-research-iocs/main/reports/keyv-packages.csv) を再確認する。
