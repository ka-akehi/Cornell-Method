---
summary_type: task-summary
created_at: 2026-08-23 03:12 JST
task_kind: worker-task
task_status: done
---

## Objective

Desktop Alpha の manifest schemaVersion 1 と archive 契約を維持したまま、後続の package verification 実装が追加質問なしで進められる署名契約を 1 つに固定する。

成果物は署名方式、proof の wire 表現、canonical payload、trust store、鍵ローテーション、fail-closed error boundary、release tooling とアプリの責務分担を記録した本 summary だけとする。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Apple Silicon (`aarch64-apple-darwin`) 向け `.app.tar.gz` package の署名・SHA-256 検証 |
| 対象ファイル / ディレクトリ | `doc/implementation/MVP_CONTRACT.md` §9.4〜§9.4.1、`doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`、`src-tauri/src/update_manifest.rs`、`src-tauri/src/update_selection.rs`、`src-tauri/src/update_state.rs`、`src-tauri/src/update_provider.rs`、`src-tauri/Cargo.toml`、archive 契約 summary、既存 update summary、`summary/README.md`、`summary/task-summary-template.md` |
| 対象外 | GitHub、Release、manifest publish、package download、archive 展開、install、apply、restart、rollback 実行、秘密鍵・実公開鍵値の作成・保存・出力 |
| 変更許可 | `summary/20260823/` の新規詳細 summary だけ |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | Desktop update の provider、manifest、selection、state の実装済み範囲と signature verification 未実装の境界 |
| canonical contract | `doc/implementation/MVP_CONTRACT.md` §9.4〜§9.4.1 | `schemaVersion: 1`、product ID、stable、Apple Silicon、`app-archive`、artifact fields、`keyId` / `proof`、URL policy、fail-closed の既存境界 |
| technical contract | `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md` の update 節 | provider-neutral manifest、staging、offline/local-first、current/next key、SHA-256 と公開鍵署名の承認済み境界 |
| archive contract | `summary/20260823/0259-specify-desktop-app-archive-contract.md`、`summary/20260823/0304-specify-desktop-update-archive-format-20260823-80bafde6-summary.md` | gzip 圧縮 POSIX tar、単一 `.app` root、`.app.tar.gz`、圧縮 archive bytes に対する `sizeBytes` / `sha256`、download と extraction の分離 |
| manifest model | `src-tauri/src/update_manifest.rs` | `UpdateManifest`、`UpdateRelease`、`UpdateArtifact`、`UpdateSignature` の型、SemVer / macOS version の正規化、strict unknown-field validation |
| selection model | `src-tauri/src/update_selection.rs` | `stable`、`aarch64-apple-darwin`、`app-archive`、current version より新しい最高 SemVer のみを選ぶ境界。downgrade は選択しない |
| persisted state | `src-tauri/src/update_state.rs` | `NotVerified` / `Verified` / `Failed`、`Available` と `Failed` の遷移、sanitized failure code、atomic state write、現行 state が signature payload を保存しないこと |
| provider | `src-tauri/src/update_provider.rs` | 固定 GitHub manifest URL、HTTPS redirect、manifest Content-Type、provider error code、package download と signature verification が未接続であること |
| dependency inventory | `src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` | 直接の暗号・hash 依存はなく、lockfile には `ring`、`sha2`、`base64` が推移依存として存在すること。今回の変更は依存関係へ加えていない |
| existing summaries | `summary/20260822/2058-specify-desktop-update-manifest-schema-20260822-e4b0fe2f-summary.md`、`summary/20260822/2357-select-compatible-desktop-release-20260822-ae216a28-summary.md`、`summary/20260823/0048-implement-desktop-update-provider-20260823-ad5deb22-summary.md`、`summary/20260823/0106-implement-desktop-update-check-orchestrator-20260823-356b5085-summary.md`、`summary/20260823/0133-implement-desktop-update-startup-check-20260823-dad75600-summary.md` | manifest の初期承認、provider / selection / state の責務、後続 task の分割状況 |
| summary operation | `summary/README.md`、`summary/task-summary-template.md`、`tools/check-summary.sh` | summary の必須見出し、raw log を転記しない方針、`Next Read`、検証方法 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260823/0312-specify-desktop-update-signature-contract.md` | 署名方式、proof encoding、trusted key lookup、canonical byte schema、domain separation、error matrix、rotation、後続 task、検証結果を記録 | 次の署名検証実装と release-side signing fixture を同じ wire contract で進めるため |
| 製品コード、設定、依存関係、lockfile、既存仕様書本文、既存テスト、生成物 | 変更なし | 仕様調査 task の制約を維持するため |

## Findings

### 1. 採用する署名契約

| 項目 | 採用値 |
|---|---|
| 署名方式 | Pure Ed25519。Ed25519ph、Ed25519ctx、ECDSA、RSA-PSS は使わない |
| 署名対象 | 下記の domain-separated canonical bytes。package の raw bytes そのものではなく、package の SHA-256 と release metadata をまとめて署名する |
| signature の形式 | detached signature。manifest の `signature` object は `keyId` と `proof` の 2 field のまま維持する |
| proof | 64 byte の Ed25519 signature を RFC 4648 base64url の padding なしで表す。ASCII 以外、空白、`=`、不正文字、decoded length が 64 byte でない値は拒否する |
| package integrity | 圧縮された `.app.tar.gz` の wire bytes の実 byte count と SHA-256 を確認する。展開後 directory のサイズや hash は manifest `sizeBytes` / `sha256` に使わない |
| verifier の実装候補 | アプリ側は `ring` の Ed25519 verification API を推奨する。release tooling は標準 Ed25519 を実装する別言語・別ライブラリを使えるが、下記の bytes と fixture で相互運用を確認する |
| trust root | アプリ bundle に compile-time で埋め込む trusted key table。manifest、package、URL、redirect response から公開鍵や trust root を追加しない |
| 検証場所 | package bytes と manifest が取得済みなら offline で完了する純粋な verification boundary。verifier 自身は network、GitHub、filesystem path discovery を行わない |

Ed25519 を採用する理由は、Apple Silicon の個人向け更新で必要な署名サイズと verification cost が小さく、公開鍵と署名の wire 表現が固定長で、DER / ASN.1 / low-S / padding parameter の選択を持たないためである。

| 候補 | 公開鍵 / 署名サイズ | Rust 実装と速度 | 運用上の評価 | 判定 |
|---|---|---|---|---|
| Ed25519 | 32 byte / 64 byte | `ring` または `ed25519-dalek` で検証でき、更新時に 1 回程度の verification には十分高速 | key ID、proof、fixture の形式を固定しやすい。current / next の table lookup と相性がよい | 採用 |
| ECDSA P-256 | compressed 33 byte または uncompressed 65 byte。signature は DER なら可変長、raw なら別の encoding 規約が必要 | Rust では `p256` / `ecdsa` などの依存と signature encoding の選択が必要。verification は十分速いが、固定長契約を別途作る必要がある | DER、低い S 値、compressed key の選択を release tooling とアプリで一致させる必要があり、failure surface が増える | 却下 |
| RSA-PSS | 2048 bit でも signature 256 byte。公開鍵と padding parameter も大きい | Rust の RSA 実装と hash / salt length policy が必要。Ed25519 より package metadata が大きく、verification も重い | key rotation は可能だが、Alpha の小さい detached proof に対する利点がない | 却下 |

現在の lockfile にある `ring`、`base64`、`sha2` は直接依存ではないため、後続 coding task で使用する場合は `Cargo.toml` に明示的な direct dependency を追加し、lockfile を更新する必要がある。今回その変更は行っていない。依存を既存 lockfile の推移依存だけに頼らない。

### 2. keyId とアプリ内 trust store

#### keyId の形式

`keyId` は次の文字列形式に固定する。

```text
cmn-ed25519-v1-<64 lowercase hexadecimal characters>
```

suffix は、trusted key の raw 32 byte Ed25519 public key に対する SHA-256 の lowercase hexadecimal 表現である。

- 形式検査は ASCII の prefix、suffix の長さ、lowercase hexadecimal に限定する。
- lookup は `keyId` 全体の exact byte match とする。trim、Unicode normalization、case folding、別名、prefix だけの match は許可しない。
- suffix の fingerprint は key の識別補助であり、trust root ではない。lookup の候補はアプリに埋め込まれた table に限る。
- `keyId` の再利用は禁止する。鍵を retired / revoked から再利用しない。
- manifest の `keyId` が well-formed でも table にない場合は unknown key として fail closed にする。

#### 公開鍵のアプリ内表現

manifest に公開鍵 field を追加しない。アプリ側の table は次の論理情報を持つ。

```text
TrustedUpdateKey {
  key_id: "cmn-ed25519-v1-<fingerprint>",
  public_key: <32 raw bytes, source/fixture representation is 64 lowercase hex chars>,
  status: current | next | retired | revoked
}
```

PEM、DER、SPKI、URL、manifest 内の base64 public key は使わない。Rust source では 32 byte raw key を 64 文字の lowercase hex literal から decode する形式を推奨する。実際の key value はこの summary、fixture、manifest に記載しない。

1 つの app build では active な `current` を 1 個、`next` は 0 個または 1 個とする。verification は `current` と `next` だけを許可し、`retired` と `revoked` は許可しない。

#### current / next のローテーション

1. app version N に `K_current` と次期 `K_next` を埋め込む。
2. 通常の release は `K_current` で署名する。`K_next` で署名する release は、対象 app version に `K_next` がすでに埋め込まれていることを release operator が確認してから切り替える。
3. 次の app version で `K_next` を `current` に昇格し、新しい `K_next2` を table に追加する。table の変更自体は、旧 current または旧 next のうち、その app が受け入れる active key で署名された app update によって届ける。
4. retired は新しい package の署名に使わない。revoked は侵害・誤発行を理由に即時拒否し、staging 済み package も apply 前に再検証して拒否する。
5. manifest から key の昇格、追加、失効、期限延長を指示できない。online CRL、remote key list、manifest の `publicKey` field は契約に含めない。

この方式は、侵害された current key だけでは古い app へ失効通知を安全に届けられないという制約を持つ。next key が配布済みの app へ next 署名の release を届けられる場合は切り替えられる。next を持たない古い app には、別の配布経路または手動 DMG 更新が必要になる。今回の Alpha 契約では emergency recovery の配布経路を追加しない。

### 3. proof の wire encoding

`signature.proof` は次の一意な encoding とする。

```text
proof = base64url_no_padding(Ed25519Signature[64])
```

検証側の受け入れ条件は以下のとおり。

- RFC 4648 base64url の alphabet `A-Z a-z 0-9 - _` だけを許可する。
- padding `=`、空白、改行、先頭末尾の trim、URL percent encoding、JSON object、algorithm 名の prefix、複数 signature の配列を許可しない。
- decoded bytes は 64 byte に一致しなければならない。
- 最終 base64 quantum の未使用 bit が 0 でない非 canonical 表現を拒否する。
- proof の decoding 後、trusted key の status を確認してから Ed25519 verify を行う。
- proof が短い、長い、壊れている場合は `signature-proof-encoding`。decoded 64 byte が payload に対して検証できない場合は `signature-proof-mismatch` とする。

proof に payload version や key bytes を埋め込まない。algorithm と payload version はアプリの固定 verifier contract と domain bytes から決まり、manifest schema の field 数は増えない。

### 4. canonical signed payload

#### domain separation と version

payload の先頭は次の固定 ASCII bytes とする。末尾の NUL byte も含める。

```text
com.cornellmethod.notebook/desktop-update-signature/ed25519\0
```

domain の直後に payload version `0x01` を置く。domain は別の製品、別の operation、別の署名 algorithm の bytes を Ed25519 proof として誤用しないために必要である。payload version は field order、length encoding、Unicode、digest 表現を含む signed-byte schema の version である。

#### schemaVersion と payload version の関係

manifest root の `schemaVersion: 1` と signature payload version `1` は別 namespace である。

| version | 管理対象 | 現行 verifier の扱い |
|---|---|---|
| manifest schemaVersion | JSON envelope、field allowlist、provider-neutral manifest の形 | `1` だけを受け付ける。未知 version は manifest 全体を拒否 |
| signature payload version | domain、field order、length prefix、数値・文字列の byte encoding | `1` の bytes だけを作る。別 version の fallback や JSON serialization の試行はしない |

現行の組み合わせは manifest schema `1` と payload `1` である。JSON field の追加・変更は manifest schema version の判断、signed bytes の変更は payload version の判断で行う。片方の version をもう片方の代わりに解釈しない。proof 自体には version field がないため、将来 version を追加する場合は新しい app verifier と release tooling を同時に用意し、旧 verifier が別 canonicalizer を推測しない設計にする。

#### binary payload の exact schema

payload は JSON 文字列ではなく、次の固定順 binary bytes とする。

```text
DOMAIN_BYTES
|| U8_BE(1)                              // signature payload version
|| U32_BE(1)                             // manifest schemaVersion
|| LP32_BE(productId UTF-8 bytes)
|| LP32_BE(canonical release version UTF-8 bytes)
|| LP32_BE(channel UTF-8 bytes)
|| LP32_BE(architecture UTF-8 bytes)
|| LP32_BE(canonical minVersion UTF-8 bytes)
|| U8(0x00 or 0x01)                      // maxVersionExclusive present flag
|| [LP32_BE(canonical maxVersionExclusive UTF-8 bytes) if flag is 0x01]
|| LP32_BE(artifactId UTF-8 bytes)
|| LP32_BE(format UTF-8 bytes)
|| U64_BE(sizeBytes)
|| SHA256_RAW[32]                        // lowercase hex manifest value decoded to 32 bytes
```

`LP32_BE(value)` は 4 byte unsigned big-endian byte length と、その長さの bytes を連結する。length が `u32` に収まらない値、文字列の truncation、implicit terminator、field の省略は拒否する。全 payload の integer encoding は big-endian とする。

署名対象に含める項目は次のとおりである。

- product ID
- release version
- channel
- architecture
- minVersion と maxVersionExclusive の有無・値
- artifact ID
- format
- sizeBytes
- SHA-256 の raw 32 bytes

`keyId` は payload field に含めない。`keyId` は embedded table から検証鍵を選ぶ lookup key であり、proof は選ばれた public key に対して検証されるため、keyId と proof の組み合わせは検証時に cryptographically binding される。payload に keyId を入れないことで、同じ package の再署名では artifact payload bytes を変えずに active key と proof だけを置き換えられる。keyId と proof の不一致、または table の fingerprint と raw public key の不一致は lookup / verification failure として拒否する。

`url` は署名対象に含めない。URL は GitHub CDN redirect、asset mirror、provider adapter の locator であり、同じ package bytes を別の HTTPS locator から取得できるようにする必要がある。package の同一性は `artifactId`、`sizeBytes`、SHA-256、Ed25519 proof の組み合わせで固定できる。URL が別の package を返せば size または digest が一致せず、proof も package digest に対応しないため verified にならない。URL は署名対象外でも、manifest validation の HTTPS、credential / token query、redirect downgrade の制約を受ける。URL の変更による availability failure は、package authenticity の成立とは別の問題として扱う。

#### canonicalization の規則

- canonicalizer は raw JSON、JSON whitespace、object key order、JSON escape の表現を読まず、strict parser が作った `UpdateManifest` と `UpdateRelease` の typed values だけを読む。
- product ID、channel、architecture、artifact ID、format は decoded Unicode scalar sequence を UTF-8 にする。Unicode NFC/NFD normalization、case folding、trim、空白の圧縮は行わない。既知の target 値は ASCII である。
- release version は既存 `SemVer` の normalized serialization を使う。core の numeric component、prerelease、build metadata を順序固定で出力し、build metadata は SemVer precedence には使わなくても signed metadata には含める。
- macOS version は既存 `MacOsVersion` の normalized serialization を使う。先頭 zero を取り除き、末尾の zero component を規定どおり縮約する。maxVersionExclusive の absent と present は presence byte で区別する。
- sizeBytes は JSON の表記を再シリアライズせず、typed `u64` を U64_BE にする。JSON の key order、whitespace、整数表現の差は payload に影響しない。
- sha256 は strict manifest validation 済み lowercase hex を 32 raw bytes に decode する。ASCII の 64 byte hex string を署名対象にはしない。
- canonicalizer は URL、filename、Content-Disposition、HTTP Content-Type、release notes、provider response、local path を参照しない。

#### canonical payload の placeholder 例

以下は非秘密の placeholder だけを使った入力例である。`PUBLIC_KEY`、digest、proof の実値は作成・記載しない。

```json
{
  "manifestSchemaVersion": 1,
  "productId": "com.cornellmethod.notebook",
  "version": "1.2.3",
  "channel": "stable",
  "architecture": "aarch64-apple-darwin",
  "minVersion": "14",
  "maxVersionExclusive": "15",
  "artifactId": "artifact-placeholder-001",
  "format": "app-archive",
  "sizeBytes": 123456,
  "sha256": "<64 lowercase hex placeholder>"
}
```

この入力から作る bytes は次の記法で表す。`LP32_BE` の実 length は実装が UTF-8 byte length から計算する。

```text
ASCII("com.cornellmethod.notebook/desktop-update-signature/ed25519\0")
|| 01
|| 00 00 00 01
|| LP32_BE("com.cornellmethod.notebook")
|| LP32_BE("1.2.3")
|| LP32_BE("stable")
|| LP32_BE("aarch64-apple-darwin")
|| LP32_BE("14")
|| 01
|| LP32_BE("15")
|| LP32_BE("artifact-placeholder-001")
|| LP32_BE("app-archive")
|| U64_BE(123456)
|| <32 raw digest bytes placeholder>
```

対応する manifest の署名 field は次の形だけを取る。

```text
keyId: cmn-ed25519-v1-<64 lowercase hex characters>
proof: <86-character unpadded base64url placeholder>
```

64 byte signature の unpadded base64url は 86 文字になる。上記 placeholder は長さ規則の説明であり、検証可能な production key または signature vector ではない。

### 5. verification input と処理順

後続 verifier は、重複した release metadata DTO を作らず、次の logical input を受け取る。

```text
verify_selected_package(
  manifest_root: UpdateManifest,
  selected_release: UpdateRelease,
  actual_size_bytes: u64,
  actual_sha256: [u8; 32],
  trust_store: EmbeddedTrustedKeyStore,
) -> Result<VerifiedSignature, SignatureVerificationError>
```

`manifest_root` から product ID と manifest schema version、`selected_release` から release metadata と `keyId` / `proof` を取り、actual package evidence を download layer から受け取る。URL は download layer に残し、verifier input に入れない。

推奨順序は以下である。

1. 既存 manifest parser と compatible selection が成功していること、target が stable / Apple Silicon / `app-archive` であることを確認する。
2. `keyId` の形式を検査し、embedded table を exact lookup する。unknown、retired、revoked は package を取得または verified 扱いにしない。
3. package stream の actual byte count を hard cap、manifest `sizeBytes` と照合する。
4. 圧縮 archive の raw bytes から SHA-256 を計算し、manifest `sha256` と exact match させる。ここで mismatch なら canonical payload と proof の判定へ進まない。
5. typed manifest / release values と actual digest を canonical payload v1 へ encode する。JSON serializer、URL、filename は使わない。
6. proof を strict base64url decode し、active trusted key で Pure Ed25519 verify する。
7. size、digest、proof が全て成功するまで gzip / tar を開かない。archive contract の preflight と no-follow extraction は signature verifier の後段で実施する。
8. staging 後の apply 前にも package bytes、key status、payload、proof を再検証する。persisted の `Verified` flag だけを信頼しない。key revocation と staging tampering を反映するためである。

package の signature verification 成功は bundle の version / identifier / arm64 検証を省略する理由にならない。archive summary の post-extraction checks が selected release と bundle metadata を照合し、異なる場合は signed metadata mismatch として verified bundle を返さない。

### 6. release tooling とアプリの責務境界

#### release-side signing tooling

- Tauri の Apple Silicon `.app` output から archive contract に従う単一 root の `.app.tar.gz` を作る。
- 完成した圧縮 archive bytes の `sizeBytes` と SHA-256 を計算する。展開後 app directory の hash を manifest digest にしない。
- product ID、version、channel、architecture、macOS range、artifact ID、format、sizeBytes、SHA-256 を typed な release input として canonical payload v1 に encode する。
- active な key の `keyId` を選び、対応する Ed25519 private key で detached signature を作り、strict base64url no-padding で proof を出力する。
- manifest の `keyId` と `proof` 以外の field を署名後に変更しない。URL は変更できる locator だが、package bytes、digest、size、signed metadata は変更しない。
- same package の re-sign は、artifactId、version、format、sizeBytes、sha256、release metadata を保持し、keyId / proof だけを active key に置き換える。manifest 内に同じ target の旧 proof と新 proof を同時に置かない。
- private key は CI の secret store または release operator の offline signing environment の境界に残す。repository、manifest、package、app bundle、log に出力しない。

#### app-side verification

- provider が返した manifest を既存 strict parser で検証し、selection が返した `UpdateRelease` だけを verifier に渡す。
- embedded trust table から `keyId` を解決し、public key bytes を manifest / package から補充しない。
- package stream の size、SHA-256、proof、canonical payload を順に検証する。検証中に package を install、apply、restart しない。
- digest または proof が失敗した package を `Verified`、installable、trusted、available-for-apply として扱わない。
- failure は fixed internal code から sanitized persisted code と UI message へ map する。raw proof、public key、canonical bytes、URL、filesystem absolute path、HTTP response body は state / UI に出さない。
- apply pipeline は別 task とし、検証済み package、DB staging、old bundle retention、health check、rollback の契約へ接続する。

### 7. fail-closed error matrix

内部 error code は固定 lowercase code とする。すべての行で temporary download、partial extraction、verified marker を破棄または無効化し、current app、live DB、app-managed backup を維持する。

| 条件 | internal code | persisted mapping | UI / state | 内部ログ |
|---|---|---|---|---|
| `keyId` の prefix、長さ、hex 形式が不正 | `signature-key-id-malformed` | `update-signature-key` | `Failed`。鍵情報を表示せず、更新検証失敗の一般文言 | fixed code、selected version、channel、architecture、artifactId まで。key bytes / proof は記録しない |
| 形式は正しいが embedded table に存在しない | `signature-key-unknown` | `update-signature-key` | `Failed`。manifest の keyId を trust root として追加しない | code と keyId の非秘密な識別子まで。public key bytes は記録しない |
| embedded key が retired | `signature-key-retired` | `update-signature-key` | `Failed`。古い鍵の package を verified にしない | code、keyId、key status、release identity |
| embedded key が revoked | `signature-key-revoked` | `update-signature-key` | `Failed`。staged package も apply 前に拒否 | code、keyId、key status、release identity |
| proof が base64url 規則に違反、padding / whitespace / decoded length 不正 | `signature-proof-encoding` | `update-signature-proof` | `Failed`。proof 本体を表示・保存しない | code、proof length、release identity。proof bytes は記録しない |
| domain、payload version、typed value、UTF-8 length、digest decode の canonical payload を構築できない | `signature-canonical-payload` | `update-signature-canonical` | `Failed`。別 serializer / legacy canonicalizer を試さない | code、payload version、field 名の分類まで。canonical bytes は記録しない |
| payload は構築できるが Ed25519 verification が false | `signature-proof-mismatch` | `update-signature-proof` | `Failed`。package は verified 扱いにしない | code、keyId、release identity、expected digest の非秘密な値まで。proof は記録しない |
| actual compressed bytes の SHA-256 が manifest `sha256` と不一致 | `package-digest-mismatch` | `update-integrity` | `Failed`。proof 判定・展開・apply を行わない | code、expected / actual digest、byte count、release identity |
| actual byte count が `sizeBytes` と不一致、または hard cap 超過 | `package-size-mismatch` | `update-integrity` | `Failed`。archive を開かず temp を削除 | code、expected / actual size、release identity |
| selected release と canonicalizer input、または展開後 bundle の product ID / version / architecture / format が不一致 | `signature-metadata-mismatch` | `update-signature-metadata` | `Failed`。bundle を verified app として返さない | code、比較した field 名、期待値と実値の安全な要約。raw archive path / URL は記録しない |
| manifest schema 1、target、format、URL policy の既存 validation failure | `provider-invalid-manifest` または既存 selection code | `update-manifest` または `update-selection` | manifest / candidate を採用しない | 既存 provider / selection boundary に従う |

「canonical payload mismatch」は signer と verifier が JSON の key order や whitespace を違う形で扱う意味ではない。現行契約では JSON 表現を payload に入れない。typed values から固定 binary payload を作れない場合を `signature-canonical-payload`、固定 payload に対する signature が false の場合を `signature-proof-mismatch` とする。canonicalizer の代替実装を順番に試す動作は入れない。

UI と persisted state の境界は次のとおりとする。

- `UpdateState.status` は `Failed`。`pending_update` を installable な結果として残さず、`VerificationState::Verified` へ遷移させない。
- `UpdateFailure.code` には上表の sanitized mapping だけを保存する。現在の `update_state.rs` の lowercase code validation と atomic write を使い、proof、payload、public key、URL、response body、user data、absolute path は保存しない。
- UI は「更新 package の検証に失敗したため、現在のアプリを維持しました」相当の一般文言と再試行導線だけを出す。keyId、proof、trusted key table、digest の実値、内部 path、provider response は出さない。selected version / artifact の表示は既存の update UI 契約が許す範囲に限る。
- local diagnostic log は上表の fixed code、release identity、key status、expected / actual size、expected / actual digest のような非秘密の検証情報まで許可する。proof、private key、public key raw bytes、canonical payload raw bytes、URL query、HTTP body、ノート本文、SQLite、backup は記録しない。

### 8. 同じ package の再署名、失効、rollback、downgrade

| 操作 | 契約 |
|---|---|
| 同じ package の再署名 | 圧縮 archive bytes と artifactId、sizeBytes、sha256、version、channel、architecture、macOS range、format を保持する。manifest の対象 release を 1 件のまま保ち、keyId / proof を active key の組み合わせへ置き換える。旧 proof と新 proof の OR 判定はしない |
| current → next 切替 | next key は app update 前に table へ埋め込む。manifest は table の変更を命令できない。切替後も old app が持つ active next key で検証できる release だけを届ける |
| retired / revoked key | retired は新規 package へ使わず、revoked は既存 staging を含めて拒否する。鍵 status を変更した app は apply 前に proof を再検証する |
| rollback | apply / health check に失敗したとき、既存の current app bundle、live DB、app-managed backup を維持または戻す state recovery。rollback は新しい downgrade package を選ぶ経路ではない |
| downgrade | `update_selection.rs` の current version より高い候補だけという境界を維持する。署名が有効でも version が現行以下の package は selection / apply contract で拒否する |
| manual path | 将来 OS file dialog や手動 package path を追加しても、manifest / target / size / digest / key / proof / version の検証を bypass しない。今回その入口は実装しない |

### 9. 後続 coding task の分割

| 順序 | task | 主な対象ファイル | 完了条件 |
|---:|---|---|---|
| 1 | canonical payload v1 の pure implementation | 新規 `src-tauri/src/update_signature.rs` または `update_signature_payload.rs`、`src-tauri/src/main.rs` は module wiring のみ | `UpdateManifest` + `UpdateRelease` + actual digest から上記 binary bytes を作る。URL / raw JSON / network を参照しない。whitespace、key order、escape、macOS normalization、max presence、size / digest mutation の tests が通る |
| 2 | embedded trust store と strict proof verifier | 同じ signature module、`src-tauri/Cargo.toml`、必要な lockfile、Rust unit test | `keyId` format、exact lookup、current / next acceptance、retired / revoked / unknown、base64url no-padding、64 byte length、Ed25519 valid / invalid を error code 固定で検証する。production key value は fixture と分離する |
| 3 | release-side non-secret signing fixture | `test/desktop/fixtures/update-signature/` または同等の test-only fixture directory、release tooling test script | fixture は manifest release fields、public key raw bytes の placeholder / test-only value、canonical payload bytes、proof、expected result だけを持つ。private key を repository に保存しない。Rust verifier が fixture の valid vector を受け、各 mutation が matrix の code になる |
| 4 | archive download と integrity bridge | 新規 `src-tauri/src/update_download.rs` または archive module、`src-tauri/src/update_provider.rs` は transport wiring に限定 | `.app.tar.gz` の streaming byte count、hard cap、SHA-256、signature verifier を接続する。digest / size / signature がそろうまで gzip / tar を開かない。HTTPS redirect、Content-Type、temp cleanup を archive contract と一致させる |
| 5 | extraction / bundle metadata bridge | archive summary が指定した新規 archive module、既存 `update_selection.rs` は変更を最小化 | verified raw archive だけを展開し、single `.app` root、Info.plist、bundle identifier、selected version、arm64、permission / symlink / bomb を確認する。apply / restart / rollback は呼ばない |
| 6 | update state と UI error mapping | `src-tauri/src/update_state.rs`、既存 update command / settings bridge、desktop tests | verification failure を `Failed` と sanitized code に map し、`Verified` を早期に設定しない。UI / persisted state に raw proof、key bytes、payload、URL、user data が出ない。既存 `Available` / `NotVerified` semantics を破壊しない |
| 7 | packaged Apple Silicon QA | disposable fixture、Tauri packaging environment、既存 archive QA boundary | 実 `.app.tar.gz` の raw size / digest、signing fixture、round-trip extraction、arm64-only、metadata mismatch、current app / live DB 維持を確認する。GitHub Release の公開・download は別承認後に行う |

実装順は 1 → 2 → 3 を先に固定し、4 と 5 を archive contract に接続し、6、7 を最後に行う。署名 module の trait は release tooling の filesystem / network を受け取らず、次のような純粋な入力境界を保つ。

```text
verify_selected_package(manifest, selected_release, actual_size, actual_sha256, trust_store)
```

### 10. 非秘密 test fixture の形式

後続の fixture は次の field だけを持つ JSON または同等の text fixture とする。

```json
{
  "fixtureVersion": 1,
  "manifestSchemaVersion": 1,
  "payloadVersion": 1,
  "release": {
    "productId": "com.cornellmethod.notebook",
    "version": "<semver placeholder>",
    "channel": "stable",
    "architecture": "aarch64-apple-darwin",
    "minVersion": "<macOS version placeholder>",
    "maxVersionExclusive": "<optional placeholder>",
    "artifactId": "<opaque artifact placeholder>",
    "format": "app-archive",
    "sizeBytes": 123456,
    "sha256": "<64 lowercase hex placeholder>"
  },
  "keyId": "cmn-ed25519-v1-<64 lowercase hex characters>",
  "publicKeyHex": "<64 hex characters, non-production fixture value>",
  "canonicalPayloadHex": "<payload bytes generated by the v1 encoder>",
  "proof": "<unpadded base64url signature>",
  "expected": "valid"
}
```

invalid fixture は private key を持たず、valid fixture の release field 1 個、digest、size、keyId、proof、payload version、payload byte を test runtime で 1 箇所だけ mutate する。fixture に private key、production key、URL credential、user data、SQLite、archive bytes を入れない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 既存の modified / deleted / untracked files を確認し、ユーザーの変更を保持した |
| handoff、契約、archive summary、既存 update source の read-only 照合 | PASS | `sed`、`rg`、`wc`、`date` のみ。provider、manifest、selection、state の境界を署名契約へ対応付けた |
| `src-tauri/Cargo.toml` の暗号・hash 依存棚卸し | PASS | 直接依存は未追加。lockfile の `ring`、`sha2`、`base64` は推移依存として確認した |
| 実際の秘密鍵・公開鍵値の生成・保存・出力 | NOT RUN | placeholder のみを summary に記録した |
| GitHub / network / Release / manifest / package download | NOT RUN | task 制約を維持した |
| package 展開、install、apply、restart、rollback | NOT RUN | archive / lifecycle 実装 task の対象外 |
| code、設定、依存関係、lockfile、既存仕様書本文、既存テスト、生成物の変更 | PASS | 新規 summary 以外の製品側変更を行っていない |
| `git diff --check` | PASS | 作業後に実行し、既存 worktree と今回の作業範囲に whitespace error は報告されなかった |
| `sh tools/check-summary.sh summary/20260823/0312-specify-desktop-update-signature-contract.md` | PASS | 必須 summary headings、競合 marker、summary 配下を確認した |
| Rust / Node test、lint、build | NOT RUN | 実装・依存変更がない仕様 task のため実行していない。後続 coding task で fixture と verifier の unit test を追加する |
| 作業後 `git status --short` | PASS | 既存差分に加わった成果物は本 summary だけであることを確認した |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 実際の production public key、private key の保管先、CI / offline signing operator の承認手順 | release tooling と secret management を対象にした別の承認 task。実鍵は repository に置かない |
| U-002 | 後続 coding task で `ring` を使う場合の direct dependency の最終 pin と lockfile 差分 | dependency review と offline `cargo test`。今回の lockfile は変更していない |
| U-003 | 実 Tauri `.app.tar.gz` の bundle metadata と hard cap が初期値に収まるか | Apple Silicon packaging environment の clean build と disposable round-trip fixture |
| U-004 | `UpdateState` に保存する verification metadata の最終 shape | signature verification と state integration の別 task。現行 source は `version`、`channel`、`architecture`、`artifact`、`verificationState`、時刻を持ち、proof / public key / payload は持たない |
| U-005 | current key が侵害された場合に next を持たない旧 app へ emergency recovery を届ける配布経路 | Public Mac Release / manual DMG の security decision。manifest に remote key revocation を追加しない |
| U-006 | 既存 docs の archive extension 表記 | `MVP_CONTRACT.md` と `DESKTOP_ALPHA_TAURI_FOUNDATION.md` の作業ツリー本文にはなお「具体的な拡張子は未決定」という記述がある。一方、owner task の前提と 0259 / 0304 summary は `.app.tar.gz` を採用している。今回の既存仕様書本文変更禁止に従い未修正のため、次の docs sync または Manager 判断で authoritative source を明示する |

## Next Read

署名検証 coding task は次の最小ファイルから読む。

- `summary/20260823/0312-specify-desktop-update-signature-contract.md`
- `summary/20260823/0259-specify-desktop-app-archive-contract.md`
- `src-tauri/src/update_manifest.rs`
- `src-tauri/src/update_selection.rs`
- `src-tauri/src/update_state.rs`
- `src-tauri/src/update_provider.rs`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `test/desktop/desktop-update-manifest.test.js`
- `test/desktop/desktop-update-selection.test.js`
- `test/desktop/desktop-update-state.test.js`

release-side fixture task は本 summary の「非秘密 test fixture の形式」と payload v1 を起点にし、production release、GitHub、秘密鍵へ接続しない disposable fixture harness を先に作る。
