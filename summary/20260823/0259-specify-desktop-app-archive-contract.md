---
summary_type: task-summary
created_at: 2026-08-23 02:59 JST
task_kind: worker-task
task_status: done
---

## Objective

Apple Silicon Desktop Alpha のアプリ内更新 package について、container、filename、MIME、archive root、展開安全性、展開前後の検証境界を次の coding task がそのまま実装できる粒度へ落とす。

初期配布用 DMG とアプリ内更新用の `.app archive` を分離し、既存 manifest の `artifact.format: "app-archive"`、`artifactId`、`sizeBytes`、`sha256`、`signature` fields は変更しない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Tauri/macOS packaging と Apple Silicon `.app archive` の配布、download、staging、extraction、bundle validation 契約 |
| 対象ファイル / ディレクトリ | `src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`package.json`、`src-tauri/src/runtime.rs`、`src-tauri/src/lifecycle.rs`、必要な Tauri packaging source、Desktop Alpha の正本 docs、過去の update summary、`tools/desktop-poc/tauri/scripts/package.cjs` とその test |
| 対象外 | コード、設定、依存関係、lockfile、既存 test、生成物、docs 本文、実 download、署名 algorithm / canonicalization / public key、apply、restart、rollback、GitHub、network、release publish |
| 成果物 | 本 summary のみ。製品コード・設定・仕様書の変更はない |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | Desktop Alpha の実装済み範囲、未実装境界、次 task 順 |
| canonical docs | `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`、`doc/implementation/MVP_CONTRACT.md`、`doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md` | DMG / `.app archive` の役割、`app-archive`、manifest fields、staging、migration、rollback の承認済み境界 |
| current packaging | `src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`package.json` | `productName`、bundle identifier、`targets: ["app", "dmg"]`、Tauri / HTTP 依存、resource layout |
| current runtime | `src-tauri/src/main.rs`、`runtime.rs`、`lifecycle.rs`、`update_manifest.rs`、`update_provider.rs`、`update_selection.rs`、`update_state.rs`、`update_target.rs` | provider / selection / state の既存 interface、Apple Silicon target、sidecar / Application Support 境界、未実装の download / apply 境界 |
| existing tests | `test/desktop/desktop-update-manifest.test.js`、`desktop-update-provider.test.js`、`desktop-update-selection.test.js` | `app-archive`、fixed provider、strict validation、fixture と side effect の境界 |
| prior summaries | `summary/20260822/1503-specify-desktop-update-contract-20260822-fafa5e92-summary.md`、`2058-specify-desktop-update-manifest-schema-20260822-e4b0fe2f-summary.md`、`2323-sync-desktop-update-manifest-validation-contract-20260822.md`、`2357-select-compatible-desktop-release-20260822-ae216a28-summary.md`、`summary/20260823/0012-specify-desktop-update-provider-discovery-20260823.md`、`0016-specify-desktop-update-manifest-discovery-20260823-24f38b95-summary.md`、`0048-implement-desktop-update-provider-20260823-ad5deb22-summary.md`、`0106-implement-desktop-update-check-orchestrator-20260823-356b5085-summary.md`、`0246-verify-desktop-update-manifest-endpoint-20260823-803c1a9c-summary.md` | 既存の provider、manifest、selection、startup/manual check、未決の archive extension と online 検証境界 |
| PoC packaging | `tools/desktop-poc/tauri/scripts/package.cjs`、`tools/desktop-poc/tauri/test/package.test.cjs` | Tauri の `.app` / DMG 分離、symlink を follow しない artifact discovery、`file` による arm64 確認。PoC の metrics/hash は製品 manifest digest と分離 |
| local capability | macOS local command availability の read-only check | `arm64`、macOS、archive / bundle inspection tool の有無。実 bundle build、mount、download は未実施 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| なし（製品側） | コード、設定、依存関係、lockfile、test、生成物、仕様書を変更していない | 仕様詰め・read-only 調査 task の制約 |
| `summary/20260823/0259-specify-desktop-app-archive-contract.md` | 調査結果、採用案、後続 coding interface、error categories、fixtures、未決事項を記録 | 次 task が追加質問なしで実装範囲を確定できるようにするため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 製品 Tauri config は `productName: "Cornell Method Notebook"`、identifier `com.cornellmethod.notebook`、bundle targets `app` / `dmg` を持つ。 | `src-tauri/tauri.conf.json` |
| F-002 | fact | manifest の対象は `stable`、`aarch64-apple-darwin`、`app-archive`。artifact は `artifactId`、`format`、`url`、`sizeBytes`、`sha256`、signature は `keyId`、`proof` を持つ。 | `src-tauri/src/update_manifest.rs`、正本 docs |
| F-003 | fact | 現在の provider / manifest / selection / startup/manual check は package download、archive extraction、signature verification、apply に接続していない。 | `src-tauri/src/update_provider.rs`、`update_check.rs`、`main.rs`、existing summaries |
| F-004 | fact | local Apple Silicon は `arm64`。`tar`、`gzip`、`zip`、`unzip`、`ditto`、`hdiutil`、`codesign`、`plutil`、`file`、`lipo`、`otool` などの macOS tool は利用可能だった。製品側の `cargo tauri` / Tauri CLI は利用できなかった。 | read-only capability check |
| A-001 | assumption | 推奨 container は gzip-compressed POSIX tar、拡張子は `.app.tar.gz` とする。Tauri/macOS の app updater artifact と整合し、POSIX mode と symlink の扱いを明示でき、macOS の `tar` / `gzip` で local fixture を検証できるため。 | 候補比較と local capability check |
| A-002 | assumption | archive の公開 filename は `cornell-method-notebook-<version>-aarch64-apple-darwin.app.tar.gz` とする。`version` は manifest の SemVer を表示するが、reader は filename や `artifactId` を parse して信頼しない。 | product slug、manifest target、固定 format の組み合わせ |
| A-003 | assumption | pre-open hard cap は compressed bytes 2 GiB、expanded regular-file bytes 8 GiB、single entry 1 GiB、entry count 250,000、path / symlink target 1,024 bytes、symlink chain 16 hop とする。変更は実 Tauri package の測定後に別途承認する。 | resource tree が大きい現行 config と decompression-bomb 対策の両立 |
| U-001 | unknown | signature proof の暗号 algorithm、encoding、canonicalization、public key value、key rotation は未決定。 | 既存 manifest contract。別 task の対象 |
| U-002 | unknown | current environment では Tauri CLI がないため、`target/.../bundle/macos/` に生成される実 `.app` の exact output name、Info.plist の実値、symlink の実態、archive size は未確認。 | local capability check は read-only の tool presence に限定 |
| U-003 | unknown | GitHub CDN の package final Content-Type、redirect chain、release asset の実配置は未確認。 | network / GitHub 禁止 |
| U-004 | unknown | minimum macOS / deployment target、Developer ID / notarization、public release の配布手続きは Desktop Alpha archive contract の対象外。 | current docs の Alpha / Public Mac Release boundary |

## Worker Report

### 採用案

アプリ内更新 package は `.app.tar.gz` とする。

```text
container: gzip-compressed POSIX tar
extension: .app.tar.gz
manifest format: app-archive
target: aarch64-apple-darwin
```

初期配布は DMG のまま維持する。

| 候補 | 用途 | 判定 |
|---|---|---|
| `.tar.gz` containing one `.app` | background download 後に staging へ展開する in-app update | 採用。Tauri の macOS updater artifact 慣例、POSIX permission / symlink、macOS local tooling に合う |
| `.zip` containing one `.app` | Finder / Archive Utility と cross-platform tooling を使う package | Alpha の主形式にはしない。Unix mode、symlink、追加 metadata の扱いを実装側で揃える必要があり、今回の macOS-only target に対する利点が小さい |
| `.dmg` | 初期配布、Finder で install する disk image | update package には使わない。mount、volume、installer UX の境界が app replacement pipeline と異なる |

DMG と update package の役割は次のとおりとする。

- Tauri build の `app` output を元に、初期配布用の `.dmg` を生成する。
- 同じ Apple Silicon `.app` output を一つだけ `.app.tar.gz` へ包む。
- DMG を `artifact.format: "app-archive"` の候補にしない。
- archive reader は DMG mount、Finder 操作、app bundle の直接上書きを行わない。

### Filename、version、artifactId、MIME

公開 asset の canonical filename は次とする。

```text
cornell-method-notebook-<version>-aarch64-apple-darwin.app.tar.gz
```

例:

```text
cornell-method-notebook-1.2.3-aarch64-apple-darwin.app.tar.gz
```

初期配布 DMG は同じ product/version/architecture token を使い、末尾を `.dmg` とする。filename は配布者向けの識別子であり、manifest の `artifactId` や archive 内 metadata の代用品にしない。

- `version` は manifest release の exact SemVer と、展開後 `Info.plist` の `CFBundleShortVersionString` に一致させる。
- `aarch64-apple-darwin` は package target token とし、実バイナリの arm64-only 検査を省略する理由にしない。
- `artifactId` は既存契約どおり opaque immutable identity とする。同じ package bytes と同じ release metadata に対して同じ ID を使い、URL、filename、表示名から導出しない。
- reader は `artifactId` の文字列を path として使わず、filename から version / architecture を推定しない。selected manifest の fields と展開後 bundle の fields を比較する。
- `artifact.format` は引き続き `app-archive`。実拡張子 `.app.tar.gz` は packaging / download implementation の固定値であり、manifest field の値を変更しない。
- `sizeBytes` は gzip-compressed archive の wire bytes の長さ。展開後 app bundle の容量や regular-file の合計ではない。
- `sha256` は同じ gzip-compressed archive bytes 全体の SHA-256。PoC の `appBundleMetrics` hash や展開後 directory hash はこの値に使わない。
- signature `proof` は既存 contract に従い、digest と release metadata を署名した opaque value とする。署名方式は別 task で決める。

package response の Content-Type は次の allowlist とする。

| package | preferred Content-Type | compatibility allowance | fail-closed |
|---|---|---|---|
| `.app.tar.gz` | `application/gzip` | `application/octet-stream`。media type は case-insensitive、parameter は無視して比較する | missing、その他の type、body が gzip magic / tar と一致しない場合 |
| `.dmg` | `application/x-apple-diskimage` を配布側の目安とする | update reader は DMG を受け付けない | update pipeline に DMG を渡した場合 |

`Content-Disposition` の filename、redirect URL の basename、HTTP header の表示名は信頼根にしない。`Content-Length` がある場合は manifest `sizeBytes` と一致しなければ拒否し、header がない場合も streaming byte count が `sizeBytes` と一致することを要求する。body count が hard cap を超えた時点で中止する。manifest fetch の既存 Content-Type allowlist は変更しない。

### Archive root layout

archive は redundant wrapper directory を持たず、top-level entry を一つの `.app` directory に限定する。

```text
cornell-method-notebook-1.2.3-aarch64-apple-darwin.app.tar.gz
└── Cornell Method Notebook.app/
    └── Contents/
        ├── Info.plist
        ├── MacOS/
        │   └── <CFBundleExecutable>
        ├── Resources/
        └── [Frameworks, PlugIns, _CodeSignature, SharedSupport など必要な bundle entries]
```

次の layout は拒否する。

- top-level に `.app` 以外の file / directory がある。
- `package/`、`release/` などの wrapper directory の下に `.app` がある。
- `__MACOSX/`、`.DS_Store`、signature sidecar、manifest、release note などの top-level extra entry がある。
- archive 内に二つ以上の `.app` がある、または `.app` が nested `.app` を含む。
- top-level app が symlink である、`Contents` / `Info.plist` / `Contents/MacOS/<CFBundleExecutable>` が欠ける。

entry path の扱いは次のとおりとする。

- POSIX `/` 区切りの相対 path だけを受け付ける。
- absolute path、空 component、`.`、`..`、backslash、NUL、control character、path length 超過を拒否する。
- archive parser の PAX metadata は metadata として処理し、実体 entry として top-level count に加えない。未解釈の metadata が path や mode を上書きする場合は拒否する。
- hard link、block device、character device、FIFO、socket、その他の special file は拒否する。
- symlink は、相対 target、root 内への lexical resolution、target entry の存在、最大 16 hop、loop なしを満たす場合だけ許可する。absolute target、`..` で root 外へ出る target、dangling target、外部 path、symlink 経由の extraction は拒否する。
- extraction は symlink を follow せず、stage root 下の path だけへ書く。staging root とその親も symlink でないことを確認する。

permission は owner / group / other の mode bits を検査する。

- setuid、setgid、sticky bit、group/other writable file は拒否する。
- regular file は owner read を持ち、executable file は owner execute を持つことを要求する。通常の bundle file は `0644`、Mach-O / launcher は `0755` 相当を許可する。
- directory は traversal に必要な execute を持ち、group/other writable でないことを要求する。
- archive uid、gid、owner name は採用せず、現在の user と umask の範囲で安全な mode を設定する。

### 解凍 bomb と entry safety limits

| limit | 初期 hard cap | 超過時 |
|---|---:|---|
| compressed archive bytes | 2 GiB | download 中止。manifest `sizeBytes` が超えていれば network request 前に拒否 |
| expanded regular-file bytes | 8 GiB | extract 中止、partial tree を破棄 |
| single regular entry | 1 GiB | extract 前に拒否 |
| material entry count | 250,000 | preflight 中に拒否 |
| normalized path bytes | 1,024 | entry を拒否 |
| symlink target bytes | 1,024 | entry を拒否 |
| symlink resolution hops | 16 | entry を拒否 |

gzip は一つの gzip stream とし、末尾の非 padding bytes、concatenated member、壊れた CRC / size を拒否する。tar header の logical size、PAX size、sparse metadata、実際の decompressed bytes を別々に確認し、counter overflow と sparse inflation を許さない。hard cap は現行 resource footprint を包める初期値であり、実 package の clean build 測定後に増減を承認する。

### Download、staging、extraction の境界

次の三段階を分離する。

1. `download_and_verify_artifact` は selected manifest release、Application Support の `staging`、HTTP transport、signature verifier を受け取り、検証済み raw archive を返す。
2. `extract_and_validate_app_bundle` は検証済み raw archive を staging 内の新しい temporary directory へ展開し、検証済み `.app` path と bundle identity を返す。
3. apply / restart / old bundle cleanup / DB migration は後続 task の責務とし、この interface から呼ばない。

staging の相対 layout は次を推奨する。

```text
<Application Support>/staging/
├── incoming/<sha256>.part
├── packages/<sha256>.app.tar.gz
└── extract/<sha256>.tmp/Cornell Method Notebook.app/
```

extract 成功後は temporary directory を同じ staging root 内で ready directory へ atomic rename する。`<sha256>` は manifest validation 済みの lowercase hex だけを使い、`artifactId`、URL basename、Content-Disposition の値を path component にしない。state に保存する package path は Application Support からの relative path に限定し、absolute user path、URL、response body、token は保存しない。

download の完了条件は、HTTP status / redirect / Content-Type、actual byte count、manifest `sizeBytes`、raw archive SHA-256、signature verifier の成功である。これらが揃う前に gzip / tar を開かない。

展開前の preflight は全 entry の path、type、mode、symlink target、entry count、logical expanded size を検査する。preflight と no-follow extraction を分け、展開中の symlink escape、path traversal、special file creation を防ぐ。

### Pre-open / post-extraction validation の責務

| 段階 | 検査対象 | この段階の成功条件 |
|---|---|---|
| manifest / selection 前提 | `format`、target、version、URL、`sizeBytes`、`sha256`、signature fields | selected release が既存 validation / selection を通過し、format が `app-archive` |
| archive を開く前 | final HTTPS response、status、redirect、Content-Type、declared / actual size、raw SHA-256、signature proof | raw bytes が exact `sizeBytes`、digest が manifest と一致し、signature verifier が成功 |
| tar preflight | gzip member、tar header、canonical path、root count、entry type、mode、symlink、expanded limits | top-level が一つの app directory で、安全な全 entry を事前に列挙できる |
| 展開後 bundle | top-level app、`Info.plist`、bundle identifier、version、`CFBundleExecutable`、Mach-O executable、architecture、nested app、permissions | `com.cornellmethod.notebook`、selected version、arm64-only executable / code files を確認し、起動可能な bundle path を返す |
| apply 前後 | app replacement、DB migration、restart、health check、rollback | この task の対象外。後続 task が current app / live DB 維持の契約へ接続する |

展開後は `Info.plist` の `CFBundleIdentifier` が `com.cornellmethod.notebook`、`CFBundleShortVersionString` が selected manifest version、`CFBundleExecutable` が `Contents/MacOS` 内の単一の regular file を指すことを要求する。main executable は Mach-O arm64-only とし、`Contents` 以下で認識できる Mach-O code file も arm64 slice だけを持つことを確認する。filename、manifest architecture、host architecture のいずれも binary inspection の代わりにしない。

### Error categories と fail-closed action

次の categories を fixed lowercase error code family として後続 task に渡す。raw URL、absolute path、OS error message、manifest body は error DTO や update state に含めない。

| category | 代表 code family | 例 | 失敗時の動作 |
|---|---|---|---|
| download transport | `package-network`、`package-timeout`、`package-http-status`、`package-redirect` | network、非 2xx、HTTP downgrade、redirect loop | temp を破棄し、現行版を維持 |
| response metadata | `package-content-type`、`package-size` | missing / wrong type、Content-Length 不一致、hard cap 超過 | archive を開かずに破棄 |
| integrity | `package-digest`、`package-signature` | size / SHA-256 / proof 不一致、trusted key 不在 | archive を verified 扱いにしない |
| container | `archive-gzip`、`archive-tar`、`archive-trailing-data` | gzip / tar malformed、CRC / trailing data | partial tree を破棄 |
| entry safety | `archive-path`、`archive-root`、`archive-limit`、`archive-symlink`、`archive-special-file`、`archive-permission` | traversal、extra root、bomb、escape、device、mode abuse | extract を中止し、partial tree を破棄 |
| bundle identity | `bundle-layout`、`bundle-plist`、`bundle-identity`、`bundle-version`、`bundle-executable`、`bundle-architecture` | Info.plist 不備、identifier/version mismatch、executable 欠落、x86_64 / universal mismatch | verified bundle を返さない |
| staging I/O | `staging-path`、`staging-read`、`staging-write`、`staging-rename` | root 不備、write / fsync / atomic rename 失敗 | current app、live DB、既存 verified package を変更しない |

既存 update state では package discovery の `Available` / `NotVerified` と、package verification failure を混同しない。検証失敗は `Failed` の sanitized code へ map するか、後続の state pipeline が定める failure boundary へ渡す。`Available` を installable / trusted と表示する既存 UI 契約は変更しない。

### Tauri bundle output との照合方法

現行 `src-tauri/tauri.conf.json` を入力に、Tauri CLI が利用できる Apple Silicon packaging environment で次を実施する。

1. `cargo tauri build --target aarch64-apple-darwin` を `src-tauri/` から実行し、既存 targets の `.app` と DMG を生成する。現在の環境では CLI 未導入のため実行していない。
2. build が報告する `target/<triple>/release/bundle/macos/` 相当の output から、symlink でない `Cornell Method Notebook.app` directory を一つだけ選ぶ。DMG は別 artifact として扱う。
3. `Contents/Info.plist` を読み、identifier、version、`CFBundleExecutable` を記録する。`Contents/MacOS/<executable>` を `lstat` し、regular file と owner executable を確認する。
4. macOS QA では `file`、`lipo -info`、`plutil`、必要に応じて `codesign` / `otool` で arm64-only、bundle identity、plist、code-signature presence を確認する。署名 proof の algorithm contract はこの task で定めない。
5. app output の親 directory を archive root として `/usr/bin/tar` と gzip で、root entry が `Cornell Method Notebook.app` だけになるよう `.app.tar.gz` を作る。`tar -tzf` で root layout を確認し、raw archive file に SHA-256 と byte length を計算する。
6. archive を disposable staging へ round-trip 展開し、元 `.app` と bundle identity / executable / architecture / permissions を比較する。manifest `sha256` は raw archive file の値にする。

PoC の `appBundleMetrics` は展開後 directory の regular-file bytes と canonical entry hash を計測する検証用関数であり、manifest `sha256` の根拠に再利用しない。PoC output、package、DMG、user data は製品配布物に持ち込まない。

### 次の coding task の interface、対象、fixtures

次の task は package download / archive validation に限定し、apply / rollback と同じ task にしない。

推奨 interface は次の形である。

```text
download_and_verify_artifact(
  selected_release,
  staging_root,
  artifact_transport,
  signature_verifier,
) -> Result<VerifiedArchive, PackageError>

extract_and_validate_app_bundle(
  verified_archive,
  staging_root,
  bundle_inspector,
) -> Result<VerifiedAppBundle, PackageError>
```

`selected_release` は既存 `UpdateRelease` を受け取り、`artifactId`、`format`、`url`、`sizeBytes`、`sha256`、`signature`、release version / channel / architecture を別 DTO に再定義しない。`signature_verifier` は digest と release metadata を受け取る trait boundary だけを持ち、暗号 algorithm の決定をこの task へ持ち込まない。戻り値は absolute path ではなく、staging root からの relative archive / app path、artifact identity、verified digest、bundle identity、version、architecture を持つ。

対象ファイルの推奨範囲は次のとおり。

- 新規 `src-tauri/src/update_archive.rs` または同等の archive module。download、pre-open integrity、safe tar extraction、bundle validation を担当する。
- `src-tauri/src/main.rs` は module wiring に限定する。
- `src-tauri/src/runtime.rs` は既存 Application Support / staging root resolver が不足する場合だけ接続する。
- `src-tauri/src/lifecycle.rs` は apply / restart task まで変更しない。
- `src-tauri/Cargo.toml` と `Cargo.lock` は parser / gzip / SHA-256 implementation を追加する場合だけ、依存理由と offline verification を伴って変更する。今回の task では変更しない。
- `src-tauri/tauri.conf.json`、`package.json` は archive contract のために変更しない。Tauri build の `app` / `dmg` target は既存設定を使う。
- Rust unit test と `test/desktop/desktop-update-archive.test.js`、disposable fixture directory を追加する。production package、real GitHub、production Application Support は使わない。

最低限の fixture / test case は次のとおり。

1. valid gzip + tar、top-level single `.app`、valid `Info.plist`、valid executable、arm64 inspector stub。
2. wrong / missing Content-Type、non-2xx、redirect downgrade / loop、Content-Length mismatch、streamed size mismatch、compressed cap overrun、SHA-256 mismatch。
3. invalid gzip、bad CRC、concatenated member、tar truncation、trailing data、PAX size overflow、sparse inflation、entry count / expanded size / single entry cap overrun。
4. top-level extra file、wrapper directory、two app roots、nested `.app`、absolute path、`.`、`..`、duplicate path、backslash、NUL / control character。
5. absolute symlink、outside symlink、`..` escape、dangling symlink、loop、symlink through extraction、hardlink、FIFO / device / socket。
6. setuid / setgid / sticky、group/other writable、missing owner execute、wrong mode、permission / rename / fsync failure。
7. missing / malformed `Info.plist`、wrong `CFBundleIdentifier`、wrong version、missing / multiple executable、x86_64、universal when arm64-only is required、nested app。
8. staging root symlink、artifactId / URL basename path injection、failure cleanup、current app / live DB unchanged、verified archive path relative-only。
9. Tauri-produced real `.app` round-trip fixture。Tauri CLI が利用できる環境でのみ実行し、package archive の filename、root entries、Info.plist、arm64、raw size / digest を記録する。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 既存の未コミット変更、`src-tauri/`、Desktop tests、既存 summaries を確認し、変更していない |
| canonical docs / current source / prior summary read-only inventory | PASS | `rg`、`sed`、`nl`、`find`、`du` のみ。対象境界と fields を照合 |
| local macOS capability check | PASS | Apple Silicon と macOS archive / bundle inspection tools の presence / version だけを確認 |
| Tauri CLI / real bundle build | NOT RUN | local `cargo tauri` / Tauri CLI が未導入。build、archive generation、mount、signature inspection は未実施 |
| GitHub / network / release publish / package download | NOT RUN | task 制約を維持。固定 manifest URL へ接続していない |
| code / config / dependency / lockfile / test / generated artifact / docs changes | PASS | 本 summary 以外の製品側変更なし |
| `git diff --check` | PASS | summary 作成前後に実施。既存 worktree と summary に whitespace error なし |
| summary validation | PASS | `sh tools/check-summary.sh summary/20260823/0259-specify-desktop-app-archive-contract.md` が終了コード 0 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| R-001 | signature proof の algorithm、encoding、canonicalization、key value、rotation | 別の署名 verification contract / implementation task |
| R-002 | Tauri の実 Apple Silicon `.app` output name、Info.plist の実値、bundle 内 symlink / permission、archive の実サイズ | Tauri CLI が利用可能な packaging environment で clean build と round-trip fixture |
| R-003 | GitHub release asset の final Content-Type、redirect chain、Content-Disposition | network を許可した別の online / packaged QA。今回の contract は `application/gzip` / `application/octet-stream` と HTTPS-only を採用 |
| R-004 | 2 GiB / 8 GiB / 250,000 entries の hard cap が実 Tauri output に十分か | 実 package の計測。変更する場合は archive safety contract を再承認 |
| R-005 | `UpdateStateStore` の `Verified` 遷移、relative package path の永続化、download retry / cleanup retention | package verification と state integration を分けた後続 task |
| R-006 | apply 時の old app retention、atomic switch、DB migration、restart、health check、rollback | 既存 Desktop Alpha migration / apply contract。今回の archive task では実装しない |

## Next Read

次の coding task はこの summary を起点に、次の最小ファイルだけを読む。

- `summary/20260823/0259-specify-desktop-app-archive-contract.md`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/update_manifest.rs`
- `src-tauri/src/update_provider.rs`
- `src-tauri/src/update_selection.rs`
- `src-tauri/src/update_state.rs`
- `src-tauri/src/runtime.rs`
- `src-tauri/src/main.rs`
- `tools/desktop-poc/tauri/scripts/package.cjs`
- `test/desktop/desktop-update-manifest.test.js`
- `test/desktop/desktop-update-provider.test.js`
- `test/desktop/desktop-update-selection.test.js`
