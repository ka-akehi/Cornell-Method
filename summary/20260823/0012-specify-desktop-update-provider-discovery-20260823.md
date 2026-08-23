---
summary_type: task-summary
created_at: 2026-08-23 00:12 JST
task_kind: worker-task
task_status: done
---

## Objective

Desktop Alpha の更新確認で使う GitHub Releases の provider discovery 契約を、次の coding task が追加質問なしで実装できる粒度まで固定する。成果物は調査結果と契約案を記録した完了要約だけとし、製品コード・既存仕様書・テストは変更しない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | 固定 GitHub Releases manifest asset の取得、HTTP 境界、既存 update-state への接続点 |
| 対象ファイル / ディレクトリ | `HANDOFF_2026-08-22.md`、Desktop Alpha の正本 3 文書、`src-tauri/src/update_manifest.rs`、`update_selection.rs`、`update_state.rs`、対応 desktop tests、local git remote 名 |
| 対象外 | GitHub 接続、API / raw fallback、package download、署名暗号検証、apply / rollback、state / UI の再実装、仕様書・コード・依存関係・lockfile・テスト・生成物の変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | Desktop Alpha の未実装範囲、更新 task の順序、既知の検証制約 |
| canonical contract | `doc/implementation/MVP_CONTRACT.md` §9.4〜§9.4.1 | GitHub provider、`releases[]`、stable / Apple Silicon / `app-archive`、strict field allowlist、URL / signature / duplicate 境界 |
| technical contract | `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md` のデータ・ネットワーク境界、更新契約、Manifest validation boundary | provider-neutral 境界、privacy、staging、既存の HTTPS redirect 方針 |
| implementation plan | `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md` §6.3〜§6.5、§7〜§8 | 24時間自動確認、手動確認、失敗時の現行版維持、次の update/download task の受け入れ条件 |
| implementation | `src-tauri/src/update_manifest.rs` | `parse_manifest(&str)`、strict unknown-field、product/schema、artifact URL、signature proof、target filtering、duplicate validation |
| implementation | `src-tauri/src/update_selection.rs` | pure selection の入力、`NoUpdate` / `Selected` / `InvalidInput` / `Ambiguous`、stable / target / SemVer / macOS range 判定 |
| implementation | `src-tauri/src/update_state.rs` | `CheckTrigger`、24時間制限、`begin_check`、`record_no_update`、`record_available`、`record_failure`、sanitized error code |
| tests | `test/desktop/desktop-update-manifest.test.js`、`desktop-update-selection.test.js` | provider / network 未接続の現行境界、既存契約を変更しない static checks |
| local metadata | `git config --get remote.origin.url`（owner/repository 部分だけを表示） | `ka-akehi/Cornell-Method` の repository 名確認。GitHub への接続はしていない |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260823/0012-specify-desktop-update-provider-discovery-20260823.md` | 固定 URL、公開規約、HTTP / parse 境界、state 接続、次 task の interface・error・fixture・未決事項を記録 | Worker task の成果物 |
| それ以外 | 変更なし | 制約どおり、調査・仕様詰めだけを行った |

## Findings

### 1. 固定 provider discovery 契約案

次の URL と asset 名を唯一の discovery endpoint とする。

| 項目 | 固定値 / 契約 |
|---|---|
| GitHub owner | `ka-akehi`。実行時の環境変数、設定、manifest、git remote から読まない |
| GitHub repository | `Cornell-Method`。実行時に変更可能にしない |
| manifest asset name | `cornell-method-notebook-update-manifest.json`。version / architecture / channel の suffix を付けない |
| manifest URL | `https://github.com/ka-akehi/Cornell-Method/releases/latest/download/cornell-method-notebook-update-manifest.json` |
| URL binding | provider module の compile-time constant として保持し、固定 URL の完全一致を unit / contract test で確認する |
| discovery method | `GET` のみ。GitHub Releases API、`repos/.../releases/latest`、repository raw file、tag API、別 CDN endpoint への fallback は行わない |
| request input | body なし。初回 URLに query / fragment を付けない。`Authorization`、Cookie、GitHub token、端末 ID、利用状況、ノート・SQLite・backup・診断情報を送らない |

`latest` は GitHub が選ぶ最新の公開・非 draft・非 prerelease Release を指す。client は tag の文字列順、GitHub API の release list、manifest の並び順を解釈しない。`latest` endpoint が 404 / 5xx / malformed response なら「更新なし」ではなく provider error として fail closed する。

manifest 内の各 target release の package URL は、mutable な `latest/download` ではなく、version-specific な GitHub Release asset URL（immutable tag と package asset を含む）を指す。package archive の具体的な拡張子は既存契約どおり固定しない。artifact URL の HTTPS / credential / token / user-specific query validation は既存 `update_manifest.rs` の責務であり、provider discovery が URL を書き換えたり再検証したりしない。

### 2. GitHub Releases 側の公開規約

- stable channel の配布候補となる各 public Release は、draft ではなく prerelease でもない状態で公開する。manifest の target entry は既存契約どおり `channel="stable"`、`architecture="aarch64-apple-darwin"`、`artifact.format="app-archive"` とする。
- `latest` になり得る stable Release には、完全一致する manifest asset 名を 1 件だけ置く。package asset を先に揃え、manifest asset を最後に upload し、manifest asset の存在・内容・サイズを確認してから Release を publish する。asset 欠落を client 側の API fallback で補わない。
- `releases[]` は provider が提示する supported stable package/version の一覧とし、各 entry にその version 固有の package URL、`artifactId`、`sizeBytes`、lowercase SHA-256、既存の `signature.keyId` / `signature.proof` を持たせる。複数版を飛ばす選択は既存 `update_selection.rs` に任せる。
- manifest は UTF-8 JSON とし、既存 `productId`、root `schemaVersion: 1`、strict unknown-field、空 `releases[]`、release / artifact / signature の allowlist を変更しない。新しい root signature field や provider payload field は追加しない。
- 1 MiB の response 上限内に収まるように公開する。公開前に既存 validator と同じ fixture / schema checks を publisher 側で実行することを推奨する。client は壊れた manifest を別 release や API から探さない。
- 最新 stable Release の manifest が欠落、空でない不正 JSON、schema 不整合、サイズ超過などになった場合、client の結果は provider failure であり、current app と live DB を維持する。公開運用で修正するまで自動的に別 asset へ切り替えない。

### 3. HTTP 取得契約と fail-closed 条件

| 項目 | 契約 |
|---|---|
| scheme / TLS | 初回 URL は HTTPS 固定。TLS の証明書・hostname 検証を無効化しない。redirect の各 hop も HTTPS 必須 |
| redirect | 301 / 302 / 303 / 307 / 308 のみを最大 5 hop まで追従。`Location` 欠落、parse 不能、loop、上限超過、HTTP / 非 HTTPS への downgrade は `provider-redirect` で拒否。relative `Location` は直前の HTTPS URL に対してだけ解決する。redirect は固定 asset の配信継続であり、API / raw fallback ではない |
| redirect query / credentials | client は query、Authorization、Cookie、token を生成・追加・保存しない。GitHub が public asset 配信のために返す provider/CDN の opaque な redirect query は一時的な transport data としてのみ追従し、解釈・state / log / UI への保存をしない。client 由来の credential、token、user-specific query、userinfo を含む URL は拒否 |
| final status | 最終 response は `200 OK` のみ成功。204、206、304、その他の 2xx、最終 3xx、4xx、5xx は `provider-http-status`。404 は「更新なし」ではない |
| content type | media type を case-insensitive に比較し、parameters は許容する。`application/json` と GitHub release asset の generic type `application/octet-stream` だけを許可。欠落、その他の type、body の content sniffing による救済は拒否し `provider-content-type` |
| response size | body は 1 byte 以上、1,048,576 bytes 以下を成功とする。`Content-Length` が上限超過なら読み始めず拒否し、chunked / decoded body が上限を超えた時点でも中止する。空 body は `provider-empty-response`、超過は `provider-response-too-large` |
| timeout | DNS / connect / redirect / read を含む 1 回の論理 fetch 全体に 15 秒の deadline。hop ごとに延長しない。自動 retry は provider 内で行わず、state の次回自動確認または手動確認に任せる。期限超過は `provider-timeout` |
| bytes / JSON | response bytes を UTF-8 として decode し、BOM などを暗黙に補正せず、既存 `parse_manifest(&str)` にそのまま渡す。invalid UTF-8 は `provider-invalid-encoding`、JSON parse failure は `provider-invalid-json` |
| schema / logical validation | `parse_manifest` の `ManifestValidationError` を provider layer で再解釈・部分修復しない。unknown field、product/schema、必須 field、SemVer、macOS range、artifact URL / metadata、signature proof、duplicate の失敗は `provider-invalid-manifest` として manifest 全体を拒否 |
| valid no-update | `releases[]` が空、または既存 validator が非対象 release を除外した結果が空なら成功した `NoUpdate`。空 HTTP body、invalid JSON、invalid schema と混同しない |

HTTP layer は response policy と bytes の受け渡しだけを担当し、manifest の fields を読んで provider 用に normalize しない。static manifest は既に provider-neutral wire contract であり、GitHub Release API の raw object を扱う必要はない。

### 4. 次の coding task の interface / 責務境界

次 task の実装対象は `src-tauri/src/update_provider.rs`（名称はこの案を採用）と desktop focused tests とする。既存 module は次のままにする。

```text
pub(crate) const GITHUB_RELEASES_MANIFEST_URL: &str =
  "https://github.com/ka-akehi/Cornell-Method/releases/latest/download/cornell-method-notebook-update-manifest.json";

pub(crate) trait ManifestHttpTransport {
    fn get(
        &self,
        request: ManifestHttpRequest,
    ) -> Result<ManifestHttpResponse, ManifestHttpError>;
}

pub(crate) fn fetch_manifest<T: ManifestHttpTransport>(
    transport: &T,
) -> Result<UpdateManifest, ManifestProviderError>;
```

実際の Rust の field visibility / transport library は coding task で選べるが、次の入力・出力境界は変えない。

- `ManifestHttpRequest` は固定 URL、15 秒 deadline、5 redirect、1 MiB body cap、許可 content type を transport に渡す。real transport は HTTPS / TLS / redirect / size / timeout を enforce し、fake transport で同じ境界を再現できるようにする。
- `ManifestHttpResponse` は status、content type、body bytes（必要なら最終 URL / redirect trace を内部検証用に含める）だけを返す。GitHub API の release object、raw response、release notes は型にしない。
- `fetch_manifest` は final HTTP response の policy check、UTF-8 decode、既存 `parse_manifest` 呼び出しだけを行い、`UpdateManifest` を返す。selection、download、SHA-256、署名暗号検証、state write、UI dispatch は行わない。
- package URL の redirect / archive bytes は次の download task の責務。provider discovery は package URL の network request を発生させない。
- provider function 自体は state / UI を mutate しない。既存の background check caller が `begin_check` 後に呼び出す。

推奨する crate-private error categories は次のとおりで、state / UI に返す文字列は固定 code のみとする。status code、URL、response body、serde の詳細、token を update-state や UI に載せない。

| provider error category | update-state `failure.code` |
|---|---|
| transport / TLS / DNS / connection | `provider-network` |
| deadline exceeded | `provider-timeout` |
| invalid / unsafe / looped / excessive redirect | `provider-redirect` |
| final status != 200 | `provider-http-status` |
| missing / unsupported content type | `provider-content-type` |
| empty body | `provider-empty-response` |
| body cap exceeded | `provider-response-too-large` |
| invalid UTF-8 / unsupported encoding | `provider-invalid-encoding` |
| malformed JSON | `provider-invalid-json` |
| existing manifest validator failure | `provider-invalid-manifest` |
| impossible compile-time provider configuration / internal boundary | `provider-internal` |

### 5. update-state / UI への接続点

既存 `update_state.rs` を再実装せず、呼び出し側は次の順序だけを接続する。

1. 起動後の非同期 check または Updates の手動 check で `begin_check(CheckTrigger::Automatic | Manual, now)` を呼ぶ。`Suppressed`（自動の24時間未満）または `AlreadyChecking` なら provider を呼ばない。自動確認は `AUTO_CHECK_INTERVAL_SECONDS = 24 * 60 * 60` を変更しない。
2. `Started` のときだけ固定 provider を一度呼ぶ。成功した manifest を既存 `select_update` へ渡す。
3. `NoUpdate` は `record_no_update()`。valid empty manifest / valid non-target-only manifest を failure にしない。
4. `Selected(release)` は `PendingUpdate::new` に `version`、`channel`、`architecture`、`artifact.artifact_id`、`VerificationState::NotVerified`、discovered timestamp を渡して `record_available()`。URL は既存 state 契約どおり保存しない。package verification task が後で verification state を進める。
5. provider error は `record_failure(fixed_code, retry_at)` に渡す。`retry_at` は check start 時刻 + `AUTO_CHECK_INTERVAL_SECONDS`（正確に24時間）とし、自動確認の上限を維持する。手動確認はこの制限を bypass できる既存契約を使う。
6. `Failed` は「更新あり」や「更新なし」へ変換せず、現行版をそのまま利用可能にする。Settings UI は既存 state snapshot の `Failed` / sanitized code を入口に generic provider error と retry action を表示するだけで、UI 設計・bridge schema はこの task の対象外とする。

state の atomic write / schema / notification suppression、UI の表示文言、未保存 update dialog は既存実装・別 task の責務であり、この provider task から変更しない。state write 自体の failure は provider error と混同せず、既存 state storage failure handling に委ねる。

### 6. fixture / test 観点

次 task は外部 GitHub に接続せず、fake `ManifestHttpTransport` と fixture で確認する。追加候補は `test/desktop/desktop-update-provider.test.js`（固定 URL / no API static contract）と Rust unit tests（transport policy / parse boundary）である。

最低限必要なケースは次のとおり。

- fixed URL が owner、repository、`releases/latest/download`、exact asset name と一致し、`api.github.com`、`raw.githubusercontent.com`、tag discovery、dynamic env/config、token/query fallback が存在しない。
- final 200 + `application/json`、final 200 + `application/json; charset=utf-8`、final 200 + `application/octet-stream` が valid UTF-8 manifest を返す。
- 200 以外（204 / 206 / 304 / 404 / 500）、missing / wrong Content-Type、empty body、whitespace-only invalid JSON を fail closed にする。
- `Content-Length` over cap、exactly 1 MiB、streamed body 1 MiB + 1、timeout / network / TLS error を分類する。
- HTTPS の 301 / 302 / 303 / 307 / 308 chain を最大 5 hop まで受け、missing Location、6 hop、loop、HTTP downgrade、non-HTTPS scheme、userinfo、client-auth query を拒否する。provider-generated opaque redirect query は state に漏らさない。
- invalid UTF-8、malformed JSON、BOM を含む不正入力を parse failure にする。
- 既存 manifest fixture で、valid target、empty `releases[]`、valid non-target-only、unknown root / release / artifact / signature field、product mismatch、unsupported schema、missing required field、invalid artifact URL / digest / proof、duplicate target を区別する。schema failure は manifest 全体拒否、valid non-target-only は NoUpdate とする。
- `UpdateStateStore` の既存 test と接続した場合、automatic suppressed / manual allowed / concurrent checking / failure code sanitization / no raw body or URL persistence を確認する。既存 state test を置き換えない。
- provider discovery の成功が package download / signature verification / apply を開始しないこと、provider error が `Available` を作らないことを static / unit boundary で確認する。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 既存の未コミット変更・未追跡 Desktop Alpha 変更を確認し、戻していない |
| repository 名確認 | PASS | local `remote.origin.url` の owner/repository 部分だけを確認し `ka-akehi/Cornell-Method` と確定 |
| 対象文書・source・test の read-only 調査 | PASS | `sed`、`rg`、`wc`、`find` のみ。GitHub / network / 外部 service へ接続していない |
| コード / 設定 / 依存 / lockfile / 既存 test / 生成物の変更 | PASS | 変更なし。成果物は本 summary のみ |
| lint / build / cargo test | NOT RUN | 仕様詰めのみでコード変更がなく、生成物を増やさないため未実行 |
| online GitHub redirect / content-type 実測 | NOT RUN | task 制約のため未接続。fake transport fixture で次 task が確認する |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | `.app archive` の具体的な拡張子、署名アルゴリズム / encoding / canonicalization / 公開鍵値 | package download / signature verification task。既存の `app-archive`、`keyId`、`proof` は変更しない |
| U-002 | minimum macOS / deployment target、staging layout、backup retention、apply / rollback の細則 | 既存 Desktop Alpha 後続 task。provider discovery は `minVersion` / `maxVersionExclusive` の既存境界だけを使う |
| U-003 | 実 GitHub CDN の redirect hop 数と最終 content-type の online 実測 | 外部接続を許可した packaged / online QA。今回の実装契約は HTTPS-only、5 hop、JSON/octet-stream allowlist で先に固定済み |
| U-004 | 使用する Rust HTTP library / dependency | 次の coding task の実装判断。`ManifestHttpTransport` を注入可能にし、provider contract と library 選択を分離する |

## Next Read

次の coding task では以下だけを起点に読む。

- `summary/20260823/0012-specify-desktop-update-provider-discovery-20260823.md`
- `src-tauri/src/update_manifest.rs` の `parse_manifest` / `HttpsUrl`
- `src-tauri/src/update_selection.rs` の `select_update`
- `src-tauri/src/update_state.rs` の `begin_check` / `record_*`
- `test/desktop/desktop-update-manifest.test.js`
- `test/desktop/desktop-update-selection.test.js`
